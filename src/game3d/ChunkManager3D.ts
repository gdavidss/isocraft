/**
 * Chunk Manager for Three.js
 * Manages chunk loading/unloading and rendering
 */

import * as THREE from 'three';
import { CHUNK_SIZE, BlockType, TreeTypeToLogBlockType, TreeTypeToLeavesBlockType } from '../world/types';
import type { ChunkGenerator, ChunkData } from '../world/ChunkGenerator';
import { TextureManager3D } from './TextureManager3D';
import { FallingBlockManager } from './FallingBlock';
import {
  getBlockDef,
  getUndergroundLayers,
  isBlockGravityAffected,
  isBlockSapling,
  isBlockDoor,
  isBlockTrapdoor,
  isBlockLog,
} from '../world/BlockDefinition';

const DEFAULT_LOAD_RADIUS = 4;   // Default chunks to load around player
const DEFAULT_UNLOAD_RADIUS = 6; // Default chunks to unload beyond this

// Reusable geometry for blocks
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
// Compute bounding sphere for raycasting to work properly
blockGeometry.computeBoundingSphere();
blockGeometry.computeBoundingBox();

// Water is 8/9 of a block height (slightly lower than full block)
// Water is a flat plane (no sides) at 7/9 height
const WATER_HEIGHT = 7 / 9; // ~0.778
const waterGeometry = new THREE.PlaneGeometry(1, 1);
// Rotate to be horizontal (XZ plane) and position at water surface level
waterGeometry.rotateX(-Math.PI / 2);
waterGeometry.translate(0, WATER_HEIGHT - 0.5, 0);

// Cross geometry for saplings, flowers, grass, etc. (two intersecting planes)
function createCrossGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  
  // Two planes crossing at 45 degrees, each 1x1 unit
  // Plane 1: diagonal from (-0.5, 0, -0.5) to (0.5, 1, 0.5)
  // Plane 2: diagonal from (-0.5, 0, 0.5) to (0.5, 1, -0.5)
  
  const vertices = new Float32Array([
    // Plane 1 (SW to NE diagonal)
    -0.5, 0, -0.5,   0.5, 0, 0.5,    0.5, 1, 0.5,
    -0.5, 0, -0.5,   0.5, 1, 0.5,   -0.5, 1, -0.5,
    // Plane 1 backface
    0.5, 0, 0.5,    -0.5, 0, -0.5,  -0.5, 1, -0.5,
    0.5, 0, 0.5,    -0.5, 1, -0.5,   0.5, 1, 0.5,
    
    // Plane 2 (NW to SE diagonal)
    -0.5, 0, 0.5,    0.5, 0, -0.5,   0.5, 1, -0.5,
    -0.5, 0, 0.5,    0.5, 1, -0.5,  -0.5, 1, 0.5,
    // Plane 2 backface
    0.5, 0, -0.5,   -0.5, 0, 0.5,   -0.5, 1, 0.5,
    0.5, 0, -0.5,   -0.5, 1, 0.5,    0.5, 1, -0.5,
  ]);
  
  const uvs = new Float32Array([
    // Plane 1 front
    0, 0,  1, 0,  1, 1,
    0, 0,  1, 1,  0, 1,
    // Plane 1 back (mirrored)
    0, 0,  1, 0,  1, 1,
    0, 0,  1, 1,  0, 1,
    
    // Plane 2 front
    0, 0,  1, 0,  1, 1,
    0, 0,  1, 1,  0, 1,
    // Plane 2 back (mirrored)
    0, 0,  1, 0,  1, 1,
    0, 0,  1, 1,  0, 1,
  ]);
  
  // All normals point up for even lighting (like Minecraft)
  const normals = new Float32Array([
    // All vertices use up-facing normals for consistent lighting
    0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, 1, 0,  0, 1, 0,  0, 1, 0,
  ]);
  
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  
  return geometry;
}

// Reusable cross geometry for saplings
const crossGeometry = createCrossGeometry();

// Re-export door/trapdoor checks for external use (using flyweight definitions)
export function isDoorBlock(blockType: BlockType): boolean {
  return isBlockDoor(blockType);
}

export function isTrapdoorBlock(blockType: BlockType): boolean {
  return isBlockTrapdoor(blockType);
}

// Door textures mapping (bottom and top textures)
const DOOR_TEXTURES: Partial<Record<BlockType, { bottom: string; top: string }>> = {
  [BlockType.OakDoor]: { bottom: '/textures/oak_door_bottom.png', top: '/textures/oak_door_top.png' },
  [BlockType.BirchDoor]: { bottom: '/textures/birch_door_bottom.png', top: '/textures/birch_door_top.png' },
  [BlockType.SpruceDoor]: { bottom: '/textures/spruce_door_bottom.png', top: '/textures/spruce_door_top.png' },
  [BlockType.JungleDoor]: { bottom: '/textures/jungle_door_bottom.png', top: '/textures/jungle_door_top.png' },
  [BlockType.AcaciaDoor]: { bottom: '/textures/acacia_door_bottom.png', top: '/textures/acacia_door_top.png' },
  [BlockType.DarkOakDoor]: { bottom: '/textures/dark_oak_door_bottom.png', top: '/textures/dark_oak_door_top.png' },
  [BlockType.CherryDoor]: { bottom: '/textures/cherry_door_bottom.png', top: '/textures/cherry_door_top.png' },
  [BlockType.MangroveDoor]: { bottom: '/textures/mangrove_door_bottom.png', top: '/textures/mangrove_door_top.png' },
};

// Door thickness (3/16 of a block, like Minecraft)
const DOOR_THICKNESS = 3 / 16;

/**
 * Create a single door panel geometry (1 block high)
 * Used for both top and bottom halves with separate textures
 */
function createDoorPanelGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  
  // Door panel is 1 block wide, 1 block tall, DOOR_THICKNESS deep
  // Positioned on the south edge of the block (positive Z)
  const halfWidth = 0.5;
  const halfThick = DOOR_THICKNESS / 2;
  const height = 1;
  
  // Position at the south edge of the block
  const z = 0.5 - halfThick;
  
  const vertices = new Float32Array([
    // Front face (facing south, +Z)
    -halfWidth, 0, z + halfThick,   halfWidth, 0, z + halfThick,   halfWidth, height, z + halfThick,
    -halfWidth, 0, z + halfThick,   halfWidth, height, z + halfThick,   -halfWidth, height, z + halfThick,
    
    // Back face (facing north, -Z)
    halfWidth, 0, z - halfThick,   -halfWidth, 0, z - halfThick,   -halfWidth, height, z - halfThick,
    halfWidth, 0, z - halfThick,   -halfWidth, height, z - halfThick,   halfWidth, height, z - halfThick,
    
    // Left face (west, -X)
    -halfWidth, 0, z - halfThick,   -halfWidth, 0, z + halfThick,   -halfWidth, height, z + halfThick,
    -halfWidth, 0, z - halfThick,   -halfWidth, height, z + halfThick,   -halfWidth, height, z - halfThick,
    
    // Right face (east, +X)
    halfWidth, 0, z + halfThick,   halfWidth, 0, z - halfThick,   halfWidth, height, z - halfThick,
    halfWidth, 0, z + halfThick,   halfWidth, height, z - halfThick,   halfWidth, height, z + halfThick,
    
    // Top face
    -halfWidth, height, z + halfThick,   halfWidth, height, z + halfThick,   halfWidth, height, z - halfThick,
    -halfWidth, height, z + halfThick,   halfWidth, height, z - halfThick,   -halfWidth, height, z - halfThick,
    
    // Bottom face
    -halfWidth, 0, z - halfThick,   halfWidth, 0, z - halfThick,   halfWidth, 0, z + halfThick,
    -halfWidth, 0, z - halfThick,   halfWidth, 0, z + halfThick,   -halfWidth, 0, z - halfThick,
  ]);
  
  // UVs - full texture for each 1-block panel
  const uvs = new Float32Array([
    // Front face - full texture
    0, 0,  1, 0,  1, 1,
    0, 0,  1, 1,  0, 1,
    
    // Back face - full texture (mirrored)
    0, 0,  1, 0,  1, 1,
    0, 0,  1, 1,  0, 1,
    
    // Left face - thin edge
    0.4, 0,  0.6, 0,  0.6, 1,
    0.4, 0,  0.6, 1,  0.4, 1,
    
    // Right face - thin edge
    0.4, 0,  0.6, 0,  0.6, 1,
    0.4, 0,  0.6, 1,  0.4, 1,
    
    // Top face - small strip
    0, 0.4,  1, 0.4,  1, 0.6,
    0, 0.4,  1, 0.6,  0, 0.6,
    
    // Bottom face - small strip
    0, 0.4,  1, 0.4,  1, 0.6,
    0, 0.4,  1, 0.6,  0, 0.6,
  ]);
  
  const normals = new Float32Array([
    // Front face
    0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, 1,  0, 0, 1,  0, 0, 1,
    // Back face
    0, 0, -1,  0, 0, -1,  0, 0, -1,
    0, 0, -1,  0, 0, -1,  0, 0, -1,
    // Left face
    -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
    -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
    // Right face
    1, 0, 0,  1, 0, 0,  1, 0, 0,
    1, 0, 0,  1, 0, 0,  1, 0, 0,
    // Top face
    0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, 1, 0,  0, 1, 0,  0, 1, 0,
    // Bottom face
    0, -1, 0,  0, -1, 0,  0, -1, 0,
    0, -1, 0,  0, -1, 0,  0, -1, 0,
  ]);
  
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  
  return geometry;
}

// Reusable door panel geometry (1 block high)
const doorPanelGeometry = createDoorPanelGeometry();

/**
 * Create a merged cactus geometry for the given height
 * Uses BoxGeometry with tiled UVs on side faces
 */
function createCactusGeometry(height: number): THREE.BufferGeometry {
  // Create full cube geometry (1x1 per block)
  const geo = new THREE.BoxGeometry(1, height, 1);
  geo.translate(0, height / 2, 0); // Bottom at y=0
  
  // Scale and flip UV Y coordinates on side faces so texture tiles correctly (right-side up)
  const uv = geo.getAttribute('uv');
  const normal = geo.getAttribute('normal');
  
  for (let i = 0; i < uv.count; i++) {
    // Check if this vertex is on a side face (not top/bottom)
    if (Math.abs(normal.getY(i)) < 0.5) {
      // Flip V coordinate (1 - v) then scale by height to tile texture
      const v = uv.getY(i);
      uv.setY(i, (1 - v) * height);
    }
  }
  
  uv.needsUpdate = true;
  return geo;
}

// LOD levels for tree rendering
enum TreeLOD {
  Full = 0,      // All trees with full detail
  Reduced = 1,   // Simplified trees (no corner leaves)
  Hidden = 2,    // No trees at all
}

export class ChunkManager3D {
  private scene: THREE.Scene;
  private generator: ChunkGenerator;
  private textureManager: TextureManager3D;
  
  private chunks: Map<string, THREE.Group> = new Map();
  private chunkData: Map<string, ChunkData> = new Map();
  
  // Track broken blocks so they don't reappear on chunk reload
  private brokenBlocks: Map<string, Set<string>> = new Map(); // chunkKey -> Set of "x,y,z"
  
  // Track player-placed blocks: chunkKey -> Map of "x,y,z" -> BlockType
  private placedBlocks: Map<string, Map<string, BlockType>> = new Map();
  
  // Track door states: "x,y,z" -> { open: boolean, facing: number (0-3 for N/E/S/W) }
  private doorStates: Map<string, { open: boolean; facing: number }> = new Map();
  
  // Door textures cache
  private doorMaterials: Map<string, THREE.Material> = new Map();
  
  private lastPlayerChunkX = -999;
  private lastPlayerChunkZ = -999;
  
  // Render distance settings
  private loadRadius = DEFAULT_LOAD_RADIUS;
  private unloadRadius = DEFAULT_UNLOAD_RADIUS;
  
  // LOD settings
  private currentZoom = 10;
  private treeLOD = TreeLOD.Full;
  private fastGraphics = false;
  
  // Falling block system (sand/gravel gravity)
  private fallingBlockManager: FallingBlockManager;
  
  // Player position reference for falling block collision
  private playerPosition: THREE.Vector3 | null = null;

  constructor(
    scene: THREE.Scene,
    generator: ChunkGenerator,
    textureManager: TextureManager3D
  ) {
    this.scene = scene;
    this.generator = generator;
    this.textureManager = textureManager;
    
    // Initialize falling block manager
    this.fallingBlockManager = new FallingBlockManager(
      scene,
      // Place block callback
      (x, y, z, blockType) => this.placeBlockInternal(x, y, z, blockType),
      // Remove block callback (doesn't trigger further falling checks to avoid recursion)
      (x, y, z) => this.removeBlockInternal(x, y, z),
      // Get height callback
      (x, z) => this.getHeightAt(x, z),
      // Is solid callback
      (x, y, z) => this.isSolidAt(x, y, z),
      // Get block callback
      (x, y, z) => this.getBlockTypeAt(x, y, z)
    );
    
    // Set up block materials for falling blocks
    this.initFallingBlockMaterials();
  }
  
  /**
   * Initialize materials for falling blocks
   */
  private initFallingBlockMaterials(): void {
    const materials = new Map<BlockType, THREE.Material>();
    
    // Add materials for gravity-affected blocks
    materials.set(BlockType.Sand, this.textureManager.getMaterial(BlockType.Sand));
    materials.set(BlockType.Gravel, this.textureManager.getMaterial(BlockType.Gravel));
    materials.set(BlockType.RedSand, this.textureManager.getMaterial(BlockType.RedSand));
    
    this.fallingBlockManager.setBlockMaterials(materials);
  }
  
  /**
   * Set current zoom level for LOD calculations
   */
  setZoom(zoom: number): void {
    this.currentZoom = zoom;
    this.updateTreeLOD();
  }
  
  /**
   * Set graphics quality mode
   */
  setFastGraphics(fast: boolean): void {
    this.fastGraphics = fast;
    this.updateTreeLOD();
  }
  
  /**
   * Update tree LOD based on zoom and graphics settings
   */
  private updateTreeLOD(): void {
    let newLOD = TreeLOD.Full;
    
    // Determine LOD based on zoom level
    // Higher zoom number = more zoomed out = more objects visible = need more culling
    // More aggressive thresholds for better performance
    if (this.fastGraphics) {
      if (this.currentZoom > 45) {
        newLOD = TreeLOD.Hidden;
      } else if (this.currentZoom > 35) {
        newLOD = TreeLOD.Reduced;
      }
    } else {
      if (this.currentZoom > 55) {
        newLOD = TreeLOD.Hidden;
      } else if (this.currentZoom > 45) {
        newLOD = TreeLOD.Reduced;
      }
    }
    
    // Apply LOD change if needed
    if (newLOD !== this.treeLOD) {
      this.treeLOD = newLOD;
      this.applyTreeLOD();
    }
  }
  
  /**
   * Apply current tree LOD to all chunks
   * Note: Trees are now in the same group as terrain, so this is a no-op
   * Tree hiding would require traversing all meshes which is expensive
   */
  private applyTreeLOD(): void {
    // No-op: Trees are in the main chunk group for proper raycasting
    // If LOD hiding is needed in the future, implement mesh-level visibility
  }
  
  /**
   * Set render distance (chunk load radius)
   */
  setRenderDistance(radius: number): void {
    this.loadRadius = Math.max(2, Math.min(8, radius));
    this.unloadRadius = this.loadRadius + 2;
    
    // Force chunk update by resetting last position
    this.lastPlayerChunkX = -999;
    this.lastPlayerChunkZ = -999;
  }
  
  /**
   * Get current render distance
   */
  getRenderDistance(): number {
    return this.loadRadius;
  }

  /**
   * Set player position for falling block collision detection
   */
  setPlayerPosition(position: THREE.Vector3): void {
    this.playerPosition = position;
    this.fallingBlockManager.setPlayerPosition(position);
  }

  /**
   * Update chunks around player position
   */
  update(playerX: number, playerZ: number): void {
    const chunkX = Math.floor(playerX / CHUNK_SIZE);
    const chunkZ = Math.floor(playerZ / CHUNK_SIZE);
    
    // Only update if player moved to a new chunk
    if (chunkX === this.lastPlayerChunkX && chunkZ === this.lastPlayerChunkZ) {
      return;
    }
    
    this.lastPlayerChunkX = chunkX;
    this.lastPlayerChunkZ = chunkZ;
    
    // Load nearby chunks
    for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
      for (let dz = -this.loadRadius; dz <= this.loadRadius; dz++) {
        const cx = chunkX + dx;
        const cz = chunkZ + dz;
        const key = `${cx},${cz}`;
        
        if (!this.chunks.has(key)) {
          this.loadChunk(cx, cz);
        }
      }
    }
    
    // Unload distant chunks
    for (const [key, group] of this.chunks) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = Math.abs(cx - chunkX);
      const dz = Math.abs(cz - chunkZ);
      
      if (dx > this.unloadRadius || dz > this.unloadRadius) {
        this.unloadChunk(key, group);
      }
    }
  }
  
  /**
   * Update falling blocks (should be called each frame)
   * @param deltaTime Time elapsed since last frame
   */
  updateFallingBlocks(deltaTime: number): void {
    const landedBlocks = this.fallingBlockManager.update(deltaTime);
    
    // For each landed block, rebuild the chunk
    for (const landed of landedBlocks) {
      const chunkX = Math.floor(landed.x / CHUNK_SIZE);
      const chunkZ = Math.floor(landed.z / CHUNK_SIZE);
      this.rebuildChunk(chunkX, chunkZ);
    }
  }
  
  /**
   * Get the count of currently falling blocks
   */
  getFallingBlockCount(): number {
    return this.fallingBlockManager.getFallingBlockCount();
  }

  /**
   * Load a chunk
   */
  private loadChunk(chunkX: number, chunkZ: number): void {
    const key = `${chunkX},${chunkZ}`;
    
    // Generate chunk data
    const data = this.generator.generateChunk(chunkX, chunkZ);
    this.chunkData.set(key, data);
    
    // Create chunk group (contains both terrain and trees for proper raycasting)
    const group = new THREE.Group();
    group.name = `chunk_${key}`;
    
    // World position offset
    const worldX = chunkX * CHUNK_SIZE;
    const worldZ = chunkZ * CHUNK_SIZE;
    
    // Create tree meshes FIRST (so they come before terrain in raycast order)
    // Trees need to be hit by raycast before the terrain below them
    this.createTreeMeshes(group, data, worldX, worldZ);
    
    // Create terrain mesh using instancing for better performance
    this.createTerrainMesh(group, data, worldX, worldZ);
    
    // Add to scene
    this.scene.add(group);
    this.chunks.set(key, group);
  }

  /**
   * Create terrain mesh for a chunk
   * Uses instanced rendering where possible for better performance
   */
  private createTerrainMesh(
    group: THREE.Group,
    data: ChunkData,
    worldX: number,
    worldZ: number
  ): void {
    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
    const chunkKey = `${chunkX},${chunkZ}`;
    
    // Group blocks by type AND biome (for blocks that need biome tinting)
    // Key format: "blockType" or "blockType_biome" for tinted blocks
    const blocksByKey: Map<string, THREE.Vector3[]> = new Map();
    const keyToBlockType: Map<string, BlockType> = new Map();
    const keyToBiome: Map<string, number> = new Map();
    
    // Helper function to add a block to the rendering map
    const addBlock = (x: number, y: number, z: number, blockType: BlockType, biome: number) => {
      if (blockType === BlockType.Air) return;
      
      // Create key - include biome for blocks that need tinting (grass, leaves, water)
      const needsTint = this.textureManager.needsBiomeTint(blockType) || blockType === BlockType.Water;
      const key = needsTint ? `${blockType}_${biome}` : `${blockType}`;
      
      if (!blocksByKey.has(key)) {
        blocksByKey.set(key, []);
        keyToBlockType.set(key, blockType);
        if (needsTint) {
          keyToBiome.set(key, biome);
        }
      }
      blocksByKey.get(key)!.push(new THREE.Vector3(x, y, z));
    };
    
    // Add terrain blocks (skip broken ones)
    // Now with underground layers: surface, dirt/sand, stone, bedrock
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const idx = lz * CHUNK_SIZE + lx;
        const height = data.heightMap[idx];
        const surfaceBlock = data.topBlock[idx];
        const biome = data.biomeMap[idx];
        
        // World position
        const x = worldX + lx;
        const surfaceY = Math.floor(height);
        const z = worldZ + lz;
        
        // Determine underground layer composition based on surface type
        const undergroundLayers = this.getUndergroundLayersForBlock(surfaceBlock);
        
        // Layer 0: Surface block
        if (!this.isBlockBroken(x, surfaceY, z)) {
          addBlock(x, surfaceY, z, surfaceBlock, biome);
        }
        
        // Layer 1: First underground layer (usually dirt or sand)
        const layer1Y = surfaceY - 1;
        if (!this.isBlockBroken(x, layer1Y, z)) {
          addBlock(x, layer1Y, z, undergroundLayers[0], biome);
        }
        
        // Layer 2: Second underground layer (usually stone)
        const layer2Y = surfaceY - 2;
        if (!this.isBlockBroken(x, layer2Y, z)) {
          addBlock(x, layer2Y, z, undergroundLayers[1], biome);
        }
        
        // Layer 3: Bottom layer (always bedrock)
        const layer3Y = surfaceY - 3;
        if (!this.isBlockBroken(x, layer3Y, z)) {
          addBlock(x, layer3Y, z, BlockType.Bedrock, biome);
        }
      }
    }
    
    // Add placed blocks
    const placedMap = this.placedBlocks.get(chunkKey);
    if (placedMap) {
      for (const [posKey, blockType] of placedMap) {
        const [x, y, z] = posKey.split(',').map(Number);
        // Use a default biome (plains = 1) for placed blocks
        // TODO: Could get actual biome from nearby terrain
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const idx = lz * CHUNK_SIZE + lx;
        const biome = data.biomeMap[idx] || 1;
        
        addBlock(x, y, z, blockType, biome);
      }
    }
    
    // Create instanced meshes for each block type/biome combination
    for (const [key, positions] of blocksByKey) {
      if (positions.length === 0) continue;
      
      const blockType = keyToBlockType.get(key)!;
      const biome = keyToBiome.get(key);
      const isWater = blockType === BlockType.Water;
      const isSapling = isBlockSapling(blockType);
      const isLog = isBlockLog(blockType);
      
      // Check if this is a grass-like block that needs multi-material (different top/side textures)
      const isGrassLikeBlock = blockType === BlockType.Grass || 
                               blockType === BlockType.Podzol || 
                               blockType === BlockType.Mycelium;
      
      // Grass-like blocks need multi-material (different top/side/bottom textures)
      // Use individual meshes with material array to show dirt sides correctly
      if (isGrassLikeBlock) {
        const tint = biome !== undefined ? this.textureManager.getBiomeTint(biome) : undefined;
        const materials = this.textureManager.getGrassBlockMaterials(blockType, tint);
        
        for (const pos of positions) {
          const mesh = new THREE.Mesh(blockGeometry, materials);
          mesh.position.set(pos.x, pos.y, pos.z);
          group.add(mesh);
        }
        continue;
      }
      
      // ALWAYS use instanced rendering for log blocks
      if (isLog) {
        const simpleMaterial = this.textureManager.getInstancedMaterial(blockType);
        const instancedMesh = new THREE.InstancedMesh(blockGeometry, simpleMaterial, positions.length);
        const matrix = new THREE.Matrix4();
        
        positions.forEach((pos, i) => {
          matrix.setPosition(pos.x, pos.y, pos.z);
          instancedMesh.setMatrixAt(i, matrix);
        });
        
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.frustumCulled = true;
        group.add(instancedMesh);
        continue;
      }
      
      // Saplings use cross geometry (two intersecting planes)
      if (isSapling) {
        const saplingMaterial = this.textureManager.getSaplingMaterial(blockType);
        
        for (const pos of positions) {
          const mesh = new THREE.Mesh(crossGeometry, saplingMaterial);
          mesh.position.set(pos.x, pos.y, pos.z);
          group.add(mesh);
        }
        continue;
      }
      
      // Doors use special door geometry (thin vertical rectangle, 2 blocks tall)
      if (isDoorBlock(blockType)) {
        for (const pos of positions) {
          const doorMesh = this.createDoorMesh(blockType, pos.x, pos.y, pos.z);
          group.add(doorMesh);
        }
        continue;
      }
      
      // Trapdoors use a thin horizontal plane
      if (isTrapdoorBlock(blockType)) {
        const trapdoorMaterial = this.textureManager.getSaplingMaterial(blockType);
        
        for (const pos of positions) {
          // Create a thin box for trapdoor (1x0.1875x1)
          const trapdoorGeo = new THREE.BoxGeometry(1, 3/16, 1);
          trapdoorGeo.translate(0, 3/32, 0); // Position at bottom of block
          const mesh = new THREE.Mesh(trapdoorGeo, trapdoorMaterial);
          mesh.position.set(pos.x, pos.y, pos.z);
          group.add(mesh);
        }
        continue;
      }
      
      // Get material with appropriate tinting (use instanced materials for terrain)
      let material: THREE.Material;
      if (isWater) {
        // Water uses biome-specific tinting
        material = this.textureManager.getWaterMaterial(biome);
      } else if (biome !== undefined) {
        // Block needs biome tinting (leaves)
        // Use instanced leaves material for terrain
        material = this.textureManager.getInstancedLeavesMaterial(blockType, biome);
      } else {
        // Use instanced material for terrain blocks
        material = this.textureManager.getInstancedMaterial(blockType);
      }
      
      // Use flat plane for water, full cube for other blocks
      const geometry = isWater ? waterGeometry : blockGeometry;
      const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
      
      const matrix = new THREE.Matrix4();
      positions.forEach((pos, i) => {
        // Water and normal blocks are both centered at their terrain position
        // Water geometry is already adjusted to be 8/9 height with bottom aligned
        matrix.setPosition(pos.x, pos.y, pos.z);
        mesh.setMatrixAt(i, matrix);
      });
      
      mesh.instanceMatrix.needsUpdate = true;
      
      // Render order: Player(-5) -> Water(0) -> Leaves(2)
      // This ensures player shows through water, and leaves appear in front of water
      if (isWater) {
        mesh.renderOrder = 0;
      } else if (biome !== undefined) {
        // Instanced leaves - render after water
        mesh.renderOrder = 2;
      }
      
      group.add(mesh);
    }
  }

  /**
   * Get underground layer block types based on surface block
   * Returns [layer1Block, layer2Block] - layer3 is always bedrock
   * 
   * Uses flyweight BlockDefinition for centralized block properties
   */
  private getUndergroundLayersForBlock(surfaceBlock: BlockType): readonly [BlockType, BlockType] {
    return getUndergroundLayers(surfaceBlock);
  }

  /**
   * Create tree meshes for a chunk using instanced rendering for better performance
   * Leaves are batched with InstancedMesh (many leaves per tree)
   * Logs use individual meshes (fewer per tree, need multi-material for top/side textures)
   */
  private createTreeMeshes(
    group: THREE.Group,
    data: ChunkData,
    worldX: number,
    worldZ: number
  ): void {
    if (!data.trees || data.trees.length === 0) return;
    
    // Track placed block positions to prevent overlapping blocks from different trees
    const placedBlocks = new Set<string>();
    
    // Batch leaves by type and biome for instanced rendering
    // Key: `${leavesType}_${biome}`, Value: array of positions
    const leavesBatches: Map<string, THREE.Vector3[]> = new Map();
    
    // Collect log positions for individual mesh creation (need multi-material)
    const logPositions: { pos: THREE.Vector3; logType: BlockType }[] = [];
    
    for (const tree of data.trees) {
      const idx = tree.z * CHUNK_SIZE + tree.x;
      const groundHeight = data.heightMap[idx];
      const biome = data.biomeMap[idx];
      
      // Get block types for this tree
      const logType = TreeTypeToLogBlockType[tree.type];
      const leavesType = TreeTypeToLeavesBlockType[tree.type];
      
      // World position of tree base (trees sit ON TOP of ground block)
      const baseX = worldX + tree.x;
      const baseY = groundHeight + 1;
      const baseZ = worldZ + tree.z;
      
      // Special handling for cacti - create a single merged geometry (no internal faces = no Z-fighting seams)
      if (tree.blocks && tree.blocks.length > 0 && tree.blocks[0].type === 'cactus') {
        // Count cactus blocks to determine height
        const cactusHeight = tree.blocks.filter(b => b.type === 'cactus').length;
        if (cactusHeight > 0) {
          // Use material array with tiled side texture and separate top texture
          const cactusMaterials = this.textureManager.getCactusMaterials();
          const cactusGeo = createCactusGeometry(cactusHeight);
          const cactusMesh = new THREE.Mesh(cactusGeo, cactusMaterials);
          
          // Position at base (geometry is already translated so bottom is at y=0)
          cactusMesh.position.set(baseX, baseY, baseZ);
          
          group.add(cactusMesh);
          
          // Mark all cactus positions as placed
          for (let y = 0; y < cactusHeight; y++) {
            placedBlocks.add(`${baseX},${baseY + y},${baseZ}`);
          }
        }
        continue; // Skip normal block processing for cacti
      }
      
      // Collect blocks for batching (non-cactus trees)
      if (tree.blocks) {
        for (const block of tree.blocks) {
          const blockX = baseX + block.dx;
          const blockY = baseY + block.dy;
          const blockZ = baseZ + block.dz;
          
          // Create unique key for this position
          const posKey = `${blockX},${blockY},${blockZ}`;
          
          // Skip if block already placed at this position
          if (placedBlocks.has(posKey)) continue;
          placedBlocks.add(posKey);
          
          if (block.type === 'leaves') {
            // Batch leaves by type and biome
            const batchKey = `${leavesType}_${biome}`;
            if (!leavesBatches.has(batchKey)) {
              leavesBatches.set(batchKey, []);
            }
            leavesBatches.get(batchKey)!.push(new THREE.Vector3(blockX, blockY, blockZ));
          } else if (block.type === 'log') {
            // Collect logs for individual mesh creation
            logPositions.push({ pos: new THREE.Vector3(blockX, blockY, blockZ), logType });
          }
        }
      }
    }
    
    // Create individual meshes for leaves (needed for raycasting/breaking)
    // Tree blocks need to be interactable, so we use individual meshes
    let totalLeavesMeshes = 0;
    for (const [batchKey, positions] of leavesBatches) {
      if (positions.length === 0) continue;
      
      const [leavesTypeStr, biomeStr] = batchKey.split('_');
      const leavesType = parseInt(leavesTypeStr) as BlockType;
      const biome = parseInt(biomeStr);
      
      // Get leaves material with biome tinting
      const leavesMaterial = this.textureManager.getLeavesMaterial(leavesType, biome);
      
      for (const pos of positions) {
        const mesh = new THREE.Mesh(blockGeometry, leavesMaterial);
        mesh.position.set(pos.x, pos.y, pos.z);
        // Name the mesh for debugging
        mesh.name = `leaves_${pos.x}_${pos.y}_${pos.z}`;
        // Render leaves after water so they appear in front when closer to camera
        mesh.renderOrder = 2;
        // Ensure mesh is on default layer for raycasting
        mesh.layers.enableAll();
        group.add(mesh);
        totalLeavesMeshes++;
      }
    }
    
    
    // Create individual meshes for logs (needed for raycasting/breaking)
    const logsByType: Map<BlockType, THREE.Vector3[]> = new Map();
    for (const { pos, logType } of logPositions) {
      if (!logsByType.has(logType)) {
        logsByType.set(logType, []);
      }
      logsByType.get(logType)!.push(pos);
    }
    
    for (const [logType, positions] of logsByType) {
      if (positions.length === 0) continue;
      
      // Use multi-material for proper log appearance (bark on sides, rings on top)
      const logMaterials = this.textureManager.getLogMaterials(logType);
      
      for (const pos of positions) {
        const mesh = new THREE.Mesh(blockGeometry, logMaterials);
        mesh.position.set(pos.x, pos.y, pos.z);
        // Name the mesh for debugging
        mesh.name = `log_${pos.x}_${pos.y}_${pos.z}`;
        // Ensure mesh is on default layer for raycasting
        mesh.layers.enableAll();
        group.add(mesh);
      }
    }
    
    // Force matrix update on the group to ensure raycasting works properly
    group.updateMatrixWorld(true);
  }

  /**
   * Unload a chunk
   */
  private unloadChunk(key: string, group: THREE.Group): void {
    this.scene.remove(group);
    
    // Dispose of geometries and materials
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Don't dispose shared geometry/materials
      }
    });
    
    this.chunks.delete(key);
    this.chunkData.delete(key);
  }

  /**
   * Get height at world position (returns integer height)
   * Accounts for placed blocks, broken blocks (holes), and terrain
   */
  getHeightAt(x: number, z: number): number {
    // Floor the coordinates for array indexing
    const floorX = Math.floor(x);
    const floorZ = Math.floor(z);
    
    const chunkX = Math.floor(floorX / CHUNK_SIZE);
    const chunkZ = Math.floor(floorZ / CHUNK_SIZE);
    const key = `${chunkX},${chunkZ}`;
    
    // Get terrain height from heightmap
    let terrainHeight = 64; // Default
    const data = this.chunkData.get(key);
    if (data) {
      const lx = ((floorX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((floorZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const idx = lz * CHUNK_SIZE + lx;
      const height = data.heightMap[idx];
      if (height !== undefined && !isNaN(height)) {
        terrainHeight = Math.floor(height);
      }
    } else {
      // Fallback to generator
      const height = this.generator.getHeightAt(floorX, floorZ);
      terrainHeight = (height === undefined || isNaN(height)) ? 64 : Math.floor(height);
    }
    
    // Check for placed blocks at this x,z position
    const placedMap = this.placedBlocks.get(key);
    let highestPlaced = -Infinity;
    if (placedMap && placedMap.size > 0) {
      console.log(`[getHeightAt] Checking placedMap for chunk ${key}, size=${placedMap.size}`);
      for (const posKey of placedMap.keys()) {
        const [px, py, pz] = posKey.split(',').map(Number);
        console.log(`[getHeightAt] Placed block at ${posKey}: px=${px}, py=${py}, pz=${pz}, floorX=${floorX}, floorZ=${floorZ}`);
        if (px === floorX && pz === floorZ && py > highestPlaced) {
          highestPlaced = py;
          console.log(`[getHeightAt] Found matching placed block at y=${py}`);
        }
      }
    }
    
    // Start scanning from the maximum of terrain surface or highest placed block
    const startY = Math.max(terrainHeight, highestPlaced);
    const endY = terrainHeight - 3; // Bedrock layer (can't be broken)
    
    // Scan down from top to find the first solid block
    for (let y = startY; y >= endY; y--) {
      // Check if there's a placed block at this level
      if (placedMap && placedMap.has(`${floorX},${y},${floorZ}`)) {
        return y;
      }
      
      // Check if it's a terrain block (within terrain layers) that's not broken
      if (y <= terrainHeight && y >= terrainHeight - 3) {
        if (!this.isBlockBroken(floorX, y, floorZ)) {
          return y;
        }
      }
    }
    
    // All layers broken - return bedrock level minus 1 (player falls to void)
    // In practice, bedrock can't be broken, so this shouldn't happen
    return terrainHeight - 4;
  }

  /**
   * Get height at world position relative to player's current Y position.
   * This finds the ground level BELOW the player, not the highest block overall.
   * This prevents teleporting on top of arcs/overhangs when walking under them.
   * 
   * KEY: Only returns a height if there's HEADROOM (2 blocks of air) above it!
   * This prevents "stepping up" onto walls.
   */
  getHeightAtForPlayer(x: number, z: number, playerY: number): number {
    const floorX = Math.floor(x);
    const floorZ = Math.floor(z);
    
    const chunkX = Math.floor(floorX / CHUNK_SIZE);
    const chunkZ = Math.floor(floorZ / CHUNK_SIZE);
    const key = `${chunkX},${chunkZ}`;
    
    // Get base terrain height
    let terrainHeight = 64;
    const data = this.chunkData.get(key);
    if (data) {
      const lx = ((floorX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((floorZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const idx = lz * CHUNK_SIZE + lx;
      const height = data.heightMap[idx];
      if (height !== undefined && !isNaN(height)) {
        terrainHeight = Math.floor(height);
      }
    } else {
      const height = this.generator.getHeightAt(floorX, floorZ);
      terrainHeight = (height === undefined || isNaN(height)) ? 64 : Math.floor(height);
    }
    
    // Player position is feet level + 1, so feet are at playerY - 1
    // But after the +1 offset, playerY IS where feet are
    const playerFeetY = Math.floor(playerY - 1); // Block the player is standing ON
    
    // Can step up by 1 block (like Minecraft stairs)
    const maxStepUpY = playerFeetY + 1;
    const minY = terrainHeight - 10;
    
    // Scan from step-up level down to find valid ground
    for (let y = maxStepUpY; y >= minY; y--) {
      // Check if this block is solid (potential ground)
      if (this.isSolidBlockAt(floorX, y, floorZ)) {
        // CRITICAL: Check if there's HEADROOM above this block!
        // Player needs 2 blocks of air above ground to stand there
        const hasHeadroom = !this.isSolidBlockAt(floorX, y + 1, floorZ) && 
                           !this.isSolidBlockAt(floorX, y + 2, floorZ);
        
        if (hasHeadroom) {
          // Valid ground with headroom - player can stand here
          return y;
        }
        // No headroom - this is a wall, keep scanning down
      }
    }
    
    // No valid ground found - return very low (player will fall)
    return terrainHeight - 4;
  }
  
  /**
   * Check if there's a solid block at this exact position (for player-relative height)
   */
  private isSolidBlockAt(x: number, y: number, z: number): boolean {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    
    const chunkX = Math.floor(floorX / CHUNK_SIZE);
    const chunkZ = Math.floor(floorZ / CHUNK_SIZE);
    const key = `${chunkX},${chunkZ}`;
    
    // Check placed blocks first
    const placedMap = this.placedBlocks.get(key);
    if (placedMap && placedMap.has(`${floorX},${floorY},${floorZ}`)) {
      const blockType = placedMap.get(`${floorX},${floorY},${floorZ}`);
      if (blockType !== BlockType.Water && blockType !== BlockType.Air) {
        return true;
      }
    }
    
    // Check if it's broken
    if (this.isBlockBroken(floorX, floorY, floorZ)) {
      return false;
    }
    
    // Check terrain blocks
    const data = this.chunkData.get(key);
    if (data) {
      const lx = ((floorX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((floorZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const idx = lz * CHUNK_SIZE + lx;
      const terrainHeight = data.heightMap[idx];
      
      if (terrainHeight !== undefined && !isNaN(terrainHeight)) {
        const intTerrainHeight = Math.floor(terrainHeight);
        // Terrain occupies y levels from (intTerrainHeight - 3) to intTerrainHeight
        if (floorY <= intTerrainHeight && floorY >= intTerrainHeight - 3) {
          // Check the block type
          const blockType = this.getBlockAt(floorX, floorY, floorZ);
          // Note: getBlockAt returns null for air, so we just check for non-null and non-water
          if (blockType && blockType !== BlockType.Water) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Get the surface height for player movement (accounts for water)
   * In water, player floats at water surface level
   */
  getSurfaceHeightAt(x: number, z: number): number {
    const terrainHeight = this.getHeightAt(x, z);
    
    // Defensive check for invalid height
    if (terrainHeight === undefined || isNaN(terrainHeight)) {
      return 64; // Default sea level
    }
    
    const blockType = this.getBlockAt(Math.floor(x), terrainHeight, Math.floor(z));
    
    // If standing on water, player swims at water surface level
    if (blockType === BlockType.Water) {
      // Water surface is at terrain height + WATER_HEIGHT
      // Player should be positioned so feet are just below water surface
      return terrainHeight + WATER_HEIGHT - 0.5;
    }
    
    return terrainHeight;
  }

  /**
   * Get block type at position (terrain, tree blocks, and placed blocks)
   */
  getBlockAt(x: number, y: number, z: number): BlockType | null {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    
    const chunkX = Math.floor(floorX / CHUNK_SIZE);
    const chunkZ = Math.floor(floorZ / CHUNK_SIZE);
    const key = `${chunkX},${chunkZ}`;
    
    // First check placed blocks
    const placedBlock = this.getPlacedBlock(floorX, floorY, floorZ);
    if (placedBlock !== null) {
      return placedBlock;
    }
    
    // Check if block was broken
    if (this.isBlockBroken(floorX, floorY, floorZ)) {
      return BlockType.Air;
    }
    
    const data = this.chunkData.get(key);
    if (!data) return null;
    
    const lx = ((floorX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((floorZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = lz * CHUNK_SIZE + lx;
    
    const surfaceHeight = Math.floor(data.heightMap[idx]);
    
    // Check tree blocks (leaves, logs, cacti)
    if (data.trees) {
      const worldX = chunkX * CHUNK_SIZE;
      const worldZ = chunkZ * CHUNK_SIZE;
      
      for (const tree of data.trees) {
        const treeIdx = tree.z * CHUNK_SIZE + tree.x;
        const groundHeight = data.heightMap[treeIdx];
        const baseX = worldX + tree.x;
        const baseY = groundHeight + 1;
        const baseZ = worldZ + tree.z;
        
        if (tree.blocks) {
          for (const block of tree.blocks) {
            const blockX = baseX + block.dx;
            const blockY = baseY + block.dy;
            const blockZ = baseZ + block.dz;
            
            if (blockX === floorX && blockY === floorY && blockZ === floorZ) {
              // Found a tree block at this position
              if (block.type === 'leaves') {
                return TreeTypeToLeavesBlockType[tree.type];
              } else if (block.type === 'log') {
                return TreeTypeToLogBlockType[tree.type];
              } else if (block.type === 'cactus') {
                return BlockType.Cactus;
              }
            }
          }
        }
      }
    }
    
    // Check terrain block at surface level
    if (floorY === surfaceHeight) {
      return data.topBlock[idx];
    }
    
    // Check underground layers (3 layers below surface)
    const depthBelowSurface = surfaceHeight - floorY;
    if (depthBelowSurface >= 1 && depthBelowSurface <= 3) {
      const surfaceBlock = data.topBlock[idx];
      const undergroundLayers = this.getUndergroundLayersForBlock(surfaceBlock);
      
      if (depthBelowSurface === 1) {
        return undergroundLayers[0];
      } else if (depthBelowSurface === 2) {
        return undergroundLayers[1];
      } else if (depthBelowSurface === 3) {
        return BlockType.Bedrock;
      }
    }
    
    // Also check if player is AT or BELOW terrain height (they could be in/above water)
    // This helps with water detection when standing on water surface
    if (floorY <= surfaceHeight) {
      return data.topBlock[idx];
    }
    
    return null;
  }

  /**
   * Get chunk count
   */
  getChunkCount(): number {
    return this.chunks.size;
  }

  /**
   * Remove a block at world position
   * Returns the block type that was removed, or null if no block
   */
  removeBlock(x: number, y: number, z: number): BlockType | null {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    
    // Get the block type at this position
    const blockType = this.getBlockTypeAt(floorX, floorY, floorZ);
    if (blockType === null || blockType === BlockType.Air || blockType === BlockType.Water) {
      return null; // Can't remove air or water
    }
    
    // Get chunk coordinates
    const chunkX = Math.floor(floorX / CHUNK_SIZE);
    const chunkZ = Math.floor(floorZ / CHUNK_SIZE);
    const chunkKey = `${chunkX},${chunkZ}`;
    const posKey = `${floorX},${floorY},${floorZ}`;
    
    // Check if this is a placed block - if so, remove from placedBlocks
    const placedMap = this.placedBlocks.get(chunkKey);
    if (placedMap && placedMap.has(posKey)) {
      placedMap.delete(posKey);
      // Don't add to brokenBlocks since it was player-placed, not terrain
    } else {
      // Track this terrain/tree block as broken
      if (!this.brokenBlocks.has(chunkKey)) {
        this.brokenBlocks.set(chunkKey, new Set());
      }
      this.brokenBlocks.get(chunkKey)!.add(posKey);
    }
    
    // Get chunk data
    const data = this.chunkData.get(chunkKey);
    if (!data) return null;
    
    // Calculate local coordinates
    const lx = ((floorX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((floorZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = lz * CHUNK_SIZE + lx;
    
    // Check if it's the terrain surface block
    const terrainHeight = data.heightMap[idx];
    if (floorY === Math.floor(terrainHeight)) {
      // Set terrain to air
      data.topBlock[idx] = BlockType.Air;
    }
    
    // Remove from trees if it's a tree block
    if (data.trees) {
      for (const tree of data.trees) {
        if (!tree.blocks) continue;
        
        const treeBaseX = chunkX * CHUNK_SIZE + tree.x;
        const treeBaseZ = chunkZ * CHUNK_SIZE + tree.z;
        const treeIdx = tree.z * CHUNK_SIZE + tree.x;
        const treeBaseY = Math.floor(data.heightMap[treeIdx]) + 1;
        
        // Find and remove matching block
        for (let i = tree.blocks.length - 1; i >= 0; i--) {
          const block = tree.blocks[i];
          const blockX = treeBaseX + block.dx;
          const blockY = treeBaseY + block.dy;
          const blockZ = treeBaseZ + block.dz;
          
          if (blockX === floorX && blockY === floorY && blockZ === floorZ) {
            tree.blocks.splice(i, 1);
            break;
          }
        }
      }
    }
    
    // Rebuild chunk mesh
    this.rebuildChunk(chunkX, chunkZ);
    
    // Check if any gravity-affected blocks above should now fall
    // This triggers sand/gravel to fall when blocks below them are removed
    this.fallingBlockManager.checkBlocksAbove(floorX, floorY, floorZ);
    
    return blockType;
  }
  
  /**
   * Rebuild a chunk's mesh (after block modification)
   */
  private rebuildChunk(chunkX: number, chunkZ: number): void {
    const key = `${chunkX},${chunkZ}`;
    const data = this.chunkData.get(key);
    const oldGroup = this.chunks.get(key);
    
    if (!data || !oldGroup) return;
    
    // Remove old chunk from scene
    this.scene.remove(oldGroup);
    oldGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Don't dispose shared geometries
      }
    });
    
    // Create new chunk group (contains both terrain and trees)
    const group = new THREE.Group();
    group.name = `chunk_${key}`;
    
    // World position offset
    const worldX = chunkX * CHUNK_SIZE;
    const worldZ = chunkZ * CHUNK_SIZE;
    
    // Create terrain mesh
    this.createTerrainMesh(group, data, worldX, worldZ);
    
    // Create tree meshes in same group (needed for raycasting)
    this.createTreeMeshes(group, data, worldX, worldZ);
    
    // Add to scene
    this.scene.add(group);
    this.chunks.set(key, group);
  }
  
  /**
   * Check if a specific position has been marked as broken
   */
  isBlockBroken(x: number, y: number, z: number): boolean {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const chunkKey = `${chunkX},${chunkZ}`;
    
    const brokenSet = this.brokenBlocks.get(chunkKey);
    if (!brokenSet) return false;
    
    return brokenSet.has(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`);
  }

  /**
   * Internal method to remove a block without triggering falling block checks
   * Used by the falling block system when a block starts falling
   */
  private removeBlockInternal(x: number, y: number, z: number): BlockType | null {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    
    // Get the block type at this position
    const blockType = this.getBlockTypeAt(floorX, floorY, floorZ);
    if (blockType === null || blockType === BlockType.Air || blockType === BlockType.Water) {
      return null;
    }
    
    // Get chunk coordinates
    const chunkX = Math.floor(floorX / CHUNK_SIZE);
    const chunkZ = Math.floor(floorZ / CHUNK_SIZE);
    const chunkKey = `${chunkX},${chunkZ}`;
    const posKey = `${floorX},${floorY},${floorZ}`;
    
    // Check if this is a placed block - if so, remove from placedBlocks
    const placedMap = this.placedBlocks.get(chunkKey);
    if (placedMap && placedMap.has(posKey)) {
      placedMap.delete(posKey);
    } else {
      // Track this terrain block as broken
      if (!this.brokenBlocks.has(chunkKey)) {
        this.brokenBlocks.set(chunkKey, new Set());
      }
      this.brokenBlocks.get(chunkKey)!.add(posKey);
    }
    
    // Get chunk data
    const data = this.chunkData.get(chunkKey);
    if (data) {
      // Calculate local coordinates
      const lx = ((floorX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((floorZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const idx = lz * CHUNK_SIZE + lx;
      
      // Check if it's the terrain surface block
      const terrainHeight = data.heightMap[idx];
      if (floorY === Math.floor(terrainHeight)) {
        data.topBlock[idx] = BlockType.Air;
      }
    }
    
    // Rebuild chunk mesh
    this.rebuildChunk(chunkX, chunkZ);
    
    return blockType;
  }
  
  /**
   * Internal method to place a block without triggering falling block checks
   * Used by the falling block system to place landed blocks
   */
  private placeBlockInternal(x: number, y: number, z: number, blockType: BlockType): boolean {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    
    // Can't place air or water
    if (blockType === BlockType.Air || blockType === BlockType.Water) {
      return false;
    }
    
    // Check if position already has a block
    const existingBlock = this.getBlockTypeAt(floorX, floorY, floorZ);
    if (existingBlock !== null && existingBlock !== BlockType.Air) {
      return false; // Position already occupied
    }
    
    // Get chunk coordinates
    const chunkX = Math.floor(floorX / CHUNK_SIZE);
    const chunkZ = Math.floor(floorZ / CHUNK_SIZE);
    const chunkKey = `${chunkX},${chunkZ}`;
    
    // Initialize placed blocks map for this chunk if needed
    if (!this.placedBlocks.has(chunkKey)) {
      this.placedBlocks.set(chunkKey, new Map());
    }
    
    // Add block to placed blocks
    const posKey = `${floorX},${floorY},${floorZ}`;
    this.placedBlocks.get(chunkKey)!.set(posKey, blockType);
    
    // If this position was previously marked as broken, remove that mark
    const brokenSet = this.brokenBlocks.get(chunkKey);
    if (brokenSet) {
      brokenSet.delete(posKey);
    }
    
    // Note: We don't rebuild the chunk here - the falling block manager will handle that
    
    return true;
  }
  
  /**
   * Place a block at world position
   * Returns true if block was placed successfully
   * If placing sand/gravel with no support, the block will start falling
   */
  placeBlock(x: number, y: number, z: number, blockType: BlockType): boolean {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    
    // Can't place air or water
    if (blockType === BlockType.Air || blockType === BlockType.Water) {
      return false;
    }
    
    // Check if position already has a block
    const existingBlock = this.getBlockTypeAt(floorX, floorY, floorZ);
    if (existingBlock !== null && existingBlock !== BlockType.Air) {
      return false; // Position already occupied
    }
    
    // Check if this is a gravity-affected block with no support
    if (isBlockGravityAffected(blockType)) {
      const belowY = floorY - 1;
      const belowSolid = this.isSolidAt(floorX, belowY, floorZ);
      
      if (!belowSolid) {
        // No support below - spawn falling block instead of placing
        this.fallingBlockManager.spawnFallingBlock(floorX, floorY, floorZ, blockType);
        return true; // Block was "placed" (but it's now falling)
      }
    }
    
    // Get chunk coordinates
    const chunkX = Math.floor(floorX / CHUNK_SIZE);
    const chunkZ = Math.floor(floorZ / CHUNK_SIZE);
    const chunkKey = `${chunkX},${chunkZ}`;
    
    // Initialize placed blocks map for this chunk if needed
    if (!this.placedBlocks.has(chunkKey)) {
      this.placedBlocks.set(chunkKey, new Map());
    }
    
    // Add block to placed blocks
    const posKey = `${floorX},${floorY},${floorZ}`;
    this.placedBlocks.get(chunkKey)!.set(posKey, blockType);
    
    // If this position was previously marked as broken, remove that mark
    const brokenSet = this.brokenBlocks.get(chunkKey);
    if (brokenSet) {
      brokenSet.delete(posKey);
    }
    
    // Rebuild chunk mesh
    this.rebuildChunk(chunkX, chunkZ);
    
    return true;
  }
  
  /**
   * Get placed block at position (if any)
   */
  getPlacedBlock(x: number, y: number, z: number): BlockType | null {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const chunkKey = `${chunkX},${chunkZ}`;
    
    const placedMap = this.placedBlocks.get(chunkKey);
    if (!placedMap) return null;
    
    const posKey = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    return placedMap.get(posKey) || null;
  }

  /**
   * Create a door mesh with proper textures (bottom and top halves) and rotation based on state
   */
  private createDoorMesh(blockType: BlockType, x: number, y: number, z: number): THREE.Group {
    const doorGroup = new THREE.Group();
    const posKey = `${x},${y},${z}`;
    
    // Get or create door state
    let doorState = this.doorStates.get(posKey);
    if (!doorState) {
      doorState = { open: false, facing: 0 }; // Default: closed, facing south
      this.doorStates.set(posKey, doorState);
    }
    
    // Get door textures
    const textures = DOOR_TEXTURES[blockType];
    if (!textures) {
      // Fallback to a simple material with single panel
      const material = this.textureManager.getSaplingMaterial(blockType);
      const mesh = new THREE.Mesh(doorPanelGeometry.clone(), material);
      doorGroup.add(mesh);
      doorGroup.position.set(x, y, z);
      return doorGroup;
    }
    
    // Create or get materials for bottom and top halves
    const bottomMaterialKey = `door_bottom_${blockType}`;
    const topMaterialKey = `door_top_${blockType}`;
    
    let bottomMaterial = this.doorMaterials.get(bottomMaterialKey);
    let topMaterial = this.doorMaterials.get(topMaterialKey);
    
    const loader = new THREE.TextureLoader();
    
    if (!bottomMaterial) {
      const bottomTexture = loader.load(textures.bottom);
      bottomTexture.magFilter = THREE.NearestFilter;
      bottomTexture.minFilter = THREE.NearestFilter;
      bottomTexture.colorSpace = THREE.SRGBColorSpace;
      
      bottomMaterial = new THREE.MeshLambertMaterial({
        map: bottomTexture,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.5,
      });
      this.doorMaterials.set(bottomMaterialKey, bottomMaterial);
    }
    
    if (!topMaterial) {
      const topTexture = loader.load(textures.top);
      topTexture.magFilter = THREE.NearestFilter;
      topTexture.minFilter = THREE.NearestFilter;
      topTexture.colorSpace = THREE.SRGBColorSpace;
      
      topMaterial = new THREE.MeshLambertMaterial({
        map: topTexture,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.5,
      });
      this.doorMaterials.set(topMaterialKey, topMaterial);
    }
    
    // Create a container for the door panels that will be rotated
    const doorPivot = new THREE.Group();
    
    // Create bottom panel (at y=0)
    const bottomMesh = new THREE.Mesh(doorPanelGeometry.clone(), bottomMaterial);
    bottomMesh.position.set(0, 0, 0);
    doorPivot.add(bottomMesh);
    
    // Create top panel (at y=1)
    const topMesh = new THREE.Mesh(doorPanelGeometry.clone(), topMaterial);
    topMesh.position.set(0, 1, 0);
    doorPivot.add(topMesh);
    
    // Apply rotation based on facing direction
    // facing: 0=south (+Z), 1=west (-X), 2=north (-Z), 3=east (+X)
    const baseRotation = (doorState.facing * Math.PI) / 2;
    
    // If door is open, rotate 90 degrees on Y axis around the hinge (left edge)
    if (doorState.open) {
      // Move pivot to hinge position, rotate, then move back
      doorPivot.position.set(-0.5, 0, 0.5 - DOOR_THICKNESS / 2);
      doorPivot.rotation.y = baseRotation - Math.PI / 2;
      // Offset to account for pivot position
      doorPivot.position.x += 0.5 * Math.cos(baseRotation - Math.PI / 2) + 0.5 * Math.cos(baseRotation);
      doorPivot.position.z += 0.5 * Math.sin(baseRotation - Math.PI / 2) + 0.5 * Math.sin(baseRotation) + (0.5 - DOOR_THICKNESS / 2);
    } else {
      doorPivot.rotation.y = baseRotation;
    }
    
    doorGroup.add(doorPivot);
    doorGroup.position.set(x, y, z);
    
    // Store reference for interaction
    doorGroup.userData = {
      isDoor: true,
      blockType,
      posKey,
    };
    
    return doorGroup;
  }
  
  /**
   * Toggle a door's open/closed state
   * Returns true if the door was toggled successfully
   */
  toggleDoor(x: number, y: number, z: number): boolean {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    
    // Check if there's a door at this position
    const blockType = this.getBlockTypeAt(floorX, floorY, floorZ);
    
    if (!blockType || !isDoorBlock(blockType)) {
      // Check if clicking on the top half of a door (door below)
      const belowType = this.getBlockTypeAt(floorX, floorY - 1, floorZ);
      if (belowType && isDoorBlock(belowType)) {
        // Toggle the door below
        return this.toggleDoor(floorX, floorY - 1, floorZ);
      }
      return false;
    }
    
    const posKey = `${floorX},${floorY},${floorZ}`;
    
    // Get or create door state
    let doorState = this.doorStates.get(posKey);
    if (!doorState) {
      doorState = { open: false, facing: 0 };
    }
    
    // Toggle open state
    doorState.open = !doorState.open;
    this.doorStates.set(posKey, doorState);
    
    console.log(`🚪 Door at (${floorX}, ${floorY}, ${floorZ}) is now ${doorState.open ? 'OPEN' : 'CLOSED'}`);
    
    // Rebuild the chunk to update door rendering
    const chunkX = Math.floor(floorX / CHUNK_SIZE);
    const chunkZ = Math.floor(floorZ / CHUNK_SIZE);
    this.rebuildChunk(chunkX, chunkZ);
    
    return true;
  }
  
  /**
   * Check if a door at position is open
   */
  isDoorOpen(x: number, y: number, z: number): boolean {
    const posKey = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    const doorState = this.doorStates.get(posKey);
    return doorState?.open ?? false;
  }

  /**
   * Get block type at position (including checking for trees and placed blocks)
   */
  getBlockTypeAt(x: number, y: number, z: number): BlockType | null {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const key = `${chunkX},${chunkZ}`;
    
    // First check if there's a placed block at this position
    const placedBlock = this.getPlacedBlock(x, y, z);
    if (placedBlock !== null) {
      return placedBlock;
    }
    
    // Check if this position was broken
    if (this.isBlockBroken(x, y, z)) {
      return null;
    }
    
    const data = this.chunkData.get(key);
    if (!data) return null;
    
    const lx = ((Math.floor(x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((Math.floor(z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = lz * CHUNK_SIZE + lx;
    
    const surfaceHeight = Math.floor(data.heightMap[idx]);
    const floorY = Math.floor(y);
    
    // Check if it's the surface block
    if (floorY === surfaceHeight) {
      return data.topBlock[idx];
    }
    
    // Check underground layers (3 layers below surface)
    const depthBelowSurface = surfaceHeight - floorY;
    if (depthBelowSurface >= 1 && depthBelowSurface <= 3) {
      const surfaceBlock = data.topBlock[idx];
      const undergroundLayers = this.getUndergroundLayersForBlock(surfaceBlock);
      
      if (depthBelowSurface === 1) {
        return undergroundLayers[0]; // First underground layer
      } else if (depthBelowSurface === 2) {
        return undergroundLayers[1]; // Second underground layer
      } else if (depthBelowSurface === 3) {
        return BlockType.Bedrock; // Bottom layer is always bedrock
      }
    }
    
    // Check for tree blocks at this position
    if (data.trees) {
      for (const tree of data.trees) {
        if (tree.blocks) {
          const treeBaseX = chunkX * CHUNK_SIZE + tree.x;
          const treeBaseZ = chunkZ * CHUNK_SIZE + tree.z;
          // Trees sit ON TOP of ground block, so +1
          const treeBaseY = data.heightMap[tree.z * CHUNK_SIZE + tree.x] + 1;
          
          for (const block of tree.blocks) {
            const blockX = treeBaseX + block.dx;
            const blockY = treeBaseY + block.dy;
            const blockZ = treeBaseZ + block.dz;
            
            if (Math.floor(x) === blockX && Math.floor(y) === blockY && Math.floor(z) === blockZ) {
              // Return appropriate block type
              if (block.type === 'log') return TreeTypeToLogBlockType[tree.type];
              if (block.type === 'leaves') return TreeTypeToLeavesBlockType[tree.type];
              if (block.type === 'cactus') return BlockType.Cactus;
            }
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Check if a block at position is solid (for collision)
   * Uses flyweight BlockDefinition for centralized block properties
   */
  isSolidAt(x: number, y: number, z: number): boolean {
    const blockType = this.getBlockTypeAt(x, y, z);
    if (blockType === null) return false;
    
    // Get block definition from flyweight store
    const blockDef = getBlockDef(blockType);
    
    // Use centralized isSolid property (handles air, water, leaves, saplings, trapdoors)
    if (!blockDef.isSolid) {
      return false;
    }
    
    // Doors are a special case - solid when closed, passable when open
    if (blockDef.isDoor) {
      const floorX = Math.floor(x);
      const floorY = Math.floor(y);
      const floorZ = Math.floor(z);
      
      // Check if this door or the door below (for 2-block tall doors) is open
      const posKey = `${floorX},${floorY},${floorZ}`;
      const belowKey = `${floorX},${floorY - 1},${floorZ}`;
      
      const doorState = this.doorStates.get(posKey) || this.doorStates.get(belowKey);
      if (doorState?.open) {
        return false; // Open doors are not solid
      }
    }
    
    return true;
  }

  /**
   * Check collision for player movement
   * Returns true if the position is blocked
   */
  checkCollision(x: number, y: number, z: number, playerWidth: number = 0.6, _playerHeight: number = 1.8): boolean {
    // Check multiple points around the player's hitbox
    const halfWidth = playerWidth / 2;
    
    // Check corners of the player's hitbox at foot level and body level
    const checkPoints = [
      // Foot level (y)
      { x: x - halfWidth, y: y, z: z - halfWidth },
      { x: x + halfWidth, y: y, z: z - halfWidth },
      { x: x - halfWidth, y: y, z: z + halfWidth },
      { x: x + halfWidth, y: y, z: z + halfWidth },
      // Body level (y + 1)
      { x: x - halfWidth, y: y + 1, z: z - halfWidth },
      { x: x + halfWidth, y: y + 1, z: z - halfWidth },
      { x: x - halfWidth, y: y + 1, z: z + halfWidth },
      { x: x + halfWidth, y: y + 1, z: z + halfWidth },
    ];
    
    for (const point of checkPoints) {
      if (this.isSolidAt(Math.floor(point.x), Math.floor(point.y), Math.floor(point.z))) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if player's head would collide with a ceiling when jumping
   * Returns true if there's a solid block at head level
   */
  checkHeadCollision(x: number, y: number, z: number, playerWidth: number = 0.6, playerHeight: number = 1.8): boolean {
    const halfWidth = playerWidth / 2;
    const headY = y + playerHeight;
    
    // Check corners at head level
    const checkPoints = [
      { x: x - halfWidth, z: z - halfWidth },
      { x: x + halfWidth, z: z - halfWidth },
      { x: x - halfWidth, z: z + halfWidth },
      { x: x + halfWidth, z: z + halfWidth },
    ];
    
    for (const point of checkPoints) {
      if (this.isSolidAt(Math.floor(point.x), Math.floor(headY), Math.floor(point.z))) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if player can stand at a position
   * Returns true if ANY corner of their hitbox is over solid ground at or near the expected height
   * This is used to determine if the player should start falling
   * Uses getHeightAtForPlayer to avoid detecting arcs/overhangs above the player
   */
  canStandAt(x: number, y: number, z: number, playerWidth: number = 0.6): boolean {
    const halfWidth = playerWidth / 2;
    
    // Check corners of the player's hitbox
    const corners = [
      { x: x - halfWidth, z: z - halfWidth },
      { x: x + halfWidth, z: z - halfWidth },
      { x: x - halfWidth, z: z + halfWidth },
      { x: x + halfWidth, z: z + halfWidth },
    ];
    
    // If ANY corner is over ground at the player's current level, they can stand
    for (const corner of corners) {
      // Use player-relative height to find ground BELOW the player, not arcs above
      const groundHeight = this.getHeightAtForPlayer(corner.x, corner.z, y);
      // Player stands at groundHeight + 1, so check if they're at or slightly above that level
      const standingLevel = groundHeight + 1;
      
      // Player can stand if they're at the standing level (within tolerance)
      // OR slightly above it (small hops, floating point drift)
      // But NOT if they're significantly below (falling into a hole)
      const heightDiff = y - standingLevel;
      if (heightDiff >= -0.1 && heightDiff <= 0.5) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get the expected Y position for the player at a location
   * Checks all corners of the player's hitbox and returns the highest valid standing position
   * Uses getHeightAtForPlayer to avoid detecting arcs/overhangs above the player
   */
  getStandingHeightAt(x: number, z: number, playerY: number, playerWidth: number = 0.6): number {
    const halfWidth = playerWidth / 2;
    
    // Check corners of the player's hitbox
    const corners = [
      { x: x - halfWidth, z: z - halfWidth },
      { x: x + halfWidth, z: z - halfWidth },
      { x: x - halfWidth, z: z + halfWidth },
      { x: x + halfWidth, z: z + halfWidth },
    ];
    
    // Find the highest ground level among all corners (relative to player position)
    let maxGroundHeight = -Infinity;
    for (const corner of corners) {
      // Use player-relative height to find ground BELOW the player, not arcs above
      const groundHeight = this.getHeightAtForPlayer(corner.x, corner.z, playerY);
      if (groundHeight > maxGroundHeight) {
        maxGroundHeight = groundHeight;
      }
    }
    
    return maxGroundHeight + 1; // Player stands on top of ground
  }

  /**
   * Clean up
   */
  destroy(): void {
    for (const [key, group] of this.chunks) {
      this.unloadChunk(key, group);
    }
    
    // Clean up falling block manager
    this.fallingBlockManager.destroy();
  }
}


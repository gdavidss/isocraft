/**
 * FallingBlock System
 * Handles gravity-affected blocks like Sand and Gravel
 * 
 * Behavior mirrors Minecraft:
 * - Sand and gravel fall when placed with no solid block below
 * - Sand and gravel fall when the block below them is removed
 * - Falling blocks push players out of the way to prevent suffocation
 * - Blocks fall smoothly as entities, then become solid blocks when landing
 */

import * as THREE from 'three';
import { BlockType } from '../world/types';
import { getSoundManager } from './SoundManager';
import { isBlockGravityAffected } from '../world/BlockDefinition';

// Physics constants (matching Minecraft falling blocks)
const GRAVITY = 20; // Blocks per second squared (Minecraft uses ~20 m/s²)
const TERMINAL_VELOCITY = 40; // Maximum fall speed
const BLOCK_SIZE = 1; // 1 unit = 1 block

/**
 * Check if a block type is affected by gravity
 * Uses flyweight BlockDefinition for centralized block properties
 */
export function isGravityAffected(blockType: BlockType): boolean {
  return isBlockGravityAffected(blockType);
}

/**
 * Represents a single falling block entity
 */
export interface FallingBlockEntity {
  id: number;
  blockType: BlockType;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: number; // Vertical velocity (negative = falling)
  startY: number; // Where the block started falling from
  sourceX: number; // Original block X position (integer)
  sourceZ: number; // Original block Z position (integer)
}

/**
 * Callback type for when a falling block needs to be placed
 */
export type PlaceBlockCallback = (x: number, y: number, z: number, blockType: BlockType) => boolean;

/**
 * Callback type for when a block starts falling (needs to be removed from world)
 */
export type RemoveBlockCallback = (x: number, y: number, z: number) => BlockType | null;

/**
 * Callback type for getting terrain height at a position
 */
export type GetHeightCallback = (x: number, z: number) => number;

/**
 * Callback type for checking if a position is solid
 */
export type IsSolidCallback = (x: number, y: number, z: number) => boolean;

/**
 * Callback type for getting block type at a position
 */
export type GetBlockCallback = (x: number, y: number, z: number) => BlockType | null;

/**
 * Manages all falling block entities in the world
 */
export class FallingBlockManager {
  private scene: THREE.Scene;
  private fallingBlocks: Map<number, FallingBlockEntity> = new Map();
  private nextId = 0;
  
  // Block textures (obtained from texture manager)
  private blockMaterials: Map<BlockType, THREE.Material> = new Map();
  private blockGeometry: THREE.BoxGeometry;
  
  // Callbacks for world interaction
  private placeBlock: PlaceBlockCallback;
  private removeBlock: RemoveBlockCallback;
  private getHeight: GetHeightCallback;
  private isSolid: IsSolidCallback;
  private getBlock: GetBlockCallback;
  
  // Player reference for collision
  private playerPosition: THREE.Vector3 | null = null;
  private playerWidth = 0.6;
  
  // Queue for blocks that need to be checked for falling after landing
  private pendingFallChecks: Array<{ x: number; y: number; z: number }> = [];

  constructor(
    scene: THREE.Scene,
    placeBlock: PlaceBlockCallback,
    removeBlock: RemoveBlockCallback,
    getHeight: GetHeightCallback,
    isSolid: IsSolidCallback,
    getBlock: GetBlockCallback
  ) {
    this.scene = scene;
    this.placeBlock = placeBlock;
    this.removeBlock = removeBlock;
    this.getHeight = getHeight;
    this.isSolid = isSolid;
    this.getBlock = getBlock;
    
    // Create reusable block geometry
    this.blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  }
  
  /**
   * Set block materials from texture manager
   */
  setBlockMaterials(materials: Map<BlockType, THREE.Material>): void {
    this.blockMaterials = materials;
  }
  
  /**
   * Update player position reference for collision detection
   */
  setPlayerPosition(position: THREE.Vector3): void {
    this.playerPosition = position;
  }
  
  /**
   * Create a falling block entity at the given position
   */
  spawnFallingBlock(x: number, y: number, z: number, blockType: BlockType): void {
    // Get or create material for this block type
    let material = this.blockMaterials.get(blockType);
    if (!material) {
      // Fallback material based on block type
      const color = blockType === BlockType.Sand ? 0xC2B280 : 
                    blockType === BlockType.RedSand ? 0xBE6B3A :
                    blockType === BlockType.Gravel ? 0x888888 : 0x888888;
      material = new THREE.MeshLambertMaterial({ color });
    }
    
    // Create mesh for the falling block
    const mesh = new THREE.Mesh(this.blockGeometry, material);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    
    // Create entity
    const entity: FallingBlockEntity = {
      id: this.nextId++,
      blockType,
      mesh,
      position: new THREE.Vector3(x, y, z),
      velocity: 0,
      startY: y,
      sourceX: Math.floor(x),
      sourceZ: Math.floor(z),
    };
    
    this.fallingBlocks.set(entity.id, entity);
    
    console.log(`🪨 Spawned falling ${BlockType[blockType]} at (${x}, ${y}, ${z})`);
  }
  
  /**
   * Check if a sand/gravel block at the given position should start falling
   * Returns true if the block was triggered to fall
   */
  checkAndTriggerFall(x: number, y: number, z: number, blockType?: BlockType): boolean {
    // Get block type if not provided
    if (blockType === undefined) {
      blockType = this.getBlock(x, y, z) ?? undefined;
    }
    
    // Not a gravity-affected block
    if (blockType === undefined || !isGravityAffected(blockType)) {
      return false;
    }
    
    // Check if there's solid ground below
    const belowY = y - 1;
    const belowSolid = this.isSolid(x, belowY, z);
    
    // Also check if there's another falling block at this position
    const hasFallingBlockHere = Array.from(this.fallingBlocks.values()).some(
      fb => Math.floor(fb.position.x) === x && 
            Math.floor(fb.position.z) === z &&
            Math.abs(fb.position.y - y) < 0.5
    );
    
    if (hasFallingBlockHere) {
      return false; // Already falling
    }
    
    if (!belowSolid) {
      // Block should fall!
      // First, remove the block from the world (it's now a falling entity)
      this.removeBlock(x, y, z);
      
      // Spawn the falling block entity
      this.spawnFallingBlock(x, y, z, blockType);
      return true;
    }
    
    return false;
  }
  
  /**
   * Check all blocks above a position that might need to fall
   * Called when a block is removed
   */
  checkBlocksAbove(x: number, y: number, z: number): void {
    // Check the block directly above
    const aboveY = y + 1;
    const aboveBlock = this.getBlock(x, aboveY, z);
    
    if (aboveBlock !== null && isGravityAffected(aboveBlock)) {
      this.checkAndTriggerFall(x, aboveY, z, aboveBlock);
    }
  }
  
  /**
   * Update all falling blocks (called each frame)
   * Returns positions where blocks landed (for triggering cascading falls)
   */
  update(deltaTime: number): Array<{ x: number; y: number; z: number; blockType: BlockType }> {
    const landedBlocks: Array<{ x: number; y: number; z: number; blockType: BlockType }> = [];
    const toRemove: number[] = [];
    
    for (const [id, entity] of this.fallingBlocks) {
      // Apply gravity
      entity.velocity -= GRAVITY * deltaTime;
      
      // Clamp to terminal velocity
      entity.velocity = Math.max(entity.velocity, -TERMINAL_VELOCITY);
      
      // Update position
      const newY = entity.position.y + entity.velocity * deltaTime;
      
      // Calculate landing position (where we'll place the block)
      const landX = Math.floor(entity.position.x);
      const landZ = Math.floor(entity.position.z);
      
      // Check for landing
      // A block lands when:
      // 1. It reaches a solid block below
      // 2. It reaches the terrain surface
      let landingY = this.findLandingY(landX, landZ, entity.position.y);
      
      if (newY <= landingY) {
        // Block has landed
        const finalY = Math.floor(landingY);
        
        // Push player if in the landing zone
        this.pushPlayerAway(landX, finalY, landZ);
        
        // Place the block in the world
        const placed = this.placeBlock(landX, finalY, landZ, entity.blockType);
        
        if (placed) {
          console.log(`🪨 ${BlockType[entity.blockType]} landed at (${landX}, ${finalY}, ${landZ})`);
          landedBlocks.push({ x: landX, y: finalY, z: landZ, blockType: entity.blockType });
          
          // Play block landing sound
          getSoundManager().playBlockPlace(entity.blockType);
          
          // Queue check for blocks above the landing position
          this.pendingFallChecks.push({ x: landX, y: finalY + 1, z: landZ });
        } else {
          // Couldn't place block (maybe player is there) - try one block higher
          const placed2 = this.placeBlock(landX, finalY + 1, landZ, entity.blockType);
          if (placed2) {
            console.log(`🪨 ${BlockType[entity.blockType]} landed at elevated position (${landX}, ${finalY + 1}, ${landZ})`);
            landedBlocks.push({ x: landX, y: finalY + 1, z: landZ, blockType: entity.blockType });
            
            // Play block landing sound
            getSoundManager().playBlockPlace(entity.blockType);
          } else {
            console.log(`⚠️ ${BlockType[entity.blockType]} couldn't land at (${landX}, ${finalY}, ${landZ})`);
          }
        }
        
        // Remove mesh from scene
        this.scene.remove(entity.mesh);
        entity.mesh.geometry.dispose();
        
        // Mark for removal
        toRemove.push(id);
      } else {
        // Still falling - update position
        entity.position.y = newY;
        entity.mesh.position.y = newY;
        
        // Slight rotation while falling for visual effect
        entity.mesh.rotation.x += deltaTime * 0.5;
        entity.mesh.rotation.z += deltaTime * 0.3;
      }
    }
    
    // Remove landed blocks from tracking
    for (const id of toRemove) {
      this.fallingBlocks.delete(id);
    }
    
    // Process pending fall checks (cascading)
    while (this.pendingFallChecks.length > 0) {
      const check = this.pendingFallChecks.shift()!;
      const blockAbove = this.getBlock(check.x, check.y, check.z);
      if (blockAbove !== null && isGravityAffected(blockAbove)) {
        // Need to check with a small delay to allow world state to update
        // We'll trigger this check next frame
        this.checkAndTriggerFall(check.x, check.y, check.z, blockAbove);
      }
    }
    
    return landedBlocks;
  }
  
  /**
   * Find the Y position where a falling block should land
   */
  private findLandingY(x: number, z: number, currentY: number): number {
    // Start checking from current position downward
    let checkY = Math.floor(currentY);
    
    // Scan down to find the first solid block
    while (checkY > 0) {
      const belowY = checkY - 1;
      
      // Check if there's a solid block below
      if (this.isSolid(x, belowY, z)) {
        // Land on top of this solid block
        return checkY;
      }
      
      // Also check if there's another falling block that would be in the way
      const hasFallingBlockBelow = Array.from(this.fallingBlocks.values()).some(
        fb => Math.floor(fb.position.x) === x && 
              Math.floor(fb.position.z) === z &&
              fb.position.y < currentY &&
              fb.position.y >= belowY
      );
      
      if (hasFallingBlockBelow) {
        return checkY;
      }
      
      checkY--;
    }
    
    // Fallback to terrain height + 1 (standing on terrain)
    const terrainHeight = this.getHeight(x, z);
    return terrainHeight + 1;
  }
  
  /**
   * Push player away if they're in the landing zone
   * Prevents suffocation by moving player to nearest safe position
   */
  private pushPlayerAway(blockX: number, blockY: number, blockZ: number): void {
    if (!this.playerPosition) return;
    
    const playerX = this.playerPosition.x;
    const playerY = this.playerPosition.y;
    const playerZ = this.playerPosition.z;
    const halfWidth = this.playerWidth / 2;
    const playerHeight = 1.8;
    
    // Block bounding box
    const blockMinX = blockX;
    const blockMaxX = blockX + 1;
    const blockMinY = blockY;
    const blockMaxY = blockY + 1;
    const blockMinZ = blockZ;
    const blockMaxZ = blockZ + 1;
    
    // Player bounding box
    const playerMinX = playerX - halfWidth;
    const playerMaxX = playerX + halfWidth;
    const playerMinY = playerY;
    const playerMaxY = playerY + playerHeight;
    const playerMinZ = playerZ - halfWidth;
    const playerMaxZ = playerZ + halfWidth;
    
    // Check if player overlaps with block
    const overlapsX = blockMaxX > playerMinX && blockMinX < playerMaxX;
    const overlapsY = blockMaxY > playerMinY && blockMinY < playerMaxY;
    const overlapsZ = blockMaxZ > playerMinZ && blockMinZ < playerMaxZ;
    
    if (overlapsX && overlapsY && overlapsZ) {
      // Player is in the block landing zone - push them out
      // Find the shortest push direction
      
      const pushDistances = [
        { axis: 'x', dist: blockMaxX - playerMinX, dir: 1 },  // Push +X
        { axis: 'x', dist: playerMaxX - blockMinX, dir: -1 }, // Push -X
        { axis: 'z', dist: blockMaxZ - playerMinZ, dir: 1 },  // Push +Z
        { axis: 'z', dist: playerMaxZ - blockMinZ, dir: -1 }, // Push -Z
        { axis: 'y', dist: blockMaxY - playerMinY, dir: 1 },  // Push up (+Y)
      ];
      
      // Sort by distance (shortest first)
      pushDistances.sort((a, b) => a.dist - b.dist);
      
      // Apply the shortest push
      const push = pushDistances[0];
      const pushAmount = push.dist + 0.1; // Small extra margin
      
      if (push.axis === 'x') {
        this.playerPosition.x += pushAmount * push.dir;
        console.log(`🏃 Player pushed ${push.dir > 0 ? '+' : '-'}X by ${pushAmount.toFixed(2)} to avoid falling block`);
      } else if (push.axis === 'z') {
        this.playerPosition.z += pushAmount * push.dir;
        console.log(`🏃 Player pushed ${push.dir > 0 ? '+' : '-'}Z by ${pushAmount.toFixed(2)} to avoid falling block`);
      } else if (push.axis === 'y') {
        this.playerPosition.y += pushAmount;
        console.log(`🏃 Player pushed up by ${pushAmount.toFixed(2)} to avoid falling block`);
      }
    }
  }
  
  /**
   * Get count of active falling blocks
   */
  getFallingBlockCount(): number {
    return this.fallingBlocks.size;
  }
  
  /**
   * Check if there are any falling blocks at or above a position
   * Used to prevent placing blocks where falling blocks will land
   */
  hasFallingBlockAbove(x: number, z: number, y: number): boolean {
    for (const entity of this.fallingBlocks.values()) {
      if (Math.floor(entity.position.x) === x && 
          Math.floor(entity.position.z) === z &&
          entity.position.y >= y) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Clean up all falling blocks
   */
  destroy(): void {
    for (const entity of this.fallingBlocks.values()) {
      this.scene.remove(entity.mesh);
      entity.mesh.geometry.dispose();
    }
    this.fallingBlocks.clear();
    this.blockGeometry.dispose();
  }
}


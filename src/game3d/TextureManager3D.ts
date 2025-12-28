/**
 * Texture Manager for Three.js
 * Loads and manages block textures with Minecraft-style face shading
 */

import * as THREE from 'three';
import { BlockType } from '../world/types';
import {
  createInstancedBlockMaterial,
  createWaterMaterial,
  createLeavesMaterial,
  createInstancedLeavesMaterial,
  createBlockMaterial,
} from './BlockShader';
import { blockNeedsBiomeTint, isBlockLog } from '../world/BlockDefinition';

// Texture file paths
const TEXTURE_PATHS: Partial<Record<BlockType, string>> = {
  [BlockType.Grass]: '/textures/grass_block_top.png',
  [BlockType.Dirt]: '/textures/dirt.png',
  [BlockType.Sand]: '/textures/sand.png',
  [BlockType.Stone]: '/textures/stone.png',
  [BlockType.Gravel]: '/textures/gravel.png',
  [BlockType.Bedrock]: '/textures/bedrock.png',
  [BlockType.Snow]: '/textures/snow.png',
  [BlockType.Ice]: '/textures/ice.png',
  [BlockType.PackedIce]: '/textures/packed_ice.png',
  [BlockType.BlueIce]: '/textures/blue_ice.png',
  [BlockType.Clay]: '/textures/clay.png',
  [BlockType.Podzol]: '/textures/podzol_top.png',
  [BlockType.Mycelium]: '/textures/mycelium_top.png',
  [BlockType.RedSand]: '/textures/red_sand.png',
  [BlockType.Terracotta]: '/textures/terracotta.png',
  // Logs (side/bark texture)
  [BlockType.OakLog]: '/textures/oak_log.png',
  [BlockType.BirchLog]: '/textures/birch_log.png',
  [BlockType.SpruceLog]: '/textures/spruce_log.png',
  [BlockType.JungleLog]: '/textures/jungle_log.png',
  [BlockType.AcaciaLog]: '/textures/acacia_log.png',
  [BlockType.DarkOakLog]: '/textures/dark_oak_log.png',
  [BlockType.CherryLog]: '/textures/cherry_log.png',
  [BlockType.MangroveLog]: '/textures/mangrove_log.png',
  // Leaves
  [BlockType.OakLeaves]: '/textures/oak_leaves.png',
  [BlockType.BirchLeaves]: '/textures/birch_leaves.png',
  [BlockType.SpruceLeaves]: '/textures/spruce_leaves.png',
  [BlockType.JungleLeaves]: '/textures/jungle_leaves.png',
  [BlockType.AcaciaLeaves]: '/textures/acacia_leaves.png',
  [BlockType.DarkOakLeaves]: '/textures/dark_oak_leaves.png',
  [BlockType.CherryLeaves]: '/textures/cherry_leaves.png',
  [BlockType.MangroveLeaves]: '/textures/mangrove_leaves.png',
  // Cactus
  [BlockType.Cactus]: '/textures/cactus_side.png',
  // Saplings
  [BlockType.OakSapling]: '/textures/oak_sapling.png',
  [BlockType.BirchSapling]: '/textures/birch_sapling.png',
  [BlockType.SpruceSapling]: '/textures/spruce_sapling.png',
  [BlockType.JungleSapling]: '/textures/jungle_sapling.png',
  [BlockType.AcaciaSapling]: '/textures/acacia_sapling.png',
  [BlockType.DarkOakSapling]: '/textures/dark_oak_sapling.png',
  [BlockType.CherrySapling]: '/textures/cherry_sapling.png',
  [BlockType.MangroveSapling]: '/textures/mangrove_sapling.png',
  // Water
  [BlockType.Water]: '/textures/water_still.png',
  // Wood Planks
  [BlockType.OakPlanks]: '/textures/oak_planks.png',
  [BlockType.BirchPlanks]: '/textures/birch_planks.png',
  [BlockType.SprucePlanks]: '/textures/spruce_planks.png',
  [BlockType.JunglePlanks]: '/textures/jungle_planks.png',
  [BlockType.AcaciaPlanks]: '/textures/acacia_planks.png',
  [BlockType.DarkOakPlanks]: '/textures/dark_oak_planks.png',
  [BlockType.CherryPlanks]: '/textures/cherry_planks.png',
  [BlockType.MangrovePlanks]: '/textures/mangrove_planks.png',
  // Stripped Logs (side texture)
  [BlockType.StrippedOakLog]: '/textures/stripped_oak_log.png',
  [BlockType.StrippedBirchLog]: '/textures/stripped_birch_log.png',
  [BlockType.StrippedSpruceLog]: '/textures/stripped_spruce_log.png',
  [BlockType.StrippedJungleLog]: '/textures/stripped_jungle_log.png',
  [BlockType.StrippedAcaciaLog]: '/textures/stripped_acacia_log.png',
  [BlockType.StrippedDarkOakLog]: '/textures/stripped_dark_oak_log.png',
  [BlockType.StrippedCherryLog]: '/textures/stripped_cherry_log.png',
  [BlockType.StrippedMangroveLog]: '/textures/stripped_mangrove_log.png',
  // Doors (using bottom part as main texture for inventory)
  [BlockType.OakDoor]: '/textures/oak_door_bottom.png',
  [BlockType.BirchDoor]: '/textures/birch_door_bottom.png',
  [BlockType.SpruceDoor]: '/textures/spruce_door_bottom.png',
  [BlockType.JungleDoor]: '/textures/jungle_door_bottom.png',
  [BlockType.AcaciaDoor]: '/textures/acacia_door_bottom.png',
  [BlockType.DarkOakDoor]: '/textures/dark_oak_door_bottom.png',
  [BlockType.CherryDoor]: '/textures/cherry_door_bottom.png',
  [BlockType.MangroveDoor]: '/textures/mangrove_door_bottom.png',
  // Trapdoors
  [BlockType.OakTrapdoor]: '/textures/oak_trapdoor.png',
  [BlockType.BirchTrapdoor]: '/textures/birch_trapdoor.png',
  [BlockType.SpruceTrapdoor]: '/textures/spruce_trapdoor.png',
  [BlockType.JungleTrapdoor]: '/textures/jungle_trapdoor.png',
  [BlockType.AcaciaTrapdoor]: '/textures/acacia_trapdoor.png',
  [BlockType.DarkOakTrapdoor]: '/textures/dark_oak_trapdoor.png',
  [BlockType.CherryTrapdoor]: '/textures/cherry_trapdoor.png',
  [BlockType.MangroveTrapdoor]: '/textures/mangrove_trapdoor.png',
};

// Log top texture paths (for top/bottom faces showing growth rings)
const LOG_TOP_TEXTURE_PATHS: Partial<Record<BlockType, string>> = {
  [BlockType.OakLog]: '/textures/oak_log_top.png',
  [BlockType.BirchLog]: '/textures/birch_log_top.png',
  [BlockType.SpruceLog]: '/textures/spruce_log_top.png',
  [BlockType.JungleLog]: '/textures/jungle_log_top.png',
  [BlockType.AcaciaLog]: '/textures/acacia_log_top.png',
  [BlockType.DarkOakLog]: '/textures/dark_oak_log_top.png',
  [BlockType.CherryLog]: '/textures/cherry_log_top.png',
  [BlockType.MangroveLog]: '/textures/mangrove_log_top.png',
  [BlockType.Cactus]: '/textures/cactus_top.png',
  // Stripped log tops
  [BlockType.StrippedOakLog]: '/textures/stripped_oak_log_top.png',
  [BlockType.StrippedBirchLog]: '/textures/stripped_birch_log_top.png',
  [BlockType.StrippedSpruceLog]: '/textures/stripped_spruce_log_top.png',
  [BlockType.StrippedJungleLog]: '/textures/stripped_jungle_log_top.png',
  [BlockType.StrippedAcaciaLog]: '/textures/stripped_acacia_log_top.png',
  [BlockType.StrippedDarkOakLog]: '/textures/stripped_dark_oak_log_top.png',
  [BlockType.StrippedCherryLog]: '/textures/stripped_cherry_log_top.png',
  [BlockType.StrippedMangroveLog]: '/textures/stripped_mangrove_log_top.png',
};

// Block side texture paths (for blocks with different top/side textures like grass)
const BLOCK_SIDE_TEXTURE_PATHS: Partial<Record<BlockType, string>> = {
  [BlockType.Grass]: '/textures/grass_block_side.png',
  [BlockType.Podzol]: '/textures/podzol_side.png',
  [BlockType.Mycelium]: '/textures/mycelium_side.png',
};

// Fallback colors for blocks without textures
const FALLBACK_COLORS: Partial<Record<BlockType, number>> = {
  [BlockType.Air]: 0x000000,
};

export class TextureManager3D {
  private loader: THREE.TextureLoader;
  private textures: Map<BlockType, THREE.Texture> = new Map();
  private logTopTextures: Map<BlockType, THREE.Texture> = new Map();
  private blockSideTextures: Map<BlockType, THREE.Texture> = new Map();
  private materials: Map<string, THREE.Material> = new Map();

  constructor() {
    this.loader = new THREE.TextureLoader();
  }

  /**
   * Load all textures
   */
  async loadTextures(): Promise<void> {
    console.log('📦 Loading 3D textures...');
    
    const promises: Promise<void>[] = [];
    
    // Load main textures
    for (const [blockType, path] of Object.entries(TEXTURE_PATHS)) {
      const bt = parseInt(blockType) as BlockType;
      promises.push(this.loadTexture(bt, path));
    }
    
    // Load log top textures
    for (const [blockType, path] of Object.entries(LOG_TOP_TEXTURE_PATHS)) {
      const bt = parseInt(blockType) as BlockType;
      promises.push(this.loadLogTopTexture(bt, path));
    }
    
    // Load block side textures (grass, podzol, mycelium)
    for (const [blockType, path] of Object.entries(BLOCK_SIDE_TEXTURE_PATHS)) {
      const bt = parseInt(blockType) as BlockType;
      promises.push(this.loadBlockSideTexture(bt, path));
    }
    
    await Promise.all(promises);
    console.log(`✅ Loaded ${this.textures.size} textures + ${this.logTopTextures.size} log tops + ${this.blockSideTextures.size} block sides`);
  }

  /**
   * Load a single texture
   */
  private async loadTexture(blockType: BlockType, path: string): Promise<void> {
    return new Promise((resolve) => {
      this.loader.load(
        path,
        (texture) => {
          // Minecraft-style pixelated textures
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;
          texture.colorSpace = THREE.SRGBColorSpace;
          this.textures.set(blockType, texture);
          resolve();
        },
        undefined,
        () => {
          // Error loading - will use fallback color
          resolve();
        }
      );
    });
  }

  /**
   * Load a log top texture
   */
  private async loadLogTopTexture(blockType: BlockType, path: string): Promise<void> {
    return new Promise((resolve) => {
      this.loader.load(
        path,
        (texture) => {
          // Minecraft-style pixelated textures
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;
          texture.colorSpace = THREE.SRGBColorSpace;
          this.logTopTextures.set(blockType, texture);
          resolve();
        },
        undefined,
        () => {
          // Error loading - will use side texture as fallback
          resolve();
        }
      );
    });
  }

  /**
   * Load a block side texture (for grass, podzol, mycelium)
   */
  private async loadBlockSideTexture(blockType: BlockType, path: string): Promise<void> {
    return new Promise((resolve) => {
      this.loader.load(
        path,
        (texture) => {
          // Minecraft-style pixelated textures
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;
          texture.colorSpace = THREE.SRGBColorSpace;
          this.blockSideTextures.set(blockType, texture);
          resolve();
        },
        undefined,
        () => {
          // Error loading - will use top texture as fallback
          resolve();
        }
      );
    });
  }

  /**
   * Check if a block type is a log that needs different top/side textures
   * Uses flyweight BlockDefinition for centralized block properties
   */
  isLogBlock(blockType: BlockType): boolean {
    // Use flyweight check, but also verify we have a texture for it
    return isBlockLog(blockType) || LOG_TOP_TEXTURE_PATHS[blockType] !== undefined;
  }

  /**
   * Get or create a material for a block type (for individual meshes like trees)
   */
  getMaterial(blockType: BlockType, tint?: THREE.Color): THREE.Material {
    const cacheKey = `${blockType}_${tint?.getHexString() || 'none'}`;
    
    if (this.materials.has(cacheKey)) {
      return this.materials.get(cacheKey)!;
    }
    
    const texture = this.textures.get(blockType);
    const color = tint || new THREE.Color(0xffffff);
    
    let material: THREE.Material;
    
    if (texture) {
      // Use custom shader material with Minecraft-style face shading
      material = createBlockMaterial({
        map: texture.clone(),
        color,
        instanced: false,
      });
    } else {
      // Fallback to solid color
      const fallbackColor = FALLBACK_COLORS[blockType] || 0x888888;
      material = createBlockMaterial({
        color: new THREE.Color(fallbackColor),
        instanced: false,
      });
    }
    
    this.materials.set(cacheKey, material);
    return material;
  }

  /**
   * Get materials array for log blocks (different top/side textures)
   * Returns array of 6 materials for BoxGeometry faces:
   * [+X, -X, +Y (top), -Y (bottom), +Z, -Z]
   */
  getLogMaterials(blockType: BlockType): THREE.Material[] {
    const cacheKey = `log_materials_${blockType}`;
    
    // Check cache (stored as comma-separated key for array)
    const cachedSide = this.materials.get(`${cacheKey}_side`);
    const cachedTop = this.materials.get(`${cacheKey}_top`);
    
    if (cachedSide && cachedTop) {
      // Return array: [side, side, top, top, side, side]
      return [cachedSide, cachedSide, cachedTop, cachedTop, cachedSide, cachedSide];
    }
    
    const sideTexture = this.textures.get(blockType);
    const topTexture = this.logTopTextures.get(blockType) || sideTexture;
    
    // Create side material (bark)
    const sideMaterial = sideTexture 
      ? createBlockMaterial({ map: sideTexture.clone(), color: new THREE.Color(0xffffff), instanced: false })
      : createBlockMaterial({ color: new THREE.Color(0x6b5232), instanced: false });
    
    // Create top material (growth rings)
    const topMaterial = topTexture
      ? createBlockMaterial({ map: topTexture.clone(), color: new THREE.Color(0xffffff), instanced: false })
      : sideMaterial;
    
    // Cache materials
    this.materials.set(`${cacheKey}_side`, sideMaterial);
    this.materials.set(`${cacheKey}_top`, topMaterial);
    
    // BoxGeometry face order: +X, -X, +Y (top), -Y (bottom), +Z, -Z
    return [sideMaterial, sideMaterial, topMaterial, topMaterial, sideMaterial, sideMaterial];
  }

  /**
   * Check if a block type has different top/side textures (grass, podzol, mycelium)
   */
  hasBlockSideTexture(blockType: BlockType): boolean {
    return BLOCK_SIDE_TEXTURE_PATHS[blockType] !== undefined;
  }

  /**
   * Get materials array for grass-like blocks (different top/side textures)
   * Returns array of 6 materials for BoxGeometry faces:
   * [+X, -X, +Y (top), -Y (bottom), +Z, -Z]
   */
  getGrassBlockMaterials(blockType: BlockType, tint?: THREE.Color): THREE.Material[] {
    const tintKey = tint?.getHexString() || 'none';
    const cacheKey = `grass_materials_${blockType}_${tintKey}`;
    
    // Check cache
    const cachedSide = this.materials.get(`${cacheKey}_side`);
    const cachedTop = this.materials.get(`${cacheKey}_top`);
    
    if (cachedSide && cachedTop) {
      // Return array: [side, side, top, bottom (dirt), side, side]
      const cachedBottom = this.materials.get(`${cacheKey}_bottom`) || cachedSide;
      return [cachedSide, cachedSide, cachedTop, cachedBottom, cachedSide, cachedSide];
    }
    
    const topTexture = this.textures.get(blockType);
    const sideTexture = this.blockSideTextures.get(blockType) || topTexture;
    const bottomTexture = this.textures.get(BlockType.Dirt);
    const color = tint || new THREE.Color(0xffffff);
    
    // Create top material (grass top with tint)
    const topMaterial = topTexture 
      ? createBlockMaterial({ map: topTexture.clone(), color, instanced: false })
      : createBlockMaterial({ color: new THREE.Color(0x7cbc4d), instanced: false });
    
    // Create side material (grass side with tint)
    const sideMaterial = sideTexture
      ? createBlockMaterial({ map: sideTexture.clone(), color, instanced: false })
      : topMaterial;
    
    // Create bottom material (dirt, no tint)
    const bottomMaterial = bottomTexture
      ? createBlockMaterial({ map: bottomTexture.clone(), color: new THREE.Color(0xffffff), instanced: false })
      : createBlockMaterial({ color: new THREE.Color(0x8b6442), instanced: false });
    
    // Cache materials
    this.materials.set(`${cacheKey}_side`, sideMaterial);
    this.materials.set(`${cacheKey}_top`, topMaterial);
    this.materials.set(`${cacheKey}_bottom`, bottomMaterial);
    
    // BoxGeometry face order: +X, -X, +Y (top), -Y (bottom), +Z, -Z
    return [sideMaterial, sideMaterial, topMaterial, bottomMaterial, sideMaterial, sideMaterial];
  }

  /**
   * Get cactus materials array - MeshBasicMaterial with tiled side texture, regular top texture
   * Returns array of 6 materials for BoxGeometry faces:
   * [+X, -X, +Y (top), -Y (bottom), +Z, -Z]
   */
  getCactusMaterials(): THREE.Material[] {
    const cacheKey = 'cactus_materials';
    
    // Check cache
    const cachedSide = this.materials.get(`${cacheKey}_side`);
    const cachedTop = this.materials.get(`${cacheKey}_top`);
    
    if (cachedSide && cachedTop) {
      return [cachedSide, cachedSide, cachedTop, cachedTop, cachedSide, cachedSide];
    }
    
    const sideTexture = this.textures.get(BlockType.Cactus);
    const topTexture = this.logTopTextures.get(BlockType.Cactus);
    
    let sideMaterial: THREE.Material;
    let topMaterial: THREE.Material;
    
    if (sideTexture) {
      // Clone texture and enable wrapping for tiled UVs on sides
      const tiledTexture = sideTexture.clone();
      tiledTexture.wrapS = THREE.RepeatWrapping;
      tiledTexture.wrapT = THREE.RepeatWrapping;
      tiledTexture.needsUpdate = true;
      
      // Use MeshBasicMaterial - no lighting = no face shading seams
      sideMaterial = new THREE.MeshBasicMaterial({ map: tiledTexture });
    } else {
      // Fallback to solid color
      sideMaterial = new THREE.MeshBasicMaterial({ color: 0x3c8c28 });
    }
    
    if (topTexture) {
      // Top texture doesn't need tiling, just use as-is
      const topTex = topTexture.clone();
      topTex.needsUpdate = true;
      topMaterial = new THREE.MeshBasicMaterial({ map: topTex });
    } else {
      // Fallback to side material
      topMaterial = sideMaterial;
    }
    
    // Cache materials
    this.materials.set(`${cacheKey}_side`, sideMaterial);
    this.materials.set(`${cacheKey}_top`, topMaterial);
    
    // BoxGeometry face order: +X, -X, +Y (top), -Y (bottom), +Z, -Z
    return [sideMaterial, sideMaterial, topMaterial, topMaterial, sideMaterial, sideMaterial];
  }

  /**
   * Get or create an instanced material for a block type (for terrain chunks)
   */
  getInstancedMaterial(blockType: BlockType, tint?: THREE.Color): THREE.Material {
    const cacheKey = `instanced_${blockType}_${tint?.getHexString() || 'none'}`;
    
    if (this.materials.has(cacheKey)) {
      return this.materials.get(cacheKey)!;
    }
    
    const texture = this.textures.get(blockType);
    const color = tint || new THREE.Color(0xffffff);
    
    let material: THREE.Material;
    
    if (texture) {
      // Use custom shader material with Minecraft-style face shading for instanced meshes
      material = createInstancedBlockMaterial({
        map: texture.clone(),
        color,
      });
    } else {
      // Fallback to solid color
      const fallbackColor = FALLBACK_COLORS[blockType] || 0x888888;
      material = createInstancedBlockMaterial({
        color: new THREE.Color(fallbackColor),
      });
    }
    
    this.materials.set(cacheKey, material);
    return material;
  }

  /**
   * Get water material with biome tinting and Minecraft-style face shading
   */
  getWaterMaterial(biome?: number): THREE.Material {
    const cacheKey = biome !== undefined ? `water_${biome}` : 'water_default';
    
    if (this.materials.has(cacheKey)) {
      return this.materials.get(cacheKey)!;
    }
    
    const texture = this.textures.get(BlockType.Water);
    const tint = biome !== undefined ? this.getWaterTint(biome) : new THREE.Color(0x3f76e4);
    
    // Use custom shader material with Minecraft-style face shading
    const material = createWaterMaterial(texture?.clone() || null, tint);
    
    this.materials.set(cacheKey, material);
    return material;
  }

  /**
   * Get biome-specific water tint color
   */
  private getWaterTint(biome: number): THREE.Color {
    // Biome IDs from cubiomes
    const BiomeID = {
      warm_ocean: 45,
      deep_warm_ocean: 46,
      lukewarm_ocean: 47,
      deep_lukewarm_ocean: 49,
      cold_ocean: 43,
      deep_cold_ocean: 44,
      deep_ocean: 24,
      ocean: 0,
      swamp: 6,
      mangrove_swamp: 51,
      frozen_ocean: 10,
      deep_frozen_ocean: 50,
    };

    // Water tint colors from Minecraft
    const waterTints: Record<number, [number, number, number]> = {
      // Warm ocean - turquoise
      [BiomeID.warm_ocean]: [67, 213, 238],
      [BiomeID.deep_warm_ocean]: [67, 213, 238],
      // Lukewarm ocean
      [BiomeID.lukewarm_ocean]: [69, 173, 242],
      [BiomeID.deep_lukewarm_ocean]: [69, 173, 242],
      // Cold ocean - darker blue
      [BiomeID.cold_ocean]: [61, 87, 214],
      [BiomeID.deep_cold_ocean]: [61, 87, 214],
      // Frozen ocean - icy blue
      [BiomeID.frozen_ocean]: [57, 56, 201],
      [BiomeID.deep_frozen_ocean]: [57, 56, 201],
      // Deep ocean - darker
      [BiomeID.deep_ocean]: [48, 96, 195],
      // Regular ocean
      [BiomeID.ocean]: [63, 118, 228],
      // Swamp - murky green water
      [BiomeID.swamp]: [97, 123, 100],
      [BiomeID.mangrove_swamp]: [62, 93, 83],
    };

    const rgb = waterTints[biome] || [63, 118, 228]; // Default blue
    return new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  }

  /**
   * Get a tinted material for leaves (for individual tree meshes)
   */
  getLeavesMaterial(blockType: BlockType, biome: number): THREE.Material {
    const cacheKey = `leaves_${blockType}_${biome}`;
    
    if (this.materials.has(cacheKey)) {
      return this.materials.get(cacheKey)!;
    }
    
    const texture = this.textures.get(blockType);
    const tint = this.getBiomeTint(biome);
    
    // Use custom shader material with Minecraft-style face shading
    const material = createLeavesMaterial(texture?.clone() || null, tint);
    
    this.materials.set(cacheKey, material);
    return material;
  }

  /**
   * Get a tinted instanced material for leaves (for terrain chunks)
   */
  getInstancedLeavesMaterial(blockType: BlockType, biome: number): THREE.Material {
    const cacheKey = `instanced_leaves_${blockType}_${biome}`;
    
    if (this.materials.has(cacheKey)) {
      return this.materials.get(cacheKey)!;
    }
    
    const texture = this.textures.get(blockType);
    const tint = this.getBiomeTint(biome);
    
    // Use custom shader material with Minecraft-style face shading for instanced meshes
    const material = createInstancedLeavesMaterial(texture?.clone() || null, tint);
    
    this.materials.set(cacheKey, material);
    return material;
  }

  /**
   * Get grass material with biome tinting (for instanced terrain)
   */
  getGrassMaterial(biome: number): THREE.Material {
    const cacheKey = `instanced_grass_${biome}`;
    
    if (this.materials.has(cacheKey)) {
      return this.materials.get(cacheKey)!;
    }
    
    const texture = this.textures.get(BlockType.Grass);
    const tint = this.getBiomeTint(biome);
    
    // Use custom shader material with Minecraft-style face shading for instanced meshes
    const material = createInstancedBlockMaterial({
      map: texture?.clone() || null,
      color: tint,
    });
    
    this.materials.set(cacheKey, material);
    return material;
  }

  /**
   * Get biome tint color for grass/leaves (from Minecraft colormap)
   */
  getBiomeTint(biome: number): THREE.Color {
    // Biome IDs from cubiomes
    const BiomeID = {
      swamp: 6,
      mangrove_swamp: 51,
      jungle: 21,
      bamboo_jungle: 48,
      sparse_jungle: 23,
      badlands: 37,
      wooded_badlands: 38,
      wooded_badlands_plateau: 39,
      eroded_badlands: 165,
      dark_forest: 29,
      snowy_plains: 12,
      snowy_taiga: 30,
      snowy_slopes: 184,
      snowy_beach: 26,
      ice_spikes: 140,
      frozen_peaks: 182,
      grove: 185,
      snowy_mountains: 13,
      cherry_grove: 186,
      savanna: 35,
      savanna_plateau: 36,
      windswept_savanna: 163,
      desert: 2,
      birch_forest: 27,
      old_growth_birch_forest: 155,
      taiga: 5,
      old_growth_pine_taiga: 32,
      old_growth_spruce_taiga: 160,
    };

    // RGB tint colors from Minecraft colormap
    const tintMap: Record<number, [number, number, number]> = {
      // Swamp - murky green
      [BiomeID.swamp]: [106, 112, 57],
      [BiomeID.mangrove_swamp]: [141, 154, 50],
      // Jungle - lush vibrant green
      [BiomeID.jungle]: [89, 201, 60],
      [BiomeID.bamboo_jungle]: [89, 201, 60],
      [BiomeID.sparse_jungle]: [89, 201, 60],
      // Badlands - dead dry grass
      [BiomeID.badlands]: [144, 129, 77],
      [BiomeID.wooded_badlands]: [144, 129, 77],
      [BiomeID.wooded_badlands_plateau]: [144, 129, 77],
      [BiomeID.eroded_badlands]: [144, 129, 77],
      // Dark forest - darker green
      [BiomeID.dark_forest]: [80, 122, 50],
      // Snowy biomes - cold blue-green
      [BiomeID.snowy_plains]: [128, 180, 151],
      [BiomeID.snowy_taiga]: [128, 180, 151],
      [BiomeID.snowy_slopes]: [128, 180, 151],
      [BiomeID.snowy_beach]: [128, 180, 151],
      [BiomeID.ice_spikes]: [128, 180, 151],
      [BiomeID.frozen_peaks]: [128, 180, 151],
      [BiomeID.grove]: [128, 180, 151],
      [BiomeID.snowy_mountains]: [128, 180, 151],
      // Cherry grove - bright green
      [BiomeID.cherry_grove]: [182, 219, 97],
      // Savanna - dry yellow grass
      [BiomeID.savanna]: [191, 183, 85],
      [BiomeID.savanna_plateau]: [191, 183, 85],
      [BiomeID.windswept_savanna]: [191, 183, 85],
      // Desert - same dry color
      [BiomeID.desert]: [191, 183, 85],
      // Birch forest
      [BiomeID.birch_forest]: [136, 183, 97],
      [BiomeID.old_growth_birch_forest]: [136, 183, 97],
      // Taiga
      [BiomeID.taiga]: [134, 175, 97],
      [BiomeID.old_growth_pine_taiga]: [134, 175, 97],
      [BiomeID.old_growth_spruce_taiga]: [134, 175, 97],
    };

    const rgb = tintMap[biome] || [145, 189, 89]; // Default plains green
    return new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  }

  /**
   * Check if block type needs biome tinting
   * Uses flyweight BlockDefinition for centralized block properties
   */
  needsBiomeTint(blockType: BlockType): boolean {
    return blockNeedsBiomeTint(blockType);
    // Note: Cherry leaves don't use biome tint (they're always pink) - handled in BlockDefinition
  }

  /**
   * Get material(s) for dropped items - uses simple unlit material
   * Returns array of 6 materials for blocks with different face textures (grass, logs)
   * Returns single material for uniform blocks
   * This ensures consistent color when the item rotates (no face-based shading)
   */
  getDroppedItemMaterials(blockType: BlockType): THREE.Material | THREE.Material[] {
    const cacheKey = `dropped_${blockType}`;
    
    // Check if we have cached materials (could be single or array)
    if (this.materials.has(cacheKey)) {
      return this.materials.get(cacheKey)!;
    }
    
    // Check for multi-array cache key
    const arrayCacheKey = `dropped_array_${blockType}`;
    if (this.materials.has(`${arrayCacheKey}_0`)) {
      // Reconstruct array from cached materials
      const materials: THREE.Material[] = [];
      for (let i = 0; i < 6; i++) {
        materials.push(this.materials.get(`${arrayCacheKey}_${i}`)!);
      }
      return materials;
    }
    
    // Check if this is a grass-like block with different top/side textures
    if (this.hasBlockSideTexture(blockType)) {
      return this.createDroppedGrassBlockMaterials(blockType, arrayCacheKey);
    }
    
    // Check if this is a log block with different top/side textures
    if (this.isLogBlock(blockType)) {
      return this.createDroppedLogMaterials(blockType, arrayCacheKey);
    }
    
    // Single material for uniform blocks
    const texture = this.textures.get(blockType);
    let material: THREE.Material;
    
    if (texture) {
      const clonedTexture = this.cloneTextureWithSettings(texture);
      
      // Check if this block type needs biome tinting (leaves)
      if (this.needsBiomeTint(blockType)) {
        // Default green tint (plains biome color: RGB 145, 189, 89)
        const defaultTint = new THREE.Color(145 / 255, 189 / 255, 89 / 255);
        material = new THREE.MeshBasicMaterial({
          map: clonedTexture,
          color: defaultTint,
        });
      } else {
        material = new THREE.MeshBasicMaterial({
          map: clonedTexture,
        });
      }
    } else {
      const fallbackColor = FALLBACK_COLORS[blockType] || 0x888888;
      material = new THREE.MeshBasicMaterial({
        color: fallbackColor,
      });
    }
    
    this.materials.set(cacheKey, material);
    return material;
  }
  
  /**
   * Helper to clone a texture with proper settings preserved
   */
  private cloneTextureWithSettings(texture: THREE.Texture): THREE.Texture {
    const clonedTexture = texture.clone();
    clonedTexture.magFilter = THREE.NearestFilter;
    clonedTexture.minFilter = THREE.NearestFilter;
    clonedTexture.colorSpace = THREE.SRGBColorSpace;
    clonedTexture.needsUpdate = true;
    return clonedTexture;
  }
  
  /**
   * Create materials for dropped grass-like blocks (grass, podzol, mycelium)
   * Returns [+X, -X, +Y (top), -Y (bottom), +Z, -Z]
   */
  private createDroppedGrassBlockMaterials(blockType: BlockType, cacheKey: string): THREE.Material[] {
    const topTexture = this.textures.get(blockType);
    const sideTexture = this.blockSideTextures.get(blockType) || topTexture;
    const bottomTexture = this.textures.get(BlockType.Dirt);
    
    // Default green tint for grass top (plains biome)
    const greenTint = new THREE.Color(145 / 255, 189 / 255, 89 / 255);
    
    // Top material (grass top with green tint)
    const topMaterial = topTexture
      ? new THREE.MeshBasicMaterial({
          map: this.cloneTextureWithSettings(topTexture),
          color: greenTint,
        })
      : new THREE.MeshBasicMaterial({ color: 0x7cbc4d });
    
    // Side material (grass side - has built-in brown/green coloring)
    const sideMaterial = sideTexture
      ? new THREE.MeshBasicMaterial({
          map: this.cloneTextureWithSettings(sideTexture),
        })
      : topMaterial;
    
    // Bottom material (dirt - no tint)
    const bottomMaterial = bottomTexture
      ? new THREE.MeshBasicMaterial({
          map: this.cloneTextureWithSettings(bottomTexture),
        })
      : new THREE.MeshBasicMaterial({ color: 0x8b6442 });
    
    // BoxGeometry face order: +X, -X, +Y (top), -Y (bottom), +Z, -Z
    const materials = [sideMaterial, sideMaterial, topMaterial, bottomMaterial, sideMaterial, sideMaterial];
    
    // Cache individual materials
    for (let i = 0; i < 6; i++) {
      this.materials.set(`${cacheKey}_${i}`, materials[i]);
    }
    
    return materials;
  }
  
  /**
   * Create materials for dropped log blocks
   * Returns [+X, -X, +Y (top), -Y (bottom), +Z, -Z]
   */
  private createDroppedLogMaterials(blockType: BlockType, cacheKey: string): THREE.Material[] {
    const sideTexture = this.textures.get(blockType);
    const topTexture = this.logTopTextures.get(blockType) || sideTexture;
    
    // Side material (bark)
    const sideMaterial = sideTexture
      ? new THREE.MeshBasicMaterial({
          map: this.cloneTextureWithSettings(sideTexture),
        })
      : new THREE.MeshBasicMaterial({ color: 0x6b5232 });
    
    // Top/bottom material (growth rings)
    const topMaterial = topTexture
      ? new THREE.MeshBasicMaterial({
          map: this.cloneTextureWithSettings(topTexture),
        })
      : sideMaterial;
    
    // BoxGeometry face order: +X, -X, +Y (top), -Y (bottom), +Z, -Z
    const materials = [sideMaterial, sideMaterial, topMaterial, topMaterial, sideMaterial, sideMaterial];
    
    // Cache individual materials
    for (let i = 0; i < 6; i++) {
      this.materials.set(`${cacheKey}_${i}`, materials[i]);
    }
    
    return materials;
  }

  /**
   * Get material for sapling blocks (cross-shaped geometry)
   * Uses transparency and double-sided rendering
   */
  getSaplingMaterial(blockType: BlockType): THREE.Material {
    const cacheKey = `sapling_${blockType}`;
    
    if (this.materials.has(cacheKey)) {
      return this.materials.get(cacheKey)!;
    }
    
    const texture = this.textures.get(blockType);
    
    let material: THREE.Material;
    
    if (texture) {
      // Create material with transparency for sapling textures
      const clonedTexture = texture.clone();
      clonedTexture.needsUpdate = true;
      
      material = new THREE.MeshBasicMaterial({
        map: clonedTexture,
        transparent: true,
        alphaTest: 0.1, // Discard pixels with low alpha
        side: THREE.DoubleSide,
        depthWrite: true,
      });
    } else {
      // Fallback to green color
      material = new THREE.MeshBasicMaterial({
        color: 0x4a7c3f,
        transparent: true,
        side: THREE.DoubleSide,
      });
    }
    
    this.materials.set(cacheKey, material);
    return material;
  }
}


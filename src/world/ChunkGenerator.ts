/**
 * Chunk Generator - Generates Minecraft-style blocky terrain using cubiomes WASM
 */

import { WasmGenerator, createWasmGenerator } from '../cubiomes/wasm-bindings';
import { SeededRandom, PerlinNoise } from '../cubiomes/noise';
import { 
  generateTree, 
  getTreeTypeForBiome, 
  getTreeDensity,
  type TreeBlock
} from './vegetation/TreeGenerator';

// Re-export shared types for backward compatibility
export { 
  CHUNK_SIZE, 
  BLOCK_SIZE, 
  MAX_HEIGHT, 
  SEA_LEVEL, 
  BiomeID, 
  TreeType, 
  BlockType,
  TreeTypeToLogBlockType,
  TreeTypeToLeavesBlockType,
  type BiomeIDType 
} from './types';

// Import for local use
import { 
  CHUNK_SIZE, 
  SEA_LEVEL, 
  BiomeID, 
  TreeType, 
  BlockType, 
  type BiomeIDType 
} from './types';

export interface BlockData {
  type: BlockType;
  biome: BiomeIDType;
  height: number;
  light: number;
}

// Block colors for rendering (RGB) - Distinct biome colors
export const BLOCK_COLORS: Partial<Record<BlockType, [number, number, number]>> = {
  [BlockType.Air]: [0, 0, 0],
  [BlockType.Stone]: [128, 128, 128],
  [BlockType.Dirt]: [134, 96, 67],
  [BlockType.Grass]: [86, 168, 60],           // Standard green grass
  [BlockType.Sand]: [235, 210, 150],          // Beach/desert sand
  [BlockType.Gravel]: [136, 126, 126],        // Gray gravel
  [BlockType.Water]: [50, 115, 220],          // Blue ocean
  [BlockType.Ice]: [180, 220, 255],
  [BlockType.Snow]: [250, 250, 255],          // White snow
  [BlockType.SnowBlock]: [240, 240, 248],
  [BlockType.Clay]: [90, 110, 70],            // Swamp - dark muddy green
  [BlockType.Bedrock]: [48, 48, 48],
  [BlockType.OakLog]: [109, 85, 50],
  [BlockType.BirchLog]: [200, 200, 190],
  [BlockType.SpruceLog]: [58, 37, 16],
  [BlockType.JungleLog]: [149, 109, 70],
  [BlockType.AcaciaLog]: [103, 96, 86],
  [BlockType.DarkOakLog]: [60, 46, 26],
  [BlockType.CherryLog]: [196, 91, 99],
  [BlockType.MangroveLog]: [93, 39, 26],
  [BlockType.OakLeaves]: [60, 140, 50],
  [BlockType.BirchLeaves]: [80, 150, 70],
  [BlockType.SpruceLeaves]: [50, 90, 50],
  [BlockType.JungleLeaves]: [48, 140, 48],
  [BlockType.AcaciaLeaves]: [70, 140, 50],
  [BlockType.DarkOakLeaves]: [50, 100, 40],
  [BlockType.CherryLeaves]: [255, 180, 200],
  [BlockType.MangroveLeaves]: [95, 130, 50],
  [BlockType.Cactus]: [60, 140, 40],
  [BlockType.CactusTop]: [90, 160, 60],
  [BlockType.DeadBush]: [190, 170, 90],       // Savanna - yellowish dry grass
  [BlockType.TallGrass]: [100, 160, 60],
  [BlockType.Fern]: [45, 180, 60],            // Jungle - vibrant green
  [BlockType.Podzol]: [100, 85, 55],          // Taiga/dark forest - brown
  [BlockType.Mycelium]: [140, 100, 130],      // Mushroom fields - purple-ish
  [BlockType.RedSand]: [200, 110, 40],        // Wooded badlands - orange
  [BlockType.Terracotta]: [175, 90, 60],      // Badlands - reddish clay
  [BlockType.PackedIce]: [160, 200, 240],     // Ice spikes - light blue
  [BlockType.BlueIce]: [100, 160, 255],
  [BlockType.Coral]: [255, 100, 150],
  [BlockType.Seagrass]: [50, 100, 50],
};

export interface TreeData {
  x: number;
  z: number;
  type: TreeType;
  height: number;
  blocks: TreeBlock[];  // Full block data for rendering
}

// Re-export from vegetation module
export { type TreeBlock, type GeneratedTree } from './vegetation/TreeGenerator';

export interface ChunkData {
  heightMap: Uint8Array;
  biomeMap: Int16Array;
  topBlock: Uint8Array;
  trees: TreeData[];
  waterDepth: Uint8Array;
  // Heights of neighbors at the chunk borders (for seam stitching)
  rightNeighborHeights: Uint8Array; // at x = CHUNK_SIZE
  frontNeighborHeights: Uint8Array; // at z = CHUNK_SIZE
}

/**
 * Chunk Generator using real cubiomes WASM module
 */
export class ChunkGenerator {
  private generator: WasmGenerator | null = null;
  private seed: number;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  
  // Noise generators for smooth terrain
  private terrainNoise: PerlinNoise | null = null;
  private detailNoise: PerlinNoise | null = null;

  constructor(seed: number) {
    this.seed = seed;
    
    // Initialize noise generators
    const rng1 = new SeededRandom(seed);
    const rng2 = new SeededRandom(seed ^ 0x12345678);
    this.terrainNoise = new PerlinNoise(rng1);
    this.detailNoise = new PerlinNoise(rng2);
  }

  /**
   * Initialize the WASM generator (must be called before generating chunks)
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.generator = await createWasmGenerator(BigInt(this.seed));
      this.initialized = true;
      console.log(`✅ ChunkGenerator initialized with seed: ${this.seed}`);
    })();

    return this.initPromise;
  }

  /**
   * Check if generator is ready
   */
  isReady(): boolean {
    return this.initialized && this.generator !== null;
  }

  /**
   * Generate chunk data for the given chunk coordinates
   * Terrain is guaranteed to be smooth (max 1 block height difference between neighbors)
   */
  generateChunk(chunkX: number, chunkZ: number): ChunkData {
    if (!this.generator) {
      throw new Error('Generator not initialized. Call init() first.');
    }

    const heightMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomeMap = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    const topBlock = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const waterDepth = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const rightNeighborHeights = new Uint8Array(CHUNK_SIZE);
    const frontNeighborHeights = new Uint8Array(CHUNK_SIZE);
    const trees: TreeData[] = [];

    const worldX = chunkX * CHUNK_SIZE;
    const worldZ = chunkZ * CHUNK_SIZE;
    
    // Generate biomes for entire chunk at once (plus buffer for neighbors if needed, but we'll query point-wise for edges)
    const biomes = this.generator.genBiomes2D(1, worldX, worldZ, CHUNK_SIZE, CHUNK_SIZE, 63);

    // First pass: Calculate raw heights
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const idx = lz * CHUNK_SIZE + lx;
        const wx = worldX + lx;
        const wz = worldZ + lz;

        const biome = biomes[idx];
        biomeMap[idx] = biome;

        // Calculate smooth terrain height
        const height = this.calculateSmoothHeight(wx, wz, biome);
        heightMap[idx] = height;
      }
    }
    
    // Calculate border heights for seamless connections
    // Right border (x = CHUNK_SIZE)
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = worldX + CHUNK_SIZE; // The column just outside to the right
      const wz = worldZ + lz;
      const biome = this.getBiomeAt(wx, wz);
      rightNeighborHeights[lz] = this.calculateSmoothHeight(wx, wz, biome);
    }
    
    // Front border (z = CHUNK_SIZE)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = worldX + lx;
      const wz = worldZ + CHUNK_SIZE; // The row just outside to the front
      const biome = this.getBiomeAt(wx, wz);
      frontNeighborHeights[lx] = this.calculateSmoothHeight(wx, wz, biome);
    }
    
    // Height smoothing pass: ensure max 1-block difference between neighbors
    // Multiple passes for better smoothing
    for (let pass = 0; pass < 3; pass++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const idx = lz * CHUNK_SIZE + lx;
          const h = heightMap[idx];
          
          // Check neighbors (handling edges by using calculated border heights)
          const nNorth = (lz > 0) ? heightMap[(lz - 1) * CHUNK_SIZE + lx] : h; // Assume flat if no context (or could fetch)
          const nSouth = (lz < CHUNK_SIZE - 1) ? heightMap[(lz + 1) * CHUNK_SIZE + lx] : frontNeighborHeights[lx];
          const nWest = (lx > 0) ? heightMap[lz * CHUNK_SIZE + (lx - 1)] : h;
          const nEast = (lx < CHUNK_SIZE - 1) ? heightMap[lz * CHUNK_SIZE + (lx + 1)] : rightNeighborHeights[lz];
          
          const neighbors = [nNorth, nSouth, nWest, nEast];
          
          // Clamp height to be within 1 of all neighbors
          let minN = Math.min(...neighbors);
          let maxN = Math.max(...neighbors);
          heightMap[idx] = Math.max(minN - 1, Math.min(maxN + 1, h));
        }
      }
    }

    // Second pass: Determine blocks and water
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const idx = lz * CHUNK_SIZE + lx;
        const biome = biomeMap[idx];
        const height = heightMap[idx];
        const wx = worldX + lx;
        const wz = worldZ + lz;

        const { block, waterLevel } = this.getTopBlock(biome, height, wx, wz);
        topBlock[idx] = block;
        waterDepth[idx] = waterLevel > 0 ? SEA_LEVEL - height : 0;
      }
    }

    // Generate trees (sparse) - pass topBlock to check for water
    this.generateTrees(chunkX, chunkZ, heightMap, biomeMap, topBlock, trees);

    return { heightMap, biomeMap, topBlock, trees, waterDepth, rightNeighborHeights, frontNeighborHeights };
  }
  
  /**
   * Calculate terrain height - flat with minimal biome-based steps
   * All blocks at SEA_LEVEL so water surface (8/9 height) aligns with adjacent land
   */
  private calculateSmoothHeight(_wx: number, _wz: number, _biome: number): number {
    // Everything at sea level - water blocks are 8/9 height so their surface
    // will be at SEA_LEVEL + 8/9 ≈ 63.889, just below land top at 64
    return SEA_LEVEL;
  }
  
  /**
   * Check if a swamp position should be water using noise
   */
  private isSwampWaterPatch(wx: number, wz: number): boolean {
    if (!this.detailNoise) return false;
    // Use low-frequency noise for smooth, large water patches
    const scale = 0.08; // Larger scale = bigger patches
    const noise = this.detailNoise.sample2D(wx * scale, wz * scale);
    // ~35% water coverage with smooth transitions
    return noise < -0.3;
  }

  /**
   * Check if biome should be mountainous (stone/gravel top)
   */
  private isMountainBiome(biome: number): boolean {
    return (
      biome === BiomeID.windswept_hills || 
      biome === BiomeID.windswept_gravelly_hills ||
      biome === BiomeID.windswept_forest ||
      biome === BiomeID.windswept_savanna ||
      biome === BiomeID.jagged_peaks || 
      biome === BiomeID.stony_peaks ||
      biome === BiomeID.frozen_peaks ||
      biome === BiomeID.snowy_slopes ||
      biome === BiomeID.snowy_mountains ||
      biome === BiomeID.grove ||
      biome === BiomeID.stony_shore ||
      // Catch any biome ID > 100 that might be a mountain variant
      (biome >= 130 && biome <= 165)
    );
  }

  /**
   * Calculate terrain height - smooth continuous terrain
   * Uses noise for natural rolling hills, with slight biome influence
   */
  private calculateHeight(wx: number, wz: number, biome: number): number {
    if (!this.terrainNoise) return SEA_LEVEL;

    // Smooth low-frequency noise for gentle rolling terrain
    const scale = 0.005;
    const noise = this.terrainNoise.sample2D(wx * scale, wz * scale);
    
    // Water biomes are flat at sea level
    if (this.generator?.isOcean(biome) || biome === BiomeID.river || biome === BiomeID.frozen_river) {
      return SEA_LEVEL - 1;
    }
    
    // Base terrain: gentle rolling hills (sea level to sea level + 6)
    let baseHeight = SEA_LEVEL + (noise + 1) * 3;  // 63 to 69
    
    // Small biome influence (adds 0-3 blocks)
    if (this.isMountainBiome(biome)) {
      baseHeight += 3;  // Mountains slightly higher
    } else if (biome === BiomeID.beach || biome === BiomeID.snowy_beach) {
      baseHeight = SEA_LEVEL;  // Beaches flat at sea level
    }
    
    return Math.round(baseHeight);
  }

  /**
   * Get the top block type for a position based on biome
   * With flat terrain, we use biome to determine block type directly
   */
  private getTopBlock(biome: number, _height: number, wx: number, wz: number): { block: BlockType; waterLevel: number } {
    // EXPLICIT ocean check - don't trust isOcean(), check biome IDs directly
    const OCEAN_BIOMES = [
      BiomeID.ocean,
      BiomeID.deep_ocean,
      BiomeID.cold_ocean,
      BiomeID.deep_cold_ocean,
      BiomeID.lukewarm_ocean,
      BiomeID.deep_lukewarm_ocean,
      BiomeID.warm_ocean,
      // Also check numeric IDs in case enum is wrong
      0, 24, 44, 45, 46, 47, 48, 49, 50
    ];
    
    const FROZEN_OCEAN_BIOMES = [
      BiomeID.frozen_ocean,
      BiomeID.deep_frozen_ocean,
      10, 50 // numeric IDs
    ];
    
    // Check frozen ocean first (returns ice)
    if (FROZEN_OCEAN_BIOMES.includes(biome)) {
      return { block: BlockType.Ice, waterLevel: 0 };
    }
    
    // Check all ocean biomes
    if (OCEAN_BIOMES.includes(biome)) {
      return { block: BlockType.Water, waterLevel: 0 };
    }
    
    // Also use isOcean as backup
    if (this.generator?.isOcean(biome)) {
      return { block: BlockType.Water, waterLevel: 0 };
    }
    
    // River biomes
    if (biome === BiomeID.river || biome === 7) {
      return { block: BlockType.Water, waterLevel: 0 };
    }
    if (biome === BiomeID.frozen_river || biome === 11) {
      return { block: BlockType.Ice, waterLevel: 0 };
    }

    // SWAMP special handling - swamps have water mixed with land
    // Use noise-based detection for water patches (same noise as height calculation)
    // Both water and land are at SEA_LEVEL, so water surface is 8/9 block below land top
    if (biome === BiomeID.swamp || biome === BiomeID.mangrove_swamp) {
      if (this.isSwampWaterPatch(wx, wz)) {
        return { block: BlockType.Water, waterLevel: 0 };
      }
      return { block: BlockType.Grass, waterLevel: 0 };
    }
    
    // Land biomes - use correct Minecraft block types
    switch (biome) {
      // Desert - sand texture
      case BiomeID.desert:
        return { block: BlockType.Sand, waterLevel: 0 };
      
      // Badlands - terracotta texture
      case BiomeID.badlands:
      case BiomeID.eroded_badlands:
        return { block: BlockType.Terracotta, waterLevel: 0 };
      case BiomeID.wooded_badlands:
      case BiomeID.wooded_badlands_plateau:
        return { block: BlockType.RedSand, waterLevel: 0 };
      
      // Beach - sand texture
      case BiomeID.beach:
      case BiomeID.snowy_beach:
        return { block: BlockType.Sand, waterLevel: 0 };
      case BiomeID.stony_shore:
        return { block: BlockType.Stone, waterLevel: 0 };
      
      // Snowy biomes - snow texture
      case BiomeID.snowy_plains:
      case BiomeID.snowy_slopes:
      case BiomeID.frozen_peaks:
      case BiomeID.snowy_mountains:
        return { block: BlockType.Snow, waterLevel: 0 };
      case BiomeID.ice_spikes:
        return { block: BlockType.PackedIce, waterLevel: 0 };
      
      // Mountain/stone biomes - stone/gravel texture
      case BiomeID.jagged_peaks:
      case BiomeID.stony_peaks:
        return { block: BlockType.Stone, waterLevel: 0 };
      case BiomeID.windswept_hills:
      case BiomeID.windswept_gravelly_hills:
        return { block: BlockType.Gravel, waterLevel: 0 };
      
      // Taiga biomes - podzol texture (brown forest floor)
      case BiomeID.old_growth_pine_taiga:
      case BiomeID.old_growth_spruce_taiga:
        return { block: BlockType.Podzol, waterLevel: 0 };
      
      // Mushroom island - mycelium texture
      case BiomeID.mushroom_fields:
        return { block: BlockType.Mycelium, waterLevel: 0 };
      
      // ALL grass-based biomes use Grass texture with biome tint:
      // Plains, forests, jungles, swamps, savannas, taigas, etc.
      case BiomeID.plains:
      case BiomeID.sunflower_plains:
      case BiomeID.meadow:
      case BiomeID.forest:
      case BiomeID.birch_forest:
      case BiomeID.flower_forest:
      case BiomeID.old_growth_birch_forest:
      case BiomeID.dark_forest:
      case BiomeID.cherry_grove:
      case BiomeID.taiga:
      case BiomeID.snowy_taiga:
      case BiomeID.grove:
      case BiomeID.jungle:
      case BiomeID.bamboo_jungle:
      case BiomeID.sparse_jungle:
      case BiomeID.savanna:
      case BiomeID.savanna_plateau:
      case BiomeID.windswept_savanna:
      case BiomeID.windswept_forest:
        return { block: BlockType.Grass, waterLevel: 0 };
      
      default:
        return { block: BlockType.Grass, waterLevel: 0 };
    }
  }

  /**
   * Generate trees for a chunk using Pumpkin-style vegetation generation
   * Based on https://github.com/Pumpkin-MC/Pumpkin
   */
  private generateTrees(
    chunkX: number,
    chunkZ: number,
    heightMap: Uint8Array,
    biomeMap: Int16Array,
    topBlock: Uint8Array,  // Use the ACTUAL topBlock values (what rendering uses)
    trees: TreeData[]
  ): void {
    // Deterministic RNG for this chunk
    const rng = new SeededRandom(this.seed ^ (chunkX * 341873128712 + chunkZ * 132897987541));
    
    // Get dominant biome for density calculation
    const centerIdx = (CHUNK_SIZE / 2) * CHUNK_SIZE + (CHUNK_SIZE / 2);
    const dominantBiome = biomeMap[centerIdx];
    const targetTreeCount = getTreeDensity(dominantBiome);
    
    if (targetTreeCount === 0) return;
    
    // Use Poisson-like distribution for natural tree placement
    // Try multiple positions based on density
    const attempts = targetTreeCount * 3;
    let placedCount = 0;
    
    for (let attempt = 0; attempt < attempts && placedCount < targetTreeCount; attempt++) {
      // Random position within chunk (avoiding edges for tree spread)
      const lx = 2 + rng.nextBounded(CHUNK_SIZE - 4);
      const lz = 2 + rng.nextBounded(CHUNK_SIZE - 4);
      
      const idx = lz * CHUNK_SIZE + lx;
      const biome = biomeMap[idx];
      const height = heightMap[idx];
      const actualBlock = topBlock[idx];  // What the terrain ACTUALLY renders as
      
      // Skip water and ice blocks
      if (actualBlock === BlockType.Water || actualBlock === BlockType.Ice) {
        continue;
      }
      
      // Skip if below sea level (extra safety)
      if (height < SEA_LEVEL) continue;
      
      // Skip beaches and shores (at water's edge)
      if (biome === BiomeID.beach || biome === BiomeID.snowy_beach || biome === BiomeID.stony_shore) continue;
      
      // Check if this biome supports trees
      const treeType = getTreeTypeForBiome(biome, rng);
      if (treeType === null) continue;
      
      // Check minimum distance from other trees (prevents overlap)
      const minDistance = treeType === TreeType.Jungle ? 4 : 3;
      let tooClose = false;
      for (const existing of trees) {
        const dx = existing.x - lx;
        const dz = existing.z - lz;
        if (dx * dx + dz * dz < minDistance * minDistance) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      
      // Generate the full tree structure
      const generatedTree = generateTree(treeType, rng);
      
      trees.push({
        x: lx,
        z: lz,
        type: treeType,
        height: generatedTree.trunkHeight,
        blocks: generatedTree.blocks,
      });
      
      placedCount++;
    }
  }

  /**
   * Check if a biome is a water biome (ocean, river, etc.)
   */
  private isWaterBiome(biome: number): boolean {
    switch (biome) {
      case BiomeID.ocean:
      case BiomeID.deep_ocean:
      case BiomeID.cold_ocean:
      case BiomeID.deep_cold_ocean:
      case BiomeID.frozen_ocean:
      case BiomeID.deep_frozen_ocean:
      case BiomeID.lukewarm_ocean:
      case BiomeID.deep_lukewarm_ocean:
      case BiomeID.warm_ocean:
      case BiomeID.river:
      case BiomeID.frozen_river:
        return true;
      default:
        return false;
    }
  }

  /**
   * Simple position hash
   */
  private hashPosition(x: number, z: number): number {
    let hash = this.seed;
    hash ^= x * 374761393;
    hash ^= z * 668265263;
    hash ^= (hash >> 13);
    hash *= 1274126177;
    return hash >>> 0;
  }

  /**
   * Get biome at world position
   */
  getBiomeAt(wx: number, wz: number): number {
    if (!this.generator) return BiomeID.plains;
    return this.generator.getBiomeAt(1, wx, 63, wz);
  }

  /**
   * Get terrain height at world position
   */
  getHeightAt(wx: number, wz: number): number {
    const biome = this.getBiomeAt(wx, wz);
    return this.calculateHeight(wx, wz, biome);
  }

  /**
   * Get biome color from cubiomes
   */
  getBiomeColor(biome: number): [number, number, number] {
    if (!this.generator) return [128, 128, 128];
    return this.generator.getBiomeColor(biome);
  }

  /**
   * Get grass color for biome
   */
  getGrassColor(biome: number): [number, number, number] {
    if (!this.generator) return [124, 189, 80];
    return this.generator.getBiomeGrassColor(biome);
  }

  getSeed(): number {
    return this.seed;
  }

  /**
   * Get biome name
   */
  getBiomeName(biome: number): string {
    if (!this.generator) return 'Unknown';
    return this.generator.getBiomeName(biome);
  }

  /**
   * Check if biome is ocean
   */
  isOcean(biome: number): boolean {
    if (!this.generator) return false;
    return this.generator.isOcean(biome);
  }
}

/**
 * Create an initialized chunk generator
 */
export async function createChunkGenerator(seed: number): Promise<ChunkGenerator> {
  const generator = new ChunkGenerator(seed);
  await generator.init();
  return generator;
}

/**
 * Terrain Debugger - Systematic testing for terrain generation
 * 
 * This module helps diagnose issues with:
 * 1. Biome ID mapping from cubiomes
 * 2. Height calculations
 * 3. Top block assignments
 * 4. Rendering layer calculations
 */

import { ChunkGenerator, CHUNK_SIZE, BlockType, BLOCK_COLORS } from '../world/ChunkGenerator';

// Known biome names for debugging
const BIOME_NAMES: Record<number, string> = {
  0: 'ocean',
  1: 'plains',
  2: 'desert',
  3: 'windswept_hills',
  4: 'forest',
  5: 'taiga',
  6: 'swamp',
  7: 'river',
  10: 'frozen_ocean',
  11: 'frozen_river',
  12: 'snowy_plains',
  14: 'mushroom_fields',
  16: 'beach',
  21: 'jungle',
  24: 'deep_ocean',
  25: 'stony_shore',
  26: 'snowy_beach',
  27: 'birch_forest',
  29: 'dark_forest',
  30: 'snowy_taiga',
  35: 'savanna',
  37: 'badlands',
  44: 'warm_ocean',
  45: 'lukewarm_ocean',
  46: 'cold_ocean',
  129: 'sunflower_plains',
  131: 'windswept_gravelly_hills',
  132: 'flower_forest',
  140: 'ice_spikes',
  177: 'meadow',
  178: 'grove',
  179: 'snowy_slopes',
  180: 'frozen_peaks',
  181: 'jagged_peaks',
  182: 'stony_peaks',
};

const BLOCK_NAMES: Record<BlockType, string> = {
  [BlockType.Air]: 'Air',
  [BlockType.Stone]: 'Stone',
  [BlockType.Dirt]: 'Dirt',
  [BlockType.Grass]: 'Grass',
  [BlockType.Sand]: 'Sand',
  [BlockType.Gravel]: 'Gravel',
  [BlockType.Water]: 'Water',
  [BlockType.Ice]: 'Ice',
  [BlockType.Snow]: 'Snow',
  [BlockType.SnowBlock]: 'SnowBlock',
  [BlockType.Clay]: 'Clay',
  [BlockType.Bedrock]: 'Bedrock',
  [BlockType.OakLog]: 'OakLog',
  [BlockType.BirchLog]: 'BirchLog',
  [BlockType.SpruceLog]: 'SpruceLog',
  [BlockType.JungleLog]: 'JungleLog',
  [BlockType.CherryLog]: 'CherryLog',
  [BlockType.MangroveLog]: 'MangroveLog',
  [BlockType.OakLeaves]: 'OakLeaves',
  [BlockType.BirchLeaves]: 'BirchLeaves',
  [BlockType.SpruceLeaves]: 'SpruceLeaves',
  [BlockType.JungleLeaves]: 'JungleLeaves',
  [BlockType.CherryLeaves]: 'CherryLeaves',
  [BlockType.MangroveLeaves]: 'MangroveLeaves',
  [BlockType.Cactus]: 'Cactus',
  [BlockType.DeadBush]: 'DeadBush',
  [BlockType.TallGrass]: 'TallGrass',
  [BlockType.Fern]: 'Fern',
  [BlockType.Flower]: 'Flower',
  [BlockType.Mushroom]: 'Mushroom',
  [BlockType.Podzol]: 'Podzol',
  [BlockType.Mycelium]: 'Mycelium',
  [BlockType.RedSand]: 'RedSand',
  [BlockType.Terracotta]: 'Terracotta',
  [BlockType.PackedIce]: 'PackedIce',
  [BlockType.BlueIce]: 'BlueIce',
  [BlockType.Coral]: 'Coral',
  [BlockType.Seagrass]: 'Seagrass',
};

export interface TerrainDiagnostics {
  chunkX: number;
  chunkZ: number;
  biomeDistribution: Map<number, number>;
  blockDistribution: Map<BlockType, number>;
  heightRange: { min: number; max: number; avg: number };
  unknownBiomes: number[];
  issues: string[];
}

export class TerrainDebugger {
  private generator: ChunkGenerator;

  constructor(generator: ChunkGenerator) {
    this.generator = generator;
  }

  /**
   * Analyze a single chunk and return diagnostics
   */
  analyzeChunk(chunkX: number, chunkZ: number): TerrainDiagnostics {
    const data = this.generator.generateChunk(chunkX, chunkZ);
    
    const biomeDistribution = new Map<number, number>();
    const blockDistribution = new Map<BlockType, number>();
    const unknownBiomes: number[] = [];
    const issues: string[] = [];
    
    let minHeight = 255;
    let maxHeight = 0;
    let totalHeight = 0;

    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
      const biome = data.biomeMap[i];
      const block = data.topBlock[i] as BlockType;
      const height = data.heightMap[i];

      // Count biomes
      biomeDistribution.set(biome, (biomeDistribution.get(biome) || 0) + 1);
      
      // Track unknown biomes
      if (!BIOME_NAMES[biome] && !unknownBiomes.includes(biome)) {
        unknownBiomes.push(biome);
      }

      // Count blocks
      blockDistribution.set(block, (blockDistribution.get(block) || 0) + 1);

      // Track heights
      minHeight = Math.min(minHeight, height);
      maxHeight = Math.max(maxHeight, height);
      totalHeight += height;

      // Check for potential issues
      if (block === BlockType.Dirt && height >= 63) {
        // Dirt on surface above water - might be wrong
        const biomeName = BIOME_NAMES[biome] || `unknown(${biome})`;
        if (!issues.includes(`Dirt surface in ${biomeName}`)) {
          issues.push(`Dirt surface in ${biomeName} at height ${height}`);
        }
      }
    }

    return {
      chunkX,
      chunkZ,
      biomeDistribution,
      blockDistribution,
      heightRange: {
        min: minHeight,
        max: maxHeight,
        avg: totalHeight / (CHUNK_SIZE * CHUNK_SIZE),
      },
      unknownBiomes,
      issues,
    };
  }

  /**
   * Print diagnostics to console
   */
  printDiagnostics(diag: TerrainDiagnostics): void {
    console.log(`\n===== CHUNK (${diag.chunkX}, ${diag.chunkZ}) DIAGNOSTICS =====`);
    
    console.log('\n📊 Biome Distribution:');
    const sortedBiomes = Array.from(diag.biomeDistribution.entries())
      .sort((a, b) => b[1] - a[1]);
    for (const [biome, count] of sortedBiomes) {
      const name = BIOME_NAMES[biome] || `UNKNOWN(${biome})`;
      const percent = ((count / 256) * 100).toFixed(1);
      console.log(`  ${name}: ${count} blocks (${percent}%)`);
    }

    console.log('\n🧱 Block Distribution:');
    const sortedBlocks = Array.from(diag.blockDistribution.entries())
      .sort((a, b) => b[1] - a[1]);
    for (const [block, count] of sortedBlocks) {
      const name = BLOCK_NAMES[block] || `UNKNOWN(${block})`;
      const percent = ((count / 256) * 100).toFixed(1);
      const color = BLOCK_COLORS[block];
      console.log(`  ${name}: ${count} blocks (${percent}%) - RGB(${color?.join(', ') || 'N/A'})`);
    }

    console.log('\n📏 Height Range:');
    console.log(`  Min: ${diag.heightRange.min}`);
    console.log(`  Max: ${diag.heightRange.max}`);
    console.log(`  Avg: ${diag.heightRange.avg.toFixed(1)}`);

    if (diag.unknownBiomes.length > 0) {
      console.log('\n⚠️ Unknown Biome IDs:', diag.unknownBiomes);
    }

    if (diag.issues.length > 0) {
      console.log('\n❌ Potential Issues:');
      for (const issue of diag.issues) {
        console.log(`  - ${issue}`);
      }
    }

    console.log('\n' + '='.repeat(50));
  }

  /**
   * Analyze multiple chunks around origin
   */
  analyzeArea(radius: number = 3): TerrainDiagnostics[] {
    const results: TerrainDiagnostics[] = [];
    
    for (let cz = -radius; cz <= radius; cz++) {
      for (let cx = -radius; cx <= radius; cx++) {
        results.push(this.analyzeChunk(cx, cz));
      }
    }

    return results;
  }

  /**
   * Generate summary of all diagnostics
   */
  generateSummary(diagnostics: TerrainDiagnostics[]): void {
    console.log('\n🌍 TERRAIN ANALYSIS SUMMARY');
    console.log('='.repeat(50));

    const allBiomes = new Map<number, number>();
    const allBlocks = new Map<BlockType, number>();
    const allUnknown = new Set<number>();
    const allIssues = new Set<string>();

    for (const diag of diagnostics) {
      for (const [biome, count] of diag.biomeDistribution) {
        allBiomes.set(biome, (allBiomes.get(biome) || 0) + count);
      }
      for (const [block, count] of diag.blockDistribution) {
        allBlocks.set(block, (allBlocks.get(block) || 0) + count);
      }
      for (const biome of diag.unknownBiomes) {
        allUnknown.add(biome);
      }
      for (const issue of diag.issues) {
        allIssues.add(issue);
      }
    }

    const totalBlocks = diagnostics.length * 256;

    console.log(`\nAnalyzed ${diagnostics.length} chunks (${totalBlocks} blocks)`);

    console.log('\n📊 Overall Biome Distribution:');
    const sortedBiomes = Array.from(allBiomes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [biome, count] of sortedBiomes) {
      const name = BIOME_NAMES[biome] || `UNKNOWN(${biome})`;
      const percent = ((count / totalBlocks) * 100).toFixed(1);
      console.log(`  ${name}: ${percent}%`);
    }

    console.log('\n🧱 Overall Block Distribution:');
    const sortedBlocks = Array.from(allBlocks.entries())
      .sort((a, b) => b[1] - a[1]);
    for (const [block, count] of sortedBlocks) {
      const name = BLOCK_NAMES[block] || `UNKNOWN(${block})`;
      const percent = ((count / totalBlocks) * 100).toFixed(1);
      console.log(`  ${name}: ${percent}%`);
    }

    if (allUnknown.size > 0) {
      console.log('\n⚠️ All Unknown Biome IDs:', Array.from(allUnknown).sort((a, b) => a - b));
    }

    if (allIssues.size > 0) {
      console.log('\n❌ All Issues Found:');
      for (const issue of allIssues) {
        console.log(`  - ${issue}`);
      }
    }
  }
}

// Export for use in browser console
export function createDebugger(generator: ChunkGenerator): TerrainDebugger {
  return new TerrainDebugger(generator);
}


/**
 * Tree Generator - Inspired by Pumpkin MC's vegetation generation
 * https://github.com/Pumpkin-MC/Pumpkin
 * 
 * Generates tree structure data for isometric rendering
 */

import { SeededRandom } from '../../cubiomes/noise';
import { TreeType, BiomeID } from '../types';

// ============ Tree Shape Data ============

export interface TreeBlock {
  dx: number;  // Offset from tree origin X
  dy: number;  // Height offset (Y)
  dz: number;  // Offset from tree origin Z
  type: 'log' | 'leaves' | 'cactus';
}

export interface GeneratedTree {
  type: TreeType;
  blocks: TreeBlock[];
  trunkHeight: number;
  foliageRadius: number;
}

// ============ Trunk Placers (Pumpkin-style) ============

interface TrunkConfig {
  baseHeight: number;
  heightRandA: number;
  heightRandB: number;
}

const TRUNK_CONFIGS: Record<TreeType, TrunkConfig> = {
  [TreeType.Oak]:     { baseHeight: 4, heightRandA: 2, heightRandB: 0 },
  [TreeType.Birch]:   { baseHeight: 5, heightRandA: 2, heightRandB: 0 },
  [TreeType.Spruce]:  { baseHeight: 5, heightRandA: 2, heightRandB: 3 },
  [TreeType.Jungle]:  { baseHeight: 4, heightRandA: 8, heightRandB: 0 },
  [TreeType.Acacia]:  { baseHeight: 5, heightRandA: 2, heightRandB: 0 },
  [TreeType.DarkOak]: { baseHeight: 6, heightRandA: 2, heightRandB: 0 },
  [TreeType.Cherry]:  { baseHeight: 4, heightRandA: 3, heightRandB: 0 },
  [TreeType.Mangrove]:{ baseHeight: 5, heightRandA: 3, heightRandB: 0 },
  [TreeType.Cactus]:  { baseHeight: 1, heightRandA: 2, heightRandB: 0 },
};

function getTrunkHeight(type: TreeType, random: SeededRandom): number {
  const config = TRUNK_CONFIGS[type];
  return config.baseHeight 
    + random.nextBounded(config.heightRandA + 1)
    + random.nextBounded(config.heightRandB + 1);
}

// ============ Foliage Placers ============

/**
 * Blob foliage - spherical shape for Oak, Birch, etc.
 * Based on Pumpkin's BlobFoliagePlacer
 */
function generateBlobFoliage(
  blocks: TreeBlock[],
  centerY: number,
  foliageHeight: number,
  radius: number,
  random: SeededRandom
): void {
  for (let y = 0; y <= foliageHeight; y++) {
    // Radius decreases towards top and bottom
    const layerRadius = Math.max(0, radius - Math.floor(y / 2));
    
    for (let dx = -layerRadius; dx <= layerRadius; dx++) {
      for (let dz = -layerRadius; dz <= layerRadius; dz++) {
        // Skip corners randomly for natural look (Pumpkin's LeaveValidator)
        if (Math.abs(dx) === layerRadius && Math.abs(dz) === layerRadius) {
          if (random.nextBounded(2) === 0 || y === 0) continue;
        }
        
        blocks.push({
          dx,
          dy: centerY - y,
          dz,
          type: 'leaves'
        });
      }
    }
  }
}

/**
 * Spruce/Pine foliage - conical shape
 * Based on Pumpkin's SpruceFoliagePlacer
 */
function generateSpruceFoliage(
  blocks: TreeBlock[],
  centerY: number,
  foliageHeight: number,
  maxRadius: number,
  random: SeededRandom
): void {
  let radius = random.nextBounded(2);
  let max = 1;
  let next = 0;
  
  for (let y = 0; y < foliageHeight; y++) {
    const currentY = centerY - y;
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        // Skip corners for spruce (creates + shape at edges)
        if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius > 0) {
          continue;
        }
        
        blocks.push({
          dx,
          dy: currentY,
          dz,
          type: 'leaves'
        });
      }
    }
    
    // Increase radius as we go down, with periodic resets
    if (radius >= max) {
      radius = next;
      next = 1;
      max = Math.min(maxRadius, max + 1);
    } else {
      radius++;
    }
  }
}

/**
 * Acacia foliage - flat umbrella shape
 */
function generateAcaciaFoliage(
  blocks: TreeBlock[],
  centerY: number,
  random: SeededRandom
): void {
  // Acacia has a flat canopy
  const radius = 2 + random.nextBounded(2);
  
  // Top layer (small)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      blocks.push({ dx, dy: centerY, dz, type: 'leaves' });
    }
  }
  
  // Main canopy layer
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      // Create circular shape
      if (dx * dx + dz * dz <= radius * radius + 1) {
        if (random.nextFloat() > 0.1) {  // Small gaps
          blocks.push({ dx, dy: centerY - 1, dz, type: 'leaves' });
        }
      }
    }
  }
}

/**
 * Dark Oak foliage - thick blob shape
 */
function generateDarkOakFoliage(
  blocks: TreeBlock[],
  centerY: number,
  _random: SeededRandom
): void {
  // Dark oak has a thick, wide canopy
  for (let y = 0; y < 3; y++) {
    const radius = y === 1 ? 3 : 2;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
        blocks.push({ dx, dy: centerY - y, dz, type: 'leaves' });
      }
    }
  }
}

/**
 * Cherry foliage - fluffy cloud-like shape
 */
function generateCherryFoliage(
  blocks: TreeBlock[],
  centerY: number,
  random: SeededRandom
): void {
  // Cherry has multiple overlapping spheres
  const clusters = [
    { dx: 0, dy: 0, dz: 0, r: 2 },
    { dx: -2, dy: -1, dz: 0, r: 2 },
    { dx: 2, dy: -1, dz: 0, r: 2 },
    { dx: 0, dy: -1, dz: -2, r: 2 },
    { dx: 0, dy: -1, dz: 2, r: 2 },
  ];
  
  for (const cluster of clusters) {
    for (let dx = -cluster.r; dx <= cluster.r; dx++) {
      for (let dz = -cluster.r; dz <= cluster.r; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx * dx + dz * dz + dy * dy <= cluster.r * cluster.r + 1) {
            if (random.nextFloat() > 0.15) {
              blocks.push({
                dx: cluster.dx + dx,
                dy: centerY + cluster.dy + dy,
                dz: cluster.dz + dz,
                type: 'leaves'
              });
            }
          }
        }
      }
    }
  }
}

/**
 * Jungle foliage - large blob with vines
 */
function generateJungleFoliage(
  blocks: TreeBlock[],
  centerY: number,
  random: SeededRandom
): void {
  // Large spherical canopy
  const radius = 3;
  for (let y = 0; y < 4; y++) {
    const layerRadius = y === 0 || y === 3 ? radius - 1 : radius;
    
    for (let dx = -layerRadius; dx <= layerRadius; dx++) {
      for (let dz = -layerRadius; dz <= layerRadius; dz++) {
        if (Math.abs(dx) === layerRadius && Math.abs(dz) === layerRadius) {
          if (random.nextBounded(2) === 0) continue;
        }
        blocks.push({ dx, dy: centerY - y, dz, type: 'leaves' });
      }
    }
  }
}

// ============ Block Deduplication ============

/**
 * Remove duplicate blocks at the same position
 * Logs take priority over leaves at same position
 */
function deduplicateBlocks(blocks: TreeBlock[]): TreeBlock[] {
  const seen = new Map<string, TreeBlock>();
  
  for (const block of blocks) {
    const key = `${block.dx},${block.dy},${block.dz}`;
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, block);
    } else {
      // Logs and cactus take priority over leaves
      if (block.type === 'log' || block.type === 'cactus') {
        seen.set(key, block);
      }
      // Otherwise keep the existing block (first one placed)
    }
  }
  
  return Array.from(seen.values());
}

// ============ Main Tree Generator ============

export function generateTree(type: TreeType, random: SeededRandom): GeneratedTree {
  const blocks: TreeBlock[] = [];
  
  // Special case: Cactus
  if (type === TreeType.Cactus) {
    const height = getTrunkHeight(type, random);
    for (let y = 0; y < height; y++) {
      blocks.push({ dx: 0, dy: y, dz: 0, type: 'cactus' });
    }
    return { type, blocks: deduplicateBlocks(blocks), trunkHeight: height, foliageRadius: 0 };
  }
  
  // Generate trunk
  const trunkHeight = getTrunkHeight(type, random);
  
  // For some trees, trunk is thicker
  const isThickTrunk = type === TreeType.DarkOak || type === TreeType.Jungle;
  
  if (isThickTrunk) {
    // 2x2 trunk
    for (let y = 0; y < trunkHeight; y++) {
      blocks.push({ dx: 0, dy: y, dz: 0, type: 'log' });
      blocks.push({ dx: 1, dy: y, dz: 0, type: 'log' });
      blocks.push({ dx: 0, dy: y, dz: 1, type: 'log' });
      blocks.push({ dx: 1, dy: y, dz: 1, type: 'log' });
    }
  } else if (type === TreeType.Acacia) {
    // Acacia has a bent trunk
    for (let y = 0; y < trunkHeight - 2; y++) {
      blocks.push({ dx: 0, dy: y, dz: 0, type: 'log' });
    }
    // Diagonal bend
    const bendDir = random.nextBounded(4);
    const dx = bendDir === 0 ? 1 : bendDir === 1 ? -1 : 0;
    const dz = bendDir === 2 ? 1 : bendDir === 3 ? -1 : 0;
    blocks.push({ dx, dy: trunkHeight - 2, dz, type: 'log' });
    blocks.push({ dx: dx * 2, dy: trunkHeight - 1, dz: dz * 2, type: 'log' });
  } else {
    // Standard straight trunk
    for (let y = 0; y < trunkHeight; y++) {
      blocks.push({ dx: 0, dy: y, dz: 0, type: 'log' });
    }
  }
  
  // Generate foliage based on tree type
  const foliageTopY = trunkHeight + 1;
  let foliageRadius = 2;
  
  switch (type) {
    case TreeType.Oak:
    case TreeType.Birch:
      foliageRadius = 2;
      generateBlobFoliage(blocks, foliageTopY, 3, foliageRadius, random);
      break;
      
    case TreeType.Spruce:
      foliageRadius = 2;
      const spruceHeight = Math.max(4, trunkHeight - 2);
      generateSpruceFoliage(blocks, foliageTopY, spruceHeight, foliageRadius, random);
      break;
      
    case TreeType.Jungle:
      foliageRadius = 3;
      generateJungleFoliage(blocks, foliageTopY, random);
      break;
      
    case TreeType.Acacia:
      foliageRadius = 3;
      generateAcaciaFoliage(blocks, foliageTopY - 1, random);
      break;
      
    case TreeType.DarkOak:
      foliageRadius = 3;
      generateDarkOakFoliage(blocks, foliageTopY, random);
      break;
      
    case TreeType.Cherry:
      foliageRadius = 4;
      generateCherryFoliage(blocks, foliageTopY, random);
      break;
      
    case TreeType.Mangrove:
      foliageRadius = 3;
      generateBlobFoliage(blocks, foliageTopY, 4, foliageRadius, random);
      // Add prop roots
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const rx = Math.round(Math.cos(angle) * 1.5);
        const rz = Math.round(Math.sin(angle) * 1.5);
        if (rx !== 0 || rz !== 0) {
          blocks.push({ dx: rx, dy: 0, dz: rz, type: 'log' });
          blocks.push({ dx: rx, dy: 1, dz: rz, type: 'log' });
        }
      }
      break;
  }
  
  // Deduplicate blocks to prevent overlapping
  return { type, blocks: deduplicateBlocks(blocks), trunkHeight, foliageRadius };
}

// ============ Biome-based Tree Selection ============

export function getTreeTypeForBiome(biome: number, random: SeededRandom): TreeType | null {
  switch (biome) {
    case BiomeID.forest:
    case BiomeID.flower_forest:
    case BiomeID.plains:
    case BiomeID.meadow:
    case BiomeID.sunflower_plains:
      return random.nextFloat() < 0.8 ? TreeType.Oak : TreeType.Birch;
    
    case BiomeID.birch_forest:
    case BiomeID.old_growth_birch_forest:
      return TreeType.Birch;
    
    case BiomeID.dark_forest:
    case BiomeID.pale_garden:
      return random.nextFloat() < 0.7 ? TreeType.DarkOak : TreeType.Oak;
    
    case BiomeID.taiga:
    case BiomeID.snowy_taiga:
    case BiomeID.old_growth_pine_taiga:
    case BiomeID.old_growth_spruce_taiga:
    case BiomeID.grove:
    case BiomeID.windswept_forest:
      return TreeType.Spruce;
    
    case BiomeID.jungle:
    case BiomeID.bamboo_jungle:
    case BiomeID.sparse_jungle:
      return random.nextFloat() < 0.3 ? TreeType.Jungle : TreeType.Oak;
    
    case BiomeID.savanna:
    case BiomeID.savanna_plateau:
    case BiomeID.windswept_savanna:
      return TreeType.Acacia;
    
    case BiomeID.cherry_grove:
      return TreeType.Cherry;
    
    case BiomeID.swamp:
      return TreeType.Oak;  // Swamp oak (should have vines later)
    
    case BiomeID.mangrove_swamp:
      return TreeType.Mangrove;
    
    case BiomeID.desert:
      return TreeType.Cactus;
    
    case BiomeID.wooded_badlands:
      return TreeType.Oak;
    
    default:
      return null;
  }
}

/**
 * Get tree density for a biome (trees per chunk)
 * Returns approximate tree count for 16x16 chunk
 */
export function getTreeDensity(biome: number): number {
  switch (biome) {
    case BiomeID.forest:
    case BiomeID.flower_forest:
    case BiomeID.birch_forest:
    case BiomeID.dark_forest:
      return 8;  // Dense forest
    
    case BiomeID.jungle:
    case BiomeID.bamboo_jungle:
      return 12;  // Very dense
    
    case BiomeID.taiga:
    case BiomeID.snowy_taiga:
    case BiomeID.old_growth_pine_taiga:
    case BiomeID.old_growth_spruce_taiga:
      return 6;
    
    case BiomeID.plains:
    case BiomeID.meadow:
    case BiomeID.sunflower_plains:
      return 1;  // Occasional tree
    
    case BiomeID.savanna:
    case BiomeID.savanna_plateau:
      return 2;  // Sparse
    
    case BiomeID.desert:
      return 2;  // Cacti
    
    case BiomeID.swamp:
    case BiomeID.mangrove_swamp:
      return 4;
    
    case BiomeID.cherry_grove:
      return 5;
    
    case BiomeID.grove:
    case BiomeID.windswept_forest:
      return 4;
    
    default:
      return 0;
  }
}


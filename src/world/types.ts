/**
 * Shared types for world generation
 * Extracted to avoid circular dependencies
 */

export const CHUNK_SIZE = 16;  // Minecraft chunk size
export const BLOCK_SIZE = 16;  // Pixels per block for rendering
export const MAX_HEIGHT = 128; // Max world height
export const SEA_LEVEL = 63;

// Biome IDs from cubiomes (matching biomes.h)
export const BiomeID = {
  ocean: 0,
  plains: 1,
  desert: 2,
  windswept_hills: 3,
  forest: 4,
  taiga: 5,
  swamp: 6,
  river: 7,
  nether_wastes: 8,
  the_end: 9,
  frozen_ocean: 10,
  frozen_river: 11,
  snowy_plains: 12,
  snowy_mountains: 13,
  mushroom_fields: 14,
  mushroom_field_shore: 15,
  beach: 16,
  desert_hills: 17,
  wooded_hills: 18,
  taiga_hills: 19,
  mountain_edge: 20,
  jungle: 21,
  jungle_hills: 22,
  sparse_jungle: 23,
  deep_ocean: 24,
  stony_shore: 25,
  snowy_beach: 26,
  birch_forest: 27,
  birch_forest_hills: 28,
  dark_forest: 29,
  snowy_taiga: 30,
  snowy_taiga_hills: 31,
  old_growth_pine_taiga: 32,
  giant_tree_taiga_hills: 33,
  windswept_forest: 34,
  savanna: 35,
  savanna_plateau: 36,
  badlands: 37,
  wooded_badlands: 38,
  wooded_badlands_plateau: 39,
  eroded_badlands: 40,
  warm_ocean: 44,
  lukewarm_ocean: 45,
  cold_ocean: 46,
  deep_warm_ocean: 47,
  deep_lukewarm_ocean: 48,
  deep_cold_ocean: 49,
  deep_frozen_ocean: 50,
  sunflower_plains: 129,
  flower_forest: 132,
  ice_spikes: 140,
  old_growth_birch_forest: 155,
  old_growth_spruce_taiga: 160,
  windswept_savanna: 163,
  windswept_gravelly_hills: 131,
  bamboo_jungle: 168,
  soul_sand_valley: 170,
  crimson_forest: 171,
  warped_forest: 172,
  basalt_deltas: 173,
  dripstone_caves: 174,
  lush_caves: 175,
  meadow: 177,
  grove: 178,
  snowy_slopes: 179,
  frozen_peaks: 180,
  jagged_peaks: 181,
  stony_peaks: 182,
  cherry_grove: 183,
  pale_garden: 184,
  mangrove_swamp: 175,
} as const;

export type BiomeIDType = typeof BiomeID[keyof typeof BiomeID];

// Tree types
export enum TreeType {
  Oak = 0,
  Birch,
  Spruce,
  Jungle,
  Acacia,
  DarkOak,
  Cherry,
  Mangrove,
  Cactus,
}

// Forward declaration - actual values set after BlockType is defined
export let TreeTypeToLogBlockType: Record<TreeType, number>;
export let TreeTypeToLeavesBlockType: Record<TreeType, number>;

// Block types
export enum BlockType {
  Air = 0,
  Stone,
  Dirt,
  Grass,
  Sand,
  Gravel,
  Water,
  Ice,
  Snow,
  SnowBlock,
  Clay,
  Bedrock,
  OakLog,
  BirchLog,
  SpruceLog,
  JungleLog,
  AcaciaLog,
  DarkOakLog,
  CherryLog,
  MangroveLog,
  OakLeaves,
  BirchLeaves,
  SpruceLeaves,
  JungleLeaves,
  AcaciaLeaves,
  DarkOakLeaves,
  CherryLeaves,
  MangroveLeaves,
  Cactus,
  CactusTop,
  DeadBush,
  TallGrass,
  Fern,
  Podzol,
  Mycelium,
  PackedIce,
  BlueIce,
  RedSand,
  Terracotta,
  Coral,
  Seagrass,
  // Saplings (dropped from leaves)
  OakSapling,
  BirchSapling,
  SpruceSapling,
  JungleSapling,
  AcaciaSapling,
  DarkOakSapling,
  CherrySapling,
  MangroveSapling,
  
  // Wood Planks
  OakPlanks,
  BirchPlanks,
  SprucePlanks,
  JunglePlanks,
  AcaciaPlanks,
  DarkOakPlanks,
  CherryPlanks,
  MangrovePlanks,
  
  // Stripped Logs
  StrippedOakLog,
  StrippedBirchLog,
  StrippedSpruceLog,
  StrippedJungleLog,
  StrippedAcaciaLog,
  StrippedDarkOakLog,
  StrippedCherryLog,
  StrippedMangroveLog,
  
  // Doors
  OakDoor,
  BirchDoor,
  SpruceDoor,
  JungleDoor,
  AcaciaDoor,
  DarkOakDoor,
  CherryDoor,
  MangroveDoor,
  
  // Trapdoors
  OakTrapdoor,
  BirchTrapdoor,
  SpruceTrapdoor,
  JungleTrapdoor,
  AcaciaTrapdoor,
  DarkOakTrapdoor,
  CherryTrapdoor,
  MangroveTrapdoor,
}

// Initialize tree type to block type mappings
TreeTypeToLogBlockType = {
  [TreeType.Oak]: BlockType.OakLog,
  [TreeType.Birch]: BlockType.BirchLog,
  [TreeType.Spruce]: BlockType.SpruceLog,
  [TreeType.Jungle]: BlockType.JungleLog,
  [TreeType.Acacia]: BlockType.AcaciaLog,
  [TreeType.DarkOak]: BlockType.DarkOakLog,
  [TreeType.Cherry]: BlockType.CherryLog,
  [TreeType.Mangrove]: BlockType.MangroveLog,
  [TreeType.Cactus]: BlockType.Cactus,
};

TreeTypeToLeavesBlockType = {
  [TreeType.Oak]: BlockType.OakLeaves,
  [TreeType.Birch]: BlockType.BirchLeaves,
  [TreeType.Spruce]: BlockType.SpruceLeaves,
  [TreeType.Jungle]: BlockType.JungleLeaves,
  [TreeType.Acacia]: BlockType.AcaciaLeaves,
  [TreeType.DarkOak]: BlockType.DarkOakLeaves,
  [TreeType.Cherry]: BlockType.CherryLeaves,
  [TreeType.Mangrove]: BlockType.MangroveLeaves,
  [TreeType.Cactus]: BlockType.Air, // Cacti don't have leaves
};

// Map from leaf type to corresponding sapling type
export const LeavesToSaplingBlockType: Partial<Record<BlockType, BlockType>> = {
  [BlockType.OakLeaves]: BlockType.OakSapling,
  [BlockType.BirchLeaves]: BlockType.BirchSapling,
  [BlockType.SpruceLeaves]: BlockType.SpruceSapling,
  [BlockType.JungleLeaves]: BlockType.JungleSapling,
  [BlockType.AcaciaLeaves]: BlockType.AcaciaSapling,
  [BlockType.DarkOakLeaves]: BlockType.DarkOakSapling,
  [BlockType.CherryLeaves]: BlockType.CherrySapling,
  [BlockType.MangroveLeaves]: BlockType.MangroveSapling,
};

// Sapling drop chances (Minecraft: 5% for most, 2.5% for jungle)
export const SAPLING_DROP_CHANCE: Partial<Record<BlockType, number>> = {
  [BlockType.OakLeaves]: 0.05,      // 5%
  [BlockType.BirchLeaves]: 0.05,    // 5%
  [BlockType.SpruceLeaves]: 0.05,   // 5%
  [BlockType.JungleLeaves]: 0.025,  // 2.5%
  [BlockType.AcaciaLeaves]: 0.05,   // 5%
  [BlockType.DarkOakLeaves]: 0.05,  // 5%
  [BlockType.CherryLeaves]: 0.05,   // 5%
  [BlockType.MangroveLeaves]: 0.05, // 5%
};


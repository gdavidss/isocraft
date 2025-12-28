/**
 * Minecraft Biome IDs and utilities
 * Port of cubiomes biomes.h
 */

// Biome IDs matching Minecraft 1.18+
export enum BiomeID {
  none = -1,
  // 0-9
  ocean = 0,
  plains = 1,
  desert = 2,
  windswept_hills = 3,
  forest = 4,
  taiga = 5,
  swamp = 6,
  river = 7,
  nether_wastes = 8,
  the_end = 9,
  // 10-19
  frozen_ocean = 10,
  frozen_river = 11,
  snowy_plains = 12,
  snowy_mountains = 13,
  mushroom_fields = 14,
  mushroom_field_shore = 15,
  beach = 16,
  desert_hills = 17,
  wooded_hills = 18,
  taiga_hills = 19,
  // 20-29
  mountain_edge = 20,
  jungle = 21,
  jungle_hills = 22,
  sparse_jungle = 23,
  deep_ocean = 24,
  stony_shore = 25,
  snowy_beach = 26,
  birch_forest = 27,
  birch_forest_hills = 28,
  dark_forest = 29,
  // 30-39
  snowy_taiga = 30,
  snowy_taiga_hills = 31,
  old_growth_pine_taiga = 32,
  old_growth_pine_taiga_hills = 33,
  windswept_forest = 34,
  savanna = 35,
  savanna_plateau = 36,
  badlands = 37,
  wooded_badlands = 38,
  badlands_plateau = 39,
  // 40-50
  small_end_islands = 40,
  end_midlands = 41,
  end_highlands = 42,
  end_barrens = 43,
  warm_ocean = 44,
  lukewarm_ocean = 45,
  cold_ocean = 46,
  deep_warm_ocean = 47,
  deep_lukewarm_ocean = 48,
  deep_cold_ocean = 49,
  deep_frozen_ocean = 50,

  // 1.18+ biomes
  meadow = 177,
  grove = 178,
  snowy_slopes = 179,
  jagged_peaks = 180,
  frozen_peaks = 181,
  stony_peaks = 182,
  deep_dark = 183,
  mangrove_swamp = 184,
  cherry_grove = 185,
  pale_garden = 186,

  // Mutated variants
  sunflower_plains = 129,
  flower_forest = 132,
  ice_spikes = 140,
  old_growth_birch_forest = 155,
  old_growth_spruce_taiga = 160,
  windswept_savanna = 163,
  eroded_badlands = 165,
  bamboo_jungle = 168,
  bamboo_jungle_hills = 169,

  // 1.16 nether
  soul_sand_valley = 170,
  crimson_forest = 171,
  warped_forest = 172,
  basalt_deltas = 173,

  // 1.17 caves
  dripstone_caves = 174,
  lush_caves = 175,
}

// Biome colors for rendering (RGB)
export const BIOME_COLORS: Record<number, [number, number, number]> = {
  // Ocean biomes - deeper blues
  [BiomeID.ocean]: [0, 0, 112],
  [BiomeID.deep_ocean]: [0, 0, 48],
  [BiomeID.frozen_ocean]: [112, 112, 214],
  [BiomeID.deep_frozen_ocean]: [64, 64, 144],
  [BiomeID.cold_ocean]: [32, 32, 112],
  [BiomeID.deep_cold_ocean]: [32, 32, 80],
  [BiomeID.lukewarm_ocean]: [0, 0, 172],
  [BiomeID.deep_lukewarm_ocean]: [0, 0, 128],
  [BiomeID.warm_ocean]: [0, 150, 255],

  // River
  [BiomeID.river]: [0, 0, 255],
  [BiomeID.frozen_river]: [160, 160, 255],

  // Beach
  [BiomeID.beach]: [250, 222, 85],
  [BiomeID.snowy_beach]: [250, 240, 192],
  [BiomeID.stony_shore]: [162, 162, 132],

  // Plains
  [BiomeID.plains]: [141, 179, 96],
  [BiomeID.sunflower_plains]: [181, 219, 136],
  [BiomeID.meadow]: [88, 184, 88],

  // Forest biomes
  [BiomeID.forest]: [5, 102, 33],
  [BiomeID.flower_forest]: [45, 142, 73],
  [BiomeID.birch_forest]: [48, 116, 68],
  [BiomeID.old_growth_birch_forest]: [88, 156, 108],
  [BiomeID.dark_forest]: [64, 81, 26],
  [BiomeID.cherry_grove]: [255, 183, 197],
  [BiomeID.pale_garden]: [213, 206, 199],

  // Taiga
  [BiomeID.taiga]: [11, 102, 89],
  [BiomeID.snowy_taiga]: [49, 85, 74],
  [BiomeID.old_growth_pine_taiga]: [89, 102, 81],
  [BiomeID.old_growth_spruce_taiga]: [69, 82, 61],
  [BiomeID.grove]: [78, 138, 78],

  // Jungle
  [BiomeID.jungle]: [83, 123, 9],
  [BiomeID.bamboo_jungle]: [118, 142, 20],
  [BiomeID.sparse_jungle]: [98, 139, 23],

  // Swamp
  [BiomeID.swamp]: [7, 249, 178],
  [BiomeID.mangrove_swamp]: [103, 53, 43],

  // Desert/Badlands
  [BiomeID.desert]: [250, 148, 24],
  [BiomeID.badlands]: [217, 69, 21],
  [BiomeID.wooded_badlands]: [176, 151, 101],
  [BiomeID.eroded_badlands]: [255, 109, 61],

  // Savanna
  [BiomeID.savanna]: [189, 178, 95],
  [BiomeID.savanna_plateau]: [167, 157, 100],
  [BiomeID.windswept_savanna]: [209, 188, 115],

  // Snow/Ice
  [BiomeID.snowy_plains]: [255, 255, 255],
  [BiomeID.ice_spikes]: [180, 220, 220],
  [BiomeID.snowy_slopes]: [168, 168, 168],
  [BiomeID.frozen_peaks]: [160, 160, 255],
  [BiomeID.jagged_peaks]: [192, 192, 192],
  [BiomeID.stony_peaks]: [136, 136, 136],

  // Mountains
  [BiomeID.windswept_hills]: [96, 96, 96],
  [BiomeID.windswept_forest]: [80, 112, 80],

  // Mushroom
  [BiomeID.mushroom_fields]: [255, 0, 255],

  // Nether
  [BiomeID.nether_wastes]: [191, 59, 59],
  [BiomeID.soul_sand_valley]: [94, 56, 48],
  [BiomeID.crimson_forest]: [221, 8, 8],
  [BiomeID.warped_forest]: [73, 144, 123],
  [BiomeID.basalt_deltas]: [64, 54, 54],

  // End
  [BiomeID.the_end]: [128, 128, 255],
  [BiomeID.small_end_islands]: [138, 138, 128],
  [BiomeID.end_midlands]: [148, 148, 138],
  [BiomeID.end_highlands]: [158, 158, 148],
  [BiomeID.end_barrens]: [118, 118, 108],

  // Caves
  [BiomeID.deep_dark]: [15, 37, 47],
  [BiomeID.dripstone_caves]: [134, 96, 67],
  [BiomeID.lush_caves]: [123, 163, 49],
};

// Get biome color, with fallback
export function getBiomeColor(biomeId: number): [number, number, number] {
  return BIOME_COLORS[biomeId] ?? [128, 128, 128];
}

// Check if biome is oceanic
export function isOceanic(biomeId: number): boolean {
  return (
    biomeId === BiomeID.ocean ||
    biomeId === BiomeID.deep_ocean ||
    biomeId === BiomeID.frozen_ocean ||
    biomeId === BiomeID.deep_frozen_ocean ||
    biomeId === BiomeID.cold_ocean ||
    biomeId === BiomeID.deep_cold_ocean ||
    biomeId === BiomeID.lukewarm_ocean ||
    biomeId === BiomeID.deep_lukewarm_ocean ||
    biomeId === BiomeID.warm_ocean ||
    biomeId === BiomeID.deep_warm_ocean
  );
}

// Check if biome is snowy
export function isSnowy(biomeId: number): boolean {
  return (
    biomeId === BiomeID.snowy_plains ||
    biomeId === BiomeID.snowy_taiga ||
    biomeId === BiomeID.frozen_ocean ||
    biomeId === BiomeID.frozen_river ||
    biomeId === BiomeID.snowy_beach ||
    biomeId === BiomeID.snowy_slopes ||
    biomeId === BiomeID.frozen_peaks ||
    biomeId === BiomeID.ice_spikes ||
    biomeId === BiomeID.deep_frozen_ocean ||
    biomeId === BiomeID.grove
  );
}

// Check if biome has trees
export function biomeHasTrees(biomeId: number): 0 | 1 | 2 {
  switch (biomeId) {
    case BiomeID.forest:
    case BiomeID.flower_forest:
    case BiomeID.birch_forest:
    case BiomeID.old_growth_birch_forest:
    case BiomeID.dark_forest:
    case BiomeID.taiga:
    case BiomeID.snowy_taiga:
    case BiomeID.old_growth_pine_taiga:
    case BiomeID.old_growth_spruce_taiga:
    case BiomeID.jungle:
    case BiomeID.bamboo_jungle:
    case BiomeID.sparse_jungle:
    case BiomeID.swamp:
    case BiomeID.mangrove_swamp:
    case BiomeID.grove:
    case BiomeID.windswept_forest:
    case BiomeID.cherry_grove:
    case BiomeID.pale_garden:
    case BiomeID.wooded_badlands:
      return 1; // Dense trees
    case BiomeID.plains:
    case BiomeID.meadow:
    case BiomeID.savanna:
    case BiomeID.savanna_plateau:
    case BiomeID.sunflower_plains:
      return 2; // Sparse trees
    default:
      return 0; // No trees
  }
}

// Get biome grass color
export function getBiomeGrassColor(biomeId: number): [number, number, number] {
  switch (biomeId) {
    case BiomeID.swamp:
      return [106, 112, 57];
    case BiomeID.mangrove_swamp:
      return [141, 177, 39];
    case BiomeID.jungle:
    case BiomeID.bamboo_jungle:
    case BiomeID.sparse_jungle:
      return [89, 201, 60];
    case BiomeID.badlands:
    case BiomeID.wooded_badlands:
    case BiomeID.eroded_badlands:
      return [144, 129, 77];
    case BiomeID.dark_forest:
      return [80, 122, 50];
    case BiomeID.cherry_grove:
      return [182, 219, 136];
    case BiomeID.pale_garden:
      return [163, 177, 157];
    default:
      return [141, 179, 96]; // Default grass
  }
}

// Get base terrain height for biome
export function getBiomeBaseHeight(biomeId: number): number {
  switch (biomeId) {
    // Ocean depths
    case BiomeID.ocean:
    case BiomeID.lukewarm_ocean:
    case BiomeID.cold_ocean:
    case BiomeID.warm_ocean:
    case BiomeID.frozen_ocean:
      return 45;
    case BiomeID.deep_ocean:
    case BiomeID.deep_lukewarm_ocean:
    case BiomeID.deep_cold_ocean:
    case BiomeID.deep_frozen_ocean:
    case BiomeID.deep_warm_ocean:
      return 30;

    // Rivers
    case BiomeID.river:
    case BiomeID.frozen_river:
      return 56;

    // Beach
    case BiomeID.beach:
    case BiomeID.snowy_beach:
      return 63;
    case BiomeID.stony_shore:
      return 64;

    // Flat biomes
    case BiomeID.plains:
    case BiomeID.sunflower_plains:
    case BiomeID.desert:
      return 68;
    case BiomeID.meadow:
      return 72;

    // Forest
    case BiomeID.forest:
    case BiomeID.flower_forest:
    case BiomeID.cherry_grove:
      return 70;
    case BiomeID.birch_forest:
    case BiomeID.dark_forest:
    case BiomeID.pale_garden:
      return 68;

    // Taiga
    case BiomeID.taiga:
    case BiomeID.snowy_taiga:
      return 68;
    case BiomeID.grove:
      return 75;

    // Jungle
    case BiomeID.jungle:
      return 72;
    case BiomeID.bamboo_jungle:
    case BiomeID.sparse_jungle:
      return 70;

    // Swamp
    case BiomeID.swamp:
      return 62;
    case BiomeID.mangrove_swamp:
      return 61;

    // Savanna
    case BiomeID.savanna:
      return 70;
    case BiomeID.savanna_plateau:
      return 85;

    // Badlands
    case BiomeID.badlands:
      return 80;
    case BiomeID.wooded_badlands:
      return 82;
    case BiomeID.eroded_badlands:
      return 75;

    // Snow
    case BiomeID.snowy_plains:
    case BiomeID.ice_spikes:
      return 68;
    case BiomeID.snowy_slopes:
      return 90;
    case BiomeID.frozen_peaks:
      return 110;

    // Mountains
    case BiomeID.windswept_hills:
      return 90;
    case BiomeID.windswept_forest:
      return 85;
    case BiomeID.jagged_peaks:
      return 120;
    case BiomeID.stony_peaks:
      return 115;

    // Mushroom
    case BiomeID.mushroom_fields:
      return 66;

    default:
      return 64;
  }
}

// Biome name lookup
export function getBiomeName(biomeId: number): string {
  return BiomeID[biomeId] ?? `unknown_${biomeId}`;
}


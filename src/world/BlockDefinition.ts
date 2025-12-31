/**
 * Block Definition System - Flyweight Pattern Implementation
 * 
 * This centralizes all block properties into immutable flyweight objects.
 * Each BlockDefinition is created once and shared across all instances of that block type.
 * 
 * Benefits:
 * - Single source of truth for block properties
 * - No more scattered switch statements
 * - Easy to add/modify block types
 * - Memory efficient (one object per block TYPE, not per block INSTANCE)
 * 
 * Based on the Flyweight pattern from "Game Programming Patterns":
 * - Intrinsic state (shared): isSolid, hardness, drops, etc.
 * - Extrinsic state (per-instance): position, biome tint value
 */

import { BlockType } from './types';

/**
 * Immutable block definition - intrinsic/shared data for a block type
 */
export interface BlockDefinition {
  readonly id: BlockType;
  readonly name: string;
  
  // Physics properties
  readonly isSolid: boolean;           // Can entities collide with it?
  readonly isTransparent: boolean;     // Does light pass through?
  readonly isGravityAffected: boolean; // Does it fall like sand/gravel?
  
  // Rendering properties
  readonly needsBiomeTint: boolean;    // Should use biome color (grass, leaves)?
  readonly isLeaves: boolean;          // Is this a leaf block?
  readonly isLog: boolean;             // Is this a log block?
  readonly isSapling: boolean;         // Is this a sapling?
  readonly isDoor: boolean;            // Is this a door?
  readonly isTrapdoor: boolean;        // Is this a trapdoor?
  
  // Underground generation
  readonly undergroundLayers: readonly [BlockType, BlockType] | null; // [layer1, layer2] below surface
  
  // Breaking/drops
  readonly hardness: number;           // 0 = instant break, higher = longer
  readonly drops: BlockType | null;    // What block type drops when broken (null = nothing)
  readonly dropChance: number;         // Chance to drop (1.0 = always, 0.05 = 5%)
}

/**
 * Helper to create a block definition with defaults
 */
function def(
  id: BlockType,
  name: string,
  overrides: Partial<Omit<BlockDefinition, 'id' | 'name'>> = {}
): BlockDefinition {
  return {
    id,
    name,
    isSolid: true,
    isTransparent: false,
    isGravityAffected: false,
    needsBiomeTint: false,
    isLeaves: false,
    isLog: false,
    isSapling: false,
    isDoor: false,
    isTrapdoor: false,
    undergroundLayers: null,
    hardness: 1.0,
    drops: id, // Default: drops itself
    dropChance: 1.0,
    ...overrides,
  };
}

/**
 * FLYWEIGHT STORE: One instance per block type, shared everywhere
 * This is the core of the Flyweight pattern - these objects are never duplicated
 */
const BLOCK_DEFINITIONS: ReadonlyMap<BlockType, BlockDefinition> = new Map<BlockType, BlockDefinition>([
  // === Basic Blocks ===
  [BlockType.Air, def(BlockType.Air, 'Air', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    drops: null,
  })],
  
  [BlockType.Stone, def(BlockType.Stone, 'Stone', {
    hardness: 1.5,
    undergroundLayers: [BlockType.Stone, BlockType.Stone],
  })],
  
  [BlockType.Dirt, def(BlockType.Dirt, 'Dirt', {
    hardness: 0.5,
    undergroundLayers: [BlockType.Dirt, BlockType.Stone],
  })],
  
  [BlockType.Grass, def(BlockType.Grass, 'Grass Block', {
    hardness: 0.6,
    needsBiomeTint: true,
    drops: BlockType.Dirt,
    undergroundLayers: [BlockType.Dirt, BlockType.Stone],
  })],
  
  [BlockType.Sand, def(BlockType.Sand, 'Sand', {
    hardness: 0.5,
    isGravityAffected: true,
    undergroundLayers: [BlockType.Sand, BlockType.Stone],
  })],
  
  [BlockType.RedSand, def(BlockType.RedSand, 'Red Sand', {
    hardness: 0.5,
    isGravityAffected: true,
    undergroundLayers: [BlockType.RedSand, BlockType.Stone],
  })],
  
  [BlockType.Gravel, def(BlockType.Gravel, 'Gravel', {
    hardness: 0.6,
    isGravityAffected: true,
    undergroundLayers: [BlockType.Stone, BlockType.Stone],
  })],
  
  [BlockType.Water, def(BlockType.Water, 'Water', {
    isSolid: false,
    isTransparent: true,
    hardness: 100, // Can't break water
    drops: null,
    undergroundLayers: [BlockType.Sand, BlockType.Stone],
  })],
  
  [BlockType.Ice, def(BlockType.Ice, 'Ice', {
    isTransparent: true,
    hardness: 0.5,
    undergroundLayers: [BlockType.Stone, BlockType.Stone],
  })],
  
  [BlockType.PackedIce, def(BlockType.PackedIce, 'Packed Ice', {
    hardness: 0.5,
    undergroundLayers: [BlockType.Stone, BlockType.Stone],
  })],
  
  [BlockType.BlueIce, def(BlockType.BlueIce, 'Blue Ice', {
    hardness: 2.8,
    undergroundLayers: [BlockType.Stone, BlockType.Stone],
  })],
  
  [BlockType.Snow, def(BlockType.Snow, 'Snow', {
    hardness: 0.1,
    undergroundLayers: [BlockType.Dirt, BlockType.Stone],
  })],
  
  [BlockType.SnowBlock, def(BlockType.SnowBlock, 'Snow Block', {
    hardness: 0.2,
    undergroundLayers: [BlockType.Dirt, BlockType.Stone],
  })],
  
  [BlockType.Clay, def(BlockType.Clay, 'Clay', {
    hardness: 0.6,
    undergroundLayers: [BlockType.Clay, BlockType.Dirt],
  })],
  
  [BlockType.Bedrock, def(BlockType.Bedrock, 'Bedrock', {
    hardness: -1, // Unbreakable
    drops: null,
    undergroundLayers: null, // Bedrock is the bottom
  })],
  
  [BlockType.Podzol, def(BlockType.Podzol, 'Podzol', {
    hardness: 0.5,
    drops: BlockType.Dirt,
    undergroundLayers: [BlockType.Dirt, BlockType.Stone],
  })],
  
  [BlockType.Mycelium, def(BlockType.Mycelium, 'Mycelium', {
    hardness: 0.6,
    drops: BlockType.Dirt,
    undergroundLayers: [BlockType.Dirt, BlockType.Stone],
  })],
  
  [BlockType.Terracotta, def(BlockType.Terracotta, 'Terracotta', {
    hardness: 1.25,
    undergroundLayers: [BlockType.Terracotta, BlockType.Stone],
  })],
  
  // === Log Blocks ===
  [BlockType.OakLog, def(BlockType.OakLog, 'Oak Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.BirchLog, def(BlockType.BirchLog, 'Birch Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.SpruceLog, def(BlockType.SpruceLog, 'Spruce Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.JungleLog, def(BlockType.JungleLog, 'Jungle Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.AcaciaLog, def(BlockType.AcaciaLog, 'Acacia Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.DarkOakLog, def(BlockType.DarkOakLog, 'Dark Oak Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.CherryLog, def(BlockType.CherryLog, 'Cherry Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.MangroveLog, def(BlockType.MangroveLog, 'Mangrove Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  // === Stripped Logs ===
  [BlockType.StrippedOakLog, def(BlockType.StrippedOakLog, 'Stripped Oak Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.StrippedBirchLog, def(BlockType.StrippedBirchLog, 'Stripped Birch Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.StrippedSpruceLog, def(BlockType.StrippedSpruceLog, 'Stripped Spruce Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.StrippedJungleLog, def(BlockType.StrippedJungleLog, 'Stripped Jungle Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.StrippedAcaciaLog, def(BlockType.StrippedAcaciaLog, 'Stripped Acacia Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.StrippedDarkOakLog, def(BlockType.StrippedDarkOakLog, 'Stripped Dark Oak Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.StrippedCherryLog, def(BlockType.StrippedCherryLog, 'Stripped Cherry Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  [BlockType.StrippedMangroveLog, def(BlockType.StrippedMangroveLog, 'Stripped Mangrove Log', {
    hardness: 2.0,
    isLog: true,
  })],
  
  // === Leaf Blocks ===
  [BlockType.OakLeaves, def(BlockType.OakLeaves, 'Oak Leaves', {
    isSolid: false,
    isTransparent: true,
    hardness: 0.2,
    needsBiomeTint: true,
    isLeaves: true,
    drops: BlockType.OakSapling,
    dropChance: 0.05,
  })],
  
  [BlockType.BirchLeaves, def(BlockType.BirchLeaves, 'Birch Leaves', {
    isSolid: false,
    isTransparent: true,
    hardness: 0.2,
    needsBiomeTint: true,
    isLeaves: true,
    drops: BlockType.BirchSapling,
    dropChance: 0.05,
  })],
  
  [BlockType.SpruceLeaves, def(BlockType.SpruceLeaves, 'Spruce Leaves', {
    isSolid: false,
    isTransparent: true,
    hardness: 0.2,
    needsBiomeTint: true,
    isLeaves: true,
    drops: BlockType.SpruceSapling,
    dropChance: 0.05,
  })],
  
  [BlockType.JungleLeaves, def(BlockType.JungleLeaves, 'Jungle Leaves', {
    isSolid: false,
    isTransparent: true,
    hardness: 0.2,
    needsBiomeTint: true,
    isLeaves: true,
    drops: BlockType.JungleSapling,
    dropChance: 0.025, // Jungle has lower drop rate
  })],
  
  [BlockType.AcaciaLeaves, def(BlockType.AcaciaLeaves, 'Acacia Leaves', {
    isSolid: false,
    isTransparent: true,
    hardness: 0.2,
    needsBiomeTint: true,
    isLeaves: true,
    drops: BlockType.AcaciaSapling,
    dropChance: 0.05,
  })],
  
  [BlockType.DarkOakLeaves, def(BlockType.DarkOakLeaves, 'Dark Oak Leaves', {
    isSolid: false,
    isTransparent: true,
    hardness: 0.2,
    needsBiomeTint: true,
    isLeaves: true,
    drops: BlockType.DarkOakSapling,
    dropChance: 0.05,
  })],
  
  [BlockType.CherryLeaves, def(BlockType.CherryLeaves, 'Cherry Leaves', {
    isSolid: false,
    isTransparent: true,
    hardness: 0.2,
    needsBiomeTint: false, // Cherry leaves are always pink
    isLeaves: true,
    drops: BlockType.CherrySapling,
    dropChance: 0.05,
  })],
  
  [BlockType.MangroveLeaves, def(BlockType.MangroveLeaves, 'Mangrove Leaves', {
    isSolid: false,
    isTransparent: true,
    hardness: 0.2,
    needsBiomeTint: true,
    isLeaves: true,
    drops: BlockType.MangroveSapling,
    dropChance: 0.05,
  })],
  
  // === Saplings ===
  [BlockType.OakSapling, def(BlockType.OakSapling, 'Oak Sapling', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    isSapling: true,
  })],
  
  [BlockType.BirchSapling, def(BlockType.BirchSapling, 'Birch Sapling', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    isSapling: true,
  })],
  
  [BlockType.SpruceSapling, def(BlockType.SpruceSapling, 'Spruce Sapling', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    isSapling: true,
  })],
  
  [BlockType.JungleSapling, def(BlockType.JungleSapling, 'Jungle Sapling', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    isSapling: true,
  })],
  
  [BlockType.AcaciaSapling, def(BlockType.AcaciaSapling, 'Acacia Sapling', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    isSapling: true,
  })],
  
  [BlockType.DarkOakSapling, def(BlockType.DarkOakSapling, 'Dark Oak Sapling', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    isSapling: true,
  })],
  
  [BlockType.CherrySapling, def(BlockType.CherrySapling, 'Cherry Sapling', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    isSapling: true,
  })],
  
  [BlockType.MangroveSapling, def(BlockType.MangroveSapling, 'Mangrove Sapling', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    isSapling: true,
  })],
  
  // === Wood Planks ===
  [BlockType.OakPlanks, def(BlockType.OakPlanks, 'Oak Planks', { hardness: 2.0 })],
  [BlockType.BirchPlanks, def(BlockType.BirchPlanks, 'Birch Planks', { hardness: 2.0 })],
  [BlockType.SprucePlanks, def(BlockType.SprucePlanks, 'Spruce Planks', { hardness: 2.0 })],
  [BlockType.JunglePlanks, def(BlockType.JunglePlanks, 'Jungle Planks', { hardness: 2.0 })],
  [BlockType.AcaciaPlanks, def(BlockType.AcaciaPlanks, 'Acacia Planks', { hardness: 2.0 })],
  [BlockType.DarkOakPlanks, def(BlockType.DarkOakPlanks, 'Dark Oak Planks', { hardness: 2.0 })],
  [BlockType.CherryPlanks, def(BlockType.CherryPlanks, 'Cherry Planks', { hardness: 2.0 })],
  [BlockType.MangrovePlanks, def(BlockType.MangrovePlanks, 'Mangrove Planks', { hardness: 2.0 })],
  
  // === Doors ===
  [BlockType.OakDoor, def(BlockType.OakDoor, 'Oak Door', {
    isSolid: true, // Solid when closed, handled specially when open
    isTransparent: true,
    hardness: 3.0,
    isDoor: true,
  })],
  
  [BlockType.BirchDoor, def(BlockType.BirchDoor, 'Birch Door', {
    isSolid: true,
    isTransparent: true,
    hardness: 3.0,
    isDoor: true,
  })],
  
  [BlockType.SpruceDoor, def(BlockType.SpruceDoor, 'Spruce Door', {
    isSolid: true,
    isTransparent: true,
    hardness: 3.0,
    isDoor: true,
  })],
  
  [BlockType.JungleDoor, def(BlockType.JungleDoor, 'Jungle Door', {
    isSolid: true,
    isTransparent: true,
    hardness: 3.0,
    isDoor: true,
  })],
  
  [BlockType.AcaciaDoor, def(BlockType.AcaciaDoor, 'Acacia Door', {
    isSolid: true,
    isTransparent: true,
    hardness: 3.0,
    isDoor: true,
  })],
  
  [BlockType.DarkOakDoor, def(BlockType.DarkOakDoor, 'Dark Oak Door', {
    isSolid: true,
    isTransparent: true,
    hardness: 3.0,
    isDoor: true,
  })],
  
  [BlockType.CherryDoor, def(BlockType.CherryDoor, 'Cherry Door', {
    isSolid: true,
    isTransparent: true,
    hardness: 3.0,
    isDoor: true,
  })],
  
  [BlockType.MangroveDoor, def(BlockType.MangroveDoor, 'Mangrove Door', {
    isSolid: true,
    isTransparent: true,
    hardness: 3.0,
    isDoor: true,
  })],
  
  // === Trapdoors ===
  [BlockType.OakTrapdoor, def(BlockType.OakTrapdoor, 'Oak Trapdoor', {
    isSolid: false,
    isTransparent: true,
    hardness: 3.0,
    isTrapdoor: true,
  })],
  
  [BlockType.BirchTrapdoor, def(BlockType.BirchTrapdoor, 'Birch Trapdoor', {
    isSolid: false,
    isTransparent: true,
    hardness: 3.0,
    isTrapdoor: true,
  })],
  
  [BlockType.SpruceTrapdoor, def(BlockType.SpruceTrapdoor, 'Spruce Trapdoor', {
    isSolid: false,
    isTransparent: true,
    hardness: 3.0,
    isTrapdoor: true,
  })],
  
  [BlockType.JungleTrapdoor, def(BlockType.JungleTrapdoor, 'Jungle Trapdoor', {
    isSolid: false,
    isTransparent: true,
    hardness: 3.0,
    isTrapdoor: true,
  })],
  
  [BlockType.AcaciaTrapdoor, def(BlockType.AcaciaTrapdoor, 'Acacia Trapdoor', {
    isSolid: false,
    isTransparent: true,
    hardness: 3.0,
    isTrapdoor: true,
  })],
  
  [BlockType.DarkOakTrapdoor, def(BlockType.DarkOakTrapdoor, 'Dark Oak Trapdoor', {
    isSolid: false,
    isTransparent: true,
    hardness: 3.0,
    isTrapdoor: true,
  })],
  
  [BlockType.CherryTrapdoor, def(BlockType.CherryTrapdoor, 'Cherry Trapdoor', {
    isSolid: false,
    isTransparent: true,
    hardness: 3.0,
    isTrapdoor: true,
  })],
  
  [BlockType.MangroveTrapdoor, def(BlockType.MangroveTrapdoor, 'Mangrove Trapdoor', {
    isSolid: false,
    isTransparent: true,
    hardness: 3.0,
    isTrapdoor: true,
  })],
  
  // === Misc Blocks ===
  [BlockType.Cactus, def(BlockType.Cactus, 'Cactus', {
    hardness: 0.4,
    isTransparent: true, // Has gaps
  })],
  
  [BlockType.CactusTop, def(BlockType.CactusTop, 'Cactus Top', {
    hardness: 0.4,
    isTransparent: true,
    drops: BlockType.Cactus,
  })],
  
  [BlockType.DeadBush, def(BlockType.DeadBush, 'Dead Bush', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
  })],
  
  [BlockType.TallGrass, def(BlockType.TallGrass, 'Tall Grass', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    needsBiomeTint: true,
    drops: null,
  })],
  
  [BlockType.Fern, def(BlockType.Fern, 'Fern', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    needsBiomeTint: true,
    drops: null,
  })],
  
  [BlockType.Coral, def(BlockType.Coral, 'Coral', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
  })],
  
  [BlockType.Seagrass, def(BlockType.Seagrass, 'Seagrass', {
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    drops: null,
  })],
]);

// ============ Public API ============

/**
 * Get the flyweight definition for a block type
 * Returns a shared, immutable object - never modify it!
 */
export function getBlockDef(blockType: BlockType): BlockDefinition {
  const def = BLOCK_DEFINITIONS.get(blockType);
  if (!def) {
    // Fallback for unknown block types
    console.warn(`Unknown block type: ${blockType}, using Air properties`);
    return BLOCK_DEFINITIONS.get(BlockType.Air)!;
  }
  return def;
}

/**
 * Check if a block type is solid (for collision)
 */
export function isBlockSolid(blockType: BlockType): boolean {
  return getBlockDef(blockType).isSolid;
}

/**
 * Check if a block type is affected by gravity
 */
export function isBlockGravityAffected(blockType: BlockType): boolean {
  return getBlockDef(blockType).isGravityAffected;
}

/**
 * Check if a block type needs biome tinting
 */
export function blockNeedsBiomeTint(blockType: BlockType): boolean {
  return getBlockDef(blockType).needsBiomeTint;
}

/**
 * Check if a block type is a leaf block
 */
export function isBlockLeaves(blockType: BlockType): boolean {
  return getBlockDef(blockType).isLeaves;
}

/**
 * Check if a block type is a log block
 */
export function isBlockLog(blockType: BlockType): boolean {
  return getBlockDef(blockType).isLog;
}

/**
 * Check if a block type is a sapling
 */
export function isBlockSapling(blockType: BlockType): boolean {
  return getBlockDef(blockType).isSapling;
}

/**
 * Check if a block type is a door
 */
export function isBlockDoor(blockType: BlockType): boolean {
  return getBlockDef(blockType).isDoor;
}

/**
 * Check if a block type is a trapdoor
 */
export function isBlockTrapdoor(blockType: BlockType): boolean {
  return getBlockDef(blockType).isTrapdoor;
}

/**
 * Get underground layers for a surface block type
 * Returns [layer1, layer2] or null if no underground layers defined
 */
export function getUndergroundLayers(surfaceBlock: BlockType): readonly [BlockType, BlockType] {
  const def = getBlockDef(surfaceBlock);
  // Default to dirt/stone if not specified
  return def.undergroundLayers ?? [BlockType.Dirt, BlockType.Stone];
}

/**
 * Get what a block drops when broken
 * Returns null if nothing drops, or the block type and chance
 */
export function getBlockDrops(blockType: BlockType): { type: BlockType; chance: number } | null {
  const def = getBlockDef(blockType);
  if (def.drops === null) return null;
  return { type: def.drops, chance: def.dropChance };
}

/**
 * Get block hardness (for breaking time calculation)
 * Returns -1 for unbreakable blocks
 */
export function getBlockHardness(blockType: BlockType): number {
  return getBlockDef(blockType).hardness;
}

/**
 * Get block name for display
 */
export function getBlockName(blockType: BlockType): string {
  return getBlockDef(blockType).name;
}

/**
 * Get all block definitions (for iteration, debugging, etc.)
 */
export function getAllBlockDefinitions(): ReadonlyMap<BlockType, BlockDefinition> {
  return BLOCK_DEFINITIONS;
}




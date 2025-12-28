/**
 * Shared utilities for rendering block icons in inventory UIs
 * Provides unified tinting and rendering logic for both CreativeInventory and InventoryHUD
 */

import { BlockType } from '../world/types';

// Block texture configuration for 3D cube rendering
export interface BlockTextureConfig {
  top: string;
  side: string;
  bottom?: string;
}

// Tint configuration for a block
export interface BlockTintConfig {
  // CSS filter for tinting (e.g., 'sepia(1) saturate(3) hue-rotate(70deg)')
  tint: string;
  // Which faces to apply the tint to
  faces: ('top' | 'side' | 'all')[];
}

/**
 * Blocks that should be rendered as flat 2D sprites instead of 3D cubes
 */
export const FLAT_SPRITE_BLOCKS: BlockType[] = [
  // Saplings
  BlockType.OakSapling,
  BlockType.BirchSapling,
  BlockType.SpruceSapling,
  BlockType.JungleSapling,
  BlockType.AcaciaSapling,
  BlockType.DarkOakSapling,
  BlockType.CherrySapling,
  BlockType.MangroveSapling,
  // Doors
  BlockType.OakDoor,
  BlockType.BirchDoor,
  BlockType.SpruceDoor,
  BlockType.JungleDoor,
  BlockType.AcaciaDoor,
  BlockType.DarkOakDoor,
  BlockType.CherryDoor,
  BlockType.MangroveDoor,
  // Trapdoors
  BlockType.OakTrapdoor,
  BlockType.BirchTrapdoor,
  BlockType.SpruceTrapdoor,
  BlockType.JungleTrapdoor,
  BlockType.AcaciaTrapdoor,
  BlockType.DarkOakTrapdoor,
  BlockType.CherryTrapdoor,
  BlockType.MangroveTrapdoor,
];

/**
 * Get tint configuration for a block type
 * Returns null if no tinting is needed
 */
export function getBlockTintConfig(blockType: BlockType): BlockTintConfig | null {
  // Leaves get green tint on all faces (texture is grayscale)
  const greenLeafBlocks = [
    BlockType.OakLeaves,
    BlockType.BirchLeaves,
    BlockType.SpruceLeaves,
    BlockType.JungleLeaves,
    BlockType.AcaciaLeaves,
    BlockType.DarkOakLeaves,
    BlockType.MangroveLeaves,
  ];
  
  if (greenLeafBlocks.includes(blockType)) {
    return {
      tint: 'sepia(1) saturate(3) hue-rotate(70deg)',
      faces: ['all'],
    };
  }
  
  // Cherry leaves get pink tint on all faces
  if (blockType === BlockType.CherryLeaves) {
    return {
      tint: 'sepia(1) saturate(2) hue-rotate(300deg)',
      faces: ['all'],
    };
  }
  
  // Grass block: only TOP gets green tint
  // The side texture already has the dirt/grass coloring baked in
  // Note: Podzol and Mycelium have their own distinct top textures and should NOT be tinted
  if (blockType === BlockType.Grass) {
    return {
      tint: 'sepia(1) saturate(2.5) hue-rotate(70deg)',
      faces: ['top'],
    };
  }
  
  return null;
}

/**
 * Check if a block should be rendered as a flat sprite
 */
export function isFlatSpriteBlock(blockType: BlockType): boolean {
  return FLAT_SPRITE_BLOCKS.includes(blockType);
}

/**
 * Get CSS filter string for a face, applying tint if needed
 * @param blockType The block type
 * @param faceName The face ('top', 'front', 'right', 'left')
 * @param baseBrightness Base brightness for face shading (1.0, 0.8, 0.6, 0.7)
 */
export function getFaceFilter(
  blockType: BlockType,
  faceName: 'top' | 'front' | 'right' | 'left',
  baseBrightness: number
): string {
  const tintConfig = getBlockTintConfig(blockType);
  
  if (!tintConfig) {
    return `brightness(${baseBrightness})`;
  }
  
  // Check if this face should be tinted
  const shouldTint = tintConfig.faces.includes('all') ||
    (tintConfig.faces.includes('top') && faceName === 'top') ||
    (tintConfig.faces.includes('side') && faceName !== 'top');
  
  if (shouldTint) {
    return `brightness(${baseBrightness}) ${tintConfig.tint}`;
  }
  
  return `brightness(${baseBrightness})`;
}

/**
 * Face brightness values for Minecraft-style isometric rendering
 */
export const FACE_BRIGHTNESS = {
  top: 1.0,
  front: 0.8,
  right: 0.6,
  left: 0.7,
} as const;

/**
 * Fallback colors for blocks without textures
 */
export const BLOCK_FALLBACK_COLORS: Partial<Record<BlockType, string>> = {
  [BlockType.Stone]: '#7f7f7f',
  [BlockType.Dirt]: '#8b6442',
  [BlockType.Grass]: '#7cbc4d',
  [BlockType.Sand]: '#dbd4a0',
  [BlockType.RedSand]: '#b5633a',
  [BlockType.Gravel]: '#847f7d',
  [BlockType.Clay]: '#9da3a7',
  [BlockType.Terracotta]: '#985e43',
  [BlockType.Ice]: '#a5d3f3',
  [BlockType.PackedIce]: '#8cb4d4',
  [BlockType.BlueIce]: '#74a8d6',
  [BlockType.Snow]: '#f0f0f0',
  [BlockType.SnowBlock]: '#f0f0f0',
  [BlockType.Bedrock]: '#3a3a3a',
  [BlockType.Water]: '#3f76e4',
  // Wood Planks
  [BlockType.OakPlanks]: '#b8945f',
  [BlockType.BirchPlanks]: '#c8b77a',
  [BlockType.SprucePlanks]: '#7a5a3a',
  [BlockType.JunglePlanks]: '#a8754a',
  [BlockType.AcaciaPlanks]: '#ad5d32',
  [BlockType.DarkOakPlanks]: '#3e2912',
  [BlockType.CherryPlanks]: '#e4b4a5',
  [BlockType.MangrovePlanks]: '#773535',
  // Logs
  [BlockType.OakLog]: '#6b5232',
  [BlockType.BirchLog]: '#d5cdb3',
  [BlockType.SpruceLog]: '#4a3a25',
  [BlockType.JungleLog]: '#5a4a2a',
  [BlockType.AcaciaLog]: '#6d5040',
  [BlockType.DarkOakLog]: '#3d2d1d',
  [BlockType.CherryLog]: '#a87080',
  [BlockType.MangroveLog]: '#5a3030',
  // Stripped Logs
  [BlockType.StrippedOakLog]: '#b8945f',
  [BlockType.StrippedBirchLog]: '#c8b77a',
  [BlockType.StrippedSpruceLog]: '#7a5a3a',
  [BlockType.StrippedJungleLog]: '#a8754a',
  [BlockType.StrippedAcaciaLog]: '#ad5d32',
  [BlockType.StrippedDarkOakLog]: '#3e2912',
  [BlockType.StrippedCherryLog]: '#e4b4a5',
  [BlockType.StrippedMangroveLog]: '#773535',
  // Leaves
  [BlockType.OakLeaves]: '#4a7a2b',
  [BlockType.BirchLeaves]: '#5a8a3b',
  [BlockType.SpruceLeaves]: '#3a5a2b',
  [BlockType.JungleLeaves]: '#3a7a3b',
  [BlockType.AcaciaLeaves]: '#5a8a4b',
  [BlockType.DarkOakLeaves]: '#3a5a2b',
  [BlockType.CherryLeaves]: '#e0a0c0',
  [BlockType.MangroveLeaves]: '#4a7a4b',
  [BlockType.Podzol]: '#7a5a3a',
  [BlockType.Mycelium]: '#8a7a7a',
  // Saplings
  [BlockType.OakSapling]: '#5a9a3b',
  [BlockType.BirchSapling]: '#6aaa4b',
  [BlockType.SpruceSapling]: '#3a6a2b',
  [BlockType.JungleSapling]: '#4a8a3b',
  [BlockType.AcaciaSapling]: '#6a9a4b',
  [BlockType.DarkOakSapling]: '#3a5a2b',
  [BlockType.CherrySapling]: '#d090b0',
  [BlockType.MangroveSapling]: '#4a7a4b',
  // Doors
  [BlockType.OakDoor]: '#a58046',
  [BlockType.BirchDoor]: '#d4c797',
  [BlockType.SpruceDoor]: '#6b5034',
  [BlockType.JungleDoor]: '#a87453',
  [BlockType.AcaciaDoor]: '#9b5b3b',
  [BlockType.DarkOakDoor]: '#4a321d',
  [BlockType.CherryDoor]: '#e4b4a5',
  [BlockType.MangroveDoor]: '#6b3030',
  // Trapdoors
  [BlockType.OakTrapdoor]: '#a58046',
  [BlockType.BirchTrapdoor]: '#d4c797',
  [BlockType.SpruceTrapdoor]: '#6b5034',
  [BlockType.JungleTrapdoor]: '#a87453',
  [BlockType.AcaciaTrapdoor]: '#9b5b3b',
  [BlockType.DarkOakTrapdoor]: '#4a321d',
  [BlockType.CherryTrapdoor]: '#e4b4a5',
  [BlockType.MangroveTrapdoor]: '#6b3030',
  // Other
  [BlockType.Cactus]: '#5a8a3b',
};

/**
 * Get fallback color for a block type
 */
export function getBlockFallbackColor(blockType: BlockType): string {
  return BLOCK_FALLBACK_COLORS[blockType] || '#808080';
}


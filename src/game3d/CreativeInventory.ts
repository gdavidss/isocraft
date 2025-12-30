/**
 * Creative Mode Inventory - Minecraft-style full inventory screen
 * 
 * Opens when pressing 'E', shows all available blocks in a grid.
 * Clicking a block adds it to the hotbar.
 * Styled like Minecraft's creative inventory.
 */

import { BlockType } from '../world/types';
import { getSoundManager } from './SoundManager';
import { MC_FONT, MC_FONT_FACE } from './DebugUI3D';
import { InventoryHUD, type HotbarItem } from './InventoryHUD';
import {
  isFlatSpriteBlock,
  getFaceFilter,
  getBlockFallbackColor,
  FACE_BRIGHTNESS,
  type BlockTextureConfig,
} from './BlockIconUtils';
import { getGamepadManager } from './GamepadManager';

// All placeable blocks in creative mode (excludes Air, Water, vegetation)
const CREATIVE_BLOCKS: BlockType[] = [
  // Natural blocks
  BlockType.Stone,
  BlockType.Dirt,
  BlockType.Grass,
  BlockType.Sand,
  BlockType.RedSand,
  BlockType.Gravel,
  BlockType.Clay,
  BlockType.Podzol,
  BlockType.Mycelium,
  
  // Snow/Ice
  BlockType.Snow,
  BlockType.SnowBlock,
  BlockType.Ice,
  BlockType.PackedIce,
  BlockType.BlueIce,
  
  // Terracotta
  BlockType.Terracotta,
  
  // Wood Planks
  BlockType.OakPlanks,
  BlockType.BirchPlanks,
  BlockType.SprucePlanks,
  BlockType.JunglePlanks,
  BlockType.AcaciaPlanks,
  BlockType.DarkOakPlanks,
  BlockType.CherryPlanks,
  BlockType.MangrovePlanks,
  
  // Logs
  BlockType.OakLog,
  BlockType.BirchLog,
  BlockType.SpruceLog,
  BlockType.JungleLog,
  BlockType.AcaciaLog,
  BlockType.DarkOakLog,
  BlockType.CherryLog,
  BlockType.MangroveLog,
  
  // Stripped Logs
  BlockType.StrippedOakLog,
  BlockType.StrippedBirchLog,
  BlockType.StrippedSpruceLog,
  BlockType.StrippedJungleLog,
  BlockType.StrippedAcaciaLog,
  BlockType.StrippedDarkOakLog,
  BlockType.StrippedCherryLog,
  BlockType.StrippedMangroveLog,
  
  // Leaves
  BlockType.OakLeaves,
  BlockType.BirchLeaves,
  BlockType.SpruceLeaves,
  BlockType.JungleLeaves,
  BlockType.AcaciaLeaves,
  BlockType.DarkOakLeaves,
  BlockType.CherryLeaves,
  BlockType.MangroveLeaves,
  
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
  
  // Other
  BlockType.Cactus,
  BlockType.Bedrock,
];

// Block display names
const BLOCK_NAMES: Partial<Record<BlockType, string>> = {
  [BlockType.Stone]: 'Stone',
  [BlockType.Dirt]: 'Dirt',
  [BlockType.Grass]: 'Grass Block',
  [BlockType.Sand]: 'Sand',
  [BlockType.RedSand]: 'Red Sand',
  [BlockType.Gravel]: 'Gravel',
  [BlockType.Clay]: 'Clay',
  [BlockType.Podzol]: 'Podzol',
  [BlockType.Mycelium]: 'Mycelium',
  [BlockType.Snow]: 'Snow',
  [BlockType.SnowBlock]: 'Snow Block',
  [BlockType.Ice]: 'Ice',
  [BlockType.PackedIce]: 'Packed Ice',
  [BlockType.BlueIce]: 'Blue Ice',
  [BlockType.Terracotta]: 'Terracotta',
  // Wood Planks
  [BlockType.OakPlanks]: 'Oak Planks',
  [BlockType.BirchPlanks]: 'Birch Planks',
  [BlockType.SprucePlanks]: 'Spruce Planks',
  [BlockType.JunglePlanks]: 'Jungle Planks',
  [BlockType.AcaciaPlanks]: 'Acacia Planks',
  [BlockType.DarkOakPlanks]: 'Dark Oak Planks',
  [BlockType.CherryPlanks]: 'Cherry Planks',
  [BlockType.MangrovePlanks]: 'Mangrove Planks',
  // Logs
  [BlockType.OakLog]: 'Oak Log',
  [BlockType.BirchLog]: 'Birch Log',
  [BlockType.SpruceLog]: 'Spruce Log',
  [BlockType.JungleLog]: 'Jungle Log',
  [BlockType.AcaciaLog]: 'Acacia Log',
  [BlockType.DarkOakLog]: 'Dark Oak Log',
  [BlockType.CherryLog]: 'Cherry Log',
  [BlockType.MangroveLog]: 'Mangrove Log',
  // Stripped Logs
  [BlockType.StrippedOakLog]: 'Stripped Oak Log',
  [BlockType.StrippedBirchLog]: 'Stripped Birch Log',
  [BlockType.StrippedSpruceLog]: 'Stripped Spruce Log',
  [BlockType.StrippedJungleLog]: 'Stripped Jungle Log',
  [BlockType.StrippedAcaciaLog]: 'Stripped Acacia Log',
  [BlockType.StrippedDarkOakLog]: 'Stripped Dark Oak Log',
  [BlockType.StrippedCherryLog]: 'Stripped Cherry Log',
  [BlockType.StrippedMangroveLog]: 'Stripped Mangrove Log',
  // Leaves
  [BlockType.OakLeaves]: 'Oak Leaves',
  [BlockType.BirchLeaves]: 'Birch Leaves',
  [BlockType.SpruceLeaves]: 'Spruce Leaves',
  [BlockType.JungleLeaves]: 'Jungle Leaves',
  [BlockType.AcaciaLeaves]: 'Acacia Leaves',
  [BlockType.DarkOakLeaves]: 'Dark Oak Leaves',
  [BlockType.CherryLeaves]: 'Cherry Leaves',
  [BlockType.MangroveLeaves]: 'Mangrove Leaves',
  // Saplings
  [BlockType.OakSapling]: 'Oak Sapling',
  [BlockType.BirchSapling]: 'Birch Sapling',
  [BlockType.SpruceSapling]: 'Spruce Sapling',
  [BlockType.JungleSapling]: 'Jungle Sapling',
  [BlockType.AcaciaSapling]: 'Acacia Sapling',
  [BlockType.DarkOakSapling]: 'Dark Oak Sapling',
  [BlockType.CherrySapling]: 'Cherry Sapling',
  [BlockType.MangroveSapling]: 'Mangrove Sapling',
  // Doors
  [BlockType.OakDoor]: 'Oak Door',
  [BlockType.BirchDoor]: 'Birch Door',
  [BlockType.SpruceDoor]: 'Spruce Door',
  [BlockType.JungleDoor]: 'Jungle Door',
  [BlockType.AcaciaDoor]: 'Acacia Door',
  [BlockType.DarkOakDoor]: 'Dark Oak Door',
  [BlockType.CherryDoor]: 'Cherry Door',
  [BlockType.MangroveDoor]: 'Mangrove Door',
  // Trapdoors
  [BlockType.OakTrapdoor]: 'Oak Trapdoor',
  [BlockType.BirchTrapdoor]: 'Birch Trapdoor',
  [BlockType.SpruceTrapdoor]: 'Spruce Trapdoor',
  [BlockType.JungleTrapdoor]: 'Jungle Trapdoor',
  [BlockType.AcaciaTrapdoor]: 'Acacia Trapdoor',
  [BlockType.DarkOakTrapdoor]: 'Dark Oak Trapdoor',
  [BlockType.CherryTrapdoor]: 'Cherry Trapdoor',
  [BlockType.MangroveTrapdoor]: 'Mangrove Trapdoor',
  // Other
  [BlockType.Cactus]: 'Cactus',
  [BlockType.Bedrock]: 'Bedrock',
};

// Block textures for rendering 3D cubes
const BLOCK_TEXTURES: Partial<Record<BlockType, BlockTextureConfig | string>> = {
  // Blocks with different top/side textures
  [BlockType.Grass]: {
    top: '/textures/grass_block_top.png',
    side: '/textures/grass_block_side.png',
    bottom: '/textures/dirt.png',
  },
  [BlockType.Podzol]: {
    top: '/textures/podzol_top.png',
    side: '/textures/podzol_side.png',
    bottom: '/textures/dirt.png',
  },
  [BlockType.Mycelium]: {
    top: '/textures/mycelium_top.png',
    side: '/textures/mycelium_side.png',
    bottom: '/textures/dirt.png',
  },
  [BlockType.Snow]: '/textures/snow.png',
  [BlockType.SnowBlock]: '/textures/snow.png',
  // Logs
  [BlockType.OakLog]: {
    top: '/textures/oak_log_top.png',
    side: '/textures/oak_log.png',
  },
  [BlockType.BirchLog]: {
    top: '/textures/birch_log_top.png',
    side: '/textures/birch_log.png',
  },
  [BlockType.SpruceLog]: {
    top: '/textures/spruce_log_top.png',
    side: '/textures/spruce_log.png',
  },
  [BlockType.JungleLog]: {
    top: '/textures/jungle_log_top.png',
    side: '/textures/jungle_log.png',
  },
  [BlockType.AcaciaLog]: {
    top: '/textures/acacia_log_top.png',
    side: '/textures/acacia_log.png',
  },
  [BlockType.DarkOakLog]: {
    top: '/textures/dark_oak_log_top.png',
    side: '/textures/dark_oak_log.png',
  },
  [BlockType.CherryLog]: {
    top: '/textures/cherry_log_top.png',
    side: '/textures/cherry_log.png',
  },
  [BlockType.MangroveLog]: {
    top: '/textures/mangrove_log_top.png',
    side: '/textures/mangrove_log.png',
  },
  // Cactus
  [BlockType.Cactus]: {
    top: '/textures/cactus_top.png',
    side: '/textures/cactus_side.png',
  },
  // Uniform blocks
  [BlockType.Dirt]: '/textures/dirt.png',
  [BlockType.Stone]: '/textures/stone.png',
  [BlockType.Sand]: '/textures/sand.png',
  [BlockType.RedSand]: '/textures/red_sand.png',
  [BlockType.Gravel]: '/textures/gravel.png',
  [BlockType.Clay]: '/textures/clay.png',
  [BlockType.Terracotta]: '/textures/terracotta.png',
  [BlockType.Ice]: '/textures/ice.png',
  [BlockType.PackedIce]: '/textures/packed_ice.png',
  [BlockType.BlueIce]: '/textures/blue_ice.png',
  [BlockType.Bedrock]: '/textures/bedrock.png',
  // Leaves
  [BlockType.OakLeaves]: '/textures/oak_leaves.png',
  [BlockType.BirchLeaves]: '/textures/birch_leaves.png',
  [BlockType.SpruceLeaves]: '/textures/spruce_leaves.png',
  [BlockType.JungleLeaves]: '/textures/jungle_leaves.png',
  [BlockType.AcaciaLeaves]: '/textures/acacia_leaves.png',
  [BlockType.DarkOakLeaves]: '/textures/dark_oak_leaves.png',
  [BlockType.CherryLeaves]: '/textures/cherry_leaves.png',
  [BlockType.MangroveLeaves]: '/textures/mangrove_leaves.png',
  // Saplings
  [BlockType.OakSapling]: '/textures/oak_sapling.png',
  [BlockType.BirchSapling]: '/textures/birch_sapling.png',
  [BlockType.SpruceSapling]: '/textures/spruce_sapling.png',
  [BlockType.JungleSapling]: '/textures/jungle_sapling.png',
  [BlockType.AcaciaSapling]: '/textures/acacia_sapling.png',
  [BlockType.DarkOakSapling]: '/textures/dark_oak_sapling.png',
  [BlockType.CherrySapling]: '/textures/cherry_sapling.png',
  [BlockType.MangroveSapling]: '/textures/mangrove_sapling.png',
  // Wood Planks
  [BlockType.OakPlanks]: '/textures/oak_planks.png',
  [BlockType.BirchPlanks]: '/textures/birch_planks.png',
  [BlockType.SprucePlanks]: '/textures/spruce_planks.png',
  [BlockType.JunglePlanks]: '/textures/jungle_planks.png',
  [BlockType.AcaciaPlanks]: '/textures/acacia_planks.png',
  [BlockType.DarkOakPlanks]: '/textures/dark_oak_planks.png',
  [BlockType.CherryPlanks]: '/textures/cherry_planks.png',
  [BlockType.MangrovePlanks]: '/textures/mangrove_planks.png',
  // Stripped Logs
  [BlockType.StrippedOakLog]: {
    top: '/textures/stripped_oak_log_top.png',
    side: '/textures/stripped_oak_log.png',
  },
  [BlockType.StrippedBirchLog]: {
    top: '/textures/stripped_birch_log_top.png',
    side: '/textures/stripped_birch_log.png',
  },
  [BlockType.StrippedSpruceLog]: {
    top: '/textures/stripped_spruce_log_top.png',
    side: '/textures/stripped_spruce_log.png',
  },
  [BlockType.StrippedJungleLog]: {
    top: '/textures/stripped_jungle_log_top.png',
    side: '/textures/stripped_jungle_log.png',
  },
  [BlockType.StrippedAcaciaLog]: {
    top: '/textures/stripped_acacia_log_top.png',
    side: '/textures/stripped_acacia_log.png',
  },
  [BlockType.StrippedDarkOakLog]: {
    top: '/textures/stripped_dark_oak_log_top.png',
    side: '/textures/stripped_dark_oak_log.png',
  },
  [BlockType.StrippedCherryLog]: {
    top: '/textures/stripped_cherry_log_top.png',
    side: '/textures/stripped_cherry_log.png',
  },
  [BlockType.StrippedMangroveLog]: {
    top: '/textures/stripped_mangrove_log_top.png',
    side: '/textures/stripped_mangrove_log.png',
  },
  // Doors
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

// Fallback colors for blocks without textures (kept for backwards compatibility, uses shared util)
const BLOCK_COLORS: Partial<Record<BlockType, string>> = {
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

export class CreativeInventory {
  private container: HTMLDivElement;
  private isVisible: boolean = false;
  private inventoryHUD: InventoryHUD;
  private tooltip: HTMLDivElement;
  
  // Gamepad navigation state
  private focusedSlotIndex: number = 0;
  private currentBlocks: BlockType[] = CREATIVE_BLOCKS;
  private readonly GRID_COLUMNS = 9;
  
  // Store original gamepad callbacks to restore later
  private savedGamepadCallbacks: {
    onMenuNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
    onMenuSelect?: () => void;
    onMenuBack?: () => void;
  } = {};
  
  // Callbacks
  public onOpen?: () => void;
  public onClose?: () => void;
  
  constructor(inventoryHUD: InventoryHUD) {
    this.inventoryHUD = inventoryHUD;
    
    // Inject styles
    this.injectStyles();
    
    // Create container
    this.container = this.createInventoryUI();
    document.body.appendChild(this.container);
    
    // Create tooltip
    this.tooltip = this.createTooltip();
    document.body.appendChild(this.tooltip);
  }
  
  /**
   * Inject CSS styles for creative inventory
   */
  private injectStyles(): void {
    // Ensure Minecraft font is loaded
    if (!document.getElementById('minecraft-font-styles')) {
      const fontStyle = document.createElement('style');
      fontStyle.id = 'minecraft-font-styles';
      fontStyle.textContent = MC_FONT_FACE;
      document.head.appendChild(fontStyle);
    }
    
    if (document.getElementById('creative-inventory-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'creative-inventory-styles';
    style.textContent = `
      #creative-inventory {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.65);
        z-index: 9999;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: ${MC_FONT};
        image-rendering: pixelated;
      }
      
      .creative-panel {
        background: #c6c6c6;
        border: 4px solid;
        border-color: #ffffff #555555 #555555 #ffffff;
        padding: 8px;
        box-shadow: inset 2px 2px 0 rgba(255,255,255,0.3),
                    inset -2px -2px 0 rgba(0,0,0,0.2);
      }
      
      .creative-title {
        color: #404040;
        font-size: 16px;
        text-align: center;
        margin-bottom: 8px;
        text-shadow: 1px 1px 0 rgba(255,255,255,0.5);
        font-family: ${MC_FONT};
      }
      
      .creative-grid {
        display: grid;
        grid-template-columns: repeat(9, 40px);
        gap: 2px;
        background: #8b8b8b;
        padding: 4px;
        border: 2px solid;
        border-color: #373737 #ffffff #ffffff #373737;
      }
      
      .creative-slot {
        width: 40px;
        height: 40px;
        background: #8b8b8b;
        border: 2px solid;
        border-color: #373737 #ffffff #ffffff #373737;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.05s;
      }
      
      .creative-slot:hover {
        transform: scale(1.1);
        z-index: 10;
        border-color: #ffff00 #aaaa00 #aaaa00 #ffff00;
      }
      
      .creative-slot:active {
        transform: scale(0.95);
      }
      
      .creative-slot.gamepad-focus {
        transform: scale(1.1);
        z-index: 10;
        border-color: #00ff00 #00aa00 #00aa00 #00ff00;
        box-shadow: 0 0 8px rgba(0, 255, 0, 0.6);
        animation: gamepad-slot-pulse 0.8s ease-in-out infinite;
      }
      
      @keyframes gamepad-slot-pulse {
        0%, 100% { box-shadow: 0 0 8px rgba(0, 255, 0, 0.6); }
        50% { box-shadow: 0 0 16px rgba(0, 255, 0, 0.9); }
      }
      
      .creative-slot-inner {
        width: 32px;
        height: 32px;
        background: #555550;
        border: 1px solid;
        border-color: #3a3a38 #7a7a75 #7a7a75 #3a3a38;
        display: flex;
        align-items: center;
        justify-content: center;
        perspective: 100px;
      }
      
      .creative-cube-container {
        width: 24px;
        height: 24px;
        transform-style: preserve-3d;
      }
      
      .creative-cube {
        width: 24px;
        height: 24px;
        position: relative;
        transform-style: preserve-3d;
        transform: rotateX(-30deg) rotateY(45deg);
      }
      
      .creative-cube .face {
        position: absolute;
        width: 24px;
        height: 24px;
        background-size: cover;
        background-position: center;
        image-rendering: pixelated;
        backface-visibility: hidden;
      }
      
      .creative-cube .face-top {
        transform: rotateX(90deg) translateZ(12px);
        filter: brightness(1.0);
      }
      
      .creative-cube .face-front {
        transform: translateZ(12px);
        filter: brightness(0.8);
      }
      
      .creative-cube .face-right {
        transform: rotateY(90deg) translateZ(12px);
        filter: brightness(0.6);
      }
      
      .creative-cube .face-left {
        transform: rotateY(-90deg) translateZ(12px);
        filter: brightness(0.7);
      }
      
      /* Flat sprite rendering for saplings, flowers, etc. */
      .creative-sprite {
        width: 24px;
        height: 24px;
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        image-rendering: pixelated;
      }
      
      .creative-tooltip {
        position: fixed;
        background: #1a0a30;
        border: 2px solid;
        border-color: #5000a0 #280050 #280050 #5000a0;
        padding: 6px 10px;
        font-family: ${MC_FONT};
        font-size: 14px;
        color: #ffffff;
        text-shadow: 2px 2px 0 #3f3f3f;
        pointer-events: none;
        z-index: 10001;
        display: none;
        white-space: nowrap;
      }
      
      .creative-close-hint {
        color: #606060;
        font-size: 12px;
        text-align: center;
        margin-top: 12px;
        font-family: ${MC_FONT};
      }
      
      .creative-tabs {
        display: flex;
        margin-bottom: -2px;
        z-index: 1;
      }
      
      .creative-tab {
        background: #8b8b8b;
        border: 2px solid;
        border-color: #ffffff #555555 transparent #ffffff;
        padding: 4px 12px;
        cursor: pointer;
        color: #404040;
        font-family: ${MC_FONT};
        font-size: 12px;
        margin-right: 2px;
      }
      
      .creative-tab.active {
        background: #c6c6c6;
        border-bottom-color: #c6c6c6;
        margin-bottom: -2px;
        padding-bottom: 6px;
      }
      
      .creative-tab:hover:not(.active) {
        background: #a0a0a0;
      }
      
      .creative-search-container {
        margin-bottom: 8px;
      }
      
      .creative-search {
        width: 100%;
        padding: 6px 8px;
        font-family: ${MC_FONT};
        font-size: 14px;
        background: #000000;
        border: 2px solid;
        border-color: #373737 #ffffff #ffffff #373737;
        color: #ffffff;
        outline: none;
      }
      
      .creative-search::placeholder {
        color: #606060;
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Create the inventory UI
   */
  private createInventoryUI(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'creative-inventory';
    
    container.innerHTML = `
      <div class="creative-tabs">
        <div class="creative-tab active">Building Blocks</div>
      </div>
      <div class="creative-panel">
        <div class="creative-title">Creative Inventory</div>
        <div class="creative-search-container">
          <input type="text" class="creative-search" placeholder="Search blocks..." id="creative-search">
        </div>
        <div class="creative-grid" id="creative-grid">
          <!-- Slots will be generated here -->
        </div>
      </div>
      <div class="creative-close-hint">Press E, ESC, or Circle/B to close • D-Pad to navigate • Cross/A to select</div>
    `;
    
    // Populate grid
    const grid = container.querySelector('#creative-grid') as HTMLDivElement;
    this.populateGrid(grid, CREATIVE_BLOCKS);
    
    // Search functionality
    const searchInput = container.querySelector('#creative-search') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      this.currentBlocks = CREATIVE_BLOCKS.filter(blockType => {
        const name = BLOCK_NAMES[blockType] || BlockType[blockType];
        return name.toLowerCase().includes(query);
      });
      this.populateGrid(grid, this.currentBlocks);
      
      // Reset focus to first slot after search
      this.focusedSlotIndex = 0;
      if (getGamepadManager().isConnected() && this.currentBlocks.length > 0) {
        this.setFocusedSlot(0);
      }
    });
    
    // Prevent clicks from propagating
    container.addEventListener('click', (e) => {
      if (e.target === container) {
        this.hide();
      }
    });
    
    return container;
  }
  
  /**
   * Populate the grid with block slots
   */
  private populateGrid(grid: HTMLDivElement, blocks: BlockType[]): void {
    grid.innerHTML = '';
    
    blocks.forEach(blockType => {
      const slot = this.createBlockSlot(blockType);
      grid.appendChild(slot);
    });
    
    // Fill remaining slots to complete rows (9 columns)
    const remainder = blocks.length % 9;
    if (remainder > 0) {
      for (let i = 0; i < 9 - remainder; i++) {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'creative-slot';
        emptySlot.innerHTML = '<div class="creative-slot-inner"></div>';
        grid.appendChild(emptySlot);
      }
    }
  }
  
  /**
   * Create a block slot element
   */
  private createBlockSlot(blockType: BlockType): HTMLDivElement {
    const slot = document.createElement('div');
    slot.className = 'creative-slot';
    slot.dataset.blockType = blockType.toString();
    
    const inner = document.createElement('div');
    inner.className = 'creative-slot-inner';
    
    // Check if this is a flat sprite (sapling, flower, door, etc.)
    if (isFlatSpriteBlock(blockType)) {
      // Render as flat 2D sprite
      const sprite = document.createElement('div');
      sprite.className = 'creative-sprite';
      
      const textureConfig = this.getTextureConfig(blockType);
      if (textureConfig) {
        sprite.style.backgroundImage = `url(${textureConfig.side})`;
      }
      
      inner.appendChild(sprite);
    } else {
      // Render as 3D cube
      const cubeContainer = document.createElement('div');
      cubeContainer.className = 'creative-cube-container';
      
      const cube = document.createElement('div');
      cube.className = 'creative-cube';
      
      // Get texture config
      const textureConfig = this.getTextureConfig(blockType);
      
      // Create faces with proper tinting using shared utility
      const faceConfigs: Array<{ name: 'top' | 'front' | 'right' | 'left'; brightness: number }> = [
        { name: 'top', brightness: FACE_BRIGHTNESS.top },
        { name: 'front', brightness: FACE_BRIGHTNESS.front },
        { name: 'right', brightness: FACE_BRIGHTNESS.right },
        { name: 'left', brightness: FACE_BRIGHTNESS.left },
      ];
      
      faceConfigs.forEach(({ name: faceName, brightness }) => {
        const face = document.createElement('div');
        face.className = `face face-${faceName}`;
        
        if (textureConfig) {
          const texturePath = faceName === 'top' 
            ? textureConfig.top 
            : textureConfig.side;
          face.style.backgroundImage = `url(${texturePath})`;
          
          // Apply unified tinting using shared utility
          face.style.filter = getFaceFilter(blockType, faceName, brightness);
        } else {
          // Fallback color using shared utility
          const color = getBlockFallbackColor(blockType);
          face.style.backgroundColor = color;
        }
        
        cube.appendChild(face);
      });
      
      cubeContainer.appendChild(cube);
      inner.appendChild(cubeContainer);
    }
    
    slot.appendChild(inner);
    
    // Click handler - add to inventory
    slot.addEventListener('click', () => {
      this.addBlockToInventory(blockType);
    });
    
    // Hover handlers for tooltip
    slot.addEventListener('mouseenter', (e) => {
      const name = BLOCK_NAMES[blockType] || BlockType[blockType];
      this.showTooltip(name, e.clientX, e.clientY);
    });
    
    slot.addEventListener('mousemove', (e) => {
      this.moveTooltip(e.clientX, e.clientY);
    });
    
    slot.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });
    
    return slot;
  }
  
  /**
   * Get texture configuration for a block type
   */
  private getTextureConfig(blockType: BlockType): { top: string; side: string; bottom: string } | null {
    const config = BLOCK_TEXTURES[blockType];
    if (!config) return null;
    
    if (typeof config === 'string') {
      return { top: config, side: config, bottom: config };
    }
    
    return {
      top: config.top,
      side: config.side,
      bottom: config.bottom || config.side,
    };
  }
  
  /**
   * Add a block to the player's inventory
   */
  private addBlockToInventory(blockType: BlockType): void {
    const item: HotbarItem = {
      blockType,
      count: 64, // Creative mode gives full stacks
      name: BLOCK_NAMES[blockType] || BlockType[blockType],
    };
    
    const added = this.inventoryHUD.addItem(item);
    
    if (added) {
      getSoundManager().playUIClick();
    }
  }
  
  /**
   * Create tooltip element
   */
  private createTooltip(): HTMLDivElement {
    const tooltip = document.createElement('div');
    tooltip.className = 'creative-tooltip';
    return tooltip;
  }
  
  /**
   * Show tooltip at position
   */
  private showTooltip(text: string, x: number, y: number): void {
    this.tooltip.textContent = text;
    this.tooltip.style.display = 'block';
    this.moveTooltip(x, y);
  }
  
  /**
   * Move tooltip to position
   */
  private moveTooltip(x: number, y: number): void {
    const offset = 15;
    this.tooltip.style.left = `${x + offset}px`;
    this.tooltip.style.top = `${y + offset}px`;
    
    // Keep tooltip on screen
    const rect = this.tooltip.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.tooltip.style.left = `${x - rect.width - offset}px`;
    }
    if (rect.bottom > window.innerHeight) {
      this.tooltip.style.top = `${y - rect.height - offset}px`;
    }
  }
  
  /**
   * Hide tooltip
   */
  private hideTooltip(): void {
    this.tooltip.style.display = 'none';
  }
  
  /**
   * Set up gamepad navigation for the inventory
   */
  private setupGamepadNavigation(): void {
    const gamepad = getGamepadManager();
    
    // Save current callbacks
    this.savedGamepadCallbacks = {
      onMenuNavigate: gamepad.onMenuNavigate,
      onMenuSelect: gamepad.onMenuSelect,
      onMenuBack: gamepad.onMenuBack,
    };
    
    // Set up inventory-specific callbacks
    gamepad.onMenuNavigate = (direction) => {
      this.navigateSlot(direction);
    };
    
    gamepad.onMenuSelect = () => {
      this.selectFocusedSlot();
    };
    
    gamepad.onMenuBack = () => {
      this.hide();
    };
    
    // Enable menu mode for gamepad
    gamepad.setMenuMode(true);
  }
  
  /**
   * Restore previous gamepad callbacks
   */
  private restoreGamepadCallbacks(): void {
    const gamepad = getGamepadManager();
    
    gamepad.onMenuNavigate = this.savedGamepadCallbacks.onMenuNavigate;
    gamepad.onMenuSelect = this.savedGamepadCallbacks.onMenuSelect;
    gamepad.onMenuBack = this.savedGamepadCallbacks.onMenuBack;
    
    // Disable menu mode
    gamepad.setMenuMode(false);
  }
  
  /**
   * Navigate to a slot in the given direction
   */
  private navigateSlot(direction: 'up' | 'down' | 'left' | 'right'): void {
    const totalSlots = this.currentBlocks.length;
    if (totalSlots === 0) return;
    
    // Calculate rows
    const rows = Math.ceil(totalSlots / this.GRID_COLUMNS);
    const currentRow = Math.floor(this.focusedSlotIndex / this.GRID_COLUMNS);
    const currentCol = this.focusedSlotIndex % this.GRID_COLUMNS;
    
    let newRow = currentRow;
    let newCol = currentCol;
    
    switch (direction) {
      case 'up':
        newRow = currentRow > 0 ? currentRow - 1 : rows - 1;
        break;
      case 'down':
        newRow = currentRow < rows - 1 ? currentRow + 1 : 0;
        break;
      case 'left':
        if (currentCol > 0) {
          newCol = currentCol - 1;
        } else {
          // Wrap to end of previous row
          newCol = this.GRID_COLUMNS - 1;
          newRow = currentRow > 0 ? currentRow - 1 : rows - 1;
        }
        break;
      case 'right':
        if (currentCol < this.GRID_COLUMNS - 1) {
          newCol = currentCol + 1;
        } else {
          // Wrap to start of next row
          newCol = 0;
          newRow = currentRow < rows - 1 ? currentRow + 1 : 0;
        }
        break;
    }
    
    // Calculate new index and clamp to valid range
    let newIndex = newRow * this.GRID_COLUMNS + newCol;
    
    // Make sure we don't go beyond the last block
    if (newIndex >= totalSlots) {
      // If we went past the end, go to the last valid slot in that row
      // or wrap around
      if (direction === 'down' || direction === 'right') {
        newIndex = 0; // Wrap to start
      } else {
        newIndex = totalSlots - 1; // Go to last slot
      }
    }
    
    this.setFocusedSlot(newIndex);
    getSoundManager().playUIClick();
  }
  
  /**
   * Set the focused slot and update visual
   */
  private setFocusedSlot(index: number): void {
    // Remove focus from old slot
    const slots = this.container.querySelectorAll('.creative-slot');
    slots.forEach(slot => slot.classList.remove('gamepad-focus'));
    
    // Set new focus
    this.focusedSlotIndex = Math.max(0, Math.min(index, this.currentBlocks.length - 1));
    
    // Add focus to new slot
    const newSlot = slots[this.focusedSlotIndex] as HTMLElement;
    if (newSlot && this.currentBlocks[this.focusedSlotIndex] !== undefined) {
      newSlot.classList.add('gamepad-focus');
      
      // Update tooltip
      const blockType = this.currentBlocks[this.focusedSlotIndex];
      const name = BLOCK_NAMES[blockType] || BlockType[blockType];
      const rect = newSlot.getBoundingClientRect();
      this.showTooltip(name, rect.right, rect.top);
    }
  }
  
  /**
   * Select the currently focused slot (add block to inventory)
   */
  private selectFocusedSlot(): void {
    if (this.focusedSlotIndex < this.currentBlocks.length) {
      const blockType = this.currentBlocks[this.focusedSlotIndex];
      this.addBlockToInventory(blockType);
    }
  }
  
  /**
   * Show the creative inventory
   */
  show(): void {
    if (this.isVisible) return;
    
    this.isVisible = true;
    this.container.style.display = 'flex';
    
    // Focus search input (but don't focus if using gamepad)
    const searchInput = this.container.querySelector('#creative-search') as HTMLInputElement;
    searchInput.value = '';
    
    // Reset grid
    const grid = this.container.querySelector('#creative-grid') as HTMLDivElement;
    this.currentBlocks = [...CREATIVE_BLOCKS];
    this.populateGrid(grid, this.currentBlocks);
    
    // Reset focus to first slot
    this.focusedSlotIndex = 0;
    
    // Set up gamepad navigation
    this.setupGamepadNavigation();
    
    // Set initial focus for gamepad (after a small delay to ensure grid is rendered)
    setTimeout(() => {
      if (getGamepadManager().isConnected()) {
        this.setFocusedSlot(0);
      } else {
        searchInput.focus();
      }
    }, 50);
    
    getSoundManager().playUIClick();
    this.onOpen?.();
  }
  
  /**
   * Hide the creative inventory
   */
  hide(): void {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    this.container.style.display = 'none';
    this.hideTooltip();
    
    // Restore gamepad callbacks
    this.restoreGamepadCallbacks();
    
    this.onClose?.();
  }
  
  /**
   * Toggle visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * Check if inventory is visible
   */
  isInventoryVisible(): boolean {
    return this.isVisible;
  }
  
  /**
   * Clean up
   */
  destroy(): void {
    this.container.remove();
    this.tooltip.remove();
    const styles = document.getElementById('creative-inventory-styles');
    if (styles) styles.remove();
  }
}


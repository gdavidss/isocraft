/**
 * Minecraft-style inventory hotbar HUD
 * Shows isometric 3D cube icons for blocks
 * Uses Minecraft-style font for authentic look
 */

import { BlockType } from '../world/types';
import { getSoundManager } from './SoundManager';
import { MC_FONT, MC_FONT_FACE } from './DebugUI3D';
import {
  isFlatSpriteBlock,
  getFaceFilter,
  getBlockFallbackColor,
  FACE_BRIGHTNESS,
  type BlockTextureConfig,
} from './BlockIconUtils';

// Items that can be in the hotbar
export interface HotbarItem {
  blockType: BlockType;
  count: number;
  name: string;
  icon?: string; // texture path
}

export class InventoryHUD {
  private container: HTMLDivElement;
  private slots: HTMLDivElement[] = [];
  private selectedSlot: number = 0;
  private items: (HotbarItem | null)[] = new Array(9).fill(null);
  private selectorHighlight: HTMLDivElement;
  
  // Texture mapping for block icons - supports different textures per face
  private static readonly BLOCK_TEXTURES: Partial<Record<BlockType, BlockTextureConfig | string>> = {
    // Blocks with different top/side textures
    [BlockType.Grass]: {
      top: '/textures/grass_block_top.png',
      side: '/textures/grass_block_side.png',
    },
    [BlockType.Podzol]: {
      top: '/textures/podzol_top.png',
      side: '/textures/podzol_side.png',
    },
    [BlockType.Mycelium]: {
      top: '/textures/mycelium_top.png',
      side: '/textures/mycelium_side.png',
    },
    [BlockType.Snow]: {
      top: '/textures/snow.png',
      side: '/textures/snow.png',
    },
    // Logs have different top/side textures (top shows growth rings, side shows bark)
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
    // Uniform blocks (same texture all sides)
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
    [BlockType.Water]: '/textures/water_still.png',
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
  
  constructor() {
    // Inject CSS for 3D cube rendering
    this.injectStyles();
    
    this.container = this.createHotbar();
    this.selectorHighlight = this.createSelectorHighlight();
    this.container.appendChild(this.selectorHighlight);
    document.body.appendChild(this.container);
    this.setupKeyboardInput();
    this.updateDisplay();
  }
  
  /**
   * Inject CSS styles for isometric cube rendering
   */
  private injectStyles(): void {
    // Inject Minecraft font if not already present
    if (!document.getElementById('minecraft-font-styles')) {
      const fontStyle = document.createElement('style');
      fontStyle.id = 'minecraft-font-styles';
      fontStyle.textContent = MC_FONT_FACE;
      document.head.appendChild(fontStyle);
    }
    
    if (document.getElementById('inventory-cube-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'inventory-cube-styles';
    style.textContent = `
      .iso-cube {
        width: 12px;
        height: 12px;
        position: relative;
        transform-style: preserve-3d;
        transform: rotateX(-30deg) rotateY(45deg);
      }
      
      .iso-cube .face {
        position: absolute;
        width: 12px;
        height: 12px;
        background-size: cover;
        background-position: center;
        image-rendering: pixelated;
        backface-visibility: hidden;
      }
      
      .iso-cube .face-top {
        transform: rotateX(90deg) translateZ(6px);
        filter: brightness(1.0);
      }
      
      .iso-cube .face-front {
        transform: translateZ(6px);
        filter: brightness(0.8);
      }
      
      .iso-cube .face-right {
        transform: rotateY(90deg) translateZ(6px);
        filter: brightness(0.6);
      }
      
      .iso-cube .face-left {
        transform: rotateY(-90deg) translateZ(6px);
        filter: brightness(0.7);
      }
    `;
    document.head.appendChild(style);
  }
  
  private createHotbar(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'hotbar';
    container.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%) scale(2);
      transform-origin: bottom center;
      display: flex;
      gap: 0px;
      background: #8b8b8b;
      border: 2px solid #000;
      image-rendering: pixelated;
      z-index: 1000;
    `;
    
    // Create 9 slots
    for (let i = 0; i < 9; i++) {
      const slot = this.createSlot(i);
      this.slots.push(slot);
      container.appendChild(slot);
    }
    
    return container;
  }
  
  private createSlot(index: number): HTMLDivElement {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot';
    slot.dataset.index = index.toString();
    slot.style.cssText = `
      width: 20px;
      height: 20px;
      background: #8b8b8b;
      border: 1px solid;
      border-color: #373737 #ffffff #ffffff #373737;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    `;
    
    // Inner dark slot area (the actual inventory square)
    const innerSlot = document.createElement('div');
    innerSlot.className = 'slot-inner';
    innerSlot.style.cssText = `
      width: 16px;
      height: 16px;
      background: #555550;
      border: 1px solid;
      border-color: #3a3a38 #7a7a75 #7a7a75 #3a3a38;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      perspective: 50px;
    `;
    slot.appendChild(innerSlot);
    
    // 3D cube container for item
    const cubeContainer = document.createElement('div');
    cubeContainer.className = 'cube-container';
    cubeContainer.style.cssText = `
      width: 12px;
      height: 12px;
      display: none;
      transform-style: preserve-3d;
    `;
    innerSlot.appendChild(cubeContainer);
    
    // Create isometric cube
    const cube = document.createElement('div');
    cube.className = 'iso-cube';
    cubeContainer.appendChild(cube);
    
    // Top face
    const faceTop = document.createElement('div');
    faceTop.className = 'face face-top';
    cube.appendChild(faceTop);
    
    // Front face (visible from isometric view)
    const faceFront = document.createElement('div');
    faceFront.className = 'face face-front';
    cube.appendChild(faceFront);
    
    // Right face (visible from isometric view)
    const faceRight = document.createElement('div');
    faceRight.className = 'face face-right';
    cube.appendChild(faceRight);
    
    // Left face (visible from isometric view)
    const faceLeft = document.createElement('div');
    faceLeft.className = 'face face-left';
    cube.appendChild(faceLeft);
    
    // Flat sprite for 2D items (saplings, doors, trapdoors)
    const sprite = document.createElement('div');
    sprite.className = 'slot-sprite';
    sprite.style.cssText = `
      width: 12px;
      height: 12px;
      display: none;
      background-size: contain;
      background-position: center;
      background-repeat: no-repeat;
      image-rendering: pixelated;
    `;
    innerSlot.appendChild(sprite);
    
    // Item count
    const countLabel = document.createElement('span');
    countLabel.className = 'slot-count';
    countLabel.style.cssText = `
      position: absolute;
      bottom: 1px;
      right: 2px;
      font-family: ${MC_FONT};
      font-size: 6px;
      color: white;
      text-shadow: 1px 1px 0 #3f3f3f;
      pointer-events: none;
      z-index: 10;
      -webkit-font-smoothing: none;
    `;
    slot.appendChild(countLabel);
    
    // Click to select
    slot.addEventListener('click', () => {
      this.selectSlot(index);
    });
    
    return slot;
  }
  
  private createSelectorHighlight(): HTMLDivElement {
    const highlight = document.createElement('div');
    highlight.id = 'hotbar-selector';
    highlight.style.cssText = `
      position: absolute;
      width: 24px;
      height: 24px;
      border: 1px solid #fff;
      outline: 1px solid #000;
      pointer-events: none;
      z-index: 1001;
      box-sizing: border-box;
      top: -2px;
      left: -2px;
    `;
    return highlight;
  }
  
  private setupKeyboardInput(): void {
    window.addEventListener('keydown', (e) => {
      // Number keys 1-9 to select slots
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        const slotIndex = parseInt(e.code.replace('Digit', '')) - 1;
        this.selectSlot(slotIndex);
      }
    });
    
    // Mouse wheel to cycle slots
    window.addEventListener('wheel', (e) => {
      // Only if not over another scrollable element
      if (e.target === document.body || (e.target as HTMLElement).tagName === 'CANVAS') {
        // Don't interfere with zoom - only when shift is held
        if (e.shiftKey) {
          e.preventDefault();
          if (e.deltaY > 0) {
            this.selectSlot((this.selectedSlot + 1) % 9);
          } else {
            this.selectSlot((this.selectedSlot + 8) % 9);
          }
        }
      }
    }, { passive: false });
  }
  
  selectSlot(index: number): void {
    if (index < 0 || index > 8) return;
    if (this.selectedSlot !== index) {
      getSoundManager().playUIClick();
    }
    this.selectedSlot = index;
    this.updateDisplay();
  }
  
  getSelectedSlot(): number {
    return this.selectedSlot;
  }
  
  getSelectedItem(): HotbarItem | null {
    return this.items[this.selectedSlot];
  }
  
  setItem(slot: number, item: HotbarItem | null): void {
    if (slot < 0 || slot > 8) return;
    this.items[slot] = item;
    this.updateDisplay();
  }
  
  getItem(slot: number): HotbarItem | null {
    if (slot < 0 || slot > 8) return null;
    return this.items[slot];
  }
  
  /**
   * Remove items from a slot (for placing blocks)
   * Returns true if items were removed, false if not enough items
   */
  removeItem(slot: number, count: number = 1): boolean {
    if (slot < 0 || slot > 8) return false;
    
    const item = this.items[slot];
    if (!item || item.count < count) return false;
    
    item.count -= count;
    
    // Remove item entirely if count reaches 0
    if (item.count <= 0) {
      this.items[slot] = null;
    }
    
    this.updateDisplay();
    return true;
  }
  
  /**
   * Add item to inventory (like Minecraft pickup behavior)
   * First tries to stack with existing items, then finds empty slot
   * Returns true if item was added, false if inventory is full
   */
  addItem(item: HotbarItem): boolean {
    const MAX_STACK = 64;
    let remaining = item.count;
    
    // First pass: try to stack with existing items of same type
    for (let i = 0; i < 9; i++) {
      if (remaining <= 0) break;
      
      const existingItem = this.items[i];
      if (existingItem && existingItem.blockType === item.blockType) {
        const canAdd = MAX_STACK - existingItem.count;
        const toAdd = Math.min(canAdd, remaining);
        
        if (toAdd > 0) {
          existingItem.count += toAdd;
          remaining -= toAdd;
        }
      }
    }
    
    // Second pass: find empty slots for remaining items
    for (let i = 0; i < 9; i++) {
      if (remaining <= 0) break;
      
      if (!this.items[i]) {
        const toAdd = Math.min(MAX_STACK, remaining);
        this.items[i] = {
          blockType: item.blockType,
          count: toAdd,
          name: item.name,
          icon: item.icon,
        };
        remaining -= toAdd;
      }
    }
    
    // Update display
    this.updateDisplay();
    
    // Return true if at least some items were added
    return remaining < item.count;
  }
  
  /**
   * Remove items from selected slot
   * Returns the removed count
   */
  removeFromSelected(count: number = 1): number {
    const item = this.items[this.selectedSlot];
    if (!item) return 0;
    
    const toRemove = Math.min(count, item.count);
    item.count -= toRemove;
    
    if (item.count <= 0) {
      this.items[this.selectedSlot] = null;
    }
    
    this.updateDisplay();
    return toRemove;
  }
  
  /**
   * Check if inventory has space for an item
   */
  hasSpaceFor(blockType: BlockType, count: number = 1): boolean {
    const MAX_STACK = 64;
    let remaining = count;
    
    // Check existing stacks
    for (let i = 0; i < 9; i++) {
      const existingItem = this.items[i];
      if (existingItem && existingItem.blockType === blockType) {
        remaining -= (MAX_STACK - existingItem.count);
      } else if (!existingItem) {
        remaining -= MAX_STACK;
      }
      
      if (remaining <= 0) return true;
    }
    
    return remaining <= 0;
  }
  
  /**
   * Get texture configuration for a block type
   */
  private getTextureConfig(blockType: BlockType): { top: string; side: string; bottom: string } | null {
    const config = InventoryHUD.BLOCK_TEXTURES[blockType];
    if (!config) return null;
    
    if (typeof config === 'string') {
      // Uniform texture for all faces
      return { top: config, side: config, bottom: config };
    }
    
    // Multi-face texture config
    return {
      top: config.top,
      side: config.side,
      bottom: config.bottom || config.side,
    };
  }
  
  private updateDisplay(): void {
    this.slots.forEach((slot, index) => {
      const item = this.items[index];
      const innerSlot = slot.querySelector('.slot-inner') as HTMLDivElement;
      const cubeContainer = innerSlot?.querySelector('.cube-container') as HTMLDivElement;
      const cube = cubeContainer?.querySelector('.iso-cube') as HTMLDivElement;
      const sprite = innerSlot?.querySelector('.slot-sprite') as HTMLDivElement;
      const countLabel = slot.querySelector('.slot-count') as HTMLSpanElement;
      
      if (!cubeContainer || !cube || !sprite) return;
      
      // Update item display
      if (item) {
        const textureConfig = this.getTextureConfig(item.blockType);
        const isFlat = isFlatSpriteBlock(item.blockType);
        
        if (isFlat && textureConfig) {
          // Show flat sprite for saplings, doors, trapdoors
          cubeContainer.style.display = 'none';
          sprite.style.display = 'block';
          sprite.style.backgroundImage = `url(${textureConfig.side})`;
        } else if (textureConfig) {
          // Show 3D cube
          cubeContainer.style.display = 'block';
          sprite.style.display = 'none';
          
          const faceTop = cube.querySelector('.face-top') as HTMLDivElement;
          const faceFront = cube.querySelector('.face-front') as HTMLDivElement;
          const faceRight = cube.querySelector('.face-right') as HTMLDivElement;
          const faceLeft = cube.querySelector('.face-left') as HTMLDivElement;
          
          if (faceTop) {
            faceTop.style.backgroundImage = `url(${textureConfig.top})`;
            faceTop.style.filter = getFaceFilter(item.blockType, 'top', FACE_BRIGHTNESS.top);
          }
          if (faceFront) {
            faceFront.style.backgroundImage = `url(${textureConfig.side})`;
            faceFront.style.filter = getFaceFilter(item.blockType, 'front', FACE_BRIGHTNESS.front);
          }
          if (faceRight) {
            faceRight.style.backgroundImage = `url(${textureConfig.side})`;
            faceRight.style.filter = getFaceFilter(item.blockType, 'right', FACE_BRIGHTNESS.right);
          }
          if (faceLeft) {
            faceLeft.style.backgroundImage = `url(${textureConfig.side})`;
            faceLeft.style.filter = getFaceFilter(item.blockType, 'left', FACE_BRIGHTNESS.left);
          }
        } else {
          // Fallback: show colored cube using shared utility
          cubeContainer.style.display = 'block';
          sprite.style.display = 'none';
          const color = getBlockFallbackColor(item.blockType);
          
          const faceTop = cube.querySelector('.face-top') as HTMLDivElement;
          const faceFront = cube.querySelector('.face-front') as HTMLDivElement;
          const faceRight = cube.querySelector('.face-right') as HTMLDivElement;
          const faceLeft = cube.querySelector('.face-left') as HTMLDivElement;
          
          if (faceTop) {
            faceTop.style.backgroundImage = 'none';
            faceTop.style.backgroundColor = color;
            faceTop.style.filter = `brightness(${FACE_BRIGHTNESS.top})`;
          }
          if (faceFront) {
            faceFront.style.backgroundImage = 'none';
            faceFront.style.backgroundColor = color;
            faceFront.style.filter = `brightness(${FACE_BRIGHTNESS.front})`;
          }
          if (faceRight) {
            faceRight.style.backgroundImage = 'none';
            faceRight.style.backgroundColor = color;
            faceRight.style.filter = `brightness(${FACE_BRIGHTNESS.right})`;
          }
          if (faceLeft) {
            faceLeft.style.backgroundImage = 'none';
            faceLeft.style.backgroundColor = color;
            faceLeft.style.filter = `brightness(${FACE_BRIGHTNESS.left})`;
          }
        }
        
        // Show count if more than 1
        if (item.count > 1) {
          countLabel.textContent = item.count.toString();
          countLabel.style.display = 'block';
        } else {
          countLabel.style.display = 'none';
        }
      } else {
        // Hide cube and sprite when slot is empty
        cubeContainer.style.display = 'none';
        sprite.style.display = 'none';
        countLabel.style.display = 'none';
      }
    });
    
    // Update selector highlight position
    this.updateSelectorPosition();
  }
  
  private updateSelectorPosition(): void {
    // Position based on slot index (each slot is 20px wide)
    const slotWidth = 20;
    const left = this.selectedSlot * slotWidth - 2;
    this.selectorHighlight.style.left = `${left}px`;
  }
  
  destroy(): void {
    this.container.remove();
    const styles = document.getElementById('inventory-cube-styles');
    if (styles) styles.remove();
  }
}

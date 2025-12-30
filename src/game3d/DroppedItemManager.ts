/**
 * Dropped Item Manager
 * 
 * Manages all dropped items in the world:
 * - Spawns new dropped items when blocks are broken
 * - Updates all items each frame (physics, animation, attraction)
 * - Handles item pickup and inventory integration
 * - Handles merging nearby identical items
 */

import * as THREE from 'three';
import { DroppedItem, DroppedItemData } from './DroppedItem';
import { BlockType } from '../world/types';
import { TextureManager3D } from './TextureManager3D';
import type { InventoryHUD } from './InventoryHUD';
import { getSoundManager } from './SoundManager';

export class DroppedItemManager {
  private scene: THREE.Scene;
  private textureManager: TextureManager3D;
  private inventoryHUD: InventoryHUD;
  private items: DroppedItem[] = [];
  private getGroundHeight: (x: number, z: number) => number;
  
  // Callback for when item is picked up
  public onItemPickup?: (blockType: BlockType, count: number) => void;
  
  constructor(
    scene: THREE.Scene,
    textureManager: TextureManager3D,
    inventoryHUD: InventoryHUD,
    getGroundHeight: (x: number, z: number) => number
  ) {
    this.scene = scene;
    this.textureManager = textureManager;
    this.inventoryHUD = inventoryHUD;
    this.getGroundHeight = getGroundHeight;
  }
  
  /**
   * Spawn a dropped item at a position
   */
  spawnItem(
    blockType: BlockType,
    position: THREE.Vector3,
    count: number = 1,
    velocity?: THREE.Vector3
  ): DroppedItem | null {
    // Don't drop air blocks
    if (blockType === BlockType.Air) return null;
    
    // Get materials for dropped items - may be single or array for multi-face blocks
    const materials = this.textureManager.getDroppedItemMaterials(blockType);
    
    const data: DroppedItemData = {
      blockType,
      count,
      position,
      velocity,
    };
    
    const item = new DroppedItem(this.scene, data, materials);
    this.items.push(item);
    
    return item;
  }
  
  /**
   * Spawn multiple items with spread (like breaking a block)
   */
  spawnItemsFromBlock(
    blockType: BlockType,
    blockPosition: THREE.Vector3,
    count: number = 1
  ): void {
    // Spawn from center of block
    const spawnPos = blockPosition.clone();
    spawnPos.y += 0.5; // Spawn from middle of block
    
    this.spawnItem(blockType, spawnPos, count);
  }
  
  /**
   * Update all dropped items
   */
  update(deltaTime: number, playerPosition: THREE.Vector3): void {
    // First, update all items
    for (const item of this.items) {
      item.update(deltaTime, playerPosition, this.getGroundHeight);
    }
    
    // Handle merging of nearby items
    this.mergeNearbyItems();
    
    // Handle pickups and remove despawned items
    const itemsToRemove: DroppedItem[] = [];
    
    for (const item of this.items) {
      if (item.isPickedUp) {
        // Try to add to inventory
        const added = this.inventoryHUD.addItem({
          blockType: item.blockType,
          count: item.count,
          name: this.getBlockName(item.blockType),
        });
        
        if (added) {
          // Callback for pickup effects
          if (this.onItemPickup) {
            this.onItemPickup(item.blockType, item.count);
          }
          
          // Play pickup sound
          getSoundManager().playItemPickup();
          
          itemsToRemove.push(item);
        } else {
          // Inventory full - don't pickup
          item.isPickedUp = false;
        }
      } else if (item.shouldDespawn) {
        itemsToRemove.push(item);
      }
    }
    
    // Remove processed items
    for (const item of itemsToRemove) {
      item.destroy();
      const index = this.items.indexOf(item);
      if (index !== -1) {
        this.items.splice(index, 1);
      }
    }
  }
  
  /**
   * Merge nearby identical items
   */
  private mergeNearbyItems(): void {
    // Check each pair of items for merging
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (item.shouldDespawn || item.isPickedUp) continue;
      
      for (let j = i + 1; j < this.items.length; j++) {
        const other = this.items[j];
        if (other.shouldDespawn || other.isPickedUp) continue;
        
        if (item.canMergeWith(other)) {
          item.mergeFrom(other);
        }
      }
    }
  }
  
  /**
   * Get human-readable block name
   */
  private getBlockName(blockType: BlockType): string {
    const names: Partial<Record<BlockType, string>> = {
      [BlockType.Grass]: 'Grass Block',
      [BlockType.Dirt]: 'Dirt',
      [BlockType.Stone]: 'Stone',
      [BlockType.Sand]: 'Sand',
      [BlockType.Gravel]: 'Gravel',
      [BlockType.Water]: 'Water',
      [BlockType.Ice]: 'Ice',
      [BlockType.Snow]: 'Snow',
      [BlockType.SnowBlock]: 'Snow Block',
      [BlockType.Clay]: 'Clay',
      [BlockType.OakLog]: 'Oak Log',
      [BlockType.BirchLog]: 'Birch Log',
      [BlockType.SpruceLog]: 'Spruce Log',
      [BlockType.JungleLog]: 'Jungle Log',
      [BlockType.AcaciaLog]: 'Acacia Log',
      [BlockType.DarkOakLog]: 'Dark Oak Log',
      [BlockType.CherryLog]: 'Cherry Log',
      [BlockType.MangroveLog]: 'Mangrove Log',
      [BlockType.OakLeaves]: 'Oak Leaves',
      [BlockType.BirchLeaves]: 'Birch Leaves',
      [BlockType.SpruceLeaves]: 'Spruce Leaves',
      [BlockType.JungleLeaves]: 'Jungle Leaves',
      [BlockType.AcaciaLeaves]: 'Acacia Leaves',
      [BlockType.DarkOakLeaves]: 'Dark Oak Leaves',
      [BlockType.CherryLeaves]: 'Cherry Leaves',
      [BlockType.MangroveLeaves]: 'Mangrove Leaves',
      [BlockType.Cactus]: 'Cactus',
      [BlockType.Podzol]: 'Podzol',
      [BlockType.Mycelium]: 'Mycelium',
      [BlockType.PackedIce]: 'Packed Ice',
      [BlockType.BlueIce]: 'Blue Ice',
      [BlockType.RedSand]: 'Red Sand',
      [BlockType.Terracotta]: 'Terracotta',
      // Saplings
      [BlockType.OakSapling]: 'Oak Sapling',
      [BlockType.BirchSapling]: 'Birch Sapling',
      [BlockType.SpruceSapling]: 'Spruce Sapling',
      [BlockType.JungleSapling]: 'Jungle Sapling',
      [BlockType.AcaciaSapling]: 'Acacia Sapling',
      [BlockType.DarkOakSapling]: 'Dark Oak Sapling',
      [BlockType.CherrySapling]: 'Cherry Sapling',
      [BlockType.MangroveSapling]: 'Mangrove Propagule',
    };
    
    return names[blockType] || 'Block';
  }
  
  /**
   * Get count of dropped items
   */
  getItemCount(): number {
    return this.items.length;
  }
  
  /**
   * Clean up all items
   */
  destroy(): void {
    for (const item of this.items) {
      item.destroy();
    }
    this.items = [];
  }
}


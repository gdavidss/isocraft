/**
 * Block Breaking System - Minecraft-style progressive block destruction
 * 
 * Features:
 * - 10 destroy stages (0-9) with crack overlay textures
 * - Block hardness determines break time
 * - Visual crack progression overlay
 * - Break progress resets if player looks away or stops clicking
 * 
 * Minecraft break time formula: time = hardness * 1.5 (by hand, no tool bonuses)
 * Reference times by hand:
 * - Dirt/Sand/Gravel: 0.75s (hardness 0.5)
 * - Grass Block: 0.9s (hardness 0.6)
 * - Wood/Logs: 3s (hardness 2.0)
 * - Leaves: 0.3s (hardness 0.2) - instant with shears
 * - Stone: 7.5s (hardness 1.5 but needs pickaxe, 5x penalty = 7.5s)
 * - Cobblestone: 10s (hardness 2.0 but needs pickaxe)
 */

import * as THREE from 'three';
import { BlockType } from '../world/types';

// Block hardness values (Minecraft wiki reference)
// Break time = hardness * 1.5 for hand, or hardness * 5 if wrong tool
const BLOCK_HARDNESS: Partial<Record<BlockType, number>> = {
  // Instant break (hardness 0)
  [BlockType.TallGrass]: 0,
  [BlockType.DeadBush]: 0,
  [BlockType.Fern]: 0,
  
  // Very soft (0.2 - 0.3s)
  [BlockType.OakLeaves]: 0.2,
  [BlockType.BirchLeaves]: 0.2,
  [BlockType.SpruceLeaves]: 0.2,
  [BlockType.JungleLeaves]: 0.2,
  [BlockType.AcaciaLeaves]: 0.2,
  [BlockType.DarkOakLeaves]: 0.2,
  [BlockType.CherryLeaves]: 0.2,
  [BlockType.MangroveLeaves]: 0.2,
  
  // Soft blocks (0.5 - 0.6 hardness = 0.75-0.9s)
  [BlockType.Dirt]: 0.5,
  [BlockType.Sand]: 0.5,
  [BlockType.RedSand]: 0.5,
  [BlockType.Gravel]: 0.6,
  [BlockType.Clay]: 0.6,
  [BlockType.Snow]: 0.2,
  [BlockType.SnowBlock]: 0.2,
  [BlockType.Grass]: 0.6,
  [BlockType.Podzol]: 0.5,
  [BlockType.Mycelium]: 0.6,
  
  // Medium blocks (2.0 hardness = 3s by hand)
  [BlockType.OakLog]: 2.0,
  [BlockType.BirchLog]: 2.0,
  [BlockType.SpruceLog]: 2.0,
  [BlockType.JungleLog]: 2.0,
  [BlockType.AcaciaLog]: 2.0,
  [BlockType.DarkOakLog]: 2.0,
  [BlockType.CherryLog]: 2.0,
  [BlockType.MangroveLog]: 2.0,
  
  // Hard blocks (need pickaxe - 5x time penalty by hand)
  [BlockType.Stone]: 1.5,      // 1.5 * 5 = 7.5s by hand
  [BlockType.Terracotta]: 1.25, // 1.25 * 5 = 6.25s
  [BlockType.Ice]: 0.5,
  [BlockType.PackedIce]: 0.5,
  [BlockType.BlueIce]: 2.8,
  
  // Cactus (instant by hand)
  [BlockType.Cactus]: 0.4,
  
  // Saplings (instant)
  [BlockType.OakSapling]: 0,
  [BlockType.BirchSapling]: 0,
  [BlockType.SpruceSapling]: 0,
  [BlockType.JungleSapling]: 0,
  [BlockType.AcaciaSapling]: 0,
  [BlockType.DarkOakSapling]: 0,
  [BlockType.CherrySapling]: 0,
  [BlockType.MangroveSapling]: 0,
};

// Blocks that require a pickaxe (5x time penalty when breaking by hand)
const REQUIRES_PICKAXE = new Set([
  BlockType.Stone,
  BlockType.Terracotta,
  BlockType.Ice,
  BlockType.PackedIce,
  BlockType.BlueIce,
]);

// Default hardness for blocks not in the list
const DEFAULT_HARDNESS = 1.0;

// Number of destroy stages (0-9)
const DESTROY_STAGES = 10;

/**
 * Get break time for a block in seconds (by hand)
 */
export function getBlockBreakTime(blockType: BlockType): number {
  const hardness = BLOCK_HARDNESS[blockType] ?? DEFAULT_HARDNESS;
  
  // Instant break for 0 hardness
  if (hardness === 0) return 0;
  
  // Base break time
  let breakTime = hardness * 1.5;
  
  // Apply 5x penalty for blocks that need pickaxe
  if (REQUIRES_PICKAXE.has(blockType)) {
    breakTime *= 5;
  }
  
  return breakTime;
}

export class BlockBreaking {
  private scene: THREE.Scene;
  private breakingMesh: THREE.Mesh | null = null;
  private breakingOverlays: THREE.Texture[] = [];
  
  // Current breaking state
  private targetBlock: THREE.Vector3 | null = null;
  private targetBlockType: BlockType | null = null;
  private breakProgress: number = 0; // 0 to 1
  private breakTime: number = 0; // Total time needed
  private currentStage: number = -1; // -1 = not breaking
  
  // Material for overlay
  private overlayMaterial: THREE.MeshBasicMaterial;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    
    // Create overlay material (will update texture based on stage)
    // Black cracks on transparent background
    this.overlayMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      alphaTest: 0.1,
    });
    
    // Create breaking mesh (slightly larger than block to prevent z-fighting)
    const geometry = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.breakingMesh = new THREE.Mesh(geometry, this.overlayMaterial);
    this.breakingMesh.visible = false;
    this.breakingMesh.renderOrder = 1000; // Render on top
    scene.add(this.breakingMesh);
    
    // Load destroy stage textures
    this.loadDestroyTextures();
  }
  
  /**
   * Load all destroy stage textures
   */
  private loadDestroyTextures(): void {
    const loader = new THREE.TextureLoader();
    
    for (let i = 0; i < DESTROY_STAGES; i++) {
      const texture = loader.load(`/textures/destroy_stage_${i}.png`);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      this.breakingOverlays.push(texture);
    }
  }
  
  /**
   * Start or continue breaking a block
   * Returns true if block was broken
   */
  startBreaking(blockPos: THREE.Vector3, blockType: BlockType, deltaTime: number): boolean {
    // Check if we're breaking a different block
    if (!this.targetBlock || !this.targetBlock.equals(blockPos)) {
      // New block - reset progress
      this.targetBlock = blockPos.clone();
      this.targetBlockType = blockType;
      this.breakProgress = 0;
      this.breakTime = getBlockBreakTime(blockType);
      this.currentStage = 0;
      
      // Position the overlay mesh and apply initial texture BEFORE showing
      if (this.breakingMesh) {
        this.breakingMesh.position.copy(blockPos);
        // Apply stage 0 texture immediately to prevent bright flash
        this.updateOverlayTexture(0);
        this.breakingMesh.visible = true;
      }
    }
    
    // Instant break for 0 hardness blocks
    if (this.breakTime === 0) {
      this.stopBreaking();
      return true;
    }
    
    // Progress the break
    this.breakProgress += deltaTime / this.breakTime;
    
    // Update visual stage (0-9)
    const newStage = Math.min(Math.floor(this.breakProgress * DESTROY_STAGES), DESTROY_STAGES - 1);
    
    if (newStage !== this.currentStage && newStage >= 0) {
      this.currentStage = newStage;
      this.updateOverlayTexture(newStage);
    }
    
    // Check if broken
    if (this.breakProgress >= 1.0) {
      this.stopBreaking();
      return true;
    }
    
    return false;
  }
  
  /**
   * Update the overlay texture to show current break stage
   */
  private updateOverlayTexture(stage: number): void {
    if (stage >= 0 && stage < this.breakingOverlays.length) {
      this.overlayMaterial.map = this.breakingOverlays[stage];
      this.overlayMaterial.needsUpdate = true;
    }
  }
  
  /**
   * Stop breaking (player looked away or released button)
   */
  stopBreaking(): void {
    this.targetBlock = null;
    this.targetBlockType = null;
    this.breakProgress = 0;
    this.breakTime = 0;
    this.currentStage = -1;
    
    if (this.breakingMesh) {
      this.breakingMesh.visible = false;
    }
  }
  
  /**
   * Check if currently breaking a block
   */
  isBreaking(): boolean {
    return this.targetBlock !== null;
  }
  
  /**
   * Get current break progress (0-1)
   */
  getProgress(): number {
    return this.breakProgress;
  }
  
  /**
   * Get the block being broken
   */
  getTargetBlock(): THREE.Vector3 | null {
    return this.targetBlock?.clone() || null;
  }
  
  /**
   * Get current stage (0-9, or -1 if not breaking)
   */
  getCurrentStage(): number {
    return this.currentStage;
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.breakingMesh) {
      this.scene.remove(this.breakingMesh);
      this.breakingMesh.geometry.dispose();
    }
    
    this.overlayMaterial.dispose();
    
    for (const texture of this.breakingOverlays) {
      texture.dispose();
    }
  }
}


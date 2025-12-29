/**
 * Player Physics Component
 * 
 * Decouples physics from rendering and input handling following the Component pattern.
 * All movement validation, collision detection, gravity, and jumping logic lives here.
 * 
 * This allows:
 * - Testing physics independently
 * - Modifying physics without touching Game3D or Player3D
 * - Clear separation of concerns (physics vs rendering vs input)
 */

import * as THREE from 'three';
import { BlockType } from '../world/types';

/**
 * Interface for querying the world's collision/block state.
 * This decouples PlayerPhysics from ChunkManager3D - any world implementation
 * that satisfies this interface can be used.
 */
export interface PhysicsWorld {
  /** Get terrain height at position (highest block overall) */
  getHeightAt(x: number, z: number): number;
  
  /** Get terrain height relative to player's current Y (for walking under arcs) */
  getHeightAtForPlayer(x: number, z: number, playerY: number): number;
  
  /** Check if position is blocked by solid blocks */
  checkCollision(x: number, y: number, z: number, playerWidth?: number, playerHeight?: number): boolean;
  
  /** Check for ceiling collision above player's head */
  checkHeadCollision(x: number, y: number, z: number, playerWidth?: number, playerHeight?: number): boolean;
  
  /** Check if player can stand at position (any corner has solid ground below) */
  canStandAt(x: number, y: number, z: number): boolean;
  
  /** Check if block at position is solid */
  isSolidAt(x: number, y: number, z: number): boolean;
  
  /** Get block type at position */
  getBlockAt(x: number, y: number, z: number): BlockType | null;
}

// Physics constants
export const GRAVITY = 25.0;
export const JUMP_VELOCITY = 10.0;
export const WATER_HEIGHT = 7 / 9;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;

// Movement speed multipliers
export const NORMAL_SPEED_MULTIPLIER = 1.0;
export const CROUCH_SPEED_MULTIPLIER = 0.3;
export const SWIM_SPEED_MULTIPLIER = 0.7;

/**
 * Result of a movement attempt
 */
export interface MovementResult {
  /** New X position after movement */
  newX: number;
  /** New Z position after movement */
  newZ: number;
  /** New Y position (terrain height + 1) */
  newY: number;
  /** Whether the player actually moved */
  moved: boolean;
  /** Whether player should trigger falling */
  shouldFall: boolean;
  /** Block type at the destination */
  blockType: BlockType | null;
}

/**
 * Player state that physics needs to know about
 */
export interface PlayerPhysicsState {
  position: THREE.Vector3;
  isJumping: boolean;
  isSwimming: boolean;
  isCrouching: boolean;
  jumpVelocity: number;
}

/**
 * PlayerPhysics - Component that handles all player physics
 * 
 * Responsibilities:
 * - Movement validation (collision, step-up, arc handling)
 * - Gravity and falling
 * - Jump physics
 * - Ground detection
 * - Water physics
 */
export class PlayerPhysics {
  private world: PhysicsWorld;
  
  // Configurable swim Y offset (can be set by debug UI)
  private waterSwimYOffset = 0.0;
  
  constructor(world: PhysicsWorld) {
    this.world = world;
  }
  
  /**
   * Set water swim Y offset (for debug tuning)
   */
  setWaterSwimYOffset(offset: number): void {
    this.waterSwimYOffset = offset;
  }
  
  /**
   * Calculate the Y position a player should be at for a given X/Z position
   * Takes into account terrain height, water, and player's current Y (for arcs)
   */
  calculateTargetY(x: number, z: number, currentY: number, isSwimming: boolean): number {
    // When swimming, use regular getHeightAt so we can find water surface/shore properly
    // When on land, use getHeightAtForPlayer to prevent wall-climbing
    const terrainHeight = isSwimming 
      ? this.world.getHeightAt(x, z)
      : this.world.getHeightAtForPlayer(x, z, currentY);
    const blockType = this.world.getBlockAt(
      Math.floor(x),
      Math.floor(terrainHeight),
      Math.floor(z)
    );
    
    if (blockType === BlockType.Water) {
      return terrainHeight + WATER_HEIGHT + this.waterSwimYOffset;
    }
    
    return terrainHeight + 1;
  }
  
  /**
   * Check if the player is currently standing over water
   */
  isOverWater(x: number, z: number, y: number): boolean {
    const terrainHeight = this.world.getHeightAt(x, z);
    const blockType = this.world.getBlockAt(
      Math.floor(x),
      Math.floor(terrainHeight),
      Math.floor(z)
    );
    return blockType === BlockType.Water;
  }
  
  /**
   * Check if the player is actually submerged in water
   */
  isInWater(x: number, z: number, y: number): boolean {
    const terrainHeight = this.world.getHeightAt(x, z);
    const blockType = this.world.getBlockAt(
      Math.floor(x),
      Math.floor(terrainHeight),
      Math.floor(z)
    );
    
    if (blockType !== BlockType.Water) return false;
    
    const waterSurfaceY = terrainHeight + WATER_HEIGHT + 0.5;
    return y <= waterSurfaceY + 0.1;
  }
  
  /**
   * Check if player can stand at current position (edge detection)
   * Returns false if no corner of hitbox is over solid ground
   */
  canStand(x: number, y: number, z: number): boolean {
    return this.world.canStandAt(x, y, z);
  }
  
  /**
   * Get the block type at the player's feet position
   */
  getBlockAtFeet(x: number, z: number): BlockType | null {
    const terrainHeight = this.world.getHeightAt(x, z);
    return this.world.getBlockAt(
      Math.floor(x),
      Math.floor(terrainHeight),
      Math.floor(z)
    );
  }
  
  /**
   * Try to move horizontally from current position
   * Handles collision detection, step-up, and arc/overhang logic
   * 
   * When crouching (like in Minecraft), prevents player from walking off edges.
   * This is done by checking if the movement would cause a fall, and blocking it if so.
   * 
   * @returns MovementResult with new position and whether movement occurred
   */
  tryMove(
    state: PlayerPhysicsState,
    moveX: number,
    moveZ: number
  ): MovementResult {
    const { position, isJumping, isSwimming, isCrouching } = state;
    
    // Calculate new position
    const newX = position.x + moveX;
    const newZ = position.z + moveZ;
    
    // Get terrain height at new position
    // - When swimming: use regular getHeightAt so player can exit onto shore
    // - When walking on land: use getHeightAtForPlayer to prevent wall-climbing
    const newTerrainHeight = isSwimming 
      ? this.world.getHeightAt(newX, newZ)
      : this.world.getHeightAtForPlayer(newX, newZ, position.y);
    const newBlockType = this.world.getBlockAt(
      Math.floor(newX),
      Math.floor(newTerrainHeight),
      Math.floor(newZ)
    );
    const targetIsWater = newBlockType === BlockType.Water;
    
    // Calculate target Y position
    let newY: number;
    if (targetIsWater) {
      newY = newTerrainHeight + WATER_HEIGHT + this.waterSwimYOffset;
    } else {
      newY = newTerrainHeight + 1;
    }
    
    // Calculate height difference
    const heightDiff = newY - position.y;
    
    // Check for collision (water is never blocking)
    // When falling or stepping down, check collision at current Y level
    // to avoid false positives from wall blocks around holes
    const isFallingOrSteppingDown = heightDiff < -0.1 || isJumping;
    const collisionY = isFallingOrSteppingDown ? position.y : newY;
    const isBlocked = !targetIsWater && this.world.checkCollision(newX, collisionY, newZ);
    
    if (!isBlocked) {
      // Movement succeeded - check if we should trigger falling
      const wouldFall = !isJumping && !isSwimming && heightDiff < -0.5;
      
      // Minecraft-style edge prevention: when crouching, prevent walking off edges
      // Don't apply this when in water (water is safe to drop into)
      if (isCrouching && wouldFall && !targetIsWater) {
        // Check if we can stand at the new position (any corner has support)
        const canStandAtNew = this.world.canStandAt(newX, position.y, newZ);
        if (!canStandAtNew) {
          // No support at all - block movement completely
          return {
            newX: position.x,
            newZ: position.z,
            newY: position.y,
            moved: false,
            shouldFall: false,
            blockType: null,
          };
        }
        // Some corner has support - allow movement but stay at current Y (leaning over edge)
        // Player stays on the solid ground under their supporting corners
        return {
          newX,
          newZ,
          newY: position.y, // Stay at current height - still supported by corners
          moved: true,
          shouldFall: false, // Don't fall - we have corner support
          blockType: newBlockType,
        };
      }
      
      return {
        newX,
        newZ,
        newY,
        moved: true,
        shouldFall: wouldFall,
        blockType: newBlockType,
      };
    }
    
    // Try X-axis only movement
    const xTerrainHeight = isSwimming 
      ? this.world.getHeightAt(newX, position.z)
      : this.world.getHeightAtForPlayer(newX, position.z, position.y);
    const xBlockType = this.world.getBlockAt(
      Math.floor(newX),
      Math.floor(xTerrainHeight),
      Math.floor(position.z)
    );
    const xIsWater = xBlockType === BlockType.Water;
    const yX = xIsWater ? xTerrainHeight + WATER_HEIGHT + this.waterSwimYOffset : xTerrainHeight + 1;
    const heightDiffX = yX - position.y;
    const isFallingOrSteppingDownX = heightDiffX < -0.1 || isJumping;
    const collisionYX = isFallingOrSteppingDownX ? position.y : yX;
    const blockedX = !xIsWater && this.world.checkCollision(newX, collisionYX, position.z);
    
    if (!blockedX) {
      const wouldFallX = !isJumping && !isSwimming && heightDiffX < -0.5;
      
      // Minecraft-style edge prevention for X-only movement
      if (isCrouching && wouldFallX && !xIsWater) {
        const canStandAtNewX = this.world.canStandAt(newX, position.y, position.z);
        if (!canStandAtNewX) {
          // Would fall off edge - block X movement, try Z only below
        } else {
          // Some corner has support - allow movement but stay at current Y
          return {
            newX,
            newZ: position.z,
            newY: position.y, // Stay at current height
            moved: true,
            shouldFall: false, // Don't fall - we have corner support
            blockType: xBlockType,
          };
        }
      } else {
        return {
          newX,
          newZ: position.z,
          newY: yX,
          moved: true,
          shouldFall: wouldFallX,
          blockType: xBlockType,
        };
      }
    }
    
    // Try Z-axis only movement
    const zTerrainHeight = isSwimming 
      ? this.world.getHeightAt(position.x, newZ)
      : this.world.getHeightAtForPlayer(position.x, newZ, position.y);
    const zBlockType = this.world.getBlockAt(
      Math.floor(position.x),
      Math.floor(zTerrainHeight),
      Math.floor(newZ)
    );
    const zIsWater = zBlockType === BlockType.Water;
    const yZ = zIsWater ? zTerrainHeight + WATER_HEIGHT + this.waterSwimYOffset : zTerrainHeight + 1;
    const heightDiffZ = yZ - position.y;
    const isFallingOrSteppingDownZ = heightDiffZ < -0.1 || isJumping;
    const collisionYZ = isFallingOrSteppingDownZ ? position.y : yZ;
    const blockedZ = !zIsWater && this.world.checkCollision(position.x, collisionYZ, newZ);
    
    if (!blockedZ) {
      const wouldFallZ = !isJumping && !isSwimming && heightDiffZ < -0.5;
      
      // Minecraft-style edge prevention for Z-only movement
      if (isCrouching && wouldFallZ && !zIsWater) {
        const canStandAtNewZ = this.world.canStandAt(position.x, position.y, newZ);
        if (!canStandAtNewZ) {
          // Would fall off edge - block movement completely
          return {
            newX: position.x,
            newZ: position.z,
            newY: position.y,
            moved: false,
            shouldFall: false,
            blockType: null,
          };
        }
        // Some corner has support - allow movement but stay at current Y
        return {
          newX: position.x,
          newZ,
          newY: position.y, // Stay at current height
          moved: true,
          shouldFall: false, // Don't fall - we have corner support
          blockType: zBlockType,
        };
      }
      
      return {
        newX: position.x,
        newZ,
        newY: yZ,
        moved: true,
        shouldFall: wouldFallZ,
        blockType: zBlockType,
      };
    }
    
    // Completely blocked - no movement possible
    return {
      newX: position.x,
      newZ: position.z,
      newY: position.y,
      moved: false,
      shouldFall: false,
      blockType: null,
    };
  }
  
  /**
   * Apply gravity to vertical velocity
   * Returns new velocity after gravity
   */
  applyGravity(currentVelocity: number, deltaTime: number): number {
    return currentVelocity - GRAVITY * deltaTime;
  }
  
  /**
   * Calculate vertical movement from velocity
   */
  calculateVerticalMovement(velocity: number, deltaTime: number): number {
    return velocity * deltaTime;
  }
  
  /**
   * Check for ceiling collision during upward movement
   * Returns the maximum Y the player can reach before hitting ceiling
   */
  checkCeilingCollision(x: number, y: number, z: number): { hit: boolean; maxY: number } {
    const hasHeadCollision = this.world.checkHeadCollision(x, y, z);
    
    if (hasHeadCollision) {
      // Find the exact Y where collision starts (ceiling bottom)
      // The player's head is at y + PLAYER_HEIGHT
      const ceilingY = Math.floor(y + PLAYER_HEIGHT);
      const maxY = ceilingY - PLAYER_HEIGHT - 0.01; // Just below ceiling
      
      return { hit: true, maxY };
    }
    
    return { hit: false, maxY: y };
  }
  
  /**
   * Get the initial jump velocity
   */
  getJumpVelocity(): number {
    return JUMP_VELOCITY;
  }
  
  /**
   * Calculate jump progress (0 = ground, 1 = peak)
   * Used for animation interpolation
   */
  calculateJumpProgress(currentY: number, baseY: number): number {
    const jumpHeight = currentY - baseY;
    const maxHeight = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
    return Math.max(0, Math.min(1, jumpHeight / maxHeight));
  }
  
  /**
   * Check if player has landed (descending and at/below landing surface)
   */
  hasLanded(currentY: number, targetY: number, velocity: number): boolean {
    return currentY <= targetY && velocity < 0;
  }
  
  /**
   * Get speed multiplier based on state
   */
  getSpeedMultiplier(isCrouching: boolean, isSwimming: boolean): number {
    if (isSwimming) return SWIM_SPEED_MULTIPLIER;
    if (isCrouching) return CROUCH_SPEED_MULTIPLIER;
    return NORMAL_SPEED_MULTIPLIER;
  }
}


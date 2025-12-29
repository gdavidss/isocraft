/**
 * Dropped Item Entity - Minecraft-style dropped block
 * 
 * Behavior (like Minecraft):
 * - Small 3D block (about 0.25 scale)
 * - Rotates on Y-axis continuously
 * - Bobs up and down with sine wave
 * - Gets attracted to player when within ~2 blocks
 * - Accelerates toward player, speeding up as it gets closer
 * - Despawns after 5 minutes (300 seconds)
 * - Can merge with nearby identical items
 */

import * as THREE from 'three';
import { BlockType } from '../world/types';

// Constants matching Minecraft behavior
const ITEM_SCALE = 0.25; // Size of dropped item (Minecraft uses ~0.25)
const ROTATION_SPEED = 1.5; // Radians per second Y-axis rotation
const BOB_AMPLITUDE = 0.1; // How high/low the item bobs
const BOB_FREQUENCY = 2.0; // Bobs per second
const PICKUP_RANGE = 1.5; // Distance to trigger pickup
const ATTRACTION_RANGE = 2.0; // Distance to start attracting to player
const ATTRACTION_SPEED = 5.0; // Base speed of attraction
const ATTRACTION_ACCELERATION = 15.0; // How much it speeds up when closer
const DESPAWN_TIME = 300; // Seconds until despawn (5 minutes)
const SPAWN_VELOCITY = 3.0; // Initial upward velocity when spawned
const GRAVITY = 20.0; // Gravity for falling items
const GROUND_OFFSET = 0.2; // Height above ground when settled
const MERGE_RANGE = 0.5; // Distance to merge with identical items
const MAX_STACK = 64; // Maximum stack size

// ============ FLYWEIGHT: Shared Geometry Instances ============
// These are created once and shared across ALL dropped items
// This is a key optimization - no need to create new geometry per item

/** Shared cube geometry for all dropped items (intrinsic/flyweight) */
const DROPPED_ITEM_GEOMETRY = new THREE.BoxGeometry(ITEM_SCALE, ITEM_SCALE, ITEM_SCALE);

/** Shared shadow geometry for all dropped items (intrinsic/flyweight) */
const SHADOW_GEOMETRY = new THREE.CircleGeometry(ITEM_SCALE * 0.6, 8);
SHADOW_GEOMETRY.rotateX(-Math.PI / 2);

/** Shared shadow material for all dropped items (intrinsic/flyweight) */
const SHADOW_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
});

export interface DroppedItemData {
  blockType: BlockType;
  count: number;
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
}

export class DroppedItem {
  public blockType: BlockType;
  public count: number;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public isPickedUp = false;
  public shouldDespawn = false;
  
  private mesh: THREE.Group;
  private scene: THREE.Scene;
  private age = 0; // Seconds since spawned
  private bobPhase = Math.random() * Math.PI * 2; // Random start phase for bobbing
  private rotationAngle = Math.random() * Math.PI * 2; // Random start rotation
  private groundY = 0; // Ground level at current position
  private isOnGround = false;
  private materials: THREE.Material | THREE.Material[];
  
  // Attraction state
  private isBeingAttracted = false;
  private attractionProgress = 0; // 0-1, increases as item gets closer
  
  constructor(
    scene: THREE.Scene,
    data: DroppedItemData,
    materials: THREE.Material | THREE.Material[]
  ) {
    this.scene = scene;
    this.blockType = data.blockType;
    this.count = data.count;
    this.position = data.position.clone();
    this.materials = materials;
    
    // Initial velocity - slight upward pop with random horizontal spread
    if (data.velocity) {
      this.velocity = data.velocity.clone();
    } else {
      const angle = Math.random() * Math.PI * 2;
      const horizontalSpeed = 1.5 + Math.random() * 1.5;
      this.velocity = new THREE.Vector3(
        Math.cos(angle) * horizontalSpeed,
        SPAWN_VELOCITY + Math.random() * 2,
        Math.sin(angle) * horizontalSpeed
      );
    }
    
    // Create the 3D mesh
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }
  
  /**
   * Create the dropped item mesh - a small rotating block
   * Uses FLYWEIGHT shared geometry for optimal memory usage
   */
  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    
    // Create mesh using SHARED geometry (flyweight pattern)
    // Each dropped item shares the same BoxGeometry instance
    const mesh = new THREE.Mesh(DROPPED_ITEM_GEOMETRY, this.materials);
    
    // Offset so it rotates around its center
    mesh.position.y = ITEM_SCALE / 2;
    
    group.add(mesh);
    
    // Add shadow using SHARED geometry and material (flyweight pattern)
    // Clone the material only for this instance so we can adjust opacity
    const shadowMaterial = SHADOW_MATERIAL.clone();
    const shadow = new THREE.Mesh(SHADOW_GEOMETRY, shadowMaterial);
    shadow.position.y = 0.01;
    shadow.name = 'shadow';
    group.add(shadow);
    
    return group;
  }
  
  /**
   * Update item physics and animation
   */
  update(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    getGroundHeight: (x: number, z: number) => number
  ): void {
    // Update age
    this.age += deltaTime;
    if (this.age >= DESPAWN_TIME) {
      this.shouldDespawn = true;
      return;
    }
    
    // Calculate distance to player
    const dx = playerPosition.x - this.position.x;
    const dy = playerPosition.y - this.position.y;
    const dz = playerPosition.z - this.position.z;
    const distanceToPlayer = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Check for pickup
    if (distanceToPlayer < PICKUP_RANGE) {
      this.isPickedUp = true;
      return;
    }
    
    // Attraction to player (like Minecraft's magnetic effect)
    if (distanceToPlayer < ATTRACTION_RANGE) {
      this.isBeingAttracted = true;
      
      // Calculate attraction strength (stronger when closer)
      const attractionFactor = 1 - (distanceToPlayer / ATTRACTION_RANGE);
      this.attractionProgress = Math.min(1, this.attractionProgress + deltaTime * 2);
      
      // Direction to player
      const dirX = dx / distanceToPlayer;
      const dirY = dy / distanceToPlayer;
      const dirZ = dz / distanceToPlayer;
      
      // Accelerate toward player
      const speed = ATTRACTION_SPEED + ATTRACTION_ACCELERATION * attractionFactor * this.attractionProgress;
      
      this.velocity.x = dirX * speed;
      this.velocity.y = dirY * speed;
      this.velocity.z = dirZ * speed;
      
      // Move toward player
      this.position.x += this.velocity.x * deltaTime;
      this.position.y += this.velocity.y * deltaTime;
      this.position.z += this.velocity.z * deltaTime;
    } else {
      this.isBeingAttracted = false;
      this.attractionProgress = 0;
      
      // Physics - gravity and ground collision
      if (!this.isOnGround) {
        // Apply gravity
        this.velocity.y -= GRAVITY * deltaTime;
        
        // Apply friction to horizontal movement
        this.velocity.x *= 0.98;
        this.velocity.z *= 0.98;
        
        // Move
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.position.z += this.velocity.z * deltaTime;
        
        // Check ground collision
        this.groundY = getGroundHeight(this.position.x, this.position.z) + 1 + GROUND_OFFSET;
        
        if (this.position.y <= this.groundY) {
          this.position.y = this.groundY;
          this.isOnGround = true;
          this.velocity.set(0, 0, 0);
        }
      }
    }
    
    // Animation - rotation and bobbing
    this.rotationAngle += ROTATION_SPEED * deltaTime;
    this.bobPhase += BOB_FREQUENCY * Math.PI * 2 * deltaTime;
    
    // Update mesh
    this.mesh.position.copy(this.position);
    
    // Only bob when on ground and not being attracted
    if (this.isOnGround && !this.isBeingAttracted) {
      this.mesh.position.y += Math.sin(this.bobPhase) * BOB_AMPLITUDE;
    }
    
    // Rotate the inner cube (not the group, so shadow stays flat)
    const cube = this.mesh.children.find(c => c instanceof THREE.Mesh && c.name !== 'shadow');
    if (cube) {
      cube.rotation.y = this.rotationAngle;
    }
    
    // Update shadow opacity based on height
    const shadow = this.mesh.children.find(c => c.name === 'shadow') as THREE.Mesh;
    if (shadow && shadow.material instanceof THREE.MeshBasicMaterial) {
      const heightAboveGround = Math.max(0, this.position.y - this.groundY + GROUND_OFFSET);
      shadow.material.opacity = Math.max(0.1, 0.3 - heightAboveGround * 0.1);
      shadow.position.y = -heightAboveGround + 0.01;
    }
  }
  
  /**
   * Check if this item can merge with another dropped item
   */
  canMergeWith(other: DroppedItem): boolean {
    if (other === this) return false;
    if (other.blockType !== this.blockType) return false;
    if (this.count >= MAX_STACK) return false;
    if (other.isPickedUp || other.shouldDespawn) return false;
    
    const distance = this.position.distanceTo(other.position);
    return distance < MERGE_RANGE;
  }
  
  /**
   * Merge another item into this one
   */
  mergeFrom(other: DroppedItem): void {
    const canTake = MAX_STACK - this.count;
    const toTake = Math.min(canTake, other.count);
    
    this.count += toTake;
    other.count -= toTake;
    
    if (other.count <= 0) {
      other.shouldDespawn = true;
    }
  }
  
  /**
   * Get current position
   */
  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }
  
  /**
   * Clean up resources
   * Note: Does NOT dispose shared geometry (flyweight pattern)
   */
  destroy(): void {
    this.scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Don't dispose shared geometry (DROPPED_ITEM_GEOMETRY, SHADOW_GEOMETRY)
        // Don't dispose shared materials
        // Only dispose cloned shadow material
        if (child.name === 'shadow' && child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
}


/**
 * Player in Three.js
 * Minecraft-accurate Steve model with walking animation and texture
 * 
 * Steve dimensions (in Minecraft pixels, 1 block = 16 pixels):
 * - Head: 8×8×8
 * - Body: 8×12×4
 * - Arms: 4×12×4 each
 * - Legs: 4×12×4 each
 * - Total height: 32 pixels = 2 blocks
 * - Visual height: 1.62 units (scaled slightly smaller to prevent ceiling clipping)
 * - Collision height: 1.8 units (matches Minecraft's hitbox)
 * 
 * Animation uses Minecraft's formula:
 * - limbSwing increases with distance traveled
 * - Limbs swing using: cos(limbSwing * 0.6662 + offset) * maxAngle * limbSwingAmount
 * - Arms and legs swing in opposition (right arm with left leg)
 */

import * as THREE from 'three';
import { PlayerStateMachine, GroundedState } from './PlayerState';
import { getSoundManager } from './SoundManager';
import { BlockType } from '../world/types';

// Steve skin texture layout (64×64 texture)
// UV coordinates are normalized (0-1), multiply by texture size to get pixel coordinates
const TEXTURE_SIZE = 64;

// Convert pixel coordinates to UV coordinates
function pixelToUV(x: number, y: number, w: number, h: number): { u: number; v: number; uw: number; vh: number } {
  return {
    u: x / TEXTURE_SIZE,
    v: 1 - (y + h) / TEXTURE_SIZE, // Flip Y for Three.js
    uw: w / TEXTURE_SIZE,
    vh: h / TEXTURE_SIZE,
  };
}

// Body part UV mappings (pixel coordinates from Steve skin)
const SKIN_UV = {
  // Head: 8×8×8 cube
  head: {
    front: pixelToUV(8, 8, 8, 8),
    back: pixelToUV(24, 8, 8, 8),
    top: pixelToUV(8, 0, 8, 8),
    bottom: pixelToUV(16, 0, 8, 8),
    right: pixelToUV(16, 8, 8, 8),  // Swapped - was left texture
    left: pixelToUV(0, 8, 8, 8),    // Swapped - was right texture
  },
  // Body: 8×12×4
  body: {
    front: pixelToUV(20, 20, 8, 12),
    back: pixelToUV(32, 20, 8, 12),
    top: pixelToUV(20, 16, 8, 4),
    bottom: pixelToUV(28, 16, 8, 4),
    right: pixelToUV(16, 20, 4, 12),
    left: pixelToUV(28, 20, 4, 12),
  },
  // Right Arm: 4×12×4
  rightArm: {
    front: pixelToUV(44, 20, 4, 12),
    back: pixelToUV(52, 20, 4, 12),
    top: pixelToUV(44, 16, 4, 4),
    bottom: pixelToUV(48, 16, 4, 4),
    right: pixelToUV(40, 20, 4, 12), // Outer
    left: pixelToUV(48, 20, 4, 12),  // Inner
  },
  // Left Arm: 4×12×4 (new skin format)
  leftArm: {
    front: pixelToUV(36, 52, 4, 12),
    back: pixelToUV(44, 52, 4, 12),
    top: pixelToUV(36, 48, 4, 4),
    bottom: pixelToUV(40, 48, 4, 4),
    right: pixelToUV(40, 52, 4, 12), // Inner
    left: pixelToUV(32, 52, 4, 12),  // Outer
  },
  // Right Leg: 4×12×4
  rightLeg: {
    front: pixelToUV(4, 20, 4, 12),
    back: pixelToUV(12, 20, 4, 12),
    top: pixelToUV(4, 16, 4, 4),
    bottom: pixelToUV(8, 16, 4, 4),
    right: pixelToUV(0, 20, 4, 12),  // Outer
    left: pixelToUV(8, 20, 4, 12),   // Inner
  },
  // Left Leg: 4×12×4 (new skin format)
  leftLeg: {
    front: pixelToUV(20, 52, 4, 12),
    back: pixelToUV(28, 52, 4, 12),
    top: pixelToUV(20, 48, 4, 4),
    bottom: pixelToUV(24, 48, 4, 4),
    right: pixelToUV(24, 52, 4, 12), // Inner
    left: pixelToUV(16, 52, 4, 12),  // Outer
  },
};

// Animation constants (matching Minecraft)
const WALK_SPEED_MULTIPLIER = 0.46634; // Minecraft's magic number (0.6662) slowed by 30%
const ARM_SWING_AMPLITUDE = 1.0; // Radians - max arm swing
const LEG_SWING_AMPLITUDE = 1.0; // Radians - max leg swing
const ANIMATION_SMOOTHING = 0.4; // How quickly animation responds

// Jump animation constants (physics constants are in PlayerState.ts)
const JUMP_ARM_RAISE = -2.5; // Arms raise during jump (radians, negative = up)
const JUMP_LEG_SPREAD = 0.3; // Legs spread slightly during jump
const LANDING_SQUASH = 0.15; // Body squash on landing (percentage)
const LANDING_SQUASH_DURATION = 0.15; // How long the squash lasts (seconds)

// Crouch animation constants (speed multiplier is in PlayerState.ts)
const CROUCH_BODY_TILT = 0.5; // Body tilts forward (radians, ~28 degrees)
const CROUCH_TRANSITION_SPEED = 12.0; // How fast crouch animation transitions

// Punch/swing animation constants (Minecraft-style arm swing when breaking blocks)
const PUNCH_SWING_ANGLE = -1.8; // How far arm swings forward (radians, ~103 degrees)
const PUNCH_DURATION = 0.25; // Duration of punch animation in seconds
const PUNCH_SPEED = Math.PI / PUNCH_DURATION; // Angular velocity for smooth swing

// Swimming animation constants (speed multiplier is in PlayerState.ts)
const SWIM_ARM_STROKE_SPEED = 4.0; // Speed of freestyle arm stroke
const SWIM_LEG_KICK_SPEED = 8.0; // Speed of flutter kick (faster than arms)
const SWIM_TRANSITION_SPEED = 10.0; // How fast swim animation transitions

// Import swim pose config type
import type { SwimPoseConfig } from './SwimDebugUI';

// Default swim pose - "Diving Down" style, angled downward for active swimming
// Positive meshRotationX tips head forward (in direction of movement)
const DEFAULT_SWIM_POSE: SwimPoseConfig = {
  name: "Diving Down",
  meshRotationX: 1.30,                // Swimming angle
  bodyRotationX: 0,
  headRotationX: -1.74,               // Head looking forward while swimming
  armForwardAngle: Math.PI / 1.8,     // Arms extended forward
  armStrokeAmplitude: 0.6,
  legKickAmplitude: 0.4,
  heightOffset: -0.7,                 // Body submerged
  pivotOffsetY: 0.2,
  pivotOffsetZ: 0.3,                  // Adjusted for correct direction
};

export class Player3D {
  public position: THREE.Vector3;
  private mesh: THREE.Group;
  private scene: THREE.Scene;
  
  // State machine
  private stateMachine: PlayerStateMachine;
  
  // Body parts for animation
  private head!: THREE.Mesh;
  private body!: THREE.Mesh;
  private leftArm!: THREE.Group;
  private rightArm!: THREE.Group;
  private leftLeg!: THREE.Group;
  private rightLeg!: THREE.Group;
  private shadow!: THREE.Mesh;
  
  // Animation state
  private limbSwing = 0; // Increases with distance traveled
  private limbSwingAmount = 0; // Smoothed animation intensity (0-1)
  private previousPosition: THREE.Vector3;
  
  // Jump state (managed by state machine, exposed for animation)
  private _isJumping = false;
  private _jumpVelocity = 0;
  private baseY = 64; // Ground level at current position
  private _jumpProgress = 0; // 0 = ground, 1 = peak, for animation interpolation
  private landingSquashTimer = 0; // Timer for landing squash animation
  
  // Crouch state (managed by GroundedState, exposed for animation)
  private _isCrouching = false;
  private crouchAmount = 0; // 0 = standing, 1 = fully crouched (smoothed)
  
  // Swimming state (managed by SwimmingState, exposed for animation)
  private _isSwimming = false;
  private swimAmount = 0; // 0 = not swimming, 1 = fully swimming pose (smoothed)
  private swimCycle = 0; // Current position in swim animation cycle
  private swimPose: SwimPoseConfig = DEFAULT_SWIM_POSE;
  
  // Punch/swing animation state (independent of movement state)
  private isPunching = false;
  private punchProgress = 0; // 0 = start, 1 = fully extended, back to 0
  private punchTimer = 0; // Time remaining in punch animation
  
  // Texture
  private texture: THREE.Texture | null = null;
  private material: THREE.MeshLambertMaterial | null = null;
  
  // Footstep sound state
  private currentBlockType: BlockType = BlockType.Grass;
  private footstepDistance = 0; // Distance traveled since last footstep
  private wasSwimming = false; // Track swim state changes for splash sounds
  private readonly FOOTSTEP_INTERVAL = 1.8; // Distance in blocks between footstep sounds

  constructor(scene: THREE.Scene, x: number, z: number) {
    this.scene = scene;
    this.position = new THREE.Vector3(x, 64, z);
    this.previousPosition = this.position.clone();
    
    // Initialize state machine (starts in Grounded state)
    this.stateMachine = new PlayerStateMachine(this, new GroundedState());
    
    // Create placeholder mesh while texture loads
    this.mesh = this.createPlaceholderMesh();
    this.mesh.rotation.order = 'YXZ'; // Fix rotation order for swimming
    // Set renderOrder on all child meshes so player renders before water
    this.setMeshRenderOrder(this.mesh, -5);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
    
    // Create shadow (only once, stays on ground)
    this.createShadow();
    
    // Load texture and replace placeholder (async)
    this.loadTexture();
  }

  /**
   * Load Steve texture from texturepack folder
   */
  private async loadTexture(): Promise<void> {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        '/texturepack/assets/minecraft/textures/entity/player/wide/steve.png',
        (texture) => {
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;
          texture.colorSpace = THREE.SRGBColorSpace;
          this.texture = texture;
          
          // Replace placeholder with textured mesh
          this.scene.remove(this.mesh);
          this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (child.material instanceof THREE.Material) {
                child.material.dispose();
              }
            }
          });
          
          // Shadow is created once in constructor, no need to recreate
          
          this.mesh = this.createPlayerMesh();
          this.mesh.rotation.order = 'YXZ'; // Fix rotation order for swimming
          // Set renderOrder on all child meshes so player renders before water
          this.setMeshRenderOrder(this.mesh, -5);
          this.mesh.position.copy(this.position);
          this.scene.add(this.mesh);
          
          resolve();
        },
        undefined,
        () => {
          console.warn('Failed to load Steve texture, using placeholder colors');
          resolve();
        }
      );
    });
  }

  /**
   * Create a placeholder mesh with solid colors (used while texture loads)
   */
  private createPlaceholderMesh(): THREE.Group {
    const group = new THREE.Group();
    
    // Materials with Steve's classic colors
    const skinColor = new THREE.MeshLambertMaterial({ color: 0xc6956c });
    const shirtColor = new THREE.MeshLambertMaterial({ color: 0x00b8b8 });
    const pantsColor = new THREE.MeshLambertMaterial({ color: 0x3b3bb8 });
    const hairColor = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
    
    // Scale factor: Steve is 32 pixels tall = 1.62 units (visual height)
    // Collision height is still 1.8, but visual is smaller to prevent ceiling clipping
    // In Minecraft, eye height is 1.62 blocks from feet
    const scale = 1.62 / 32;
    
    // Head (8×8×8)
    const headGeom = new THREE.BoxGeometry(8 * scale, 8 * scale, 8 * scale);
    this.head = new THREE.Mesh(headGeom, skinColor);
    this.head.position.y = 24 * scale + 4 * scale; // Center of head
    group.add(this.head);
    
    // Hair on head
    const hairGeom = new THREE.BoxGeometry(8.2 * scale, 2 * scale, 8.2 * scale);
    const hair = new THREE.Mesh(hairGeom, hairColor);
    hair.position.y = 29 * scale;
    group.add(hair);
    
    // Body (8×12×4)
    const bodyGeom = new THREE.BoxGeometry(8 * scale, 12 * scale, 4 * scale);
    this.body = new THREE.Mesh(bodyGeom, shirtColor);
    this.body.position.y = 12 * scale + 6 * scale; // Center of body
    group.add(this.body);
    
    // Create limbs as groups with pivot at top (for rotation)
    // Right Arm
    this.rightArm = this.createLimbGroup(4 * scale, 12 * scale, 4 * scale, skinColor);
    this.rightArm.position.set(-6 * scale, 24 * scale, 0); // Shoulder position
    group.add(this.rightArm);
    
    // Left Arm  
    this.leftArm = this.createLimbGroup(4 * scale, 12 * scale, 4 * scale, skinColor);
    this.leftArm.position.set(6 * scale, 24 * scale, 0); // Shoulder position
    group.add(this.leftArm);
    
    // Right Leg
    this.rightLeg = this.createLimbGroup(4 * scale, 12 * scale, 4 * scale, pantsColor);
    this.rightLeg.position.set(-2 * scale, 12 * scale, 0); // Hip position
    group.add(this.rightLeg);
    
    // Left Leg
    this.leftLeg = this.createLimbGroup(4 * scale, 12 * scale, 4 * scale, pantsColor);
    this.leftLeg.position.set(2 * scale, 12 * scale, 0); // Hip position
    group.add(this.leftLeg);
    
    // Shadow is created separately via createShadow() - not in placeholder mesh
    // This prevents duplicate shadows when texture loads
    
    return group;
  }

  /**
   * Create the textured Steve mesh with proper UV mapping
   */
  private createPlayerMesh(): THREE.Group {
    const group = new THREE.Group();
    
    // Scale factor: Steve is 32 pixels tall = 1.62 units (visual height)
    // Collision height is still 1.8, but visual is smaller to prevent ceiling clipping
    // In Minecraft, eye height is 1.62 blocks from feet
    const scale = 1.62 / 32;
    
    // Create material with Steve texture
    const material = this.texture 
      ? new THREE.MeshLambertMaterial({ map: this.texture, transparent: true })
      : new THREE.MeshLambertMaterial({ color: 0xc6956c });
    this.material = material;
    
    // Fallback materials for when texture isn't loaded
    const shirtColor = new THREE.MeshLambertMaterial({ color: 0x00b8b8 });
    const pantsColor = new THREE.MeshLambertMaterial({ color: 0x3b3bb8 });
    
    // Head (8×8×8)
    const headGeom = this.createTexturedBox(8 * scale, 8 * scale, 8 * scale, SKIN_UV.head);
    this.head = new THREE.Mesh(headGeom, this.texture ? material : material);
    this.head.position.y = 24 * scale + 4 * scale;
    group.add(this.head);
    
    // Body (8×12×4)
    const bodyGeom = this.createTexturedBox(8 * scale, 12 * scale, 4 * scale, SKIN_UV.body);
    this.body = new THREE.Mesh(bodyGeom, this.texture ? material : shirtColor);
    this.body.position.y = 12 * scale + 6 * scale;
    group.add(this.body);
    
    // Right Arm (4×12×4) - pivot at shoulder
    this.rightArm = this.createTexturedLimbGroup(
      4 * scale, 12 * scale, 4 * scale,
      SKIN_UV.rightArm,
      this.texture ? material : material
    );
    this.rightArm.position.set(-6 * scale, 24 * scale, 0);
    group.add(this.rightArm);
    
    // Left Arm (4×12×4) - pivot at shoulder
    this.leftArm = this.createTexturedLimbGroup(
      4 * scale, 12 * scale, 4 * scale,
      SKIN_UV.leftArm,
      this.texture ? material : material
    );
    this.leftArm.position.set(6 * scale, 24 * scale, 0);
    group.add(this.leftArm);
    
    // Right Leg (4×12×4) - pivot at hip
    this.rightLeg = this.createTexturedLimbGroup(
      4 * scale, 12 * scale, 4 * scale,
      SKIN_UV.rightLeg,
      this.texture ? material : pantsColor
    );
    this.rightLeg.position.set(-2 * scale, 12 * scale, 0);
    group.add(this.rightLeg);
    
    // Left Leg (4×12×4) - pivot at hip
    this.leftLeg = this.createTexturedLimbGroup(
      4 * scale, 12 * scale, 4 * scale,
      SKIN_UV.leftLeg,
      this.texture ? material : pantsColor
    );
    this.leftLeg.position.set(2 * scale, 12 * scale, 0);
    group.add(this.leftLeg);
    
    // Shadow is created separately via createShadow() - not in mesh creation
    // This prevents duplicate shadows
    
    return group;
  }
  
  /**
   * Set renderOrder on a mesh and all its children
   * Ensures consistent render ordering for the entire player model
   */
  private setMeshRenderOrder(object: THREE.Object3D, order: number): void {
    object.renderOrder = order;
    object.traverse((child) => {
      child.renderOrder = order;
    });
  }

  /**
   * Create the player's shadow (separate from mesh to stay on ground)
   * Should only be called once during construction
   */
  private createShadow(): void {
    // Remove existing shadow if any (safety check)
    if (this.shadow) {
      this.scene.remove(this.shadow);
      this.shadow.geometry.dispose();
      if (this.shadow.material instanceof THREE.Material) {
        this.shadow.material.dispose();
      }
    }
    
    const shadowGeom = new THREE.CircleGeometry(0.4, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
    });
    this.shadow = new THREE.Mesh(shadowGeom, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(this.position.x, this.baseY + 0.01, this.position.z);
    this.scene.add(this.shadow);
  }

  /**
   * Create a limb group with pivot at top (for rotation)
   */
  private createLimbGroup(width: number, height: number, depth: number, material: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const geom = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geom, material);
    // Position mesh so pivot (group origin) is at top of limb
    mesh.position.y = -height / 2;
    group.add(mesh);
    return group;
  }

  /**
   * Create a textured limb group with pivot at top
   */
  private createTexturedLimbGroup(
    width: number, 
    height: number, 
    depth: number,
    uvMap: typeof SKIN_UV.rightArm,
    material: THREE.Material
  ): THREE.Group {
    const group = new THREE.Group();
    const geom = this.createTexturedBox(width, height, depth, uvMap);
    const mesh = new THREE.Mesh(geom, material);
    // Position mesh so pivot (group origin) is at top of limb
    mesh.position.y = -height / 2;
    group.add(mesh);
    return group;
  }

  /**
   * Create a box geometry with custom UV mapping for each face
   * Face order in Three.js BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
   * Which corresponds to: right, left, top, bottom, front, back
   */
  private createTexturedBox(
    width: number, 
    height: number, 
    depth: number,
    uvMap: { 
      front: ReturnType<typeof pixelToUV>;
      back: ReturnType<typeof pixelToUV>;
      top: ReturnType<typeof pixelToUV>;
      bottom: ReturnType<typeof pixelToUV>;
      right: ReturnType<typeof pixelToUV>;
      left: ReturnType<typeof pixelToUV>;
    }
  ): THREE.BoxGeometry {
    const geom = new THREE.BoxGeometry(width, height, depth);
    const uvAttribute = geom.getAttribute('uv');
    const uvs = uvAttribute.array as Float32Array;
    
    // Face mapping for BoxGeometry (each face has 4 vertices, 2 UV coords each = 8 floats per face)
    // Face order: +X (right), -X (left), +Y (top), -Y (bottom), +Z (front), -Z (back)
    const faces = [
      uvMap.right,  // +X
      uvMap.left,   // -X
      uvMap.top,    // +Y
      uvMap.bottom, // -Y
      uvMap.front,  // +Z
      uvMap.back,   // -Z
    ];
    
    for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
      const face = faces[faceIdx];
      const baseIdx = faceIdx * 8; // 4 vertices × 2 UV coords
      
      // UV coordinates for the 4 vertices of each face
      // Vertex order in BoxGeometry: top-left, top-right, bottom-left, bottom-right
      // For standard orientation
      uvs[baseIdx + 0] = face.u;           // Top-left U
      uvs[baseIdx + 1] = face.v + face.vh; // Top-left V
      uvs[baseIdx + 2] = face.u + face.uw; // Top-right U
      uvs[baseIdx + 3] = face.v + face.vh; // Top-right V
      uvs[baseIdx + 4] = face.u;           // Bottom-left U
      uvs[baseIdx + 5] = face.v;           // Bottom-left V
      uvs[baseIdx + 6] = face.u + face.uw; // Bottom-right U
      uvs[baseIdx + 7] = face.v;           // Bottom-right V
    }
    
    uvAttribute.needsUpdate = true;
    return geom;
  }

  /**
   * Trigger a jump if allowed by current state
   */
  jump(): void {
    this.stateMachine.handleJump();
  }
  
  /**
   * Trigger falling (walking off an edge) - gravity-based fall with no initial velocity
   */
  fall(): void {
    this.stateMachine.handleFall();
  }
  
  /**
   * Check if player is in the air (jumping or falling)
   */
  isInAir(): boolean {
    return this.stateMachine.isInAir();
  }

  /**
   * Check if player is currently jumping
   */
  get jumping(): boolean {
    return this._isJumping;
  }

  /**
   * Set crouching state (delegated to state machine)
   */
  setCrouching(crouching: boolean): void {
    this.stateMachine.handleCrouch(crouching);
  }

  /**
   * Check if player is currently crouching
   */
  get crouching(): boolean {
    return this._isCrouching;
  }

  /**
   * Get movement speed multiplier (delegated to state machine)
   */
  getSpeedMultiplier(): number {
    return this.stateMachine.getSpeedMultiplier();
  }

  /**
   * Set swimming state (handled via state machine water change)
   */
  setSwimming(swimming: boolean): void {
    this.stateMachine.handleWaterChange(swimming);
  }
  
  // === Internal setters for state machine ===
  
  /** @internal Called by PlayerState */
  setIsJumping(jumping: boolean): void {
    this._isJumping = jumping;
  }
  
  /** @internal Called by PlayerState */
  setJumpVelocity(velocity: number): void {
    this._jumpVelocity = velocity;
  }
  
  /** @internal Called by PlayerState */
  setJumpProgress(progress: number): void {
    this._jumpProgress = progress;
  }
  
  /** @internal Called by PlayerState */
  setCrouchingInternal(crouching: boolean): void {
    this._isCrouching = crouching;
  }
  
  /** @internal Called by PlayerState */
  setSwimmingInternal(swimming: boolean): void {
    this._isSwimming = swimming;
  }
  
  /** @internal Called by state machine when landing from a jump */
  triggerLandingSquash(): void {
    this.landingSquashTimer = LANDING_SQUASH_DURATION;
  }
  
  /** Get current state name (for debugging) */
  getStateName(): string {
    return this.stateMachine.getStateName();
  }
  
  /** Check if player can jump in current state */
  canJump(): boolean {
    return this.stateMachine.canJump();
  }
  
  /** Check if player can crouch in current state */
  canCrouch(): boolean {
    return this.stateMachine.canCrouch();
  }
  
  /**
   * Update terrain height during jump (for landing on higher ground)
   * Called by Game3D each frame when player is jumping
   */
  updateTerrainY(terrainY: number): void {
    this.stateMachine.updateTerrainY(terrainY);
  }
  
  /**
   * Handle ceiling collision - stop upward movement
   * Called by Game3D when player's head hits a block while jumping up
   * @param maxY The maximum Y position (just below the ceiling)
   * @returns true if collision was handled (player was jumping upward)
   */
  hitCeiling(maxY: number): boolean {
    return this.stateMachine.handleCeilingHit(maxY);
  }
  
  /**
   * Get current jump velocity (for checking if player is moving upward)
   */
  getJumpVelocity(): number {
    return this._jumpVelocity;
  }
  
  /**
   * Sync baseY with current position
   * Called when landing to ensure shadow is positioned correctly
   */
  syncBaseY(): void {
    this.baseY = this.position.y;
  }
  
  /**
   * Set swimming pose configuration (for debug UI)
   */
  setSwimPose(pose: SwimPoseConfig): void {
    this.swimPose = pose;
  }

  /**
   * Check if player is currently swimming
   */
  get swimming(): boolean {
    return this._isSwimming;
  }

  /**
   * Trigger punch/swing animation (for breaking blocks)
   */
  punch(): void {
    if (!this.isPunching) {
      this.isPunching = true;
      this.punchTimer = PUNCH_DURATION;
      this.punchProgress = 0;
    }
  }

  /**
   * Check if player is currently punching
   */
  get punching(): boolean {
    return this.isPunching;
  }
  
  /**
   * Set the block type the player is standing on (for footstep sounds)
   */
  setCurrentBlockType(blockType: BlockType): void {
    this.currentBlockType = blockType;
  }

  /**
   * Update animation based on movement
   * Uses Minecraft's walking animation formula
   */
  update(deltaTime: number): void {
    // === STATE MACHINE UPDATE (handles jump physics, state transitions) ===
    this.stateMachine.update(deltaTime);
    
    // Update landing squash timer
    if (this.landingSquashTimer > 0) {
      this.landingSquashTimer -= deltaTime;
      if (this.landingSquashTimer < 0) {
        this.landingSquashTimer = 0;
      }
    }
    
    // Smooth crouch transition
    const targetCrouch = this._isCrouching ? 1.0 : 0.0;
    this.crouchAmount += (targetCrouch - this.crouchAmount) * CROUCH_TRANSITION_SPEED * deltaTime;
    this.crouchAmount = Math.max(0, Math.min(1, this.crouchAmount)); // Clamp
    
    // Smooth swim transition
    const targetSwim = this._isSwimming ? 1.0 : 0.0;
    this.swimAmount += (targetSwim - this.swimAmount) * SWIM_TRANSITION_SPEED * deltaTime;
    this.swimAmount = Math.max(0, Math.min(1, this.swimAmount)); // Clamp
    
    // Update punch animation
    if (this.isPunching) {
      this.punchTimer -= deltaTime;
      
      // Calculate punch progress (0 -> 1 -> 0 for smooth swing and return)
      const elapsed = PUNCH_DURATION - this.punchTimer;
      const halfDuration = PUNCH_DURATION / 2;
      
      if (elapsed < halfDuration) {
        // Swing forward (0 to 1)
        this.punchProgress = elapsed / halfDuration;
      } else {
        // Return (1 to 0)
        this.punchProgress = 1 - (elapsed - halfDuration) / halfDuration;
      }
      
      // End punch animation
      if (this.punchTimer <= 0) {
        this.isPunching = false;
        this.punchProgress = 0;
        this.punchTimer = 0;
      }
    }
    
    // Calculate distance moved this frame (horizontal only) - MUST be before isMoving check
    const dx = this.position.x - this.previousPosition.x;
    const dz = this.position.z - this.previousPosition.z;
    const distanceMoved = Math.sqrt(dx * dx + dz * dz);
    
    // Calculate movement speed
    const speed = distanceMoved / Math.max(deltaTime, 0.001);
    const isMoving = speed > 0.1;
    
    // === SOUND EFFECTS ===
    const soundManager = getSoundManager();
    
    // Splash sound when entering water
    if (this._isSwimming && !this.wasSwimming) {
      soundManager.playSplash();
    }
    this.wasSwimming = this._isSwimming;
    
    // Footstep/swim sounds based on movement
    if (isMoving && !this._isJumping) {
      this.footstepDistance += distanceMoved;
      
      // Calculate interval based on state (slower footsteps when crouching)
      const interval = this._isCrouching ? this.FOOTSTEP_INTERVAL * 1.5 : this.FOOTSTEP_INTERVAL;
      
      if (this.footstepDistance >= interval) {
        this.footstepDistance = 0;
        
        if (this._isSwimming) {
          soundManager.playSwim();
        } else {
          soundManager.playFootstep(this.currentBlockType);
        }
      }
    }
    
    // Update swim animation cycle
    if (this._isSwimming) {
      if (isMoving) {
        // Active swimming - full speed animation
        this.swimCycle += deltaTime * SWIM_ARM_STROKE_SPEED;
      } else {
        // Idle floating in water - slow subtle animation (25% speed)
        this.swimCycle += deltaTime * SWIM_ARM_STROKE_SPEED * 0.25;
      }
    }
    
    // Update limbSwing based on distance (like Minecraft)
    // Animation speed scales with crouch (30% speed when crouching)
    if (isMoving) {
      const animSpeedMultiplier = this._isCrouching ? 0.3 : 1.0;
      this.limbSwing += distanceMoved * 4 * animSpeedMultiplier;
    }
    
    // Smooth the animation intensity
    const targetAmount = isMoving ? 1.0 : 0.0;
    this.limbSwingAmount += (targetAmount - this.limbSwingAmount) * ANIMATION_SMOOTHING;
    
    // === ANIMATION ===
    if (this.rightArm && this.leftArm && this.rightLeg && this.leftLeg) {
      const walkPhase = this.limbSwing * WALK_SPEED_MULTIPLIER;
      
      // Calculate squash/stretch from landing
      let squashFactor = 1.0;
      let stretchFactor = 1.0;
      if (this.landingSquashTimer > 0) {
        const squashProgress = this.landingSquashTimer / LANDING_SQUASH_DURATION;
        // Squash vertically, stretch horizontally on landing
        squashFactor = 1.0 - LANDING_SQUASH * squashProgress;
        stretchFactor = 1.0 + LANDING_SQUASH * 0.5 * squashProgress;
      }
      
      // Calculate jump animation intensity (smooth in/out)
      const jumpAnimIntensity = this._isJumping 
        ? Math.sin(this._jumpProgress * Math.PI) // Smooth arc
        : 0;
      
      // === ARMS ===
      if (this.swimAmount > 0.1) {
        // Swimming: freestyle/crawl arm strokes (alternating)
        const swimBlend = this.swimAmount;
        const pose = this.swimPose;
        
        // Arms start extended forward, then stroke back and forth
        const rightArmStroke = Math.sin(this.swimCycle) * pose.armStrokeAmplitude;
        const leftArmStroke = Math.sin(this.swimCycle + Math.PI) * pose.armStrokeAmplitude;
        
        // Base position is arms forward (relative to the rotated body)
        // When mesh rotates 90°, arm rotation.x of -PI/2 points arms forward
        const baseArmAngle = -pose.armForwardAngle;
        this.rightArm.rotation.x = baseArmAngle + rightArmStroke * swimBlend;
        this.leftArm.rotation.x = baseArmAngle + leftArmStroke * swimBlend;
        
        // Slight sideways motion during stroke
        this.rightArm.rotation.z = -0.15 * swimBlend;
        this.leftArm.rotation.z = 0.15 * swimBlend;
      } else if (this._isJumping) {
        // During jump: arms raise up and slightly outward
        const armRaise = JUMP_ARM_RAISE * jumpAnimIntensity;
        // Arms go up (negative X rotation) and slightly forward
        this.rightArm.rotation.x = armRaise;
        this.leftArm.rotation.x = armRaise;
        // Slight outward spread
        this.rightArm.rotation.z = -0.3 * jumpAnimIntensity;
        this.leftArm.rotation.z = 0.3 * jumpAnimIntensity;
      } else if (this.crouchAmount > 0.5) {
        // Crouching: arms stay still, just follow the body tilt
        const crouchArmTilt = CROUCH_BODY_TILT * this.crouchAmount;
        this.rightArm.rotation.x = crouchArmTilt;
        this.leftArm.rotation.x = crouchArmTilt;
        this.rightArm.rotation.z = 0;
        this.leftArm.rotation.z = 0;
      } else {
        // Normal walking animation
        const rightArmWalk = Math.cos(walkPhase) * ARM_SWING_AMPLITUDE * this.limbSwingAmount;
        const leftArmWalk = Math.cos(walkPhase + Math.PI) * ARM_SWING_AMPLITUDE * this.limbSwingAmount;
        
        this.rightArm.rotation.x = rightArmWalk;
        this.leftArm.rotation.x = leftArmWalk;
        this.rightArm.rotation.z = 0;
        this.leftArm.rotation.z = 0;
      }
      
      // === PUNCH ANIMATION OVERLAY ===
      // This overrides the right arm animation when punching
      if (this.isPunching && this.punchProgress > 0) {
        // Smooth ease-in-out using sine curve
        const smoothProgress = Math.sin(this.punchProgress * Math.PI);
        
        // Swing arm forward (negative X = forward in our coordinate system)
        const punchAngle = PUNCH_SWING_ANGLE * smoothProgress;
        this.rightArm.rotation.x = punchAngle;
        
        // Slight inward rotation for more natural punch
        this.rightArm.rotation.z = -0.2 * smoothProgress;
      }
      
      // === LEGS ===
      if (this.swimAmount > 0.1) {
        // Swimming: fast flutter kick (faster than arm strokes)
        const kickPhase = this.swimCycle * (SWIM_LEG_KICK_SPEED / SWIM_ARM_STROKE_SPEED);
        const swimBlend = this.swimAmount;
        const pose = this.swimPose;
        
        // Fast alternating flutter kick
        const rightKick = Math.sin(kickPhase) * pose.legKickAmplitude;
        const leftKick = Math.sin(kickPhase + Math.PI) * pose.legKickAmplitude;
        
        this.rightLeg.rotation.x = rightKick * swimBlend;
        this.leftLeg.rotation.x = leftKick * swimBlend;
        
        // Keep legs together (no Z rotation in Minecraft swim)
        this.rightLeg.rotation.z = 0;
        this.leftLeg.rotation.z = 0;
      } else if (this._isJumping) {
        // During jump: legs spread slightly and bend back
        const legSpread = JUMP_LEG_SPREAD * jumpAnimIntensity;
        this.rightLeg.rotation.x = legSpread;
        this.leftLeg.rotation.x = legSpread;
        // Slight outward spread
        this.rightLeg.rotation.z = -0.15 * jumpAnimIntensity;
        this.leftLeg.rotation.z = 0.15 * jumpAnimIntensity;
      } else {
        // Normal walking animation (same whether crouching or not - legs don't change when crouching)
        // Just reduce amplitude slightly when crouching for a slower shuffle look
        const legAmplitude = this.crouchAmount > 0.5 
          ? LEG_SWING_AMPLITUDE * 0.5 
          : LEG_SWING_AMPLITUDE;
        this.rightLeg.rotation.x = Math.cos(walkPhase + Math.PI) * legAmplitude * this.limbSwingAmount;
        this.leftLeg.rotation.x = Math.cos(walkPhase) * legAmplitude * this.limbSwingAmount;
        
        // Reset Z rotation
        this.rightLeg.rotation.z = 0;
        this.leftLeg.rotation.z = 0;
      }
      
      // === BODY SQUASH/STRETCH + CROUCH + SWIM ===
      if (this.body) {
        this.body.scale.set(stretchFactor, squashFactor, stretchFactor);
        
        if (this.swimAmount > 0.1) {
          // Swimming: additional body rotation on top of mesh rotation
          this.body.rotation.x = this.swimPose.bodyRotationX * this.swimAmount;
        } else if (this.crouchAmount > 0.01) {
          // Crouching: body tilts forward
          this.body.rotation.x = CROUCH_BODY_TILT * this.crouchAmount;
        } else {
          this.body.rotation.x = 0;
        }
      }
      
      // === HEAD ===
      if (this.head) {
        const scale = 1.62 / 32; // Visual scale (matches createPlayerMesh)
        const baseHeadY = scale * (24 + 4);
        
        if (this.swimAmount > 0.1) {
          // Swimming: head tilts up to look forward (counteracts mesh rotation)
          this.head.rotation.x = this.swimPose.headRotationX * this.swimAmount;
          this.head.position.y = baseHeadY;
          this.head.position.z = 0;
        } else if (this._isJumping) {
          // During jump: head tilts up slightly
          this.head.rotation.x = -0.2 * jumpAnimIntensity;
          this.head.position.y = baseHeadY;
          this.head.position.z = 0;
        } else {
          // Normal + Crouching: head stays still (no rotation) but moves down when crouching
          this.head.rotation.x = 0;
          const walkBob = Math.abs(Math.sin(walkPhase * 2)) * 0.02 * this.limbSwingAmount;
          const squashOffset = (1 - squashFactor) * 0.1; // Head drops with squash
          
          // Head lowers when crouching (follows the tilted body)
          const crouchHeadDrop = 0.15 * this.crouchAmount;
          const crouchHeadForward = 0.1 * this.crouchAmount; // Also moves slightly forward
          
          this.head.position.y = baseHeadY + walkBob - squashOffset - crouchHeadDrop;
          this.head.position.z = crouchHeadForward;
        }
      }
      
    }
    
    // Store current position for next frame (only horizontal for movement detection)
    this.previousPosition.set(this.position.x, this.previousPosition.y, this.position.z);
    
    // Update mesh position
    this.mesh.position.copy(this.position);
    
    // === SWIMMING: Rotate entire mesh to be horizontal ===
    if (this.swimAmount > 0.01) {
      const pose = this.swimPose;
      
      // Rotate mesh forward (X rotation makes player horizontal)
      this.mesh.rotation.x = pose.meshRotationX * this.swimAmount;
      
      // Adjust position to pivot around center of player, not feet
      this.mesh.position.y += pose.pivotOffsetY * this.swimAmount + pose.heightOffset * this.swimAmount;
      this.mesh.position.z -= pose.pivotOffsetZ * this.swimAmount;
    } else {
      // Not swimming - keep upright
      this.mesh.rotation.x = 0;
    }
    
    // Hide shadow when in water (based on state, not animation amount)
    if (this.shadow) {
      this.shadow.visible = !this._isSwimming;
    }
    
    // === SHADOW: Always stay on ground and grow when jumping ===
    if (this.shadow) {
      // Position shadow at player's X/Z but at ground level
      // baseY is the player's feet position, which is ON the ground surface
      this.shadow.position.x = this.position.x;
      this.shadow.position.z = this.position.z;
      this.shadow.position.y = this.baseY + 0.01; // Slightly above ground to prevent z-fighting
      
      // Calculate height above ground
      const heightAboveGround = this.position.y - this.baseY;
      
      // Scale shadow based on height: grows when jumping (simulates light spread)
      // Base size is 1.0, grows up to 2.0 at max jump height (~1.25 blocks)
      const baseShadowScale = 1.0;
      const maxShadowScale = 2.0;
      const maxJumpHeight = 1.25; // Approximate max jump height in blocks
      
      const heightFactor = Math.min(heightAboveGround / maxJumpHeight, 1.0);
      const shadowScale = baseShadowScale + (maxShadowScale - baseShadowScale) * heightFactor;
      
      this.shadow.scale.set(shadowScale, shadowScale, 1);
      
      // Also fade shadow slightly when higher (farther from ground = dimmer shadow)
      const shadowMaterial = this.shadow.material as THREE.MeshBasicMaterial;
      const baseOpacity = 0.3;
      const minOpacity = 0.15;
      shadowMaterial.opacity = baseOpacity - (baseOpacity - minOpacity) * heightFactor;
    }
  }

  /**
   * Move player by delta
   */
  move(dx: number, dz: number): void {
    this.position.x += dx;
    this.position.z += dz;
    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
    
    // Rotate player to face movement direction
    if (dx !== 0 || dz !== 0) {
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }

  /**
   * Set Y position (height)
   * Also updates baseY for jump calculations if not currently jumping
   */
  setY(y: number): void {
    if (!this._isJumping) {
      this.position.y = y;
      this.baseY = y;
    }
    this.mesh.position.y = this.position.y;
    
    // Update shadow position to stay on ground
    if (this.shadow) {
      this.shadow.position.y = this.baseY + 0.01;
    }
  }

  /**
   * Get the mesh group
   */
  getMesh(): THREE.Group {
    return this.mesh;
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    if (this.texture) {
      this.texture.dispose();
    }
    // Remove shadow from scene (it's not part of mesh group)
    if (this.shadow) {
      this.scene.remove(this.shadow);
      this.shadow.geometry.dispose();
      if (this.shadow.material instanceof THREE.Material) {
        this.shadow.material.dispose();
      }
    }
  }
}

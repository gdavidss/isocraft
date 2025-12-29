/**
 * Player State Pattern Implementation
 * 
 * States:
 * - Grounded: Player is on the ground (can walk, crouch, transition to jump/swim)
 * - Jumping: Player is in the air from jumping (can't crouch, can't swim until landing)
 * - Falling: Player is falling (entered water from above, etc.)
 * - Swimming: Player is in water (can't jump, can't crouch)
 * 
 * State transitions:
 * - Grounded -> Jumping (via jump action)
 * - Grounded -> Swimming (entering water)
 * - Jumping -> Grounded (landing on ground)
 * - Jumping -> Swimming (landing in water)
 * - Swimming -> Grounded (exiting water to land)
 */

import type { Player3D } from './Player3D';

// Physics constants
// Jump velocity and gravity designed to allow jumping slightly over 1 block
// Max height = v²/(2g) = 100/50 = 2 blocks - generous for landing on 1-block ledges
export const JUMP_VELOCITY = 10.0;
export const GRAVITY = 25.0;
export const CROUCH_SPEED_MULTIPLIER = 0.3;
export const SWIM_SPEED_MULTIPLIER = 0.7;

/**
 * Base interface for all player states
 */
export interface PlayerState {
  readonly name: string;
  
  /**
   * Called when entering this state
   */
  enter(player: Player3D): void;
  
  /**
   * Called when exiting this state
   */
  exit(player: Player3D): void;
  
  /**
   * Update state logic
   * @returns The next state to transition to, or null to stay in current state
   */
  update(player: Player3D, deltaTime: number): PlayerState | null;
  
  /**
   * Handle jump input
   * @returns The next state if jumping triggers a transition, or null
   */
  handleJump(player: Player3D): PlayerState | null;
  
  /**
   * Handle crouch input
   */
  handleCrouch(player: Player3D, crouching: boolean): void;
  
  /**
   * Handle entering/exiting water
   * @returns The next state if water state changes require a transition
   */
  handleWaterChange(player: Player3D, inWater: boolean): PlayerState | null;
  
  /**
   * Get movement speed multiplier for this state
   */
  getSpeedMultiplier(): number;
  
  /**
   * Whether the player can jump in this state
   */
  canJump(): boolean;
  
  /**
   * Whether the player can crouch in this state
   */
  canCrouch(): boolean;
  
  /**
   * Get display name for debug UI (may include sub-state info like "crouching")
   */
  getDisplayName(): string;
}

/**
 * Grounded State - Player is on the ground
 * Can walk, crouch, and transition to jumping or swimming
 */
export class GroundedState implements PlayerState {
  readonly name = 'grounded';
  
  private isCrouching = false;
  
  enter(player: Player3D): void {
    player.setJumpVelocity(0);
    player.setJumpProgress(0);
    player.setIsJumping(false);
    // Reset any swim-related state
    player.setSwimmingInternal(false);
    // Sync baseY with current position for correct shadow positioning
    player.syncBaseY();
  }
  
  exit(_player: Player3D): void {
    // Clear crouch when leaving grounded state
    this.isCrouching = false;
  }
  
  update(_player: Player3D, _deltaTime: number): PlayerState | null {
    return null; // Stay in grounded state
  }
  
  handleJump(_player: Player3D): PlayerState | null {
    if (this.isCrouching) {
      return null; // Can't jump while crouching (optional, can remove if desired)
    }
    return new JumpingState();
  }
  
  handleCrouch(player: Player3D, crouching: boolean): void {
    this.isCrouching = crouching;
    player.setCrouchingInternal(crouching);
  }
  
  handleWaterChange(_player: Player3D, inWater: boolean): PlayerState | null {
    if (inWater) {
      return new SwimmingState();
    }
    return null;
  }
  
  getSpeedMultiplier(): number {
    return this.isCrouching ? CROUCH_SPEED_MULTIPLIER : 1.0;
  }
  
  canJump(): boolean {
    return true;
  }
  
  canCrouch(): boolean {
    return true;
  }
  
  getDisplayName(): string {
    return this.isCrouching ? 'crouching' : 'grounded';
  }
}

/**
 * Jumping State - Player is in the air from a jump
 * Cannot crouch, cannot initiate swim until landing
 */
export class JumpingState implements PlayerState {
  readonly name = 'jumping';
  
  private jumpVelocity = JUMP_VELOCITY;
  private baseY = 0;
  private terrainY = 0; // Current terrain height below player (updated externally)
  
  constructor(initialVelocity: number = JUMP_VELOCITY) {
    this.jumpVelocity = initialVelocity;
  }
  
  enter(player: Player3D): void {
    // For falling (0 or negative velocity), set baseY very low so only terrainY determines landing
    // For jumping (positive velocity), baseY is where we started (to fall back to)
    if (this.jumpVelocity <= 0) {
      this.baseY = -1000; // Very low, so terrainY will determine landing height
    } else {
      this.baseY = player.position.y;
    }
    
    this.terrainY = player.position.y; // Will be updated each frame by Game3D
    player.setJumpVelocity(this.jumpVelocity);
    player.setIsJumping(true);
    player.setCrouchingInternal(false); // Can't crouch while jumping
  }
  
  exit(player: Player3D): void {
    player.setIsJumping(false);
    player.setJumpVelocity(0);
  }
  
  update(player: Player3D, deltaTime: number): PlayerState | null {
    // Apply velocity
    player.position.y += this.jumpVelocity * deltaTime;
    
    // Apply gravity
    this.jumpVelocity -= GRAVITY * deltaTime;
    player.setJumpVelocity(this.jumpVelocity);
    
    // Calculate jump progress (0 = ground, 1 = peak)
    const jumpHeight = player.position.y - this.baseY;
    const maxHeight = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
    const progress = Math.max(0, Math.min(1, jumpHeight / maxHeight));
    player.setJumpProgress(progress);
    
    // Landing height is the higher of original baseY or current terrain
    const landingY = Math.max(this.baseY, this.terrainY);
    
    // Check for landing - when descending and at or below landing surface
    if (player.position.y <= landingY && this.jumpVelocity < 0) {
      player.position.y = landingY;
      player.triggerLandingSquash();
      return new GroundedState();
    }
    
    return null;
  }
  
  handleJump(_player: Player3D): PlayerState | null {
    // Can't double jump
    return null;
  }
  
  handleCrouch(_player: Player3D, _crouching: boolean): void {
    // Can't crouch while jumping - ignore input
  }
  
  handleWaterChange(_player: Player3D, inWater: boolean): PlayerState | null {
    if (inWater) {
      // Landing in water
      return new SwimmingState();
    }
    return null;
  }
  
  getSpeedMultiplier(): number {
    return 1.0; // Normal speed while jumping
  }
  
  canJump(): boolean {
    return false; // Already jumping
  }
  
  canCrouch(): boolean {
    return false; // Can't crouch in air
  }
  
  /**
   * Update base Y when ground level changes (e.g., moving up a slope during jump)
   */
  updateBaseY(newBaseY: number): void {
    if (newBaseY > this.baseY) {
      this.baseY = newBaseY;
    }
  }
  
  getBaseY(): number {
    return this.baseY;
  }
  
  /**
   * Update terrain height below player during jump
   * Called each frame by Game3D to track current ground level
   */
  setTerrainY(terrainY: number): void {
    this.terrainY = terrainY;
  }
  
  /**
   * Handle ceiling collision - stop upward movement and reverse velocity
   * Called when player's head hits a block while jumping up
   */
  handleCeilingHit(player: Player3D, maxY: number): void {
    // Only handle if we're moving upward
    if (this.jumpVelocity > 0) {
      // Snap player to just below the ceiling
      player.position.y = maxY;
      // Reverse velocity to start falling (small bounce-back effect)
      this.jumpVelocity = -0.5; // Small downward velocity
      player.setJumpVelocity(this.jumpVelocity);
    }
  }
  
  getDisplayName(): string {
    return this.jumpVelocity > 0 ? 'jumping' : 'falling';
  }
}

/**
 * Swimming State - Player is in water
 * Cannot jump (only swim up/down), cannot crouch
 */
export class SwimmingState implements PlayerState {
  readonly name = 'swimming';
  
  enter(player: Player3D): void {
    player.setSwimmingInternal(true);
    player.setCrouchingInternal(false); // Can't crouch while swimming
    player.setIsJumping(false);
  }
  
  exit(player: Player3D): void {
    player.setSwimmingInternal(false);
  }
  
  update(_player: Player3D, _deltaTime: number): PlayerState | null {
    return null; // Stay swimming until water state changes
  }
  
  handleJump(_player: Player3D): PlayerState | null {
    // Cannot jump while swimming - swimming uses different vertical movement
    // In Minecraft, you can swim up/down but not "jump" in the traditional sense
    return null;
  }
  
  handleCrouch(_player: Player3D, _crouching: boolean): void {
    // Can't crouch while swimming - ignore input
  }
  
  handleWaterChange(_player: Player3D, inWater: boolean): PlayerState | null {
    if (!inWater) {
      // Exiting water
      return new GroundedState();
    }
    return null;
  }
  
  getSpeedMultiplier(): number {
    return SWIM_SPEED_MULTIPLIER;
  }
  
  canJump(): boolean {
    return false; // Cannot jump in water
  }
  
  canCrouch(): boolean {
    return false; // Cannot crouch in water
  }
  
  getDisplayName(): string {
    return 'swimming';
  }
}

/**
 * Player State Machine
 * Manages state transitions and delegates actions to current state
 */
export class PlayerStateMachine {
  private currentState: PlayerState;
  private player: Player3D;
  
  constructor(player: Player3D, initialState: PlayerState = new GroundedState()) {
    this.player = player;
    this.currentState = initialState;
    this.currentState.enter(player);
  }
  
  /**
   * Get current state name for debug display
   * Uses getDisplayName() which may include sub-state info like "crouching"
   */
  getStateName(): string {
    return this.currentState.getDisplayName();
  }
  
  /**
   * Get current state
   */
  getCurrentState(): PlayerState {
    return this.currentState;
  }
  
  /**
   * Transition to a new state
   */
  private transitionTo(newState: PlayerState): void {
    this.currentState.exit(this.player);
    this.currentState = newState;
    this.currentState.enter(this.player);
  }
  
  /**
   * Update the state machine
   */
  update(deltaTime: number): void {
    const nextState = this.currentState.update(this.player, deltaTime);
    if (nextState) {
      this.transitionTo(nextState);
    }
  }
  
  /**
   * Handle jump input
   */
  handleJump(): boolean {
    const nextState = this.currentState.handleJump(this.player);
    if (nextState) {
      this.transitionTo(nextState);
      return true;
    }
    return false;
  }
  
  /**
   * Handle crouch input
   */
  handleCrouch(crouching: boolean): void {
    this.currentState.handleCrouch(this.player, crouching);
  }
  
  /**
   * Handle water state change
   */
  handleWaterChange(inWater: boolean): void {
    const nextState = this.currentState.handleWaterChange(this.player, inWater);
    if (nextState) {
      this.transitionTo(nextState);
    }
  }
  
  /**
   * Get movement speed multiplier
   */
  getSpeedMultiplier(): number {
    return this.currentState.getSpeedMultiplier();
  }
  
  /**
   * Check if player can jump
   */
  canJump(): boolean {
    return this.currentState.canJump();
  }
  
  /**
   * Check if player can crouch
   */
  canCrouch(): boolean {
    return this.currentState.canCrouch();
  }
  
  /**
   * Force transition to a specific state (for external events)
   */
  forceState(state: PlayerState): void {
    this.transitionTo(state);
  }
  
  /**
   * Update terrain height during jump (for proper landing on higher ground)
   */
  updateTerrainY(terrainY: number): void {
    if (this.currentState.name === 'jumping') {
      (this.currentState as JumpingState).setTerrainY(terrainY);
    }
  }
  
  /**
   * Handle falling off an edge (gravity-based fall with no initial jump velocity)
   * Only triggers if currently grounded
   */
  handleFall(): boolean {
    if (this.currentState.name === 'grounded') {
      // Start falling with 0 initial velocity (pure gravity)
      this.transitionTo(new JumpingState(0));
      return true;
    }
    return false;
  }
  
  /**
   * Check if player is currently falling/jumping (in the air)
   */
  isInAir(): boolean {
    return this.currentState.name === 'jumping';
  }
  
  /**
   * Handle ceiling collision during jump
   * Returns true if the player is jumping upward (collision was handled)
   */
  handleCeilingHit(maxY: number): boolean {
    if (this.currentState.name === 'jumping') {
      (this.currentState as JumpingState).handleCeilingHit(this.player, maxY);
      return true;
    }
    return false;
  }
  
  /**
   * Get current jump velocity (for checking if player is moving upward)
   */
  getJumpVelocity(): number {
    if (this.currentState.name === 'jumping') {
      return this.player.getJumpVelocity();
    }
    return 0;
  }
}


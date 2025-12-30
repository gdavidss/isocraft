/**
 * Crosshair overlay - Minecraft-style "+" cursor that follows the mouse or gamepad
 * Uses CSS mix-blend-mode: difference for inverted colors
 */

export class Crosshair {
  private container: HTMLDivElement;
  private visible = true;
  private boundMouseMove: (e: MouseEvent) => void;
  
  // Crosshair position (in screen pixels)
  private posX: number;
  private posY: number;
  
  // Velocity for smooth gamepad movement
  private velX: number = 0;
  private velY: number = 0;
  
  // Smoothing parameters
  private readonly ACCELERATION = 2000;  // pixels/sec^2 - how fast crosshair speeds up
  private readonly MAX_SPEED = 600;       // pixels/sec - maximum crosshair speed
  private readonly FRICTION = 8;          // deceleration multiplier when no input
  
  // Track if we're using gamepad or mouse for crosshair
  private usingGamepad = false;

  constructor() {
    // Initialize position to center of screen
    this.posX = window.innerWidth / 2;
    this.posY = window.innerHeight / 2;
    
    this.container = this.createCrosshair();
    document.body.appendChild(this.container);
    
    // Set initial position
    this.container.style.left = `${this.posX}px`;
    this.container.style.top = `${this.posY}px`;
    
    // Track mouse movement
    this.boundMouseMove = this.handleMouseMove.bind(this);
    window.addEventListener('mousemove', this.boundMouseMove);
    
    // Hide the system cursor
    document.body.style.cursor = 'none';
  }

  private createCrosshair(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'crosshair';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 1px;
      height: 1px;
      pointer-events: none;
      z-index: 9999;
      mix-blend-mode: difference;
    `;

    // Horizontal bar of the +
    const horizontal = document.createElement('div');
    horizontal.style.cssText = `
      position: absolute;
      top: 0;
      left: -8px;
      width: 17px;
      height: 1px;
      background: white;
      pointer-events: none;
    `;

    // Vertical bar of the +
    const vertical = document.createElement('div');
    vertical.style.cssText = `
      position: absolute;
      top: -8px;
      left: 0;
      width: 1px;
      height: 17px;
      background: white;
      pointer-events: none;
    `;

    container.appendChild(horizontal);
    container.appendChild(vertical);

    return container;
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.visible) return;
    
    // When mouse moves, switch back to mouse control
    this.usingGamepad = false;
    this.posX = e.clientX;
    this.posY = e.clientY;
    this.container.style.left = `${this.posX}px`;
    this.container.style.top = `${this.posY}px`;
  }
  
  /**
   * Update crosshair with gamepad input (velocity-based smooth movement)
   * @param inputX - horizontal stick input (-1 to 1)
   * @param inputY - vertical stick input (-1 to 1)
   * @param deltaTime - time since last frame in seconds
   */
  updateGamepad(inputX: number, inputY: number, deltaTime: number): void {
    if (!this.visible) return;
    
    const hasInput = Math.abs(inputX) > 0.01 || Math.abs(inputY) > 0.01;
    
    if (hasInput) {
      // Switch to gamepad control mode
      this.usingGamepad = true;
      
      // Accelerate toward input direction
      const targetVelX = inputX * this.MAX_SPEED;
      const targetVelY = inputY * this.MAX_SPEED;
      
      // Smoothly accelerate toward target velocity
      const accel = this.ACCELERATION * deltaTime;
      this.velX = this.lerp(this.velX, targetVelX, Math.min(1, accel / this.MAX_SPEED * 3));
      this.velY = this.lerp(this.velY, targetVelY, Math.min(1, accel / this.MAX_SPEED * 3));
    } else {
      // Apply friction when no input (smooth deceleration)
      const friction = 1 - this.FRICTION * deltaTime;
      this.velX *= Math.max(0, friction);
      this.velY *= Math.max(0, friction);
      
      // Stop completely if velocity is very small
      if (Math.abs(this.velX) < 1) this.velX = 0;
      if (Math.abs(this.velY) < 1) this.velY = 0;
    }
    
    // Apply velocity to position
    if (Math.abs(this.velX) > 0.1 || Math.abs(this.velY) > 0.1) {
      this.posX = Math.max(0, Math.min(window.innerWidth, this.posX + this.velX * deltaTime));
      this.posY = Math.max(0, Math.min(window.innerHeight, this.posY + this.velY * deltaTime));
      
      this.container.style.left = `${this.posX}px`;
      this.container.style.top = `${this.posY}px`;
    }
  }
  
  /**
   * Linear interpolation helper
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  
  /**
   * Check if crosshair is currently moving (has velocity)
   */
  isMoving(): boolean {
    return Math.abs(this.velX) > 1 || Math.abs(this.velY) > 1;
  }
  
  /**
   * Legacy method for direct position updates (kept for compatibility)
   * @deprecated Use updateGamepad instead for smooth movement
   */
  moveBy(deltaX: number, deltaY: number): void {
    if (!this.visible) return;
    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) return;
    
    // Switch to gamepad control mode
    this.usingGamepad = true;
    
    // Update position with bounds checking
    this.posX = Math.max(0, Math.min(window.innerWidth, this.posX + deltaX));
    this.posY = Math.max(0, Math.min(window.innerHeight, this.posY + deltaY));
    
    this.container.style.left = `${this.posX}px`;
    this.container.style.top = `${this.posY}px`;
  }
  
  /**
   * Get current crosshair screen position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.posX, y: this.posY };
  }
  
  /**
   * Check if crosshair is being controlled by gamepad
   */
  isUsingGamepad(): boolean {
    return this.usingGamepad;
  }
  
  /**
   * Reset crosshair to center of screen
   */
  centerCrosshair(): void {
    this.posX = window.innerWidth / 2;
    this.posY = window.innerHeight / 2;
    this.container.style.left = `${this.posX}px`;
    this.container.style.top = `${this.posY}px`;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.style.display = visible ? 'block' : 'none';
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    window.removeEventListener('mousemove', this.boundMouseMove);
    document.body.style.cursor = '';
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}


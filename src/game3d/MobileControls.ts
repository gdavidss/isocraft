/**
 * Mobile Controls - Virtual analog stick, jump button, and touch gestures
 * 
 * Features:
 * - Virtual analog stick (transparent) on right side above inventory
 * - Jump button
 * - Pinch-to-zoom
 * - Touch hold = break block (left click)
 * - Quick tap = place block (right click)
 */

export interface MobileControlsCallbacks {
  onMove: (x: number, y: number) => void;
  onJump: () => void;
  onOpenInventory: () => void;
  onZoom: (delta: number) => void;
  onBreakStart: (screenX: number, screenY: number) => void;
  onBreakEnd: () => void;
  onPlace: (screenX: number, screenY: number) => void;
  onCrosshairMove: (screenX: number, screenY: number) => void;
}

// Threshold time in ms to distinguish tap (place) vs hold (break)
const TAP_THRESHOLD_MS = 200;
// Threshold distance in px to prevent accidental taps while dragging
const TAP_DISTANCE_THRESHOLD = 15;

export class MobileControls {
  private container: HTMLDivElement;
  private analogStick: HTMLDivElement;
  private analogKnob: HTMLDivElement;
  private jumpButton: HTMLDivElement;
  private inventoryButton: HTMLDivElement;
  
  private callbacks: MobileControlsCallbacks;
  
  // Analog stick state
  private analogActive = false;
  private analogStartX = 0;
  private analogStartY = 0;
  private analogTouchId: number | null = null;
  private analogTouchStartTime = 0;
  private analogMoved = false;
  
  // Movement output (-1 to 1)
  private moveX = 0;
  private moveY = 0;
  
  // Pinch zoom state
  private pinchStartDistance = 0;
  private pinchTouchIds: number[] = [];
  
  // Touch interaction state (for break/place)
  private interactionTouchId: number | null = null;
  private interactionStartTime = 0;
  private interactionStartX = 0;
  private interactionStartY = 0;
  private isBreaking = false;
  private breakCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Crosshair position for mobile (separate touch for aiming)
  private crosshairTouchId: number | null = null;
  
  private static isMobileDevice: boolean | null = null;
  
  constructor(callbacks: MobileControlsCallbacks) {
    this.callbacks = callbacks;
    
    this.container = this.createContainer();
    this.analogStick = this.createAnalogStick();
    this.analogKnob = this.createAnalogKnob();
    this.jumpButton = this.createJumpButton();
    this.inventoryButton = this.createInventoryButton();
    
    this.analogStick.appendChild(this.analogKnob);
    this.container.appendChild(this.analogStick);
    this.container.appendChild(this.jumpButton);
    this.container.appendChild(this.inventoryButton);
    document.body.appendChild(this.container);
    
    this.setupTouchHandlers();
  }
  
  /**
   * Detect if the user is on a mobile/touch device
   * Can be forced via ?mobile=true query parameter for testing
   */
  static isMobile(): boolean {
    if (MobileControls.isMobileDevice !== null) {
      return MobileControls.isMobileDevice;
    }
    
    // Check for forced mobile mode via query parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mobile') === 'true') {
      MobileControls.isMobileDevice = true;
      return true;
    }
    
    // Check for touch support and mobile user agent
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Also check screen size as some laptops have touch
    const isSmallScreen = window.innerWidth <= 1024 || window.innerHeight <= 768;
    
    MobileControls.isMobileDevice = hasTouch && (isMobileUA || isSmallScreen);
    return MobileControls.isMobileDevice;
  }
  
  /**
   * Force mobile mode (for testing)
   */
  static setMobileMode(enabled: boolean): void {
    MobileControls.isMobileDevice = enabled;
  }
  
  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'mobile-controls';
    container.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      pointer-events: none;
      z-index: 1100;
      display: ${MobileControls.isMobile() ? 'block' : 'none'};
    `;
    return container;
  }
  
  private createAnalogStick(): HTMLDivElement {
    const analog = document.createElement('div');
    analog.id = 'mobile-analog';
    analog.style.cssText = `
      position: absolute;
      right: 20px;
      bottom: 95px;
      width: 90px;
      height: 90px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      border: 2px solid rgba(255, 255, 255, 0.2);
      pointer-events: auto;
      touch-action: none;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    `;
    return analog;
  }
  
  private createAnalogKnob(): HTMLDivElement {
    const knob = document.createElement('div');
    knob.id = 'mobile-analog-knob';
    knob.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.35);
      border: 2px solid rgba(255, 255, 255, 0.4);
      pointer-events: none;
      transition: transform 0.05s ease-out;
    `;
    return knob;
  }
  
  private createJumpButton(): HTMLDivElement {
    const button = document.createElement('div');
    button.id = 'mobile-jump';
    button.style.cssText = `
      position: absolute;
      left: 20px;
      bottom: 95px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      border: 2px solid rgba(255, 255, 255, 0.25);
      pointer-events: auto;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      user-select: none;
      -webkit-user-select: none;
    `;
    
    // Simple up arrow
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
    `;
    
    return button;
  }
  
  private createInventoryButton(): HTMLDivElement {
    const button = document.createElement('div');
    button.id = 'mobile-inventory';
    button.style.cssText = `
      position: absolute;
      left: 20px;
      bottom: 150px;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.12);
      border: 2px solid rgba(255, 255, 255, 0.25);
      pointer-events: auto;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      user-select: none;
      -webkit-user-select: none;
    `;
    
    // Simple 3 dots (menu)
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
        <circle cx="12" cy="5" r="2"/>
        <circle cx="12" cy="12" r="2"/>
        <circle cx="12" cy="19" r="2"/>
      </svg>
    `;
    
    return button;
  }
  
  private setupTouchHandlers(): void {
    // Analog stick touch handling
    this.analogStick.addEventListener('touchstart', this.handleAnalogStart.bind(this), { passive: false });
    this.analogStick.addEventListener('touchmove', this.handleAnalogMove.bind(this), { passive: false });
    this.analogStick.addEventListener('touchend', this.handleAnalogEnd.bind(this), { passive: false });
    this.analogStick.addEventListener('touchcancel', this.handleAnalogEnd.bind(this), { passive: false });
    
    // Jump button handling
    this.jumpButton.addEventListener('touchstart', this.handleJumpStart.bind(this), { passive: false });
    this.jumpButton.addEventListener('touchend', this.handleJumpEnd.bind(this), { passive: false });
    
    // Inventory button handling
    this.inventoryButton.addEventListener('touchstart', this.handleInventoryStart.bind(this), { passive: false });
    this.inventoryButton.addEventListener('touchend', this.handleInventoryEnd.bind(this), { passive: false });
    
    // Global touch handling for pinch zoom and break/place
    document.addEventListener('touchstart', this.handleGlobalTouchStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this.handleGlobalTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleGlobalTouchEnd.bind(this), { passive: false });
    document.addEventListener('touchcancel', this.handleGlobalTouchEnd.bind(this), { passive: false });
  }
  
  // ============ ANALOG STICK HANDLERS ============
  
  private handleAnalogStart(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    if (this.analogTouchId !== null) return;
    
    const touch = e.changedTouches[0];
    this.analogTouchId = touch.identifier;
    this.analogActive = true;
    this.analogTouchStartTime = Date.now();
    this.analogMoved = false;
    
    const rect = this.analogStick.getBoundingClientRect();
    this.analogStartX = rect.left + rect.width / 2;
    this.analogStartY = rect.top + rect.height / 2;
  }
  
  private handleAnalogMove(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    if (!this.analogActive || this.analogTouchId === null) return;
    
    const touch = Array.from(e.touches).find(t => t.identifier === this.analogTouchId);
    if (!touch) return;
    
    // Calculate offset from center
    const dx = touch.clientX - this.analogStartX;
    const dy = touch.clientY - this.analogStartY;
    
    // Clamp to analog stick radius
    const maxRadius = 32; // Half of analog stick size minus knob size
    const distance = Math.sqrt(dx * dx + dy * dy);
    const clampedDistance = Math.min(distance, maxRadius);
    
    // Track if analog has moved significantly (for tap detection)
    if (distance > 10) {
      this.analogMoved = true;
    }
    
    let normX = 0;
    let normY = 0;
    
    if (distance > 0) {
      normX = (dx / distance) * clampedDistance;
      normY = (dy / distance) * clampedDistance;
    }
    
    // Update knob position
    this.analogKnob.style.transform = `translate(calc(-50% + ${normX}px), calc(-50% + ${normY}px))`;
    
    // Calculate movement values (-1 to 1)
    // Invert Y so that dragging up moves forward
    this.moveX = normX / maxRadius;
    this.moveY = -normY / maxRadius;
    
    // Fire callback
    this.callbacks.onMove(this.moveX, this.moveY);
  }
  
  private handleAnalogEnd(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    const touch = Array.from(e.changedTouches).find(t => t.identifier === this.analogTouchId);
    if (!touch) return;
    
    this.analogActive = false;
    this.analogTouchId = null;
    this.moveX = 0;
    this.moveY = 0;
    
    // Reset knob position
    this.analogKnob.style.transform = 'translate(-50%, -50%)';
    
    // Fire callback with zero movement
    this.callbacks.onMove(0, 0);
  }
  
  // ============ JUMP BUTTON HANDLERS ============
  
  private handleJumpStart(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    // Subtle visual feedback
    this.jumpButton.style.transform = 'scale(0.92)';
    this.jumpButton.style.background = 'rgba(255, 255, 255, 0.25)';
    
    this.callbacks.onJump();
  }
  
  private handleJumpEnd(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset visual
    this.jumpButton.style.transform = 'scale(1)';
    this.jumpButton.style.background = 'rgba(255, 255, 255, 0.12)';
  }
  
  // ============ INVENTORY BUTTON HANDLERS ============
  
  private handleInventoryStart(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    // Subtle visual feedback
    this.inventoryButton.style.transform = 'scale(0.92)';
    this.inventoryButton.style.background = 'rgba(255, 255, 255, 0.25)';
    
    this.callbacks.onOpenInventory();
  }
  
  private handleInventoryEnd(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset visual
    this.inventoryButton.style.transform = 'scale(1)';
    this.inventoryButton.style.background = 'rgba(255, 255, 255, 0.12)';
  }
  
  // ============ GLOBAL TOUCH HANDLERS (Pinch zoom + Break/Place) ============
  
  private handleGlobalTouchStart(e: TouchEvent): void {
    // Skip if touch is on UI elements
    const target = e.target as HTMLElement;
    if (this.isUIElement(target)) return;
    
    // Handle pinch zoom (2 fingers)
    if (e.touches.length === 2) {
      this.startPinchZoom(e);
      return;
    }
    
    // Handle single touch for break/place (on canvas only)
    if (e.touches.length === 1 && target.tagName === 'CANVAS') {
      const touch = e.touches[0];
      
      // Don't start interaction if analog or jump is active
      if (this.analogTouchId !== null) return;
      
      this.interactionTouchId = touch.identifier;
      this.interactionStartTime = Date.now();
      this.interactionStartX = touch.clientX;
      this.interactionStartY = touch.clientY;
      this.isBreaking = false;
      
      // Move crosshair to touch position immediately
      this.callbacks.onCrosshairMove(touch.clientX, touch.clientY);
      
      // Start break check timeout - if held longer than threshold, start breaking
      this.breakCheckTimeout = setTimeout(() => {
        if (this.interactionTouchId !== null && !this.isBreaking) {
          this.isBreaking = true;
          this.callbacks.onBreakStart(this.interactionStartX, this.interactionStartY);
        }
      }, TAP_THRESHOLD_MS);
    }
  }
  
  private handleGlobalTouchMove(e: TouchEvent): void {
    // Handle pinch zoom
    if (e.touches.length === 2 && this.pinchTouchIds.length === 2) {
      this.updatePinchZoom(e);
      return;
    }
    
    // Handle drag for crosshair movement
    if (this.interactionTouchId !== null) {
      const touch = Array.from(e.touches).find(t => t.identifier === this.interactionTouchId);
      if (touch) {
        // Calculate drag distance
        const dx = touch.clientX - this.interactionStartX;
        const dy = touch.clientY - this.interactionStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If dragged beyond threshold, update crosshair and cancel tap
        if (distance > TAP_DISTANCE_THRESHOLD) {
          // Update crosshair position
          this.callbacks.onCrosshairMove(touch.clientX, touch.clientY);
          
          // Cancel tap detection (will be treated as hold/break if long enough)
          if (this.breakCheckTimeout) {
            clearTimeout(this.breakCheckTimeout);
            this.breakCheckTimeout = null;
          }
          
          // If not yet breaking and held long enough, start breaking at new position
          if (!this.isBreaking && Date.now() - this.interactionStartTime > TAP_THRESHOLD_MS) {
            this.isBreaking = true;
            this.callbacks.onBreakStart(touch.clientX, touch.clientY);
          } else if (this.isBreaking) {
            // Update break position
            this.callbacks.onBreakEnd();
            this.callbacks.onBreakStart(touch.clientX, touch.clientY);
          }
        }
      }
    }
  }
  
  private handleGlobalTouchEnd(e: TouchEvent): void {
    // Handle pinch zoom end
    for (const changedTouch of Array.from(e.changedTouches)) {
      const idx = this.pinchTouchIds.indexOf(changedTouch.identifier);
      if (idx !== -1) {
        this.pinchTouchIds.splice(idx, 1);
        if (this.pinchTouchIds.length < 2) {
          this.pinchStartDistance = 0;
        }
      }
    }
    
    // Handle break/place end
    const touch = Array.from(e.changedTouches).find(t => t.identifier === this.interactionTouchId);
    if (touch) {
      // Clear the break check timeout
      if (this.breakCheckTimeout) {
        clearTimeout(this.breakCheckTimeout);
        this.breakCheckTimeout = null;
      }
      
      const touchDuration = Date.now() - this.interactionStartTime;
      const dx = touch.clientX - this.interactionStartX;
      const dy = touch.clientY - this.interactionStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (this.isBreaking) {
        // Was breaking - stop breaking
        this.callbacks.onBreakEnd();
      } else if (touchDuration < TAP_THRESHOLD_MS && distance < TAP_DISTANCE_THRESHOLD) {
        // Quick tap with minimal movement - place block
        this.callbacks.onPlace(touch.clientX, touch.clientY);
      }
      
      this.interactionTouchId = null;
      this.isBreaking = false;
    }
  }
  
  // ============ PINCH ZOOM ============
  
  private startPinchZoom(e: TouchEvent): void {
    this.pinchTouchIds = [e.touches[0].identifier, e.touches[1].identifier];
    this.pinchStartDistance = this.getPinchDistance(e.touches[0], e.touches[1]);
    
    // Cancel any break interaction
    if (this.interactionTouchId !== null) {
      if (this.breakCheckTimeout) {
        clearTimeout(this.breakCheckTimeout);
        this.breakCheckTimeout = null;
      }
      if (this.isBreaking) {
        this.callbacks.onBreakEnd();
      }
      this.interactionTouchId = null;
      this.isBreaking = false;
    }
  }
  
  private updatePinchZoom(e: TouchEvent): void {
    if (this.pinchStartDistance === 0) return;
    
    const touch1 = Array.from(e.touches).find(t => t.identifier === this.pinchTouchIds[0]);
    const touch2 = Array.from(e.touches).find(t => t.identifier === this.pinchTouchIds[1]);
    
    if (!touch1 || !touch2) return;
    
    const currentDistance = this.getPinchDistance(touch1, touch2);
    const delta = currentDistance - this.pinchStartDistance;
    
    // Threshold to prevent tiny movements from triggering zoom
    if (Math.abs(delta) > 10) {
      // Negative delta = pinching in = zoom out (smaller view)
      // Positive delta = pinching out = zoom in (larger view)
      const zoomDelta = -delta * 0.02; // Invert and scale
      this.callbacks.onZoom(zoomDelta);
      this.pinchStartDistance = currentDistance;
    }
  }
  
  private getPinchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // ============ HELPERS ============
  
  private isUIElement(element: HTMLElement): boolean {
    // Check if element or parents are mobile controls
    let el: HTMLElement | null = element;
    while (el) {
      if (el.id === 'mobile-controls' || 
          el.id === 'mobile-analog' || 
          el.id === 'mobile-jump' ||
          el.id === 'mobile-inventory' ||
          el.id === 'hotbar' ||
          el.id === 'creative-inventory' ||
          el.id === 'pause-menu' ||
          el.id === 'debug-ui') {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }
  
  /**
   * Get current movement values
   */
  getMovement(): { x: number; y: number } {
    return { x: this.moveX, y: this.moveY };
  }
  
  /**
   * Show/hide mobile controls
   */
  setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
  }
  
  /**
   * Check if mobile controls are visible
   */
  isVisible(): boolean {
    return this.container.style.display !== 'none';
  }
  
  destroy(): void {
    if (this.breakCheckTimeout) {
      clearTimeout(this.breakCheckTimeout);
    }
    this.container.remove();
  }
}

/**
 * Singleton getter for mobile detection
 */
export function isMobileDevice(): boolean {
  return MobileControls.isMobile();
}


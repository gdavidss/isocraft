/**
 * Gamepad Manager - Controller support with Command Design Pattern
 * 
 * Supports standard gamepads (Xbox, PlayStation, etc.) with:
 * - Configurable button mappings
 * - Analog stick movement with deadzone
 * - Menu navigation
 * - Command pattern for extensible input handling
 */

import { getSoundManager } from './SoundManager';

// ============ COMMAND PATTERN INTERFACES ============

/**
 * Command interface - base for all gamepad commands
 */
export interface GameCommand {
  execute(): void;
  undo?(): void;
}

/**
 * Continuous command for held buttons/sticks
 */
export interface ContinuousCommand extends GameCommand {
  isActive(): boolean;
}

// ============ GAMEPAD BUTTON/AXIS MAPPING ============

/**
 * Standard gamepad buttons (based on W3C Standard Gamepad mapping)
 * https://w3c.github.io/gamepad/#remapping
 */
export enum GamepadButton {
  A = 0,              // Bottom button (A on Xbox, X on PlayStation)
  B = 1,              // Right button (B on Xbox, Circle on PlayStation)
  X = 2,              // Left button (X on Xbox, Square on PlayStation)
  Y = 3,              // Top button (Y on Xbox, Triangle on PlayStation)
  LeftBumper = 4,     // L1 / LB
  RightBumper = 5,    // R1 / RB
  LeftTrigger = 6,    // L2 / LT
  RightTrigger = 7,   // R2 / RT
  Select = 8,         // Back / Select / Share
  Start = 9,          // Start / Options
  LeftStickPress = 10,// L3
  RightStickPress = 11,// R3
  DPadUp = 12,
  DPadDown = 13,
  DPadLeft = 14,
  DPadRight = 15,
  Home = 16,          // Xbox / PS button (not always available)
}

/**
 * Standard gamepad axes
 */
export enum GamepadAxis {
  LeftStickX = 0,
  LeftStickY = 1,
  RightStickX = 2,
  RightStickY = 3,
}

/**
 * Game actions that can be mapped to gamepad inputs
 */
export enum GameAction {
  // Movement
  MoveForward = 'moveForward',
  MoveBackward = 'moveBackward',
  MoveLeft = 'moveLeft',
  MoveRight = 'moveRight',
  
  // Actions
  Jump = 'jump',
  Crouch = 'crouch',
  Attack = 'attack',      // Break blocks / left click
  Use = 'use',            // Place blocks / right click
  
  // Inventory
  NextSlot = 'nextSlot',
  PrevSlot = 'prevSlot',
  
  // Menu
  Pause = 'pause',
  MenuUp = 'menuUp',
  MenuDown = 'menuDown',
  MenuLeft = 'menuLeft',
  MenuRight = 'menuRight',
  MenuSelect = 'menuSelect',
  MenuBack = 'menuBack',
  
  // Camera
  ZoomIn = 'zoomIn',
  ZoomOut = 'zoomOut',
}

/**
 * Button mapping configuration
 */
export interface GamepadButtonMapping {
  button: GamepadButton;
  action: GameAction;
}

/**
 * Axis mapping configuration
 */
export interface GamepadAxisMapping {
  axis: GamepadAxis;
  positiveAction: GameAction;
  negativeAction: GameAction;
  deadzone?: number;
}

/**
 * Complete gamepad settings
 */
export interface GamepadSettings {
  enabled: boolean;
  deadzone: number;        // Stick deadzone (0-1)
  sensitivity: number;     // Stick sensitivity multiplier
  invertY: boolean;        // Invert Y axis for camera/movement
  vibration: boolean;      // Enable vibration/haptics
  buttonMappings: GamepadButtonMapping[];
  axisMappings: GamepadAxisMapping[];
}

// ============ DEFAULT MAPPINGS ============

const DEFAULT_BUTTON_MAPPINGS: GamepadButtonMapping[] = [
  // Actions
  { button: GamepadButton.A, action: GameAction.Jump },
  { button: GamepadButton.B, action: GameAction.Crouch },
  { button: GamepadButton.RightTrigger, action: GameAction.Attack },
  { button: GamepadButton.LeftTrigger, action: GameAction.Use },
  
  // Inventory
  { button: GamepadButton.RightBumper, action: GameAction.NextSlot },
  { button: GamepadButton.LeftBumper, action: GameAction.PrevSlot },
  
  // Menu
  { button: GamepadButton.Start, action: GameAction.Pause },
  { button: GamepadButton.DPadUp, action: GameAction.MenuUp },
  { button: GamepadButton.DPadDown, action: GameAction.MenuDown },
  { button: GamepadButton.DPadLeft, action: GameAction.MenuLeft },
  { button: GamepadButton.DPadRight, action: GameAction.MenuRight },
  { button: GamepadButton.A, action: GameAction.MenuSelect },
  { button: GamepadButton.B, action: GameAction.MenuBack },
  
  // Camera zoom
  { button: GamepadButton.Y, action: GameAction.ZoomIn },
  { button: GamepadButton.X, action: GameAction.ZoomOut },
];

const DEFAULT_AXIS_MAPPINGS: GamepadAxisMapping[] = [
  // Left stick - movement
  {
    axis: GamepadAxis.LeftStickX,
    positiveAction: GameAction.MoveRight,
    negativeAction: GameAction.MoveLeft,
    deadzone: 0.15,
  },
  {
    axis: GamepadAxis.LeftStickY,
    positiveAction: GameAction.MoveBackward,
    negativeAction: GameAction.MoveForward,
    deadzone: 0.15,
  },
  // Right stick - could be used for camera in the future
];

const DEFAULT_SETTINGS: GamepadSettings = {
  enabled: true,
  deadzone: 0.15,
  sensitivity: 1.0,
  invertY: false,
  vibration: true,
  buttonMappings: DEFAULT_BUTTON_MAPPINGS,
  axisMappings: DEFAULT_AXIS_MAPPINGS,
};

// ============ BUTTON NAMES FOR UI ============

export const GAMEPAD_BUTTON_NAMES: Record<GamepadButton, string> = {
  [GamepadButton.A]: 'A / Cross',
  [GamepadButton.B]: 'B / Circle',
  [GamepadButton.X]: 'X / Square',
  [GamepadButton.Y]: 'Y / Triangle',
  [GamepadButton.LeftBumper]: 'LB / L1',
  [GamepadButton.RightBumper]: 'RB / R1',
  [GamepadButton.LeftTrigger]: 'LT / L2',
  [GamepadButton.RightTrigger]: 'RT / R2',
  [GamepadButton.Select]: 'Select / Share',
  [GamepadButton.Start]: 'Start / Options',
  [GamepadButton.LeftStickPress]: 'L3',
  [GamepadButton.RightStickPress]: 'R3',
  [GamepadButton.DPadUp]: 'D-Pad Up',
  [GamepadButton.DPadDown]: 'D-Pad Down',
  [GamepadButton.DPadLeft]: 'D-Pad Left',
  [GamepadButton.DPadRight]: 'D-Pad Right',
  [GamepadButton.Home]: 'Home',
};

export const ACTION_NAMES: Record<GameAction, string> = {
  [GameAction.MoveForward]: 'Move Forward',
  [GameAction.MoveBackward]: 'Move Backward',
  [GameAction.MoveLeft]: 'Move Left',
  [GameAction.MoveRight]: 'Move Right',
  [GameAction.Jump]: 'Jump',
  [GameAction.Crouch]: 'Crouch',
  [GameAction.Attack]: 'Attack / Break',
  [GameAction.Use]: 'Use / Place',
  [GameAction.NextSlot]: 'Next Slot',
  [GameAction.PrevSlot]: 'Previous Slot',
  [GameAction.Pause]: 'Pause',
  [GameAction.MenuUp]: 'Menu Up',
  [GameAction.MenuDown]: 'Menu Down',
  [GameAction.MenuLeft]: 'Menu Left',
  [GameAction.MenuRight]: 'Menu Right',
  [GameAction.MenuSelect]: 'Menu Select',
  [GameAction.MenuBack]: 'Menu Back',
  [GameAction.ZoomIn]: 'Zoom In',
  [GameAction.ZoomOut]: 'Zoom Out',
};

// ============ GAMEPAD STATE TRACKING ============

interface GamepadState {
  connected: boolean;
  buttons: boolean[];         // Current button states
  previousButtons: boolean[]; // Previous frame button states
  axes: number[];             // Current axis values
  previousAxes: number[];     // Previous frame axis values
}

// ============ GAMEPAD MANAGER CLASS ============

export class GamepadManager {
  private static instance: GamepadManager;
  
  private settings: GamepadSettings;
  private gamepads: Map<number, GamepadState> = new Map();
  private activeGamepadIndex: number | null = null;
  
  // Action states (computed from inputs)
  private actionStates: Map<GameAction, number> = new Map();
  private previousActionStates: Map<GameAction, number> = new Map();
  
  // Command mappings
  private commands: Map<GameAction, GameCommand> = new Map();
  
  // Callbacks for menu navigation
  public onMenuNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  public onMenuSelect?: () => void;
  public onMenuBack?: () => void;
  public onPause?: () => void;
  
  // Mode flag for menu vs gameplay
  private menuMode = false;
  
  // Repeat timers for menu navigation
  private menuRepeatTimers: Map<string, number> = new Map();
  private readonly MENU_REPEAT_DELAY = 400; // ms before repeat starts
  private readonly MENU_REPEAT_RATE = 150;  // ms between repeats
  
  private constructor() {
    this.settings = this.loadSettings();
    this.initializeActionStates();
    this.setupEventListeners();
    
    // Check for already-connected gamepads
    this.checkConnectedGamepads();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): GamepadManager {
    if (!GamepadManager.instance) {
      GamepadManager.instance = new GamepadManager();
    }
    return GamepadManager.instance;
  }
  
  /**
   * Initialize action state maps
   */
  private initializeActionStates(): void {
    for (const action of Object.values(GameAction)) {
      this.actionStates.set(action as GameAction, 0);
      this.previousActionStates.set(action as GameAction, 0);
    }
  }
  
  /**
   * Set up gamepad connection event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('gamepadconnected', (e) => {
      console.log(`🎮 Gamepad connected: ${e.gamepad.id}`);
      this.onGamepadConnected(e.gamepad);
    });
    
    window.addEventListener('gamepaddisconnected', (e) => {
      console.log(`🎮 Gamepad disconnected: ${e.gamepad.id}`);
      this.onGamepadDisconnected(e.gamepad);
    });
  }
  
  /**
   * Check for already connected gamepads (some browsers don't fire connect event)
   */
  private checkConnectedGamepads(): void {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
      if (gamepad) {
        this.onGamepadConnected(gamepad);
      }
    }
  }
  
  /**
   * Handle gamepad connection
   */
  private onGamepadConnected(gamepad: Gamepad): void {
    const state: GamepadState = {
      connected: true,
      buttons: new Array(gamepad.buttons.length).fill(false),
      previousButtons: new Array(gamepad.buttons.length).fill(false),
      axes: new Array(gamepad.axes.length).fill(0),
      previousAxes: new Array(gamepad.axes.length).fill(0),
    };
    
    this.gamepads.set(gamepad.index, state);
    
    // Use first connected gamepad as active
    if (this.activeGamepadIndex === null) {
      this.activeGamepadIndex = gamepad.index;
    }
  }
  
  /**
   * Handle gamepad disconnection
   */
  private onGamepadDisconnected(gamepad: Gamepad): void {
    this.gamepads.delete(gamepad.index);
    
    // Find new active gamepad if needed
    if (this.activeGamepadIndex === gamepad.index) {
      const remaining = Array.from(this.gamepads.keys());
      this.activeGamepadIndex = remaining.length > 0 ? remaining[0] : null;
    }
  }
  
  /**
   * Register a command for an action
   */
  registerCommand(action: GameAction, command: GameCommand): void {
    this.commands.set(action, command);
  }
  
  /**
   * Set menu mode (changes how inputs are processed)
   */
  setMenuMode(enabled: boolean): void {
    this.menuMode = enabled;
    // Clear repeat timers when switching modes
    this.menuRepeatTimers.clear();
  }
  
  /**
   * Check if a gamepad is connected
   */
  isConnected(): boolean {
    return this.activeGamepadIndex !== null && this.settings.enabled;
  }
  
  /**
   * Get the current gamepad name
   */
  getGamepadName(): string | null {
    if (this.activeGamepadIndex === null) return null;
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[this.activeGamepadIndex];
    return gamepad?.id || null;
  }
  
  /**
   * Update gamepad state - call this every frame
   */
  update(deltaTime: number): void {
    if (!this.settings.enabled || this.activeGamepadIndex === null) return;
    
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[this.activeGamepadIndex];
    if (!gamepad) return;
    
    const state = this.gamepads.get(this.activeGamepadIndex);
    if (!state) return;
    
    // Store previous states
    state.previousButtons = [...state.buttons];
    state.previousAxes = [...state.axes];
    
    // Update current states
    for (let i = 0; i < gamepad.buttons.length; i++) {
      state.buttons[i] = gamepad.buttons[i].pressed;
    }
    for (let i = 0; i < gamepad.axes.length; i++) {
      state.axes[i] = gamepad.axes[i];
    }
    
    // Store previous action states
    for (const [action, value] of this.actionStates) {
      this.previousActionStates.set(action, value);
    }
    
    // Compute action states from inputs
    this.computeActionStates(state);
    
    // Process actions based on mode
    if (this.menuMode) {
      this.processMenuActions(deltaTime);
    } else {
      this.processGameActions();
    }
  }
  
  /**
   * Compute action states from button and axis mappings
   */
  private computeActionStates(state: GamepadState): void {
    // Reset action states
    for (const action of Object.values(GameAction)) {
      this.actionStates.set(action as GameAction, 0);
    }
    
    // Process button mappings
    for (const mapping of this.settings.buttonMappings) {
      if (state.buttons[mapping.button]) {
        this.actionStates.set(mapping.action, 1);
      }
    }
    
    // Process axis mappings
    for (const mapping of this.settings.axisMappings) {
      const value = state.axes[mapping.axis] || 0;
      const deadzone = mapping.deadzone ?? this.settings.deadzone;
      
      // Apply deadzone
      let adjustedValue = 0;
      if (Math.abs(value) > deadzone) {
        // Rescale value to 0-1 range after deadzone
        adjustedValue = (Math.abs(value) - deadzone) / (1 - deadzone);
        adjustedValue = Math.sign(value) * adjustedValue;
      }
      
      // Apply invert Y if needed
      if (mapping.axis === GamepadAxis.LeftStickY && this.settings.invertY) {
        adjustedValue = -adjustedValue;
      }
      
      // Map to actions
      if (adjustedValue > 0) {
        const current = this.actionStates.get(mapping.positiveAction) || 0;
        this.actionStates.set(mapping.positiveAction, Math.max(current, adjustedValue));
      } else if (adjustedValue < 0) {
        const current = this.actionStates.get(mapping.negativeAction) || 0;
        this.actionStates.set(mapping.negativeAction, Math.max(current, Math.abs(adjustedValue)));
      }
    }
  }
  
  /**
   * Process actions during gameplay
   */
  private processGameActions(): void {
    // Execute commands for actions that were just pressed
    for (const [action, value] of this.actionStates) {
      const prevValue = this.previousActionStates.get(action) || 0;
      const justPressed = value > 0.5 && prevValue <= 0.5;
      
      if (justPressed) {
        const command = this.commands.get(action);
        if (command) {
          command.execute();
        }
        
        // Handle pause action
        if (action === GameAction.Pause && this.onPause) {
          this.onPause();
        }
      }
    }
  }
  
  /**
   * Process actions during menu navigation
   */
  private processMenuActions(_deltaTime: number): void {
    const now = performance.now();
    
    // Menu navigation with repeat
    const directions: Array<{ action: GameAction; dir: 'up' | 'down' | 'left' | 'right' }> = [
      { action: GameAction.MenuUp, dir: 'up' },
      { action: GameAction.MenuDown, dir: 'down' },
      { action: GameAction.MenuLeft, dir: 'left' },
      { action: GameAction.MenuRight, dir: 'right' },
    ];
    
    for (const { action, dir } of directions) {
      const value = this.actionStates.get(action) || 0;
      const prevValue = this.previousActionStates.get(action) || 0;
      const justPressed = value > 0.5 && prevValue <= 0.5;
      const held = value > 0.5;
      const released = value <= 0.5 && prevValue > 0.5;
      
      if (released) {
        this.menuRepeatTimers.delete(dir);
      } else if (justPressed) {
        // Initial press
        this.onMenuNavigate?.(dir);
        getSoundManager().playUIClick();
        this.menuRepeatTimers.set(dir, now + this.MENU_REPEAT_DELAY);
      } else if (held) {
        // Check for repeat
        const repeatTime = this.menuRepeatTimers.get(dir);
        if (repeatTime && now >= repeatTime) {
          this.onMenuNavigate?.(dir);
          getSoundManager().playUIClick();
          this.menuRepeatTimers.set(dir, now + this.MENU_REPEAT_RATE);
        }
      }
    }
    
    // Menu select (just pressed)
    const selectValue = this.actionStates.get(GameAction.MenuSelect) || 0;
    const selectPrev = this.previousActionStates.get(GameAction.MenuSelect) || 0;
    if (selectValue > 0.5 && selectPrev <= 0.5) {
      this.onMenuSelect?.();
      getSoundManager().playUIClick();
    }
    
    // Menu back (just pressed)
    const backValue = this.actionStates.get(GameAction.MenuBack) || 0;
    const backPrev = this.previousActionStates.get(GameAction.MenuBack) || 0;
    if (backValue > 0.5 && backPrev <= 0.5) {
      this.onMenuBack?.();
      getSoundManager().playUIClick();
    }
    
    // Pause in menu should also trigger back
    const pauseValue = this.actionStates.get(GameAction.Pause) || 0;
    const pausePrev = this.previousActionStates.get(GameAction.Pause) || 0;
    if (pauseValue > 0.5 && pausePrev <= 0.5) {
      this.onMenuBack?.();
      getSoundManager().playUIClick();
    }
  }
  
  /**
   * Get the current value of an action (0-1 for analog, 0 or 1 for digital)
   */
  getActionValue(action: GameAction): number {
    if (!this.settings.enabled) return 0;
    return this.actionStates.get(action) || 0;
  }
  
  /**
   * Check if an action was just pressed this frame
   */
  isActionJustPressed(action: GameAction): boolean {
    if (!this.settings.enabled) return false;
    const current = this.actionStates.get(action) || 0;
    const previous = this.previousActionStates.get(action) || 0;
    return current > 0.5 && previous <= 0.5;
  }
  
  /**
   * Check if an action is currently pressed
   */
  isActionPressed(action: GameAction): boolean {
    if (!this.settings.enabled) return false;
    return (this.actionStates.get(action) || 0) > 0.5;
  }
  
  /**
   * Get movement input as a normalized vector
   */
  getMovementVector(): { x: number; y: number } {
    if (!this.settings.enabled) return { x: 0, y: 0 };
    
    // Get raw movement values
    const left = this.actionStates.get(GameAction.MoveLeft) || 0;
    const right = this.actionStates.get(GameAction.MoveRight) || 0;
    const forward = this.actionStates.get(GameAction.MoveForward) || 0;
    const backward = this.actionStates.get(GameAction.MoveBackward) || 0;
    
    let x = right - left;
    let y = backward - forward;
    
    // Apply sensitivity
    x *= this.settings.sensitivity;
    y *= this.settings.sensitivity;
    
    // Normalize if magnitude > 1
    const magnitude = Math.sqrt(x * x + y * y);
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }
    
    return { x, y };
  }
  
  /**
   * Trigger vibration/haptic feedback
   */
  vibrate(duration: number, weakMagnitude = 0.5, strongMagnitude = 0.5): void {
    if (!this.settings.vibration || this.activeGamepadIndex === null) return;
    
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[this.activeGamepadIndex];
    if (!gamepad?.vibrationActuator) return;
    
    gamepad.vibrationActuator.playEffect('dual-rumble', {
      startDelay: 0,
      duration: duration,
      weakMagnitude: weakMagnitude,
      strongMagnitude: strongMagnitude,
    }).catch(() => {
      // Silently ignore vibration errors
    });
  }
  
  // ============ SETTINGS MANAGEMENT ============
  
  /**
   * Get current settings
   */
  getSettings(): GamepadSettings {
    return { ...this.settings };
  }
  
  /**
   * Update settings
   */
  updateSettings(settings: Partial<GamepadSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.saveSettings();
  }
  
  /**
   * Update a single button mapping
   */
  setButtonMapping(button: GamepadButton, action: GameAction): void {
    // Remove existing mapping for this button (except menu actions which can share)
    const isMenuAction = [
      GameAction.MenuUp, GameAction.MenuDown, GameAction.MenuLeft, GameAction.MenuRight,
      GameAction.MenuSelect, GameAction.MenuBack
    ].includes(action);
    
    if (!isMenuAction) {
      this.settings.buttonMappings = this.settings.buttonMappings.filter(
        m => m.button !== button || [
          GameAction.MenuUp, GameAction.MenuDown, GameAction.MenuLeft, GameAction.MenuRight,
          GameAction.MenuSelect, GameAction.MenuBack
        ].includes(m.action)
      );
    }
    
    // Add new mapping
    this.settings.buttonMappings.push({ button, action });
    this.saveSettings();
  }
  
  /**
   * Get the button currently mapped to an action
   */
  getButtonForAction(action: GameAction): GamepadButton | null {
    const mapping = this.settings.buttonMappings.find(m => m.action === action);
    return mapping?.button ?? null;
  }
  
  /**
   * Reset mappings to defaults
   */
  resetToDefaults(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
  }
  
  /**
   * Load settings from localStorage
   */
  private loadSettings(): GamepadSettings {
    try {
      const saved = localStorage.getItem('isocraft_gamepad_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure all fields exist
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          buttonMappings: parsed.buttonMappings || DEFAULT_BUTTON_MAPPINGS,
          axisMappings: parsed.axisMappings || DEFAULT_AXIS_MAPPINGS,
        };
      }
    } catch {
      // Ignore parse errors
    }
    return { ...DEFAULT_SETTINGS };
  }
  
  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem('isocraft_gamepad_settings', JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
  }
  
  /**
   * Wait for any button press (for remapping)
   * Returns a promise that resolves with the pressed button
   */
  waitForButtonPress(timeout = 5000): Promise<GamepadButton | null> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      const checkButton = () => {
        if (performance.now() - startTime > timeout) {
          resolve(null);
          return;
        }
        
        if (this.activeGamepadIndex === null) {
          requestAnimationFrame(checkButton);
          return;
        }
        
        const gamepads = navigator.getGamepads();
        const gamepad = gamepads[this.activeGamepadIndex];
        if (!gamepad) {
          requestAnimationFrame(checkButton);
          return;
        }
        
        // Check for pressed button
        for (let i = 0; i < gamepad.buttons.length; i++) {
          if (gamepad.buttons[i].pressed) {
            resolve(i as GamepadButton);
            return;
          }
        }
        
        requestAnimationFrame(checkButton);
      };
      
      requestAnimationFrame(checkButton);
    });
  }
}

// ============ CONCRETE COMMANDS ============

/**
 * Jump command
 */
export class JumpCommand implements GameCommand {
  constructor(private onJump: () => void) {}
  
  execute(): void {
    this.onJump();
  }
}

/**
 * Crouch command (toggle or hold)
 */
export class CrouchCommand implements GameCommand {
  constructor(
    private onCrouchStart: () => void,
    private onCrouchEnd?: () => void
  ) {}
  
  execute(): void {
    this.onCrouchStart();
  }
  
  undo(): void {
    this.onCrouchEnd?.();
  }
}

/**
 * Attack/Break command
 */
export class AttackCommand implements GameCommand {
  constructor(
    private onAttackStart: () => void,
    private onAttackEnd?: () => void
  ) {}
  
  execute(): void {
    this.onAttackStart();
  }
  
  undo(): void {
    this.onAttackEnd?.();
  }
}

/**
 * Use/Place command
 */
export class UseCommand implements GameCommand {
  constructor(private onUse: () => void) {}
  
  execute(): void {
    this.onUse();
  }
}

/**
 * Inventory slot change command
 */
export class InventorySlotCommand implements GameCommand {
  constructor(
    private direction: 'next' | 'prev',
    private onChange: (direction: 'next' | 'prev') => void
  ) {}
  
  execute(): void {
    this.onChange(this.direction);
  }
}

/**
 * Zoom command
 */
export class ZoomCommand implements GameCommand {
  constructor(
    private direction: 'in' | 'out',
    private onZoom: (direction: 'in' | 'out') => void
  ) {}
  
  execute(): void {
    this.onZoom(this.direction);
  }
}

// Export singleton getter for convenience
export function getGamepadManager(): GamepadManager {
  return GamepadManager.getInstance();
}


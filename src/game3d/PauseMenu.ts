/**
 * Pause Menu - Minecraft-style game menu
 * 
 * Appears when pressing ESC, with options to:
 * - Resume game
 * - Access options (sound settings, video, controls)
 * - Toggle debug screen (F3)
 * - Save and quit
 * 
 * Styled exactly like Minecraft's pause menu
 */

import { getSoundManager } from './SoundManager';
import { getMusicManager } from './MusicManager';
import { MC_FONT, MC_FONT_FACE } from './DebugUI3D';
import { 
  getGamepadManager,
  GameAction, 
  GAMEPAD_BUTTON_NAMES, 
  ACTION_NAMES,
} from './GamepadManager';

export interface SoundSettings {
  masterVolume: number;
  musicVolume: number;
  soundEffectsVolume: number;
  ambientVolume: number;
}

export interface VideoSettings {
  renderDistance: number;       // Chunk load radius (2-8)
  zoom: number;                 // Camera zoom level (15-60)
  graphicsQuality: 'low' | 'medium' | 'high';  // Affects pixel ratio & AA
  fogEnabled: boolean;          // Enable/disable fog
  particlesEnabled: boolean;    // Enable/disable particles
  shaderEnabled: boolean;       // Enable/disable shader effects
}

export interface GameSettings {
  sound: SoundSettings;
  video: VideoSettings;
  showFPS: boolean;
  musicEnabled: boolean;
}

// Default settings
const DEFAULT_SETTINGS: GameSettings = {
  sound: {
    masterVolume: 100,
    musicVolume: 50,
    soundEffectsVolume: 100,
    ambientVolume: 100,
  },
  video: {
    renderDistance: 4,
    zoom: 10,
    graphicsQuality: 'high',
    fogEnabled: true,
    particlesEnabled: true,
    shaderEnabled: true,
  },
  showFPS: true,
  musicEnabled: true,
};

export class PauseMenu {
  private container: HTMLDivElement;
  private isVisible: boolean = false;
  private currentScreen: 'main' | 'options' | 'sound' | 'video' | 'controls' | 'about' = 'main';
  private settings: GameSettings;
  
  // Gamepad navigation
  private focusableElements: HTMLElement[] = [];
  private focusedIndex: number = 0;
  private isRemapping: boolean = false;
  private _remappingAction: GameAction | null = null; // Currently being remapped (for future use)
  
  // Callbacks
  public onResume?: () => void;
  public onSettingsChange?: (settings: GameSettings) => void;
  public onToggleDebug?: () => void;
  public onQuit?: () => void;
  
  constructor() {
    // Load settings from localStorage or use defaults
    this.settings = this.loadSettings();
    
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'pause-menu';
    this.container.style.display = 'none';
    
    // Inject styles
    this.injectStyles();
    
    // Build menu
    this.buildMainMenu();
    
    // Add to DOM
    document.body.appendChild(this.container);
    
    // Apply initial settings
    this.applySettings();
    
    // Set up gamepad navigation
    this.setupGamepadNavigation();
  }
  
  /**
   * Inject Minecraft-style CSS
   */
  private injectStyles(): void {
    if (document.getElementById('pause-menu-styles')) return;
    
    // Inject Minecraft font if not already present
    if (!document.getElementById('minecraft-font-styles')) {
      const fontStyle = document.createElement('style');
      fontStyle.id = 'minecraft-font-styles';
      fontStyle.textContent = MC_FONT_FACE;
      document.head.appendChild(fontStyle);
    }
    
    const style = document.createElement('style');
    style.id = 'pause-menu-styles';
    style.textContent = `
      #pause-menu {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: ${MC_FONT};
        image-rendering: pixelated;
        -webkit-font-smoothing: none;
        -moz-osx-font-smoothing: grayscale;
      }
      
      .mc-title {
        color: #fff;
        font-size: 20px;
        margin-bottom: 24px;
        text-shadow: 2px 2px 0 #3f3f3f;
        letter-spacing: 0px;
        font-family: ${MC_FONT};
      }
      
      .mc-button-container {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: center;
      }
      
      .mc-button-row {
        display: flex;
        gap: 6px;
        justify-content: center;
      }
      
      .mc-button {
        min-width: 200px;
        height: 40px;
        padding: 0 20px;
        font-family: ${MC_FONT};
        font-size: 16px;
        color: #e0e0e0;
        text-shadow: 2px 2px 0 #383838;
        border: 3px solid;
        border-top-color: #aaa;
        border-left-color: #aaa;
        border-right-color: #555;
        border-bottom-color: #555;
        background: linear-gradient(to bottom, 
          #737373 0%, 
          #6a6a6a 40%, 
          #585858 50%, 
          #6a6a6a 60%, 
          #737373 100%);
        cursor: pointer;
        transition: none;
        position: relative;
        box-shadow: 
          inset 1px 1px 0 rgba(255,255,255,0.15),
          inset -1px -1px 0 rgba(0,0,0,0.2);
      }
      
      .mc-button:hover {
        color: #ffffa0;
        background: linear-gradient(to bottom, 
          #6686b4 0%, 
          #5d7aa8 40%, 
          #4a6590 50%, 
          #5d7aa8 60%, 
          #6686b4 100%);
        border-top-color: #aab8d4;
        border-left-color: #aab8d4;
        border-right-color: #4a5568;
        border-bottom-color: #4a5568;
      }
      
      .mc-button:active {
        background: linear-gradient(to bottom, #5a5a5a 0%, #505050 50%, #4a4a4a 100%);
      }
      
      .mc-button.half {
        min-width: 150px;
        width: 150px;
      }
      
      .mc-button.wide {
        min-width: 400px;
      }
      
      .mc-slider-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 400px;
        margin: 4px 0;
      }
      
      .mc-slider-row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 400px;
      }
      
      .mc-slider-label {
        color: #fff;
        font-size: 14px;
        font-family: ${MC_FONT};
        text-shadow: 2px 2px 0 #3f3f3f;
        min-width: 160px;
      }
      
      .mc-slider {
        flex: 1;
        height: 40px;
        appearance: none;
        background: linear-gradient(to bottom, 
          #737373 0%, 
          #6a6a6a 40%, 
          #585858 50%, 
          #6a6a6a 60%, 
          #737373 100%);
        border: 3px solid;
        border-top-color: #aaa;
        border-left-color: #aaa;
        border-right-color: #555;
        border-bottom-color: #555;
        cursor: pointer;
        position: relative;
      }
      
      .mc-slider::-webkit-slider-thumb {
        appearance: none;
        width: 8px;
        height: 34px;
        background: linear-gradient(to bottom, #e0e0e0 0%, #c0c0c0 50%, #a0a0a0 100%);
        border: 2px solid;
        border-color: #fff #666 #666 #fff;
        cursor: pointer;
      }
      
      .mc-slider::-moz-range-thumb {
        width: 8px;
        height: 34px;
        background: linear-gradient(to bottom, #e0e0e0 0%, #c0c0c0 50%, #a0a0a0 100%);
        border: 2px solid;
        border-color: #fff #666 #666 #fff;
        cursor: pointer;
      }
      
      .mc-slider:hover::-webkit-slider-thumb {
        background: linear-gradient(to bottom, #ffffa0 0%, #e0e080 50%, #c0c060 100%);
      }
      
      .mc-slider-value {
        color: #fff;
        font-size: 14px;
        font-family: ${MC_FONT};
        text-shadow: 2px 2px 0 #3f3f3f;
        min-width: 50px;
        text-align: right;
      }
      
      .mc-toggle {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 8px 0;
        width: 400px;
        justify-content: space-between;
      }
      
      .mc-toggle-label {
        color: #fff;
        font-size: 14px;
        font-family: ${MC_FONT};
        text-shadow: 2px 2px 0 #3f3f3f;
      }
      
      .mc-toggle-btn {
        min-width: 180px;
        height: 40px;
        font-family: ${MC_FONT};
        font-size: 14px;
        color: #e0e0e0;
        text-shadow: 2px 2px 0 #383838;
        border: 3px solid;
        border-top-color: #aaa;
        border-left-color: #aaa;
        border-right-color: #555;
        border-bottom-color: #555;
        background: linear-gradient(to bottom, 
          #737373 0%, 
          #6a6a6a 40%, 
          #585858 50%, 
          #6a6a6a 60%, 
          #737373 100%);
        cursor: pointer;
      }
      
      .mc-toggle-btn:hover {
        color: #ffffa0;
        background: linear-gradient(to bottom, 
          #6686b4 0%, 
          #5d7aa8 40%, 
          #4a6590 50%, 
          #5d7aa8 60%, 
          #6686b4 100%);
      }
      
      .mc-toggle-btn.on {
        color: #5f5;
      }
      
      .mc-toggle-btn.off {
        color: #f55;
      }
      
      .mc-divider {
        width: 400px;
        height: 0px;
        margin: 12px 0;
      }
      
      .mc-section-title {
        color: #fff;
        font-size: 14px;
        font-family: ${MC_FONT};
        text-shadow: 2px 2px 0 #3f3f3f;
        margin: 16px 0 8px 0;
        width: 400px;
        text-align: center;
      }
      
      .mc-about-container {
        max-width: 500px;
        padding: 20px;
        text-align: center;
      }
      
      .mc-about-text {
        color: #ddd;
        font-size: 12px;
        font-family: ${MC_FONT};
        text-shadow: 1px 1px 0 #222;
        line-height: 1.6;
        margin-bottom: 20px;
      }
      
      .mc-about-credit {
        color: #fff;
        font-size: 14px;
        font-family: ${MC_FONT};
        text-shadow: 2px 2px 0 #3f3f3f;
        margin: 20px 0;
      }
      
      .mc-about-link {
        color: #5af;
        text-decoration: none;
        font-family: ${MC_FONT};
      }
      
      .mc-about-link:hover {
        color: #8cf;
        text-decoration: underline;
      }
      
      .mc-footer-credit {
        color: #888;
        font-size: 11px;
        font-family: ${MC_FONT};
        text-shadow: 1px 1px 0 #222;
        margin-top: 24px;
      }
      
      .mc-footer-credit a {
        color: #aaa;
        text-decoration: none;
      }
      
      .mc-footer-credit a:hover {
        color: #5af;
        text-decoration: underline;
      }
      
      /* Gamepad focus styles */
      .mc-button.gamepad-focus,
      .mc-toggle-btn.gamepad-focus,
      .mc-slider.gamepad-focus {
        outline: 3px solid #fff;
        outline-offset: 2px;
        animation: gamepad-focus-pulse 1s ease-in-out infinite;
      }
      
      @keyframes gamepad-focus-pulse {
        0%, 100% { outline-color: #fff; }
        50% { outline-color: #ffffa0; }
      }
      
      .mc-button.gamepad-focus {
        color: #ffffa0;
        background: linear-gradient(to bottom, 
          #6686b4 0%, 
          #5d7aa8 40%, 
          #4a6590 50%, 
          #5d7aa8 60%, 
          #6686b4 100%);
      }
      
      /* Gamepad indicator */
      .gamepad-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.7);
        border: 2px solid #555;
        border-radius: 4px;
        color: #aaa;
        font-size: 11px;
        font-family: ${MC_FONT};
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 10001;
      }
      
      .gamepad-indicator.connected {
        border-color: #5f5;
        color: #5f5;
      }
      
      .gamepad-icon {
        width: 16px;
        height: 16px;
      }
      
      /* Controls menu specific styles */
      .mc-controls-grid {
        display: grid;
        grid-template-columns: 1fr 150px;
        gap: 8px;
        width: 400px;
        margin: 8px 0;
      }
      
      .mc-control-row {
        display: contents;
      }
      
      .mc-control-label {
        color: #ddd;
        font-size: 12px;
        font-family: ${MC_FONT};
        text-shadow: 1px 1px 0 #222;
        padding: 8px 0;
        text-align: left;
      }
      
      .mc-control-btn {
        min-width: 120px;
        height: 32px;
        font-family: ${MC_FONT};
        font-size: 11px;
        color: #e0e0e0;
        text-shadow: 1px 1px 0 #383838;
        border: 2px solid;
        border-top-color: #aaa;
        border-left-color: #aaa;
        border-right-color: #555;
        border-bottom-color: #555;
        background: linear-gradient(to bottom, 
          #737373 0%, 
          #6a6a6a 40%, 
          #585858 50%, 
          #6a6a6a 60%, 
          #737373 100%);
        cursor: pointer;
      }
      
      .mc-control-btn:hover,
      .mc-control-btn.gamepad-focus {
        color: #ffffa0;
        background: linear-gradient(to bottom, 
          #6686b4 0%, 
          #5d7aa8 40%, 
          #4a6590 50%, 
          #5d7aa8 60%, 
          #6686b4 100%);
      }
      
      .mc-control-btn.remapping {
        color: #ff5;
        animation: remap-pulse 0.5s ease-in-out infinite;
      }
      
      @keyframes remap-pulse {
        0%, 100% { background-color: #6686b4; }
        50% { background-color: #8896c4; }
      }
      
      .mc-gamepad-status {
        color: #888;
        font-size: 11px;
        font-family: ${MC_FONT};
        text-shadow: 1px 1px 0 #222;
        margin: 8px 0;
        padding: 8px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 4px;
        width: 384px;
        text-align: center;
      }
      
      .mc-gamepad-status.connected {
        color: #5f5;
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Set up gamepad navigation callbacks
   */
  private setupGamepadNavigation(): void {
    const gamepad = getGamepadManager();
    
    gamepad.onMenuNavigate = (direction) => {
      if (!this.isVisible || this.isRemapping) return;
      
      if (direction === 'up') {
        this.moveFocus(-1);
      } else if (direction === 'down') {
        this.moveFocus(1);
      } else if (direction === 'left' || direction === 'right') {
        // Handle slider adjustment
        const focused = this.focusableElements[this.focusedIndex];
        if (focused?.classList.contains('mc-slider')) {
          const slider = focused as HTMLInputElement;
          const step = direction === 'left' ? -5 : 5;
          const newValue = Math.max(
            parseInt(slider.min),
            Math.min(parseInt(slider.max), parseInt(slider.value) + step)
          );
          slider.value = String(newValue);
          slider.dispatchEvent(new Event('input'));
          slider.dispatchEvent(new Event('change'));
        }
      }
    };
    
    gamepad.onMenuSelect = () => {
      if (!this.isVisible || this.isRemapping) return;
      
      const focused = this.focusableElements[this.focusedIndex];
      if (focused) {
        focused.click();
      }
    };
    
    gamepad.onMenuBack = () => {
      if (!this.isVisible) return;
      
      if (this.isRemapping) {
        // Cancel remapping
        this.isRemapping = false;
        this._remappingAction = null;
        this.buildControlsMenu();
        return;
      }
      
      // Navigate back based on current screen
      if (this.currentScreen === 'main') {
        this.hide();
        this.onResume?.();
      } else if (this.currentScreen === 'options') {
        this.buildMainMenu();
      } else {
        this.buildOptionsMenu();
      }
    };
  }
  
  /**
   * Update the list of focusable elements and set initial focus
   */
  private updateFocusableElements(): void {
    // Clear previous focus
    this.focusableElements.forEach(el => el.classList.remove('gamepad-focus'));
    
    // Find all focusable elements
    this.focusableElements = Array.from(
      this.container.querySelectorAll<HTMLElement>(
        '.mc-button, .mc-toggle-btn, .mc-slider, .mc-control-btn'
      )
    ).filter(el => !el.hasAttribute('disabled'));
    
    // Reset focus to first element
    this.focusedIndex = 0;
    this.updateFocusVisual();
  }
  
  /**
   * Move focus by delta (-1 for up, 1 for down)
   */
  private moveFocus(delta: number): void {
    if (this.focusableElements.length === 0) return;
    
    // Remove current focus
    this.focusableElements[this.focusedIndex]?.classList.remove('gamepad-focus');
    
    // Calculate new index with wrapping
    this.focusedIndex += delta;
    if (this.focusedIndex < 0) {
      this.focusedIndex = this.focusableElements.length - 1;
    } else if (this.focusedIndex >= this.focusableElements.length) {
      this.focusedIndex = 0;
    }
    
    this.updateFocusVisual();
  }
  
  /**
   * Update the visual focus indicator
   */
  private updateFocusVisual(): void {
    const focused = this.focusableElements[this.focusedIndex];
    if (focused) {
      focused.classList.add('gamepad-focus');
      focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  /**
   * Build the main pause menu
   */
  private buildMainMenu(): void {
    this.container.innerHTML = `
      <div class="mc-title">Game Menu</div>
      <div class="mc-button-container">
        <button class="mc-button wide" id="btn-resume">Back to Game</button>
        <button class="mc-button wide" id="btn-options">Options...</button>
        <button class="mc-button wide" id="btn-quit">Save and Quit to Title</button>
        <div class="mc-footer-credit">Created by <a href="https://www.guidavid.com/" target="_blank" rel="noopener noreferrer">Gui Dávid</a></div>
      </div>
    `;
    
    this.currentScreen = 'main';
    this.attachMainMenuListeners();
    this.updateFocusableElements();
  }
  
  /**
   * Attach event listeners to main menu buttons
   */
  private attachMainMenuListeners(): void {
    this.container.querySelector('#btn-resume')?.addEventListener('click', () => {
      this.playClickSound();
      this.hide();
      this.onResume?.();
    });
    
    this.container.querySelector('#btn-options')?.addEventListener('click', () => {
      this.playClickSound();
      this.buildOptionsMenu();
    });
    
    this.container.querySelector('#btn-quit')?.addEventListener('click', () => {
      this.playClickSound();
      this.onQuit?.();
      // Reload the page to "quit"
      window.location.reload();
    });
  }
  
  /**
   * Build the options menu
   */
  private buildOptionsMenu(): void {
    const gamepad = getGamepadManager();
    const gamepadConnected = gamepad.isConnected();
    
    this.container.innerHTML = `
      <div class="mc-title">Options</div>
      <div class="mc-button-container">
        <button class="mc-button wide" id="btn-sound">Music & Sounds...</button>
        <button class="mc-button wide" id="btn-video">Video Settings...</button>
        <button class="mc-button wide" id="btn-controls">Controls...</button>
        
        <div class="mc-toggle">
          <span class="mc-toggle-label">Debug Screen (F3):</span>
          <button class="mc-toggle-btn ${this.settings.showFPS ? 'on' : 'off'}" id="btn-toggle-debug">
            ${this.settings.showFPS ? 'ON' : 'OFF'}
          </button>
        </div>
        
        <button class="mc-button wide" id="btn-about">About...</button>
        <button class="mc-button wide" id="btn-back-options">Done</button>
      </div>
      ${gamepadConnected ? `
        <div class="gamepad-indicator connected">
          <span>🎮</span>
          <span>Controller Connected</span>
        </div>
      ` : ''}
    `;
    
    this.currentScreen = 'options';
    this.attachOptionsMenuListeners();
    this.updateFocusableElements();
  }
  
  /**
   * Attach event listeners to options menu
   */
  private attachOptionsMenuListeners(): void {
    this.container.querySelector('#btn-sound')?.addEventListener('click', () => {
      this.playClickSound();
      this.buildSoundMenu();
    });
    
    this.container.querySelector('#btn-video')?.addEventListener('click', () => {
      this.playClickSound();
      this.buildVideoMenu();
    });
    
    this.container.querySelector('#btn-controls')?.addEventListener('click', () => {
      this.playClickSound();
      this.buildControlsMenu();
    });
    
    this.container.querySelector('#btn-toggle-debug')?.addEventListener('click', () => {
      this.playClickSound();
      this.settings.showFPS = !this.settings.showFPS;
      this.saveSettings();
      this.onToggleDebug?.();
      this.buildOptionsMenu(); // Refresh
    });
    
    this.container.querySelector('#btn-about')?.addEventListener('click', () => {
      this.playClickSound();
      this.buildAboutMenu();
    });
    
    this.container.querySelector('#btn-back-options')?.addEventListener('click', () => {
      this.playClickSound();
      this.buildMainMenu();
    });
  }
  
  /**
   * Build the sound settings menu
   */
  private buildSoundMenu(): void {
    const music = getMusicManager();
    
    this.container.innerHTML = `
      <div class="mc-title">Music & Sound Options</div>
      <div class="mc-button-container">
        
        <div class="mc-section-title">Volume Controls</div>
        
        <div class="mc-slider-row">
          <span class="mc-slider-label">Master Volume:</span>
          <input type="range" class="mc-slider" id="slider-master" min="0" max="100" value="${this.settings.sound.masterVolume}">
          <span class="mc-slider-value" id="val-master">${this.settings.sound.masterVolume}%</span>
        </div>
        
        <div class="mc-slider-row">
          <span class="mc-slider-label">Music:</span>
          <input type="range" class="mc-slider" id="slider-music" min="0" max="100" value="${this.settings.sound.musicVolume}">
          <span class="mc-slider-value" id="val-music">${this.settings.sound.musicVolume}%</span>
        </div>
        
        <div class="mc-slider-row">
          <span class="mc-slider-label">Sound Effects:</span>
          <input type="range" class="mc-slider" id="slider-sfx" min="0" max="100" value="${this.settings.sound.soundEffectsVolume}">
          <span class="mc-slider-value" id="val-sfx">${this.settings.sound.soundEffectsVolume}%</span>
        </div>
        
        <div class="mc-slider-row">
          <span class="mc-slider-label">Ambient/Environment:</span>
          <input type="range" class="mc-slider" id="slider-ambient" min="0" max="100" value="${this.settings.sound.ambientVolume}">
          <span class="mc-slider-value" id="val-ambient">${this.settings.sound.ambientVolume}%</span>
        </div>
        
        <div class="mc-divider"></div>
        
        <div class="mc-section-title">Music Settings</div>
        
        <div class="mc-toggle">
          <span class="mc-toggle-label">Background Music:</span>
          <button class="mc-toggle-btn ${this.settings.musicEnabled ? 'on' : 'off'}" id="btn-toggle-music">
            ${this.settings.musicEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        
        <button class="mc-button" id="btn-skip-track" ${!music.isCurrentlyPlaying() ? 'disabled' : ''}>
          Skip Current Track
        </button>
        
        <div class="mc-divider"></div>
        
        <button class="mc-button wide" id="btn-back-sound">Done</button>
      </div>
    `;
    
    this.currentScreen = 'sound';
    this.attachSoundMenuListeners();
    this.updateFocusableElements();
  }
  
  /**
   * Attach event listeners to sound menu
   */
  private attachSoundMenuListeners(): void {
    const music = getMusicManager();
    
    // Master volume slider
    const masterSlider = this.container.querySelector('#slider-master') as HTMLInputElement;
    const masterVal = this.container.querySelector('#val-master') as HTMLSpanElement;
    masterSlider?.addEventListener('input', () => {
      const val = parseInt(masterSlider.value);
      this.settings.sound.masterVolume = val;
      masterVal.textContent = `${val}%`;
      this.applySettings();
    });
    masterSlider?.addEventListener('change', () => this.saveSettings());
    
    // Music volume slider
    const musicSlider = this.container.querySelector('#slider-music') as HTMLInputElement;
    const musicVal = this.container.querySelector('#val-music') as HTMLSpanElement;
    musicSlider?.addEventListener('input', () => {
      const val = parseInt(musicSlider.value);
      this.settings.sound.musicVolume = val;
      musicVal.textContent = `${val}%`;
      this.applySettings();
    });
    musicSlider?.addEventListener('change', () => this.saveSettings());
    
    // SFX volume slider
    const sfxSlider = this.container.querySelector('#slider-sfx') as HTMLInputElement;
    const sfxVal = this.container.querySelector('#val-sfx') as HTMLSpanElement;
    sfxSlider?.addEventListener('input', () => {
      const val = parseInt(sfxSlider.value);
      this.settings.sound.soundEffectsVolume = val;
      sfxVal.textContent = `${val}%`;
      this.applySettings();
    });
    sfxSlider?.addEventListener('change', () => this.saveSettings());
    
    // Ambient volume slider
    const ambientSlider = this.container.querySelector('#slider-ambient') as HTMLInputElement;
    const ambientVal = this.container.querySelector('#val-ambient') as HTMLSpanElement;
    ambientSlider?.addEventListener('input', () => {
      const val = parseInt(ambientSlider.value);
      this.settings.sound.ambientVolume = val;
      ambientVal.textContent = `${val}%`;
      this.applySettings();
    });
    ambientSlider?.addEventListener('change', () => this.saveSettings());
    
    // Music toggle
    this.container.querySelector('#btn-toggle-music')?.addEventListener('click', () => {
      this.playClickSound();
      this.settings.musicEnabled = !this.settings.musicEnabled;
      music.setEnabled(this.settings.musicEnabled);
      this.saveSettings();
      this.buildSoundMenu(); // Refresh
    });
    
    // Skip track
    this.container.querySelector('#btn-skip-track')?.addEventListener('click', () => {
      this.playClickSound();
      music.skip();
    });
    
    // Back button
    this.container.querySelector('#btn-back-sound')?.addEventListener('click', () => {
      this.playClickSound();
      this.buildOptionsMenu();
    });
  }
  
  /**
   * Build the video settings menu
   */
  private buildVideoMenu(): void {
    const qualityLabels: Record<string, string> = {
      'low': 'Fast',
      'medium': 'Fancy',
      'high': 'Fabulous'
    };
    
    this.container.innerHTML = `
      <div class="mc-title">Video Settings</div>
      <div class="mc-button-container">
        
        <div class="mc-section-title">Performance</div>
        
        <div class="mc-slider-row">
          <span class="mc-slider-label">Render Distance:</span>
          <input type="range" class="mc-slider" id="slider-render-distance" min="2" max="8" value="${this.settings.video.renderDistance}">
          <span class="mc-slider-value" id="val-render-distance">${this.settings.video.renderDistance} chunks</span>
        </div>
        
        <div class="mc-toggle">
          <span class="mc-toggle-label">Graphics:</span>
          <button class="mc-toggle-btn" id="btn-graphics-quality">
            ${qualityLabels[this.settings.video.graphicsQuality]}
          </button>
        </div>
        
        <div class="mc-divider"></div>
        
        <div class="mc-section-title">View Settings</div>
        
        <div class="mc-slider-row">
          <span class="mc-slider-label">Camera Zoom:</span>
          <input type="range" class="mc-slider" id="slider-zoom" min="5" max="26" value="${this.settings.video.zoom}">
          <span class="mc-slider-value" id="val-zoom">${this.settings.video.zoom}</span>
        </div>
        
        <div class="mc-toggle">
          <span class="mc-toggle-label">Fog:</span>
          <button class="mc-toggle-btn ${this.settings.video.fogEnabled ? 'on' : 'off'}" id="btn-toggle-fog">
            ${this.settings.video.fogEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        
        <div class="mc-toggle">
          <span class="mc-toggle-label">Particles:</span>
          <button class="mc-toggle-btn ${this.settings.video.particlesEnabled ? 'on' : 'off'}" id="btn-toggle-particles">
            ${this.settings.video.particlesEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        
        <div class="mc-toggle">
          <span class="mc-toggle-label">Shader Effects:</span>
          <button class="mc-toggle-btn ${this.settings.video.shaderEnabled ? 'on' : 'off'}" id="btn-toggle-shader">
            ${this.settings.video.shaderEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        
        <div class="mc-divider"></div>
        
        <button class="mc-button wide" id="btn-back-video">Done</button>
      </div>
    `;
    
    this.currentScreen = 'video';
    this.attachVideoMenuListeners();
    this.updateFocusableElements();
  }
  
  /**
   * Attach event listeners to video menu
   */
  private attachVideoMenuListeners(): void {
    const qualityOrder: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
    const qualityLabels: Record<string, string> = {
      'low': 'Fast',
      'medium': 'Fancy',
      'high': 'Fabulous'
    };
    
    // Render distance slider
    const renderSlider = this.container.querySelector('#slider-render-distance') as HTMLInputElement;
    const renderVal = this.container.querySelector('#val-render-distance') as HTMLSpanElement;
    renderSlider?.addEventListener('input', () => {
      const val = parseInt(renderSlider.value);
      this.settings.video.renderDistance = val;
      renderVal.textContent = `${val} chunks`;
      this.applySettings();
    });
    renderSlider?.addEventListener('change', () => this.saveSettings());
    
    // Zoom slider
    const zoomSlider = this.container.querySelector('#slider-zoom') as HTMLInputElement;
    const zoomVal = this.container.querySelector('#val-zoom') as HTMLSpanElement;
    zoomSlider?.addEventListener('input', () => {
      const val = parseInt(zoomSlider.value);
      this.settings.video.zoom = val;
      zoomVal.textContent = `${val}`;
      this.applySettings();
    });
    zoomSlider?.addEventListener('change', () => this.saveSettings());
    
    // Graphics quality button (cycles through options)
    const graphicsBtn = this.container.querySelector('#btn-graphics-quality') as HTMLButtonElement;
    graphicsBtn?.addEventListener('click', () => {
      this.playClickSound();
      const currentIndex = qualityOrder.indexOf(this.settings.video.graphicsQuality);
      const nextIndex = (currentIndex + 1) % qualityOrder.length;
      this.settings.video.graphicsQuality = qualityOrder[nextIndex];
      graphicsBtn.textContent = qualityLabels[this.settings.video.graphicsQuality];
      this.saveSettings();
    });
    
    // Fog toggle
    this.container.querySelector('#btn-toggle-fog')?.addEventListener('click', () => {
      this.playClickSound();
      this.settings.video.fogEnabled = !this.settings.video.fogEnabled;
      this.saveSettings();
      this.buildVideoMenu(); // Refresh
    });
    
    // Particles toggle
    this.container.querySelector('#btn-toggle-particles')?.addEventListener('click', () => {
      this.playClickSound();
      this.settings.video.particlesEnabled = !this.settings.video.particlesEnabled;
      this.saveSettings();
      this.buildVideoMenu(); // Refresh
    });
    
    // Shader toggle
    this.container.querySelector('#btn-toggle-shader')?.addEventListener('click', () => {
      this.playClickSound();
      this.settings.video.shaderEnabled = !this.settings.video.shaderEnabled;
      this.saveSettings();
      this.buildVideoMenu(); // Refresh
    });
    
    // Back button
    this.container.querySelector('#btn-back-video')?.addEventListener('click', () => {
      this.playClickSound();
      this.buildOptionsMenu();
    });
  }
  
  /**
   * Build the controls/gamepad settings menu
   */
  private buildControlsMenu(): void {
    const gamepad = getGamepadManager();
    const settings = gamepad.getSettings();
    const gamepadConnected = gamepad.isConnected();
    const gamepadName = gamepad.getGamepadName();
    
    // Actions that can be remapped (excluding menu actions which are fixed)
    const remappableActions: GameAction[] = [
      GameAction.Jump,
      GameAction.Crouch,
      GameAction.Attack,
      GameAction.Use,
      GameAction.NextSlot,
      GameAction.PrevSlot,
      GameAction.ZoomIn,
      GameAction.ZoomOut,
    ];
    
    // Build button mapping rows
    const mappingRows = remappableActions.map(action => {
      const button = gamepad.getButtonForAction(action);
      const buttonName = button !== null ? GAMEPAD_BUTTON_NAMES[button] : 'None';
      const actionName = ACTION_NAMES[action];
      return `
        <div class="mc-control-row">
          <span class="mc-control-label">${actionName}:</span>
          <button class="mc-control-btn" data-action="${action}">${buttonName}</button>
        </div>
      `;
    }).join('');
    
    this.container.innerHTML = `
      <div class="mc-title">Controls</div>
      <div class="mc-button-container">
        
        <div class="mc-gamepad-status ${gamepadConnected ? 'connected' : ''}">
          ${gamepadConnected 
            ? `🎮 ${gamepadName ? gamepadName.substring(0, 40) : 'Controller Connected'}`
            : '🎮 No controller connected'}
        </div>
        
        <div class="mc-section-title">Gamepad Settings</div>
        
        <div class="mc-toggle">
          <span class="mc-toggle-label">Gamepad Enabled:</span>
          <button class="mc-toggle-btn ${settings.enabled ? 'on' : 'off'}" id="btn-toggle-gamepad">
            ${settings.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
        
        <div class="mc-slider-row">
          <span class="mc-slider-label">Stick Deadzone:</span>
          <input type="range" class="mc-slider" id="slider-deadzone" min="5" max="40" value="${Math.round(settings.deadzone * 100)}">
          <span class="mc-slider-value" id="val-deadzone">${Math.round(settings.deadzone * 100)}%</span>
        </div>
        
        <div class="mc-slider-row">
          <span class="mc-slider-label">Sensitivity:</span>
          <input type="range" class="mc-slider" id="slider-sensitivity" min="50" max="150" value="${Math.round(settings.sensitivity * 100)}">
          <span class="mc-slider-value" id="val-sensitivity">${Math.round(settings.sensitivity * 100)}%</span>
        </div>
        
        <div class="mc-toggle">
          <span class="mc-toggle-label">Invert Y Axis:</span>
          <button class="mc-toggle-btn ${settings.invertY ? 'on' : 'off'}" id="btn-toggle-inverty">
            ${settings.invertY ? 'ON' : 'OFF'}
          </button>
        </div>
        
        <div class="mc-toggle">
          <span class="mc-toggle-label">Vibration:</span>
          <button class="mc-toggle-btn ${settings.vibration ? 'on' : 'off'}" id="btn-toggle-vibration">
            ${settings.vibration ? 'ON' : 'OFF'}
          </button>
        </div>
        
        <div class="mc-divider"></div>
        
        <div class="mc-section-title">Button Mappings</div>
        <div class="mc-about-text" style="width: 400px; margin-bottom: 8px;">
          Click a button to remap it. Press any gamepad button to assign.
        </div>
        
        <div class="mc-controls-grid">
          ${mappingRows}
        </div>
        
        <div class="mc-divider"></div>
        
        <button class="mc-button" id="btn-reset-controls">Reset to Defaults</button>
        <button class="mc-button wide" id="btn-back-controls">Done</button>
      </div>
    `;
    
    this.currentScreen = 'controls';
    this.attachControlsMenuListeners();
    this.updateFocusableElements();
  }
  
  /**
   * Attach event listeners to controls menu
   */
  private attachControlsMenuListeners(): void {
    const gamepad = getGamepadManager();
    
    // Gamepad enabled toggle
    this.container.querySelector('#btn-toggle-gamepad')?.addEventListener('click', () => {
      this.playClickSound();
      const settings = gamepad.getSettings();
      gamepad.updateSettings({ enabled: !settings.enabled });
      this.buildControlsMenu(); // Refresh
    });
    
    // Deadzone slider
    const deadzoneSlider = this.container.querySelector('#slider-deadzone') as HTMLInputElement;
    const deadzoneVal = this.container.querySelector('#val-deadzone') as HTMLSpanElement;
    deadzoneSlider?.addEventListener('input', () => {
      const val = parseInt(deadzoneSlider.value);
      deadzoneVal.textContent = `${val}%`;
      gamepad.updateSettings({ deadzone: val / 100 });
    });
    
    // Sensitivity slider
    const sensitivitySlider = this.container.querySelector('#slider-sensitivity') as HTMLInputElement;
    const sensitivityVal = this.container.querySelector('#val-sensitivity') as HTMLSpanElement;
    sensitivitySlider?.addEventListener('input', () => {
      const val = parseInt(sensitivitySlider.value);
      sensitivityVal.textContent = `${val}%`;
      gamepad.updateSettings({ sensitivity: val / 100 });
    });
    
    // Invert Y toggle
    this.container.querySelector('#btn-toggle-inverty')?.addEventListener('click', () => {
      this.playClickSound();
      const settings = gamepad.getSettings();
      gamepad.updateSettings({ invertY: !settings.invertY });
      this.buildControlsMenu(); // Refresh
    });
    
    // Vibration toggle
    this.container.querySelector('#btn-toggle-vibration')?.addEventListener('click', () => {
      this.playClickSound();
      const settings = gamepad.getSettings();
      gamepad.updateSettings({ vibration: !settings.vibration });
      // Test vibration if enabled
      if (!settings.vibration) {
        gamepad.vibrate(200, 0.5, 0.5);
      }
      this.buildControlsMenu(); // Refresh
    });
    
    // Button remapping
    this.container.querySelectorAll('.mc-control-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action') as GameAction;
        if (!action) return;
        
        this.playClickSound();
        this.isRemapping = true;
        this._remappingAction = action;
        
        // Update button to show remapping state
        btn.textContent = 'Press button...';
        btn.classList.add('remapping');
        
        // Wait for button press
        const pressedButton = await gamepad.waitForButtonPress(5000);
        
        this.isRemapping = false;
        this._remappingAction = null;
        
        if (pressedButton !== null) {
          gamepad.setButtonMapping(pressedButton, action);
          this.playClickSound();
        }
        
        // Refresh the menu
        this.buildControlsMenu();
      });
    });
    
    // Reset to defaults
    this.container.querySelector('#btn-reset-controls')?.addEventListener('click', () => {
      this.playClickSound();
      gamepad.resetToDefaults();
      this.buildControlsMenu(); // Refresh
    });
    
    // Back button
    this.container.querySelector('#btn-back-controls')?.addEventListener('click', () => {
      this.playClickSound();
      this.buildOptionsMenu();
    });
  }
  
  /**
   * Build the about menu with disclaimer and credits
   */
  private buildAboutMenu(): void {
    this.container.innerHTML = `
      <div class="mc-title">About</div>
      <div class="mc-about-container">
        <div class="mc-about-text">
          This is an independent, open-source fan project created for educational and non-commercial purposes. Minecraft® is a trademark of Mojang Studios/Microsoft Corporation. All Minecraft-related assets, including but not limited to textures, sounds, and other media derived from Minecraft, are the property of Mojang Studios/Microsoft Corporation.
        </div>
        
        <div class="mc-about-credit">
          Created by <a href="https://www.guidavid.com/" target="_blank" rel="noopener noreferrer" class="mc-about-link">Gui Dávid</a>
        </div>
        
        <div class="mc-divider"></div>
        
        <button class="mc-button wide" id="btn-back-about">Done</button>
      </div>
    `;
    
    this.currentScreen = 'about';
    this.attachAboutMenuListeners();
    this.updateFocusableElements();
  }
  
  /**
   * Attach event listeners to about menu
   */
  private attachAboutMenuListeners(): void {
    this.container.querySelector('#btn-back-about')?.addEventListener('click', () => {
      this.playClickSound();
      this.buildOptionsMenu();
    });
  }
  
  /**
   * Play UI click sound
   */
  private playClickSound(): void {
    getSoundManager().playUIClick();
  }
  
  /**
   * Apply current settings to the game
   */
  private applySettings(): void {
    const sound = getSoundManager();
    const music = getMusicManager();
    
    // Calculate effective volumes
    const masterMultiplier = this.settings.sound.masterVolume / 100;
    
    // Apply to sound manager (SFX)
    sound.setMasterVolume(masterMultiplier * (this.settings.sound.soundEffectsVolume / 100));
    
    // Apply to music manager
    music.setVolume(masterMultiplier * (this.settings.sound.musicVolume / 100));
    music.setEnabled(this.settings.musicEnabled);
    
    // Notify listeners
    this.onSettingsChange?.(this.settings);
  }
  
  /**
   * Load settings from localStorage
   */
  private loadSettings(): GameSettings {
    try {
      const saved = localStorage.getItem('isocraft_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Deep merge nested objects (sound, video) with defaults
        const settings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          sound: { ...DEFAULT_SETTINGS.sound, ...(parsed.sound || {}) },
          video: { ...DEFAULT_SETTINGS.video, ...(parsed.video || {}) },
        };
        // Always reset zoom to default (10x) on page reload
        settings.video.zoom = DEFAULT_SETTINGS.video.zoom;
        return settings;
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
      localStorage.setItem('isocraft_settings', JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
    this.applySettings();
  }
  
  /**
   * Get current settings
   */
  getSettings(): GameSettings {
    return { ...this.settings };
  }
  
  /**
   * Toggle debug screen setting (called from F3 key)
   */
  toggleDebugSetting(): void {
    this.settings.showFPS = !this.settings.showFPS;
    this.saveSettings();
  }
  
  /**
   * Show the pause menu
   */
  show(): void {
    if (this.isVisible) return;
    
    this.isVisible = true;
    this.container.style.display = 'flex';
    this.buildMainMenu();
    
    // Enable gamepad menu mode
    getGamepadManager().setMenuMode(true);
    
    // Play click sound
    this.playClickSound();
  }
  
  /**
   * Hide the pause menu
   */
  hide(): void {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    this.container.style.display = 'none';
    
    // Disable gamepad menu mode
    getGamepadManager().setMenuMode(false);
  }
  
  /**
   * Toggle visibility
   */
  toggle(): void {
    if (this.isVisible) {
      // If in a submenu, go back; if in main menu, close
      if (this.currentScreen === 'sound' || this.currentScreen === 'video' || 
          this.currentScreen === 'about' || this.currentScreen === 'controls') {
        this.playClickSound();
        this.buildOptionsMenu();
      } else if (this.currentScreen === 'options') {
        this.playClickSound();
        this.buildMainMenu();
      } else {
        this.hide();
        this.onResume?.();
      }
    } else {
      this.show();
    }
  }
  
  /**
   * Check if menu is visible
   */
  isMenuVisible(): boolean {
    return this.isVisible;
  }
  
  /**
   * Clean up
   */
  destroy(): void {
    this.container.remove();
    const styles = document.getElementById('pause-menu-styles');
    if (styles) styles.remove();
  }
}


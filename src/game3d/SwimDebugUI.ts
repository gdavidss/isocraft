/**
 * Swim Debug UI - Adjust swimming position in real-time
 * Toggle with Shift+W
 */

import { MC_FONT, MC_FONT_FACE } from './DebugUI3D';

export interface SwimPoseConfig {
  name: string;
  meshRotationX: number;
  bodyRotationX: number;
  headRotationX: number;
  armForwardAngle: number;
  armStrokeAmplitude: number;
  legKickAmplitude: number;
  heightOffset: number;
  pivotOffsetY: number;
  pivotOffsetZ: number;
}

// Callback for when settings change
type SwimSettingsCallback = (settings: SwimPoseConfig) => void;

export class SwimDebugUI {
  private container: HTMLDivElement;
  private visible = false;
  private settings: SwimPoseConfig;
  private onChangeCallback: SwimSettingsCallback | null = null;
  
  // Also track the player's Y offset in water (from Game3D)
  private waterYOffset = 0.0;
  private onWaterYChangeCallback: ((offset: number) => void) | null = null;

  constructor() {
    // Default values matching Player3D.ts
    this.settings = {
      name: "Diving Down",
      meshRotationX: 1.30,
      bodyRotationX: 0,
      headRotationX: -1.74,
      armForwardAngle: Math.PI / 1.8,
      armStrokeAmplitude: 0.6,
      legKickAmplitude: 0.4,
      heightOffset: -0.7,
      pivotOffsetY: 0.2,
      pivotOffsetZ: 0.3,
    };

    this.container = document.createElement('div');
    this.container.className = 'swim-debug-ui';
    this.container.style.display = 'none';
    
    this.buildUI();
    this.addStyles();
    document.body.appendChild(this.container);

    // Toggle with Shift+W
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyW' && e.shiftKey) {
        e.preventDefault();
        this.toggleVisibility();
      }
    });
  }

  setOnChange(callback: SwimSettingsCallback): void {
    this.onChangeCallback = callback;
  }
  
  setOnWaterYChange(callback: (offset: number) => void): void {
    this.onWaterYChangeCallback = callback;
  }

  private buildUI(): void {
    this.container.innerHTML = `
      <div class="swim-panel">
        <div class="swim-title">🏊 Swim Debug (Shift+W)</div>
        
        <div class="swim-section">
          <div class="section-title">Water Position (Game3D)</div>
          
          <div class="slider-row">
            <label>Water Y Offset</label>
            <input type="range" id="swim-water-y" min="-1" max="2" step="0.05" value="${this.waterYOffset}">
            <span class="slider-value" id="swim-water-y-val">${this.waterYOffset.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="swim-section">
          <div class="section-title">Mesh Position Offsets</div>
          
          <div class="slider-row">
            <label>Height Offset</label>
            <input type="range" id="swim-height" min="-3" max="1" step="0.05" value="${this.settings.heightOffset}">
            <span class="slider-value" id="swim-height-val">${this.settings.heightOffset.toFixed(2)}</span>
          </div>
          
          <div class="slider-row">
            <label>Pivot Offset Y</label>
            <input type="range" id="swim-pivot-y" min="-2" max="2" step="0.05" value="${this.settings.pivotOffsetY}">
            <span class="slider-value" id="swim-pivot-y-val">${this.settings.pivotOffsetY.toFixed(2)}</span>
          </div>
          
          <div class="slider-row">
            <label>Pivot Offset Z</label>
            <input type="range" id="swim-pivot-z" min="-2" max="2" step="0.05" value="${this.settings.pivotOffsetZ}">
            <span class="slider-value" id="swim-pivot-z-val">${this.settings.pivotOffsetZ.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="swim-section">
          <div class="section-title">Rotation</div>
          
          <div class="slider-row">
            <label>Mesh Rotation X</label>
            <input type="range" id="swim-mesh-rot" min="0" max="${Math.PI}" step="0.05" value="${this.settings.meshRotationX}">
            <span class="slider-value" id="swim-mesh-rot-val">${this.settings.meshRotationX.toFixed(2)}</span>
          </div>
          
          <div class="slider-row">
            <label>Head Rotation X</label>
            <input type="range" id="swim-head-rot" min="${-Math.PI}" max="${Math.PI}" step="0.05" value="${this.settings.headRotationX}">
            <span class="slider-value" id="swim-head-rot-val">${this.settings.headRotationX.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="swim-actions">
          <button id="swim-reset">Reset Defaults</button>
          <button id="swim-copy">Copy Values</button>
        </div>
        
        <div class="swim-output" id="swim-output"></div>
      </div>
    `;

    setTimeout(() => this.bindEvents(), 0);
  }

  private bindEvents(): void {
    // Water Y offset (separate from swim pose)
    const waterYSlider = document.getElementById('swim-water-y') as HTMLInputElement;
    const waterYVal = document.getElementById('swim-water-y-val');
    waterYSlider?.addEventListener('input', () => {
      this.waterYOffset = parseFloat(waterYSlider.value);
      if (waterYVal) waterYVal.textContent = this.waterYOffset.toFixed(2);
      this.onWaterYChangeCallback?.(this.waterYOffset);
    });
    
    // Pose sliders
    this.bindSlider('swim-height', 'heightOffset');
    this.bindSlider('swim-pivot-y', 'pivotOffsetY');
    this.bindSlider('swim-pivot-z', 'pivotOffsetZ');
    this.bindSlider('swim-mesh-rot', 'meshRotationX');
    this.bindSlider('swim-head-rot', 'headRotationX');
    
    // Reset button
    document.getElementById('swim-reset')?.addEventListener('click', () => {
      this.resetDefaults();
    });
    
    // Copy button
    document.getElementById('swim-copy')?.addEventListener('click', () => {
      this.copyValues();
    });
  }

  private bindSlider(sliderId: string, settingKey: keyof SwimPoseConfig): void {
    const slider = document.getElementById(sliderId) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${sliderId}-val`);
    
    if (!slider || !valueDisplay) return;
    
    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value);
      (this.settings[settingKey] as number) = value;
      valueDisplay.textContent = value.toFixed(2);
      
      this.onChangeCallback?.(this.settings);
    });
  }

  private resetDefaults(): void {
    this.settings = {
      name: "Diving Down",
      meshRotationX: 1.30,
      bodyRotationX: 0,
      headRotationX: -1.74,
      armForwardAngle: Math.PI / 1.8,
      armStrokeAmplitude: 0.6,
      legKickAmplitude: 0.4,
      heightOffset: -0.7,
      pivotOffsetY: 0.2,
      pivotOffsetZ: 0.3,
    };
    this.waterYOffset = 0.0;
    
    // Update UI
    this.updateSlider('swim-water-y', this.waterYOffset);
    this.updateSlider('swim-height', this.settings.heightOffset);
    this.updateSlider('swim-pivot-y', this.settings.pivotOffsetY);
    this.updateSlider('swim-pivot-z', this.settings.pivotOffsetZ);
    this.updateSlider('swim-mesh-rot', this.settings.meshRotationX);
    this.updateSlider('swim-head-rot', this.settings.headRotationX);
    
    this.onChangeCallback?.(this.settings);
    this.onWaterYChangeCallback?.(this.waterYOffset);
  }

  private updateSlider(sliderId: string, value: number): void {
    const slider = document.getElementById(sliderId) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${sliderId}-val`);
    if (slider) slider.value = String(value);
    if (valueDisplay) valueDisplay.textContent = value.toFixed(2);
  }

  private copyValues(): void {
    const output = `// Swim pose settings
const DEFAULT_SWIM_POSE: SwimPoseConfig = {
  name: "Diving Down",
  meshRotationX: ${this.settings.meshRotationX.toFixed(2)},
  bodyRotationX: ${this.settings.bodyRotationX.toFixed(2)},
  headRotationX: ${this.settings.headRotationX.toFixed(2)},
  armForwardAngle: ${this.settings.armForwardAngle.toFixed(2)},
  armStrokeAmplitude: ${this.settings.armStrokeAmplitude.toFixed(2)},
  legKickAmplitude: ${this.settings.legKickAmplitude.toFixed(2)},
  heightOffset: ${this.settings.heightOffset.toFixed(2)},
  pivotOffsetY: ${this.settings.pivotOffsetY.toFixed(2)},
  pivotOffsetZ: ${this.settings.pivotOffsetZ.toFixed(2)},
};

// Water Y offset in Game3D
const WATER_SWIM_Y_OFFSET = ${this.waterYOffset.toFixed(2)};`;
    
    navigator.clipboard.writeText(output).then(() => {
      const outputEl = document.getElementById('swim-output');
      if (outputEl) {
        outputEl.textContent = '✓ Copied to clipboard!';
        setTimeout(() => { outputEl.textContent = ''; }, 2000);
      }
    });
  }

  private addStyles(): void {
    // Inject Minecraft font if not already present
    if (!document.getElementById('minecraft-font-styles')) {
      const fontStyle = document.createElement('style');
      fontStyle.id = 'minecraft-font-styles';
      fontStyle.textContent = MC_FONT_FACE;
      document.head.appendChild(fontStyle);
    }
    
    const style = document.createElement('style');
    style.textContent = `
      .swim-debug-ui {
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 1001;
        font-family: ${MC_FONT};
        font-size: 11px;
        image-rendering: pixelated;
        -webkit-font-smoothing: none;
        -moz-osx-font-smoothing: grayscale;
      }
      
      .swim-panel {
        background: rgba(0, 0, 0, 0.85);
        border: 3px solid;
        border-top-color: #555;
        border-left-color: #555;
        border-right-color: #1a1a1a;
        border-bottom-color: #1a1a1a;
        padding: 12px 16px;
        color: #fff;
        min-width: 280px;
        box-shadow: inset 1px 1px 0 rgba(255,255,255,0.1);
      }
      
      .swim-title {
        font-size: 13px;
        color: #55ffff;
        margin-bottom: 10px;
        text-shadow: 2px 2px 0 #003333;
      }
      
      .swim-section {
        margin-bottom: 12px;
      }
      
      .section-title {
        color: #aaa;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 2px solid #333;
        text-shadow: 1px 1px 0 #222;
      }
      
      .slider-row {
        display: grid;
        grid-template-columns: 100px 1fr 45px;
        align-items: center;
        gap: 8px;
        margin: 6px 0;
      }
      
      .slider-row label {
        color: #ccc;
        font-size: 10px;
        text-shadow: 1px 1px 0 #222;
      }
      
      .slider-row input[type="range"] {
        width: 100%;
        height: 8px;
        -webkit-appearance: none;
        background: #333;
        border: 2px solid #222;
        cursor: pointer;
      }
      
      .slider-row input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 10px;
        height: 16px;
        background: linear-gradient(to bottom, #88ccff 0%, #66aadd 50%, #5599cc 100%);
        border: 2px solid;
        border-color: #aaddff #447799 #447799 #aaddff;
        cursor: pointer;
      }
      
      .slider-value {
        color: #55ffff;
        text-align: right;
        font-size: 10px;
        text-shadow: 1px 1px 0 #003333;
      }
      
      .swim-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      
      .swim-actions button {
        flex: 1;
        padding: 6px 10px;
        font-family: ${MC_FONT};
        font-size: 10px;
        cursor: pointer;
        border: 3px solid;
        border-top-color: #aaa;
        border-left-color: #aaa;
        border-right-color: #555;
        border-bottom-color: #555;
        background: linear-gradient(to bottom, #737373 0%, #6a6a6a 40%, #585858 50%, #6a6a6a 60%, #737373 100%);
        color: #fff;
        text-shadow: 2px 2px 0 #383838;
      }
      
      .swim-actions button:hover {
        color: #ffffa0;
        background: linear-gradient(to bottom, #6686b4 0%, #5d7aa8 40%, #4a6590 50%, #5d7aa8 60%, #6686b4 100%);
      }
      
      #swim-reset {
        color: #ff5555;
      }
      
      #swim-copy {
        color: #55ff55;
      }
      
      .swim-output {
        margin-top: 8px;
        color: #55ff55;
        font-size: 10px;
        text-align: center;
        min-height: 14px;
        text-shadow: 1px 1px 0 #003300;
      }
    `;
    document.head.appendChild(style);
  }

  toggleVisibility(): void {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
  }

  destroy(): void {
    this.container.remove();
  }
}


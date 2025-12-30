/**
 * Shader Debug UI - Adjust block shading in real-time
 * Uses Minecraft-style font for authentic look
 */

import * as THREE from 'three';
import { MC_FONT, MC_FONT_FACE } from './DebugUI3D';

export interface ShaderSettings {
  shaderEnabled: boolean;
  topBrightness: number;
  bottomBrightness: number;
  northSouthBrightness: number;
  eastWestBrightness: number;
  sunBoost: number;
  sunX: number;
  sunY: number;
  sunZ: number;
}

// Global material registry - all shader materials register here
const materialRegistry: THREE.ShaderMaterial[] = [];

/**
 * Register a material for live updates
 */
export function registerMaterial(material: THREE.ShaderMaterial): void {
  materialRegistry.push(material);
}

/**
 * Update all registered materials with new settings
 */
export function updateAllMaterials(settings: Partial<ShaderSettings>): void {
  const sunDir = new THREE.Vector3(
    settings.sunX ?? 50,
    settings.sunY ?? 100,
    settings.sunZ ?? 50
  ).normalize();

  for (const material of materialRegistry) {
    if (settings.shaderEnabled !== undefined && material.uniforms.shaderEnabled) {
      material.uniforms.shaderEnabled.value = settings.shaderEnabled;
    }
    if (settings.topBrightness !== undefined && material.uniforms.topBrightness) {
      material.uniforms.topBrightness.value = settings.topBrightness;
    }
    if (settings.bottomBrightness !== undefined && material.uniforms.bottomBrightness) {
      material.uniforms.bottomBrightness.value = settings.bottomBrightness;
    }
    if (settings.northSouthBrightness !== undefined && material.uniforms.northSouthBrightness) {
      material.uniforms.northSouthBrightness.value = settings.northSouthBrightness;
    }
    if (settings.eastWestBrightness !== undefined && material.uniforms.eastWestBrightness) {
      material.uniforms.eastWestBrightness.value = settings.eastWestBrightness;
    }
    if (settings.sunBoost !== undefined && material.uniforms.sunBoost) {
      material.uniforms.sunBoost.value = settings.sunBoost;
    }
    if (material.uniforms.sunDirection) {
      material.uniforms.sunDirection.value.copy(sunDir);
    }
  }
}

export class ShaderDebugUI {
  private container: HTMLDivElement;
  private visible = false; // Start hidden by default
  private settings: ShaderSettings;

  constructor() {
    // Default values matching BlockShader.ts
    this.settings = {
      shaderEnabled: true,
      topBrightness: 1.0,
      bottomBrightness: 0.6,
      northSouthBrightness: 0.9,
      eastWestBrightness: 0.8,
      sunBoost: 0.5,
      sunX: 50,
      sunY: 100,
      sunZ: 50,
    };

    this.container = document.createElement('div');
    this.container.className = 'shader-debug-ui';
    this.container.style.display = 'none'; // Start hidden by default
    
    this.buildUI();
    this.addStyles();
    document.body.appendChild(this.container);

    // Toggle with Shift+S
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyS' && e.shiftKey) {
        e.preventDefault();
        this.toggleVisibility();
      }
    });
  }

  private buildUI(): void {
    this.container.innerHTML = `
      <div class="shader-panel">
        <div class="shader-title">🎨 Shader Debug (Shift+S)</div>
        
        <div class="shader-toggle">
          <label class="toggle-label">
            <input type="checkbox" id="shader-enabled" ${this.settings.shaderEnabled ? 'checked' : ''}>
            <span class="toggle-text">Shader Effects</span>
            <span class="toggle-status" id="shader-status">${this.settings.shaderEnabled ? 'ON' : 'OFF'}</span>
          </label>
        </div>
        
        <div class="shader-section">
          <div class="section-title">Face Brightness</div>
          
          <div class="slider-row">
            <label>Top (Y+)</label>
            <input type="range" id="shader-top" min="0" max="2.0" step="0.05" value="${this.settings.topBrightness}">
            <span class="slider-value" id="shader-top-val">${this.settings.topBrightness}</span>
          </div>
          
          <div class="slider-row">
            <label>Bottom (Y-)</label>
            <input type="range" id="shader-bottom" min="0" max="2.0" step="0.05" value="${this.settings.bottomBrightness}">
            <span class="slider-value" id="shader-bottom-val">${this.settings.bottomBrightness}</span>
          </div>
          
          <div class="slider-row">
            <label>North/South (Z)</label>
            <input type="range" id="shader-ns" min="0" max="2.0" step="0.05" value="${this.settings.northSouthBrightness}">
            <span class="slider-value" id="shader-ns-val">${this.settings.northSouthBrightness}</span>
          </div>
          
          <div class="slider-row">
            <label>East/West (X)</label>
            <input type="range" id="shader-ew" min="0" max="2.0" step="0.05" value="${this.settings.eastWestBrightness}">
            <span class="slider-value" id="shader-ew-val">${this.settings.eastWestBrightness}</span>
          </div>
        </div>
        
        <div class="shader-section">
          <div class="section-title">Sun Light</div>
          
          <div class="slider-row">
            <label>Sun Boost</label>
            <input type="range" id="shader-sun-boost" min="0" max="0.5" step="0.01" value="${this.settings.sunBoost}">
            <span class="slider-value" id="shader-sun-boost-val">${this.settings.sunBoost}</span>
          </div>
          
          <div class="slider-row">
            <label>Sun X</label>
            <input type="range" id="shader-sun-x" min="-100" max="100" step="5" value="${this.settings.sunX}">
            <span class="slider-value" id="shader-sun-x-val">${this.settings.sunX}</span>
          </div>
          
          <div class="slider-row">
            <label>Sun Y</label>
            <input type="range" id="shader-sun-y" min="0" max="200" step="5" value="${this.settings.sunY}">
            <span class="slider-value" id="shader-sun-y-val">${this.settings.sunY}</span>
          </div>
          
          <div class="slider-row">
            <label>Sun Z</label>
            <input type="range" id="shader-sun-z" min="-100" max="100" step="5" value="${this.settings.sunZ}">
            <span class="slider-value" id="shader-sun-z-val">${this.settings.sunZ}</span>
          </div>
        </div>
        
        <div class="shader-actions">
          <button id="shader-reset">Reset Defaults</button>
          <button id="shader-copy">Copy Values</button>
        </div>
        
        <div class="shader-output" id="shader-output"></div>
      </div>
    `;

    // Bind event listeners after DOM is ready
    setTimeout(() => this.bindEvents(), 0);
  }

  private bindEvents(): void {
    // Shader toggle
    const toggleCheckbox = document.getElementById('shader-enabled') as HTMLInputElement;
    const statusEl = document.getElementById('shader-status');
    toggleCheckbox?.addEventListener('change', () => {
      this.settings.shaderEnabled = toggleCheckbox.checked;
      if (statusEl) statusEl.textContent = toggleCheckbox.checked ? 'ON' : 'OFF';
      updateAllMaterials(this.settings);
    });
    
    // Face brightness sliders
    this.bindSlider('shader-top', 'topBrightness');
    this.bindSlider('shader-bottom', 'bottomBrightness');
    this.bindSlider('shader-ns', 'northSouthBrightness');
    this.bindSlider('shader-ew', 'eastWestBrightness');
    
    // Sun sliders
    this.bindSlider('shader-sun-boost', 'sunBoost');
    this.bindSlider('shader-sun-x', 'sunX');
    this.bindSlider('shader-sun-y', 'sunY');
    this.bindSlider('shader-sun-z', 'sunZ');
    
    // Reset button
    document.getElementById('shader-reset')?.addEventListener('click', () => {
      this.resetDefaults();
    });
    
    // Copy button
    document.getElementById('shader-copy')?.addEventListener('click', () => {
      this.copyValues();
    });
  }

  private bindSlider(sliderId: string, settingKey: keyof ShaderSettings): void {
    const slider = document.getElementById(sliderId) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${sliderId}-val`);
    
    if (!slider || !valueDisplay) return;
    
    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value);
      (this.settings as unknown as Record<string, number | boolean>)[settingKey] = value;
      valueDisplay.textContent = value.toFixed(2);
      
      // Update all materials
      updateAllMaterials(this.settings);
    });
  }

  private resetDefaults(): void {
    this.settings = {
      shaderEnabled: true,
      topBrightness: 1.0,
      bottomBrightness: 0.6,
      northSouthBrightness: 0.9,
      eastWestBrightness: 0.8,
      sunBoost: 0.5,
      sunX: 50,
      sunY: 100,
      sunZ: 50,
    };
    
    // Update UI
    const toggleCheckbox = document.getElementById('shader-enabled') as HTMLInputElement;
    const statusEl = document.getElementById('shader-status');
    if (toggleCheckbox) toggleCheckbox.checked = this.settings.shaderEnabled;
    if (statusEl) statusEl.textContent = this.settings.shaderEnabled ? 'ON' : 'OFF';
    
    this.updateSlider('shader-top', this.settings.topBrightness);
    this.updateSlider('shader-bottom', this.settings.bottomBrightness);
    this.updateSlider('shader-ns', this.settings.northSouthBrightness);
    this.updateSlider('shader-ew', this.settings.eastWestBrightness);
    this.updateSlider('shader-sun-boost', this.settings.sunBoost);
    this.updateSlider('shader-sun-x', this.settings.sunX);
    this.updateSlider('shader-sun-y', this.settings.sunY);
    this.updateSlider('shader-sun-z', this.settings.sunZ);
    
    // Update materials
    updateAllMaterials(this.settings);
  }

  private updateSlider(sliderId: string, value: number): void {
    const slider = document.getElementById(sliderId) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${sliderId}-val`);
    if (slider) slider.value = String(value);
    if (valueDisplay) valueDisplay.textContent = value.toFixed(2);
  }

  private copyValues(): void {
    const output = `// Shader settings
const FACE_BRIGHTNESS = {
  TOP: ${this.settings.topBrightness},
  BOTTOM: ${this.settings.bottomBrightness},
  NORTH: ${this.settings.northSouthBrightness},
  SOUTH: ${this.settings.northSouthBrightness},
  EAST: ${this.settings.eastWestBrightness},
  WEST: ${this.settings.eastWestBrightness},
};

const SUN_BOOST = ${this.settings.sunBoost};
const SUN_DIRECTION = new THREE.Vector3(${this.settings.sunX}, ${this.settings.sunY}, ${this.settings.sunZ});`;
    
    navigator.clipboard.writeText(output).then(() => {
      const outputEl = document.getElementById('shader-output');
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
      .shader-debug-ui {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1001;
        font-family: ${MC_FONT};
        font-size: 11px;
        image-rendering: pixelated;
        -webkit-font-smoothing: none;
        -moz-osx-font-smoothing: grayscale;
      }
      
      .shader-panel {
        background: rgba(0, 0, 0, 0.8);
        border: 3px solid;
        border-top-color: #555;
        border-left-color: #555;
        border-right-color: #1a1a1a;
        border-bottom-color: #1a1a1a;
        padding: 12px 16px;
        color: #fff;
        min-width: 300px;
        box-shadow: inset 1px 1px 0 rgba(255,255,255,0.1);
      }
      
      .shader-title {
        font-size: 13px;
        color: #ffff55;
        margin-bottom: 10px;
        text-shadow: 2px 2px 0 #333300;
      }
      
      .shader-toggle {
        background: rgba(0, 0, 0, 0.4);
        border: 2px solid #333;
        padding: 8px 10px;
        margin-bottom: 12px;
      }
      
      .toggle-label {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
      }
      
      .toggle-label input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: #55ff55;
      }
      
      .toggle-text {
        color: #fff;
        font-size: 11px;
        flex: 1;
        text-shadow: 1px 1px 0 #333;
      }
      
      .toggle-status {
        font-size: 10px;
        padding: 2px 6px;
        background: #003300;
        color: #55ff55;
        text-shadow: 1px 1px 0 #001100;
      }
      
      .toggle-label input:not(:checked) ~ .toggle-status {
        background: #330000;
        color: #ff5555;
        text-shadow: 1px 1px 0 #110000;
      }
      
      .shader-section {
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
        background: linear-gradient(to bottom, #888 0%, #666 50%, #555 100%);
        border: 2px solid;
        border-color: #aaa #444 #444 #aaa;
        cursor: pointer;
      }
      
      .slider-row input[type="range"]::-webkit-slider-thumb:hover {
        background: linear-gradient(to bottom, #7777ff 0%, #5555dd 50%, #4444cc 100%);
      }
      
      .slider-value {
        color: #55ffff;
        text-align: right;
        font-size: 10px;
        text-shadow: 1px 1px 0 #003333;
      }
      
      .shader-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      
      .shader-actions button {
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
      
      .shader-actions button:hover {
        color: #ffffa0;
        background: linear-gradient(to bottom, #6686b4 0%, #5d7aa8 40%, #4a6590 50%, #5d7aa8 60%, #6686b4 100%);
      }
      
      #shader-reset {
        color: #ff5555;
      }
      
      #shader-copy {
        color: #55ff55;
      }
      
      .shader-output {
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


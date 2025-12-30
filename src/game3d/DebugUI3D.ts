/**
 * Debug UI for Three.js game
 * Uses Minecraft-style font for authentic look
 */

// Minecraft font CSS - shared across UI components
export const MC_FONT_FACE = `
  @font-face {
    font-family: 'Minecraft';
    src: url('https://cdn.jsdelivr.net/gh/South-Paw/typeface-minecraft@master/files/minecraft.woff2') format('woff2'),
         url('https://cdn.jsdelivr.net/gh/South-Paw/typeface-minecraft@master/files/minecraft.woff') format('woff');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }
`;

export const MC_FONT = '"Minecraft", monospace';

interface DebugInfo {
  fps: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  chunks: number;
  biome: string;
  seed: number;
  zoom: number;
  // New debug stats
  playerState: string;
  triangles: number;
  drawCalls: number;
  blockBelow: string | null;
  targetedBlock: string | null;
}

export class DebugUI3D {
  private container: HTMLDivElement;
  private visible = false; // Start hidden by default

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'debug-ui-3d';
    this.container.style.display = 'none'; // Start hidden
    this.container.innerHTML = `
      <div class="debug-panel">
        <div class="debug-row">
          <span class="debug-label">FPS:</span>
          <span class="debug-value" id="debug-fps">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Memory:</span>
          <span class="debug-value" id="debug-memory">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Chunks:</span>
          <span class="debug-value" id="debug-chunks">--</span>
        </div>
        <div class="debug-row debug-seed">
          Seed: <span id="debug-seed">--</span>
        </div>
        <hr class="debug-divider">
        <div class="debug-row">
          <span class="debug-label">🔺 Triangles:</span>
          <span class="debug-value" id="debug-triangles">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">🎨 Draw Calls:</span>
          <span class="debug-value" id="debug-drawcalls">--</span>
        </div>
        <hr class="debug-divider">
        <div class="debug-row">
          <span class="debug-label">📍 Position:</span>
          <span class="debug-value" id="debug-position">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">🔍 Zoom:</span>
          <span class="debug-value" id="debug-zoom">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">🌍 Biome:</span>
          <span class="debug-value" id="debug-biome">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">🏃 State:</span>
          <span class="debug-value" id="debug-state">--</span>
        </div>
        <hr class="debug-divider">
        <div class="debug-row">
          <span class="debug-label">👟 Block Below:</span>
          <span class="debug-value" id="debug-block-below">--</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">🎯 Target:</span>
          <span class="debug-value" id="debug-target">--</span>
        </div>
        <hr class="debug-divider">
        <div class="debug-controls">
          <div class="control-row">F3 - Toggle Debug</div>
        </div>
      </div>
    `;
    
    this.addStyles();
    document.body.appendChild(this.container);
  }

  /**
   * Add CSS styles with Minecraft font
   */
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
      .debug-ui-3d {
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 1000;
        font-family: ${MC_FONT};
        font-size: 12px;
        image-rendering: pixelated;
        -webkit-font-smoothing: none;
        -moz-osx-font-smoothing: grayscale;
      }
      
      .debug-panel {
        background: rgba(0, 0, 0, 0.7);
        border: 3px solid;
        border-top-color: #555;
        border-left-color: #555;
        border-right-color: #1a1a1a;
        border-bottom-color: #1a1a1a;
        padding: 12px 16px;
        color: #fff;
        min-width: 220px;
        box-shadow: inset 1px 1px 0 rgba(255,255,255,0.1);
      }
      
      .debug-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 4px 0;
      }
      
      .debug-label {
        color: #aaa;
        text-shadow: 1px 1px 0 #222;
      }
      
      .debug-value {
        color: #55ffff;
        text-shadow: 1px 1px 0 #003333;
      }
      
      .debug-seed {
        color: #777;
        font-size: 10px;
        justify-content: flex-start;
        gap: 4px;
        text-shadow: 1px 1px 0 #111;
      }
      
      .debug-divider {
        border: none;
        border-top: 2px solid #333;
        margin: 10px 0;
      }
      
      .debug-controls {
        color: #aaa;
        font-size: 10px;
        text-shadow: 1px 1px 0 #222;
      }
      
      .control-row {
        margin: 3px 0;
        padding-left: 8px;
      }
      
      #debug-biome {
        color: #55ff55;
        text-shadow: 1px 1px 0 #003300;
      }
      
      #debug-position {
        color: #ff55ff;
        text-shadow: 1px 1px 0 #330033;
      }
      
      #debug-state {
        color: #ffaa00;
        text-shadow: 1px 1px 0 #332200;
      }
      
      #debug-triangles,
      #debug-drawcalls {
        color: #ff7777;
        text-shadow: 1px 1px 0 #330011;
      }
      
      #debug-block-below {
        color: #77aaff;
        text-shadow: 1px 1px 0 #112233;
      }
      
      #debug-target {
        color: #ffff77;
        text-shadow: 1px 1px 0 #333300;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Update debug info
   */
  update(info: DebugInfo): void {
    if (!this.visible) return;
    
    const setVal = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    
    setVal('debug-fps', String(info.fps));
    setVal('debug-chunks', String(info.chunks));
    setVal('debug-seed', info.seed.toString(16).toUpperCase());
    setVal('debug-position', `(${info.playerX.toFixed(0)}, ${info.playerY.toFixed(0)}, ${info.playerZ.toFixed(0)})`);
    setVal('debug-zoom', `${info.zoom.toFixed(1)}x`);
    setVal('debug-biome', info.biome);
    
    // New stats
    setVal('debug-state', info.playerState);
    setVal('debug-triangles', this.formatNumber(info.triangles));
    setVal('debug-drawcalls', String(info.drawCalls));
    setVal('debug-block-below', info.blockBelow || 'Air');
    setVal('debug-target', info.targetedBlock || 'None');
    
    // Memory
    const mem = (performance as any).memory;
    if (mem) {
      setVal('debug-memory', `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB`);
    }
  }
  
  /**
   * Format large numbers with K/M suffix
   */
  private formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return String(num);
  }

  /**
   * Toggle visibility
   */
  toggleVisibility(): void {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.container.remove();
  }
}


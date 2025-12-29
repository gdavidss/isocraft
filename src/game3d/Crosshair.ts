/**
 * Crosshair overlay - Minecraft-style "+" cursor that follows the mouse
 * Uses CSS mix-blend-mode: difference for inverted colors
 */

export class Crosshair {
  private container: HTMLDivElement;
  private visible = true;
  private boundMouseMove: (e: MouseEvent) => void;

  constructor() {
    this.container = this.createCrosshair();
    document.body.appendChild(this.container);
    
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
    this.container.style.left = `${e.clientX}px`;
    this.container.style.top = `${e.clientY}px`;
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


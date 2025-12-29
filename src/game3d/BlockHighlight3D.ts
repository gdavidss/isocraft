/**
 * Block Highlight for Three.js
 * Shows outline around the specific face being pointed at
 */

import * as THREE from 'three';
import { BlockType } from '../world/types';

export type FaceDirection = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';

// Light-colored blocks that need black highlight for visibility
const LIGHT_BLOCKS: Set<BlockType> = new Set([
  BlockType.Sand,
  BlockType.RedSand,
  BlockType.Snow,
  BlockType.SnowBlock,
  BlockType.Ice,
  BlockType.PackedIce,
  BlockType.BlueIce,
  BlockType.BirchLog,
  BlockType.Clay,
  BlockType.Terracotta,
  BlockType.CherryLeaves,
]);

export class BlockHighlight3D {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private currentFace: FaceDirection = 'top';
  private visible = false;
  private currentColor: number = 0xffffff;

  // Face geometries - each face is a square outline
  private faceLines: Map<FaceDirection, THREE.Line> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    
    const s = 0.505; // Half size, slightly larger than block
    
    // Create line material (default white)
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
    });

    // Define vertices for each face outline (as line loops)
    const faceVertices: Record<FaceDirection, number[]> = {
      // Top face (Y+)
      top: [
        -s, s, -s,  s, s, -s,  // back edge
         s, s, -s,  s, s,  s,  // right edge
         s, s,  s, -s, s,  s,  // front edge
        -s, s,  s, -s, s, -s,  // left edge
      ],
      // Bottom face (Y-)
      bottom: [
        -s, -s, -s,  s, -s, -s,
         s, -s, -s,  s, -s,  s,
         s, -s,  s, -s, -s,  s,
        -s, -s,  s, -s, -s, -s,
      ],
      // Right face (X+)
      right: [
        s, -s, -s,  s,  s, -s,
        s,  s, -s,  s,  s,  s,
        s,  s,  s,  s, -s,  s,
        s, -s,  s,  s, -s, -s,
      ],
      // Left face (X-)
      left: [
        -s, -s, -s, -s,  s, -s,
        -s,  s, -s, -s,  s,  s,
        -s,  s,  s, -s, -s,  s,
        -s, -s,  s, -s, -s, -s,
      ],
      // Front face (Z+)
      front: [
        -s, -s, s,  s, -s, s,
         s, -s, s,  s,  s, s,
         s,  s, s, -s,  s, s,
        -s,  s, s, -s, -s, s,
      ],
      // Back face (Z-)
      back: [
        -s, -s, -s,  s, -s, -s,
         s, -s, -s,  s,  s, -s,
         s,  s, -s, -s,  s, -s,
        -s,  s, -s, -s, -s, -s,
      ],
    };

    // Create line for each face
    for (const [face, vertices] of Object.entries(faceVertices)) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      
      const line = new THREE.Line(geometry, material.clone());
      line.visible = false;
      line.renderOrder = 999;
      
      this.faceLines.set(face as FaceDirection, line);
      this.group.add(line);
    }

    this.group.visible = false;
    scene.add(this.group);
  }

  /**
   * Set highlight position and face
   */
  setPosition(x: number, y: number, z: number, face?: FaceDirection): void {
    this.group.position.set(x, y, z);
    
    if (face) {
      this.setFace(face);
    }
  }

  /**
   * Set which face to highlight
   */
  setFace(face: FaceDirection): void {
    this.currentFace = face;
    
    // Hide all faces, show only the selected one
    for (const [faceName, line] of this.faceLines) {
      line.visible = faceName === face;
    }
  }

  /**
   * Show/hide highlight
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.group.visible = visible;
    
    if (visible) {
      // Make sure the current face is visible
      this.setFace(this.currentFace);
    }
  }

  /**
   * Check if visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Get current position
   */
  getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  /**
   * Get current face
   */
  getFace(): FaceDirection {
    return this.currentFace;
  }

  /**
   * Set highlight color based on block type
   * Uses black for light blocks (sand, snow, ice) and white for dark blocks
   */
  setColorForBlock(blockType: BlockType | null): void {
    const newColor = (blockType !== null && LIGHT_BLOCKS.has(blockType)) ? 0x000000 : 0xffffff;
    
    // Only update if color changed
    if (newColor !== this.currentColor) {
      this.currentColor = newColor;
      for (const line of this.faceLines.values()) {
        if (line.material instanceof THREE.LineBasicMaterial) {
          line.material.color.setHex(newColor);
        }
      }
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.scene.remove(this.group);
    for (const line of this.faceLines.values()) {
      line.geometry.dispose();
      if (line.material instanceof THREE.Material) {
        line.material.dispose();
      }
    }
  }
}

/**
 * Determine face direction from hit normal
 */
export function getFaceFromNormal(normal: THREE.Vector3): FaceDirection {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);

  if (ay >= ax && ay >= az) {
    return normal.y > 0 ? 'top' : 'bottom';
  } else if (ax >= ay && ax >= az) {
    return normal.x > 0 ? 'right' : 'left';
  } else {
    return normal.z > 0 ? 'front' : 'back';
  }
}

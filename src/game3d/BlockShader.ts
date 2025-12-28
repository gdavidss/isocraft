/**
 * Minecraft-style Block Shader
 * Combines directional sunlight with Minecraft's face-based ambient shading.
 * 
 * The shader calculates:
 * 1. Directional light contribution from the sun
 * 2. Face-based ambient occlusion (Minecraft-style per-face brightness)
 * 3. Base ambient light
 */

import * as THREE from 'three';
import { registerMaterial } from './ShaderDebugUI';

// Default sun direction (normalized) - matches Game3D sun position
const DEFAULT_SUN_DIR = new THREE.Vector3(50, 100, 50).normalize();

// Minecraft-style face brightness values (these are the base, sun adds on top)
// Values above 1.0 to compensate for dark textures like bark
const FACE_BRIGHTNESS = {
  TOP: 1.0,      // +Y face - fully lit
  BOTTOM: 0.6,   // -Y face - darkest
  NORTH: 0.9,    // -Z face
  SOUTH: 0.9,    // +Z face  
  EAST: 0.8,     // +X face - increased for logs
  WEST: 0.8,     // -X face - increased for logs
};

// Optimized vertex shader - calculates brightness in vertex shader (cheaper)
const vertexShader = /* glsl */ `
  uniform float topBrightness;
  uniform float bottomBrightness;
  uniform float northSouthBrightness;
  uniform float eastWestBrightness;
  uniform vec3 sunDirection;
  uniform float sunBoost;
  uniform bool shaderEnabled;
  
  varying vec2 vUv;
  varying float vBrightness;
  
  void main() {
    vUv = uv;
    
    // If shader disabled, use flat brightness
    if (!shaderEnabled) {
      vBrightness = 1.0;
    } else {
      // === Face-based Brightness (branchless) ===
      vec3 absNormal = abs(normal);
      
      // Determine dominant axis using step functions (no branching)
      float isYDominant = step(absNormal.x, absNormal.y) * step(absNormal.z, absNormal.y);
      float isXDominant = (1.0 - isYDominant) * step(absNormal.z, absNormal.x);
      float isZDominant = 1.0 - isYDominant - isXDominant;
      
      // Select brightness based on dominant axis
      float isTop = step(0.0, normal.y);
      float yBrightness = mix(bottomBrightness, topBrightness, isTop);
      
      float brightness = isYDominant * yBrightness +
                         isXDominant * eastWestBrightness +
                         isZDominant * northSouthBrightness;
      
      // Sun boost
      float sunLight = max(dot(normal, sunDirection), 0.0) * sunBoost;
      brightness += sunLight;
      
      // Apply minimum brightness floor
      vBrightness = 0.15 + (brightness * 0.85);
    }
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Optimized instance-aware vertex shader
const instancedVertexShader = /* glsl */ `
  uniform float topBrightness;
  uniform float bottomBrightness;
  uniform float northSouthBrightness;
  uniform float eastWestBrightness;
  uniform vec3 sunDirection;
  uniform float sunBoost;
  uniform bool shaderEnabled;
  
  varying vec2 vUv;
  varying float vBrightness;
  
  void main() {
    vUv = uv;
    
    if (!shaderEnabled) {
      vBrightness = 1.0;
    } else {
      // === Face-based Brightness (branchless) ===
      vec3 absNormal = abs(normal);
      
      float isYDominant = step(absNormal.x, absNormal.y) * step(absNormal.z, absNormal.y);
      float isXDominant = (1.0 - isYDominant) * step(absNormal.z, absNormal.x);
      float isZDominant = 1.0 - isYDominant - isXDominant;
      
      float isTop = step(0.0, normal.y);
      float yBrightness = mix(bottomBrightness, topBrightness, isTop);
      
      float brightness = isYDominant * yBrightness +
                         isXDominant * eastWestBrightness +
                         isZDominant * northSouthBrightness;
      
      float sunLight = max(dot(normal, sunDirection), 0.0) * sunBoost;
      brightness += sunLight;
      
      vBrightness = 0.15 + (brightness * 0.85);
    }
    
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Optimized fragment shader - minimal work, brightness pre-calculated
const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 color;
  uniform float opacity;
  
  varying vec2 vUv;
  varying float vBrightness;
  
  void main() {
    vec4 texColor = texture2D(map, vUv);
    
    // Apply tint and brightness
    gl_FragColor = vec4(texColor.rgb * color * vBrightness, texColor.a * opacity);
    
    // Alpha test for leaves
    if (gl_FragColor.a < 0.1) discard;
  }
`;

export interface BlockShaderOptions {
  map?: THREE.Texture | null;
  color?: THREE.Color;
  opacity?: number;
  transparent?: boolean;
  side?: THREE.Side;
  instanced?: boolean;
  // Lighting options
  sunDirection?: THREE.Vector3;
  sunBoost?: number; // Extra brightness for sun-facing surfaces (0-0.3)
}

/**
 * Create a Minecraft-style block material with face shading and subtle sun highlights
 */
export function createBlockMaterial(options: BlockShaderOptions = {}): THREE.ShaderMaterial {
  const {
    map = null,
    color = new THREE.Color(0xffffff),
    opacity = 1.0,
    transparent = false,
    side = THREE.FrontSide,
    instanced = false,
    sunDirection = DEFAULT_SUN_DIR,
    sunBoost = 0.5, // Strong sun highlight
  } = options;
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      color: { value: color },
      opacity: { value: opacity },
      // Shader toggle
      shaderEnabled: { value: true },
      // Lighting uniforms (used in vertex shader)
      sunDirection: { value: sunDirection.clone().normalize() },
      sunBoost: { value: sunBoost },
      // Face brightness values (used in vertex shader)
      topBrightness: { value: FACE_BRIGHTNESS.TOP },
      bottomBrightness: { value: FACE_BRIGHTNESS.BOTTOM },
      northSouthBrightness: { value: FACE_BRIGHTNESS.NORTH },
      eastWestBrightness: { value: FACE_BRIGHTNESS.EAST },
    },
    vertexShader: instanced ? instancedVertexShader : vertexShader,
    fragmentShader,
    transparent,
    side,
    depthWrite: !transparent,
  });
  
  // Register material for live debug updates
  registerMaterial(material);
  
  return material;
}

/**
 * Create a water material
 */
export function createWaterMaterial(
  map: THREE.Texture | null,
  color: THREE.Color
): THREE.ShaderMaterial {
  // Boost the color for more visible water
  const boostedColor = color.clone();
  boostedColor.multiplyScalar(1.8); // Make color much more intense
  
  return createBlockMaterial({
    map,
    color: boostedColor,
    opacity: 0.7, // More transparent so player shows through when swimming
    transparent: true,
    side: THREE.DoubleSide,
    instanced: true,
    sunBoost: 0.2, // Water reflects sun
  });
}

/**
 * Create a block material for instanced meshes
 */
export function createInstancedBlockMaterial(options: BlockShaderOptions = {}): THREE.ShaderMaterial {
  return createBlockMaterial({
    ...options,
    instanced: true,
  });
}

/**
 * Create a leaves material (transparent with face shading)
 */
export function createLeavesMaterial(
  map: THREE.Texture | null,
  color: THREE.Color
): THREE.ShaderMaterial {
  return createBlockMaterial({
    map,
    color,
    opacity: 1.0,
    transparent: true,
    side: THREE.DoubleSide,
    instanced: false,
    sunBoost: 0.1,
  });
}

/**
 * Create a leaves material for instanced meshes (terrain)
 */
export function createInstancedLeavesMaterial(
  map: THREE.Texture | null,
  color: THREE.Color
): THREE.ShaderMaterial {
  return createBlockMaterial({
    map,
    color,
    opacity: 1.0,
    transparent: true,
    side: THREE.DoubleSide,
    instanced: true,
    sunBoost: 0.1,
  });
}


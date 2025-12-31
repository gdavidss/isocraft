/**
 * Minecraft-style Block Shader
 * Combines directional sunlight with Minecraft's face-based ambient shading.
 * 
 * The shader calculates:
 * 1. Directional light contribution from the sun
 * 2. Face-based ambient occlusion (Minecraft-style per-face brightness)
 * 3. Base ambient light
 * 4. Height-based darkening (lower blocks are darker - simulates AO from blocks above)
 * 5. Isometric depth shading (blocks further from camera are darker)
 */

import * as THREE from 'three';
import { registerMaterial } from './ShaderDebugUI';

// Default sun direction (normalized) - user tuned
const DEFAULT_SUN_DIR = new THREE.Vector3(40, 75, 55).normalize();

// Face brightness values - more contrast for visible shading
const FACE_BRIGHTNESS = {
  TOP: 1.0,      // +Y face - fully lit
  BOTTOM: 0.4,   // -Y face - darkest
  NORTH: 0.7,    // -Z face - side in shadow
  SOUTH: 0.7,    // +Z face - side in shadow
  EAST: 0.75,    // +X face - slightly brighter side
  WEST: 0.75,    // -X face - slightly brighter side
};

// Vertex shader with depth shading and real shadow support
const vertexShader = /* glsl */ `
  uniform float topBrightness;
  uniform float bottomBrightness;
  uniform float northSouthBrightness;
  uniform float eastWestBrightness;
  uniform vec3 sunDirection;
  uniform float sunBoost;
  uniform bool shaderEnabled;
  uniform float heightDarkening;
  uniform float depthShading;
  uniform float baseHeight;
  
  varying vec2 vUv;
  varying float vBrightness;
  
  // Shadow map support
  #include <common>
  #include <shadowmap_pars_vertex>
  
  void main() {
    vUv = uv;
    
    // Get world position for depth calculations
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    
    // Transform normal to world space (required for shadow bias)
    vec3 objectNormal = normal;
    vec3 transformedNormal = normalMatrix * objectNormal;
    
    // If shader disabled, use flat brightness
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
      
      // Face brightness - uniform for isometric view (no directional divide)
      float xBrightness = eastWestBrightness;
      float zBrightness = northSouthBrightness;
      
      float brightness = isYDominant * yBrightness +
                         isXDominant * xBrightness +
                         isZDominant * zBrightness;
      
      float sunLight = max(dot(normal, sunDirection), 0.0) * sunBoost;
      brightness += sunLight;
      
      // Height-based darkening
      float heightDiff = worldPosition.y - baseHeight;
      float heightFactor = clamp(heightDiff / 10.0, -1.0, 1.0);
      brightness *= 1.0 + (heightFactor * heightDarkening * 0.5);
      
      // Isometric depth shading
      float isoDepth = (worldPosition.x + worldPosition.z) / 30.0;
      float depthFactor = clamp(isoDepth, -1.0, 1.0);
      brightness *= 0.85 + (depthFactor * depthShading * 0.35);
      
      vBrightness = max(0.15, brightness);
    }
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    
    // Calculate shadow coordinates
    #include <shadowmap_vertex>
  }
`;

// Instance-aware vertex shader with depth shading and shadow support
const instancedVertexShader = /* glsl */ `
  uniform float topBrightness;
  uniform float bottomBrightness;
  uniform float northSouthBrightness;
  uniform float eastWestBrightness;
  uniform vec3 sunDirection;
  uniform float sunBoost;
  uniform bool shaderEnabled;
  uniform float heightDarkening;
  uniform float depthShading;
  uniform float baseHeight;
  
  varying vec2 vUv;
  varying float vBrightness;
  
  // Shadow map support
  #include <common>
  #include <shadowmap_pars_vertex>
  
  void main() {
    vUv = uv;
    
    // Get world position (account for instancing)
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    
    // Transform normal to world space (required for shadow bias)
    vec3 objectNormal = normal;
    vec3 transformedNormal = normalMatrix * objectNormal;
    
    if (!shaderEnabled) {
      vBrightness = 1.0;
    } else {
      vec3 absNormal = abs(normal);
      
      float isYDominant = step(absNormal.x, absNormal.y) * step(absNormal.z, absNormal.y);
      float isXDominant = (1.0 - isYDominant) * step(absNormal.z, absNormal.x);
      float isZDominant = 1.0 - isYDominant - isXDominant;
      
      float isTop = step(0.0, normal.y);
      float yBrightness = mix(bottomBrightness, topBrightness, isTop);
      
      // Face brightness - uniform for isometric view (no directional divide)
      float xBrightness = eastWestBrightness;
      float zBrightness = northSouthBrightness;

      float brightness = isYDominant * yBrightness +
                         isXDominant * xBrightness +
                         isZDominant * zBrightness;
      
      float sunLight = max(dot(normal, sunDirection), 0.0) * sunBoost;
      brightness += sunLight;
      
      float heightDiff = worldPosition.y - baseHeight;
      float heightFactor = clamp(heightDiff / 10.0, -1.0, 1.0);
      brightness *= 1.0 + (heightFactor * heightDarkening * 0.5);
      
      float isoDepth = (worldPosition.x + worldPosition.z) / 30.0;
      float depthFactor = clamp(isoDepth, -1.0, 1.0);
      brightness *= 0.85 + (depthFactor * depthShading * 0.35);
      
      vBrightness = max(0.15, brightness);
    }
    
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Calculate shadow coordinates
    #include <shadowmap_vertex>
  }
`;

// Fragment shader with shadow support
const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 color;
  uniform float opacity;
  
  varying vec2 vUv;
  varying float vBrightness;
  
  // Shadow map support
  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  
  void main() {
    vec4 texColor = texture2D(map, vUv);
    
    // Calculate shadow (1.0 = fully lit, 0.0 = fully shadowed)
    float shadow = 1.0;
    
    #if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
      DirectionalLightShadow directionalLight = directionalLightShadows[0];
      shadow = getShadow(
        directionalShadowMap[0],
        directionalLight.shadowMapSize,
        directionalLight.shadowIntensity,
        directionalLight.shadowBias,
        directionalLight.shadowRadius,
        vDirectionalShadowCoord[0]
      );
      // Don't make shadows completely black - ambient light still reaches them
      shadow = 0.5 + shadow * 0.5;
    #endif
    
    // Apply tint, brightness, and shadow
    gl_FragColor = vec4(texColor.rgb * color * vBrightness * shadow, texColor.a * opacity);
    
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
  // Depth shading options
  heightDarkening?: number; // How much to darken lower blocks (0-1)
  depthShading?: number;    // How much to darken distant blocks in isometric view (0-1)
  baseHeight?: number;      // Reference height for height-based shading (default: 64)
}

/**
 * Create a Minecraft-style block material with face shading and subtle sun highlights
 * Includes depth-based shading for better depth perception in isometric view
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
    heightDarkening = 0.0,  // Disabled - was causing brightness divide
    depthShading = 0.0,     // Disabled - was causing brightness divide
    baseHeight = 64,        // Sea level as reference
  } = options;
  
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights, // Required for shadow mapping
      {
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
        // Depth shading uniforms
        heightDarkening: { value: heightDarkening },
        depthShading: { value: depthShading },
        baseHeight: { value: baseHeight },
      }
    ]),
    vertexShader: instanced ? instancedVertexShader : vertexShader,
    fragmentShader,
    transparent,
    side,
    depthWrite: !transparent,
    lights: true, // Enable light/shadow uniforms
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


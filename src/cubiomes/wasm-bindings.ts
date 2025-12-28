/**
 * WebAssembly bindings for cubiomes
 * Provides a TypeScript interface to the compiled C library
 */

// Type definitions for the Emscripten module
interface CubiomesModule {
  _init_generator(mc_version: number, flags: number): void;
  _apply_seed(seed_hi: number, seed_lo: number, dim: number): void;
  _get_biome_at(scale: number, x: number, y: number, z: number): number;
  _gen_biomes_2d(buffer: number, scale: number, x: number, z: number, sx: number, sz: number, y: number): number;
  _alloc_biome_buffer(sx: number, sz: number): number;
  _free_buffer(buffer: number): void;
  _get_mc_version(major: number, minor: number): number;
  _is_ocean(biome_id: number): number;
  _is_snowy_biome(biome_id: number): number;
  _get_biome_color(biome_id: number): number;
  _get_biome_base_height(biome_id: number): number;
  _biome_has_trees(biome_id: number): number;
  _get_biome_grass_color(biome_id: number): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  
  ccall: (name: string, returnType: string | null, argTypes: string[], args: unknown[]) => unknown;
  cwrap: (name: string, returnType: string | null, argTypes: string[]) => (...args: unknown[]) => unknown;
  getValue: (ptr: number, type: string) => number;
  setValue: (ptr: number, value: number, type: string) => void;
  HEAP32: Int32Array;
}

// Global module instance
let module: CubiomesModule | null = null;
let moduleLoading: Promise<CubiomesModule> | null = null;

/**
 * Load the cubiomes WASM module
 */
export async function loadCubiomesModule(): Promise<CubiomesModule> {
  if (module) return module;
  
  if (moduleLoading) return moduleLoading;
  
  moduleLoading = (async () => {
    // Load the WASM module using script injection (Vite-compatible)
    // The cubiomes.js file creates a global CubiomesModule factory
    await new Promise<void>((resolve, reject) => {
      // Check if already loaded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).CubiomesModule) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = '/cubiomes.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load cubiomes.js'));
      document.head.appendChild(script);
    });
    
    // Get the factory function and create the module
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CubiomesModuleFactory = (window as any).CubiomesModule as () => Promise<CubiomesModule>;
    if (!CubiomesModuleFactory) {
      throw new Error('CubiomesModule not found in window');
    }
    
    module = await CubiomesModuleFactory();
    console.log('✅ Cubiomes WASM module loaded');
    return module;
  })();
  
  return moduleLoading;
}

/**
 * Check if module is loaded
 */
export function isModuleLoaded(): boolean {
  return module !== null;
}

/**
 * Minecraft version constants
 */
export const MCVersion = {
  MC_1_12: 12,
  MC_1_13: 13,
  MC_1_14: 14,
  MC_1_15: 15,
  MC_1_16: 16,
  MC_1_17: 17,
  MC_1_18: 18,
  MC_1_19: 19,
  MC_1_20: 20,
  MC_1_21: 21,
} as const;

/**
 * Dimension constants
 */
export const Dimension = {
  NETHER: -1,
  OVERWORLD: 0,
  END: 1,
} as const;

/**
 * WASM-based biome generator
 */
export class WasmGenerator {
  private initialized = false;
  private seed: bigint;
  
  constructor(seed?: number | bigint) {
    this.seed = BigInt(seed ?? Math.floor(Math.random() * 2147483647));
  }
  
  /**
   * Initialize the generator (must be called after module is loaded)
   */
  async init(mcVersion: number = MCVersion.MC_1_20): Promise<void> {
    if (!module) {
      await loadCubiomesModule();
    }
    
    if (!module) throw new Error('Failed to load cubiomes module');
    
    // Initialize generator for the specified Minecraft version
    module._init_generator(mcVersion, 0);
    
    // Apply seed
    const seedHi = Number((this.seed >> BigInt(32)) & BigInt(0xFFFFFFFF));
    const seedLo = Number(this.seed & BigInt(0xFFFFFFFF));
    module._apply_seed(seedHi, seedLo, Dimension.OVERWORLD);
    
    this.initialized = true;
    console.log(`🌍 Generator initialized with seed: ${this.seed.toString(16)}`);
  }
  
  /**
   * Get biome at a specific position
   */
  getBiomeAt(scale: number, x: number, y: number, z: number): number {
    if (!this.initialized || !module) {
      throw new Error('Generator not initialized');
    }
    return module._get_biome_at(scale, x, y, z);
  }
  
  /**
   * Generate biomes for a 2D area
   */
  genBiomes2D(
    scale: number,
    x: number,
    z: number,
    sx: number,
    sz: number,
    y: number = 63
  ): Int32Array {
    if (!this.initialized || !module) {
      throw new Error('Generator not initialized');
    }
    
    // Allocate buffer
    const bufferPtr = module._alloc_biome_buffer(sx, sz);
    
    // Generate biomes
    const result = module._gen_biomes_2d(bufferPtr, scale, x, z, sx, sz, y);
    
    if (result !== 0) {
      module._free_buffer(bufferPtr);
      throw new Error(`Biome generation failed with code ${result}`);
    }
    
    // Copy results
    const biomes = new Int32Array(sx * sz);
    for (let i = 0; i < sx * sz; i++) {
      biomes[i] = module.getValue(bufferPtr + i * 4, 'i32');
    }
    
    // Free buffer
    module._free_buffer(bufferPtr);
    
    return biomes;
  }
  
  /**
   * Check if biome is oceanic
   */
  isOcean(biomeId: number): boolean {
    if (!module) return false;
    return module._is_ocean(biomeId) !== 0;
  }
  
  /**
   * Check if biome is snowy
   */
  isSnowy(biomeId: number): boolean {
    if (!module) return false;
    return module._is_snowy_biome(biomeId) !== 0;
  }
  
  /**
   * Get biome color as RGB array
   */
  getBiomeColor(biomeId: number): [number, number, number] {
    if (!module) return [128, 128, 128];
    const color = module._get_biome_color(biomeId);
    return [
      (color >> 16) & 0xFF,
      (color >> 8) & 0xFF,
      color & 0xFF,
    ];
  }
  
  /**
   * Get base terrain height for biome
   */
  getBiomeBaseHeight(biomeId: number): number {
    if (!module) return 64;
    return module._get_biome_base_height(biomeId);
  }
  
  /**
   * Check if biome has trees
   */
  biomeHasTrees(biomeId: number): 0 | 1 | 2 {
    if (!module) return 0;
    return module._biome_has_trees(biomeId) as 0 | 1 | 2;
  }
  
  /**
   * Get biome grass color
   */
  getBiomeGrassColor(biomeId: number): [number, number, number] {
    if (!module) return [141, 179, 96];
    const color = module._get_biome_grass_color(biomeId);
    return [
      (color >> 16) & 0xFF,
      (color >> 8) & 0xFF,
      color & 0xFF,
    ];
  }
  
  getSeed(): bigint {
    return this.seed;
  }
  
  getSeedNumber(): number {
    return Number(this.seed & BigInt(0x7FFFFFFF));
  }

  /**
   * Get biome name from biome ID
   */
  getBiomeName(biomeId: number): string {
    // Biome name mapping based on Minecraft 1.20 biome IDs
    const biomeNames: Record<number, string> = {
      0: 'Ocean',
      1: 'Plains',
      2: 'Desert',
      3: 'Windswept Hills',
      4: 'Forest',
      5: 'Taiga',
      6: 'Swamp',
      7: 'River',
      8: 'Nether Wastes',
      9: 'The End',
      10: 'Frozen Ocean',
      11: 'Frozen River',
      12: 'Snowy Plains',
      13: 'Snowy Mountains',
      14: 'Mushroom Fields',
      15: 'Mushroom Field Shore',
      16: 'Beach',
      17: 'Desert Hills',
      18: 'Wooded Hills',
      19: 'Taiga Hills',
      20: 'Mountain Edge',
      21: 'Jungle',
      22: 'Jungle Hills',
      23: 'Sparse Jungle',
      24: 'Deep Ocean',
      25: 'Stony Shore',
      26: 'Snowy Beach',
      27: 'Birch Forest',
      28: 'Birch Forest Hills',
      29: 'Dark Forest',
      30: 'Snowy Taiga',
      31: 'Snowy Taiga Hills',
      32: 'Old Growth Pine Taiga',
      33: 'Old Growth Pine Taiga Hills',
      34: 'Windswept Forest',
      35: 'Savanna',
      36: 'Savanna Plateau',
      37: 'Badlands',
      38: 'Wooded Badlands',
      39: 'Badlands Plateau',
      40: 'Small End Islands',
      41: 'End Midlands',
      42: 'End Highlands',
      43: 'End Barrens',
      44: 'Warm Ocean',
      45: 'Lukewarm Ocean',
      46: 'Cold Ocean',
      47: 'Deep Warm Ocean',
      48: 'Deep Lukewarm Ocean',
      49: 'Deep Cold Ocean',
      50: 'Deep Frozen Ocean',
      // Modern biomes (1.18+)
      127: 'The Void',
      129: 'Sunflower Plains',
      130: 'Desert Lakes',
      131: 'Windswept Gravelly Hills',
      132: 'Flower Forest',
      133: 'Taiga Mountains',
      134: 'Swamp Hills',
      140: 'Ice Spikes',
      149: 'Jungle Edge Mutated',
      151: 'Modified Jungle Edge',
      155: 'Old Growth Birch Forest',
      156: 'Birch Forest Mountains',
      157: 'Dark Forest Hills',
      158: 'Snowy Taiga Mountains',
      160: 'Old Growth Spruce Taiga',
      161: 'Giant Spruce Taiga Hills',
      162: 'Modified Gravelly Mountains',
      163: 'Windswept Savanna',
      164: 'Shattered Savanna Plateau',
      165: 'Eroded Badlands',
      166: 'Modified Wooded Badlands Plateau',
      167: 'Modified Badlands Plateau',
      168: 'Bamboo Jungle',
      169: 'Bamboo Jungle Hills',
      170: 'Soul Sand Valley',
      171: 'Crimson Forest',
      172: 'Warped Forest',
      173: 'Basalt Deltas',
      174: 'Dripstone Caves',
      175: 'Lush Caves',
      177: 'Meadow',
      178: 'Grove',
      179: 'Snowy Slopes',
      180: 'Frozen Peaks',
      181: 'Jagged Peaks',
      182: 'Stony Peaks',
      183: 'Cherry Grove',
      184: 'Deep Dark',
      185: 'Mangrove Swamp',
    };

    return biomeNames[biomeId] || `Unknown (${biomeId})`;
  }
}

/**
 * Create and initialize a WASM generator
 */
export async function createWasmGenerator(seed?: number | bigint): Promise<WasmGenerator> {
  const generator = new WasmGenerator(seed);
  await generator.init();
  return generator;
}


/**
 * Biome Generator - TypeScript port of cubiomes generator
 * Implements Minecraft 1.18+ multi-noise biome generation
 */

import { BiomeID } from './biomes';
import { SeededRandom, OctavePerlinNoise, SimplexNoise, cubicSpline } from './noise';

/**
 * Climate parameters used for biome selection
 */
interface ClimatePoint {
  temperature: number;      // -1 to 1 (cold to hot)
  humidity: number;         // -1 to 1 (dry to wet)
  continentalness: number;  // -1 to 1 (ocean to inland)
  erosion: number;          // -1 to 1 (flat to eroded)
  weirdness: number;        // -1 to 1 (normal to weird)
  depth: number;            // For 3D biomes
}

/**
 * Biome noise parameters for 1.18+
 */
export class BiomeNoise {
  private temperatureNoise: OctavePerlinNoise;
  private humidityNoise: OctavePerlinNoise;
  private continentalnessNoise: OctavePerlinNoise;
  private erosionNoise: OctavePerlinNoise;
  private weirdnessNoise: OctavePerlinNoise;
  private shiftNoise: SimplexNoise;

  constructor(seed: number) {
    // Create separate random instances for each noise
    // Using different seed offsets to create independent noise patterns
    const tempRng = new SeededRandom(seed);
    const humidRng = new SeededRandom(seed + 1);
    const contRng = new SeededRandom(seed + 2);
    const erosionRng = new SeededRandom(seed + 3);
    const weirdRng = new SeededRandom(seed + 4);
    const shiftRng = new SeededRandom(seed + 5);

    // Initialize noise samplers with Minecraft-like octave counts
    this.temperatureNoise = new OctavePerlinNoise(tempRng, 4, 2.0, 0.5);
    this.humidityNoise = new OctavePerlinNoise(humidRng, 4, 2.0, 0.5);
    this.continentalnessNoise = new OctavePerlinNoise(contRng, 6, 2.0, 0.5);
    this.erosionNoise = new OctavePerlinNoise(erosionRng, 4, 2.0, 0.5);
    this.weirdnessNoise = new OctavePerlinNoise(weirdRng, 4, 2.0, 0.5);
    this.shiftNoise = new SimplexNoise(shiftRng);
  }

  /**
   * Sample climate at a position (in biome coordinates, scale=4)
   */
  sampleClimate(x: number, z: number, y = 0): ClimatePoint {
    // Apply coordinate shift for more interesting terrain
    const shiftScale = 0.0025;
    const shiftX = this.shiftNoise.sample2D(x * shiftScale, z * shiftScale) * 4;
    const shiftZ = this.shiftNoise.sample2D(x * shiftScale + 100, z * shiftScale + 100) * 4;
    
    const sx = x + shiftX;
    const sz = z + shiftZ;

    // Sample each climate parameter
    // Scale factors match Minecraft's noise sampling
    const temperature = this.temperatureNoise.sample2D(sx * 0.0025, sz * 0.0025);
    const humidity = this.humidityNoise.sample2D(sx * 0.0025, sz * 0.0025);
    const continentalness = this.continentalnessNoise.sample2D(sx * 0.00065, sz * 0.00065);
    const erosion = this.erosionNoise.sample2D(sx * 0.00125, sz * 0.00125);
    const weirdness = this.weirdnessNoise.sample2D(sx * 0.0025, sz * 0.0025);

    return {
      temperature,
      humidity,
      continentalness,
      erosion,
      weirdness,
      depth: y * 0.01, // Simplified depth
    };
  }
}

/**
 * Main Generator class
 */
export class Generator {
  private seed: number;
  private biomeNoise: BiomeNoise;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);
    this.biomeNoise = new BiomeNoise(this.seed);
  }

  /**
   * Get the biome at a specific position
   * @param scale - 1 for block coordinates, 4 for biome coordinates
   * @param x, y, z - Position
   */
  getBiomeAt(scale: number, x: number, y: number, z: number): BiomeID {
    // Convert to biome coordinates if needed
    const bx = scale === 1 ? x >> 2 : x;
    const bz = scale === 1 ? z >> 2 : z;
    const by = scale === 1 ? y >> 2 : y;

    const climate = this.biomeNoise.sampleClimate(bx, bz, by);
    return this.selectBiome(climate);
  }

  /**
   * Generate biomes for a 2D area
   * Results are stored in the provided buffer
   */
  genBiomes2D(
    buffer: Int32Array | number[],
    scale: number,
    x: number,
    z: number,
    sx: number,
    sz: number,
    y = 63
  ): void {
    const by = scale === 1 ? y >> 2 : y >> 2;

    for (let dz = 0; dz < sz; dz++) {
      for (let dx = 0; dx < sx; dx++) {
        const bx = scale === 1 ? (x + dx) >> 2 : x + dx;
        const bz = scale === 1 ? (z + dz) >> 2 : z + dz;
        
        const climate = this.biomeNoise.sampleClimate(bx, bz, by);
        buffer[dz * sx + dx] = this.selectBiome(climate);
      }
    }
  }

  /**
   * Get terrain height at a position
   * Uses continentalness, erosion, and weirdness to determine height
   */
  getTerrainHeight(x: number, z: number): number {
    const climate = this.biomeNoise.sampleClimate(x >> 2, z >> 2);
    
    // Base height from continentalness
    // -1 = deep ocean, 0 = coast, 1 = inland
    const baseHeight = cubicSpline([
      [-1.0, 30],   // Deep ocean
      [-0.6, 40],   // Ocean
      [-0.2, 55],   // Shallow ocean
      [0.0, 62],    // Sea level
      [0.1, 65],    // Beach/coast
      [0.3, 68],    // Low land
      [0.5, 75],    // Mid land
      [0.7, 85],    // High land
      [1.0, 100],   // Mountains
    ], climate.continentalness);

    // Modify by erosion (0 = flat, 1 = mountainous)
    const erosionMod = cubicSpline([
      [-1.0, 0.6],  // Very eroded = flatter
      [-0.5, 0.8],
      [0.0, 1.0],
      [0.5, 1.2],
      [1.0, 1.5],   // Low erosion = more height variation
    ], climate.erosion);

    // Apply weirdness for terrain variation
    const weirdMod = climate.weirdness * 8;

    return Math.max(0, Math.min(255, baseHeight * erosionMod + weirdMod));
  }

  /**
   * Select biome based on climate parameters
   * This is a simplified version of Minecraft's multi-noise biome selection
   */
  private selectBiome(climate: ClimatePoint): BiomeID {
    const { temperature, humidity, continentalness, erosion, weirdness } = climate;

    // Ocean biomes (continentalness < -0.1)
    if (continentalness < -0.1) {
      return this.selectOceanBiome(temperature, continentalness);
    }

    // Beach/Shore (continentalness near 0)
    if (continentalness < 0.1) {
      return this.selectShoreBiome(temperature, humidity, continentalness);
    }

    // River check (using weirdness as river indicator)
    if (Math.abs(weirdness) < 0.05 && erosion > 0.3 && continentalness > 0.1) {
      return temperature < -0.3 ? BiomeID.frozen_river : BiomeID.river;
    }

    // Mountain biomes (high continentalness + low erosion)
    if (continentalness > 0.6 && erosion < -0.2) {
      return this.selectMountainBiome(temperature, humidity, erosion, weirdness);
    }

    // Regular land biomes
    return this.selectLandBiome(temperature, humidity, continentalness, erosion, weirdness);
  }

  /**
   * Select ocean biome based on temperature and depth
   */
  private selectOceanBiome(temperature: number, continentalness: number): BiomeID {
    const deep = continentalness < -0.5;

    if (temperature < -0.5) {
      return deep ? BiomeID.deep_frozen_ocean : BiomeID.frozen_ocean;
    }
    if (temperature < -0.15) {
      return deep ? BiomeID.deep_cold_ocean : BiomeID.cold_ocean;
    }
    if (temperature < 0.2) {
      return deep ? BiomeID.deep_ocean : BiomeID.ocean;
    }
    if (temperature < 0.5) {
      return deep ? BiomeID.deep_lukewarm_ocean : BiomeID.lukewarm_ocean;
    }
    return deep ? BiomeID.deep_warm_ocean : BiomeID.warm_ocean;
  }

  /**
   * Select shore/beach biome
   */
  private selectShoreBiome(
    temperature: number,
    humidity: number,
    continentalness: number
  ): BiomeID {
    // Very close to water = beach variants
    if (continentalness < 0.03) {
      if (temperature < -0.3) {
        return BiomeID.snowy_beach;
      }
      if (humidity < -0.3 || Math.abs(temperature) > 0.4) {
        return BiomeID.stony_shore;
      }
      return BiomeID.beach;
    }

    // Slightly inland = swamp potential
    if (humidity > 0.3 && temperature > 0) {
      return temperature > 0.5 ? BiomeID.mangrove_swamp : BiomeID.swamp;
    }

    // Default to plains near shore
    return BiomeID.plains;
  }

  /**
   * Select mountain biome
   */
  private selectMountainBiome(
    temperature: number,
    humidity: number,
    erosion: number,
    weirdness: number
  ): BiomeID {
    const peakType = weirdness > 0.5 ? 'jagged' : weirdness < -0.3 ? 'stony' : 'frozen';

    // Very cold = snowy mountains
    if (temperature < -0.4) {
      if (erosion < -0.5) {
        return peakType === 'jagged' ? BiomeID.jagged_peaks : BiomeID.frozen_peaks;
      }
      if (humidity > 0) {
        return BiomeID.grove;
      }
      return BiomeID.snowy_slopes;
    }

    // Cold = regular peaks
    if (temperature < 0) {
      if (erosion < -0.5) {
        return peakType === 'jagged' ? BiomeID.jagged_peaks : BiomeID.stony_peaks;
      }
      return BiomeID.windswept_forest;
    }

    // Warm mountains
    if (erosion < -0.5) {
      return BiomeID.stony_peaks;
    }
    return humidity > 0.3 ? BiomeID.windswept_forest : BiomeID.windswept_hills;
  }

  /**
   * Select land biome based on climate
   */
  private selectLandBiome(
    temperature: number,
    humidity: number,
    continentalness: number,
    _erosion: number, // Reserved for more detailed terrain generation
    weirdness: number
  ): BiomeID {
    // Frozen biomes
    if (temperature < -0.45) {
      if (humidity > 0.3) {
        return BiomeID.snowy_taiga;
      }
      if (weirdness > 0.7) {
        return BiomeID.ice_spikes;
      }
      return BiomeID.snowy_plains;
    }

    // Cold biomes
    if (temperature < -0.15) {
      if (humidity > 0.4) {
        return BiomeID.old_growth_spruce_taiga;
      }
      if (humidity > 0.1) {
        return BiomeID.taiga;
      }
      return BiomeID.snowy_plains;
    }

    // Temperate biomes
    if (temperature < 0.2) {
      if (humidity > 0.5) {
        if (weirdness > 0.4) {
          return BiomeID.dark_forest;
        }
        return BiomeID.old_growth_birch_forest;
      }
      if (humidity > 0.2) {
        if (weirdness > 0.3) {
          return BiomeID.flower_forest;
        }
        return BiomeID.forest;
      }
      if (humidity > -0.2) {
        if (weirdness > 0.5) {
          return BiomeID.meadow;
        }
        return BiomeID.plains;
      }
      // Dry temperate
      if (continentalness > 0.5) {
        return BiomeID.sunflower_plains;
      }
      return BiomeID.plains;
    }

    // Warm biomes
    if (temperature < 0.55) {
      if (humidity > 0.5) {
        if (weirdness > 0.3) {
          return BiomeID.bamboo_jungle;
        }
        return BiomeID.jungle;
      }
      if (humidity > 0.2) {
        return BiomeID.sparse_jungle;
      }
      if (humidity > -0.3) {
        if (weirdness > 0.5) {
          return BiomeID.cherry_grove;
        }
        return BiomeID.forest;
      }
      // Dry warm
      return BiomeID.savanna;
    }

    // Hot biomes
    if (humidity > 0.3) {
      return BiomeID.jungle;
    }
    if (humidity > -0.1) {
      if (weirdness > 0.3) {
        return BiomeID.windswept_savanna;
      }
      return BiomeID.savanna_plateau;
    }

    // Hot and dry = badlands/desert
    if (humidity < -0.4) {
      return BiomeID.desert;
    }
    if (weirdness > 0.5) {
      return BiomeID.eroded_badlands;
    }
    if (weirdness > 0) {
      return BiomeID.wooded_badlands;
    }
    return BiomeID.badlands;
  }

  getSeed(): number {
    return this.seed;
  }
}

/**
 * Create and configure a generator for the specified Minecraft version
 */
export function createGenerator(seed?: number): Generator {
  return new Generator(seed);
}


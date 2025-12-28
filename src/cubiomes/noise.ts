/**
 * Noise functions for biome generation
 * TypeScript port of cubiomes noise.c
 * 
 * Uses a seeded PRNG and Perlin/Simplex noise implementation
 * that matches Minecraft's behavior
 */

// Permutation table for Perlin noise (will be shuffled with seed)
const PERM_SIZE = 512;

/**
 * Seeded random number generator (xoshiro128++)
 * Matches Java's random behavior used in Minecraft
 */
export class SeededRandom {
  private state: [number, number, number, number];

  constructor(seed: number) {
    // Initialize state from seed using splitmix64-like algorithm
    let s = BigInt(seed) ^ BigInt('0x9E3779B97F4A7C15');
    
    const next = () => {
      s = BigInt.asUintN(64, s + BigInt('0x9E3779B97F4A7C15'));
      let z = s;
      z = BigInt.asUintN(64, (z ^ (z >> BigInt(30))) * BigInt('0xBF58476D1CE4E5B9'));
      z = BigInt.asUintN(64, (z ^ (z >> BigInt(27))) * BigInt('0x94D049BB133111EB'));
      return Number(BigInt.asUintN(32, z ^ (z >> BigInt(31))));
    };

    this.state = [next(), next(), next(), next()];
  }

  /**
   * Get next random 32-bit integer
   */
  nextInt(): number {
    const result = (this.state[0] + this.state[3]) >>> 0;
    const t = (this.state[1] << 9) >>> 0;

    this.state[2] ^= this.state[0];
    this.state[3] ^= this.state[1];
    this.state[1] ^= this.state[2];
    this.state[0] ^= this.state[3];

    this.state[2] ^= t;
    this.state[3] = ((this.state[3] << 11) | (this.state[3] >>> 21)) >>> 0;

    return result;
  }

  /**
   * Get random float in [0, 1)
   */
  nextFloat(): number {
    return (this.nextInt() >>> 0) / 0x100000000;
  }

  /**
   * Get random float in [-1, 1)
   */
  nextDouble(): number {
    return this.nextFloat() * 2 - 1;
  }

  /**
   * Get random int in [0, bound)
   */
  nextBounded(bound: number): number {
    return Math.floor(this.nextFloat() * bound);
  }
}

/**
 * Perlin noise implementation matching Minecraft's
 */
export class PerlinNoise {
  private perm: Uint8Array;
  public readonly originX: number;
  public readonly originY: number;
  public readonly originZ: number;

  constructor(random: SeededRandom) {
    this.perm = new Uint8Array(PERM_SIZE);
    
    // Initialize permutation table
    for (let i = 0; i < 256; i++) {
      this.perm[i] = i;
    }

    // Shuffle
    for (let i = 0; i < 256; i++) {
      const j = random.nextBounded(256 - i) + i;
      const tmp = this.perm[i];
      this.perm[i] = this.perm[j];
      this.perm[j] = tmp;
    }

    // Duplicate for wrapping
    for (let i = 0; i < 256; i++) {
      this.perm[i + 256] = this.perm[i];
    }

    // Random origin offset
    this.originX = random.nextDouble() * 256;
    this.originY = random.nextDouble() * 256;
    this.originZ = random.nextDouble() * 256;
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /**
   * Sample 3D Perlin noise
   */
  sample(x: number, y: number, z: number): number {
    const px = x + this.originX;
    const py = y + this.originY;
    const pz = z + this.originZ;

    const xi = Math.floor(px) & 255;
    const yi = Math.floor(py) & 255;
    const zi = Math.floor(pz) & 255;

    const xf = px - Math.floor(px);
    const yf = py - Math.floor(py);
    const zf = pz - Math.floor(pz);

    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const p = this.perm;
    const a = p[xi] + yi;
    const aa = p[a] + zi;
    const ab = p[a + 1] + zi;
    const b = p[xi + 1] + yi;
    const ba = p[b] + zi;
    const bb = p[b + 1] + zi;

    return this.lerp(
      w,
      this.lerp(
        v,
        this.lerp(
          u,
          this.grad(p[aa], xf, yf, zf),
          this.grad(p[ba], xf - 1, yf, zf)
        ),
        this.lerp(
          u,
          this.grad(p[ab], xf, yf - 1, zf),
          this.grad(p[bb], xf - 1, yf - 1, zf)
        )
      ),
      this.lerp(
        v,
        this.lerp(
          u,
          this.grad(p[aa + 1], xf, yf, zf - 1),
          this.grad(p[ba + 1], xf - 1, yf, zf - 1)
        ),
        this.lerp(
          u,
          this.grad(p[ab + 1], xf, yf - 1, zf - 1),
          this.grad(p[bb + 1], xf - 1, yf - 1, zf - 1)
        )
      )
    );
  }

  /**
   * Sample 2D Perlin noise (y = 0)
   */
  sample2D(x: number, z: number): number {
    return this.sample(x, 0, z);
  }
}

/**
 * Octaved Perlin noise (fractal Brownian motion)
 */
export class OctavePerlinNoise {
  private octaves: PerlinNoise[];
  private lacunarity: number;
  private persistence: number;

  constructor(
    random: SeededRandom,
    octaveCount: number,
    lacunarity = 2.0,
    persistence = 0.5
  ) {
    this.octaves = [];
    this.lacunarity = lacunarity;
    this.persistence = persistence;

    for (let i = 0; i < octaveCount; i++) {
      this.octaves.push(new PerlinNoise(random));
    }
  }

  sample(x: number, y: number, z: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (const octave of this.octaves) {
      value += amplitude * octave.sample(
        x * frequency,
        y * frequency,
        z * frequency
      );
      maxValue += amplitude;
      amplitude *= this.persistence;
      frequency *= this.lacunarity;
    }

    return value / maxValue;
  }

  sample2D(x: number, z: number): number {
    return this.sample(x, 0, z);
  }
}

/**
 * Double Perlin noise used in Minecraft 1.18+
 * Creates more complex, multi-scale noise patterns
 */
export class DoublePerlinNoise {
  private firstOctaves: OctavePerlinNoise;
  private secondOctaves: OctavePerlinNoise;
  private amplitude: number;

  constructor(random: SeededRandom, firstOctave: number, amplitudes: number[]) {
    const octaveCount = amplitudes.length;
    
    // Skip random values to match Minecraft's behavior
    for (let i = 0; i < -firstOctave; i++) {
      random.nextInt();
    }

    this.firstOctaves = new OctavePerlinNoise(random, octaveCount);
    this.secondOctaves = new OctavePerlinNoise(random, octaveCount);

    // Calculate amplitude
    let amp = 0;
    for (let i = 0; i < octaveCount; i++) {
      amp += amplitudes[i] / (1 << i);
    }
    this.amplitude = amp;
  }

  sample(x: number, y: number, z: number): number {
    const scale = 337.0 / 331.0;
    const first = this.firstOctaves.sample(x, y, z);
    const second = this.secondOctaves.sample(x * scale, y * scale, z * scale);
    return (first + second) * this.amplitude;
  }

  sample2D(x: number, z: number): number {
    return this.sample(x, 0, z);
  }
}

/**
 * Simplex noise - alternative implementation
 * Used for some biome parameters
 */
export class SimplexNoise {
  private perm: Uint8Array;
  private permMod12: Uint8Array;

  // Gradients for 3D simplex
  private static readonly GRAD3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];

  private static readonly F2 = 0.5 * (Math.sqrt(3) - 1);
  private static readonly G2 = (3 - Math.sqrt(3)) / 6;
  // F3 and G3 reserved for 3D simplex noise
  // private static readonly F3 = 1 / 3;
  // private static readonly G3 = 1 / 6;

  constructor(random: SeededRandom) {
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);

    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle
    for (let i = 255; i > 0; i--) {
      const j = random.nextBounded(i + 1);
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  private dot2(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }

  /**
   * 2D Simplex noise
   */
  sample2D(xin: number, yin: number): number {
    const { F2, G2, GRAD3 } = SimplexNoise;

    // Skew input space
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);

    // Unskew back
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    // Determine simplex
    let i1: number, j1: number;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    // Hash coordinates
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

    // Calculate contribution from corners
    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.dot2(GRAD3[gi0], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.dot2(GRAD3[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.dot2(GRAD3[gi2], x2, y2);
    }

    // Scale to [-1, 1]
    return 70 * (n0 + n1 + n2);
  }
}

/**
 * Spline interpolation for terrain height
 */
export function cubicSpline(points: [number, number][], t: number): number {
  if (points.length < 2) return points[0]?.[1] ?? 0;
  
  // Find segment
  let i = 0;
  while (i < points.length - 1 && points[i + 1][0] < t) {
    i++;
  }
  
  if (i >= points.length - 1) {
    return points[points.length - 1][1];
  }
  if (i < 0 || t < points[0][0]) {
    return points[0][1];
  }
  
  const x0 = points[i][0];
  const x1 = points[i + 1][0];
  const y0 = points[i][1];
  const y1 = points[i + 1][1];
  
  const localT = (t - x0) / (x1 - x0);
  const smoothT = localT * localT * (3 - 2 * localT); // Smoothstep
  
  return y0 + (y1 - y0) * smoothT;
}


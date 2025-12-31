/**
 * Sound Manager - Minecraft-style sound system
 * 
 * Handles loading, caching, and playing all game sounds:
 * - Footsteps (based on block type)
 * - Block breaking (progressive hit sounds + final break)
 * - Block placing
 * - Item pickup
 * - Swimming/splash
 * - UI sounds
 * - Ambient sounds
 */

import { BlockType } from '../world/types';

// Sound categories for blocks
export enum SoundCategory {
  Grass = 'grass',
  Stone = 'stone',
  Wood = 'wood',
  Sand = 'sand',
  Gravel = 'gravel',
  Snow = 'snow',
  Cloth = 'cloth',
  Coral = 'coral',
  WetGrass = 'wet_grass',
}

// Sound types
export enum SoundType {
  Step = 'step',
  Dig = 'dig',
  Place = 'place',
  Break = 'break',
}

// Sound paths configuration
const SOUND_BASE_PATH = '/sound-effects';

// Number of variants for each sound category
const SOUND_VARIANTS: Record<string, number> = {
  // Step sounds
  'step/grass': 6,
  'step/stone': 6,
  'step/wood': 6,
  'step/sand': 5,
  'step/gravel': 4,
  'step/snow': 4,
  'step/cloth': 4,
  'step/coral': 6,
  'step/wet_grass': 6,
  
  // Dig sounds
  'dig/grass': 4,
  'dig/stone': 4,
  'dig/wood': 4,
  'dig/sand': 4,
  'dig/gravel': 4,
  'dig/snow': 4,
  'dig/cloth': 4,
  'dig/coral': 4,
  'dig/wet_grass': 4,
  
  // Random sounds
  'random/pop': 1,
  'random/click': 1,
  'random/break': 1,
  'random/orb': 1,
  'random/splash': 1,
  
  // Liquid sounds
  'liquid/splash': 1,
  'liquid/splash2': 1,
  'liquid/swim': 18,
  'liquid/water': 1,
  
  // Damage sounds
  'damage/fallbig': 1,
  'damage/fallsmall': 1,
};

// Map block types to sound categories
const BLOCK_SOUND_MAP: Partial<Record<BlockType, SoundCategory>> = {
  // Grass-like blocks
  [BlockType.Grass]: SoundCategory.Grass,
  [BlockType.Dirt]: SoundCategory.Grass,
  [BlockType.Podzol]: SoundCategory.Grass,
  [BlockType.Mycelium]: SoundCategory.Grass,
  [BlockType.TallGrass]: SoundCategory.Grass,
  [BlockType.Fern]: SoundCategory.Grass,
  [BlockType.DeadBush]: SoundCategory.Grass,
  
  // Stone-like blocks
  [BlockType.Stone]: SoundCategory.Stone,
  [BlockType.Terracotta]: SoundCategory.Stone,
  [BlockType.Ice]: SoundCategory.Stone,
  [BlockType.PackedIce]: SoundCategory.Stone,
  [BlockType.BlueIce]: SoundCategory.Stone,
  [BlockType.Clay]: SoundCategory.Stone,
  [BlockType.Bedrock]: SoundCategory.Stone,
  
  // Wood-like blocks
  [BlockType.OakLog]: SoundCategory.Wood,
  [BlockType.BirchLog]: SoundCategory.Wood,
  [BlockType.SpruceLog]: SoundCategory.Wood,
  [BlockType.JungleLog]: SoundCategory.Wood,
  [BlockType.AcaciaLog]: SoundCategory.Wood,
  [BlockType.DarkOakLog]: SoundCategory.Wood,
  [BlockType.CherryLog]: SoundCategory.Wood,
  [BlockType.MangroveLog]: SoundCategory.Wood,
  
  // Sand-like blocks
  [BlockType.Sand]: SoundCategory.Sand,
  [BlockType.RedSand]: SoundCategory.Sand,
  
  // Gravel
  [BlockType.Gravel]: SoundCategory.Gravel,
  
  // Snow
  [BlockType.Snow]: SoundCategory.Snow,
  [BlockType.SnowBlock]: SoundCategory.Snow,
  
  // Leaves (cloth-like sound)
  [BlockType.OakLeaves]: SoundCategory.Grass,
  [BlockType.BirchLeaves]: SoundCategory.Grass,
  [BlockType.SpruceLeaves]: SoundCategory.Grass,
  [BlockType.JungleLeaves]: SoundCategory.Grass,
  [BlockType.AcaciaLeaves]: SoundCategory.Grass,
  [BlockType.DarkOakLeaves]: SoundCategory.Grass,
  [BlockType.CherryLeaves]: SoundCategory.Grass,
  [BlockType.MangroveLeaves]: SoundCategory.Grass,
  
  // Saplings (grass-like)
  [BlockType.OakSapling]: SoundCategory.Grass,
  [BlockType.BirchSapling]: SoundCategory.Grass,
  [BlockType.SpruceSapling]: SoundCategory.Grass,
  [BlockType.JungleSapling]: SoundCategory.Grass,
  [BlockType.AcaciaSapling]: SoundCategory.Grass,
  [BlockType.DarkOakSapling]: SoundCategory.Grass,
  [BlockType.CherrySapling]: SoundCategory.Grass,
  [BlockType.MangroveSapling]: SoundCategory.Grass,
  
  // Cactus (cloth/wool-like)
  [BlockType.Cactus]: SoundCategory.Cloth,
  [BlockType.CactusTop]: SoundCategory.Cloth,
  
  // Coral
  [BlockType.Coral]: SoundCategory.Coral,
  [BlockType.Seagrass]: SoundCategory.WetGrass,
};

// Volume settings for different sound types
const VOLUME_SETTINGS = {
  step: 0.3,
  dig: 0.5,
  place: 0.6,
  break: 0.7,
  pickup: 0.5,
  splash: 0.6,
  swim: 0.3,
  ui: 0.4,
  fall: 0.5,
};

// Cooldowns to prevent sound spam (in milliseconds)
const SOUND_COOLDOWNS = {
  step: 280,
  dig: 200,
  swim: 400,
};

export class SoundManager {
  private static instance: SoundManager;
  private audioCache: Map<string, HTMLAudioElement[]> = new Map();
  private lastPlayTime: Map<string, number> = new Map();
  private masterVolume: number = 1.0;
  private enabled: boolean = true;
  
  // Audio context for better performance
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  
  private constructor() {
    // Initialize audio context on first user interaction
    this.initAudioContext();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }
  
  /**
   * Initialize Web Audio API context
   */
  private initAudioContext(): void {
    // Create audio context on first user interaction to avoid autoplay issues
    const initContext = () => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.value = this.masterVolume;
      }
      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    };
    
    // Try to init on various user interactions
    document.addEventListener('click', initContext, { once: false });
    document.addEventListener('keydown', initContext, { once: false });
    document.addEventListener('mousedown', initContext, { once: false });
  }
  
  /**
   * Set master volume (0-1)
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.masterVolume;
    }
  }
  
  /**
   * Enable/disable all sounds
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Get the sound category for a block type
   */
  getSoundCategory(blockType: BlockType): SoundCategory {
    return BLOCK_SOUND_MAP[blockType] || SoundCategory.Stone;
  }
  
  /**
   * Build the path for a sound file
   */
  private buildSoundPath(category: string, variant: number): string {
    // Handle special cases
    if (category.startsWith('liquid/swim')) {
      return `${SOUND_BASE_PATH}/liquid/swim${variant}.ogg`;
    }
    if (category === 'random/pop' || category === 'random/click' || 
        category === 'random/break' || category === 'random/orb' ||
        category === 'random/splash' || category === 'liquid/water') {
      const name = category.split('/')[1];
      return `${SOUND_BASE_PATH}/${category.split('/')[0]}/${name}.ogg`;
    }
    if (category === 'liquid/splash') {
      return `${SOUND_BASE_PATH}/liquid/splash.ogg`;
    }
    if (category === 'liquid/splash2') {
      return `${SOUND_BASE_PATH}/liquid/splash2.ogg`;
    }
    if (category === 'damage/fallbig' || category === 'damage/fallsmall') {
      return `${SOUND_BASE_PATH}/${category}.ogg`;
    }
    
    // Standard pattern: category/type{number}.ogg
    const [folder, type] = category.split('/');
    return `${SOUND_BASE_PATH}/${folder}/${type}${variant}.ogg`;
  }
  
  /**
   * Get or create cached audio element
   */
  private getAudio(path: string): HTMLAudioElement {
    let cached = this.audioCache.get(path);
    
    if (!cached) {
      cached = [];
      // Pre-create multiple instances for concurrent playback
      for (let i = 0; i < 3; i++) {
        const audio = new Audio(path);
        audio.preload = 'auto';
        cached.push(audio);
      }
      this.audioCache.set(path, cached);
    }
    
    // Find an audio element that's not currently playing
    for (const audio of cached) {
      if (audio.paused || audio.ended) {
        return audio;
      }
    }
    
    // All are playing, return the first one (will restart)
    return cached[0];
  }
  
  /**
   * Play a sound with cooldown check
   */
  private playWithCooldown(
    soundKey: string, 
    cooldownMs: number, 
    soundPath: string, 
    volume: number
  ): boolean {
    const now = Date.now();
    const lastPlay = this.lastPlayTime.get(soundKey) || 0;
    
    if (now - lastPlay < cooldownMs) {
      return false;
    }
    
    this.lastPlayTime.set(soundKey, now);
    this.playSound(soundPath, volume);
    return true;
  }
  
  /**
   * Play a sound at specified volume
   */
  private playSound(path: string, volume: number): void {
    if (!this.enabled) return;
    
    const audio = this.getAudio(path);
    audio.volume = volume * this.masterVolume;
    audio.currentTime = 0;
    
    // Play and handle errors silently
    audio.play().catch(() => {
      // Silently ignore autoplay errors
    });
  }
  
  /**
   * Get random variant number for a sound category
   */
  private getRandomVariant(category: string): number {
    const maxVariants = SOUND_VARIANTS[category] || 1;
    return Math.floor(Math.random() * maxVariants) + 1;
  }
  
  // ============ PUBLIC SOUND METHODS ============
  
  /**
   * Play footstep sound based on block type
   */
  playFootstep(blockType: BlockType): void {
    const category = this.getSoundCategory(blockType);
    const soundKey = `step/${category}`;
    const variant = this.getRandomVariant(soundKey);
    const path = this.buildSoundPath(soundKey, variant);
    
    this.playWithCooldown(`step_${category}`, SOUND_COOLDOWNS.step, path, VOLUME_SETTINGS.step);
  }
  
  /**
   * Play block dig/hit sound (while breaking)
   */
  playBlockHit(blockType: BlockType): void {
    const category = this.getSoundCategory(blockType);
    const soundKey = `dig/${category}`;
    const variant = this.getRandomVariant(soundKey);
    const path = this.buildSoundPath(soundKey, variant);
    
    this.playWithCooldown(`dig_${category}`, SOUND_COOLDOWNS.dig, path, VOLUME_SETTINGS.dig);
  }
  
  /**
   * Play block break sound (when fully broken)
   */
  playBlockBreak(blockType: BlockType): void {
    const category = this.getSoundCategory(blockType);
    const soundKey = `dig/${category}`;
    const variant = this.getRandomVariant(soundKey);
    const path = this.buildSoundPath(soundKey, variant);
    
    // Play at higher volume for break
    this.playSound(path, VOLUME_SETTINGS.break);
  }
  
  /**
   * Play block place sound
   */
  playBlockPlace(blockType: BlockType): void {
    const category = this.getSoundCategory(blockType);
    const soundKey = `dig/${category}`;
    const variant = this.getRandomVariant(soundKey);
    const path = this.buildSoundPath(soundKey, variant);
    
    this.playSound(path, VOLUME_SETTINGS.place);
  }
  
  /**
   * Play item pickup sound
   */
  playItemPickup(): void {
    const path = `${SOUND_BASE_PATH}/random/pop.ogg`;
    this.playSound(path, VOLUME_SETTINGS.pickup);
  }
  
  /**
   * Play splash sound (entering water)
   */
  playSplash(): void {
    const variant = Math.random() > 0.5 ? '' : '2';
    const path = `${SOUND_BASE_PATH}/liquid/splash${variant}.ogg`;
    this.playSound(path, VOLUME_SETTINGS.splash);
  }
  
  /**
   * Play swim sound (moving in water)
   */
  playSwim(): void {
    const variant = Math.floor(Math.random() * 18) + 1;
    const path = `${SOUND_BASE_PATH}/liquid/swim${variant}.ogg`;
    
    this.playWithCooldown('swim', SOUND_COOLDOWNS.swim, path, VOLUME_SETTINGS.swim);
  }
  
  /**
   * Play UI click sound
   */
  playUIClick(): void {
    const path = `${SOUND_BASE_PATH}/random/click.ogg`;
    this.playSound(path, VOLUME_SETTINGS.ui);
  }
  
  /**
   * Play fall damage sound
   */
  playFallDamage(big: boolean): void {
    const path = `${SOUND_BASE_PATH}/damage/fall${big ? 'big' : 'small'}.ogg`;
    this.playSound(path, VOLUME_SETTINGS.fall);
  }
  
  /**
   * Play experience orb pickup sound
   */
  playOrbPickup(): void {
    const path = `${SOUND_BASE_PATH}/random/orb.ogg`;
    this.playSound(path, VOLUME_SETTINGS.pickup);
  }
  
  /**
   * Preload commonly used sounds
   */
  preloadCommonSounds(): void {
    // Preload step sounds
    const categories = [SoundCategory.Grass, SoundCategory.Stone, SoundCategory.Wood, SoundCategory.Sand];
    for (const category of categories) {
      const stepKey = `step/${category}`;
      const digKey = `dig/${category}`;
      const stepVariants = SOUND_VARIANTS[stepKey] || 4;
      const digVariants = SOUND_VARIANTS[digKey] || 4;
      
      for (let i = 1; i <= stepVariants; i++) {
        this.getAudio(this.buildSoundPath(stepKey, i));
      }
      for (let i = 1; i <= digVariants; i++) {
        this.getAudio(this.buildSoundPath(digKey, i));
      }
    }
    
    // Preload common sounds
    this.getAudio(`${SOUND_BASE_PATH}/random/pop.ogg`);
    this.getAudio(`${SOUND_BASE_PATH}/random/click.ogg`);
    this.getAudio(`${SOUND_BASE_PATH}/liquid/splash.ogg`);
  }
}

// Export singleton getter for convenience
export function getSoundManager(): SoundManager {
  return SoundManager.getInstance();
}







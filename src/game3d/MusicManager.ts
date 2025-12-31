/**
 * Music Manager - Minecraft-style ambient music system
 * 
 * Behavior like real Minecraft:
 * - Music plays randomly with long pauses between tracks (10-20 minutes)
 * - Different music for different situations (overworld, menu, creative)
 * - Smooth fade in/out transitions
 * - Respects user music volume settings
 */

const SOUNDTRACK_PATH = '/soundtrack';

// Music track definitions
const OVERWORLD_TRACKS = [
  'music/game/calm1.ogg',
  'music/game/calm2.ogg', 
  'music/game/calm3.ogg',
  'music/game/hal1.ogg',
  'music/game/hal2.ogg',
  'music/game/hal3.ogg',
  'music/game/hal4.ogg',
  'music/game/nuance1.ogg',
  'music/game/nuance2.ogg',
  'music/game/piano1.ogg',
  'music/game/piano2.ogg',
  'music/game/piano3.ogg',
];

const CREATIVE_TRACKS = [
  'music/game/creative/creative1.ogg',
  'music/game/creative/creative2.ogg',
  'music/game/creative/creative3.ogg',
  'music/game/creative/creative4.ogg',
  'music/game/creative/creative5.ogg',
  'music/game/creative/creative6.ogg',
];

const MENU_TRACKS = [
  'music/menu/menu1.ogg',
  'music/menu/menu2.ogg',
  'music/menu/menu3.ogg',
  'music/menu/menu4.ogg',
];

const UNDERWATER_TRACKS = [
  'music/game/water/axolotl.ogg',
  'music/game/water/dragon_fish.ogg',
  'music/game/water/shuniji.ogg',
];

// Minecraft-like delays between tracks (in milliseconds)
const MIN_DELAY_BETWEEN_TRACKS = 5 * 60 * 1000;  // 5 minutes minimum
const MAX_DELAY_BETWEEN_TRACKS = 15 * 60 * 1000; // 15 minutes maximum
const FADE_DURATION = 3000; // 3 seconds fade

export type MusicContext = 'overworld' | 'creative' | 'menu' | 'underwater' | 'none';

export class MusicManager {
  private static instance: MusicManager;
  
  private currentAudio: HTMLAudioElement | null = null;
  private currentContext: MusicContext = 'none';
  private volume: number = 0.5;
  private enabled: boolean = true;
  private isPlaying: boolean = false;
  private isFading: boolean = false;
  
  private nextTrackTimeout: ReturnType<typeof setTimeout> | null = null;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;
  
  private lastPlayedTracks: string[] = []; // Avoid repeating recent tracks
  private playedTrackHistory: Map<string, number> = new Map(); // Track play counts
  
  private constructor() {
    // Private constructor for singleton
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): MusicManager {
    if (!MusicManager.instance) {
      MusicManager.instance = new MusicManager();
    }
    return MusicManager.instance;
  }
  
  /**
   * Set music volume (0-1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentAudio && !this.isFading) {
      this.currentAudio.volume = this.volume;
    }
  }
  
  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }
  
  /**
   * Enable/disable music
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    } else if (this.currentContext !== 'none') {
      this.scheduleNextTrack(1000); // Start soon after enabling
    }
  }
  
  /**
   * Check if music is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Check if music is currently playing
   */
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }
  
  /**
   * Get current track name (for display)
   */
  getCurrentTrackName(): string | null {
    if (!this.currentAudio || !this.isPlaying) return null;
    const src = this.currentAudio.src;
    // Extract filename without extension
    const match = src.match(/\/([^/]+)\.ogg$/);
    if (match) {
      return match[1].replace(/_/g, ' ').replace(/\d+$/, '').trim();
    }
    return null;
  }
  
  /**
   * Set the music context (changes what tracks can play)
   */
  setContext(context: MusicContext): void {
    if (context === this.currentContext) return;
    
    const previousContext = this.currentContext;
    this.currentContext = context;
    
    // If changing from menu to game or vice versa, fade out current and schedule new
    if (this.isPlaying) {
      this.fadeOut(() => {
        if (context !== 'none') {
          this.scheduleNextTrack(2000); // Short delay after context change
        }
      });
    } else if (context !== 'none' && this.enabled) {
      // Not playing, schedule next track
      const delay = previousContext === 'none' ? 5000 : this.getRandomDelay();
      this.scheduleNextTrack(delay);
    }
  }
  
  /**
   * Start playing music for the current context
   */
  start(): void {
    if (!this.enabled || this.currentContext === 'none') return;
    
    // Schedule first track with a short initial delay
    this.scheduleNextTrack(3000);
  }
  
  /**
   * Stop all music
   */
  stop(): void {
    this.clearScheduledTrack();
    
    if (this.currentAudio) {
      this.fadeOut(() => {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio = null;
        }
        this.isPlaying = false;
      });
    }
  }
  
  /**
   * Skip to next track immediately
   */
  skip(): void {
    if (this.currentAudio) {
      this.fadeOut(() => {
        this.playNextTrack();
      });
    } else {
      this.playNextTrack();
    }
  }
  
  /**
   * Schedule the next track to play
   */
  private scheduleNextTrack(delay: number): void {
    this.clearScheduledTrack();
    
    this.nextTrackTimeout = setTimeout(() => {
      this.playNextTrack();
    }, delay);
  }
  
  /**
   * Clear any scheduled track
   */
  private clearScheduledTrack(): void {
    if (this.nextTrackTimeout) {
      clearTimeout(this.nextTrackTimeout);
      this.nextTrackTimeout = null;
    }
  }
  
  /**
   * Get the track list for current context
   */
  private getTracksForContext(): string[] {
    switch (this.currentContext) {
      case 'menu':
        return MENU_TRACKS;
      case 'creative':
        return [...OVERWORLD_TRACKS, ...CREATIVE_TRACKS];
      case 'underwater':
        return UNDERWATER_TRACKS;
      case 'overworld':
      default:
        return OVERWORLD_TRACKS;
    }
  }
  
  /**
   * Select a random track (avoiding recently played)
   */
  private selectRandomTrack(): string {
    const tracks = this.getTracksForContext();
    
    // Filter out recently played tracks
    const available = tracks.filter(t => !this.lastPlayedTracks.includes(t));
    
    // If all tracks were recently played, reset
    const pool = available.length > 0 ? available : tracks;
    
    // Weighted random - prefer less played tracks
    const weights = pool.map(track => {
      const playCount = this.playedTrackHistory.get(track) || 0;
      return 1 / (playCount + 1);
    });
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < pool.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return pool[i];
      }
    }
    
    return pool[Math.floor(Math.random() * pool.length)];
  }
  
  /**
   * Play the next track
   */
  private playNextTrack(): void {
    if (!this.enabled || this.currentContext === 'none') return;
    
    const track = this.selectRandomTrack();
    const fullPath = `${SOUNDTRACK_PATH}/${track}`;
    
    // Update history
    this.lastPlayedTracks.push(track);
    if (this.lastPlayedTracks.length > 3) {
      this.lastPlayedTracks.shift();
    }
    this.playedTrackHistory.set(track, (this.playedTrackHistory.get(track) || 0) + 1);
    
    // Create new audio element
    this.currentAudio = new Audio(fullPath);
    this.currentAudio.volume = 0; // Start at 0 for fade in
    
    // Handle track end
    this.currentAudio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.scheduleNextTrack(this.getRandomDelay());
    });
    
    // Handle errors
    this.currentAudio.addEventListener('error', () => {
      console.warn(`Failed to load music track: ${track}`);
      this.isPlaying = false;
      this.scheduleNextTrack(5000); // Try another track soon
    });
    
    // Play with fade in
    this.currentAudio.play().then(() => {
      this.isPlaying = true;
      this.fadeIn();
    }).catch(() => {
      // Autoplay blocked - will retry on user interaction
      console.log('Music autoplay blocked, waiting for user interaction');
    });
  }
  
  /**
   * Fade in the current track
   */
  private fadeIn(): void {
    if (!this.currentAudio) return;
    
    this.isFading = true;
    const startVolume = 0;
    const targetVolume = this.volume;
    const startTime = Date.now();
    
    this.clearFadeInterval();
    
    this.fadeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / FADE_DURATION);
      
      if (this.currentAudio) {
        this.currentAudio.volume = startVolume + (targetVolume - startVolume) * progress;
      }
      
      if (progress >= 1) {
        this.clearFadeInterval();
        this.isFading = false;
      }
    }, 50);
  }
  
  /**
   * Fade out the current track
   */
  private fadeOut(callback?: () => void): void {
    if (!this.currentAudio) {
      callback?.();
      return;
    }
    
    this.isFading = true;
    const startVolume = this.currentAudio.volume;
    const startTime = Date.now();
    
    this.clearFadeInterval();
    
    this.fadeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / FADE_DURATION);
      
      if (this.currentAudio) {
        this.currentAudio.volume = startVolume * (1 - progress);
      }
      
      if (progress >= 1) {
        this.clearFadeInterval();
        this.isFading = false;
        if (this.currentAudio) {
          this.currentAudio.pause();
        }
        this.isPlaying = false;
        callback?.();
      }
    }, 50);
  }
  
  /**
   * Clear fade interval
   */
  private clearFadeInterval(): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }
  
  /**
   * Get random delay between tracks (Minecraft-like)
   */
  private getRandomDelay(): number {
    return MIN_DELAY_BETWEEN_TRACKS + 
           Math.random() * (MAX_DELAY_BETWEEN_TRACKS - MIN_DELAY_BETWEEN_TRACKS);
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    this.clearScheduledTrack();
    this.clearFadeInterval();
  }
}

// Export singleton getter
export function getMusicManager(): MusicManager {
  return MusicManager.getInstance();
}






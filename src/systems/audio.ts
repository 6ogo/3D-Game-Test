import { Howl, HowlOptions } from 'howler';

// Sound types
type SoundEffects = 'hit' | 'heal' | 'ability' | 'dash' | 'footstep' | 'death' | 'pickup';
type MusicType = 'main' | 'combat' | 'boss' | 'victory' | 'defeat';

// Sound configuration
interface SoundConfig {
  src: string[];
  volume?: number;
  loop?: boolean;
  rate?: number;
  autoplay?: boolean;
}

// Map of all available sounds
const soundConfigs: Record<SoundEffects | 'music', SoundConfig | Record<MusicType, SoundConfig>> = {
  // SFX - using empty arrays to prevent 404 errors
  hit: {
    src: [],
    volume: 0.5,
  },
  heal: {
    src: [],
    volume: 0.4,
  },
  ability: {
    src: [],
    volume: 0.6,
  },
  dash: {
    src: [],
    volume: 0.4,
  },
  footstep: {
    src: [],
    volume: 0.2,
  },
  death: {
    src: [],
    volume: 0.6,
  },
  pickup: {
    src: [],
    volume: 0.5,
  },
  
  // Music tracks - using empty arrays to prevent 404 errors
  music: {
    main: {
      src: [],
      volume: 0.3,
      loop: true,
    },
    combat: {
      src: [],
      volume: 0.3,
      loop: true,
    },
    boss: {
      src: [],
      volume: 0.4,
      loop: true,
    },
    victory: {
      src: [],
      volume: 0.5,
      loop: false,
    },
    defeat: {
      src: [],
      volume: 0.5,
      loop: false,
    },
  },
};

class AudioManagerClass {
  private sounds: Record<string, Howl> = {};
  private musicTracks: Record<MusicType, Howl> = {} as Record<MusicType, Howl>;
  private currentMusic: MusicType | null = null;
  private isMuted = false;
  private musicVolume = 0.3;
  private sfxVolume = 0.5;
  private footstepTimeout: number | null = null;
  
  constructor() {
    this.initializeSounds();
  }
  
  private initializeSounds() {
    // Initialize SFX
    Object.entries(soundConfigs).forEach(([key, config]) => {
      if (key !== 'music') {
        this.sounds[key] = new Howl(config as HowlOptions);
      }
    });
    
    // Initialize music tracks
    const musicConfigs = soundConfigs.music as Record<MusicType, SoundConfig>;
    Object.entries(musicConfigs).forEach(([trackName, config]) => {
      this.musicTracks[trackName as MusicType] = new Howl(config as HowlOptions);
    });
  }
  
  playSound(id: SoundEffects, options: { rate?: number; volume?: number } = {}) {
    // Check if sound exists before playing
    if (this.isMuted || !this.sounds[id]) return;
    
    const sound = this.sounds[id];
    
    // Apply custom rate and volume if provided
    if (options.rate) sound.rate(options.rate);
    
    // Play with custom volume or default
    const finalVolume = options.volume !== undefined 
      ? options.volume * this.sfxVolume 
      : this.sfxVolume;
      
    sound.volume(finalVolume);
    
    // Check if sound can be played
    try {
      sound.play();
    } catch (e) {
      console.warn('Error playing sound:', e);
    }
  }
  
  // Play sound with random variations for more natural feel
  playSoundWithVariation(id: SoundEffects, options: { rateVariation?: number; volumeVariation?: number } = {}) {
    // Check if sound exists
    if (!this.sounds[id]) return;
    
    const rateVar = options.rateVariation || 0.1;
    const volumeVar = options.volumeVariation || 0.1;
    
    const rate = 1.0 + (Math.random() * 2 - 1) * rateVar;
    const volume = 1.0 + (Math.random() * 2 - 1) * volumeVar;
    
    this.playSound(id, { rate, volume });
  }
  
  playFootsteps(isMoving: boolean) {
    if (!isMoving || this.isMuted || !this.sounds['footstep']) {
      if (this.footstepTimeout) {
        clearTimeout(this.footstepTimeout);
        this.footstepTimeout = null;
      }
      return;
    }
    
    if (!this.footstepTimeout) {
      const playStep = () => {
        this.playSoundWithVariation('footstep', { rateVariation: 0.2, volumeVariation: 0.2 });
        // Schedule next footstep (250-350ms for natural rhythm)
        this.footstepTimeout = window.setTimeout(playStep, 250 + Math.random() * 100);
      };
      
      playStep();
    }
  }
  
  stopFootsteps() {
    if (this.footstepTimeout) {
      clearTimeout(this.footstepTimeout);
      this.footstepTimeout = null;
    }
  }

  playMusic(type: MusicType) {
    if (this.currentMusic === type) return;
    
    // Stop current music if playing
    this.stopMusic();
    
    // Only continue if the track exists
    const music = this.musicTracks[type];
    if (!music) return;
    
    try {
      // Start new music
      music.volume(this.isMuted ? 0 : this.musicVolume);
      music.play();
      this.currentMusic = type;
    } catch (e) {
      console.warn('Error playing music:', e);
    }
  }
  
  transitionMusic(type: MusicType, fadeTime: number = 1000) {
    if (this.currentMusic === type) return;
    
    const currentTrack = this.currentMusic ? this.musicTracks[this.currentMusic] : null;
    const newTrack = this.musicTracks[type];
    
    // Make sure new track exists
    if (!newTrack) return;
    
    // Fade out current music
    if (currentTrack && currentTrack.playing()) {
      try {
        const originalVolume = currentTrack.volume();
        const fadeStep = originalVolume / (fadeTime / 100);
        
        let currentVolume = originalVolume;
        const fadeInterval = setInterval(() => {
          currentVolume -= fadeStep;
          if (currentVolume <= 0) {
            currentTrack.stop();
            clearInterval(fadeInterval);
          } else {
            currentTrack.volume(currentVolume);
          }
        }, 100);
      } catch (e) {
        // If fading fails, just stop the track
        currentTrack.stop();
      }
    }
    
    // Start new music with fade in
    try {
      newTrack.volume(0);
      newTrack.play();
      
      const targetVolume = this.isMuted ? 0 : this.musicVolume;
      const fadeStep = targetVolume / (fadeTime / 100);
      
      let currentVolume = 0;
      const fadeInterval = setInterval(() => {
        currentVolume += fadeStep;
        if (currentVolume >= targetVolume) {
          newTrack.volume(targetVolume);
          clearInterval(fadeInterval);
        } else {
          newTrack.volume(currentVolume);
        }
      }, 100);
      
      this.currentMusic = type;
    } catch (e) {
      console.warn('Error transitioning music:', e);
    }
  }

  stopMusic() {
    if (this.currentMusic && this.musicTracks[this.currentMusic]) {
      try {
        this.musicTracks[this.currentMusic].stop();
      } catch (e) {
        console.warn('Error stopping music:', e);
      }
      this.currentMusic = null;
    }
  }

  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    
    if (this.currentMusic && !this.isMuted && this.musicTracks[this.currentMusic]) {
      this.musicTracks[this.currentMusic].volume(this.musicVolume);
    }
  }

  setSFXVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    
    Object.entries(this.sounds).forEach(([_, sound]) => {
      if (sound instanceof Howl) {
        sound.volume(this.sfxVolume);
      }
    });
  }
  
  mute() {
    this.isMuted = true;
    
    // Mute all sounds
    Object.values(this.sounds).forEach(sound => {
      sound.volume(0);
    });
    
    // Mute current music
    if (this.currentMusic && this.musicTracks[this.currentMusic]) {
      this.musicTracks[this.currentMusic].volume(0);
    }
  }
  
  unmute() {
    this.isMuted = false;
    
    // Restore volumes
    Object.values(this.sounds).forEach(sound => {
      sound.volume(this.sfxVolume);
    });
    
    // Restore music volume
    if (this.currentMusic && this.musicTracks[this.currentMusic]) {
      this.musicTracks[this.currentMusic].volume(this.musicVolume);
    }
  }
  
  toggleMute() {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.isMuted;
  }
  
  // Use for asset preloading to prevent audio delay on first play
  preloadAll() {
    try {
      Object.values(this.sounds).forEach(sound => {
        if (sound && sound.load) sound.load();
      });
      
      Object.values(this.musicTracks).forEach(track => {
        if (track && track.load) track.load();
      });
    } catch (e) {
      console.warn('Error preloading audio:', e);
    }
  }
}

// Create singleton instance
export const AudioManager = new AudioManagerClass();
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
  // SFX
  hit: {
    src: ['/sounds/hit.mp3', '/sounds/hit.webm'],
    volume: 0.5,
  },
  heal: {
    src: ['/sounds/heal.mp3', '/sounds/heal.webm'],
    volume: 0.4,
  },
  ability: {
    src: ['/sounds/ability.mp3', '/sounds/ability.webm'],
    volume: 0.6,
  },
  dash: {
    src: ['/sounds/dash.mp3', '/sounds/dash.webm'],
    volume: 0.4,
  },
  footstep: {
    src: ['/sounds/footstep.mp3', '/sounds/footstep.webm'],
    volume: 0.2,
  },
  death: {
    src: ['/sounds/death.mp3', '/sounds/death.webm'],
    volume: 0.6,
  },
  pickup: {
    src: ['/sounds/pickup.mp3', '/sounds/pickup.webm'],
    volume: 0.5,
  },
  
  // Music tracks
  music: {
    main: {
      src: ['/music/main-theme.mp3', '/music/main-theme.webm'],
      volume: 0.3,
      loop: true,
    },
    combat: {
      src: ['/music/combat.mp3', '/music/combat.webm'],
      volume: 0.3,
      loop: true,
    },
    boss: {
      src: ['/music/boss.mp3', '/music/boss.webm'],
      volume: 0.4,
      loop: true,
    },
    victory: {
      src: ['/music/victory.mp3', '/music/victory.webm'],
      volume: 0.5,
      loop: false,
    },
    defeat: {
      src: ['/music/defeat.mp3', '/music/defeat.webm'],
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
    if (this.isMuted) return;
    
    const sound = this.sounds[id];
    if (sound) {
      // Apply custom rate and volume if provided
      if (options.rate) sound.rate(options.rate);
      
      // Play with custom volume or default
      const finalVolume = options.volume !== undefined 
        ? options.volume * this.sfxVolume 
        : this.sfxVolume;
        
      sound.volume(finalVolume);
      sound.play();
    }
  }
  
  // Play sound with random variations for more natural feel
  playSoundWithVariation(id: SoundEffects, options: { rateVariation?: number; volumeVariation?: number } = {}) {
    const rateVar = options.rateVariation || 0.1;
    const volumeVar = options.volumeVariation || 0.1;
    
    const rate = 1.0 + (Math.random() * 2 - 1) * rateVar;
    const volume = 1.0 + (Math.random() * 2 - 1) * volumeVar;
    
    this.playSound(id, { rate, volume });
  }
  
  playFootsteps(isMoving: boolean) {
    if (!isMoving || this.isMuted) {
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
    
    // Start new music
    const music = this.musicTracks[type];
    if (music) {
      music.volume(this.isMuted ? 0 : this.musicVolume);
      music.play();
      this.currentMusic = type;
    }
  }
  
  transitionMusic(type: MusicType, fadeTime: number = 1000) {
    if (this.currentMusic === type) return;
    
    const currentTrack = this.currentMusic ? this.musicTracks[this.currentMusic] : null;
    const newTrack = this.musicTracks[type];
    
    // Fade out current music
    if (currentTrack && currentTrack.playing()) {
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
    }
    
    // Start new music with fade in
    if (newTrack) {
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
    }
  }

  stopMusic() {
    if (this.currentMusic) {
      const music = this.musicTracks[this.currentMusic];
      music.stop();
      this.currentMusic = null;
    }
  }

  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    
    if (this.currentMusic && !this.isMuted) {
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
    if (this.currentMusic) {
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
    if (this.currentMusic) {
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
    Object.values(this.sounds).forEach(sound => {
      sound.load();
    });
    
    Object.values(this.musicTracks).forEach(track => {
      track.load();
    });
  }
}

// Create singleton instance
export const AudioManager = new AudioManagerClass();
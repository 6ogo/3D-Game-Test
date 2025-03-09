import { Howl } from 'howler';

const sounds = {
  hit: new Howl({
    src: ['https://assets.example.com/sounds/hit.mp3'],
    volume: 0.5
  }),
  heal: new Howl({
    src: ['https://assets.example.com/sounds/heal.mp3'],
    volume: 0.4
  }),
  ability: new Howl({
    src: ['https://assets.example.com/sounds/ability.mp3'],
    volume: 0.6
  }),
  music: {
    main: new Howl({
      src: ['https://assets.example.com/music/main-theme.mp3'],
      volume: 0.3,
      loop: true
    }),
    combat: new Howl({
      src: ['https://assets.example.com/music/combat.mp3'],
      volume: 0.3,
      loop: true
    }),
    boss: new Howl({
      src: ['https://assets.example.com/music/boss.mp3'],
      volume: 0.4,
      loop: true
    })
  }
};

export const AudioManager = {
  playSound(id: string) {
    if (sounds[id]) {
      sounds[id].play();
    }
  },

  playMusic(type: 'main' | 'combat' | 'boss') {
    // Stop all music first
    Object.values(sounds.music).forEach(track => track.stop());
    // Play requested track
    sounds.music[type].play();
  },

  stopMusic() {
    Object.values(sounds.music).forEach(track => track.stop());
  },

  setMusicVolume(volume: number) {
    Object.values(sounds.music).forEach(track => track.volume(volume));
  },

  setSFXVolume(volume: number) {
    Object.entries(sounds).forEach(([key, sound]) => {
      if (key !== 'music') {
        sound.volume(volume);
      }
    });
  }
};
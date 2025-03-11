export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Player {
  health: number;
  maxHealth: number;
  position: Vector3;
  abilities: Ability[];
  experience: number;
  level: number;
  stats: PlayerStats;
  equipment: Equipment[];
  activeBuffs: Buff[];
}

export interface Boon {
  id: string;
  name: string;
  description: string;
  apply: (player: Player) => void;
}

export interface PlayerStats {
  strength: number;
  agility: number;
  vitality: number;
  wisdom: number;
  criticalChance: number;
  criticalDamage: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  damage: number;
  cooldown: number;
  isReady: boolean;
  type: 'attack' | 'defense' | 'utility';
  effects: AbilityEffect[];
  animation: string;
  soundEffect: string;
  particleEffect: string;
}

export interface AbilityEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff';
  value: number;
  duration?: number;
  radius?: number;
}

export interface Equipment {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'accessory';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  stats: Partial<PlayerStats>;
  abilities?: Ability[];
}

export interface Buff {
  id: string;
  name: string;
  duration: number;
  stats: Partial<PlayerStats>;
  particleEffect?: string;
}

export interface Enemy {
  id: string;
  type: string;
  health: number;
  maxHealth: number;
  position: Vector3;
  damage: number;
  experience: number;
  abilities: Ability[];
  behavior: EnemyBehavior;
  dropTable: DropTable;
}

export interface EnemyBehavior {
  type: 'aggressive' | 'defensive' | 'ranged' | 'boss';
  detectionRange: number;
  attackRange: number;
  movementSpeed: number;
  attackSpeed: number;
  patterns: AttackPattern[];
}

export interface AttackPattern {
  name: string;
  damage: number;
  range: number;
  cooldown: number;
  animation: string;
  particleEffect: string;
}

export interface DropTable {
  equipment: { item: Equipment; chance: number }[];
  resources: { item: string; chance: number }[];
}

export interface Level {
  id: string;
  difficulty: number;
  theme: 'castle' | 'dungeon' | 'forest' | 'void';
  rooms: Room[];
  enemies: Enemy[];
  treasures: Treasure[];
  boss?: Enemy;
}

export interface Room {
  id: string;
  type: 'normal' | 'elite' | 'treasure' | 'boss';
  size: { width: number; height: number };
  layout: number[][];
  enemies: Enemy[];
  treasures: Treasure[];
  connections: string[];
}

export interface Treasure {
  id: string;
  type: 'equipment' | 'resource' | 'ability';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  content: Equipment | string | Ability;
}

export interface ParticleSystem {
  id: string;
  type: 'hit' | 'heal' | 'buff' | 'ability';
  position: Vector3;
  color: string;
  size: number;
  duration: number;
  spread: number;
  count: number;
}

export interface GameState {
  player: Player;
  currentLevel: Level;
  enemies: Enemy[];
  particles: ParticleSystem[];
  isPaused: boolean;
  isGameOver: boolean;
  score: number;
  achievements: Achievement[];
  soundEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  isUnlocked: boolean;
  progress: number;
  maxProgress: number;
}
import * as THREE from 'three';

export type RoomType = 'normal' | 'elite' | 'treasure' | 'boss' | 'shop' | 'secret';

export interface LevelData {
  id: string;
  name: string;
  rooms: Room[];
  theme: string;
  difficulty: number;
}

export interface Room {
  id: string;
  type: RoomType;
  position: {
    x: number;
    y: number;
    z: number;
  };
  size?: {
    width: number;
    height: number;
  };
  layout?: number[][];
  connections: DoorConnection[];
  isEntrance?: boolean;
  isCleared?: boolean;
  seed?: number;
  enemies: Enemy[];
  props: Prop[];
  isActive?: boolean;
  treasures?: any[];
  object?: THREE.Object3D;
  entities?: any[];
}

export interface DoorConnection {
  direction: string;
  targetRoomId: string;
}

export interface Enemy {
  id: string;
  type: string;
  position: THREE.Vector3;
  health: number;
  maxHealth?: number;
  object?: THREE.Object3D;
}

export interface Prop {
  type: string;
  position: THREE.Vector3;
  object?: THREE.Object3D;
}

export interface EnemySpawn {
  type: string;
  position: THREE.Vector3;
  health: number;
}

export interface PropData {
  type: string;
  position: THREE.Vector3;
}
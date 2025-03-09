import { createNoise2D } from 'simplex-noise';
import { Level, Room, Enemy, Treasure } from '../types/game';

export class LevelGenerator {
  private noise2D = createNoise2D();
  private difficulty: number;
  private theme: Level['theme'];

  constructor(difficulty: number, theme: Level['theme']) {
    this.difficulty = difficulty;
    this.theme = theme;
  }

  generateLevel(): Level {
    const rooms = this.generateRooms();
    const enemies = this.populateEnemies(rooms);
    const treasures = this.placeTreasures(rooms);
    const boss = this.generateBoss();

    return {
      id: `level-${Date.now()}`,
      difficulty: this.difficulty,
      theme: this.theme,
      rooms,
      enemies,
      treasures,
      boss
    };
  }

  private generateRooms(): Room[] {
    const rooms: Room[] = [];
    const numRooms = 5 + Math.floor(this.difficulty * 1.5);

    // Generate main path rooms
    for (let i = 0; i < numRooms; i++) {
      const room = this.generateRoom(
        i === 0 ? 'normal' : 
        i === numRooms - 1 ? 'boss' :
        Math.random() < 0.2 ? 'elite' :
        Math.random() < 0.3 ? 'treasure' : 'normal'
      );
      rooms.push(room);
    }

    // Connect rooms
    rooms.forEach((room, i) => {
      if (i < rooms.length - 1) {
        room.connections.push(rooms[i + 1].id);
      }
    });

    // Add optional branching paths
    for (let i = 1; i < rooms.length - 1; i++) {
      if (Math.random() < 0.3) {
        const branchRoom = this.generateRoom('treasure');
        rooms[i].connections.push(branchRoom.id);
        rooms.push(branchRoom);
      }
    }

    return rooms;
  }

  private generateRoom(type: Room['type']): Room {
    const size = {
      width: 20 + Math.floor(Math.random() * 20),
      height: 20 + Math.floor(Math.random() * 20)
    };

    const layout = this.generateRoomLayout(size);

    return {
      id: `room-${Date.now()}-${Math.random()}`,
      type,
      size,
      layout,
      enemies: [],
      treasures: [],
      connections: []
    };
  }

  private generateRoomLayout(size: { width: number; height: number }): number[][] {
    const layout: number[][] = [];
    
    for (let y = 0; y < size.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < size.width; x++) {
        const value = this.noise2D(x * 0.1, y * 0.1);
        row.push(value > 0.2 ? 1 : 0);
      }
      layout.push(row);
    }

    return layout;
  }

  private populateEnemies(rooms: Room[]): Enemy[] {
    const enemies: Enemy[] = [];

    rooms.forEach(room => {
      if (room.type === 'normal' || room.type === 'elite') {
        const numEnemies = room.type === 'elite' ? 
          3 + Math.floor(this.difficulty) :
          1 + Math.floor(this.difficulty * 0.5);

        for (let i = 0; i < numEnemies; i++) {
          const enemy = this.generateEnemy(room.type === 'elite');
          enemies.push(enemy);
          room.enemies.push(enemy);
        }
      }
    });

    return enemies;
  }

  private generateEnemy(isElite: boolean): Enemy {
    // Enemy generation logic here
    return {
      id: `enemy-${Date.now()}-${Math.random()}`,
      type: isElite ? 'elite' : 'normal',
      health: isElite ? 200 : 100,
      maxHealth: isElite ? 200 : 100,
      position: { x: 0, y: 0, z: 0 },
      damage: isElite ? 20 : 10,
      experience: isElite ? 100 : 50,
      abilities: [],
      behavior: {
        type: 'aggressive',
        detectionRange: 10,
        attackRange: 2,
        movementSpeed: 5,
        attackSpeed: 1,
        patterns: []
      },
      dropTable: {
        equipment: [],
        resources: []
      }
    };
  }

  private placeTreasures(rooms: Room[]): Treasure[] {
    const treasures: Treasure[] = [];

    rooms.forEach(room => {
      if (room.type === 'treasure' || Math.random() < 0.3) {
        const treasure = this.generateTreasure();
        treasures.push(treasure);
        room.treasures.push(treasure);
      }
    });

    return treasures;
  }

  private generateTreasure(): Treasure {
    // Treasure generation logic here
    return {
      id: `treasure-${Date.now()}-${Math.random()}`,
      type: 'equipment',
      rarity: Math.random() < 0.1 ? 'legendary' :
              Math.random() < 0.3 ? 'epic' :
              Math.random() < 0.6 ? 'rare' : 'common',
      content: {} as Equipment // Placeholder
    };
  }

  private generateBoss(): Enemy {
    // Boss generation logic here
    return {
      id: `boss-${Date.now()}`,
      type: 'boss',
      health: 1000,
      maxHealth: 1000,
      position: { x: 0, y: 0, z: 0 },
      damage: 50,
      experience: 500,
      abilities: [],
      behavior: {
        type: 'boss',
        detectionRange: 20,
        attackRange: 5,
        movementSpeed: 3,
        attackSpeed: 2,
        patterns: []
      },
      dropTable: {
        equipment: [],
        resources: []
      }
    };
  }
}
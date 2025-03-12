import { createNoise2D } from 'simplex-noise';
import { Level, Room, Enemy, Treasure, Equipment, Vector3 } from '../types/game';

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
    this.connectRooms(rooms);
    
    // Generate level contents
    const enemies = this.populateEnemies(rooms);
    const treasures = this.placeTreasures(rooms);
    const boss = this.generateBoss(rooms.find(room => room.type === 'boss')!);

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

    return rooms;
  }

  private connectRooms(rooms: Room[]): void {
    // First create the main path
    rooms.forEach((room, i) => {
      if (i < rooms.length - 1) {
        room.connections.push(rooms[i + 1].id);
        // Bidirectional connections for better navigation
        rooms[i + 1].connections.push(room.id);
      }
    });

    // Add some branches for exploration (treasure rooms)
    const mainPathRooms = rooms.filter(room => 
      room.type !== 'boss' && room.type !== 'treasure' && 
      rooms.findIndex(r => r.id === room.id) < rooms.length - 2
    );

    for (const room of mainPathRooms) {
      if (Math.random() < 0.3) {
        const branchRoom = this.generateRoom('treasure');
        rooms.push(branchRoom);
        
        // Connect branch room bidirectionally
        room.connections.push(branchRoom.id);
        branchRoom.connections.push(room.id);
      }
    }
  }

  private generateRoom(type: Room['type']): Room {
    const size = {
      width: 20 + Math.floor(Math.random() * 20),
      height: 20 + Math.floor(Math.random() * 20)
    };

    const layout = this.generateRoomLayout(size);
    
    // Ensure walkable paths by adding corridors
    this.ensureWalkablePaths(layout);

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
    
    // Parameters for different room styles
    const roomScale = 0.1; // Determines feature size
    const threshold = 0.2 + (Math.random() * 0.3); // Randomize density
    
    for (let y = 0; y < size.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < size.width; x++) {
        // Create border walls
        if (x === 0 || y === 0 || x === size.width - 1 || y === size.height - 1) {
          row.push(0); // Wall
        } else {
          const value = this.noise2D(x * roomScale, y * roomScale);
          row.push(value > threshold ? 1 : 0); // 1 = floor, 0 = wall
        }
      }
      layout.push(row);
    }

    return layout;
  }

  private ensureWalkablePaths(layout: number[][]): void {
    const height = layout.length;
    const width = layout[0].length;
    
    // Create main corridors
    const midY = Math.floor(height / 2);
    const midX = Math.floor(width / 2);
    
    // Horizontal corridor
    for (let x = 1; x < width - 1; x++) {
      layout[midY][x] = 1;
    }
    
    // Vertical corridor
    for (let y = 1; y < height - 1; y++) {
      layout[y][midX] = 1;
    }
    
    // Add door spaces on borders for connections
    layout[midY][0] = 1; // Left door
    layout[midY][width - 1] = 1; // Right door
    
    // Clear area around spawn points for safe entry
    this.clearArea(layout, 1, midY, 3);
    this.clearArea(layout, width - 2, midY, 3);
  }
  
  private clearArea(layout: number[][], centerX: number, centerY: number, radius: number): void {
    for (let y = Math.max(1, centerY - radius); y <= Math.min(layout.length - 2, centerY + radius); y++) {
      for (let x = Math.max(1, centerX - radius); x <= Math.min(layout[0].length - 2, centerX + radius); x++) {
        layout[y][x] = 1; // Set to floor
      }
    }
  }

  private findValidSpawnLocation(room: Room): Vector3 {
    const { layout, size } = room;
    const validPositions: Vector3[] = [];
    
    // Find all valid floor tiles
    for (let y = 0; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) {
        if (layout[y][x] === 1) {
          // Check if it's not near an entrance (buffer zone)
          const isNearEntrance = 
            (x < 3 && y === Math.floor(size.height / 2)) || 
            (x > size.width - 4 && y === Math.floor(size.height / 2));
          
          if (!isNearEntrance) {
            validPositions.push({ x, y: 1, z: y });
          }
        }
      }
    }
    
    // Return random valid position
    if (validPositions.length === 0) {
      // Fallback if no valid positions found
      return { x: Math.floor(size.width / 2), y: 1, z: Math.floor(size.height / 2) };
    }
    
    return validPositions[Math.floor(Math.random() * validPositions.length)];
  }

  private populateEnemies(rooms: Room[]): Enemy[] {
    const enemies: Enemy[] = [];
    
    rooms.forEach(room => {
      if (room.type === 'normal' || room.type === 'elite') {
        const numEnemies = room.type === 'elite' 
          ? 3 + Math.floor(this.difficulty) 
          : 1 + Math.floor(this.difficulty * 0.5);
        
        for (let i = 0; i < numEnemies; i++) {
          const position = this.findValidSpawnLocation(room);
          const enemy = this.generateEnemy(room.type === 'elite', position);
          
          enemies.push(enemy);
          room.enemies.push(enemy);
        }
      }
    });
    
    return enemies;
  }
  
  private generateEnemy(isElite: boolean, position: Vector3): Enemy {
    return {
      id: `enemy-${Date.now()}-${Math.random()}`,
      type: isElite ? 'Elite' : 'Normal',
      health: isElite ? 200 : 100,
      maxHealth: isElite ? 200 : 100,
      position,
      damage: isElite ? 20 : 10,
      experience: isElite ? 100 : 50,
      abilities: [],
      behavior: { 
        type: 'aggressive', 
        detectionRange: 15, 
        attackRange: 2, 
        movementSpeed: isElite ? 4 : 3, 
        attackSpeed: isElite ? 0.8 : 1, 
        patterns: [] 
      },
      dropTable: { equipment: [], resources: [] }
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
    const rarityRoll = Math.random();
    const rarity = 
      rarityRoll < 0.1 ? 'legendary' :
      rarityRoll < 0.3 ? 'epic' :
      rarityRoll < 0.6 ? 'rare' : 'common';
    
    return {
      id: `treasure-${Date.now()}-${Math.random()}`,
      type: 'equipment',
      rarity,
      content: this.generateEquipment(rarity)
    };
  }
  
  private generateEquipment(rarity: Treasure['rarity']): Equipment {
    // Generate equipment based on rarity
    const types = ['weapon', 'armor', 'accessory'] as const;
    const type = types[Math.floor(Math.random() * types.length)];
    
    // Scale stats based on rarity
    const rarityMultiplier = 
      rarity === 'legendary' ? 3 :
      rarity === 'epic' ? 2 :
      rarity === 'rare' ? 1.5 : 1;
    
    return {
      id: `equip-${Date.now()}-${Math.random()}`,
      name: `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${type}`,
      type,
      rarity,
      stats: {
        strength: Math.floor(Math.random() * 5 * rarityMultiplier),
        agility: Math.floor(Math.random() * 5 * rarityMultiplier),
        vitality: Math.floor(Math.random() * 5 * rarityMultiplier),
        wisdom: Math.floor(Math.random() * 5 * rarityMultiplier),
        criticalChance: type === 'weapon' ? Math.random() * 0.05 * rarityMultiplier : 0,
        criticalDamage: type === 'weapon' ? 0.1 * rarityMultiplier : 0
      }
    };
  }

  private generateBoss(bossRoom: Room): Enemy {
    const position = this.findValidSpawnLocation(bossRoom);
    
    return {
      id: `boss-${Date.now()}`,
      type: 'Boss',
      health: 1000,
      maxHealth: 1000,
      position,
      damage: 50,
      experience: 500,
      abilities: [{
        id: 'boss-slam',
        name: 'Ground Slam',
        description: 'A powerful slam that damages all nearby enemies',
        damage: 30,
        cooldown: 5,
        isReady: true,
        type: 'attack',
        effects: [{
          type: 'damage',
          value: 30,
          radius: 5
        }],
        animation: 'slam',
        soundEffect: 'hit',
        particleEffect: 'shockwave'
      }],
      behavior: {
        type: 'boss',
        detectionRange: 20,
        attackRange: 5,
        movementSpeed: 3,
        attackSpeed: 2,
        patterns: [{
          name: 'slam',
          damage: 30,
          range: 5,
          cooldown: 5,
          animation: 'slam',
          particleEffect: 'shockwave'
        }]
      },
      dropTable: {
        equipment: [{
          item: this.generateEquipment('legendary'),
          chance: 1.0
        }],
        resources: []
      }
    };
  }
}
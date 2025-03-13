import { createNoise2D } from 'simplex-noise';
// Removed unused THREE import
import { Level, Room, Enemy, Treasure, Equipment, Vector3, Ability } from '../types/game';

// Room themes
export type RoomTheme = 'castle' | 'dungeon' | 'forest' | 'void';

// Room templates
export type RoomTemplate = 
  'standard' | 'circular' | 'cross' | 'corridorN' | 'corridorE' | 
  'chambers' | 'hub' | 'boss-arena' | 'treasure-vault' | 'shop';

// Advanced options for level generation 
export interface LevelGenerationOptions {
  difficulty: number;
  roomCount: number;
  seed: string;
  mainPath: number; // Number of rooms on the critical path
  branchingFactor: number; // 0-1, how much branching (0 = linear, 1 = very branchy)
  themes: RoomTheme[];
  forcedRooms?: { template: RoomTemplate; type: Room['type']; position?: number }[];
  specialRoomChance: {
    treasure: number;
    elite: number;
    shop: number;
  };
  rewards: {
    commonChance: number;
    rareChance: number;
    epicChance: number;
    legendaryChance: number;
  };
}

export class EnhancedLevelGenerator {
  // Noise generators for procedural generation
  private noise2D: ReturnType<typeof createNoise2D>;
  // private noise3D: ReturnType<typeof createNoise3D>; // Removed unused noise3D
  private seed: string;
  // Initialize with a default function that gets properly set in setupRNG
  private random: () => number = () => Math.random();
  
  // Generation options
  private options: LevelGenerationOptions;
  
  // Tracking generated rooms
  private roomIndex: number = 0;
  
  constructor(options: Partial<LevelGenerationOptions> = {}) {
    // Set default options
    this.options = {
      difficulty: 1,
      roomCount: 10,
      seed: Date.now().toString(),
      mainPath: 7,
      branchingFactor: 0.4,
      themes: ['castle'],
      specialRoomChance: {
        treasure: 0.25,
        elite: 0.2,
        shop: 0.15
      },
      rewards: {
        commonChance: 0.7,
        rareChance: 0.2,
        epicChance: 0.08,
        legendaryChance: 0.02
      },
      ...options
    };
    
    // Set up random number generator with seed
    this.seed = this.options.seed;
    this.setupRNG(this.seed);
    
    // Initialize noise generator
    this.noise2D = createNoise2D(() => this.random());
  }
  
  /**
   * Set up a seeded random number generator
   */
  private setupRNG(seed: string): void {
    // Simple seeded RNG
    let s = this.hashString(seed);
    
    this.random = () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }
  
  /**
   * Simple string hash function for seeding
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
  
  /**
   * Generate a complete level
   */
  generateLevel(): Level {
    // Reset room index
    this.roomIndex = 0;
    
    // Select primary theme for this level
    const primaryTheme = this.options.themes[Math.floor(this.random() * this.options.themes.length)];
    
    // Generate the rooms
    const rooms = this.generateRooms();
    
    // Connect the rooms
    this.connectRooms(rooms);
    
    // Populate rooms with enemies, treasures, etc.
    const enemies = this.populateEnemies(rooms);
    const treasures = this.placeTreasures(rooms);
    const boss = this.generateBoss(rooms.find(room => room.type === 'boss')!);
    
    return {
      id: `level-${this.seed}`,
      difficulty: this.options.difficulty,
      theme: primaryTheme,
      rooms,
      enemies,
      treasures,
      boss
    };
  }
  
  /**
   * Generate all rooms for the level
   */
  private generateRooms(): Room[] {
    const rooms: Room[] = [];
    const mainPathLength = Math.min(this.options.mainPath, this.options.roomCount);
    
    // Calculate room distribution
    // Calculate total normal rooms needed
    const totalRooms = this.options.roomCount 
      - 1 // Entrance
      - 1 // Boss
      - Math.floor(this.options.roomCount * this.options.specialRoomChance.elite)
      - Math.floor(this.options.roomCount * this.options.specialRoomChance.treasure)
      - Math.floor(this.options.roomCount * this.options.specialRoomChance.shop);
    
    // Calculate rooms per branch to distribute totalRooms evenly
    const roomsPerBranch = Math.ceil(totalRooms / (mainPathLength - 2));
    
    // Generate entrance room
    const entranceRoom = this.generateRoom('normal', 'standard');
    entranceRoom.isEntrance = true;
    rooms.push(entranceRoom);
    
    // Generate main path rooms (leading to boss)
    for (let i = 1; i < mainPathLength - 1; i++) {
      // Distribute rooms based on calculated rooms per branch
      const branchRooms = i < mainPathLength - 2 ? roomsPerBranch : totalRooms - (i - 1) * roomsPerBranch;
      let roomType: Room['type'] = 'normal';
      let template: RoomTemplate = 'standard';
      
      // Adjust special room probabilities based on remaining rooms in branch
      const specialRoomMultiplier = branchRooms > 0 ? 1 / branchRooms : 1;
      
      // Check if there's a forced room at this position
      const forcedRoom = this.options.forcedRooms?.find(room => room.position === i);
      
      if (forcedRoom) {
        roomType = forcedRoom.type;
        template = forcedRoom.template;
      } else {
        // Determine room type based on position and randomness
        const normalizedPosition = i / (mainPathLength - 1); // 0 to 1
        
        // More challenging rooms later in the path
        const eliteChance = this.options.specialRoomChance.elite 
          * (0.5 + normalizedPosition * 1.5) // More elites later
          * (1 + this.options.difficulty * 0.2) // More elites at higher difficulty
          * specialRoomMultiplier; // Adjust based on remaining rooms
          
        if (this.random() < eliteChance) {
          roomType = 'elite';
          template = this.chooseRoomTemplate('elite');
        } else {
          // For normal rooms, more varied templates
          template = this.chooseRoomTemplate('normal');
        }
      }
      
      const room = this.generateRoom(roomType, template);
      rooms.push(room);
    }
    
    // Generate boss room at end of main path
    const bossRoom = this.generateRoom('boss', 'boss-arena');
    rooms.push(bossRoom);
    
    // Generate branch rooms (optional paths)
    const remainingRooms = this.options.roomCount - rooms.length;
    if (remainingRooms > 0) {
      // Prioritize adding specific room types first
      const treasureRoomCount = Math.floor(this.options.roomCount * this.options.specialRoomChance.treasure);
      const shopRoomCount = Math.floor(this.options.roomCount * this.options.specialRoomChance.shop);
      
      // Create treasure rooms
      for (let i = 0; i < treasureRoomCount && rooms.length < this.options.roomCount; i++) {
        const treasureRoom = this.generateRoom('treasure', 'treasure-vault');
        rooms.push(treasureRoom);
      }
      
      // Create shop rooms
      for (let i = 0; i < shopRoomCount && rooms.length < this.options.roomCount; i++) {
        const shopRoom = this.generateRoom('normal', 'shop'); // Using 'normal' type for game compatibility
        rooms.push(shopRoom);
      }
      
      // Fill any remaining slots with normal rooms
      while (rooms.length < this.options.roomCount) {
        const room = this.generateRoom('normal', this.chooseRoomTemplate('normal'));
        rooms.push(room);
      }
    }
    
    return rooms;
  }
  
  /**
   * Generate a single room
   */
  private generateRoom(type: Room['type'], template: RoomTemplate): Room {
    // Determine room size based on template and type
    let width = 20, height = 20;
    
    switch (template) {
      case 'standard':
        width = 20 + Math.floor(this.random() * 10);
        height = 20 + Math.floor(this.random() * 10);
        break;
      case 'circular':
        // Circular rooms are usually more square
        width = 25 + Math.floor(this.random() * 10);
        height = width;
        break;
      case 'corridorN':
        width = 15 + Math.floor(this.random() * 5);
        height = 30 + Math.floor(this.random() * 10);
        break;
      case 'corridorE':
        width = 30 + Math.floor(this.random() * 10);
        height = 15 + Math.floor(this.random() * 5);
        break;
      case 'cross':
        width = 30 + Math.floor(this.random() * 8);
        height = 30 + Math.floor(this.random() * 8);
        break;
      case 'chambers':
        // Large room with multiple chambers
        width = 35 + Math.floor(this.random() * 10);
        height = 35 + Math.floor(this.random() * 10);
        break;
      case 'hub':
        // Central hub with paths
        width = 40 + Math.floor(this.random() * 10);
        height = 40 + Math.floor(this.random() * 10);
        break;
      case 'boss-arena':
        // Boss rooms are larger
        width = 40 + Math.floor(this.random() * 20);
        height = 40 + Math.floor(this.random() * 20);
        break;
      case 'treasure-vault':
        // Treasure rooms are smaller and more intimate
        width = 15 + Math.floor(this.random() * 10);
        height = 15 + Math.floor(this.random() * 10);
        break;
      case 'shop':
        // Shop rooms are medium size
        width = 20 + Math.floor(this.random() * 8);
        height = 20 + Math.floor(this.random() * 8);
        break;
    }
    
    // Generate room layout
    const layout = this.generateRoomLayout(width, height, template);
    
    // Create room object
    const room: Room = {
      id: `room-${this.roomIndex++}`,
      type,
      size: { width, height },
      layout,
      enemies: [],
      treasures: [],
      connections: [],
      isEntrance: false
    };
    
    return room;
  }
  
  /**
   * Choose an appropriate room template based on room type
   */
  private chooseRoomTemplate(roomType: Room['type']): RoomTemplate {
    // Weights for different templates by room type
    const templateWeights: Record<Room['type'], Record<RoomTemplate, number>> = {
      normal: {
        standard: 1.0,
        circular: 0.7,
        cross: 0.5,
        corridorN: 0.4,
        corridorE: 0.4,
        chambers: 0.3,
        hub: 0.2,
        'boss-arena': 0,
        'treasure-vault': 0,
        shop: 0
      },
      elite: {
        standard: 0.6,
        circular: 0.8,
        cross: 0.7,
        corridorN: 0.3,
        corridorE: 0.3,
        chambers: 0.6,
        hub: 0.5,
        'boss-arena': 0,
        'treasure-vault': 0,
        shop: 0
      },
      treasure: {
        standard: 0.3,
        circular: 0.5,
        cross: 0.2,
        corridorN: 0.1,
        corridorE: 0.1,
        chambers: 0.2,
        hub: 0.1,
        'boss-arena': 0,
        'treasure-vault': 1.0,
        shop: 0
      },
      boss: {
        standard: 0,
        circular: 0,
        cross: 0,
        corridorN: 0,
        corridorE: 0,
        chambers: 0,
        hub: 0,
        'boss-arena': 1.0,
        'treasure-vault': 0,
        shop: 0
      }
    };
    
    // Get weights for the specified room type
    const weights = templateWeights[roomType];
    
    // Create cumulative weights
    const cumulativeWeights: [RoomTemplate, number][] = [];
    let total = 0;
    
    for (const [template, weight] of Object.entries(weights)) {
      if (weight > 0) {
        total += weight;
        cumulativeWeights.push([template as RoomTemplate, total]);
      }
    }
    
    // Select template based on weights
    const roll = this.random() * total;
    for (const [template, cumulative] of cumulativeWeights) {
      if (roll <= cumulative) {
        return template;
      }
    }
    
    // Fallback
    return 'standard';
  }
  
  /**
   * Generate the layout for a room based on template
   */
  private generateRoomLayout(width: number, height: number, template: RoomTemplate): number[][] {
    // Create empty layout filled with walls
    const layout: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
    
    // Apply template-specific generation algorithm
    switch (template) {
      case 'standard':
        this.generateStandardRoom(layout, width, height);
        break;
      case 'circular':
        this.generateCircularRoom(layout, width, height);
        break;
      case 'corridorN':
        this.generateCorridorRoom(layout, width, height, 'N');
        break;
      case 'corridorE':
        this.generateCorridorRoom(layout, width, height, 'E');
        break;
      case 'cross':
        this.generateCrossRoom(layout, width, height);
        break;
      case 'chambers':
        this.generateChambersRoom(layout, width, height);
        break;
      case 'hub':
        this.generateHubRoom(layout, width, height);
        break;
      case 'boss-arena':
        this.generateBossArena(layout, width, height);
        break;
      case 'treasure-vault':
        this.generateTreasureVault(layout, width, height);
        break;
      case 'shop':
        this.generateShopRoom(layout, width, height);
        break;
      default:
        // Default to standard room
        this.generateStandardRoom(layout, width, height);
    }
    
    // Add doors - these are critical for room connections
    this.addDoors(layout, width, height);
    
    // Add environmental details (decorations, obstacles)
    this.addEnvironmentalDetails(layout, width, height, template);
    
    return layout;
  }
  
  /**
   * Generate a standard room layout using noise
   */
  private generateStandardRoom(layout: number[][], width: number, height: number): void {
    // Parameters
    const scale = 0.1;
    const threshold = 0.3; // Higher = more walls
    
    // Create noise-based layout
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Always leave a border
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          layout[y][x] = 0; // Wall
        } else {
          // Use noise to create organic room shape
          const value = this.noise2D(x * scale, y * scale);
          layout[y][x] = value > threshold ? 1 : 0; // 1 = floor, 0 = wall
        }
      }
    }
    
    // Ensure the central area is walkable
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const centralRadius = Math.min(width, height) * 0.25;
    
    for (let y = Math.max(1, centerY - centralRadius); y <= Math.min(height - 2, centerY + centralRadius); y++) {
      for (let x = Math.max(1, centerX - centralRadius); x <= Math.min(width - 2, centerX + centralRadius); x++) {
        layout[y][x] = 1; // Floor
      }
    }
    
    // Add walkable paths from center to edges
    this.addWalkablePaths(layout, width, height);
  }
  
  /**
   * Generate a circular room layout
   */
  private generateCircularRoom(layout: number[][], width: number, height: number): void {
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const maxRadius = Math.min(centerX, centerY) - 1;
    const innerRadius = maxRadius * 0.3; // Optional inner wall for donut shape
    const createDonut = this.random() < 0.4; // 40% chance of donut shape
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Distance from center
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Outer circle
        if (distance < maxRadius) {
          // Optional inner wall for donut shape
          if (createDonut && distance < innerRadius) {
            layout[y][x] = 0; // Wall
          } else {
            layout[y][x] = 1; // Floor
          }
        } else {
          layout[y][x] = 0; // Wall
        }
      }
    }
    
    // If it's a donut, add some passages through the inner wall
    if (createDonut) {
      const passages = 2 + Math.floor(this.random() * 3); // 2-4 passages
      
      for (let i = 0; i < passages; i++) {
        const angle = (i / passages) * Math.PI * 2;
        const px = Math.floor(centerX + Math.cos(angle) * innerRadius);
        const py = Math.floor(centerY + Math.sin(angle) * innerRadius);
        
        // Create a small passage
        for (let y = Math.max(1, py - 1); y <= Math.min(height - 2, py + 1); y++) {
          for (let x = Math.max(1, px - 1); x <= Math.min(width - 2, px + 1); x++) {
            layout[y][x] = 1; // Floor
          }
        }
      }
    }
    
    // Ensure door areas are clear
    this.addDoorAreas(layout, width, height);
  }
  
  /**
   * Generate a corridor-style room (N=North-South, E=East-West)
   */
  private generateCorridorRoom(layout: number[][], width: number, height: number, direction: 'N' | 'E'): void {
    const isNorthSouth = direction === 'N';
    
    // Set corridor parameters
    const corridorWidth = Math.max(5, Math.floor((isNorthSouth ? width : height) * 0.3));
    
    if (isNorthSouth) {
      // North-South corridor
      const corridorStart = Math.floor((width - corridorWidth) / 2);
      const corridorEnd = corridorStart + corridorWidth;
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (x >= corridorStart && x < corridorEnd) {
            layout[y][x] = 1; // Floor
          } else {
            layout[y][x] = 0; // Wall
          }
        }
      }
      
      // Add some side chambers
      const chambers = 1 + Math.floor(this.random() * 3); // 1-3 chambers
      const baseHeight = Math.floor(height / (chambers + 1));
      
      for (let i = 1; i <= chambers; i++) {
        const chamberY = i * baseHeight;
        const chamberSide = this.random() < 0.5 ? 'left' : 'right';
        const sideWidth = 4 + Math.floor(this.random() * 4);
        const sideHeight = 3 + Math.floor(this.random() * 3);
        
        if (chamberSide === 'left') {
          // Left side chamber
          for (let y = Math.max(1, chamberY - Math.floor(sideHeight / 2)); 
               y < Math.min(height - 1, chamberY + Math.floor(sideHeight / 2)); y++) {
            for (let x = Math.max(1, corridorStart - sideWidth); x < corridorStart; x++) {
              layout[y][x] = 1; // Floor
            }
          }
        } else {
          // Right side chamber
          for (let y = Math.max(1, chamberY - Math.floor(sideHeight / 2)); 
               y < Math.min(height - 1, chamberY + Math.floor(sideHeight / 2)); y++) {
            for (let x = corridorEnd; x < Math.min(width - 1, corridorEnd + sideWidth); x++) {
              layout[y][x] = 1; // Floor
            }
          }
        }
      }
    } else {
      // East-West corridor
      const corridorStart = Math.floor((height - corridorWidth) / 2);
      const corridorEnd = corridorStart + corridorWidth;
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (y >= corridorStart && y < corridorEnd) {
            layout[y][x] = 1; // Floor
          } else {
            layout[y][x] = 0; // Wall
          }
        }
      }
      
      // Add some side chambers
      const chambers = 1 + Math.floor(this.random() * 3); // 1-3 chambers
      const baseWidth = Math.floor(width / (chambers + 1));
      
      for (let i = 1; i <= chambers; i++) {
        const chamberX = i * baseWidth;
        const chamberSide = this.random() < 0.5 ? 'top' : 'bottom';
        const chamberWidth = 3 + Math.floor(this.random() * 3);
        const chamberHeight = 4 + Math.floor(this.random() * 4);
        
        if (chamberSide === 'top') {
          // Top side chamber
          for (let y = Math.max(1, corridorStart - chamberHeight); y < corridorStart; y++) {
            for (let x = Math.max(1, chamberX - Math.floor(chamberWidth / 2)); 
                 x < Math.min(width - 1, chamberX + Math.floor(chamberWidth / 2)); x++) {
              layout[y][x] = 1; // Floor
            }
          }
        } else {
          // Bottom side chamber
          for (let y = corridorEnd; y < Math.min(height - 1, corridorEnd + chamberHeight); y++) {
            for (let x = Math.max(1, chamberX - Math.floor(chamberWidth / 2)); 
                 x < Math.min(width - 1, chamberX + Math.floor(chamberWidth / 2)); x++) {
              layout[y][x] = 1; // Floor
            }
          }
        }
      }
    }
    
    // Ensure door areas are clear
    this.addDoorAreas(layout, width, height);
  }
  
  /**
   * Generate a cross-shaped room
   */
  private generateCrossRoom(layout: number[][], width: number, height: number): void {
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    // Set corridor widths
    const horizontalHeight = Math.max(5, Math.floor(height * 0.3));
    const verticalWidth = Math.max(5, Math.floor(width * 0.3));
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Create cross shape with horizontal and vertical corridors
        const inHorizontalCorridor = y >= centerY - Math.floor(horizontalHeight / 2) && 
                                 y < centerY + Math.ceil(horizontalHeight / 2);
                                 
        const inVerticalCorridor = x >= centerX - Math.floor(verticalWidth / 2) && 
                               x < centerX + Math.ceil(verticalWidth / 2);
                               
        if (inHorizontalCorridor || inVerticalCorridor) {
          layout[y][x] = 1; // Floor
        } else {
          layout[y][x] = 0; // Wall
        }
      }
    }
    
    // Ensure walls around the outer edge
    for (let y = 0; y < height; y++) {
      layout[y][0] = 0; // Left wall
      layout[y][width - 1] = 0; // Right wall
    }
    
    for (let x = 0; x < width; x++) {
      layout[0][x] = 0; // Top wall
      layout[height - 1][x] = 0; // Bottom wall
    }
    
    // Ensure door areas are clear
    this.addDoorAreas(layout, width, height);
  }
  
  /**
   * Generate a room with multiple connected chambers
   */
  private generateChambersRoom(layout: number[][], width: number, height: number): void {
    // First, fill with walls
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        layout[y][x] = 0; // Wall
      }
    }
    
    // Parameters for chambers
    const chamberCount = 3 + Math.floor(this.random() * 3); // 3-5 chambers
    const chambers: {x: number, y: number, width: number, height: number}[] = [];
    
    // Create central chamber first
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const centerWidth = Math.floor(width * 0.3);
    const centerHeight = Math.floor(height * 0.3);
    
    chambers.push({
      x: centerX - Math.floor(centerWidth / 2),
      y: centerY - Math.floor(centerHeight / 2),
      width: centerWidth,
      height: centerHeight
    });
    
    // Create surrounding chambers
    for (let i = 1; i < chamberCount; i++) {
      // Choose a random existing chamber to connect to
      const connectTo = chambers[Math.floor(this.random() * chambers.length)];
      
      // Decide where to place the new chamber (adjacent to existing chamber)
      const side = Math.floor(this.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
      const newWidth = 5 + Math.floor(this.random() * 10);
      const newHeight = 5 + Math.floor(this.random() * 10);
      let newX, newY;
      
      switch (side) {
        case 0: // Top
          newX = connectTo.x + Math.floor(this.random() * (connectTo.width - 3));
          newY = Math.max(1, connectTo.y - newHeight);
          break;
        case 1: // Right
          newX = connectTo.x + connectTo.width;
          newY = connectTo.y + Math.floor(this.random() * (connectTo.height - 3));
          break;
        case 2: // Bottom
          newX = connectTo.x + Math.floor(this.random() * (connectTo.width - 3));
          newY = connectTo.y + connectTo.height;
          break;
        case 3: // Left
          newX = Math.max(1, connectTo.x - newWidth);
          newY = connectTo.y + Math.floor(this.random() * (connectTo.height - 3));
          break;
        default:
          newX = connectTo.x;
          newY = connectTo.y;
      }
      
      // Ensure the chamber fits within the room bounds
      newX = Math.max(1, Math.min(width - newWidth - 1, newX));
      newY = Math.max(1, Math.min(height - newHeight - 1, newY));
      
      // Create the chamber
      chambers.push({
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      });
    }
    
    // Carve out the chambers
    chambers.forEach(chamber => {
      for (let y = chamber.y; y < chamber.y + chamber.height; y++) {
        for (let x = chamber.x; x < chamber.x + chamber.width; x++) {
          if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
            layout[y][x] = 1; // Floor
          }
        }
      }
    });
    
    // Connect the chambers with passages
    for (let i = 1; i < chambers.length; i++) {
      const chamber = chambers[i];
      
      // Find closest chamber among those already connected (0 to i-1)
      let minDistance = Infinity;
      let closestIndex = 0;
      
      for (let j = 0; j < i; j++) {
        const otherChamber = chambers[j];
        const dx = chamber.x + chamber.width/2 - (otherChamber.x + otherChamber.width/2);
        const dy = chamber.y + chamber.height/2 - (otherChamber.y + otherChamber.height/2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = j;
        }
      }
      
      // Connect this chamber to the closest one
      const otherChamber = chambers[closestIndex];
      
      // Get center points
      const x1 = chamber.x + Math.floor(chamber.width / 2);
      const y1 = chamber.y + Math.floor(chamber.height / 2);
      const x2 = otherChamber.x + Math.floor(otherChamber.width / 2);
      const y2 = otherChamber.y + Math.floor(otherChamber.height / 2);
      
      // Create L-shaped corridor between chambers
      const corridorWidth = 2 + Math.floor(this.random() * 2);
      const bendPoint = this.random() < 0.5 ? [x1, y2] : [x2, y1];
      
      // Horizontal segment
      const x_start = Math.min(x1, bendPoint[0]);
      const x_end = Math.max(x1, bendPoint[0]);
      
      for (let x = x_start; x <= x_end; x++) {
        for (let y = y1 - Math.floor(corridorWidth / 2); y <= y1 + Math.floor(corridorWidth / 2); y++) {
          if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
            layout[y][x] = 1; // Floor
          }
        }
      }
      
      // Vertical segment
      const y_start = Math.min(bendPoint[1], y2);
      const y_end = Math.max(bendPoint[1], y2);
      
      for (let y = y_start; y <= y_end; y++) {
        for (let x = bendPoint[0] - Math.floor(corridorWidth / 2); x <= bendPoint[0] + Math.floor(corridorWidth / 2); x++) {
          if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
            layout[y][x] = 1; // Floor
          }
        }
      }
    }
    
    // Ensure door areas are clear
    this.addDoorAreas(layout, width, height);
  }
  
  /**
   * Generate a hub room with paths radiating from center
   */
  private generateHubRoom(layout: number[][], width: number, height: number): void {
    // First, fill with walls
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        layout[y][x] = 0; // Wall
      }
    }
    
    // Create central hub
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const hubRadius = Math.min(Math.floor(width * 0.2), Math.floor(height * 0.2));
    
    for (let y = centerY - hubRadius; y <= centerY + hubRadius; y++) {
      for (let x = centerX - hubRadius; x <= centerX + hubRadius; x++) {
        if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
          const dx = x - centerX;
          const dy = y - centerY;
          const distSquared = dx * dx + dy * dy;
          
          if (distSquared <= hubRadius * hubRadius) {
            layout[y][x] = 1; // Floor
          }
        }
      }
    }
    
    // Create radiating paths
    const pathCount = 3 + Math.floor(this.random() * 3); // 3-5 paths
    
    for (let i = 0; i < pathCount; i++) {
      const angle = (i / pathCount) * Math.PI * 2;
      const pathLength = Math.min(
        Math.floor(width * 0.5), 
        Math.floor(height * 0.5)
      );
      const pathWidth = 3 + Math.floor(this.random() * 3);
      
      // Calculate end point
      const endX = centerX + Math.floor(Math.cos(angle) * pathLength);
      const endY = centerY + Math.floor(Math.sin(angle) * pathLength);
      
      // Check if end point is within room bounds (with margin)
      if (endX < 2 || endX >= width - 2 || endY < 2 || endY >= height - 2) {
        continue;
      }
      
      // Create path
      const steps = Math.max(Math.abs(endX - centerX), Math.abs(endY - centerY));
      
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const pathX = Math.floor(centerX + (endX - centerX) * t);
        const pathY = Math.floor(centerY + (endY - centerY) * t);
        
        // Create path width
        for (let w = -Math.floor(pathWidth / 2); w <= Math.floor(pathWidth / 2); w++) {
          // Calculate perpendicular offset
          const offsetX = Math.floor(-Math.sin(angle) * w);
          const offsetY = Math.floor(Math.cos(angle) * w);
          
          const x = pathX + offsetX;
          const y = pathY + offsetY;
          
          if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
            layout[y][x] = 1; // Floor
          }
        }
      }
      
      // Add chamber at the end of the path
      const chamberRadius = 3 + Math.floor(this.random() * 3);
      
      for (let y = endY - chamberRadius; y <= endY + chamberRadius; y++) {
        for (let x = endX - chamberRadius; x <= endX + chamberRadius; x++) {
          if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
            const dx = x - endX;
            const dy = y - endY;
            const distSquared = dx * dx + dy * dy;
            
            if (distSquared <= chamberRadius * chamberRadius) {
              layout[y][x] = 1; // Floor
            }
          }
        }
      }
    }
    
    // Ensure door areas are clear
    this.addDoorAreas(layout, width, height);
  }
  
  /**
   * Generate a boss arena with a large central area and possibly obstacles
   */
  private generateBossArena(layout: number[][], width: number, height: number): void {
    // First, create a large circular or rectangular arena
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const isCircular = this.random() < 0.7; // 70% chance of circular arena
    
    if (isCircular) {
      // Circular arena
      const radius = Math.min(Math.floor(width * 0.4), Math.floor(height * 0.4));
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const distSquared = dx * dx + dy * dy;
          
          if (distSquared <= radius * radius) {
            layout[y][x] = 1; // Floor
          } else {
            layout[y][x] = 0; // Wall
          }
        }
      }
    } else {
      // Rectangular arena
      const arenaWidth = Math.floor(width * 0.8);
      const arenaHeight = Math.floor(height * 0.8);
      const startX = centerX - Math.floor(arenaWidth / 2);
      const startY = centerY - Math.floor(arenaHeight / 2);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (y >= startY && y < startY + arenaHeight && x >= startX && x < startX + arenaWidth) {
            layout[y][x] = 1; // Floor
          } else {
            layout[y][x] = 0; // Wall
          }
        }
      }
    }
    
    // Add obstacles for cover and interest
    const addObstacles = this.random() < 0.7; // 70% chance of having obstacles
    
    if (addObstacles) {
      const obstacleCount = 3 + Math.floor(this.random() * 5); // 3-7 obstacles
      
      for (let i = 0; i < obstacleCount; i++) {
        // Determine obstacle type and size
        const isColumn = this.random() < 0.6; // 60% chance of column vs. wall
        
        if (isColumn) {
          // Column obstacle
          const obstacleRadius = 1 + Math.floor(this.random() * 2);
          
          // Random position, but not too close to center or edges
          const minDist = Math.min(Math.floor(width * 0.15), Math.floor(height * 0.15));
          const maxDist = Math.min(Math.floor(width * 0.4), Math.floor(height * 0.4));
          
          // Get random angle and distance from center
          const angle = this.random() * Math.PI * 2;
          const distance = minDist + this.random() * (maxDist - minDist);
          
          const obstacleX = centerX + Math.floor(Math.cos(angle) * distance);
          const obstacleY = centerY + Math.floor(Math.sin(angle) * distance);
          
          // Create column
          for (let y = obstacleY - obstacleRadius; y <= obstacleY + obstacleRadius; y++) {
            for (let x = obstacleX - obstacleRadius; x <= obstacleX + obstacleRadius; x++) {
              if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
                const dx = x - obstacleX;
                const dy = y - obstacleY;
                const distSquared = dx * dx + dy * dy;
                
                if (distSquared <= obstacleRadius * obstacleRadius) {
                  layout[y][x] = 0; // Wall (obstacle)
                }
              }
            }
          }
        } else {
          // Wall obstacle
          const wallLength = 4 + Math.floor(this.random() * 8);
          const wallWidth = 1 + Math.floor(this.random() * 2);
          
          // Random position and orientation
          const angle = this.random() * Math.PI * 2;
          const distance = Math.min(Math.floor(width * 0.3), Math.floor(height * 0.3));
          
          const wallCenterX = centerX + Math.floor(Math.cos(angle) * distance);
          const wallCenterY = centerY + Math.floor(Math.sin(angle) * distance);
          
          // Create wall along a random orientation
          const wallAngle = this.random() * Math.PI * 2;
          
          for (let step = -Math.floor(wallLength / 2); step <= Math.floor(wallLength / 2); step++) {
            const wallX = wallCenterX + Math.floor(Math.cos(wallAngle) * step);
            const wallY = wallCenterY + Math.floor(Math.sin(wallAngle) * step);
            
            // Create wall width
            for (let w = -Math.floor(wallWidth / 2); w <= Math.floor(wallWidth / 2); w++) {
              // Calculate perpendicular offset
              const offsetX = Math.floor(-Math.sin(wallAngle) * w);
              const offsetY = Math.floor(Math.cos(wallAngle) * w);
              
              const x = wallX + offsetX;
              const y = wallY + offsetY;
              
              if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
                layout[y][x] = 0; // Wall (obstacle)
              }
            }
          }
        }
      }
    }
    
    // Add a special platform in the center for the boss
    const platformRadius = 2 + Math.floor(this.random() * 3);
    
    for (let y = centerY - platformRadius; y <= centerY + platformRadius; y++) {
      for (let x = centerX - platformRadius; x <= centerX + platformRadius; x++) {
        if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
          // Set a marker for a boss platform (2 = elevated platform)
          // In a full implementation, this would be interpreted by the renderer
          layout[y][x] = 2;
        }
      }
    }
    
    // Ensure door areas are clear
    this.addDoorAreas(layout, width, height);
    
    // Make sure there's a clear path from doors to center
    this.addWalkablePaths(layout, width, height);
  }
  
  /**
   * Generate a treasure vault room
   */
  private generateTreasureVault(layout: number[][], width: number, height: number): void {
    // Treasure rooms tend to be more regular and protected
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    // Choose between a few treasure vault layouts
    const vaultType = Math.floor(this.random() * 3); // 0, 1, or 2
    
    switch (vaultType) {
      case 0: // Circular vault
        // Create circular room
        const radius = Math.min(Math.floor(width * 0.4), Math.floor(height * 0.4));
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distSquared = dx * dx + dy * dy;
            
            if (distSquared <= radius * radius) {
              layout[y][x] = 1; // Floor
            } else {
              layout[y][x] = 0; // Wall
            }
          }
        }
        
        // Add pedestals for treasures
        const pedestalCount = 1 + Math.floor(this.random() * 3); // 1-3 pedestals
        
        for (let i = 0; i < pedestalCount; i++) {
          const angle = (i / pedestalCount) * Math.PI * 2;
          const distance = radius * 0.5; // Pedestals positioned closer to center
          
          const pedestalX = centerX + Math.floor(Math.cos(angle) * distance);
          const pedestalY = centerY + Math.floor(Math.sin(angle) * distance);
          
          // Mark pedestal location (3 = pedestal)
          // In a full implementation, this would be interpreted by the renderer
          layout[pedestalY][pedestalX] = 3;
        }
        break;
        
      case 1: // Rectangular vault with columns
        // Create rectangular room
        const padding = 2;
        
        for (let y = padding; y < height - padding; y++) {
          for (let x = padding; x < width - padding; x++) {
            layout[y][x] = 1; // Floor
          }
        }
        
        // Add columns around perimeter
        const columnSpacing = 4; // Spacing between columns
        
        // Add corners
        layout[padding][padding] = 0; // Top-left
        layout[padding][width - padding - 1] = 0; // Top-right
        layout[height - padding - 1][padding] = 0; // Bottom-left
        layout[height - padding - 1][width - padding - 1] = 0; // Bottom-right
        
        // Add columns along top and bottom
        for (let x = padding + columnSpacing; x < width - padding - 1; x += columnSpacing) {
          layout[padding][x] = 0; // Top wall
          layout[height - padding - 1][x] = 0; // Bottom wall
        }
        
        // Add columns along left and right
        for (let y = padding + columnSpacing; y < height - padding - 1; y += columnSpacing) {
          layout[y][padding] = 0; // Left wall
          layout[y][width - padding - 1] = 0; // Right wall
        }
        
        // Add central treasure pedestal
        layout[centerY][centerX] = 3; // Pedestal marker
        break;
        
      case 2: // Partitioned vault
        // First, fill with floor
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            layout[y][x] = 1; // Floor
          }
        }
        
        // Add outer walls
        for (let y = 0; y < height; y++) {
          layout[y][0] = 0; // Left wall
          layout[y][width - 1] = 0; // Right wall
        }
        
        for (let x = 0; x < width; x++) {
          layout[0][x] = 0; // Top wall
          layout[height - 1][x] = 0; // Bottom wall
        }
        
        // Create partitions
        const partitionCount = 1 + Math.floor(this.random() * 2); // 1-2 partitions
        
        for (let i = 0; i < partitionCount; i++) {
          const isHorizontal = this.random() < 0.5;
          
          if (isHorizontal) {
            // Horizontal partition
            const partitionY = Math.floor(height * (0.3 + this.random() * 0.4)); // 30-70% of height
            
            for (let x = 1; x < width - 1; x++) {
              layout[partitionY][x] = 0; // Wall
            }
            
            // Add door in partition
            const doorX = Math.floor(width * (0.3 + this.random() * 0.4)); // 30-70% of width
            layout[partitionY][doorX] = 1; // Door (floor)
          } else {
            // Vertical partition
            const partitionX = Math.floor(width * (0.3 + this.random() * 0.4)); // 30-70% of width
            
            for (let y = 1; y < height - 1; y++) {
              layout[y][partitionX] = 0; // Wall
            }
            
            // Add door in partition
            const doorY = Math.floor(height * (0.3 + this.random() * 0.4)); // 30-70% of height
            layout[doorY][partitionX] = 1; // Door (floor)
          }
        }
        
        // Add treasure pedestals in different chambers
        const chambers = partitionCount + 1;
        
        for (let i = 0; i < chambers; i++) {
          // Random position in each chamber (simplified)
          const chamberX = Math.floor(width * (0.2 + this.random() * 0.6)); // 20-80% of width
          const chamberY = Math.floor(height * (0.2 + this.random() * 0.6)); // 20-80% of height
          
          // Ensure position is on floor
          if (layout[chamberY][chamberX] === 1) {
            layout[chamberY][chamberX] = 3; // Pedestal marker
          }
        }
        break;
    }
    
    // Ensure door areas are clear
    this.addDoorAreas(layout, width, height);
  }
  
  /**
   * Generate a shop room
   */
  private generateShopRoom(layout: number[][], width: number, height: number): void {
    // Shop rooms are typically more organized and rectangular
    const padding = 2;
    
    // Create rectangular room
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y < padding || y >= height - padding || x < padding || x >= width - padding) {
          layout[y][x] = 0; // Wall
        } else {
          layout[y][x] = 1; // Floor
        }
      }
    }
    
    // Add shop counters (walls that separate shopkeeper from customer)
    const hasCounter = this.random() < 0.8; // 80% chance of having a counter
    
    if (hasCounter) {
      // Choose counter position: top, bottom, left, or right
      const counterPosition = Math.floor(this.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
      let counterX1, counterY1, counterX2, counterY2;
      
      switch (counterPosition) {
        case 0: // Top
          counterY1 = counterY2 = Math.floor(height * 0.3);
          counterX1 = Math.floor(width * 0.3);
          counterX2 = Math.floor(width * 0.7);
          
          // Add counters (mark as wall)
          for (let x = counterX1; x <= counterX2; x++) {
            layout[counterY1][x] = 0; // Wall
          }
          
          // Add counter opening
          const openingPos = Math.floor(counterX1 + (counterX2 - counterX1) * 0.5);
          layout[counterY1][openingPos] = 1; // Floor (opening)
          
          // Mark shop items (4 = shop item)
          for (let y = padding; y < counterY1; y += 2) {
            for (let x = padding + 2; x < width - padding - 2; x += 4) {
              layout[y][x] = 4; // Shop item marker
            }
          }
          break;
          
        case 1: // Right
          counterX1 = counterX2 = Math.floor(width * 0.7);
          counterY1 = Math.floor(height * 0.3);
          counterY2 = Math.floor(height * 0.7);
          
          // Add counters
          for (let y = counterY1; y <= counterY2; y++) {
            layout[y][counterX1] = 0; // Wall
          }
          
          // Add counter opening
          const openingY = Math.floor(counterY1 + (counterY2 - counterY1) * 0.5);
          layout[openingY][counterX1] = 1; // Floor (opening)
          
          // Mark shop items
          for (let y = padding + 2; y < height - padding - 2; y += 4) {
            for (let x = counterX1 + 1; x < width - padding; x += 2) {
              layout[y][x] = 4; // Shop item marker
            }
          }
          break;
          
        case 2: // Bottom
          counterY1 = counterY2 = Math.floor(height * 0.7);
          counterX1 = Math.floor(width * 0.3);
          counterX2 = Math.floor(width * 0.7);
          
          // Add counters
          for (let x = counterX1; x <= counterX2; x++) {
            layout[counterY1][x] = 0; // Wall
          }
          
          // Add counter opening
          const openingX = Math.floor(counterX1 + (counterX2 - counterX1) * 0.5);
          layout[counterY1][openingX] = 1; // Floor (opening)
          
          // Mark shop items
          for (let y = counterY1 + 1; y < height - padding; y += 2) {
            for (let x = padding + 2; x < width - padding - 2; x += 4) {
              layout[y][x] = 4; // Shop item marker
            }
          }
          break;
          
        case 3: // Left
          counterX1 = counterX2 = Math.floor(width * 0.3);
          counterY1 = Math.floor(height * 0.3);
          counterY2 = Math.floor(height * 0.7);
          
          // Add counters
          for (let y = counterY1; y <= counterY2; y++) {
            layout[y][counterX1] = 0; // Wall
          }
          
          // Add counter opening
          const openingYPos = Math.floor(counterY1 + (counterY2 - counterY1) * 0.5);
          layout[openingYPos][counterX1] = 1; // Floor (opening)
          
          // Mark shop items
          for (let y = padding + 2; y < height - padding - 2; y += 4) {
            for (let x = padding; x < counterX1; x += 2) {
              layout[y][x] = 4; // Shop item marker
            }
          }
          break;
      }
    } else {
      // No counter, just place shop items around the edges
      
      // Top edge
      for (let x = Math.floor(width * 0.25); x <= Math.floor(width * 0.75); x += 3) {
        layout[padding][x] = 4; // Shop item marker
      }
      
      // Bottom edge
      for (let x = Math.floor(width * 0.25); x <= Math.floor(width * 0.75); x += 3) {
        layout[height - padding - 1][x] = 4; // Shop item marker
      }
      
      // Left edge
      for (let y = Math.floor(height * 0.25); y <= Math.floor(height * 0.75); y += 3) {
        layout[y][padding] = 4; // Shop item marker
      }
      
      // Right edge
      for (let y = Math.floor(height * 0.25); y <= Math.floor(height * 0.75); y += 3) {
        layout[y][width - padding - 1] = 4; // Shop item marker
      }
    }
    
    // Ensure door areas are clear
    this.addDoorAreas(layout, width, height);
  }
  
  /**
   * Ensure the door areas are clear for room connections
   */
  private addDoorAreas(layout: number[][], width: number, height: number): void {
    // North door (top)
    const northX = Math.floor(width / 2);
    for (let y = 0; y < 2; y++) {
      for (let x = northX - 1; x <= northX + 1; x++) {
        if (x > 0 && x < width - 1) {
          layout[y][x] = 1; // Floor
        }
      }
    }
    
    // South door (bottom)
    const southX = Math.floor(width / 2);
    for (let y = height - 2; y < height; y++) {
      for (let x = southX - 1; x <= southX + 1; x++) {
        if (x > 0 && x < width - 1) {
          layout[y][x] = 1; // Floor
        }
      }
    }
    
    // East door (right)
    const eastY = Math.floor(height / 2);
    for (let x = width - 2; x < width; x++) {
      for (let y = eastY - 1; y <= eastY + 1; y++) {
        if (y > 0 && y < height - 1) {
          layout[y][x] = 1; // Floor
        }
      }
    }
    
    // West door (left)
    const westY = Math.floor(height / 2);
    for (let x = 0; x < 2; x++) {
      for (let y = westY - 1; y <= westY + 1; y++) {
        if (y > 0 && y < height - 1) {
          layout[y][x] = 1; // Floor
        }
      }
    }
  }
  
  /**
   * Add walkable paths from center to edges
   */
  private addWalkablePaths(layout: number[][], width: number, height: number): void {
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    // Create paths from center to each door
    // North door
    for (let y = 1; y <= centerY; y++) {
      for (let x = centerX - 1; x <= centerX + 1; x++) {
        layout[y][x] = 1; // Floor
      }
    }
    
    // South door
    for (let y = centerY; y < height - 1; y++) {
      for (let x = centerX - 1; x <= centerX + 1; x++) {
        layout[y][x] = 1; // Floor
      }
    }
    
    // East door
    for (let x = centerX; x < width - 1; x++) {
      for (let y = centerY - 1; y <= centerY + 1; y++) {
        layout[y][x] = 1; // Floor
      }
    }
    
    // West door
    for (let x = 1; x <= centerX; x++) {
      for (let y = centerY - 1; y <= centerY + 1; y++) {
        layout[y][x] = 1; // Floor
      }
    }
  }
  
  /**
   * Add doors to room layout
   */
  private addDoors(layout: number[][], width: number, height: number): void {
    // Mark door positions (5 = door)
    // North door
    layout[0][Math.floor(width / 2)] = 5;
    
    // South door
    layout[height - 1][Math.floor(width / 2)] = 5;
    
    // East door
    layout[Math.floor(height / 2)][width - 1] = 5;
    
    // West door
    layout[Math.floor(height / 2)][0] = 5;
  }
  
  /**
   * Add environmental details to room
   */
  private addEnvironmentalDetails(layout: number[][], width: number, height: number, template: RoomTemplate): void {
    // Add special elements based on room template
    switch (template) {
      case 'boss-arena':
        // Add traps or hazards
        this.addHazards(layout, width, height, 8);
        break;
      case 'treasure-vault':
        // Add decorative elements
        this.addDecorations(layout, width, height, 5);
        break;
      case 'shop':
        // Shop already has markers
        break;
      default:
        // Add some decorations and hazards
        if (this.random() < 0.3) {
          this.addHazards(layout, width, height, 3);
        }
        if (this.random() < 0.5) {
          this.addDecorations(layout, width, height, 3);
        }
    }
  }
  
  /**
   * Add hazards to room (traps, spikes, etc.)
   */
  private addHazards(layout: number[][], width: number, height: number, count: number): void {
    for (let i = 0; i < count; i++) {
      // Find random floor tile
      const validPositions: [number, number][] = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (layout[y][x] === 1) {
            // Check that it's not near a door or special marker
            const isNearSpecial = this.checkNearbyTiles(layout, x, y, [3, 4, 5]);
            const isNearCenter = Math.abs(x - width/2) < 3 && Math.abs(y - height/2) < 3;
            
            if (!isNearSpecial && !isNearCenter) {
              validPositions.push([x, y]);
            }
          }
        }
      }
      
      if (validPositions.length > 0) {
        const [x, y] = validPositions[Math.floor(this.random() * validPositions.length)];
        
        // Mark hazard (6 = hazard)
        layout[y][x] = 6;
      }
    }
  }
  
  /**
   * Add decorations to room (statues, plants, etc.)
   */
  private addDecorations(layout: number[][], width: number, height: number, count: number): void {
    for (let i = 0; i < count; i++) {
      // Find random floor tile
      const validPositions: [number, number][] = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (layout[y][x] === 1) {
            // Check that it's not near a door or special marker
            const isNearSpecial = this.checkNearbyTiles(layout, x, y, [3, 4, 5, 6]);
            const isNearCenter = Math.abs(x - width/2) < 3 && Math.abs(y - height/2) < 3;
            
            if (!isNearSpecial && !isNearCenter) {
              validPositions.push([x, y]);
            }
          }
        }
      }
      
      if (validPositions.length > 0) {
        const [x, y] = validPositions[Math.floor(this.random() * validPositions.length)];
        
        // Mark decoration (7 = decoration)
        layout[y][x] = 7;
      }
    }
  }
  
  /**
   * Check if any nearby tiles have specified values
   */
  private checkNearbyTiles(layout: number[][], x: number, y: number, values: number[]): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < layout[0].length && ny >= 0 && ny < layout.length) {
          if (values.includes(layout[ny][nx])) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Connect the rooms in the level
   */
  private connectRooms(rooms: Room[]): void {
    // Special handling for levels with exactly 2 rooms (entrance and boss)
    if (rooms.length === 2) {
      rooms[0].connections.push(rooms[1].id);
      rooms[1].connections.push(rooms[0].id);
      return;
    }
    
    // For levels with more than 2 rooms, create a more complex structure
    
    // Ensure main path first - critical path from entrance to boss
    const entranceRoom = rooms.find(room => room.isEntrance)!;
    const bossRoom = rooms.find(room => room.type === 'boss')!;
    
    // Identify non-entrance, non-boss rooms
    const midRooms = rooms.filter(room => !room.isEntrance && room.type !== 'boss');
    
    // Shuffle midRooms for more randomness
    this.shuffleArray(midRooms);
    
    // Create main path
    const mainPathLength = Math.min(this.options.mainPath, rooms.length - 1);
    const mainPathRooms = [entranceRoom];
    
    // Choose rooms for main path, preferring 'normal' and 'elite' over 'treasure'
    const sortedForMainPath = [...midRooms].sort((a, b) => {
      if (a.type === 'treasure' && b.type !== 'treasure') return 1;
      if (a.type !== 'treasure' && b.type === 'treasure') return -1;
      return 0;
    });
    
    // Add rooms to main path
    const roomsToAdd = Math.min(mainPathLength - 1, sortedForMainPath.length);
    for (let i = 0; i < roomsToAdd; i++) {
      mainPathRooms.push(sortedForMainPath[i]);
    }
    
    // Add boss room at the end
    mainPathRooms.push(bossRoom);
    
    // Connect the rooms on the main path
    for (let i = 0; i < mainPathRooms.length - 1; i++) {
      mainPathRooms[i].connections.push(mainPathRooms[i + 1].id);
      mainPathRooms[i + 1].connections.push(mainPathRooms[i].id);
    }
    
    // Add branch connections - remaining rooms that aren't on the main path
    const unconnectedRooms = rooms.filter(
      room => !mainPathRooms.includes(room) || room === entranceRoom || room === bossRoom
    );
    
    unconnectedRooms.forEach(room => {
      if (room === entranceRoom || room === bossRoom) return; // Skip entrance and boss
      
      // Choose a random room from the main path to connect to
      // Favor connecting to early rooms for treasure rooms
      let connectToIndex: number;
      
      if (room.type === 'treasure') {
        // Connect treasure rooms to earlier part of main path
        connectToIndex = Math.floor(this.random() * Math.ceil(mainPathRooms.length / 2));
      } else {
        connectToIndex = Math.floor(this.random() * mainPathRooms.length);
      }
      
      const connectToRoom = mainPathRooms[connectToIndex];
      
      // Connect the rooms both ways
      room.connections.push(connectToRoom.id);
      connectToRoom.connections.push(room.id);
    });
    
    // Add some additional connections for more path options
    if (this.options.branchingFactor > 0) {
      const maxExtraConnections = Math.floor(rooms.length * this.options.branchingFactor);
      const actualExtraConnections = Math.floor(this.random() * (maxExtraConnections + 1));
      
      for (let i = 0; i < actualExtraConnections; i++) {
        // Choose two different random rooms that aren't already fully connected
        const eligibleRooms = rooms.filter(room => room.connections.length < 4);
        
        if (eligibleRooms.length < 2) break; // Not enough eligible rooms
        
        const randomIndex1 = Math.floor(this.random() * eligibleRooms.length);
        let randomIndex2 = Math.floor(this.random() * eligibleRooms.length);
        
        // Ensure we get two different rooms
        while (randomIndex1 === randomIndex2) {
          randomIndex2 = Math.floor(this.random() * eligibleRooms.length);
        }
        
        const room1 = eligibleRooms[randomIndex1];
        const room2 = eligibleRooms[randomIndex2];
        
        // Check if they're already connected
        if (!room1.connections.includes(room2.id) && !room2.connections.includes(room1.id)) {
          // Connect the rooms
          room1.connections.push(room2.id);
          room2.connections.push(room1.id);
        }
      }
    }
  }
  
  /**
   * Shuffle array in-place
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  /**
   * Populate enemies in the level
   */
  private populateEnemies(rooms: Room[]): Enemy[] {
    const enemies: Enemy[] = [];
    
    rooms.forEach(room => {
      // Skip enemy generation for treasure rooms and entrance
      if (room.type === 'treasure' || room.isEntrance) return;
      
      // Determine number of enemies based on room type and difficulty
      let enemyCount = 0;
      let includeElite = false;
      
      switch (room.type) {
        case 'boss':
          enemyCount = 1; // Just the boss
          break;
        case 'elite':
          enemyCount = 1 + Math.floor(this.options.difficulty * 1.5);
          includeElite = true;
          break;
        default: // normal rooms
          enemyCount = Math.floor(1 + this.options.difficulty);
          includeElite = this.random() < 0.2; // 20% chance of an elite in normal rooms
      }
      
      // Generate enemy positions
      for (let i = 0; i < enemyCount; i++) {
        const position = this.findValidEnemyPosition(room);
        
        // Skip if no valid position found
        if (!position) continue;
        
        // Determine enemy type
        let type: string;
        let behavior: string;
        
        if (room.type === 'boss') {
          type = 'Boss';
          behavior = 'boss';
        } else if (i === 0 && includeElite) {
          type = 'Elite';
          behavior = this.chooseEnemyBehavior('elite');
        } else {
          type = 'Normal';
          behavior = this.chooseEnemyBehavior('normal');
        }
        
        // Set health based on type
        const health = 
          type === 'Boss' ? 1000 :
          type === 'Elite' ? 200 :
          100;
        
        // Create enemy object
        const enemy: Enemy = {
          id: `enemy-${Date.now()}-${Math.random()}`,
          // Ensure type is one of the valid types from the Enemy interface
          type: type as 'Normal' | 'Elite' | 'Boss',
          health,
          maxHealth: health,
          position,
          damage: type === 'Boss' ? 25 : type === 'Elite' ? 15 : 10,
          experience: type === 'Boss' ? 500 : type === 'Elite' ? 100 : 50,
          abilities: [],
          behavior: {
            type: behavior as any,
            detectionRange: 15,
            attackRange: 2,
            movementSpeed: type === 'Elite' ? 4 : 3,
            attackSpeed: type === 'Elite' ? 1.5 : 1,
            patterns: []
          },
          dropTable: { equipment: [], resources: [] }
        };
        
        // Add to enemies array and room
        enemies.push(enemy);
        room.enemies.push(enemy);
      }
    });
    
    return enemies;
  }
  
  /**
   * Choose an enemy behavior type
   */
  private chooseEnemyBehavior(tier: 'normal' | 'elite'): string {
    if (tier === 'elite') {
      const eliteBehaviors = ['elite', 'ranged', 'charger'];
      return eliteBehaviors[Math.floor(this.random() * eliteBehaviors.length)];
    } else {
      const normalBehaviors = ['melee', 'ranged', 'charger', 'bomber', 'summoner'];
      return normalBehaviors[Math.floor(this.random() * normalBehaviors.length)];
    }
  }
  
  /**
   * Find a valid position for an enemy
   */
  private findValidEnemyPosition(room: Room): Vector3 | null {
    // Get room dimensions
    const { width, height } = room.size;
    
    // Try to find a valid position
    const maxAttempts = 50;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = 1 + Math.floor(this.random() * (width - 2));
      const y = 1;
      const z = 1 + Math.floor(this.random() * (height - 2));
      
      // Check if position is valid (floor tile, not near doors)
      if (this.isValidEnemyPosition(room, x, z)) {
        return { x, y, z };
      }
    }
    
    // Fallback - return center position
    return { x: Math.floor(width / 2), y: 1, z: Math.floor(height / 2) };
  }
  
  /**
   * Check if a position is valid for an enemy
   */
  private isValidEnemyPosition(room: Room, x: number, z: number): boolean {
    const { layout, size } = room;
    
    // Check bounds
    if (x < 0 || x >= size.width || z < 0 || z >= size.height) {
      return false;
    }
    
    // Check if position is on a floor tile
    if (layout[z][x] !== 1) {
      return false;
    }
    
    // Check if position is not near a door (at least 3 tiles away)
    const doorPositions = [
      [Math.floor(size.width / 2), 0], // North door
      [Math.floor(size.width / 2), size.height - 1], // South door
      [0, Math.floor(size.height / 2)], // West door
      [size.width - 1, Math.floor(size.height / 2)] // East door
    ];
    
    for (const [doorX, doorZ] of doorPositions) {
      const dx = Math.abs(x - doorX);
      const dz = Math.abs(z - doorZ);
      
      if (dx * dx + dz * dz < 9) { // Distance squared < 3^2
        return false;
      }
    }
    
    // Check if position is not too close to other enemies
    for (const enemy of room.enemies) {
      const dx = Math.abs(x - enemy.position.x);
      const dz = Math.abs(z - enemy.position.z);
      
      if (dx * dx + dz * dz < 9) { // Keep enemies at least 3 tiles apart
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Place treasures in the level
   */
  private placeTreasures(rooms: Room[]): Treasure[] {
    const treasures: Treasure[] = [];
    
    rooms.forEach(room => {
      // Determine how many treasures based on room type
      let treasureCount = 0;
      
      switch (room.type) {
        case 'treasure':
          treasureCount = 1 + Math.floor(this.random() * 2); // 1-2 treasures
          break;
        case 'elite':
          treasureCount = this.random() < 0.7 ? 1 : 0; // 70% chance of 1 treasure
          break;
        case 'boss':
          treasureCount = 1; // Always 1 treasure from boss
          break;
        default:
          treasureCount = this.random() < 0.2 ? 1 : 0; // 20% chance of 1 treasure
      }
      
      // Generate treasures
      for (let i = 0; i < treasureCount; i++) {
        // Determine rarity based on room type and randomness
        const rarityRoll = this.random();
        let rarity: 'common' | 'rare' | 'epic' | 'legendary';
        
        if (room.type === 'boss') {
          // Boss drops are better
          rarity = rarityRoll < 0.5 ? 'epic' : 'legendary';
        } else if (room.type === 'treasure') {
          // Treasure rooms have better loot
          rarity = 
            rarityRoll < this.options.rewards.commonChance ? 'common' :
            rarityRoll < this.options.rewards.commonChance + this.options.rewards.rareChance ? 'rare' :
            rarityRoll < this.options.rewards.commonChance + this.options.rewards.rareChance + this.options.rewards.epicChance ? 'epic' :
            'legendary';
        } else if (room.type === 'elite') {
          // Elite rooms have better loot
          rarity = 
            rarityRoll < this.options.rewards.commonChance / 2 ? 'common' :
            rarityRoll < (this.options.rewards.commonChance / 2) + this.options.rewards.rareChance ? 'rare' :
            rarityRoll < (this.options.rewards.commonChance / 2) + this.options.rewards.rareChance + this.options.rewards.epicChance * 1.5 ? 'epic' :
            'legendary';
        } else {
          // Normal rooms have normal loot distribution
          rarity = 
            rarityRoll < this.options.rewards.commonChance ? 'common' :
            rarityRoll < this.options.rewards.commonChance + this.options.rewards.rareChance ? 'rare' :
            rarityRoll < this.options.rewards.commonChance + this.options.rewards.rareChance + this.options.rewards.epicChance ? 'epic' :
            'legendary';
        }
        
        // Determine treasure type
        const treasureType: 'equipment' | 'resource' | 'ability' = this.random() < 0.7 ? 'equipment' : 'resource';
        
        // Create treasure content
        let content: Equipment | string | Ability;
        
        if (treasureType === 'equipment') {
          content = this.generateEquipment(rarity);
        } else {
          // Resource is just a string describing the resource
          content = `${rarity} resource`;
        }
        
        // Create treasure object
        const treasure: Treasure = {
          id: `treasure-${Date.now()}-${Math.random()}`,
          type: treasureType,
          rarity,
          content
        };
        
        // Add to treasures array and room
        treasures.push(treasure);
        room.treasures.push(treasure);
      }
    });
    
    return treasures;
  }
  
  /**
   * Generate equipment based on rarity
   */
  private generateEquipment(rarity: 'common' | 'rare' | 'epic' | 'legendary'): Equipment {
    // Equipment types
    const types: ('weapon' | 'armor' | 'accessory')[] = ['weapon', 'armor', 'accessory'];
    const type = types[Math.floor(this.random() * types.length)];
    
    // Scale stats based on rarity
    const rarityMultiplier = 
      rarity === 'legendary' ? 3 :
      rarity === 'epic' ? 2 :
      rarity === 'rare' ? 1.5 : 1;
    
    // Generate equipment name
    const name = this.generateEquipmentName(type, rarity);
    
    return {
      id: `equip-${Date.now()}-${Math.random()}`,
      name,
      type,
      rarity,
      stats: {
        strength: Math.floor(this.random() * 5 * rarityMultiplier),
        agility: Math.floor(this.random() * 5 * rarityMultiplier),
        vitality: Math.floor(this.random() * 5 * rarityMultiplier),
        wisdom: Math.floor(this.random() * 5 * rarityMultiplier),
        criticalChance: type === 'weapon' ? this.random() * 0.05 * rarityMultiplier : 0,
        criticalDamage: type === 'weapon' ? 0.1 * rarityMultiplier : 0
      }
    };
  }
  
  /**
   * Generate a name for equipment
   */
  private generateEquipmentName(type: string, rarity: string): string {
    // Prefixes based on rarity
    const prefixes: Record<string, string[]> = {
      common: ['Basic', 'Simple', 'Sturdy', 'Plain'],
      rare: ['Quality', 'Enhanced', 'Superior', 'Fine'],
      epic: ['Exquisite', 'Magnificent', 'Radiant', 'Mighty'],
      legendary: ['Legendary', 'Ancient', 'Divine', 'Mythical']
    };
    
    // Items based on type
    const items: Record<string, string[]> = {
      weapon: ['Sword', 'Axe', 'Spear', 'Dagger', 'Hammer', 'Staff'],
      armor: ['Armor', 'Breastplate', 'Helmet', 'Gauntlets', 'Boots', 'Shield'],
      accessory: ['Ring', 'Amulet', 'Charm', 'Talisman', 'Bracelet', 'Belt']
    };
    
    // Suffixes (optional)
    const suffixes: string[] = [
      'of Power', 'of Might', 'of the Titan', 'of the Whale',
      'of the Eagle', 'of the Fox', 'of the Owl', 'of the Bear',
      'of Swiftness', 'of Protection', 'of Warding', 'of Vitality',
      'of the Void', 'of Flames', 'of Frost', 'of Thunder'
    ];
    
    // Build name
    const prefix = prefixes[rarity][Math.floor(this.random() * prefixes[rarity].length)];
    const item = items[type][Math.floor(this.random() * items[type].length)];
    
    // Add suffix for rare+ items
    if (rarity !== 'common' && this.random() < 0.7) {
      const suffix = suffixes[Math.floor(this.random() * suffixes.length)];
      return `${prefix} ${item} ${suffix}`;
    }
    
    return `${prefix} ${item}`;
  }
  
  /**
   * Generate boss enemy for boss room
   */
  private generateBoss(bossRoom: Room): Enemy {
    // Boss parameters
    this.generateBossName(); // Generate name for logging/future use // Marked as unused with underscore
    const bossType = 'Boss';
    const position = {
      x: Math.floor(bossRoom.size.width / 2),
      y: 1,
      z: Math.floor(bossRoom.size.height / 2)
    };
    
    // Create boss object
    const boss: Enemy = {
      id: `boss-${Date.now()}`,
      type: bossType,
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
    
    return boss;
  }
  
  /**
   * Generate a boss name
   */
  private generateBossName(): string {
    const titles = [
      'Lord', 'Master', 'Overlord', 'Guardian', 'Keeper',
      'Warden', 'King', 'Queen', 'Prince', 'Duke', 'Baron'
    ];
    
    const names = [
      'Morbius', 'Thanatos', 'Azrael', 'Zephyr', 'Kron',
      'Vex', 'Malgrim', 'Noctis', 'Skarr', 'Drakath', 'Morgoth'
    ];
    
    const epithets = [
      'the Eternal', 'the Undying', 'the Dreadful', 'the Merciless',
      'the Nefarious', 'the Malevolent', 'the Corrupted', 'the Fallen',
      'of Shadows', 'of Despair', 'of Ruin', 'of Madness'
    ];
    
    const pattern = Math.floor(this.random() * 3);
    
    switch (pattern) {
      case 0:
        return `${titles[Math.floor(this.random() * titles.length)]} ${names[Math.floor(this.random() * names.length)]}`;
      case 1:
        return `${names[Math.floor(this.random() * names.length)]} ${epithets[Math.floor(this.random() * epithets.length)]}`;
      case 2:
        return `${titles[Math.floor(this.random() * titles.length)]} ${names[Math.floor(this.random() * names.length)]} ${epithets[Math.floor(this.random() * epithets.length)]}`;
      default:
        return `${names[Math.floor(this.random() * names.length)]}`;
    }
  }
}
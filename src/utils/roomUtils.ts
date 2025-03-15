// src/utils/roomUtils.ts
import { Room } from '../types/game';

/**
 * Ensures that all rooms have valid layouts
 * This is a fallback to generate a simple layout if none exists
 */
export function ensureRoomLayouts(rooms: Room[]): Room[] {
  return rooms.map(room => {
    // Skip if room already has a valid layout
    if (room.layout && room.layout.length > 0 && room.layout[0].length > 0) {
      return room;
    }
    
    // Otherwise generate a simple layout
    const { width, height } = room.size;
    const layout: number[][] = [];
    
    // Generate a simple room with walls around the edges
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        // 0 = wall, 1 = floor
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          row.push(0); // Wall around perimeter
        } else {
          row.push(1); // Floor in the middle
        }
      }
      layout.push(row);
    }
    
    // Add doorways based on connections
    if (room.connections.length > 0) {
      // North door
      if (room.connections.length > 0) {
        const doorX = Math.floor(width / 2);
        layout[0][doorX] = 1;
      }
      
      // East door
      if (room.connections.length > 1) {
        const doorY = Math.floor(height / 2);
        layout[doorY][width - 1] = 1;
      }
      
      // South door
      if (room.connections.length > 2) {
        const doorX = Math.floor(width / 2);
        layout[height - 1][doorX] = 1;
      }
      
      // West door
      if (room.connections.length > 3) {
        const doorY = Math.floor(height / 2);
        layout[doorY][0] = 1;
      }
    }
    
    // Return room with generated layout
    return {
      ...room,
      layout
    };
  });
}

/**
 * Adds special features to room layouts based on room type
 */
export function enhanceRoomLayouts(rooms: Room[]): Room[] {
  return rooms.map(room => {
    if (!room.layout) return room;
    
    const { width, height } = room.size;
    const layout = [...room.layout.map(row => [...row])]; // Deep clone
    
    switch (room.type) {
      case 'boss':
        // Add a central platform for the boss
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        const platformSize = 3;
        
        for (let y = centerY - platformSize; y <= centerY + platformSize; y++) {
          for (let x = centerX - platformSize; x <= centerX + platformSize; x++) {
            if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
              layout[y][x] = 2; // Special tile for boss platform
            }
          }
        }
        break;
        
      case 'treasure':
        // Add pedestals for treasures
        const treasureCount = room.treasures?.length || 1;
        
        for (let i = 0; i < treasureCount; i++) {
          const x = Math.floor(width * (0.3 + 0.4 * (i / treasureCount)));
          const y = Math.floor(height * 0.5);
          
          if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
            layout[y][x] = 3; // Special tile for treasure pedestal
          }
        }
        break;
    }
    
    return {
      ...room,
      layout
    };
  });
}
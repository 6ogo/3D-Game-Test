import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { RoomType, LevelData, Room, EnemySpawn, PropData } from '../types/level';

/**
 * LevelManager - Handles dynamic loading and unloading of rooms
 * 
 * Features:
 * - Asynchronous loading of room geometries and textures
 * - Room streaming (only active room and adjacent rooms are fully loaded)
 * - Procedural generation with predetermined layouts
 * - Memory-efficient resource management
 */
export class LevelManager {
  private static instance: LevelManager;
  private currentLevel: LevelData | null = null;
  private loadedRooms: Map<string, Room> = new Map();
  private activeRoomId: string | null = null;
  private adjacentRoomIds: string[] = [];
  private levelScene: THREE.Group;
  private loadingPromises: Map<string, Promise<Room>> = new Map();
  private noise2D = createNoise2D();
  
  // Room templates and prefabs
  private roomTemplates: Map<RoomType, THREE.Object3D> = new Map();
  private propPrefabs: Map<string, THREE.Object3D> = new Map();
  private materials: Map<string, THREE.Material> = new Map();
  
  private constructor(scene: THREE.Scene) {
    this.levelScene = new THREE.Group();
    scene.add(this.levelScene);
    this.preloadAssets();
  }
  
  static getInstance(scene?: THREE.Scene): LevelManager {
    if (!LevelManager.instance && scene) {
      LevelManager.instance = new LevelManager(scene);
    }
    return LevelManager.instance;
  }
  
  /**
   * Preloads common assets used across multiple rooms
   */
  private async preloadAssets(): Promise<void> {
    const textureLoader = new THREE.TextureLoader();
    
    // Load common textures
    const floorTexture = await textureLoader.loadAsync('/textures/floor_diffuse.png');
    const wallTexture = await textureLoader.loadAsync('/textures/wall_diffuse.png');
    const normalMapTexture = await textureLoader.loadAsync('/textures/normal_map.png');
    
    // Set texture properties
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
    
    // Create materials
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      normalMap: normalMapTexture,
      roughness: 0.7,
      metalness: 0.2
    });
    
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture,
      normalMap: normalMapTexture,
      roughness: 0.8,
      metalness: 0.1
    });
    
    this.materials.set('floor_material', floorMaterial);
    this.materials.set('wall_material', wallMaterial);
    // this.propPrefabs.set('wall_material', wallMaterial);
    
    // Load room templates
    // (In a real implementation, this would load more complex geometry)
    await this.loadRoomTemplates();
  }
  
  /**
   * Loads room templates for different room types
   */
  private async loadRoomTemplates(): Promise<void> {
    // For each room type, create a template that can be cloned
    const roomTypes: RoomType[] = ['normal', 'elite', 'treasure', 'boss', 'shop', 'secret'];
    
    for (const type of roomTypes) {
      const template = new THREE.Group();
      // Add basic geometry that will be common to all rooms of this type
      
      // This would typically load from a file, but for demonstration:
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        this.propPrefabs.get('floor_material') as unknown as THREE.Material
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      template.add(floor);
      
      // Add type-specific elements
      if (type === 'boss') {
        // Add special boss room elements like platforms or pillars
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(2, 2, 10, 8),
          this.propPrefabs.get('wall_material') as unknown as THREE.Material
        );
        pillar.position.set(15, 5, 15);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        template.add(pillar);
      }
      
      this.roomTemplates.set(type, template);
    }
  }
  
  /**
   * Loads a level and prepares it for streaming
   */
  async loadLevel(levelId: string): Promise<LevelData> {
    console.log(`Loading level: ${levelId}`);
    
    // In a real game, this would load level data from a file or server
    // For demonstration, we'll generate a simple level layout
    const levelData = this.generateLevelData(levelId);
    this.currentLevel = levelData;
    
    // Start by loading the entrance room
    const entranceRoom = levelData.rooms.find((r: Room) => r.isEntrance);
    if (entranceRoom) {
      await this.activateRoom(entranceRoom.id);
    }
    
    return levelData;
  }
  
  /**
   * Activates a room, loads it and its adjacent rooms
   */
  async activateRoom(roomId: string): Promise<void> {
    if (!this.currentLevel) {
      throw new Error('No level loaded');
    }
    
    // Check if we're already in this room
    if (this.activeRoomId === roomId) return;
    
    console.log(`Activating room: ${roomId}`);
    
    const room = this.currentLevel.rooms.find((r: { id: string; }) => r.id === roomId);
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }
    
    // Get adjacent room IDs
    const adjacentRoomIds = room.connections.map((conn: { targetRoomId: any; }) => conn.targetRoomId);
    
    // Determine which rooms to load, keep, and unload
    const roomsToLoad = [roomId, ...adjacentRoomIds].filter(id => !this.loadedRooms.has(id));
    const roomsToKeep = [roomId, ...adjacentRoomIds];
    const roomsToUnload = Array.from(this.loadedRooms.keys()).filter(id => !roomsToKeep.includes(id));
    
    // Unload rooms that are no longer needed
    for (const id of roomsToUnload) {
      this.unloadRoom(id);
    }
    
    // Load new rooms
    const loadPromises = roomsToLoad.map(id => this.loadRoom(id));
    await Promise.all(loadPromises);
    
    // Set the active room
    this.activeRoomId = roomId;
    this.adjacentRoomIds = adjacentRoomIds;
    
    // Trigger events for game logic
    this.onRoomActivated(roomId);
  }
  
  /**
   * Loads a room and its assets
   */
  private async loadRoom(roomId: string): Promise<Room> {
    // Check if we're already loading this room
    if (this.loadingPromises.has(roomId)) {
      return this.loadingPromises.get(roomId)!;
    }
    
    // Check if room is already loaded
    if (this.loadedRooms.has(roomId)) {
      return this.loadedRooms.get(roomId)!;
    }
    
    console.log(`Loading room: ${roomId}`);
    
    // Start the loading process
    const loadPromise = new Promise<Room>(async (resolve) => {
      if (!this.currentLevel) {
        throw new Error('No level loaded');
      }
      
      // Find room data
      const roomData = this.currentLevel.rooms.find((r: { id: string; }) => r.id === roomId);
      if (!roomData) {
        throw new Error(`Room data not found: ${roomId}`);
      }
      
      // Create room from template
      const roomTemplate = this.roomTemplates.get(roomData.type);
      if (!roomTemplate) {
        throw new Error(`No template for room type: ${roomData.type}`);
      }
      
      // Clone the template
      const roomObject = roomTemplate.clone();
      roomObject.name = `room_${roomId}`;
      
      // Position the room in the level
      roomObject.position.set(roomData.position.x, 0, roomData.position.z);
      
      // Apply room-specific transformations and props
      this.applyRoomLayout(roomObject, roomData);
      
      // Create the Room object with all relevant data
      const room: Room = {
        id: roomId,
        type: roomData.type,
        object: roomObject,
        entities: [],
        props: [],
        isActive: false,
        isCleared: roomData.isCleared,
        connections: roomData.connections,
        position: roomData.position,
        enemies: []
      };
      
      // Add to scene
      this.levelScene.add(roomObject);
      
      // Spawn props and enemies
      await this.spawnProps(room, roomData);
      
      if (!roomData.isCleared) {
        await this.spawnEnemies(room, roomData);
      }
      
      // Store in loaded rooms
      this.loadedRooms.set(roomId, room);
      
      // Resolve the promise
      resolve(room);
    });
    
    // Store the loading promise
    this.loadingPromises.set(roomId, loadPromise);
    
    // When loading is complete, remove the promise
    loadPromise.then(() => {
      this.loadingPromises.delete(roomId);
    });
    
    return loadPromise;
  }
  
  /**
   * Unloads a room and its assets
   */
  private unloadRoom(roomId: string): void {
    console.log(`Unloading room: ${roomId}`);
    
    const room = this.loadedRooms.get(roomId);
    if (!room) return;
    
    // Remove from scene
    if (room.object) {
      this.levelScene.remove(room.object);
    }
    
    // Dispose of geometries and textures
    this.disposeRoomResources(room);
    
    // Remove from loaded rooms
    this.loadedRooms.delete(roomId);
  }
  
  /**
   * Properly disposes of room resources to prevent memory leaks
   */
  private disposeRoomResources(room: Room): void {
    // Recursively dispose of geometries, materials, and textures
    room.object!.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
          object.geometry.dispose();
        }
        
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => this.disposeMaterial(material));
          } else {
            this.disposeMaterial(object.material);
          }
        }
      }
    });
    
    // Clean up any other resources
    room.entities!.forEach((entity: any) => {
      // Dispose entity-specific resources
      // This would depend on your entity implementation
    });
  }
  
  /**
   * Helper to dispose of materials and their textures
   */
  private disposeMaterial(material: THREE.Material): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      if (material.map) material.map.dispose();
      if (material.normalMap) material.normalMap.dispose();
      if (material.roughnessMap) material.roughnessMap.dispose();
      if (material.metalnessMap) material.metalnessMap.dispose();
      if (material.emissiveMap) material.emissiveMap.dispose();
      if (material.alphaMap) material.alphaMap.dispose();
      if (material.aoMap) material.aoMap.dispose();
      if (material.displacementMap) material.displacementMap.dispose();
      if (material.envMap) material.envMap.dispose();
      if (material.lightMap) material.lightMap.dispose();
    }
    
    material.dispose();
  }
  
  /**
   * Applies room-specific layout transformations
   */
  private applyRoomLayout(roomObject: THREE.Object3D, roomData: any): void {
    // Apply any room-specific transformations
    // This could include:
    // - Changing materials based on biome
    // - Adding room-specific geometry
    // - Setting up lighting
    
    // Example: Add room-specific lighting
    const roomLight = new THREE.PointLight(
      roomData.type === 'elite' ? 0xff0000 : 0x00ff00, 
      1, 
      50
    );
    roomLight.position.set(0, 10, 0);
    roomLight.castShadow = true;
    roomObject.add(roomLight);
  }
  
  /**
   * Spawns props (decorative objects) in the room
   */
  private async spawnProps(room: Room, roomData: any): Promise<void> {
    // Spawn props based on room type and seed
    const propSpawns = this.generatePropPositions(roomData);
    
    for (const propData of propSpawns) {
      // Load or retrieve prop from pool
      const prop = await this.getPropObject(propData.type);
      
      // Position prop
      prop.position.copy(propData.position);
      
      // Add to room
      room.object!.add(prop);
      room.props.push({
        object: prop,
        type: propData.type,
        position: propData.position.clone()
      });
    }
  }
  
  /**
   * Spawns enemies in the room if not cleared
   */
  private async spawnEnemies(room: Room, roomData: any): Promise<void> {
    // Don't spawn enemies if room is cleared
    if (roomData.isCleared) return;
    
    // Get enemy spawns for this room
    const enemySpawns = this.generateEnemySpawns(roomData);
    
    for (const spawnData of enemySpawns) {
      // Load or retrieve enemy from pool
      const enemy = await this.getEnemyObject(spawnData.type);
      
      // Position enemy
      enemy.position.copy(spawnData.position);
      
      // Add to room
      room.object!.add(enemy);
      room.entities!.push({
        object: enemy,
        type: spawnData.type,
        health: spawnData.health,
        position: spawnData.position.clone()
      });
    }
  }
  
  /**
   * Retrieves a prop object (from cache or creates new)
   */
  private async getPropObject(type: string): Promise<THREE.Object3D> {
    // In a full implementation, this would use object pooling
    // For now, we'll create new objects
    
    let prop: THREE.Object3D;
    
    switch (type) {
      case 'pillar':
        prop = new THREE.Mesh(
          new THREE.CylinderGeometry(1, 1, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x888888 })
        );
        prop.castShadow = true;
        prop.receiveShadow = true;
        break;
        
      case 'torch':
        prop = new THREE.Group();
        const torchBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.2, 2, 8),
          new THREE.MeshStandardMaterial({ color: 0x553311 })
        );
        torchBase.position.y = 1;
        torchBase.castShadow = true;
        
        // Add flame light
        const flameLight = new THREE.PointLight(0xff9900, 1, 10);
        flameLight.position.y = 2.5;
        
        prop.add(torchBase, flameLight);
        break;
        
      default:
        // Generic prop as fallback
        prop = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
        );
        prop.castShadow = true;
        prop.receiveShadow = true;
    }
    
    return prop;
  }
  
  /**
   * Retrieves an enemy object (from cache or creates new)
   */
  private async getEnemyObject(type: string): Promise<THREE.Object3D> {
    // In a full implementation, this would use object pooling
    // For now, we'll create new objects
    
    let enemy: THREE.Object3D;
    
    switch (type) {
      case 'minion':
        enemy = new THREE.Mesh(
          new THREE.SphereGeometry(1, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        enemy.castShadow = true;
        break;
        
      case 'elite':
        enemy = new THREE.Mesh(
          new THREE.ConeGeometry(1.5, 3, 6),
          new THREE.MeshStandardMaterial({ color: 0xff4400 })
        );
        enemy.castShadow = true;
        break;
        
      case 'boss':
        const bossGroup = new THREE.Group();
        
        const bossBody = new THREE.Mesh(
          new THREE.SphereGeometry(2, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xaa0000 })
        );
        
        const bossHead = new THREE.Mesh(
          new THREE.SphereGeometry(1, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xaa0000 })
        );
        bossHead.position.y = 2.5;
        
        bossGroup.add(bossBody, bossHead);
        bossGroup.castShadow = true;
        
        enemy = bossGroup;
        break;
        
      default:
        // Generic enemy as fallback
        enemy = new THREE.Mesh(
          new THREE.BoxGeometry(1, 2, 1),
          new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        enemy.castShadow = true;
    }
    
    return enemy;
  }
  
  /**
   * Generates level data (would be loaded from file in real game)
   */
  private generateLevelData(levelId: string): LevelData {
    // In a real game, this would load from a file
    // For demonstration, we'll create a simple level
    
    const rooms: any[] = [];
    const roomCount = 10;
    
    // Create entrance room
    rooms.push({
      id: 'entrance',
      type: 'normal' as RoomType,
      position: { x: 0, y: 0, z: 0 },
      connections: [],
      isEntrance: true,
      isCleared: false,
      seed: Math.random()
    });
    
    // Create intermediate rooms
    for (let i = 1; i < roomCount - 1; i++) {
      const roomType: RoomType = 
        i % 3 === 0 ? 'elite' :
        i % 5 === 0 ? 'treasure' : 'normal';
      
      rooms.push({
        id: `room_${i}`,
        type: roomType,
        position: { x: i * 50, y: 0, z: 0 },
        connections: [],
        isEntrance: false,
        isCleared: false,
        seed: Math.random()
      });
    }
    
    // Create boss room
    rooms.push({
      id: 'boss',
      type: 'boss' as RoomType,
      position: { x: (roomCount - 1) * 50, y: 0, z: 0 },
      connections: [],
      isEntrance: false,
      isCleared: false,
      seed: Math.random()
    });
    
    // Connect rooms (linear path for simplicity)
    for (let i = 0; i < rooms.length - 1; i++) {
      const currentRoom = rooms[i];
      const nextRoom = rooms[i + 1];
      
      // Connect current to next
      currentRoom.connections.push({
        direction: 'east',
        targetRoomId: nextRoom.id
      });
      
      // Connect next to current
      nextRoom.connections.push({
        direction: 'west',
        targetRoomId: currentRoom.id
      });
    }
    
    return {
      id: levelId,
      name: `Level ${levelId}`,
      rooms: rooms,
      theme: 'castle',
      difficulty: 1
    };
  }
  
  /**
   * Generates positions for props in a room
   */
  private generatePropPositions(roomData: any): PropData[] {
    const props: PropData[] = [];
    const roomSeed = roomData.seed || 0;
    
    // Number of props based on room type
    let propCount = 0;
    switch (roomData.type) {
      case 'boss': propCount = 8; break;
      case 'elite': propCount = 6; break;
      case 'treasure': propCount = 4; break;
      default: propCount = 3;
    }
    
    // Place props at interesting positions
    for (let i = 0; i < propCount; i++) {
      const angle = (i / propCount) * Math.PI * 2;
      const distance = 10 + this.noise2D(Math.cos(angle) * roomSeed, Math.sin(angle) * roomSeed) * 5;
      
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      
      props.push({
        type: i % 2 === 0 ? 'pillar' : 'torch',
        position: new THREE.Vector3(x, 0, z)
      });
    }
    
    return props;
  }
  
  /**
   * Generates enemy spawn positions
   */
  private generateEnemySpawns(roomData: any): EnemySpawn[] {
    const enemies: EnemySpawn[] = [];
    const roomSeed = roomData.seed || 0;
    
    // Number and type of enemies based on room type
    let enemyCount = 0;
    let includeElite = false;
    let includeBoss = false;
    
    switch (roomData.type) {
      case 'boss':
        enemyCount = 1;
        includeBoss = true;
        break;
      case 'elite':
        enemyCount = 3;
        includeElite = true;
        break;
      case 'treasure':
        enemyCount = 0;
        break;
      default:
        enemyCount = 4;
    }
    
    // For boss rooms, place a boss in the center
    if (includeBoss) {
      enemies.push({
        type: 'boss',
        position: new THREE.Vector3(0, 0, 0),
        health: 500
      });
    }
    
    // For elite rooms, place an elite
    if (includeElite) {
      enemies.push({
        type: 'elite',
        position: new THREE.Vector3(0, 0, 0),
        health: 200
      });
      enemyCount--;
    }
    
    // Place normal enemies
    for (let i = 0; i < enemyCount; i++) {
      const angle = (i / enemyCount) * Math.PI * 2;
      const distance = 8 + this.noise2D(Math.cos(angle) * roomSeed, Math.sin(angle) * roomSeed) * 3;
      
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      
      enemies.push({
        type: 'minion',
        position: new THREE.Vector3(x, 0, z),
        health: 100
      });
    }
    
    return enemies;
  }
  
  /**
   * Called when a room is activated
   */
  private onRoomActivated(roomId: string): void {
    // In a real game, this would trigger events for game logic
    console.log(`Room activated: ${roomId}`);
    
    // Get the room
    const room = this.loadedRooms.get(roomId);
    if (!room) return;
    
    // Mark as active
    room.isActive = true;
    
    // Mark adjacent rooms as inactive
    this.adjacentRoomIds.forEach(id => {
      const adjacentRoom = this.loadedRooms.get(id);
      if (adjacentRoom) {
        adjacentRoom.isActive = false;
      }
    });
    
    // Trigger room-specific events or gameplay
    if (!room.isCleared) {
      // Trigger combat or other gameplay
      this.triggerRoomGameplay(room);
    }
  }
  
  /**
   * Triggers gameplay for an activated room
   */
  private triggerRoomGameplay(room: Room): void {
    // In a real game, this would start combat or other gameplay
    console.log(`Triggering gameplay for room: ${room.id}`);
    
    // Example: For combat rooms, activate enemies
    if (room.type === 'normal' || room.type === 'elite' || room.type === 'boss') {
      room.entities!.forEach((entity: any) => {
        // Activate entity AI or behavior
        // This would depend on your game implementation
      });
    }
  }
  
  /**
   * Marks a room as cleared
   */
  public markRoomCleared(roomId: string): void {
    // Get room
    const room = this.loadedRooms.get(roomId);
    if (!room) return;
    
    // Mark as cleared
    room.isCleared = true;
    
    // Update level data
    if (this.currentLevel) {
      const roomData = this.currentLevel.rooms.find((r: { id: string; }) => r.id === roomId);
      if (roomData) {
        roomData.isCleared = true;
      }
    }
    
    // Remove enemies
    room.entities!.forEach((entity: { object: any; }) => {
      room.object!.remove(entity.object);
    });
    room.entities = [];
    
    console.log(`Room cleared: ${roomId}`);
  }
  
  /**
   * Gets the active room
   */
  public getActiveRoom(): Room | null {
    if (!this.activeRoomId) return null;
    return this.loadedRooms.get(this.activeRoomId) || null;
  }
  
  /**
   * Gets a loaded room by ID
   */
  public getRoom(roomId: string): Room | null {
    return this.loadedRooms.get(roomId) || null;
  }
}
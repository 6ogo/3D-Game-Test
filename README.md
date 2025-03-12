# Game Overview
This is a 3D action-adventure game built with React, TypeScript, Three.js, and React Three Fiber. The game features procedurally generated levels, real-time combat, a progression system with boons, and immersive physics-based movement and interactions. Players explore interconnected rooms, fight enemies, collect treasures, and face bosses in a dynamic, castle-themed environment.

## Game Logic and Features
### General Gameplay
- **Objective:** Navigate through a series of procedurally generated rooms, defeat enemies, collect treasures, and defeat a final boss to win.
- **Setting:** Takes place in a castle-themed level with multiple interconnected rooms.
- **Perspective:** 3D environment viewed through a perspective camera with a top-down angle.

### Player Mechanics
Player Representation: A capsule-shaped character with a weapon, rendered in blue (shifts to a lighter blue when dashing).

**Movement:**
WASD keys for directional movement (speed: 8 units/second).
Spacebar triggers a dash (speed: 20 units/second, 0.2-second duration, 0.5-second cooldown).
Physics-based movement with acceleration, damping, and velocity caps using Rapier physics engine.

**Combat:**
'J' key triggers a basic attack ("Soul Strike") with 20 base damage and a 2-unit range.
Damage scales with player stats and abilities; enemies within range take damage.
Health: Starts at 100/100, reduced by enemy attacks, and can be increased via boons.
Experience & Leveling: Gain XP from defeating enemies; level increases every 1000 XP (linear for simplicity in current code).
Room Transitions: Move between rooms by approaching doors, teleporting to the connected room’s entry point.

## Enemy Mechanics
**Enemy Types:** Normal, Elite, and Boss enemies with varying health and damage.
- **Normal:** 100 HP, 10 damage.
- **Elite:** 200 HP, 20 damage.
- **Boss:** 1000 HP, 50 damage (positioned in the final room).

**Behavior:**
Enemies pursue the player within a 15-unit detection range and attack at a 2-unit range.
Movement speed: 3 units/second with smooth acceleration and rotation towards the player.
Attack cooldown: 1 second, dealing damage to the player when in range.
Health Sync: Enemy health is synced with the game store; they disappear when health reaches 0.
Spawn: Enemies are procedurally placed in rooms based on difficulty and room type.

## Level Generation
Structure: Levels consist of 5+ rooms (scales with difficulty), including Normal, Elite, Treasure, and Boss rooms.

### Room Layout:
Size varies (20x20 to 40x40 tiles, 1 tile = 1 unit).
Generated using Simplex noise for floor (1) and wall (0) tiles.

- **Connections:** Rooms form a main path with occasional branching treasure rooms (30% chance).
- **Difficulty:** Affects room count and enemy density (e.g., 1-2 enemies in Normal rooms, 3+ in Elite).
- **Theme:** Currently fixed to "castle" with dark floors (#2a2a2a) and walls (#1a1a1a).

## Combat System
- **Damage Application:** Player attacks reduce enemy health; enemy attacks reduce player health (10 damage per hit).
- **Effects:** Basic attack has no additional effects yet; framework exists for buffs, debuffs, and healing.
- **Particles:** Planned for hits, healing, and abilities (e.g., red particles for hits), though not fully implemented in UI.
- **Audio:** Placeholder sound effects (hit, heal, ability) and music (main, combat, boss) using Howler. (Will be updated)

## Progression System
**Boons:** After clearing a non-boss room, players choose from 2 random boons:
- **Health Boost:** +20 max health and current health.
- **Damage Boost:** +5 damage to all attack abilities.

**Leveling:** XP-based leveling increases stats implicitly (not fully implemented in UI yet).
**Stats:** Base stats (strength, agility, vitality, wisdom: 10 each) with critical chance (5%) and damage (1.5x).

## User Interface (UI)
**Health Bar:** Top-left, red bar showing health percentage (e.g., 80/100).
**Level & XP:** Top-right, displays current level and XP (e.g., "Level: 1, XP: 250/1000").
**Narrative Text:** Center-top, shows room context (e.g., "You enter a normal room..." or "You face the final guardian!").
**Game Over:** Displays on death (health ≤ 0) with a "Try Again" button to reset.
**Upgrade Screen:** Appears after clearing a room, offering boon selection.

## Physics & Rendering
Rapier engine handles collisions, gravity (-30 units/second), and rigid body dynamics.

## Graphics:
Three.js with React Three Fiber for rendering.
Shadows enabled for player, enemies, and level geometry.
Post-processing effects: Bloom (intense glow) and Chromatic Aberration (color distortion).
Environment: Skybox with a sun and 5000 stars for ambiance.

## Game State Management
**Store:** Zustand manages state (player, level, room, game over status, etc.).
**Reset:** "Try Again" resets player to initial state (100 HP, Level 1, 0 XP).
**Victory:** Defeating the boss triggers an alert ("You have won!") and ends the game.

## Audio System
**Music:** Loops main theme by default; combat and boss tracks are placeholders.
**Sound Effects:** Triggered for hits, healing, and abilities (currently using example URLs).
**Volume:** Adjustable (music: 0.3, SFX: 0.5 by default).

## Particle System
**Framework:** Supports hit, heal, buff, and ability effects with configurable color, size, spread, and duration.
**Implementation:** Partially complete; particles are defined but not fully visible in the current render loop.

## Winning & Losing
**Win Condition:** Defeat the boss in the final room (1000 HP).
**Lose Condition:** Player health reaches 0, triggering Game Over screen.


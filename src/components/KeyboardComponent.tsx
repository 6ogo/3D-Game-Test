import { KeyboardControls } from '@react-three/drei';
import { ReactNode } from 'react';

// Define the controls map
export const controls = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'attack', keys: ['KeyJ'] },
  { name: 'special', keys: ['KeyK'] },
  { name: 'interact', keys: ['KeyE'] },
  { name: 'inventory', keys: ['KeyI'] },
  { name: 'pause', keys: ['Escape'] },
];

// Types for our controls
export type ControlName = 
  | 'forward' 
  | 'backward' 
  | 'left' 
  | 'right' 
  | 'jump' 
  | 'attack' 
  | 'special' 
  | 'interact' 
  | 'inventory' 
  | 'pause';

export interface GameControls {
  [key: string]: boolean;
}

interface Props {
  children: ReactNode;
}

// Component to wrap the game with keyboard controls
export function GameKeyboardControls({ children }: Props) {
  return (
    <KeyboardControls map={controls}>
      {children}
    </KeyboardControls>
  );
}
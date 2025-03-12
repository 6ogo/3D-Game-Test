import { KeyboardControls } from '@react-three/drei';

function App() {
  return (
    <KeyboardControls
      map={[
        { name: 'forward', keys: ['KeyW'] },
        { name: 'backward', keys: ['KeyS'] },
        { name: 'left', keys: ['KeyA'] },
        { name: 'right', keys: ['KeyD'] },
        { name: 'jump', keys: ['Space'] },
        { name: 'action1', keys: ['KeyJ'] },
      ]}
    >
      <div>
        {/* Your scene components, e.g., <Canvas>...</Canvas> */}
      </div>
    </KeyboardControls>
  );
}

export default App;
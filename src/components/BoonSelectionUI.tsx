import { useState, useEffect } from 'react';
import { EnhancedBoon, GOD_THEMES } from '../systems/progression';
import { useGameStore } from '../store/gameStore';
import { AudioManager } from '../systems/audio';

interface BoonSelectionProps {
  onSelect: (boonId: string) => void;
  availableBoons: EnhancedBoon[];
}

export function BoonSelectionUI({ onSelect, availableBoons }: BoonSelectionProps) {
  const [selectedBoon, setSelectedBoon] = useState<string | null>(null);
  const [hoverBoon, setHoverBoon] = useState<string | null>(null);
  const [animationPhase, setAnimationPhase] = useState<'entrance' | 'idle' | 'exit'>('entrance');

  // Animate entrance
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationPhase('idle');
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleSelectBoon = (boonId: string) => {
    setSelectedBoon(boonId);
    setAnimationPhase('exit');
    
    // Play selection sound
    AudioManager.playSound('ability');
    
    // Delay actual selection until exit animation completes
    setTimeout(() => {
      onSelect(boonId);
    }, 1000);
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-50 pointer-events-auto transition-opacity duration-1000 ${
      animationPhase === 'entrance' ? 'opacity-0' : 
      animationPhase === 'exit' ? 'opacity-0' : 
      'opacity-100'
    }`}>
      <div className="absolute inset-0 bg-black bg-opacity-80" />
      
      <div className="relative z-10 w-full max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">Choose Your Blessing</h1>
          <p className="text-gray-300 mt-2">Select one of the boons offered by the Olympians</p>
        </div>
        
        <div className="flex justify-center gap-6">
          {availableBoons.map((boon, index) => {
            const godTheme = GOD_THEMES[boon.god];
            const isSelected = selectedBoon === boon.id;
            const isHovered = hoverBoon === boon.id;
            
            return (
              <div 
                key={boon.id}
                className={`flex-1 max-w-sm transform transition-all duration-500 ${
                  animationPhase === 'entrance' ? `opacity-0 translate-y-16 delay-${index * 200}` : 
                  isSelected ? 'scale-110 z-10' : 
                  isHovered ? 'scale-105' :
                  selectedBoon ? 'opacity-50 scale-95' : 
                  'scale-100'
                }`}
                style={{ 
                  transitionDelay: animationPhase === 'entrance' ? `${index * 100}ms` : '0ms'
                }}
                onMouseEnter={() => setHoverBoon(boon.id)}
                onMouseLeave={() => setHoverBoon(null)}
              >
                <button
                  onClick={() => handleSelectBoon(boon.id)}
                  disabled={animationPhase === 'exit'}
                  className="w-full bg-opacity-90 rounded-lg overflow-hidden transition-transform duration-300 focus:outline-none"
                  style={{ 
                    backgroundColor: `${godTheme.color}20`, 
                    borderColor: godTheme.color,
                    borderWidth: '2px',
                    boxShadow: isHovered || isSelected ? `0 0 15px ${godTheme.color}, 0 0 30px ${godTheme.color}40` : 'none'
                  }}
                >
                  {/* Boon header with god info */}
                  <div className="px-4 py-3 flex items-center" style={{ backgroundColor: `${godTheme.color}40` }}>
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center mr-3"
                      style={{ backgroundColor: godTheme.color }}
                    >
                      {/* This would be the god's icon in a full implementation */}
                      <span className="text-xl font-bold text-black">
                        {godTheme.name.charAt(0)}
                      </span>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-white">{godTheme.name}</h3>
                      <p className="text-sm text-white opacity-80">{godTheme.domain}</p>
                    </div>
                    <div className="ml-auto">
                      <span 
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{ 
                          backgroundColor: `${godTheme.color}90`,
                          color: 'black'
                        }}
                      >
                        {boon.rarity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Boon content */}
                  <div className="px-6 py-5">
                    <h4 className="text-xl font-bold mb-2 text-white">{boon.name}</h4>
                    <p className="text-gray-200 mb-4">{boon.description}</p>
                    
                    {boon.flavorText && (
                      <p className="text-sm italic text-gray-300 mt-4 pb-2">"{boon.flavorText}"</p>
                    )}
                    
                    {/* Slot indicator */}
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-xs uppercase tracking-wider text-gray-400">
                        {boon.slot}
                      </span>
                      
                      {/* This would be the slot icon in a full implementation */}
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${godTheme.color}60` }}
                      >
                        <span className="text-white text-xs">
                          {boon.slot.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Component to integrate with the game store
export function BoonSelectionScreen() {
  const { selectBoon, availableEnhancedBoons: availableBoons } = useGameStore();
  
  const handleSelectBoon = (boonId: string) => {
    selectBoon(boonId);
  };
  
  return <BoonSelectionUI onSelect={handleSelectBoon} availableBoons={availableBoons} />;
}
import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useMetaProgressionStore } from '../store/metaProgressionStore';
import { formatTime } from '../utils/formatters';
import html2canvas from 'html2canvas';

/**
 * EndGameScreen - Displays statistics after completing a run
 * 
 * Shows run statistics including:
 * - Time taken
 * - Deaths
 * - Upgrades collected
 * - Enemies killed
 * - Boss kill time
 * 
 * Also provides social sharing functionality
 */
export function EndGameScreen() {
  const { player, resetGame } = useGameStore();
  const { addRunStats } = useMetaProgressionStore();
  const [showScreen, setShowScreen] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  
  // Get statistics from the game session
  const stats = useGameStore(state => state.gameSession);
  
  // Animation states
  const [animatedStats, setAnimatedStats] = useState({
    timeElapsed: 0,
    deaths: 0,
    upgradesCollected: 0,
    enemiesKilled: 0,
    bossKillTime: 0
  });
  
  // Format time function
  const formatTimeDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Animate stats on mount
  useEffect(() => {
    if (!stats) return;
    
    // Animation timing
    const totalAnimTime = 2000; // 2 seconds
    const startTime = Date.now();
    
    const animateStats = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / totalAnimTime);
      
      setAnimatedStats({
        timeElapsed: Math.floor(stats.totalTime * progress),
        deaths: Math.floor(stats.deaths * progress),
        upgradesCollected: Math.floor(stats.upgradesCollected * progress),
        enemiesKilled: Math.floor(stats.enemiesKilled * progress),
        bossKillTime: Math.floor(stats.bossKillTime * progress)
      });
      
      if (progress < 1) {
        requestAnimationFrame(animateStats);
      }
    };
    
    animateStats();
    
    // Save run stats to progression store
    addRunStats({
      victory: true,
      roomsCleared: stats.roomsCleared,
      enemiesDefeated: stats.enemiesKilled,
      bossDefeated: true,
      duration: stats.totalTime,
      damageDealt: stats.damageDealt,
      damageTaken: stats.damageTaken,
      soulsCollected: stats.soulsCollected
    });
  }, [stats, addRunStats]);

  // Return to home screen
  const handleContinue = () => {
    setShowScreen(false);
    setTimeout(() => {
      resetGame();
    }, 500);
  };

  // Capture and share screenshot
  const handleShare = async () => {
    setCapturing(true);
    
    try {
      const element = document.getElementById('end-game-stats');
      if (!element) {
        console.error('Element not found for screenshot');
        setCapturing(false);
        return;
      }
      const canvas = await html2canvas(element, {
        backgroundColor: null,
        scale: 2,
        logging: false,
        allowTaint: true,
        useCORS: true
      });
      
      // Convert to blob
      canvas.toBlob(async (blob) => {
        // If Web Share API is available
        if (navigator.share) {
          try {
            if (blob) {
              const file = new File([blob], 'my-run-stats.png', { type: 'image/png' });
              await navigator.share({
                title: 'My Run Results',
                text: `I completed a run in ${formatTimeDisplay(stats.totalTime)}!`,
                files: [file]
              });
            } else {
              console.error('Blob is null');
            }
            await navigator.share({
              title: 'My Run Results',
              text: `I completed a run in ${formatTimeDisplay(stats.totalTime)}!`,
              files: [file]
            });
          } catch (err) {
            console.error('Error sharing:', err);
            // Fallback to manual sharing options
            setShareMenuOpen(true);
          }
        } else {
          // Fallback - open share menu
          setShareMenuOpen(true);
          
          // Create download link
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'my-run-stats.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else {
            console.error('Blob is null');
          }
        }
      }, 'image/png');
    } catch (err) {
      console.error('Error capturing screenshot:', err);
    } finally {
      setCapturing(false);
    }
  };

  // Share to specific platform
  const shareToSocial = (platform: string) => {
    const text = `I completed a run in ${formatTimeDisplay(stats.totalTime)} with ${animatedStats.enemiesKilled} enemies defeated!`;
    const url = window.location.href;
    
    let shareUrl;
    
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
        break;
      case 'reddit':
        shareUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
        break;
      default:
        return;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
    setShareMenuOpen(false);
  };

  if (!showScreen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 transition-opacity duration-500">
      <div 
        id="end-game-stats"
        className="relative bg-gray-900 rounded-lg overflow-hidden shadow-xl max-w-xl w-full mx-4 text-white"
      >
        {/* Victory banner at top */}
        <div className="w-full h-20 bg-gradient-to-r from-purple-700 via-purple-600 to-purple-700 flex items-center justify-center">
          <h1 className="text-3xl font-bold tracking-wider text-white uppercase">Victory!</h1>
        </div>
        
        {/* Main content */}
        <div className="p-8">
          <h2 className="text-xl font-semibold text-center mb-6">Run Statistics</h2>
          
          <div className="space-y-4">
            {/* Time elapsed */}
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Time</span>
              <span className="text-2xl font-mono">{formatTimeDisplay(animatedStats.timeElapsed)}</span>
            </div>
            
            {/* Deaths */}
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Deaths</span>
              <span className="text-2xl font-mono">{animatedStats.deaths}</span>
            </div>
            
            {/* Upgrades collected */}
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Upgrades</span>
              <span className="text-2xl font-mono">{animatedStats.upgradesCollected}</span>
            </div>
            
            {/* Enemies killed */}
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Enemies Killed</span>
              <span className="text-2xl font-mono">{animatedStats.enemiesKilled}</span>
            </div>
            
            {/* Boss kill time */}
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Time to Kill Boss</span>
              <span className="text-2xl font-mono">{formatTimeDisplay(animatedStats.bossKillTime)}</span>
            </div>
          </div>
          
          {/* Divider */}
          <div className="border-t border-gray-700 my-6"></div>
          
          {/* Game info */}
          <div className="flex justify-between text-sm text-gray-400">
            <div>
              <div>Character: {player.characterClass}</div>
              <div>Level: {player.level}</div>
            </div>
            <div className="text-right">
              <div>Seed: {stats?.seed || 'Random'}</div>
              <div>{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        
        {/* Buttons */}
        <div className="border-t border-gray-800 p-6 flex justify-between">
          <button
            onClick={handleContinue}
            className="px-6 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-600 transition-colors"
          >
            Continue
          </button>
          
          <div className="relative">
            <button
              onClick={handleShare}
              disabled={capturing}
              className={`px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors flex items-center ${capturing ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {capturing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </>
              )}
            </button>
            
            {/* Share menu dropdown */}
            {shareMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg overflow-hidden z-50">
                <div className="py-1">
                  <button
                    onClick={() => shareToSocial('twitter')}
                    className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 flex items-center"
                  >
                    <span className="mr-2 text-blue-400">𝕏</span> Twitter
                  </button>
                  <button
                    onClick={() => shareToSocial('facebook')}
                    className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 flex items-center"
                  >
                    <span className="mr-2 text-blue-600">f</span> Facebook
                  </button>
                  <button
                    onClick={() => shareToSocial('reddit')}
                    className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 flex items-center"
                  >
                    <span className="mr-2 text-orange-500">r/</span> Reddit
                  </button>
                  <button
                    onClick={() => setShareMenuOpen(false)}
                    className="w-full text-left px-4 py-2 text-white hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
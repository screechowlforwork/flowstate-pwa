import { useEffect, useState, type CSSProperties } from 'react';
import { useTimerStore } from './store/useTimerStore';
import Timer from './components/Timer';
import { Settings, Moon, Sun, CloudRain, Wind, Waves } from 'lucide-react';
import { useAudioEngine, type SoundMode } from './hooks/useAudioEngine';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true' || 
           (!localStorage.getItem('darkMode') && 
            window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const {
    setFocusTime,
    setBreakTime,
    focusTime,
    breakTime,
    isBreak,
    timeLeft,
  } = useTimerStore();

  const {
    mode: soundMode,
    setMode: setSoundMode,
    enabled: soundEnabled,
    setEnabled: setSoundEnabled,
    volume: soundVolume,
    setVolume: setSoundVolume,
  } = useAudioEngine();

  // Background style: during last minute of break, gently shift from break color to focus color
  const isBreakLastMinute = isBreak && timeLeft <= 60;
  let backgroundStyle: CSSProperties | undefined;

  if (isBreakLastMinute) {
    const t = Math.min(Math.max((60 - timeLeft) / 60, 0), 1); // 0 → 1 over the last minute

    if (!darkMode) {
      // Light mode: break (sage green) → focus (warm orange)
      const breakColor = '#76C7C0';
      const focusColor = '#FF8C66';
      const midStop = Math.round(t * 100);

      backgroundStyle = {
        backgroundImage: `linear-gradient(135deg, ${breakColor} 0%, ${breakColor} ${100 - midStop}%, ${focusColor} 100%)`,
        transition: 'background-image 1s linear',
      };
    } else {
      // Dark mode: deep teal → soft warm focus accent (控えめで落ち着いた配色)
      const breakDark = '#123b3a';   // ブレイク寄りのディープティール
      const focusDark = '#4b2b2b';   // フォーカス寄りのウォームブラウン
      const accent = '#ffb38a';      // ごく薄いフォーカスアクセント
      const stop1 = 40;
      const stop2 = 70 + Math.round(t * 20); // 時間経過でアクセント領域を少し広げる

      backgroundStyle = {
        backgroundImage: `radial-gradient(circle at top, ${accent} 0%, transparent 35%), linear-gradient(135deg, ${breakDark} 0%, ${breakDark} ${stop1}%, ${focusDark} ${stop2}%, #111827 100%)`,
        transition: 'background-image 1s linear',
      };
    }
  }
  
  // Toggle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);
  
  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        darkMode ? 'bg-background-dark' : 'bg-background-light'
      }`}
      style={backgroundStyle}
    >
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-focus dark:text-break">FlowState</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            aria-label="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Settings Panel */}
        {showSettings && (
          <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8 animate-fade-in">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Timer Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="focus-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Focus Time: {Math.floor(focusTime / 60)} minutes
                </label>
                <input
                  id="focus-time"
                  type="range"
                  min="1"
                  max="60"
                  value={focusTime / 60}
                  onChange={(e) => setFocusTime(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>
              
              <div>
                <label htmlFor="break-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Break Time: {Math.floor(breakTime / 60)} minutes
                </label>
                <input
                  id="break-time"
                  type="range"
                  min="1"
                  max="30"
                  value={breakTime / 60}
                  onChange={(e) => setBreakTime(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>

              {/* Audio Settings */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Soundscape
                  </span>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      soundEnabled
                        ? 'bg-focus text-white border-transparent'
                        : 'border-gray-400 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {soundEnabled ? 'On' : 'Off'}
                  </button>
                </div>

                {/* Volume Slider */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Volume
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={soundVolume}
                    onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                </div>

                {/* Sound Mode Selector */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Mode
                  </span>
                  <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 p-1 gap-1">
                    {([
                      ['rain', <CloudRain key="rain" size={16} />],
                      ['wind', <Wind key="wind" size={16} />],
                      ['waves', <Waves key="waves" size={16} />],
                    ] as [SoundMode, JSX.Element][]).map(([modeKey, icon]) => (
                      <button
                        key={modeKey}
                        onClick={() => setSoundMode(modeKey)}
                        className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 transition-colors ${
                          soundMode === modeKey
                            ? 'bg-white text-focus shadow-sm dark:bg-gray-900'
                            : 'text-gray-600 dark:text-gray-300'
                        }`}
                        type="button"
                      >
                        {icon}
                        <span className="capitalize hidden sm:inline">{modeKey}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Timer Component */}
        <Timer />
      </main>
      
      {/* Footer */}
      <footer className="text-center py-6 text-sm text-gray-600 dark:text-gray-400">
        <p>FlowState Pomodoro Timer - Stay Focused, Stay Present</p>
      </footer>
    </div>
  );
}

export default App;

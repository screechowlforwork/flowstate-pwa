import { useEffect, useRef } from 'react';
import { useTimerStore } from '../store/useTimerStore';
import { Play, Pause, RotateCcw } from 'lucide-react';

const Timer = () => {
  const {
    isRunning,
    isBreak,
    timeLeft,
    focusTime,
    breakTime,
    toggleTimer,
    resetTimer,
  } = useTimerStore();

  const timerRef = useRef<number | null>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage for the circular timer
  const totalTime = isBreak ? breakTime : focusTime;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Timer effect
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = window.setInterval(() => {
      const { timeLeft, isRunning: stillRunning } = useTimerStore.getState();
      if (!stillRunning) return;

      if (timeLeft > 0) {
        useTimerStore.setState({ timeLeft: timeLeft - 1 });
      } else {
        useTimerStore.getState().toggleTimer();
      }
    }, 1000);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, isBreak]);

  // Haptic feedback for better UX
  const handleButtonClick = (action: () => void) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    action();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="relative">
        {/* Timer Circle */}
        <div className="timer-circle">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 320 320">
            <circle
              className="timer-progress"
              cx="160"
              cy="160"
              r={radius}
              fill="none"
              stroke={isBreak ? 'rgba(118, 199, 192, 0.2)' : 'rgba(255, 140, 102, 0.2)'}
              strokeWidth="12"
            />
            <circle
              className="transition-all duration-1000 ease-linear"
              cx="160"
              cy="160"
              r={radius}
              fill="none"
              stroke={isBreak ? '#76C7C0' : '#FF8C66'}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          {/* Timer Display */}
          <div className="absolute flex flex-col items-center justify-center w-full h-full">
            <div className={`timer-text ${isBreak ? 'text-break' : 'text-focus'}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="mt-2 text-lg font-medium text-gray-600 dark:text-gray-400">
              {isBreak ? 'Break Time' : 'Focus Time'}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          onClick={() => handleButtonClick(toggleTimer)}
          className="btn btn-primary flex items-center gap-2"
          aria-label={isRunning ? 'Pause' : 'Start'}
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
          {isRunning ? 'Pause' : 'Start'}
        </button>

        <button
          onClick={() => handleButtonClick(resetTimer)}
          className="btn btn-secondary flex items-center gap-2"
          aria-label="Reset"
        >
          <RotateCcw size={18} />
          Reset
        </button>
      </div>
    </div>
  );
};

export default Timer;

import { create } from 'zustand';

type TimerState = {
  isRunning: boolean;
  isBreak: boolean;
  timeLeft: number;
  focusTime: number;
  breakTime: number;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  toggleTimer: () => void;
  setFocusTime: (minutes: number) => void;
  setBreakTime: (minutes: number) => void;
};

const FOCUS_TIME = 25 * 60; // 25 minutes in seconds
const BREAK_TIME = 5 * 60;   // 5 minutes in seconds

export const useTimerStore = create<TimerState>((set, get) => ({
  isRunning: false,
  isBreak: false,
  timeLeft: FOCUS_TIME,
  focusTime: FOCUS_TIME,
  breakTime: BREAK_TIME,
  startTimer: () => set({ isRunning: true }),
  pauseTimer: () => set({ isRunning: false }),
  resetTimer: () => set({ 
    isRunning: false, 
    timeLeft: get().isBreak ? get().breakTime : get().focusTime 
  }),
  toggleTimer: () => {
    const { isRunning, isBreak, timeLeft, focusTime, breakTime } = get();
    
    if (timeLeft <= 0) {
      const newIsBreak = !isBreak;
      return set({
        isBreak: newIsBreak,
        timeLeft: newIsBreak ? breakTime : focusTime,
        isRunning: true,
      });
    }
    
    return set({ isRunning: !isRunning });
  },
  setFocusTime: (minutes: number) => {
    const seconds = minutes * 60;
    set({ focusTime: seconds });
    if (!get().isBreak) {
      set({ timeLeft: seconds });
    }
  },
  setBreakTime: (minutes: number) => {
    const seconds = minutes * 60;
    set({ breakTime: seconds });
    if (get().isBreak) {
      set({ timeLeft: seconds });
    }
  },
}));

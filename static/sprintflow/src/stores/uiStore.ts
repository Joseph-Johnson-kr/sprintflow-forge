import { create } from 'zustand';
import type { View } from '../types';

interface UIState {
  view: View;
  setView: (v: View) => void;
}

export const useUIStore = create<UIState>((set) => ({
  view: 'sprint',
  setView: (view) => set({ view }),
}));

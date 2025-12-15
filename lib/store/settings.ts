import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    drawerPosition: 'right' | 'bottom';
    setDrawerPosition: (position: 'right' | 'bottom') => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            drawerPosition: 'right',
            setDrawerPosition: (position) => set({ drawerPosition: position }),
        }),
        {
            name: 'jivvy-settings-storage',
        }
    )
);

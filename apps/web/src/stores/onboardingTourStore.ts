import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TourAudience, TourStep } from '../lib/onboardingTours';
import {
  getAdminTourSteps,
  marketplaceTourSteps,
  posTourSteps,
} from '../lib/onboardingTours';

interface OnboardingTourState {
  activeAudience: TourAudience | null;
  stepIndex: number;
  steps: TourStep[];
  /** Completed flags by audience */
  completed: Record<TourAudience, boolean>;
  /** Prevent auto-start racing before hydrate */
  hydrated: boolean;

  setHydrated: (value: boolean) => void;
  startTour: (
    audience: TourAudience,
    options?: { inventoryModel?: 'warehouse' | 'branch_only'; force?: boolean },
  ) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetAudience: (audience: TourAudience) => void;
}

function stepsFor(
  audience: TourAudience,
  inventoryModel: 'warehouse' | 'branch_only' = 'warehouse',
): TourStep[] {
  if (audience === 'admin') return getAdminTourSteps(inventoryModel);
  if (audience === 'marketplace') return marketplaceTourSteps;
  return posTourSteps;
}

export const useOnboardingTourStore = create<OnboardingTourState>()(
  persist(
    (set, get) => ({
      activeAudience: null,
      stepIndex: 0,
      steps: [],
      completed: {
        admin: false,
        marketplace: false,
        pos: false,
      },
      hydrated: false,

      setHydrated: (value) => set({ hydrated: value }),

      startTour: (audience, options) => {
        const force = options?.force ?? false;
        if (!force && get().completed[audience]) return;
        const steps = stepsFor(audience, options?.inventoryModel ?? 'warehouse');
        if (steps.length === 0) return;
        set({
          activeAudience: audience,
          stepIndex: 0,
          steps,
        });
      },

      nextStep: () => {
        const { stepIndex, steps, activeAudience } = get();
        if (!activeAudience) return;
        if (stepIndex >= steps.length - 1) {
          get().completeTour();
          return;
        }
        set({ stepIndex: stepIndex + 1 });
      },

      prevStep: () => {
        const { stepIndex } = get();
        if (stepIndex <= 0) return;
        set({ stepIndex: stepIndex - 1 });
      },

      skipTour: () => {
        const { activeAudience, completed } = get();
        if (!activeAudience) return;
        set({
          activeAudience: null,
          stepIndex: 0,
          steps: [],
          completed: { ...completed, [activeAudience]: true },
        });
      },

      completeTour: () => {
        const { activeAudience, completed } = get();
        if (!activeAudience) return;
        set({
          activeAudience: null,
          stepIndex: 0,
          steps: [],
          completed: { ...completed, [activeAudience]: true },
        });
      },

      resetAudience: (audience) => {
        const { completed } = get();
        set({
          completed: { ...completed, [audience]: false },
        });
      },
    }),
    {
      name: 'pos-onboarding-tours',
      partialize: (state) => ({ completed: state.completed }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

// Fallback if persist rehydration is delayed or skipped
if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    const s = useOnboardingTourStore.getState();
    if (!s.hydrated) s.setHydrated(true);
  });
}

export function selectCurrentStep(state: OnboardingTourState): TourStep | null {
  if (!state.activeAudience || state.steps.length === 0) return null;
  return state.steps[state.stepIndex] ?? null;
}

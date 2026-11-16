import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  selectCurrentStep,
  useOnboardingTourStore,
} from '../../stores/onboardingTourStore';
import { Button } from '../Button';

interface ProductTourProps {
  /** Called when a step needs a tab switch (admin) */
  onStepChange?: (step: {
    tabId?: string;
    route?: string;
  }) => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

export const ProductTour: React.FC<ProductTourProps> = ({ onStepChange }) => {
  const activeAudience = useOnboardingTourStore((s) => s.activeAudience);
  const stepIndex = useOnboardingTourStore((s) => s.stepIndex);
  const steps = useOnboardingTourStore((s) => s.steps);
  const current = useOnboardingTourStore(selectCurrentStep);
  const nextStep = useOnboardingTourStore((s) => s.nextStep);
  const prevStep = useOnboardingTourStore((s) => s.prevStep);
  const skipTour = useOnboardingTourStore((s) => s.skipTour);

  const [rect, setRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({ top: 80, left: 24 });

  const total = steps.length;
  const isOpen = Boolean(activeAudience && current);

  useEffect(() => {
    if (!current) return;
    onStepChange?.({ tabId: current.tabId, route: current.route });
  }, [current?.id, current?.tabId, current?.route]); // eslint-disable-line react-hooks/exhaustive-deps

  const measure = () => {
    if (!current) {
      setRect(null);
      return;
    }
    const el = document.querySelector(current.target) as HTMLElement | null;
    if (!el) {
      setRect(null);
      // Keep card centered-ish when target missing
      setCardPos({
        top: Math.max(24, window.innerHeight / 2 - 100),
        left: Math.max(24, Math.min(window.innerWidth - 360, window.innerWidth / 2 - 180)),
      });
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    const nextRect = {
      top: r.top - PADDING,
      left: r.left - PADDING,
      width: r.width + PADDING * 2,
      height: r.height + PADDING * 2,
    };
    setRect(nextRect);

    const cardWidth = 320;
    const cardHeight = 200;
    let top = nextRect.top + nextRect.height + 12;
    let left = nextRect.left;
    if (top + cardHeight > window.innerHeight - 16) {
      top = Math.max(16, nextRect.top - cardHeight - 12);
    }
    if (left + cardWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - cardWidth - 16);
    }
    setCardPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(measure, 120);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isOpen, current?.id, stepIndex, activeAudience]);

  const spotlightStyle = useMemo(() => {
    if (!rect) return null;
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    } as React.CSSProperties;
  }, [rect]);

  if (!isOpen || !current) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="absolute inset-0 bg-black/55" onClick={skipTour} />

      {spotlightStyle && (
        <div
          className="absolute rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none transition-all duration-200"
          style={spotlightStyle}
        />
      )}

      <div
        className="absolute z-[101] w-[min(100vw-2rem,20rem)] rounded-xl border border-border bg-background shadow-xl p-4 space-y-3"
        style={{ top: cardPos.top, left: cardPos.left }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              Step {stepIndex + 1} of {total}
            </p>
            <h3 className="text-sm font-bold text-foreground mt-0.5">{current.title}</h3>
          </div>
          <button
            type="button"
            onClick={skipTour}
            className="p-1 rounded-md text-muted-foreground hover:bg-secondary"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">{current.body}</p>

        <div className="flex items-center gap-1.5 flex-wrap">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={skipTour}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={prevStep} disabled={stepIndex === 0}>
              Back
            </Button>
            <Button size="sm" onClick={nextStep}>
              {stepIndex >= total - 1 ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

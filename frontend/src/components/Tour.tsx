import React, { useState, useEffect } from 'react';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/en';

const TOUR_KEY = 'melodyscribe_tour_seen';

const STEPS: { title: TranslationKey; body: TranslationKey; anchor: string | null }[] = [
  { title: 'tour1Title', body: 'tour1Body', anchor: 'upload-zone' },
  { title: 'tour2Title', body: 'tour2Body', anchor: 'transcribe-options' },
  { title: 'tour3Title', body: 'tour3Body', anchor: null },
];

function useTour() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setVisible(true);
    }
  }, []);

  const next = () => {
    if (currentStep >= STEPS.length - 1) {
      skip();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const skip = () => {
    localStorage.setItem(TOUR_KEY, 'true');
    setVisible(false);
  };

  return { currentStep, visible, next, skip };
}

export const Tour: React.FC = () => {
  const { currentStep, visible, next, skip } = useTour();
  const t = useT();

  if (!visible) return null;

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div
        className="pointer-events-auto fixed bottom-8 left-1/2 -translate-x-1/2 bg-surface border border-ink-soft/15 rounded-xl shadow-xl p-5 max-w-sm w-full"
        role="dialog"
        aria-label="Getting started tour"
      >
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-semibold text-accent uppercase tracking-wide">
            {t('tourStep')} {currentStep + 1} / {STEPS.length}
          </span>
          <button
            onClick={skip}
            className="text-xs text-ink-soft/60 hover:text-ink-soft"
          >
            {t('tourSkip')}
          </button>
        </div>
        <h3 className="font-bold text-ink mb-1">{t(step.title)}</h3>
        <p className="text-sm text-ink-soft mb-4">{t(step.body)}</p>
        <button
          onClick={next}
          className="w-full py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition"
        >
          {currentStep >= STEPS.length - 1 ? t('tourStart') : t('tourNext')}
        </button>
      </div>
    </div>
  );
};

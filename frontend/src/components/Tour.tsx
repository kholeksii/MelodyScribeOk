import React, { useState, useEffect } from 'react';

const TOUR_KEY = 'melodyscribe_tour_seen';

const STEPS = [
  {
    title: 'Upload audio',
    body: 'Drop an audio file or record directly from your microphone to get started.',
    anchor: 'upload-zone',
  },
  {
    title: 'Set BPM, key & time',
    body: 'Optionally enter BPM, time signature and key before transcribing for better accuracy.',
    anchor: 'transcribe-options',
  },
  {
    title: 'Export your score',
    body: 'After transcribing, edit notes then export to PDF or MusicXML.',
    anchor: null,
  },
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

  if (!visible) return null;

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div
        className="pointer-events-auto fixed bottom-8 left-1/2 -translate-x-1/2 bg-white border border-purple-300 rounded-xl shadow-xl p-5 max-w-sm w-full"
        role="dialog"
        aria-label="Getting started tour"
      >
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
            Step {currentStep + 1} / {STEPS.length}
          </span>
          <button
            onClick={skip}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Skip
          </button>
        </div>
        <h3 className="font-bold text-gray-900 mb-1">{step.title}</h3>
        <p className="text-sm text-gray-600 mb-4">{step.body}</p>
        <button
          onClick={next}
          className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
        >
          {currentStep >= STEPS.length - 1 ? 'Get started' : 'Next'}
        </button>
      </div>
    </div>
  );
};

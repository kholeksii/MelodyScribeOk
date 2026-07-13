import React, { useEffect, useRef } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Non-modal sheets (e.g. note editing) have no scrim and don't block the page below. */
  scrim?: boolean;
  children: React.ReactNode;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Slides up from the bottom edge; grab handle, focus trap, Esc/scrim-tap to close. */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  title,
  scrim = true,
  children,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const focusable = () =>
      Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);

    focusable()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {scrim && <div className="fixed inset-0 z-40 bg-ink/40" aria-hidden="true" onClick={onClose} />}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal={scrim}
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-ink-soft/15 bg-surface shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-center pt-2">
          <div className="h-1 w-9 rounded-full bg-ink-soft/40" />
        </div>
        {title && <h2 className="px-4 pb-1 pt-2 text-sm font-semibold text-ink">{title}</h2>}
        <div className="pb-2">{children}</div>
      </div>
    </>
  );
};

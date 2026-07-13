import React, { useEffect, useRef } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BottomSheet } from './BottomSheet';

export interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  kbd?: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface MenuProps {
  open: boolean;
  onClose: () => void;
  anchorLabel: string;
  items: MenuItem[];
}

const rowClass =
  'flex min-h-[48px] w-full items-center gap-3.5 rounded-md px-3 text-left text-sm text-ink transition hover:bg-paper-dark disabled:cursor-not-allowed disabled:opacity-40';

/** Dropdown popover ≥640px, BottomSheet below — same item list, tier-appropriate chrome. */
export const Menu: React.FC<MenuProps> = ({ open, onClose, anchorLabel, items }) => {
  const isTabletUp = useMediaQuery('(min-width: 640px)');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !isTabletUp) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isTabletUp, onClose]);

  const select = (item: MenuItem) => {
    if (item.disabled) return;
    onClose();
    item.onSelect();
  };

  if (!open) return null;

  if (!isTabletUp) {
    return (
      <BottomSheet open={open} onClose={onClose} title={anchorLabel}>
        {items.map((item) => (
          <button
            key={item.key}
            className={rowClass}
            disabled={item.disabled}
            onClick={() => select(item)}
          >
            <span className="w-6 flex-none text-center">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.kbd && (
              <span className="rounded border border-ink-soft/30 bg-paper-dark px-1.5 py-0.5 font-mono text-xs text-ink-soft">
                {item.kbd}
              </span>
            )}
          </button>
        ))}
      </BottomSheet>
    );
  }

  return (
    <div
      ref={rootRef}
      role="menu"
      aria-label={anchorLabel}
      className="absolute right-0 top-full z-40 mt-1 min-w-[13rem] rounded-lg border border-ink-soft/15 bg-surface p-1 shadow-lg"
    >
      {items.map((item) => (
        <button
          key={item.key}
          role="menuitem"
          className={rowClass}
          disabled={item.disabled}
          onClick={() => select(item)}
        >
          <span className="w-6 flex-none text-center">{item.icon}</span>
          <span className="flex-1">{item.label}</span>
          {item.kbd && (
            <span className="rounded border border-ink-soft/30 bg-paper-dark px-1.5 py-0.5 font-mono text-xs text-ink-soft">
              {item.kbd}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

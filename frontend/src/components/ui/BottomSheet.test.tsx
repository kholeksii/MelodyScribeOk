import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';

describe('BottomSheet', () => {
  it('renders nothing when closed', () => {
    render(
      <BottomSheet open={false} onClose={() => {}}>
        content
      </BottomSheet>
    );
    expect(screen.queryByText('content')).toBeNull();
  });

  it('renders content and title when open', () => {
    render(
      <BottomSheet open onClose={() => {}} title="Меню">
        <div>content</div>
      </BottomSheet>
    );
    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.getByText('Меню')).toBeTruthy();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <button>row</button>
      </BottomSheet>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on scrim click by default', () => {
    // Portaled to document.body, so query there instead of the render container
    // (a `fixed` sheet nested under a `backdrop-blur` ancestor like the sticky
    // header would otherwise be positioned relative to that ancestor).
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <div>content</div>
      </BottomSheet>
    );
    const scrim = document.body.querySelector('[aria-hidden="true"]');
    expect(scrim).toBeTruthy();
    fireEvent.click(scrim!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('omits the scrim when scrim=false (non-modal sheet)', () => {
    render(
      <BottomSheet open onClose={() => {}} scrim={false}>
        <div>content</div>
      </BottomSheet>
    );
    expect(document.body.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('false');
  });
});

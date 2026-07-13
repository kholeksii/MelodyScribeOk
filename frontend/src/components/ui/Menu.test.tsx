import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Menu, MenuItem } from './Menu';

function setViewport(width: number) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const min = Number(/min-width:\s*(\d+)/.exec(query)?.[1] ?? 0);
    return {
      matches: width >= min,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
  });
}

const items: MenuItem[] = [
  { key: 'save', icon: '💾', label: 'Зберегти', kbd: '⌘S', onSelect: vi.fn() },
  { key: 'open', icon: '📂', label: 'Відкрити', onSelect: vi.fn() },
];

describe('Menu', () => {
  beforeEach(() => setViewport(1280));
  afterEach(() => vi.restoreAllMocks());

  it('renders a dropdown with role=menu on desktop widths', () => {
    render(<Menu open onClose={() => {}} anchorLabel="Файл" items={items} />);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByText('Зберегти')).toBeTruthy();
    expect(screen.getByText('⌘S')).toBeTruthy();
  });

  it('renders a BottomSheet dialog on phone widths', () => {
    setViewport(390);
    render(<Menu open onClose={() => {}} anchorLabel="Файл" items={items} />);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Відкрити')).toBeTruthy();
  });

  it('calls onSelect and closes when an item is chosen', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <Menu
        open
        onClose={onClose}
        anchorLabel="Файл"
        items={[{ key: 'x', icon: '✨', label: 'Нова транскрипція', onSelect }]}
      />
    );
    fireEvent.click(screen.getByText('Нова транскрипція'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not select a disabled item', () => {
    const onSelect = vi.fn();
    render(
      <Menu
        open
        onClose={() => {}}
        anchorLabel="Файл"
        items={[{ key: 'x', icon: '📂', label: 'Відкрити', onSelect, disabled: true }]}
      />
    );
    fireEvent.click(screen.getByText('Відкрити'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

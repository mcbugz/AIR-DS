import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as icons from './index';
import type { IconProps } from './IconBase';
import styles from './Icon.module.css';

type IconComponent = (props: IconProps) => ReturnType<typeof icons.CheckIcon>;

/** Every runtime export of the barrel is an icon component. */
const iconEntries = Object.entries(icons).filter(
  (entry): entry is [string, IconComponent] => typeof entry[1] === 'function',
);

function renderSvg(Icon: IconComponent, props?: IconProps) {
  const { container } = render(<Icon {...props} />);
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  return svg as SVGSVGElement;
}

describe('icons', () => {
  it('exports the full 25-icon set, and nothing else at runtime', () => {
    expect(iconEntries.map(([name]) => name).sort()).toEqual([
      'ArrowDownIcon',
      'ArrowLeftIcon',
      'ArrowRightIcon',
      'ArrowUpIcon',
      'CalendarIcon',
      'CheckIcon',
      'ChevronDownIcon',
      'ChevronLeftIcon',
      'ChevronRightIcon',
      'ChevronUpIcon',
      'CloseIcon',
      'DangerIcon',
      'EditIcon',
      'ExternalLinkIcon',
      'EyeIcon',
      'InfoIcon',
      'MenuIcon',
      'MinusIcon',
      'PlusIcon',
      'SearchIcon',
      'SettingsIcon',
      'SuccessIcon',
      'TrashIcon',
      'UserIcon',
      'WarningIcon',
    ]);
  });

  describe.each(iconEntries)('%s', (name, Icon) => {
    it('renders a 24×24 outline SVG on the shared contract', () => {
      const svg = renderSvg(Icon);
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      expect(svg).toHaveAttribute('stroke-width', '2');
      expect(svg).toHaveAttribute('stroke-linecap', 'round');
      expect(svg).toHaveAttribute('stroke-linejoin', 'round');
      // Geometry present (path/circle/rect children).
      expect(svg.children.length).toBeGreaterThan(0);
    });

    it('is decorative by default (aria-hidden, no role, no title)', () => {
      const svg = renderSvg(Icon);
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).not.toHaveAttribute('role');
      expect(svg.querySelector('title')).toBeNull();
    });

    it('switches to role="img" with an accessible title when titled', () => {
      const svg = renderSvg(Icon, { title: `${name} meaning` });
      expect(svg).toHaveAttribute('role', 'img');
      expect(svg).not.toHaveAttribute('aria-hidden');
      expect(svg.querySelector('title')).toHaveTextContent(`${name} meaning`);
      expect(svg).toHaveAccessibleName(`${name} meaning`);
    });

    it('defaults to size="md" and maps sizes to the icon size classes', () => {
      expect(renderSvg(Icon)).toHaveClass(styles.icon!, styles.md!);
      expect(renderSvg(Icon, { size: 'sm' })).toHaveClass(
        styles.icon!,
        styles.sm!,
      );
      expect(renderSvg(Icon, { size: 'lg' })).toHaveClass(
        styles.icon!,
        styles.lg!,
      );
    });
  });

  it('appends a caller-provided className after its own', () => {
    const svg = renderSvg(icons.CheckIcon, { className: 'mine' });
    expect(svg).toHaveClass(styles.icon!, styles.md!, 'mine');
  });

  it('forwards a typed ref to the underlying <svg>', () => {
    const ref = createRef<SVGSVGElement>();
    render(<icons.CheckIcon ref={ref} />);
    expect(ref.current).toBeInstanceOf(SVGSVGElement);
  });

  describe('accessibility', () => {
    it('has no axe violations (decorative, inside a labeled control)', async () => {
      const { container } = render(
        <button type="button">
          <icons.TrashIcon size="sm" /> Delete
        </button>,
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (standalone with title)', async () => {
      const { container } = render(<icons.WarningIcon title="Warning" />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

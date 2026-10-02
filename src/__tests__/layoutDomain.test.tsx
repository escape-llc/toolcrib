import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Splitter } from '../components/Splitter/Splitter';
import { Card } from '../components/Card/Card';
import { Content } from '../components/Layout/Content';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

describe('Layout Domain & Event Bus Corner Coordination', () => {
  it('automatically emits layout domain creation and corner squaring events over aiBus', async () => {
    const domainSpy = vi.fn();
    const cornerSpy = vi.fn();

    const unsub1 = aiBus.on('layout:domain:created', domainSpy);
    const unsub2 = aiBus.on('layout:corners:squared', cornerSpy);

    render(
      <Splitter id="test-splitter" orientation="vertical">
        <Card>Top Panel</Card>
        <Card>Bottom Panel</Card>
      </Splitter>
    );

    expect(domainSpy).toHaveBeenCalled();
    expect(domainSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: 'test-splitter',
        orientation: 'vertical',
      })
    );

    expect(cornerSpy).toHaveBeenCalledTimes(2);
    expect(cornerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: 'test-splitter',
        slot: 'first',
        squaredCorners: { bottomLeft: true, bottomRight: true },
      })
    );
    expect(cornerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: 'test-splitter',
        slot: 'second',
        squaredCorners: { topLeft: true, topRight: true },
      })
    );

    expect(await axe(document.body)).toHaveNoViolations();

    unsub1();
    unsub2();
  });

  it('automatically sets layout domain DOM data-attributes and CSS custom properties on panel containers', () => {
    const { container } = render(
      <Splitter id="domain-attr-test" orientation="vertical">
        <div>First Content</div>
        <div>Second Content</div>
      </Splitter>
    );

    const firstSlot = container.querySelector('[data-ai-layout-slot="first"]');
    const secondSlot = container.querySelector('[data-ai-layout-slot="second"]');

    expect(firstSlot).not.toBeNull();
    expect(secondSlot).not.toBeNull();
    expect(firstSlot?.getAttribute('data-ai-layout-domain')).toBe('domain-attr-test');
    expect(secondSlot?.getAttribute('data-ai-layout-domain')).toBe('domain-attr-test');
  });
});

// Issue #690: Content called useCornerSquaring(true) unconditionally, so the
// ambient domain's squaring was spread in even when the caller passed an
// explicit squareCorners override, which then couldn't undo it.
describe('Content squareCorners override inside a Splitter domain', () => {
  const renderInFirstPanel = (squareCorners?: 'none' | 'top' | 'auto') =>
    render(
      <Splitter id="content-override" orientation="vertical">
        <Content data-testid="content" squareCorners={squareCorners}>first</Content>
        <div>second</div>
      </Splitter>
    );

  it('squares the domain edge by default', () => {
    renderInFirstPanel();
    const style = screen.getByTestId('content').style;
    expect(style.borderBottomLeftRadius).toBe('0rem');
    expect(style.borderBottomRightRadius).toBe('0rem');
  });

  it("squareCorners='auto' still follows the domain", () => {
    renderInFirstPanel('auto');
    expect(screen.getByTestId('content').style.borderBottomLeftRadius).toBe('0rem');
  });

  it("squareCorners='none' drops the domain's squaring", () => {
    renderInFirstPanel('none');
    const style = screen.getByTestId('content').style;
    expect(style.borderBottomLeftRadius).toBe('');
    expect(style.borderBottomRightRadius).toBe('');
  });

  it("squareCorners='top' squares only the top, not the domain's bottom edge", () => {
    renderInFirstPanel('top');
    const style = screen.getByTestId('content').style;
    expect(style.borderTopLeftRadius).toBe('0px');
    expect(style.borderBottomLeftRadius).toBe('');
  });
});

describe('Content.Grow children do not shrink', () => {
  it('marks the scroll box and injects a flex-shrink: 0 rule for its direct children', () => {
    render(
      <Content>
        <Content.Grow data-testid="grow">
          <div>row</div>
        </Content.Grow>
      </Content>
    );
    expect(screen.getByTestId('grow').classList.contains('ai-content-grow')).toBe(true);
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(css).toContain('.ai-content-grow > * { flex-shrink: 0; }');
  });
});

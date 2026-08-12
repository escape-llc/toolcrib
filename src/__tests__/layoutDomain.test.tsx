import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Splitter } from '../components/Splitter/Splitter';
import { Card } from '../components/Card/Card';
import { aiBus } from '../eventBus/eventBus';

describe('Layout Domain & Event Bus Corner Coordination', () => {
  it('automatically emits layout domain creation and corner squaring events over aiBus', () => {
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

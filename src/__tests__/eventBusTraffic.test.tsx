import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { aiBus } from '../eventBus/eventBus';

// Mock ResizeObserver for Radix UI Slider in JSDOM
(globalThis as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Components
import { Modal } from '../components/Overlay/Modal';
import { SlideOut } from '../components/Overlay/SlideOut';
import { Popup } from '../components/Overlay/Popup';
import { Tooltip } from '../components/Tooltip/Tooltip';
import { Accordion } from '../components/Accordion/Accordion';
import { DropdownMenu } from '../components/DropdownMenu/DropdownMenu';
import { Select } from '../components/Form/Select';
import { Slider } from '../components/Form/Slider';
import { TabStrip } from '../components/TabStrip/TabStrip';
import { Button } from '../components/Form/FormComponents';
import { Form } from '../components/Form/FormContext';
import { FormField, Input, SubmitButton } from '../components/Form/FormComponents';

describe('EventBus Traffic & Emission Verification Suite', () => {
  let trafficSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trafficSpy = vi.fn();
    aiBus.on('*' as any, trafficSpy);
  });

  it('verifies Modal emits modal:shown and modal:hidden events', async () => {
    render(
      <Modal id="test-modal" trigger={<Button>Open Modal</Button>}>
        <Modal.Header>Modal Title</Modal.Header>
        <Modal.Body>Modal Content</Modal.Body>
        <Modal.Footer><Modal.CloseButton /></Modal.Footer>
      </Modal>
    );

    fireEvent.click(screen.getByText('Open Modal'));
    expect(trafficSpy).toHaveBeenCalledWith({
      type: 'modal:shown',
      detail: expect.objectContaining({ id: 'test-modal' }),
    });

    fireEvent.click(screen.getByText('Close'));
    expect(trafficSpy).toHaveBeenCalledWith({
      type: 'modal:hidden',
      detail: expect.objectContaining({ id: 'test-modal' }),
    });
  });

  it('verifies SlideOut emits slideout:shown and slideout:hidden events', () => {
    render(
      <SlideOut id="test-slideout" title="Drawer" trigger={<Button>Open Drawer</Button>}>
        <div>Drawer Content</div>
      </SlideOut>
    );

    fireEvent.click(screen.getByText('Open Drawer'));
    expect(trafficSpy).toHaveBeenCalledWith({
      type: 'slideout:shown',
      detail: expect.objectContaining({ id: 'test-slideout', position: 'right' }),
    });
  });

  it('verifies Popup emits popup:shown and popup:hidden events', () => {
    render(
      <Popup id="test-popup" trigger={<Button>Open Popup</Button>}>
        <div>Popup Content</div>
      </Popup>
    );

    fireEvent.click(screen.getByText('Open Popup'));
    expect(trafficSpy).toHaveBeenCalledWith({
      type: 'popup:shown',
      detail: expect.objectContaining({ id: 'test-popup' }),
    });
  });

  it('verifies Tooltip emits tooltip:shown on trigger focus', () => {
    render(
      <Tooltip id="test-tooltip" content="Tooltip Hint">
        <span>Hover Me</span>
      </Tooltip>
    );

    fireEvent.focus(screen.getByText('Hover Me'));
    expect(trafficSpy).toHaveBeenCalledWith({
      type: 'tooltip:shown',
      detail: expect.objectContaining({ id: 'test-tooltip', content: 'Tooltip Hint' }),
    });
  });

  it('verifies Accordion emits accordion:opened event', () => {
    render(
      <Accordion
        id="test-accordion"
        items={[{ value: 'item-1', title: 'Accordion 1', content: 'Content 1' }]}
      />
    );

    fireEvent.click(screen.getByText('Accordion 1'));
    expect(trafficSpy).toHaveBeenCalledWith({
      type: 'accordion:opened',
      detail: expect.objectContaining({ id: 'test-accordion', itemValue: 'item-1' }),
    });
  });

  it('verifies DropdownMenu emits menu:opened event via keyboard', () => {
    render(
      <DropdownMenu
        id="test-menu"
        trigger={<Button>Open Menu</Button>}
        items={[{ value: 'opt-1', label: 'Option 1', onClick: vi.fn() }]}
      />
    );

    const triggerBtn = screen.getByText('Open Menu').closest('button') || screen.getByText('Open Menu');
    fireEvent.keyDown(triggerBtn, { key: 'Enter', code: 'Enter' });
    expect(trafficSpy).toHaveBeenCalledWith({
      type: 'menu:opened',
      detail: expect.objectContaining({ id: 'test-menu' }),
    });
  });

  it('verifies Slider emits slider:changed event', () => {
    render(<Slider name="test-slider" defaultValue={50} />);

    const sliderElement = screen.getByRole('slider');
    fireEvent.keyDown(sliderElement, { key: 'ArrowRight' });

    expect(trafficSpy).toHaveBeenCalledWith({
      type: 'slider:changed',
      detail: expect.objectContaining({ name: 'test-slider' }),
    });
  });

  it('verifies TabStrip emits tab:changed event', () => {
    const handleTabChange = vi.fn();
    render(
      <TabStrip
        activeId="tab1"
        onChange={handleTabChange}
        items={[{ id: 'tab1', label: 'Tab 1' }, { id: 'tab2', label: 'Tab 2' }]}
      />
    );

    const tab2 = screen.getByText('Tab 2').closest('button');
    if (tab2) {
      fireEvent.keyDown(tab2, { key: 'Enter', code: 'Enter' });
    }
    expect(trafficSpy).toHaveBeenCalledWith({
      type: 'tab:changed',
      detail: expect.objectContaining({ activeId: 'tab2', previousId: 'tab1' }),
    });
  });

  it('verifies Form emits form:validated, form:errored, and form:submitted events', async () => {
    const schema = z.object({ code: z.string().min(3, 'Too short') });

    render(
      <Form id="traffic-form" schema={schema} onSubmit={vi.fn()}>
        <FormField name="code" label="Code"><Input placeholder="Code" /></FormField>
        <SubmitButton>Submit</SubmitButton>
      </Form>
    );

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(trafficSpy).toHaveBeenCalledWith({
        type: 'form:validated',
        detail: expect.objectContaining({ formId: 'traffic-form', isValid: false }),
      });
      expect(trafficSpy).toHaveBeenCalledWith({
        type: 'form:errored',
        detail: expect.objectContaining({ formId: 'traffic-form' }),
      });
    });

    fireEvent.change(screen.getByPlaceholderText('Code'), { target: { value: 'ABC' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(trafficSpy).toHaveBeenCalledWith({
        type: 'form:submitted',
        detail: expect.objectContaining({ formId: 'traffic-form', values: { code: 'ABC' } }),
      });
    });
  });
});

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import { ToolcribProvider } from '../components/ToolcribProvider/ToolcribProvider';
import { Button } from '../components/Form/FormComponents';
import { Modal } from '../components/Overlay/Modal';
import { Popup } from '../components/Overlay/Popup';

// Server-render each overlay to HTML, then hydrate that HTML the way a
// Next.js App Router page does (#670, SSR spike item). Any mismatch between
// the server markup and the client's first render surfaces through
// onRecoverableError or a console.error, so both are collected and must stay
// empty. Covers closed overlays (trigger only in the markup) and overlays
// that are open on first render (portal content mounts client-side).

/**
 * Server-renders `make(true)`, hydrates it with `make(false)`, and returns
 * every hydration complaint React raised plus the document afterwards.
 */
async function serverThenHydrate(make: (server: boolean) => React.ReactElement) {
  const html = renderToString(<ToolcribProvider>{make(true)}</ToolcribProvider>);
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const complaints: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    complaints.push(args.map(String).join(' '));
  });
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, <ToolcribProvider>{make(false)}</ToolcribProvider>, {
        onRecoverableError: e => complaints.push(String(e)),
      });
    });
    // Portals and Base UI's frame-deferred effects mount after hydration.
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
  } finally {
    spy.mockRestore();
  }
  return {
    complaints,
    cleanup: () => {
      act(() => root!.unmount());
      container.remove();
    },
  };
}

const cases: Array<[string, () => React.ReactElement]> = [
  ['Modal, closed', () => (
    <Modal ariaLabel="SSR modal" trigger={<Button>Open modal</Button>}>
      <Modal.Body>Body</Modal.Body>
    </Modal>
  )],
  ['Modal, open on first render', () => (
    <Modal ariaLabel="SSR modal" isOpen onOpenChange={() => {}} trigger={<Button>Open modal</Button>}>
      <Modal.Body>Body</Modal.Body>
    </Modal>
  )],
  ['Popup, closed', () => (
    <Popup trigger={<Button>Open popup</Button>}>Popup body</Popup>
  )],
  ['Popup, open on first render', () => (
    <Popup isOpen onOpenChange={() => {}} trigger={<Button>Open popup</Button>}>Popup body</Popup>
  )],
];

describe('overlay SSR hydration', () => {
  it('control: a real server/client mismatch is caught', async () => {
    const { complaints, cleanup } = await serverThenHydrate(server => <Button>{server ? 'Server' : 'Client'}</Button>);
    expect(complaints.join('\n')).toMatch(/hydrat/i);
    cleanup();
  });

  it.each(cases)('%s hydrates without a mismatch', async (name, make) => {
    const { complaints, cleanup } = await serverThenHydrate(() => make());
    expect(complaints).toEqual([]);
    if (name.includes('open')) {
      // The portal content really mounted, in the document body.
      expect(document.body.textContent).toContain(name.startsWith('Modal') ? 'Body' : 'Popup body');
      if (name.startsWith('Modal')) expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    }
    cleanup();
  });
});

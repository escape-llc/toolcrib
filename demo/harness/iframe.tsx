// e2e harness (#670), served by the dev server at /demo/harness/iframe.html
// and never linked from the demo. The React root lives in this page, but the
// overlays render into an iframe's document through ThemeProvider's
// targetDocument, the same setup as the demo's live Wireframe Gallery tiles
// (LiveIframe in App.tsx). e2e/iframe-overlays.spec.ts drives it to check
// that an overlay library's focus trap, outside-press, background hiding and
// scroll lock act on the iframe's document rather than this one.
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
// No demo/index.css: it pins html/body to overflow: hidden (the demo scrolls
// in its own region), which would make the scroll-lock check meaningless.
import { Button, Modal, Popup, Text, ThemeProvider, ToolcribProvider, VStack } from '#toolcrib';

const Overlays: React.FC = () => (
  <VStack>
    <Button>Background button</Button>
    <Modal ariaLabel="Iframe modal" trigger={<Button>Open modal</Button>}>
      <Modal.Header>Iframe modal</Modal.Header>
      <Modal.Body>
        <VStack>
          <Button>First inside</Button>
          <Button>Second inside</Button>
        </VStack>
      </Modal.Body>
      <Modal.Footer>
        <Modal.CloseButton />
      </Modal.Footer>
    </Modal>
    <Popup trigger={<Button>Open popup</Button>}>
      <Text>Popup body</Text>
      <Button>Popup action</Button>
    </Popup>
    {/* Tall enough that the iframe's document scrolls, so scroll lock is observable. */}
    {Array.from({ length: 40 }, (_, i) => (
      <Text key={i}>Filler line {i + 1}</Text>
    ))}
  </VStack>
);

const Harness: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountDoc, setMountDoc] = useState<Document | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const setup = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
        doc.head.appendChild(node.cloneNode(true));
      });
      setMountDoc(doc);
    };
    if (iframe.contentDocument?.readyState === 'complete') setup();
    else iframe.addEventListener('load', setup);
    return () => iframe.removeEventListener('load', setup);
  }, []);

  return (
    <VStack>
      <Button>Outer page button</Button>
      {/* Same-document control: tells an iframe-specific failure from a
          general one in the same engine. */}
      <Modal ariaLabel="Outer modal" trigger={<Button>Open outer modal</Button>}>
        <Modal.Body>
          <VStack>
            <Button>First inside</Button>
            <Button>Second inside</Button>
          </VStack>
        </Modal.Body>
        <Modal.Footer>
          <Modal.CloseButton />
        </Modal.Footer>
      </Modal>
      {/* Raw element: nothing in toolcrib renders an iframe. Sized with theme
          vars and rem only. */}
      <iframe
        ref={iframeRef}
        title="Overlay frame"
        style={{ width: '40rem', height: '25rem', border: '0.0625rem solid var(--ai-border, #e5e7eb)' }}
      />
      {mountDoc &&
        createPortal(
          <ThemeProvider targetDocument={mountDoc}>
            <Overlays />
          </ThemeProvider>,
          mountDoc.body
        )}
    </VStack>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToolcribProvider>
      <Harness />
    </ToolcribProvider>
  </React.StrictMode>
);

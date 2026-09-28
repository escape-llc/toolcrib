// e2e harness (#696), served by the dev server at
// /demo/harness/nested-overlays.html and never linked from the demo. A
// DatePicker and a DateRangePicker inside a Modal: their calendars are Popups
// portalled outside the dialog's DOM, so which overlay one Escape closes
// depends on the overlay library knowing the popup is nested in the dialog.
// jsdom can't check that (it never moves focus into the nested popup), so
// e2e/nested-overlay-escape.spec.ts does, in real browsers.
//
// window.modalCloseRequests counts onOpenChange(false) calls, not every
// change, so the spec asserts on what the Modal was asked to do.
import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CalendarDate } from '@internationalized/date';
import { Button, DatePicker, DateRangePicker, Modal, ToolcribProvider, VStack } from '#toolcrib';

declare global {
  interface Window {
    modalCloseRequests: number;
  }
}
window.modalCloseRequests = 0;

const Harness = () => {
  const [open, setOpen] = useState(false);
  return (
    <Modal
      ariaLabel="Host modal"
      isOpen={open}
      onOpenChange={next => {
        if (!next) window.modalCloseRequests++;
        setOpen(next);
      }}
      trigger={<Button>Open host modal</Button>}
    >
      <Modal.Body>
        <VStack>
          <DatePicker name="single" label="Single date" defaultValue={new CalendarDate(2026, 3, 15)} />
          <DateRangePicker name="range" label="Date range" defaultValue={{ start: new CalendarDate(2026, 3, 15), end: new CalendarDate(2026, 3, 18) }} />
        </VStack>
      </Modal.Body>
    </Modal>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ToolcribProvider>
    <Harness />
  </ToolcribProvider>
);

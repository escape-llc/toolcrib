import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { FileUpload } from '../components/Form/FileUpload';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

// jsdom doesn't implement createObjectURL/revokeObjectURL — FileUpload
// calls these for any image file's thumbnail preview.
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

function makeFile(name: string, sizeBytes: number, type = 'text/plain'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('FileUpload Component — selecting files', () => {
  it('adds a file selected via the hidden native input to the list', () => {
    const onFilesChange = vi.fn();
    render(<FileUpload onFilesChange={onFilesChange} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('report.txt', 1024);

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('report.txt')).toBeInTheDocument();
    expect(onFilesChange).toHaveBeenCalledWith([expect.objectContaining({ file, status: 'pending' })]);
  });

  it('ignores dropped files and disables the native input when disabled', () => {
    render(<FileUpload disabled />);
    const dropzone = screen.getByRole('button');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeDisabled();

    fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile('a.txt', 10)] } });
    expect(screen.queryByText('a.txt')).not.toBeInTheDocument();
  });

  it('keeps only the most recently selected file when multiple is false', () => {
    render(<FileUpload multiple={false} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile('first.txt', 10)] } });
    expect(screen.getByText('first.txt')).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [makeFile('second.txt', 10)] } });
    expect(screen.queryByText('first.txt')).not.toBeInTheDocument();
    expect(screen.getByText('second.txt')).toBeInTheDocument();
  });

  it('adds files dropped onto the dropzone', () => {
    render(<FileUpload />);
    const dropzone = screen.getByRole('button');
    const file = makeFile('photo.png', 2048, 'image/png');

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(screen.getByText('photo.png')).toBeInTheDocument();
  });

  it('renders an image thumbnail via an object URL, and revokes it on removal', () => {
    render(<FileUpload />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('photo.png', 2048, 'image/png');
    fireEvent.change(input, { target: { files: [file] } });

    // alt="" is intentional (the thumbnail is decorative, redundant with
    // the filename text already shown) — that correctly makes it
    // role="presentation" rather than "img", so query the DOM directly.
    const img = document.querySelector('img') as HTMLImageElement;
    expect(img.src).toBe('blob:mock-url');
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);

    fireEvent.click(screen.getByLabelText('Remove photo.png'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(screen.queryByText('photo.png')).not.toBeInTheDocument();
  });

  it('rejects a file over maxSizeBytes without adding it', () => {
    render(<FileUpload maxSizeBytes={1024} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('huge.txt', 2048);

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.queryByText('huge.txt')).not.toBeInTheDocument();
    expect(screen.getByText(/exceeds 1\.0 KB limit/)).toBeInTheDocument();
  });

  it('rejects files past maxFiles', () => {
    render(<FileUpload maxFiles={1} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const [a, b] = [makeFile('a.txt', 10), makeFile('b.txt', 10)];

    fireEvent.change(input, { target: { files: [a, b] } });

    expect(screen.getByText('a.txt')).toBeInTheDocument();
    expect(screen.queryByText('b.txt')).not.toBeInTheDocument();
    expect(screen.getByText(/too many files/)).toBeInTheDocument();
  });

  it('emits fileupload:changed with the current file count', () => {
    const changedFn = vi.fn();
    const unsub = aiBus.on('fileupload:changed', changedFn);
    render(<FileUpload name="attachments" />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile('a.txt', 10)] } });

    expect(changedFn).toHaveBeenCalledWith({ name: 'attachments', fileCount: 1 });
    unsub();
  });
});

describe('FileUpload Component — upload transport', () => {
  it('reports progress and transitions to done on a successful upload', async () => {
    let reportProgress: (pct: number) => void = () => {};
    const onUpload = vi.fn(
      (_file: File, onProgress: (pct: number) => void) =>
        new Promise<void>(resolve => {
          reportProgress = onProgress;
          (globalThis as any).__resolveUpload = resolve;
        })
    );

    render(<FileUpload onUpload={onUpload} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('a.txt', 10)] } });

    expect(onUpload).toHaveBeenCalled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    reportProgress(50);
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50'));

    (globalThis as any).__resolveUpload();
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    expect(screen.getByText('a.txt')).toBeInTheDocument();
  });

  it('shows an error and a Retry action when the upload rejects, and retrying re-invokes onUpload', async () => {
    const onUpload = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(undefined);

    render(<FileUpload onUpload={onUpload} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('a.txt', 10)] } });

    await waitFor(() => expect(screen.getByText(/Network error/)).toBeInTheDocument());
    expect(screen.getByText('Retry')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Retry'));
    expect(onUpload).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByText(/Network error/)).not.toBeInTheDocument());
  });

  // Regression: status transitions (done/error, a retry) used to update
  // item state via a raw setItems call that bypassed the notifyChange
  // helper entirely, so onFilesChange/fileupload:changed only ever fired
  // for add/remove — never for the "status change" half of the component's
  // own documented contract.
  it('calls onFilesChange again when an upload transitions to done, not just when the file was added', async () => {
    const onFilesChange = vi.fn();
    const onUpload = vi.fn().mockResolvedValue(undefined);

    render(<FileUpload onUpload={onUpload} onFilesChange={onFilesChange} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('a.txt', 10)] } });

    expect(onFilesChange).toHaveBeenCalledWith([expect.objectContaining({ status: 'uploading' })]);

    await waitFor(() =>
      expect(onFilesChange).toHaveBeenLastCalledWith([expect.objectContaining({ status: 'done', progress: 100 })])
    );
  });

  it('emits a fresh fileupload:changed when an upload errors out', async () => {
    const changedFn = vi.fn();
    const unsub = aiBus.on('fileupload:changed', changedFn);
    const onUpload = vi.fn().mockRejectedValue(new Error('boom'));

    render(<FileUpload onUpload={onUpload} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('a.txt', 10)] } });

    const callsAfterAdd = changedFn.mock.calls.length;
    await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument());
    expect(changedFn.mock.calls.length).toBeGreaterThan(callsAfterAdd);

    unsub();
  });
});

describe('FileUpload Component — React StrictMode', () => {
  // Regression: found via a generated storyboard screenshot's own live
  // event log, not by reasoning about the code — a real
  // fileupload:changed({fileCount:0})/onFilesChange([]) fired on mount
  // under StrictMode, before any file was ever added. StrictMode's dev-only
  // double-invocation of effects (mount, simulate unmount, simulate
  // remount) let the "skip the first run" guard get consumed by the first
  // invocation and never reset for the second, so the second invocation's
  // effect body ran for real with the still-empty initial items array. The
  // demo app renders everything inside <React.StrictMode>, so this was a
  // real bug a plain (non-StrictMode) render — every other test in this
  // file — can't surface at all.
  it('does not fire onFilesChange/fileupload:changed on mount, even under StrictMode double-invocation', () => {
    const onFilesChange = vi.fn();
    const changedFn = vi.fn();
    const unsub = aiBus.on('fileupload:changed', changedFn);

    render(
      <React.StrictMode>
        <FileUpload onFilesChange={onFilesChange} />
      </React.StrictMode>
    );

    expect(onFilesChange).not.toHaveBeenCalled();
    expect(changedFn).not.toHaveBeenCalled();
    unsub();
  });
});

describe('FileUpload Component — Form binding', () => {
  it('inherits its name from the surrounding FormField and shows its validation error on first submit', async () => {
    const schema = z.object({ attachments: z.array(z.any()).min(1, 'At least one file is required') });
    const handleSubmit = vi.fn();

    render(
      <Form id="upload-form" schema={schema} initialValues={{ attachments: [] }} onSubmit={handleSubmit}>
        <FormField name="attachments" label="Attachments">
          <FileUpload />
        </FormField>
        <SubmitButton>Submit</SubmitButton>
      </Form>
    );

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('At least one file is required')).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});

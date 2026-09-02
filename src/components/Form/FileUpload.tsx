/* eslint-disable react-hooks/refs -- previewUrlsRef is read during render
   (line ~308, looking up an already-created object URL to display) but is
   only ever WRITTEN inside real event handlers (addFiles/removeItem
   above) or an unmount-cleanup effect -- never during render itself. A
   render-time read of a ref that's never mutated during render doesn't
   have the actual "torn value from a discarded/concurrent render" failure
   mode this rule guards against; it's equivalent to reading any other
   stable, externally-populated side table. Kept as a ref rather than
   folded into `items` state deliberately -- these are Blob object URLs,
   not serializable data that should trigger their own re-render cycle. */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useOptionalFormContext } from './FormContext';
import { FieldContext } from './FieldContext';
import { Button } from './FormComponents';
import { Progress } from '../Progress/Progress';
import { AspectRatio } from '../Layout/AspectRatio';
import { aiBus } from '../../eventBus/eventBus';
import { getSparseVariables } from '../../theme/slice';
import { FileUploadThemeSlice, type FileUploadSliceState, type FileUploadDensity } from './FileUploadSlice';
import { CONTROL_FONT_SIZE_VAR, type ControlSize } from '../../theme/controlSize';

const SIZE_TO_DENSITY: Record<ControlSize, FileUploadDensity> = {
  sm: 'compact',
  md: 'normal',
  lg: 'spacious',
};

/** A single file's upload lifecycle, tracked internally by `<FileUpload>`. */
export interface FileUploadItem {
  /** Stable id for this item, independent of `File` identity. */
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  /** 0-100. Only meaningful while `status === 'uploading'`. */
  progress: number;
  error?: string;
}

/** Props for the `<FileUpload>` drag-and-drop file picker. */
export interface FileUploadProps {
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. */
  name?: string;
  /** Native `accept` attribute, e.g. `'image/*'` or `'.pdf,.docx'`. */
  accept?: string;
  /** Allow selecting/dropping more than one file at once. @default true */
  multiple?: boolean;
  /** Reject files larger than this, shown as a per-file error instead of starting an upload. */
  maxSizeBytes?: number;
  /** Cap on total accepted files. Extras dropped/selected past this are rejected. */
  maxFiles?: number;
  /** If true, the dropzone is non-interactive. */
  disabled?: boolean;
  /**
   * Upload transport — toolcrib has no opinion on the backend protocol, so
   * this is entirely consumer-supplied. Called once per accepted file;
   * report progress via the given callback (0-100). Omit to just collect
   * files without uploading them (e.g. to upload them all together on a
   * later form submit instead).
   */
  onUpload?: (file: File, onProgress: (percent: number) => void) => Promise<void>;
  /** Fired whenever the accepted file list changes (add, remove, or status change). */
  onFilesChange?: (files: FileUploadItem[]) => void;
  /** Per-instance override for dropzone padding density. `overrides.density` wins over `size` below if both are set. */
  overrides?: Partial<FileUploadSliceState>;
  /** Control size, standardized with `<Button>` and every other sized control — maps onto the same `density` scale as `overrides.density` (`sm`→`'compact'`, `md`→`'normal'`, `lg`→`'spacious'`) and scales the dropzone's own label text. @default 'md' */
  size?: ControlSize;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @manifest Drag-and-drop file picker with per-file progress and image thumbnails, bound to Form context
 * @manifestCategory Form Controls
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  name: propName,
  accept,
  multiple = true,
  maxSizeBytes,
  maxFiles,
  disabled = false,
  onUpload,
  onFilesChange,
  overrides,
  size = 'md',
}) => {
  const fieldCtx = useContext(FieldContext);
  const fieldName = propName || fieldCtx.name || '';
  const formContext = useOptionalFormContext();
  const registerField = formContext?.registerField;
  const fileUploadVars = getSparseVariables(FileUploadThemeSlice, { density: SIZE_TO_DENSITY[size], ...overrides });
  const inputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(0);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());

  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [rejections, setRejections] = useState<string[]>([]);

  useEffect(() => {
    if (fieldName && registerField) registerField(fieldName);
  }, [fieldName, registerField]);

  // Object URLs are only released here (removal/unmount), never recreated
  // on every render — createObjectURL is called exactly once per file, in
  // addFiles below, and cached in this ref by item id.
  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Fires onFilesChange/the event bus/Form binding from a single place keyed
  // on `items` itself, rather than from each call site that changes it
  // (the previous notifyChange(next) helper) — status transitions
  // (done/error, a retry) happen asynchronously inside startUpload's
  // .then()/.catch(), well after the add/remove call that originally
  // triggered them, so there's no single "next" value those call sites can
  // hand a helper directly. Matches Progress.tsx's own precedent (emitting
  // progress:changed from a useEffect on its value) rather than putting the
  // emit inside a setState updater function, which FormContext.tsx's own
  // comment on setFieldValue already documents as unsafe — React 18
  // StrictMode invokes updaters twice in dev specifically to catch impure
  // ones, so a bus emit/callback inside one double-fires.
  const isMountRef = useRef(true);
  // Reset in a SEPARATE, empty-deps effect's cleanup — not inline in the
  // items-watching effect below — specifically to survive React 18
  // StrictMode's dev-only double-invocation of effects on mount (render →
  // run effects → simulate unmount → simulate remount → run effects again).
  // A guard reset inside the [items] effect's own cleanup would reset on
  // every real items change too (that effect's cleanup runs before every
  // re-run, not just on unmount), permanently defeating it after the first
  // one; scoping the reset to a mount/unmount-only effect confines it to
  // exactly StrictMode's double-invoke, confirmed by a real spurious
  // fileupload:changed({fileCount:0}) firing on mount before this split —
  // caught via the generated storyboard screenshot's own event log, not
  // just reasoning about it.
  useEffect(() => {
    return () => {
      isMountRef.current = true;
    };
  }, []);
  useEffect(() => {
    if (isMountRef.current) {
      isMountRef.current = false;
      return;
    }
    aiBus.emit('fileupload:changed', { name: fieldName, fileCount: items.length });
    if (onFilesChange) onFilesChange(items);
    if (fieldName && formContext) {
      formContext.setFieldValue(fieldName, items.map(i => i.file));
      formContext.setFieldTouched(fieldName, true);
    }
    // fieldName/formContext/onFilesChange intentionally excluded — see
    // FormContext.tsx's own registerField comment on why depending on the
    // whole formContext object (recreated every render) would re-fire this
    // on every keystroke anywhere in the form, not just this component's
    // own item changes.
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const startUpload = (item: FileUploadItem) => {
    if (!onUpload) return;
    const setProgress = (percent: number) => {
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, progress: percent } : i)));
    };
    onUpload(item.file, setProgress)
      .then(() => {
        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'done', progress: 100 } : i)));
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'error', error: message } : i)));
      });
  };

  const addFiles = (fileList: FileList | File[]) => {
    if (disabled) return;
    const incoming = Array.from(fileList);
    const rejected: string[] = [];
    const accepted: FileUploadItem[] = [];

    const remainingSlots = maxFiles !== undefined ? Math.max(0, maxFiles - items.length) : Infinity;

    for (const file of incoming) {
      if (accepted.length >= remainingSlots) {
        rejected.push(`${file.name}: too many files (max ${maxFiles})`);
        continue;
      }
      if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
        rejected.push(`${file.name}: exceeds ${formatBytes(maxSizeBytes)} limit`);
        continue;
      }
      const id = `file-${nextIdRef.current++}`;
      if (file.type.startsWith('image/')) {
        previewUrlsRef.current.set(id, URL.createObjectURL(file));
      }
      // Starts 'uploading' immediately (not 'pending' then mutated after
      // the fact) whenever there's a transport to run — status has to be
      // correct in the very state object handed to notifyChange/setState
      // below, since mutating it afterward wouldn't trigger a re-render.
      accepted.push({ id, file, status: onUpload ? 'uploading' : 'pending', progress: 0 });
    }

    setRejections(rejected);
    if (accepted.length === 0) return;

    const next = multiple ? [...items, ...accepted] : accepted.slice(0, 1);
    // Dropping previous single-mode selections' previews so they don't leak.
    if (!multiple) {
      items.forEach(i => {
        const url = previewUrlsRef.current.get(i.id);
        if (url) {
          URL.revokeObjectURL(url);
          previewUrlsRef.current.delete(i.id);
        }
      });
    }
    setItems(next);
    accepted.forEach(item => startUpload(item));
  };

  const removeItem = (id: string) => {
    const url = previewUrlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(id);
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const retryItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setItems(prev => prev.map(i => (i.id === id ? { ...i, status: 'uploading', error: undefined, progress: 0 } : i)));
    startUpload({ ...item, status: 'uploading' });
  };

  return (
    <div style={{ width: '100%' }}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={e => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={e => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          if (!disabled && e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        className="ai-focus-ring"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: 'var(--ai-fileupload-dropzone-padding, 1.5rem)',
          borderRadius: 'var(--ai-radius-md, 0.375rem)',
          border: `0.125rem dashed ${isDragOver ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
          background: isDragOver ? 'color-mix(in srgb, var(--ai-color-primary, #3b82f6) 8%, transparent)' : 'var(--ai-bg-container, #f9fafb)',
          boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          outline: 'none',
          textAlign: 'center',
          transition: 'border-color 0.15s ease, background 0.15s ease',
          ...fileUploadVars,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={e => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
          style={{ display: 'none' }}
        />
        <span style={{ fontSize: CONTROL_FONT_SIZE_VAR[size], color: 'var(--ai-text-primary, #111827)' }}>
          Drag and drop {multiple ? 'files' : 'a file'} here, or click to browse
        </span>
        {accept && (
          <span style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary, #6b7280)' }}>Accepted: {accept}</span>
        )}
      </div>

      {rejections.length > 0 && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          {rejections.map((r, i) => (
            <span key={i} style={{ fontSize: '0.75rem', color: 'var(--ai-subtheme-error, #ef4444)' }}>{r}</span>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map(item => {
            const previewUrl = previewUrlsRef.current.get(item.id);
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem',
                  border: '0.0625rem solid var(--ai-border, #e5e7eb)',
                  borderRadius: 'var(--ai-radius-md, 0.375rem)',
                  background: 'var(--ai-bg-surface, #ffffff)',
                }}
              >
                {previewUrl && (
                  <div style={{ width: '2.5rem', flexShrink: 0 }}>
                    <AspectRatio ratio={1}>
                      <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--ai-radius-sm, 0.25rem)' }} />
                    </AspectRatio>
                  </div>
                )}
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--ai-text-primary, #111827)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.file.name}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--ai-text-secondary, #6b7280)' }}>
                    {formatBytes(item.file.size)}
                    {item.status === 'error' && ` · ${item.error}`}
                  </span>
                  {item.status === 'uploading' && (
                    <Progress id={item.id} value={item.progress} size="sm" aria-label={`Uploading ${item.file.name}`} />
                  )}
                </div>
                {item.status === 'error' && (
                  <Button size="sm" variant="outline" onClick={() => retryItem(item.id)}>Retry</Button>
                )}
                <Button size="sm" variant="ghost" aria-label={`Remove ${item.file.name}`} onClick={() => removeItem(item.id)}>✕</Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

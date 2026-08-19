import React, { ReactNode, useState } from 'react';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { SubthemeName } from '../../theme/subtheme';
import { Grid } from '../Layout/Grid';
import { DeferredContent } from '../Layout/DeferredContent';
import { Viewer } from '../Viewer/Viewer';
import { GalleryThemeSlice, GallerySliceState } from './GallerySlice';

/** Data shape for each item in a `<Gallery>`. */
export interface GalleryItem {
  /** Unique identifier for this item. */
  id: string;
  /** Thumbnail image source shown in the grid. */
  thumbnailSrc: string;
  /** Full-resolution image source opened in the `<Viewer>` (or passed to `onItemClick`). */
  fullSrc: string;
  /** Alt text, used for both the thumbnail and the full-resolution image. */
  alt?: string;
  /** Optional caption shown in the `<Viewer>` for this item. */
  caption?: ReactNode;
}

/**
 * Props for the `<Gallery>` thumbnail grid.
 *
 * Composition, not new interaction logic: a `<Grid>` of thumbnails, each
 * deferred via `<DeferredContent>` so a gallery of hundreds of items
 * doesn't pay full render/paint cost for off-screen ones, opening a
 * `<Viewer>` on click by default.
 */
export interface GalleryProps {
  /** Unique identifier for event bus targeting (forwarded to the internal `<Viewer>`). Auto-generated if omitted. */
  id?: string;
  /** Array of items to render. */
  items: GalleryItem[];
  /**
   * Number of columns, or `'auto-fit'`/`'auto-fill'` for responsive
   * behaviour — passed straight through to `<Grid>`'s own prop.
   * @default 'auto-fit'
   */
  columns?: number | 'auto-fit' | 'auto-fill';
  /**
   * Custom click handler, called instead of the default "open in
   * `<Viewer>`" behaviour. Use this to host `<ViewerContent>` in a
   * `<Drawer>`/`<Popup>`/anywhere else of your own choosing — `<Gallery>`
   * itself doesn't need to know or care which shell you pick.
   */
  onItemClick?: (item: GalleryItem, index: number) => void;
  /** Per-instance overrides for thumbnail aspect ratio. */
  overrides?: Partial<GallerySliceState> & { subtheme?: SubthemeName };
}

/**
 * @manifest Thumbnail grid with lazy-rendered items, opening a fullscreen Viewer by default
 * @manifestCategory Data Display
 */
export const Gallery: React.FC<GalleryProps> = ({
  id: propId,
  items,
  columns = 'auto-fit',
  onItemClick,
  overrides,
}) => {
  const id = useStableId(propId, 'gallery');
  const { vars } = useSliceOverrides(GalleryThemeSlice, overrides);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const handleItemClick = (item: GalleryItem, index: number) => {
    if (onItemClick) {
      onItemClick(item, index);
    } else {
      setViewerIndex(index);
    }
  };

  const viewerItems = items.map(item => ({ id: item.id, src: item.fullSrc, alt: item.alt, caption: item.caption }));

  return (
    <div style={{ width: '100%', ...vars }}>
      <Grid columns={columns}>
        {items.map((item, index) => (
          <DeferredContent key={item.id} estimatedHeight={200}>
            <button
              type="button"
              onClick={() => handleItemClick(item, index)}
              aria-label={item.alt ?? `Open item ${index + 1}`}
              className="ai-btn"
              style={{
                display: 'block',
                width: '100%',
                padding: 0,
                border: '0.0625rem solid var(--ai-border, #e5e7eb)',
                borderRadius: 'var(--ai-radius-md, 0.375rem)',
                overflow: 'hidden',
                cursor: 'pointer',
                ['--ai-btn-bg' as string]: 'transparent',
              }}
            >
              <img
                src={item.thumbnailSrc}
                alt={item.alt ?? ''}
                style={{
                  display: 'block',
                  width: '100%',
                  aspectRatio: 'var(--ai-gallery-thumbnail-aspect-ratio, 1 / 1)',
                  objectFit: 'cover',
                }}
              />
            </button>
          </DeferredContent>
        ))}
      </Grid>

      <Viewer
        id={id}
        items={viewerItems}
        isOpen={viewerIndex !== null}
        activeIndex={viewerIndex ?? 0}
        onIndexChange={setViewerIndex}
        onOpenChange={open => {
          if (!open) setViewerIndex(null);
        }}
      />
    </div>
  );
};

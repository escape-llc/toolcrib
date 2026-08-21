import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    gallery: Partial<GallerySliceState>;
  }
}

/** @barrelExport */
export type GalleryThumbnailAspectRatio = 'square' | 'landscape' | 'portrait' | 'auto';

export interface GallerySliceState {
  thumbnailAspectRatio: GalleryThumbnailAspectRatio;
}

export interface GalleryCSSVariables extends Record<string, string> {
  '--ai-gallery-thumbnail-aspect-ratio': string;
}

export const defaultGalleryState: GallerySliceState = {
  thumbnailAspectRatio: 'square',
};

const aspectRatioMap: Record<GalleryThumbnailAspectRatio, string> = {
  square: '1 / 1',
  landscape: '16 / 9',
  portrait: '3 / 4',
  auto: 'auto',
};

export function getGalleryVariables(state: GallerySliceState = defaultGalleryState): GalleryCSSVariables {
  return {
    '--ai-gallery-thumbnail-aspect-ratio': aspectRatioMap[state.thumbnailAspectRatio] || aspectRatioMap.square,
  };
}

export const GalleryThemeSlice: ThemeSlice<GallerySliceState, GalleryCSSVariables> = {
  id: 'gallery',
  name: '🖼️ Gallery Thumbnail Aspect Ratio',
  category: 'Data Display',
  defaultState: defaultGalleryState,
  getCSSVariables: getGalleryVariables,
  renderEditorControl: (state, onChange) => (
    <FieldRow
      label="Gallery Thumbnail Aspect Ratio"
      value={state.thumbnailAspectRatio}
      onChange={val => onChange({ ...state, thumbnailAspectRatio: val as GalleryThumbnailAspectRatio })}
      options={[
        { label: 'Square (1:1)', value: 'square' },
        { label: 'Landscape (16:9)', value: 'landscape' },
        { label: 'Portrait (3:4)', value: 'portrait' },
        { label: 'Auto (Natural Image Ratio)', value: 'auto' },
      ]}
    />
  ),
  fieldVars: {
    thumbnailAspectRatio: ['--ai-gallery-thumbnail-aspect-ratio'],
  },
};

import { ThemeSlice } from '../../theme/slice';

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
  fieldVars: {
    thumbnailAspectRatio: ['--ai-gallery-thumbnail-aspect-ratio'],
  },
};

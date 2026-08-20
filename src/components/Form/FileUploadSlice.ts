import { type ThemeSlice } from '../../theme/slice';

/** @barrelExport */
export type FileUploadDensity = 'compact' | 'normal' | 'spacious';

export interface FileUploadSliceState {
  density: FileUploadDensity;
}

export interface FileUploadCSSVariables extends Record<string, string> {
  '--ai-fileupload-dropzone-padding': string;
}

export const defaultFileUploadState: FileUploadSliceState = {
  density: 'normal',
};

const paddingMap: Record<FileUploadDensity, string> = {
  compact: '1rem',
  normal: '1.5rem',
  spacious: '2.25rem',
};

export function getFileUploadVariables(state: FileUploadSliceState = defaultFileUploadState): FileUploadCSSVariables {
  return {
    '--ai-fileupload-dropzone-padding': paddingMap[state.density] || paddingMap.normal,
  };
}

export const FileUploadThemeSlice: ThemeSlice<FileUploadSliceState, FileUploadCSSVariables> = {
  id: 'fileUpload',
  name: '📤 File Upload Dropzone Density',
  category: 'Form Controls',
  defaultState: defaultFileUploadState,
  getCSSVariables: getFileUploadVariables,
  fieldVars: {
    density: ['--ai-fileupload-dropzone-padding'],
  },
};

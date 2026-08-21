import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    fileUpload: Partial<FileUploadSliceState>;
  }
}

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
  renderEditorControl: (state, onChange) => (
    <FieldRow
      label="File Upload Dropzone Density"
      value={state.density}
      onChange={val => onChange({ ...state, density: val as FileUploadDensity })}
      options={[
        { label: 'Compact', value: 'compact' },
        { label: 'Normal', value: 'normal' },
        { label: 'Spacious', value: 'spacious' },
      ]}
    />
  ),
  fieldVars: {
    density: ['--ai-fileupload-dropzone-padding'],
  },
};

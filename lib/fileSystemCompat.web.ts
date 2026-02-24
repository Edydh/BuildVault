type FileInfoLike = {
  exists: boolean;
  isDirectory?: boolean;
  uri: string;
  size?: number;
};

type DownloadResultLike = {
  uri: string;
  status?: number;
  headers?: Record<string, string>;
};

type UploadResultLike = {
  status: number;
  body?: string;
  headers?: Record<string, string>;
};

export const documentDirectory = 'file:///web/buildvault/';
export const cacheDirectory = 'file:///web/buildvault-cache/';

export const EncodingType = { Base64: 'base64' } as const;
export const FileSystemUploadType = { BINARY_CONTENT: 0 } as const;

export async function getInfoAsync(uri: string): Promise<FileInfoLike> {
  return {
    exists: false,
    isDirectory: false,
    uri,
    size: 0,
  };
}

export async function makeDirectoryAsync(): Promise<void> {}

export async function deleteAsync(): Promise<void> {}

export async function copyAsync(): Promise<void> {}

export async function moveAsync(): Promise<void> {}

export async function readAsStringAsync(): Promise<string> {
  throw new Error('expo-file-system read is not available on web');
}

export async function writeAsStringAsync(): Promise<void> {
  throw new Error('expo-file-system write is not available on web');
}

export async function downloadAsync(uri: string): Promise<DownloadResultLike> {
  return { uri, status: 200, headers: {} };
}

export async function uploadAsync(): Promise<UploadResultLike> {
  return { status: 501, body: 'expo-file-system upload is not available on web', headers: {} };
}

const FileSystem = {
  documentDirectory,
  cacheDirectory,
  EncodingType,
  FileSystemUploadType,
  getInfoAsync,
  makeDirectoryAsync,
  deleteAsync,
  copyAsync,
  moveAsync,
  readAsStringAsync,
  writeAsStringAsync,
  downloadAsync,
  uploadAsync,
};

export default FileSystem;


import * as FileSystem from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as DocumentPicker from 'expo-document-picker';

export async function makeVideoThumb(uri: string) {
  const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(uri, { time: 200 });
  return thumb;
}

export async function copyDocToProject(srcUri: string, destUri: string) {
  await FileSystem.copyAsync({ from: srcUri, to: destUri });
}

export async function pickDocument() {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  return res.assets[0];
}

export async function moveIntoProject(tmpUri: string, destUri: string) {
  try {
    await FileSystem.moveAsync({ from: tmpUri, to: destUri });
  } catch {
    await FileSystem.copyAsync({ from: tmpUri, to: destUri });
  }
}


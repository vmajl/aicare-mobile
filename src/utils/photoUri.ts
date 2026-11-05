import { Platform } from 'react-native';

type PickedImage = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
};

/**
 * On web, converts the picker result into a compressed data URI so the photo
 * remains available after a browser reload. Native platforms keep the file URI.
 */
export async function getPersistablePhotoUri(
  asset: PickedImage,
): Promise<string> {
  if (Platform.OS !== 'web' || !asset.base64) {
    return asset.uri;
  }

  const sourceUri = `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;

  return new Promise((resolve) => {
    const image = new window.Image();

    image.onload = () => {
      const maxDimension = 1600;
      const largestDimension = Math.max(
        image.naturalWidth,
        image.naturalHeight,
      );
      const scale = Math.min(1, maxDimension / largestDimension);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        resolve(sourceUri);
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };

    image.onerror = () => resolve(sourceUri);
    image.src = sourceUri;
  });
}

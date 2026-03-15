import { config } from './config.js';

/**
 * Main Image Processor using HTML5 Canvas
 */
export async function processImageFiles(file) {
  if (!file.type.match(/image.*/)) {
    throw new Error("File must be an image");
  }

  const imageUrl = await readFileAsDataURL(file);
  const imgElement = await loadImage(imageUrl);

  // Process Original (Apply max width if configured)
  const { blob: originalBlob, width: originalWidth, height: originalHeight } = await resizeImage(
    imgElement,
    config.image.originalMaxWidth || imgElement.width,
    file.type,
    1.0 // Original usually highest quality or original blob
  );

  // Process Thumbnail
  const { blob: thumbBlob, width: thumbWidth, height: thumbHeight } = await resizeImage(
    imgElement,
    config.image.thumbMaxWidth,
    file.type,
    config.image.quality
  );

  const lastDotIndex = file.name.lastIndexOf('.');
  const baseName = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
  const extension = lastDotIndex !== -1 ? file.name.substring(lastDotIndex).toLowerCase() : '';

  return {
    original: {
      blob: originalBlob,
      url: URL.createObjectURL(originalBlob),
      name: `${baseName}_${originalWidth}x${originalHeight}${extension}`,
      width: originalWidth,
      height: originalHeight
    },
    thumbnail: {
      blob: thumbBlob,
      url: URL.createObjectURL(thumbBlob),
      name: `${baseName}_${thumbWidth}x${thumbHeight}_thumb${extension}`,
      width: thumbWidth,
      height: thumbHeight
    }
  };
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function resizeImage(img, maxWidth, mimeType, quality) {
  return new Promise((resolve) => {
    let width = img.width;
    let height = img.height;

    // Calculate respect ratio
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Draw scaled image
    ctx.drawImage(img, 0, 0, width, height);

    // Convert back to blob
    canvas.toBlob((blob) => {
      resolve({ blob, width, height });
    }, mimeType, quality);
  });
}

export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

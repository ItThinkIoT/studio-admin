import { config } from './config.js';

/**
 * Main Image Processor using HTML5 Canvas
 */
export async function processImageFiles(file, shouldWatermark = false) {
  if (!file.type.match(/image.*/)) {
    throw new Error("File must be an image");
  }

  const imageUrl = await readFileAsDataURL(file);
  const imgElement = await loadImage(imageUrl);

  // Keep original image without resizing
  const originalBlob = file;
  const originalWidth = imgElement.width;
  const originalHeight = imgElement.height;

  // Process Web Version
  const { blob: webBlob, width: webWidth, height: webHeight } = await resizeImage(
    imgElement,
    config.image.webMaxWidth,
    file.type,
    config.image.quality,
    shouldWatermark ? config.watermarkText : null
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
      cleanName: baseName,
      width: originalWidth,
      height: originalHeight
    },
    web: {
      blob: webBlob,
      url: URL.createObjectURL(webBlob),
      name: `${baseName}_${webWidth}x${webHeight}_web${extension}`,
      width: webWidth,
      height: webHeight
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

function resizeImage(img, maxWidth, mimeType, quality, watermarkText = null) {
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

    // Apply Watermark if provided
    if (watermarkText) {
      ctx.save();

      // Configure Look
      const fontSize = Math.round(width / 6); // Responsive size
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; // Semi-transparent white
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'; // Subtle outline
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Move to center
      ctx.translate(width / 2, height / 2);
      ctx.rotate(-45 * Math.PI / 180); // 45 degree tilt

      // Draw Main Large Watermark
      ctx.fillText(watermarkText, 0, 0);
      ctx.strokeText(watermarkText, 0, 0);

      // Add secondary repetitions for 'occupying most of the image' effect
      const smallFontSize = Math.round(fontSize / 3);
      ctx.font = `${smallFontSize}px sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';

      // Positions relative to the rotated center
      const offset = fontSize * 1.5;
      ctx.fillText(watermarkText, -offset, -offset);
      ctx.fillText(watermarkText, offset, offset);
      ctx.fillText(watermarkText, -offset, offset);
      ctx.fillText(watermarkText, offset, -offset);

      ctx.restore();
    }

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

// Sequencial S3 Upload Orchestrator
import { state } from './state.js';
import { sha256 as authSha256 } from './auth.js';
import { els, updateProgress } from './ui.js';
import { uploadToS3 } from './uploader.js';
import { config } from './config.js';

export async function uploadBatch(onComplete, onError) {
  if (!state.processedImages.length) return;

  const categoryName = els.categorySelect.value;
  const albumName = els.albumInput.value.trim();

  // Determine target folders
  let thumbFolder = categoryName;
  let webFolder = categoryName;
  let origFolder = categoryName;
  if (categoryName === 'external') {
    thumbFolder = 'external/public';
    webFolder = 'external/public';
    origFolder = 'external/hidden';
  }

  const externalSeed = config.aws.externalSeed || '';

  // Validation
  if (!albumName) {
    alert("Please provide an Album Name before uploading.");
    els.albumInput.focus();
    return;
  }

  if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
    alert("No AWS credentials configured. Please connect with a wallet that has permissions in config.js.");
    return;
  }

  els.btnUpload.disabled = true;
  els.btnCancel.disabled = true;
  els.uploadProgressContainer.classList.remove('hidden');

  let totalFiles = (state.processedImages.length * 3) + (state.coverImageId ? 1 : 0);
  let filesUploaded = 0;

  try {
    updateProgress(0);

    for (const item of state.processedImages) {
      let webName = item.web.name;
      let thumbName = item.thumbnail.name;
      let origName = item.original.name;

      const lastDotOrig = origName.lastIndexOf('.');
      const origBase = lastDotOrig !== -1 ? origName.substring(0, lastDotOrig) : origName;
      const origExt = lastDotOrig !== -1 ? origName.substring(lastDotOrig) : '';

      const lastDotWeb = webName.lastIndexOf('.');
      const webBase = lastDotWeb !== -1 ? webName.substring(0, lastDotWeb) : webName;
      const webExt = lastDotWeb !== -1 ? webName.substring(lastDotWeb) : '';

      const lastDotThumb = thumbName.lastIndexOf('.');
      const thumbBase = lastDotThumb !== -1 ? thumbName.substring(0, lastDotThumb) : thumbName;
      const thumbExt = lastDotThumb !== -1 ? thumbName.substring(lastDotThumb) : '';

      const isCover = item.id === state.coverImageId;

      if (isCover) {
        thumbName = `${thumbBase}_cover${thumbExt}`;
        webName = `${webBase}_cover${webExt}`;
        origName = `${origBase}_cover${origExt}`;
      }

      // 1. Upload Thumbnail
      await uploadToS3(item.thumbnail.blob, thumbName, thumbFolder, albumName);
      filesUploaded++;
      updateProgress((filesUploaded / totalFiles) * 100);

      // 2. Upload Web Version
      await uploadToS3(item.web.blob, webName, webFolder, albumName);
      filesUploaded++;
      updateProgress((filesUploaded / totalFiles) * 100);

      // 3. Upload Original (with hashing if external)
      let finalOrigName = origName;
      if (categoryName === 'external') {
        const cleanBaseName = item.original.cleanName;
        const hashInput = cleanBaseName + externalSeed;
        const hashedBase = await authSha256(hashInput);
        finalOrigName = `${hashedBase}${origExt}`;
      }

      await uploadToS3(item.original.blob, finalOrigName, origFolder, albumName);
      filesUploaded++;
      updateProgress((filesUploaded / totalFiles) * 100);

      // 4. Upload special 'cover.EXT'
      if (isCover) {
        const pureCoverName = `cover${thumbExt}`;
        await uploadToS3(item.thumbnail.blob, pureCoverName, thumbFolder, albumName);
        filesUploaded++;
        updateProgress((filesUploaded / totalFiles) * 100);
      }
    }

    // 5. Upload sell.json for external category
    if (categoryName === 'external') {
      const priceStr = els.priceInput.value;
      // Convert "R$ 5,17" -> 5.17
      const price = parseFloat(priceStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      
      const sellJson = JSON.stringify({ price }, null, 2);
      const sellBlob = new Blob([sellJson], { type: 'application/json' });
      await uploadToS3(sellBlob, 'sell.json', 'external/public', albumName);
      filesUploaded++;
      updateProgress((filesUploaded / totalFiles) * 100);
    }

    onComplete();
  } catch (err) {
    onError(err);
  }
}

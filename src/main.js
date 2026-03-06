import '../style.css';
import { initAuth, getCurrentAccount, encryptDataNative, decryptDataNative, onAccountChanged, getHashedAddress, disconnectWallet } from './auth.js';
import { processImageFiles, formatBytes } from './imageProcessor.js';
import { initAWS, uploadToS3 } from './uploader.js';
import { config } from './config.js';

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const btnBrowse = document.getElementById('btn-browse');
const albumInput = document.getElementById('album-name');

const previewSection = document.getElementById('preview-section');
const previewGrid = document.getElementById('preview-grid');
const fileCount = document.getElementById('file-count');
const totalSizeSpan = document.getElementById('total-size');
const btnAddMore = document.getElementById('btn-add-more');

const uploadProgressContainer = document.getElementById('upload-progress-container');
const uploadBar = document.getElementById('upload-bar');
const uploadPercent = document.getElementById('upload-percent');
const btnUpload = document.getElementById('btn-upload');
const btnCancel = document.getElementById('btn-cancel');

const successOverlay = document.getElementById('success-overlay');
const btnUploadNew = document.getElementById('btn-upload-new');

// Encryption Tool Modal Elements
const encryptionToolModal = document.getElementById('encryption-tool-modal');
const btnConfigOpen = document.getElementById('btn-config-open');
const btnCloseTool = document.getElementById('btn-close-tool');
const btnToolEncrypt = document.getElementById('btn-tool-encrypt');
const toolRawInput = document.getElementById('tool-raw-input');
const toolEncryptedOutput = document.getElementById('tool-encrypted-output');

// Image Viewer Elements
const imageViewerModal = document.getElementById('image-viewer-modal');
const btnCloseViewer = document.getElementById('btn-close-viewer');
const btnViewerPrev = document.getElementById('btn-viewer-prev');
const btnViewerNext = document.getElementById('btn-viewer-next');
const btnViewerDelete = document.getElementById('btn-viewer-delete');
const btnViewerCover = document.getElementById('btn-viewer-cover');
const viewerImage = document.getElementById('viewer-image');
const viewerFilename = document.getElementById('viewer-filename');
const viewerFilesize = document.getElementById('viewer-filesize');
const viewerCounter = document.getElementById('viewer-counter');

// State
let processedImages = []; // Array of { original, thumbnail, id }
let coverImageId = null; // Stores the ID of the cover image
let currentViewerIndex = 0; // Tracks the currently viewed image index

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initAWS();
  setupDragAndDrop();
  setupListeners();
  onAccountChanged(handleWalletChange);
});

async function handleWalletChange(accounts) {
  if (accounts.length > 0) {
    const address = accounts[0];
    const hashed = getHashedAddress(address);
    const userCreds = config.aws.credentials[hashed];

    if (userCreds) {
      console.log(`Matching credentials found for wallet hash: ${hashed}`);
      try {
        // Prompt for decryption if we don't have the secret key yet
        const decryptedSecret = await decryptDataNative(userCreds.secretAccessKey);
        config.aws.accessKeyId = userCreds.accessKeyId;
        config.aws.secretAccessKey = decryptedSecret;
        initAWS();
        console.log("AWS SDK re-initialized with decrypted credentials.");

        // Show Workspace and Hide Auth Required screen
        const workspace = document.getElementById('workspace');
        const connectWarning = document.getElementById('connect-warning');
        if (workspace && connectWarning) {
          workspace.classList.remove('hidden');
          workspace.classList.add('flex');
          setTimeout(() => workspace.classList.remove('opacity-0'), 50);
          connectWarning.classList.add('hidden');
        }
      } catch (err) {
        console.error("Wallet decryption cancelled or failed", err);
        alert("Decryption required to access AWS services.");
        // We do NOT disconnect wallet anymore per user request, just leave workspace hidden
      }
    } else {
      console.warn(`No credentials found in config.js for wallet hash: ${hashed}`);
      alert("Unauthorized Access: This wallet is not configured to use this uploader.");
      // Wallet stays connected, but workspace remains hidden
    }
  }
}

function setupDragAndDrop() {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('drag-active'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('drag-active'), false);
  });

  dropzone.addEventListener('drop', handleDrop, false);

  // File input fallback
  btnBrowse.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFiles(e.target.files);
    }
  });

  // Add More Button wiring
  btnAddMore.addEventListener('click', () => fileInput.click());
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  handleFiles(dt.files);
}

async function handleFiles(files) {
  if (!getCurrentAccount()) {
    alert("Please connect your wallet first.");
    return;
  }

  const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

  if (validFiles.length === 0) {
    alert("Please drop valid image files.");
    return;
  }

  setProcessingState(true, 0, validFiles.length);

  try {
    let processedCount = 0;
    for (const file of validFiles) {
      processedCount++;
      setProcessingState(true, processedCount, validFiles.length);
      const processed = await processImageFiles(file);
      // add a unique ID for deletion tracking
      processed.id = Date.now() + Math.random().toString(16).slice(2);
      processedImages.push(processed);
    }

    // Auto-select the first image as cover if none is selected
    if (processedImages.length > 0 && !coverImageId) {
      coverImageId = processedImages[0].id;
    }

    renderPreviewGrid();

    // Switch View
    dropzone.parentElement.classList.add('hidden');
    previewSection.classList.remove('hidden');

  } catch (error) {
    console.error("Error processing images:", error);
    alert("Failed to process some images.");
  } finally {
    setProcessingState(false);
  }
}

function renderPreviewGrid() {
  previewGrid.innerHTML = '';
  let totalBytes = 0;

  processedImages.forEach((processed, index) => {
    totalBytes += processed.original.blob.size;
    const card = createPreviewCard(processed, index);
    previewGrid.appendChild(card);
  });

  // Update Summaries
  fileCount.innerText = processedImages.length;
  totalSizeSpan.innerText = formatBytes(totalBytes);

  // Disable upload if clear
  if (processedImages.length === 0) {
    btnUpload.disabled = true;
  } else {
    btnUpload.disabled = false;
  }
}

function createPreviewCard(processed, index) {
  const isCover = coverImageId === processed.id;
  const div = document.createElement('div');
  div.className = `rounded-xl border overflow-hidden flex flex-col group relative transition-all duration-300 ${isCover ? 'bg-brand-emerald/20 border-brand-emerald shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-brand-900 border-brand-700'}`;

  // Image container
  const imgContainer = document.createElement('div');
  imgContainer.className = "aspect-square bg-black/20 flex items-center justify-center overflow-hidden cursor-pointer relative";

  // Click to view large
  imgContainer.addEventListener('click', () => {
    // We fetch current index in case array shifted due to deletions
    const currentIndex = processedImages.findIndex(img => img.id === processed.id);
    openImageViewer(currentIndex);
  });

  const img = document.createElement('img');
  img.src = processed.thumbnail.url; // Use thumbnail for gallery
  img.className = "w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity hover:scale-105 duration-300";

  // Actions Container
  const actionsContainer = document.createElement('div');
  actionsContainer.className = "absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-10";

  // Set Cover Button
  const coverBtn = document.createElement('button');
  coverBtn.title = "Set as Cover";
  coverBtn.className = `p-1.5 rounded-lg text-white shadow-lg backdrop-blur hover:bg-emerald-500 transition-colors ${isCover ? 'bg-emerald-500' : 'bg-brand-800/80 hover:bg-emerald-500/80'}`;
  coverBtn.innerHTML = `<svg class="w-4 h-4" fill="${isCover ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>`;

  coverBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent modal
    coverImageId = processed.id;
    renderPreviewGrid();
  });

  // Delete Button
  const deleteBtn = document.createElement('button');
  deleteBtn.title = "Remove";
  deleteBtn.className = "p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg shadow-lg backdrop-blur transition-colors";
  deleteBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;

  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent modal
    removeImage(processed.id);
  });

  actionsContainer.appendChild(coverBtn);
  actionsContainer.appendChild(deleteBtn);

  if (isCover) {
    // Show a permanent small label if it's the cover
    const coverLabel = document.createElement('div');
    coverLabel.className = "absolute bottom-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow z-10";
    coverLabel.innerText = "COVER";
    imgContainer.appendChild(coverLabel);
  }

  imgContainer.appendChild(img);
  imgContainer.appendChild(actionsContainer);

  // Info footer
  const info = document.createElement('div');
  info.className = `flex flex-col border-t text-xs text-gray-400 ${isCover ? 'bg-brand-emerald/10 border-brand-emerald/30' : 'bg-brand-800 border-brand-700'}`;

  // Name row
  const nameRow = document.createElement('div');
  nameRow.className = "p-2 pb-1 truncate text-gray-200 cursor-default";
  nameRow.innerText = processed.original.name;
  nameRow.title = processed.original.name;

  // Sizes row
  const sizeRow = document.createElement('div');
  sizeRow.className = "p-2 pt-0 flex justify-between items-center font-mono opacity-80 text-[10px] cursor-default";

  const origSize = document.createElement('span');
  origSize.innerHTML = `Orig: <span class="text-white">${formatBytes(processed.original.blob.size)}</span>`;

  const thumbSize = document.createElement('span');
  thumbSize.innerHTML = `Thumb: <span class="text-brand-emerald">${formatBytes(processed.thumbnail.blob.size)}</span>`;

  sizeRow.appendChild(origSize);
  sizeRow.appendChild(thumbSize);

  info.appendChild(nameRow);
  info.appendChild(sizeRow);

  div.appendChild(imgContainer);
  div.appendChild(info);

  return div;
}

function removeImage(id) {
  // Revoke URLs for the removed item to free memory
  const item = processedImages.find(i => i.id === id);
  if (item) {
    URL.revokeObjectURL(item.original.url);
    URL.revokeObjectURL(item.thumbnail.url);
  }

  processedImages = processedImages.filter(img => img.id !== id);

  // Reset cover if it was deleted
  if (coverImageId === id) {
    coverImageId = processedImages.length > 0 ? processedImages[0].id : null;
  }

  renderPreviewGrid();
}

// Viewer Navigation Logic
function openImageViewer(index) {
  if (index < 0 || index >= processedImages.length) return;

  currentViewerIndex = index;
  const processed = processedImages[currentViewerIndex];

  viewerImage.src = processed.original.url; // Show max detail available
  viewerFilename.innerText = processed.original.name;
  viewerFilesize.innerText = formatBytes(processed.original.blob.size);
  viewerCounter.innerText = `${currentViewerIndex + 1} of ${processedImages.length}`;

  // Highlight Set Cover button if it is the cover
  const isCover = coverImageId === processed.id;
  if (isCover) {
    btnViewerCover.classList.remove('text-gray-400');
    btnViewerCover.classList.add('text-emerald-500');
    btnViewerCover.querySelector('svg').setAttribute('fill', 'currentColor');
  } else {
    btnViewerCover.classList.remove('text-emerald-500');
    btnViewerCover.classList.add('text-gray-400');
    btnViewerCover.querySelector('svg').setAttribute('fill', 'none');
  }

  // Toggle Arrow Visibility
  btnViewerPrev.style.visibility = currentViewerIndex > 0 ? 'visible' : 'hidden';
  btnViewerNext.style.visibility = currentViewerIndex < processedImages.length - 1 ? 'visible' : 'hidden';

  imageViewerModal.classList.remove('hidden');
  imageViewerModal.classList.add('flex');
}

function closeImageViewer() {
  imageViewerModal.classList.add('hidden');
  imageViewerModal.classList.remove('flex');
  viewerImage.src = '';
}

function navigateViewer(direction) {
  const newIndex = currentViewerIndex + direction;
  if (newIndex >= 0 && newIndex < processedImages.length) {
    openImageViewer(newIndex);
  }
}

function deleteFromViewer() {
  if (processedImages.length === 0) return;

  const currentId = processedImages[currentViewerIndex].id;
  removeImage(currentId);

  // If no images left after deletion
  if (processedImages.length === 0) {
    closeImageViewer();
    return;
  }

  // If we deleted the last image, step back one. Otherwise render current index (which shifted up)
  if (currentViewerIndex >= processedImages.length) {
    openImageViewer(processedImages.length - 1);
  } else {
    openImageViewer(currentViewerIndex);
  }
}

function setProcessingState(isProcessing, current = 0, total = 0) {
  if (isProcessing) {
    dropzone.classList.add('opacity-50', 'pointer-events-none');
    const text = total > 0 ? `Processing ${current} / ${total}...` : 'Processing...';
    btnBrowse.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
      ${text}`;
  } else {
    dropzone.classList.remove('opacity-50', 'pointer-events-none');
    btnBrowse.innerHTML = "Browse Files";
  }
}

function setupListeners() {
  // Modal Navigation listeners
  btnCloseViewer.addEventListener('click', closeImageViewer);

  // Close when clicking empty space
  imageViewerModal.addEventListener('click', (e) => {
    if (e.target === imageViewerModal) closeImageViewer();
  });

  // Prev/Next/Delete buttons
  btnViewerPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateViewer(-1);
  });

  btnViewerNext.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateViewer(1);
  });

  btnViewerDelete.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteFromViewer();
  });

  btnViewerCover.addEventListener('click', (e) => {
    e.stopPropagation();
    if (processedImages.length > 0) {
      coverImageId = processedImages[currentViewerIndex].id;
      renderPreviewGrid(); // Update background cards
      openImageViewer(currentViewerIndex); // Refresh button UI
    }
  });

  // Keyboard Navigation
  document.addEventListener('keydown', (e) => {
    if (!imageViewerModal.classList.contains('hidden')) {
      if (e.key === 'ArrowLeft') navigateViewer(-1);
      if (e.key === 'ArrowRight') navigateViewer(1);
      if (e.key === 'Escape') closeImageViewer();
      if (e.key === 'Delete') deleteFromViewer();
    }
  });

  // Tool Configuration listeners
  btnConfigOpen.addEventListener('click', () => {
    encryptionToolModal.classList.remove('hidden');
    encryptionToolModal.classList.add('flex');
    toolEncryptedOutput.value = '';
    toolRawInput.value = '';
  });

  btnCloseTool.addEventListener('click', () => {
    encryptionToolModal.classList.add('hidden');
    encryptionToolModal.classList.remove('flex');
  });

  btnToolEncrypt.addEventListener('click', async () => {
    const rawText = toolRawInput.value.trim();
    if (!rawText) {
      alert("Please paste some text to encrypt.");
      return;
    }

    // Animate button
    const ogHtml = btnToolEncrypt.innerHTML;
    btnToolEncrypt.innerHTML = `
      <svg class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
      Encrypting via MetaMask...
    `;
    btnToolEncrypt.disabled = true;

    try {
      const encryptedBase64 = await encryptDataNative(rawText);
      toolEncryptedOutput.value = encryptedBase64;
    } catch (err) {
      console.error(err);
      alert("Failed to encrypt text using wallet. " + err.message);
    } finally {
      btnToolEncrypt.innerHTML = ogHtml;
      btnToolEncrypt.disabled = false;
    }
  });

  btnCancel.addEventListener('click', () => {
    resetWorkspace();
  });

  btnUploadNew.addEventListener('click', () => {
    resetWorkspace();
  });

  btnUpload.addEventListener('click', async () => {
    if (!processedImages.length) return;

    const categoryName = document.getElementById('category-select').value; // 'gallery' or 'external'
    const albumName = albumInput.value.trim();

    // Validation
    if (!albumName) {
      alert("Please provide an Album Name before uploading.");
      albumInput.focus();
      return;
    }

    if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
      alert("No AWS credentials configured. Please connect with a wallet that has permissions in config.js.");
      return;
    }

    btnUpload.disabled = true;
    btnCancel.disabled = true;
    uploadProgressContainer.classList.remove('hidden');

    // Total files: (Original + Thumb) for each image. Plus 1 extra if a cover is selected.
    const totalFiles = (processedImages.length * 2) + (coverImageId ? 1 : 0);
    let filesUploaded = 0;

    try {
      updateProgress(0);

      // Upload sequentially to avoid choking the browser or AWS limits
      for (const item of processedImages) {

        let thumbName = item.thumbnail.name;
        let origName = item.original.name;

        const lastDotOrig = origName.lastIndexOf('.');
        const origBase = lastDotOrig !== -1 ? origName.substring(0, lastDotOrig) : origName;
        const origExt = lastDotOrig !== -1 ? origName.substring(lastDotOrig) : '';

        const lastDotThumb = thumbName.lastIndexOf('.');
        const thumbBase = lastDotThumb !== -1 ? thumbName.substring(0, lastDotThumb) : thumbName;
        const thumbExt = lastDotThumb !== -1 ? thumbName.substring(lastDotThumb) : '';

        // Determine if this is the cover image
        const isCover = item.id === coverImageId;

        // Append _cover for original and thumb filenames
        if (isCover) {
          thumbName = `${thumbBase}_cover${thumbExt}`;
          origName = `${origBase}_cover${origExt}`;
        }

        // Upload Thumbnail
        await uploadToS3(item.thumbnail.blob, thumbName, categoryName, albumName);
        filesUploaded++;
        updateProgress((filesUploaded / totalFiles) * 100);

        // Upload Original
        await uploadToS3(item.original.blob, origName, categoryName, albumName);
        filesUploaded++;
        updateProgress((filesUploaded / totalFiles) * 100);

        // Upload a third special picture explicitly named 'cover.EXT'
        if (isCover) {
          const pureCoverName = `cover${thumbExt}`;
          await uploadToS3(item.thumbnail.blob, pureCoverName, categoryName, albumName);
          filesUploaded++;
          updateProgress((filesUploaded / totalFiles) * 100);
        }
      }

      // Show Success
      setTimeout(() => {
        successOverlay.classList.remove('hidden');
        successOverlay.classList.add('flex');
      }, 500);

    } catch (err) {
      console.error(err);
      alert("Batch upload failed. Check console and make sure AWS Credentials are valid.");
      uploadProgressContainer.classList.add('hidden');
      btnUpload.disabled = false;
      btnCancel.disabled = false;
    }
  });
}

function updateProgress(percent) {
  const p = Math.min(Math.round(percent), 100);
  uploadBar.style.width = `${p}%`;
  uploadPercent.innerText = `${p}%`;
}

function resetWorkspace() {
  // Free object URLs
  processedImages.forEach(item => {
    URL.revokeObjectURL(item.original.url);
    URL.revokeObjectURL(item.thumbnail.url);
  });

  processedImages = [];
  coverImageId = null;
  fileInput.value = '';
  previewGrid.innerHTML = '';
  albumInput.value = '';

  // UI Resets
  dropzone.parentElement.classList.remove('hidden');
  previewSection.classList.add('hidden');
  successOverlay.classList.add('hidden');
  successOverlay.classList.remove('flex');
  uploadProgressContainer.classList.add('hidden');

  btnUpload.disabled = false;
  btnCancel.disabled = false;
  updateProgress(0);
}

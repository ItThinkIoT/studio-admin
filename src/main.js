import '../style.css';
import { 
  initAuth, getCurrentAccount, decryptDataNative, onAccountChanged, getHashedAddress 
} from './auth.js';
import { processImageFiles } from './imageProcessor.js';
import { initAWS } from './uploader.js';
import { config } from './config.js';

// Internal Modules
import { state, setProcessedImages, setCoverImageId } from './state.js';
import { els, setProcessingState, updateProgress, toggleWorkspaceVisibility } from './ui.js';
import { renderPreviewGrid, switchViewToPreview, switchViewToUpload } from './gallery.js';
import { openImageViewer, closeImageViewer, navigateViewer, initCrop, saveCrop } from './viewer.js';
import { uploadBatch } from './uploader_service.js';
import { openEncryptionTool, closeEncryptionTool, encryptData } from './encryption_tool.js';

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initAWS();
  setupDragAndDrop();
  setupListeners();
  onAccountChanged(handleWalletChange);
});

// --- Core Auth Flow ---

async function handleWalletChange(accounts) {
  if (accounts.length === 0) {
    toggleWorkspaceVisibility(false);
    return;
  }

  const address = accounts[0];
  const hashed = getHashedAddress(address);
  const userCreds = config.aws.credentials[hashed];

  if (!userCreds) {
    console.warn(`No credentials found for wallet: ${hashed}`);
    alert("Unauthorized: This wallet is not configured for this uploader.");
    return;
  }

  try {
    const decryptedSecret = await decryptDataNative(userCreds.secretAccessKey);
    const decryptedExternalSeed = await decryptDataNative(userCreds.externalSeed);
    
    config.aws.accessKeyId = userCreds.accessKeyId;
    config.aws.secretAccessKey = decryptedSecret;
    config.aws.externalSeed = decryptedExternalSeed;
    
    initAWS();
    toggleWorkspaceVisibility(true);
  } catch (err) {
    console.error("Wallet decryption failed:", err);
    alert("Decryption required to access services.");
  }
}

// --- File Handling & Processing ---

function setupDragAndDrop() {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
    els.dropzone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, false);
    document.body.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, false);
  });

  els.dropzone.addEventListener('dragenter', () => els.dropzone.classList.add('drag-active'));
  els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('drag-active'));
  els.dropzone.addEventListener('drop', (e) => {
    els.dropzone.classList.remove('drag-active');
    handleFiles(e.dataTransfer.files);
  });

  els.btnBrowse.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
  els.btnAddMore.addEventListener('click', () => els.fileInput.click());
}

async function handleFiles(files) {
  if (!getCurrentAccount()) return alert("Connect your wallet first.");
  const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!validFiles.length) return alert("Drop valid image files.");

  setProcessingState(true, 0, validFiles.length);
  try {
    for (let i = 0; i < validFiles.length; i++) {
      setProcessingState(true, i + 1, validFiles.length);
      const isExternal = els.categorySelect.value === 'external';
      const processed = await processImageFiles(validFiles[i], isExternal);
      processed.id = Date.now() + Math.random().toString(16).slice(2);
      state.processedImages.push(processed);
    }

    if (!state.coverImageId && state.processedImages.length) {
      setCoverImageId(state.processedImages[0].id);
    }

    renderPreviewGrid(removeImage);
    switchViewToPreview();
  } catch (error) {
    console.error("Processing error:", error);
    alert("Failed to process some images.");
  } finally {
    setProcessingState(false);
  }
}

function removeImage(id) {
  const item = state.processedImages.find(i => i.id === id);
  if (item) {
    URL.revokeObjectURL(item.original.url);
    URL.revokeObjectURL(item.web.url);
    URL.revokeObjectURL(item.thumbnail.url);
  }
  state.processedImages = state.processedImages.filter(img => img.id !== id);
  if (state.coverImageId === id) {
    setCoverImageId(state.processedImages.length ? state.processedImages[0].id : null);
  }
  renderPreviewGrid(removeImage);
}

// --- Event Listeners Orchestration ---

function setupListeners() {
  // Viewer Events
  els.btnCloseViewer.addEventListener('click', closeImageViewer);
  els.imageViewerModal.addEventListener('click', (e) => {
    if (e.target === els.imageViewerModal) closeImageViewer();
  });
  els.btnViewerPrev.addEventListener('click', (e) => { e.stopPropagation(); navigateViewer(-1); });
  els.btnViewerNext.addEventListener('click', (e) => { e.stopPropagation(); navigateViewer(1); });
  els.btnViewerDelete.addEventListener('click', (e) => {
    e.stopPropagation();
    const currentId = state.processedImages[state.currentViewerIndex].id;
    removeImage(currentId);
    if (!state.processedImages.length) closeImageViewer();
    else openImageViewer(Math.min(state.currentViewerIndex, state.processedImages.length - 1));
  });
  els.btnViewerCover.addEventListener('click', (e) => {
    e.stopPropagation();
    setCoverImageId(state.processedImages[state.currentViewerIndex].id);
    renderPreviewGrid(removeImage);
    openImageViewer(state.currentViewerIndex);
  });

  // Cropping
  els.btnViewerCrop.addEventListener('click', (e) => { e.stopPropagation(); initCrop(); });
  els.btnViewerSaveCrop.addEventListener('click', (e) => {
    e.stopPropagation();
    saveCrop((index, newProcessed, oldItem) => {
      state.processedImages[index] = newProcessed;
      renderPreviewGrid(removeImage);
    });
  });

  // Global Key Nav
  document.addEventListener('keydown', (e) => {
    if (els.imageViewerModal.classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft') navigateViewer(-1);
    if (e.key === 'ArrowRight') navigateViewer(1);
    if (e.key === 'Escape') closeImageViewer();
  });

  // Tool & Config
  els.btnConfigOpen.addEventListener('click', openEncryptionTool);
  els.btnCloseTool.addEventListener('click', closeEncryptionTool);
  els.btnToolEncrypt.addEventListener('click', encryptData);

  // Category & Album
  els.categorySelect.addEventListener('change', handleCategoryChange);
  els.priceInput.addEventListener('input', formatCurrency);
  
  // Upload Flow
  els.btnCancel.addEventListener('click', resetWorkspace);
  els.btnUploadNew.addEventListener('click', resetWorkspace);
  els.btnUpload.addEventListener('click', () => {
    uploadBatch(
       () => els.successOverlay.classList.replace('hidden', 'flex'),
       (err) => {
          console.error(err);
          alert("Batch upload failed.");
          els.uploadProgressContainer.classList.add('hidden');
          els.btnUpload.disabled = false;
          els.btnCancel.disabled = false;
       }
    );
  });
}

async function handleCategoryChange() {
  const isExternal = els.categorySelect.value === 'external';
  
  // Show/Hide price container
  if (isExternal) {
    els.priceContainer.classList.remove('hidden');
    els.priceInput.required = true;
    if (!els.priceInput.value) {
      els.priceInput.value = 'R$ 5,00';
    }
  } else {
    els.priceContainer.classList.add('hidden');
    els.priceInput.required = false;
    els.priceInput.value = '';
  }

  if (!state.processedImages.length) return;
  setProcessingState(true, 0, state.processedImages.length);
  try {
    for (let i = 0; i < state.processedImages.length; i++) {
      const item = state.processedImages[i];
      const newProcessed = await processImageFiles(item.original.blob, isExternal);
      newProcessed.id = item.id;
      
      URL.revokeObjectURL(item.original.url);
      URL.revokeObjectURL(item.web.url);
      URL.revokeObjectURL(item.thumbnail.url);
      
      state.processedImages[i] = newProcessed;
      setProcessingState(true, i + 1, state.processedImages.length);
    }
    renderPreviewGrid(removeImage);
  } catch (error) {
    console.error("Re-processing failed:", error);
  } finally {
    setProcessingState(false);
  }
}

function resetWorkspace() {
  state.processedImages.forEach(item => {
    URL.revokeObjectURL(item.original.url);
    URL.revokeObjectURL(item.web.url);
    URL.revokeObjectURL(item.thumbnail.url);
  });
  setProcessedImages([]);
  setCoverImageId(null);
  els.fileInput.value = '';
  els.albumInput.value = '';
  els.priceInput.value = '';
  els.priceContainer.classList.add('hidden');
  els.categorySelect.value = 'gallery';
  renderPreviewGrid(removeImage);
  switchViewToUpload();
  updateProgress(0);
}

function formatCurrency(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value === '') {
    e.target.value = '';
    return;
  }
  
  value = value.padStart(3, '0');
  const integerPart = value.slice(0, -2);
  const decimalPart = value.slice(-2);
  
  const formattedInteger = parseInt(integerPart, 10).toLocaleString('pt-BR');
  e.target.value = `R$ ${formattedInteger},${decimalPart}`;
}

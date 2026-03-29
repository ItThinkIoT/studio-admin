// Image Viewer Modal and Cropping Management
import { state, setCurrentViewerIndex, setCropper } from './state.js';
import { els, setProcessingState } from './ui.js';
import { formatBytes, processImageFiles } from './imageProcessor.js';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

export function openImageViewer(index) {
  if (index < 0 || index >= state.processedImages.length) return;

  setCurrentViewerIndex(index);
  const processed = state.processedImages[state.currentViewerIndex];

  // Update UI
  els.viewerImage.src = processed.original.url;
  els.viewerFilename.innerText = processed.original.name;
  els.viewerFilesize.innerText = formatBytes(processed.original.blob.size);
  els.viewerCounter.innerText = `${state.currentViewerIndex + 1} of ${state.processedImages.length}`;

  // Reset Cropper UI
  if (state.cropper) {
    state.cropper.destroy();
    setCropper(null);
  }
  els.btnViewerSaveCrop.classList.add('hidden');
  els.btnViewerCrop.classList.remove('hidden');

  // Highlight Set Cover button
  const isCover = state.coverImageId === processed.id;
  updateViewerCoverButton(isCover);

  // Toggle Arrow Visibility
  els.btnViewerPrev.style.visibility = state.currentViewerIndex > 0 ? 'visible' : 'hidden';
  els.btnViewerNext.style.visibility = state.currentViewerIndex < state.processedImages.length - 1 ? 'visible' : 'hidden';

  els.imageViewerModal.classList.remove('hidden');
  els.imageViewerModal.classList.add('flex');
}

export function closeImageViewer() {
  if (state.cropper) {
    state.cropper.destroy();
    setCropper(null);
  }
  els.imageViewerModal.classList.add('hidden');
  els.imageViewerModal.classList.remove('flex');
  els.viewerImage.src = '';
}

export function navigateViewer(direction) {
  openImageViewer(state.currentViewerIndex + direction);
}

function updateViewerCoverButton(isCover) {
  if (isCover) {
    els.btnViewerCover.classList.remove('text-gray-400');
    els.btnViewerCover.classList.add('text-emerald-500');
    els.btnViewerCover.querySelector('svg').setAttribute('fill', 'currentColor');
  } else {
    els.btnViewerCover.classList.remove('text-emerald-500');
    els.btnViewerCover.classList.add('text-gray-400');
    els.btnViewerCover.querySelector('svg').setAttribute('fill', 'none');
  }
}

// Cropping Logic
export function initCrop() {
  if (state.cropper) return;

  const instance = new Cropper(els.viewerImage, {
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.8,
    restore: false,
    guides: true,
    center: true,
    highlight: false,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
  });

  setCropper(instance);
  els.btnViewerCrop.classList.add('hidden');
  els.btnViewerSaveCrop.classList.remove('hidden');
}

export async function saveCrop(onProcessed) {
  if (!state.cropper) return;

  const categoryName = els.categorySelect.value;
  const item = state.processedImages[state.currentViewerIndex];

  // UI Processing State
  const ogHtml = els.btnViewerSaveCrop.innerHTML;
  els.btnViewerSaveCrop.innerHTML = "PROCESSING...";
  els.btnViewerSaveCrop.disabled = true;

  const canvas = state.cropper.getCroppedCanvas({
    maxWidth: 4096,
    maxHeight: 4096,
    imageSmoothingQuality: 'high',
  });

  canvas.toBlob(async (blob) => {
    try {
      const newFile = new File([blob], item.original.blob.name, { type: 'image/jpeg' });
      const newProcessed = await processImageFiles(newFile, categoryName === 'external');
      newProcessed.id = item.id;

      // Swap in state
      onProcessed(state.currentViewerIndex, newProcessed, item);
      
      // Reset UI
      state.cropper.destroy();
      setCropper(null);
      els.btnViewerSaveCrop.innerHTML = ogHtml;
      els.btnViewerSaveCrop.disabled = false;
      els.btnViewerSaveCrop.classList.add('hidden');
      els.btnViewerCrop.classList.remove('hidden');
      
      openImageViewer(state.currentViewerIndex);
    } catch (err) {
      console.error("Cropping failed:", err);
      alert("Failed to save crop.");
      els.btnViewerSaveCrop.innerHTML = ogHtml;
      els.btnViewerSaveCrop.disabled = false;
    }
  }, 'image/jpeg', 0.95);
}

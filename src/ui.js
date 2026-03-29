// DOM Element Selectors and Generic UI Helpers

export const els = {
  // Authentication & Configuration
  workspace: document.getElementById('workspace'),
  connectWarning: document.getElementById('connect-warning'),
  categorySelect: document.getElementById('category-select'),
  albumInput: document.getElementById('album-name'),
  btnBrowse: document.getElementById('btn-browse'),
  fileInput: document.getElementById('file-input'),
  dropzone: document.getElementById('dropzone'),

  // Preview / Grid
  previewSection: document.getElementById('preview-section'),
  previewGrid: document.getElementById('preview-grid'),
  fileCount: document.getElementById('file-count'),
  totalSizeSpan: document.getElementById('total-size'),
  btnAddMore: document.getElementById('btn-add-more'),

  // Bottom Actions & Progress
  btnUpload: document.getElementById('btn-upload'),
  btnCancel: document.getElementById('btn-cancel'),
  uploadProgressContainer: document.getElementById('upload-progress-container'),
  uploadStatus: document.getElementById('upload-status'),
  uploadBar: document.getElementById('upload-bar'),
  uploadPercent: document.getElementById('upload-percent'),

  // Success / Resets
  successOverlay: document.getElementById('success-overlay'),
  btnUploadNew: document.getElementById('btn-upload-new'),

  // Encryption Tool Modal
  encryptionToolModal: document.getElementById('encryption-tool-modal'),
  btnConfigOpen: document.getElementById('btn-config-open'),
  btnCloseTool: document.getElementById('btn-close-tool'),
  btnToolEncrypt: document.getElementById('btn-tool-encrypt'),
  toolRawInput: document.getElementById('tool-raw-input'),
  toolEncryptedOutput: document.getElementById('tool-encrypted-output'),

  // Image Viewer Modal
  imageViewerModal: document.getElementById('image-viewer-modal'),
  viewerImage: document.getElementById('viewer-image'),
  viewerFilename: document.getElementById('viewer-filename'),
  viewerFilesize: document.getElementById('viewer-filesize'),
  viewerCounter: document.getElementById('viewer-counter'),
  btnCloseViewer: document.getElementById('btn-close-viewer'),
  btnViewerPrev: document.getElementById('btn-viewer-prev'),
  btnViewerNext: document.getElementById('btn-viewer-next'),
  btnViewerDelete: document.getElementById('btn-viewer-delete'),
  btnViewerCover: document.getElementById('btn-viewer-cover'),
  btnViewerCrop: document.getElementById('btn-viewer-crop'),
  btnViewerSaveCrop: document.getElementById('btn-viewer-save-crop')
};

// Generic UI Status Management
export function updateProgress(percent) {
  const p = Math.min(Math.round(percent), 100);
  els.uploadBar.style.width = `${p}%`;
  els.uploadPercent.innerText = `${p}%`;
}

export function setProcessingState(isProcessing, current = 0, total = 0) {
  if (isProcessing) {
    els.dropzone.classList.add('opacity-50', 'pointer-events-none');
    const text = total > 0 ? `Processing ${current} / ${total}...` : 'Processing...';
    els.btnBrowse.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
      ${text}`;
  } else {
    els.dropzone.classList.remove('opacity-50', 'pointer-events-none');
    els.btnBrowse.innerHTML = "Browse Files";
  }
}

export function toggleWorkspaceVisibility(show) {
  if (show) {
    els.workspace.classList.remove('hidden');
    els.workspace.classList.add('flex');
    setTimeout(() => els.workspace.classList.remove('opacity-0'), 50);
    els.connectWarning.classList.add('hidden');
  } else {
    els.workspace.classList.add('hidden', 'opacity-0');
    els.connectWarning.classList.remove('hidden');
  }
}

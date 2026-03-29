// Gallery Rendering and Card Management
import { state, setCoverImageId } from './state.js';
import { els } from './ui.js';
import { formatBytes } from './imageProcessor.js';
import { openImageViewer } from './viewer.js';

export function renderPreviewGrid(onRemoveImage) {
  els.previewGrid.innerHTML = '';
  let totalBytes = 0;

  state.processedImages.forEach((processed, index) => {
    totalBytes += processed.original.blob.size + processed.web.blob.size + processed.thumbnail.blob.size;
    const card = createPreviewCard(processed, onRemoveImage);
    els.previewGrid.appendChild(card);
  });

  // Update UI Stats
  els.fileCount.innerText = state.processedImages.length;
  els.totalSizeSpan.innerText = formatBytes(totalBytes);

  // Disable upload if clear
  els.btnUpload.disabled = state.processedImages.length === 0;
}

export function createPreviewCard(processed, onRemoveImage) {
  const isCover = state.coverImageId === processed.id;
  const div = document.createElement('div');
  div.className = `rounded-xl border overflow-hidden flex flex-col group relative transition-all duration-300 ${isCover ? 'bg-brand-emerald/20 border-brand-emerald shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-brand-900 border-brand-700'}`;

  // Image container
  const imgContainer = document.createElement('div');
  imgContainer.className = "aspect-square bg-black/20 flex items-center justify-center overflow-hidden cursor-pointer relative";

  // Click to view large
  imgContainer.addEventListener('click', () => {
    const currentIndex = state.processedImages.findIndex(img => img.id === processed.id);
    openImageViewer(currentIndex);
  });

  const img = document.createElement('img');
  img.src = processed.thumbnail.url; 
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
    e.stopPropagation(); 
    setCoverImageId(processed.id);
    renderPreviewGrid(onRemoveImage);
  });

  // Delete Button
  const deleteBtn = document.createElement('button');
  deleteBtn.title = "Remove";
  deleteBtn.className = "p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg shadow-lg backdrop-blur transition-colors";
  deleteBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;

  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    onRemoveImage(processed.id);
  });

  actionsContainer.appendChild(coverBtn);
  actionsContainer.appendChild(deleteBtn);

  if (isCover) {
    const coverLabel = document.createElement('div');
    coverLabel.className = "absolute bottom-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow z-10";
    coverLabel.innerText = "COVER";
    imgContainer.appendChild(coverLabel);
  }

  imgContainer.appendChild(img);
  imgContainer.appendChild(actionsContainer);

  const info = document.createElement('div');
  info.className = `flex flex-col border-t text-xs text-gray-400 ${isCover ? 'bg-brand-emerald/10 border-brand-emerald/30' : 'bg-brand-800 border-brand-700'}`;
  
  const nameRow = document.createElement('div');
  nameRow.className = "p-2 pb-1 truncate text-gray-200 cursor-default";
  nameRow.innerText = processed.original.name;
  nameRow.title = processed.original.name;

  const sizeRow = document.createElement('div');
  sizeRow.className = "p-2 pt-0 flex justify-between items-center font-mono opacity-80 text-[10px] cursor-default";
  
  sizeRow.innerHTML = `
    <span>Orig: <span class="text-white">${formatBytes(processed.original.blob.size)}</span></span>
    <span>Web: <span class="text-brand-emerald">${formatBytes(processed.web.blob.size)}</span></span>
    <span>Thumb: <span class="text-brand-emerald">${formatBytes(processed.thumbnail.blob.size)}</span></span>
  `;

  info.appendChild(nameRow);
  info.appendChild(sizeRow);
  div.appendChild(imgContainer);
  div.appendChild(info);

  return div;
}

export function switchViewToPreview() {
  document.querySelector('#dropzone').parentElement.classList.add('hidden');
  els.previewSection.classList.remove('hidden');
}

export function switchViewToUpload() {
  document.querySelector('#dropzone').parentElement.classList.remove('hidden');
  els.previewSection.classList.add('hidden');
  els.successOverlay.classList.add('hidden');
  els.successOverlay.classList.remove('flex');
  els.uploadProgressContainer.classList.add('hidden');
}

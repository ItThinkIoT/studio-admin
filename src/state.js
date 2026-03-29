// Central State Management
export const state = {
  processedImages: [], // Array of { original, thumbnail, web, id }
  coverImageId: null,
  currentViewerIndex: 0,
  cropper: null
};

export function setProcessedImages(images) {
  state.processedImages = images;
}

export function setCoverImageId(id) {
  state.coverImageId = id;
}

export function setCurrentViewerIndex(index) {
  state.currentViewerIndex = index;
}

export function setCropper(instance) {
  state.cropper = instance;
}

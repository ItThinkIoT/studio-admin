// Encryption Tool Management
import { encryptDataNative } from './auth.js';
import { els } from './ui.js';

export function openEncryptionTool() {
  els.encryptionToolModal.classList.remove('hidden');
  els.encryptionToolModal.classList.add('flex');
  els.toolEncryptedOutput.value = '';
  els.toolRawInput.value = '';
}

export function closeEncryptionTool() {
  els.encryptionToolModal.classList.add('hidden');
  els.encryptionToolModal.classList.remove('flex');
}

export async function encryptData() {
  const rawText = els.toolRawInput.value.trim();
  if (!rawText) {
    alert("Please paste some text to encrypt.");
    return;
  }

  // Animate button
  const ogHtml = els.btnToolEncrypt.innerHTML;
  els.btnToolEncrypt.innerHTML = `
    <svg class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
    Encrypting via MetaMask...
  `;
  els.btnToolEncrypt.disabled = true;

  try {
    const encryptedBase64 = await encryptDataNative(rawText);
    els.toolEncryptedOutput.value = encryptedBase64;
  } catch (err) {
    console.error(err);
    alert("Failed to encrypt text using wallet. " + err.message);
  } finally {
    els.btnToolEncrypt.innerHTML = ogHtml;
    els.btnToolEncrypt.disabled = false;
  }
}

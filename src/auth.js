import { ethers } from 'ethers';
import { config } from './config.js';
// State
let currentAccount = null;
let provider = null;

// UI Elements
const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const walletContainer = document.getElementById('wallet-container');
const walletInfo = document.getElementById('wallet-info');
const walletAddressDisplay = document.getElementById('wallet-address');
const connectWarning = document.getElementById('connect-warning');
const workspace = document.getElementById('workspace');

// Initialize Provider
if (window.ethereum) {
  provider = new ethers.BrowserProvider(window.ethereum);
}

// Listeners
export function initAuth() {
  if (!window.ethereum) {
    btnConnect.innerHTML = "MetaMask not installed";
    btnConnect.disabled = true;
    return;
  }

  // Check if already connected silently
  window.ethereum.request({ method: 'eth_accounts' })
    .then(handleAccountsChanged)
    .catch(console.error);

  // Bind Buttons
  btnConnect.addEventListener('click', connectWallet);
  btnDisconnect.addEventListener('click', disconnectWallet);

  // Wallet events
  window.ethereum.on('accountsChanged', handleAccountsChanged);
  window.ethereum.on('chainChanged', () => window.location.reload());
}

async function connectWallet() {
  if (!provider) return;
  try {
    btnConnect.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Connecting...
    `;

    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    handleAccountsChanged(accounts);
  } catch (err) {
    console.error("Wallet connection failed:", err);
    btnConnect.innerHTML = "Connect Failed - Try Again";
  }
}

export function disconnectWallet() {
  // MetaMask doesn't have a true 'disconnect' via standard API that forces logging out from the dapp alone reliably without revoking permissions in MetaMask itself. 
  // We simulate a disconnect in UI.
  config.aws.accessKeyId = null;
  config.aws.secretAccessKey = null;
  handleAccountsChanged([]);
}

function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    // Disconnected
    currentAccount = null;

    btnConnect.classList.remove('hidden');
    walletInfo.classList.add('hidden');
    workspace.classList.add('hidden');
    workspace.classList.remove('flex'); // remove display flex
    connectWarning.classList.remove('hidden');

    btnConnect.innerHTML = `
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
      Connect MetaMask
    `;
  } else {
    // Connected
    currentAccount = accounts[0];
    config.aws.accessKeyId = null;
    config.aws.secretAccessKey = null;

    btnConnect.classList.add('hidden');
    walletInfo.classList.remove('hidden');
    walletInfo.classList.add('flex');
    connectWarning.classList.remove('hidden'); // Keep warning/auth screen visible by default
    
    // Hide workspace by default; main.js will reveal it after decryption
    workspace.classList.add('hidden');
    workspace.classList.remove('flex');
    workspace.classList.add('opacity-0');

    // Format address
    walletAddressDisplay.innerText = `${currentAccount.substring(0, 6)}...${currentAccount.substring(38)}`;
  }

  // Notify listeners
  if (accountListener) accountListener(accounts);
}

let accountListener = null;
export function onAccountChanged(callback) {
  accountListener = callback;
}

export function getHashedAddress(address) {
  if (!address) return null;
  // ethers.keccak256 returns '0x...'
  const hash = ethers.keccak256(ethers.toUtf8Bytes(address.toLowerCase()));
  return hash.replace('0x', '');
}

export function getCurrentAccount() {
  return currentAccount;
}

/**
 * Derives a symmetric encryption key by asking the user to sign a deterministic message
 * with their MetaMask wallet. This requires ZERO external dependencies since we use
 * standard Crypto.subtle for AES-GCM and the user's wallet signature as the entropy.
 */
async function deriveSymmetricKeyFromSignature() {
  if (!currentAccount) throw new Error("Wallet not connected");

  // A fixed message the user signs to generate deterministic entropy
  const message = "Sign this message to unlock your secure Local Storage encryption key for Upload Studio. \n\nIMPORTANT: Only sign this on your trusted devices.";

  // Get signature
  const signature = await window.ethereum.request({
    method: 'personal_sign',
    params: [message, currentAccount],
  });

  // Hash the signature to get a consistent 256-bit key
  const encoder = new TextEncoder();
  const signatureBytes = encoder.encode(signature);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', signatureBytes);

  // Import as AES-GCM key
  return await window.crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string using a symmetric key derived from a wallet signature.
 * Returns a base64 encoded string containing the IV and Ciphertext.
 */
export async function encryptDataNative(dataString) {
  const key = await deriveSymmetricKeyFromSignature();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );

  // Pack IV + Ciphertext
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);

  // Convert to Base64
  return btoa(String.fromCharCode.apply(null, payload));
}

/**
 * Decrypts a base64 payload that was encrypted by encryptDataNative.
 */
export async function decryptDataNative(base64Payload) {
  const key = await deriveSymmetricKeyFromSignature();

  const binaryStr = atob(base64Payload);
  const payload = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    payload[i] = binaryStr.charCodeAt(i);
  }

  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

export async function sha256(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

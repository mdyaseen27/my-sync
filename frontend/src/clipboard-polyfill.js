// ClipboardItem polyfill for browsers that don't support it
// Only needed for older browsers
if (typeof window !== 'undefined' && !window.ClipboardItem) {
  // Minimal polyfill - browsers with Clipboard API should work natively
  console.warn('ClipboardItem not supported, clipboard copy may require polyfill');
}

// Ensure navigator.clipboard is available
export async function writeTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for older browsers
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export async function writeImageToClipboard(blob) {
  if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
    const item = new ClipboardItem({ [blob.type]: blob });
    return navigator.clipboard.write([item]);
  }
  // Fallback: just write text or alert user
  throw new Error('Clipboard write not supported in this browser');
}
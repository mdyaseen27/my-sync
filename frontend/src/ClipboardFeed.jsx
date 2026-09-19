import { useState, useEffect, useRef, useCallback } from 'react';
import { decryptImage } from './crypto';

export default function ClipboardFeed({ items, pin, salt, onCopyText, onCopyImage, onAddText, onAddImage, onDeleteItem }) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const feedRef = useRef(null);
  
  const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }, []);
  
  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) { const file = files[0]; if (file.type.startsWith('image/')) { onAddImage(file); return; } }
    const text = e.dataTransfer.getData('text/plain');
    if (text && text.trim()) onAddText(text);
  }, [onAddImage, onAddText]);
  
  const handlePaste = useCallback(async (e) => {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) { const file = item.getAsFile(); if (file) { onAddImage(file); return; } }
      else if (item.type === 'text/plain') { const text = await new Promise(r => item.getAsString(r)); if (text.trim()) { onAddText(text); return; } }
    }
  }, [onAddImage, onAddText]);
  
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.addEventListener('dragover', handleDragOver);
    feed.addEventListener('dragleave', handleDragLeave);
    feed.addEventListener('drop', handleDrop);
    feed.addEventListener('paste', handlePaste);
    return () => { feed.removeEventListener('dragover', handleDragOver); feed.removeEventListener('dragleave', handleDragLeave); feed.removeEventListener('drop', handleDrop); feed.removeEventListener('paste', handlePaste); };
  }, [handleDragOver, handleDragLeave, handleDrop, handlePaste]);
  
  const handleFileSelect = (e) => { const file = e.target.files[0]; if (file) onAddImage(file); e.target.value = ''; };
  
  return (
    <div className={`clipboard-feed ${dragging ? 'dragging' : ''}`} ref={feedRef} tabIndex={0} role="region" aria-label="Clipboard feed">
      <div className="feed-header">
        <h3>Clipboard</h3>
        <div className="feed-actions">
          <label className="btn btn-secondary btn-sm file-input-label">
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            📎 Upload Image
          </label>
          <p className="feed-hint">Paste (Ctrl+V) or drag text/images here</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="empty-state"><p>Nothing synced yet</p><p className="empty-hint">Copy text or drag an image to get started</p></div>
      ) : (
        <ul className="items" role="list">
          {items.map(item => (
            <ClipboardItem key={item.id} item={item} pin={pin} onCopyText={onCopyText} onCopyImage={onCopyImage} onDeleteItem={onDeleteItem} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ClipboardItem({ item, pin, onCopyText, onCopyImage, onDeleteItem }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const previewRef = useRef(null);
  
  const handleCopy = async () => {
    setLoading(true);
    try { if (item.type === 'text') await onCopyText(item); else await onCopyImage(item); } finally { setLoading(false); }
  };
  
  useEffect(() => {
    if (item.type === 'image' && pin && salt && previewRef.current) {
      let cancelled = false;
      decryptImage(pin, salt, item.ciphertext, item.iv)
        .then(arrayBuffer => {
          if (cancelled) return;
          const blob = new Blob([arrayBuffer], { type: item.mimeType || 'image/png' });
          const url = URL.createObjectURL(blob);
          if (previewRef.current) setPreviewUrl(url); else URL.revokeObjectURL(url);
        })
        .catch(() => { if (!cancelled) setPreviewUrl(null); });
      return () => { cancelled = true; if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }
  }, [item, pin, salt]);
  
  useEffect(() => { return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }; }, [previewUrl]);
  
  if (item.type === 'text') {
    return (
      <li className="item item-text">
        <div className="item-content"><pre className="item-text-content">{item.ciphertext}</pre></div>
        <div className="item-actions">
          <button className="btn btn-primary" onClick={handleCopy} disabled={loading}>{loading ? '⏳' : '📋 Copy'}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onDeleteItem(item.id)}>🗑</button>
          <span className="item-time">{new Date(item.createdAt).toLocaleTimeString()}</span>
        </div>
      </li>
    );
  }
  
  return (
    <li className="item item-image">
      <div className="item-content">
        {previewUrl ? <img src={previewUrl} alt="Synced" className="item-image-preview" /> : <div className="item-image-placeholder">Loading...</div>}
      </div>
      <div className="item-actions">
        <button className="btn btn-primary" onClick={handleCopy} disabled={loading}>{loading ? '⏳' : '📋 Copy'}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onDeleteItem(item.id)}>🗑</button>
        <span className="item-time">{new Date(item.createdAt).toLocaleTimeString()}</span>
      </div>
    </li>
  );
}
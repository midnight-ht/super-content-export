(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuperContentExportRegion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function selectionRect(start, end, viewport) {
    const clamp = (value, max) => Math.min(max, Math.max(0, value));
    const left = clamp(Math.min(start.x, end.x), viewport.width);
    const top = clamp(Math.min(start.y, end.y), viewport.height);
    const width = clamp(Math.max(start.x, end.x), viewport.width) - left;
    const height = clamp(Math.max(start.y, end.y), viewport.height) - top;
    return width >= 2 && height >= 2 ? { left, top, width, height } : null;
  }
  function cropRect(rect, viewport, image) {
    const sx = image.width / viewport.width;
    const sy = image.height / viewport.height;
    const left = Math.max(0, Math.floor(rect.left * sx));
    const top = Math.max(0, Math.floor(rect.top * sy));
    const right = Math.min(image.width, Math.ceil((rect.left + rect.width) * sx));
    const bottom = Math.min(image.height, Math.ceil((rect.top + rect.height) * sy));
    return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  }
  async function cropPng(dataUrl, rect, viewport) {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Screenshot decode failed'));
      image.src = dataUrl;
    });
    const crop = cropRect(rect, viewport, { width: image.naturalWidth, height: image.naturalHeight });
    if (!crop.width || !crop.height) throw new Error('Empty region');
    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, crop.left, crop.top, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'));
  }
  // Prune a detached clone, keeping semantic ancestors without pulling in
  // unrelated siblings. Text geometry comes from the live document.
  function cloneMarkdownContent(root, options = {}) {
    const doc = options.document || root?.ownerDocument || document;
    const styleResolver = options.styleResolver || (node => getComputedStyle(node));
    const ignored = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD']);
    const atomic = new Set(['IMG', 'BR', 'HR']);
    const bounds = rect => ({ left: rect.left, top: rect.top,
      right: rect.right ?? rect.left + rect.width, bottom: rect.bottom ?? rect.top + rect.height });
    const intersection = (a, b) => {
      const rect = { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
        right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) };
      return rect.right > rect.left && rect.bottom > rect.top ? rect : null;
    };
    const intersects = (rect, clip) => Boolean(intersection(bounds(rect), clip));
    const contained = (rect, clip) => rect.left >= clip.left && rect.top >= clip.top
      && rect.right <= clip.right && rect.bottom <= clip.bottom;
    const range = options.rect ? doc.createRange() : null;
    function selectedText(node, clip) {
      const value = node.nodeValue || '';
      if (!clip || !value) return value;
      range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects());
      if (!rects.some(rect => intersects(rect, clip))) return '';
      if (rects.every(rect => contained(bounds(rect), clip))) return value;
      let selected = '', offset = 0;
      for (const character of value) {
        range.setStart(node, offset);
        offset += character.length;
        range.setEnd(node, offset);
        if (Array.from(range.getClientRects()).some(rect => intersects(rect, clip))) selected += character;
      }
      return selected;
    }
    function visit(node, clip) {
      if (node.nodeType === 3) {
        const value = selectedText(node, clip);
        return value ? doc.createTextNode(value) : null;
      }
      if (node.nodeType !== 1) return null;
      const tag = String(node.tagName).toUpperCase();
      if (ignored.has(tag) || String(node.getAttribute('id') || '').startsWith('__SuperContentExport_')) return null;
      const style = styleResolver(node) || {};
      if (node.getAttribute('hidden') !== null || style.display === 'none'
        || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return null;
      if (clip && /hidden|clip|auto|scroll/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) {
        const rect = node.getBoundingClientRect();
        const clipped = { ...clip };
        if (/hidden|clip|auto|scroll/.test(style.overflowX || style.overflow || '')) {
          clipped.left = Math.max(clip.left, rect.left); clipped.right = Math.min(clip.right, rect.right);
        }
        if (/hidden|clip|auto|scroll/.test(style.overflowY || style.overflow || '')) {
          clipped.top = Math.max(clip.top, rect.top); clipped.bottom = Math.min(clip.bottom, rect.bottom);
        }
        if (clipped.right <= clipped.left || clipped.bottom <= clipped.top) return null;
        clip = clipped;
      }
      const clone = node.cloneNode(false);
      for (const attribute of ['href', 'src']) {
        const value = node.getAttribute(attribute);
        if (value && !/^\s*(?:javascript:|#)/i.test(value)) {
          try { clone.setAttribute(attribute, new URL(value, node.baseURI || doc.baseURI).href); } catch { /* Preserve invalid URLs. */ }
        }
      }
      if (atomic.has(tag)) {
        return !clip || Array.from(node.getClientRects()).some(rect => intersects(rect, clip)
          || (tag === 'BR' && rect.left >= clip.left && rect.left < clip.right
            && rect.top < clip.bottom && rect.bottom > clip.top)) ? clone : null;
      }
      const assigned = tag === 'SLOT' ? node.assignedNodes?.({ flatten: true }) : null;
      const children = assigned?.length ? Array.from(assigned)
        : node.shadowRoot ? Array.from(node.shadowRoot.childNodes) : Array.from(node.childNodes || []);
      let hasContent = false;
      for (const child of children) {
        const selected = visit(child, clip);
        if (selected) {
          clone.appendChild(selected);
          hasContent = true;
        } else if (tag === 'TR' && ['TD', 'TH'].includes(String(child.tagName).toUpperCase())) {
          // Keep an empty cell so partially selected rows retain column positions.
          clone.appendChild(child.cloneNode(false));
        }
      }
      return hasContent ? clone : null;
    }
    return root ? visit(root, options.rect ? bounds(options.rect) : null) : null;
  }
  return { selectionRect, cropRect, cropPng, cloneMarkdownContent };
});

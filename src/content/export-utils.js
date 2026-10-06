(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuperContentExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BLOCK_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'DL', 'FIELDSET',
    'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5',
    'H6', 'HEADER', 'HR', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION',
    'TABLE', 'UL',
  ]);
  const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const EXPORT_STYLE_PROPERTIES = [
    'box-sizing', 'display', 'position', 'top', 'right', 'bottom', 'left',
    'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'overflow', 'overflow-x', 'overflow-y', 'color', 'background-color',
    'background-image', 'background-size', 'background-position',
    'background-repeat', 'border-top', 'border-right', 'border-bottom',
    'border-left', 'border-radius', 'font-family', 'font-size', 'font-weight',
    'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-indent',
    'text-decoration', 'white-space', 'word-break', 'word-wrap', 'visibility',
    'opacity', 'list-style-type', 'list-style-position', 'flex', 'flex-direction',
    'flex-wrap', 'flex-grow', 'flex-shrink', 'align-items', 'justify-content',
    'gap', 'transform', 'transform-origin',
  ];

  function childNodesOf(node) {
    return Array.from(node?.childNodes || []);
  }

  function attr(node, name) {
    return typeof node?.getAttribute === 'function' ? node.getAttribute(name) : null;
  }

  function normalizeInline(value) {
    return String(value || '').replace(/\s+/g, ' ');
  }

  function escapeText(value, node) {
    const whiteSpace = attr(node?.parentElement || node?.parentNode, 'data-sce-markdown-white-space');
    const normalized = whiteSpace
      ? String(value || '').replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ')
      : normalizeInline(value);
    return normalized.replace(/([\\`*_[\]<>])/g, '\\$1');
  }

  function isActionHref(href) {
    const value = String(href || '').trim().toLowerCase();
    return !value || value === '#' || value.startsWith('javascript:');
  }

  function decodePrivateUseText(text, recognizer) {
    return String(text || '').replace(/[\uE000-\uF8FF]/g, (ch) => {
      if (typeof recognizer !== 'function') return ch;
      const decoded = recognizer(ch);
      return decoded == null || decoded === '' ? ch : String(decoded);
    });
  }

  function inkDistanceRatio(left, right) {
    let diff = 0;
    const length = Math.min(left.length, right.length);
    if (!length) return 1;
    for (let index = 0; index < length; index += 1) {
      if (left[index] !== right[index]) diff += 1;
    }
    return diff / length;
  }

  function matchInkToDigits(targetInk, digitInks) {
    if (!Array.isArray(targetInk) || !targetInk.some(Boolean)) return null;
    let best = null;
    let bestRatio = 1;
    let second = 1;
    for (const [digit, ink] of Object.entries(digitInks || {})) {
      if (!Array.isArray(ink) || ink.length !== targetInk.length) continue;
      const ratio = inkDistanceRatio(targetInk, ink);
      if (ratio < bestRatio) {
        second = bestRatio;
        bestRatio = ratio;
        best = digit;
      } else if (ratio < second) {
        second = ratio;
      }
    }
    if (best == null || bestRatio > 0.34) return null;
    if (bestRatio > 0 && second - bestRatio < 0.04) return null;
    return best;
  }

  function rasterizeGlyph(char, font, size = 64) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.clearRect(0, 0, size, size);
    context.fillStyle = '#000';
    context.font = font || '32px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(char, size / 2, size / 2);
    return context.getImageData(0, 0, size, size);
  }

  function imageDataToInk(imageData, outSize = 16) {
    if (!imageData) return [];
    const { data, width, height } = imageData;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] < 24) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX) return Array.from({ length: outSize * outSize }, () => 0);
    const cropW = Math.max(1, maxX - minX + 1);
    const cropH = Math.max(1, maxY - minY + 1);
    const ink = [];
    for (let y = 0; y < outSize; y += 1) {
      for (let x = 0; x < outSize; x += 1) {
        const srcX = minX + Math.floor(((x + 0.5) * cropW) / outSize);
        const srcY = minY + Math.floor(((y + 0.5) * cropH) / outSize);
        ink.push(data[(srcY * width + srcX) * 4 + 3] > 24 ? 1 : 0);
      }
    }
    return ink;
  }

  function referenceDigitFont(font) {
    const size = String(font || '').match(/(\d+(?:\.\d+)?)px/)?.[1] || '32';
    return `700 ${size}px Arial, "Noto Sans", sans-serif`;
  }

  const privateUseGlyphCache = new Map();

  function recognizePrivateUseDigit(char, font) {
    if (typeof document === 'undefined') return char;
    const key = `${font}::${char}`;
    if (privateUseGlyphCache.has(key)) return privateUseGlyphCache.get(key);
    const targetInk = imageDataToInk(rasterizeGlyph(char, font));
    const digitInks = {};
    const referenceFont = referenceDigitFont(font);
    for (const digit of '0123456789') {
      digitInks[digit] = imageDataToInk(rasterizeGlyph(digit, referenceFont));
    }
    const matched = matchInkToDigits(targetInk, digitInks);
    const value = matched == null ? char : matched;
    privateUseGlyphCache.set(key, value);
    return value;
  }

  function defaultRecognizePrivateUseChar(char, element) {
    if (!/[\uE000-\uF8FF]/.test(char)) return char;
    let font = '32px sans-serif';
    if (element && element.nodeType === 1 && typeof getComputedStyle === 'function') {
      try {
        const computed = getComputedStyle(element);
        const size = computed.fontSize || '32px';
        const family = computed.fontFamily || 'sans-serif';
        const weight = computed.fontWeight || '400';
        font = computed.font && computed.font !== 'normal' ? computed.font : `${weight} ${size} ${family}`;
      } catch {
        // Ignore detached nodes in tests.
      }
    }
    return recognizePrivateUseDigit(char, font);
  }

  function markdownContext(options = {}) {
    return {
      recognizePrivateUseChar: options.recognizePrivateUseChar || defaultRecognizePrivateUseChar,
    };
  }

  function decodedText(node, ctx) {
    const parent = node.parentElement || node.parentNode;
    return decodePrivateUseText(node.nodeValue || '', (char) => {
      const decoded = ctx?.recognizePrivateUseChar?.(char, parent);
      return decoded == null ? char : decoded;
    });
  }

  function inlineCode(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const fence = text.includes('`') ? '``' : '`';
    return `${fence} ${text.replace(/`/g, '\\`')} ${fence}`;
  }

  function renderInline(node, ctx) {
    if (!node) return '';
    if (node.nodeType === 3) return escapeText(decodedText(node, ctx), node);
    if (node.nodeType !== 1) return '';

    const tag = String(node.tagName || '').toUpperCase();
    if (IGNORED_TAGS.has(tag)) return '';
    if (tag === 'BR') return '\n';
    if (tag === 'STRONG' || tag === 'B') return `**${renderChildrenInline(node, ctx).trim()}**`;
    if (tag === 'EM' || tag === 'I') return `*${renderChildrenInline(node, ctx).trim()}*`;
    if (tag === 'DEL' || tag === 'S' || tag === 'STRIKE') return `~~${renderChildrenInline(node, ctx).trim()}~~`;
    if (tag === 'CODE') return inlineCode(node.textContent || renderChildrenInline(node, ctx));
    if (tag === 'A') {
      const label = renderChildrenInline(node, ctx).trim() || attr(node, 'href') || '';
      const href = attr(node, 'href');
      return href && !isActionHref(href) ? `[${label}](${href})` : label;
    }
    if (tag === 'IMG') {
      const src = attr(node, 'src');
      return src ? `![${escapeText(attr(node, 'alt') || '')}](${src})` : '';
    }
    return renderChildrenInline(node, ctx);
  }

  function renderChildrenInline(node, ctx) {
    return childNodesOf(node).map((child) => renderInline(child, ctx)).join('');
  }

  function trimLines(value) {
    return String(value || '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function trimDocument(value) {
    return String(value || '')
      .replace(/^[ \t]+|[ \t]+$/g, '')
      .replace(/\n{3,}/g, '\n\n');
  }

  function renderList(node, depth, ctx) {
    const ordered = String(node.tagName || '').toUpperCase() === 'OL';
    let index = 0;
    const lines = [];
    for (const child of childNodesOf(node)) {
      if (child.nodeType !== 1 || String(child.tagName || '').toUpperCase() !== 'LI') continue;
      index += 1;
      const prefix = `${'  '.repeat(depth)}${ordered ? `${index}.` : '-'} `;
      const nested = [];
      const body = [];
      for (const part of childNodesOf(child)) {
        const tag = String(part.tagName || '').toUpperCase();
        if (part.nodeType === 1 && (tag === 'UL' || tag === 'OL')) nested.push(renderList(part, depth + 1, ctx));
        else body.push(renderInline(part, ctx));
      }
      lines.push(`${prefix}${trimLines(body.join(' '))}`);
      if (nested.length) lines.push(nested.join('\n'));
    }
    return lines.join('\n');
  }

  function renderTable(node, ctx) {
    const rows = [];
    const rowNodes = childNodesOf(node).flatMap((section) => {
      const tag = String(section.tagName || '').toUpperCase();
      if (tag === 'TR') return [section];
      return childNodesOf(section).filter((row) => String(row.tagName || '').toUpperCase() === 'TR');
    });
    for (const row of rowNodes) {
      const cells = childNodesOf(row).filter((cell) => ['TD', 'TH'].includes(String(cell.tagName || '').toUpperCase()));
      if (cells.length) rows.push(cells.map((cell) => trimLines(renderChildrenInline(cell, ctx)).replace(/\|/g, '\\|')));
    }
    if (!rows.length) return '';
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => Array.from({ length: width }, (_, i) => row[i] || ''));
    return [
      `| ${normalized[0].join(' | ')} |`,
      `| ${normalized[0].map(() => '---').join(' | ')} |`,
      ...normalized.slice(1).map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
  }

  function renderBlock(node, depth = 0, ctx) {
    if (!node) return '';
    if (node.nodeType === 3) return escapeText(decodedText(node, ctx), node);
    if (node.nodeType !== 1) return '';

    const tag = String(node.tagName || '').toUpperCase();
    if (IGNORED_TAGS.has(tag)) return '';
    if (/^H[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag.slice(1)))} ${trimLines(renderChildrenInline(node, ctx))}`;
    if (tag === 'UL' || tag === 'OL') return renderList(node, depth, ctx);
    if (tag === 'TABLE') return renderTable(node, ctx);
    if (tag === 'HR') return '---';
    if (tag === 'PRE') {
      const code = String(node.textContent || '').replace(/^\n|\n$/g, '');
      const codeChild = childNodesOf(node).find((child) => String(child.tagName || '').toUpperCase() === 'CODE');
      const className = attr(codeChild, 'class') || '';
      const language = (className.match(/(?:^|\s)language-([\w-]+)/) || [])[1] || '';
      return `\`\`\`${language}\n${code}\n\`\`\``;
    }
    if (tag === 'BLOCKQUOTE') {
      return trimLines(renderBlocks(node, ctx)).split('\n').map((line) => `> ${line}`).join('\n');
    }
    if (BLOCK_TAGS.has(tag) || hasBlockDescendant(node)) return renderBlocks(node, ctx);
    return renderChildrenInline(node, ctx);
  }

  function renderBlocks(node, ctx) {
    const parts = [];
    let inlineBuffer = '';
    const flushInline = () => {
      const value = trimLines(inlineBuffer);
      if (value) parts.push(value);
      inlineBuffer = '';
    };
    for (const child of childNodesOf(node)) {
      const tag = String(child.tagName || '').toUpperCase();
      const isBlock = child.nodeType === 1 && (BLOCK_TAGS.has(tag) || tag === 'BLOCKQUOTE');
      if (isBlock) {
        flushInline();
        const rendered = renderBlock(child, 0, ctx);
        const value = tag === 'UL' || tag === 'OL'
          ? String(rendered).replace(/\s+$/, '')
          : trimLines(rendered);
        if (value) parts.push(value);
      } else {
        inlineBuffer += renderInline(child, ctx);
      }
    }
    flushInline();
    return parts.join('\n\n');
  }

  function hasBlockDescendant(node) {
    return childNodesOf(node).some((child) => {
      if (child.nodeType !== 1) return false;
      const tag = String(child.tagName || '').toUpperCase();
      return BLOCK_TAGS.has(tag) || tag === 'BLOCKQUOTE' || hasBlockDescendant(child);
    });
  }

  function elementToMarkdown(element, options = {}) {
    if (!element) return '';
    const ctx = markdownContext(options);
    const tag = String(element.tagName || '').toUpperCase();
    const hasBlockStructure = BLOCK_TAGS.has(tag) || tag === 'BLOCKQUOTE' || hasBlockDescendant(element);
    return trimDocument(hasBlockStructure ? renderBlock(element, 0, ctx) : renderInline(element, ctx));
  }

  // element.contains() never crosses a shadow boundary, so an ancestor of a
  // shadow host has to be detected by walking the composed tree instead.
  function isComposedAncestor(node, target) {
    if (!node || !target) return false;
    let current = target;
    let guard = 0;
    while (current && guard < 512) {
      guard += 1;
      if (current === node) return true;
      current = getPickParent(current);
    }
    return false;
  }

  function shouldHideViewportOverlay(node, exportTarget) {
    if (!node) return false;
    if (node.nodeType && node.nodeType !== 1) return false;
    if (!exportTarget) return true;
    if (node === exportTarget) return false;
    if (typeof node.contains === 'function' && node.contains(exportTarget)) return false;
    if (typeof exportTarget.contains === 'function' && exportTarget.contains(node)) return false;
    if (isComposedAncestor(node, exportTarget)) return false;
    return true;
  }

  // Walks one level up across shadow boundaries: slotted content resolves to
  // its <slot>, and the top node of a shadow tree resolves to the shadow host.
  function getPickParent(node) {
    if (!node) return null;
    if (node.assignedSlot) return node.assignedSlot;
    if (node.parentElement) return node.parentElement;
    const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
    if (root && root.host && root !== node.ownerDocument) return root.host;
    return null;
  }

  // event.target is retargeted to the shadow host for composed events, so the
  // real node under the pointer has to come from the event path.
  function getPickEventTarget(event) {
    const path = typeof event?.composedPath === 'function' ? event.composedPath() : null;
    if (Array.isArray(path)) {
      const deep = path.find((node) => node && node.nodeType === 1);
      if (deep) return deep;
    }
    const target = event?.target;
    if (!target) return null;
    return target.nodeType === 1 ? target : getPickParent(target);
  }

  function getPickChain(element, stopNode) {
    const chain = [];
    const seen = new Set();
    let current = element && element.nodeType === 1 ? element : getPickParent(element);
    while (current && current.nodeType === 1 && current !== stopNode && !seen.has(current)) {
      seen.add(current);
      chain.push(current);
      current = getPickParent(current);
    }
    return chain;
  }

  function shiftPickIndex(index, delta, length) {
    if (!length) return 0;
    return Math.max(0, Math.min(length - 1, (Number(index) || 0) + (Number(delta) || 0)));
  }

  function pickIndexDeltaFromWheel(deltaY) {
    if (!deltaY) return 0;
    return Number(deltaY) < 0 ? 1 : -1;
  }

  // The depth is relative to whatever is currently hovered, so it has to be
  // re-clamped every time the chain is rebuilt around a new pointer target.
  function getPickDepthAfterRebuild(depth, length) {
    const size = Number(length) || 0;
    if (size <= 0) return 0;
    return Math.max(0, Math.min(size - 1, Number(depth) || 0));
  }

  function pickElementName(element) {
    const tag = String(element.tagName || '').toLowerCase();
    const id = typeof element.getAttribute === 'function' ? element.getAttribute('id') : '';
    if (id) return `${tag}#${id}`;
    const className = element.classList && element.classList.length
      ? String(element.classList[0] || '')
      : '';
    return className ? `${tag}.${className}` : tag;
  }

  function getPickLabel(element, depth) {
    if (!element || element.nodeType !== 1) return '';
    const name = pickElementName(element).slice(0, 48);
    const level = Math.max(0, Number(depth) || 0);
    return level > 0 ? `${name} \u2191${level}` : name;
  }

  function getPickBadgePosition(targetRect, badgeSize, viewport, gap = 6, margin = 8) {
    const rect = targetRect || {};
    const badge = badgeSize || {};
    const screen = viewport || {};
    const width = Math.max(1, Number(badge.width) || 1);
    const height = Math.max(1, Number(badge.height) || 1);
    const viewportWidth = Math.max(width + margin * 2, Number(screen.width) || 0);
    const viewportHeight = Math.max(height + margin * 2, Number(screen.height) || 0);
    const left = Math.min(
      Math.max(margin, Number(rect.left) || 0),
      Math.max(margin, viewportWidth - width - margin),
    );
    const aboveTop = (Number(rect.top) || 0) - height - gap;
    const top = aboveTop >= margin
      ? aboveTop
      : Math.min((Number(rect.bottom) || 0) + gap, Math.max(margin, viewportHeight - height - margin));
    return { left, top };
  }

  function selectorPartFor(element) {
    if (element.id) return `#${escapeCssIdentifier(element.id)}`;
    let part = String(element.tagName || '').toLowerCase();
    const classes = element.classList?.length ? Array.from(element.classList).slice(0, 2) : [];
    if (classes.length) part += `.${classes.map(escapeCssIdentifier).join('.')}`;
    const siblings = Array.from(element.parentElement?.children || []);
    if (siblings.length > 1) {
      const sameTag = siblings.filter((child) => child.tagName === element.tagName);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(element) + 1})`;
    }
    return part;
  }

  function escapeCssIdentifier(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
    return String(value).replace(/[^\w-]/g, (character) => `\\${character}`);
  }

  // Builds a selector that survives shadow roots by scoping each step to the
  // root the element lives in, then joining host selectors with '>>>'.
  function selectorForElement(element) {
    if (!element || element.nodeType !== 1) return '';
    const segments = [];
    const seen = new Set();
    let current = element;
    let guard = 0;
    while (current && current.nodeType === 1 && guard < 12 && !seen.has(current)) {
      guard += 1;
      seen.add(current);
      const parts = [];
      let node = current;
      let depth = 0;
      while (node && node.nodeType === 1 && node.tagName !== 'BODY' && depth < 5) {
        parts.unshift(selectorPartFor(node));
        node = node.parentElement;
        depth += 1;
      }
      if (!parts.length) parts.push(selectorPartFor(current));
      segments.unshift(parts.join(' > '));
      const root = typeof current.getRootNode === 'function' ? current.getRootNode() : null;
      if (root && root.host) current = root.host;
      else break;
    }
    return segments.join(' >>> ');
  }

  // Resolves a possibly shadow-scoped selector back to an element. '>>>' steps
  // into the previous match's shadow root; a plain selector falls back to the
  // document for selectors stored by earlier versions.
  function querySelectorDeep(selector, root) {
    const value = String(selector || '').trim();
    if (!value) return null;
    const scopes = value.split('>>>').map((part) => part.trim()).filter(Boolean);
    if (!scopes.length) return null;
    let currentRoot = root || (typeof document !== 'undefined' ? document : null);
    if (!currentRoot) return null;
    let match = null;
    for (const scope of scopes) {
      if (!currentRoot || typeof currentRoot.querySelector !== 'function') return null;
      try {
        match = currentRoot.querySelector(scope);
      } catch {
        match = null;
      }
      if (!match) return null;
      currentRoot = match.shadowRoot || null;
    }
    return match;
  }

  function isSameOriginResource(resourceUrl, baseUrl) {
    try {
      const resource = new URL(resourceUrl, baseUrl);
      const base = new URL(baseUrl);
      if (!['http:', 'https:'].includes(resource.protocol)) return true;
      return resource.origin === base.origin;
    } catch {
      return false;
    }
  }

  function getExportScale(width, height, requestedScale = 2, maxPixels = 16000000) {
    const requested = Number(requestedScale) > 0 ? Number(requestedScale) : 2;
    const area = Math.max(1, Number(width) * Number(height));
    return Math.min(requested, Math.sqrt(maxPixels / area));
  }

  function getVisibleCaptureScale(width, height, devicePixelRatio, requestedScale, maxPixels = 48000000) {
    const dpr = Number(devicePixelRatio) > 0 ? Number(devicePixelRatio) : 1;
    const requested = Number(requestedScale) > 0 ? Number(requestedScale) : dpr;
    return Math.min(dpr, getExportScale(width, height, requested, maxPixels));
  }

  function getAlignedPixelRange(start, size, scale) {
    const numericScale = Number(scale);
    const numericStart = Number(start) || 0;
    const numericSize = Number(size);
    if (!(numericScale > 0) || !(numericSize > 0)) return { start: 0, size: 0 };
    const alignedStart = Math.floor(numericStart * numericScale);
    const alignedEnd = Math.ceil((numericStart + numericSize) * numericScale);
    return { start: alignedStart, size: Math.max(0, alignedEnd - alignedStart) };
  }

  function getCaptureDrawRects({
    visibleLeft,
    visibleTop,
    visibleWidth,
    visibleHeight,
    contentX,
    contentY,
    sourceScaleX,
    sourceScaleY,
    outputScale,
  }) {
    const sourceX = getAlignedPixelRange(visibleLeft, visibleWidth, sourceScaleX);
    const sourceY = getAlignedPixelRange(visibleTop, visibleHeight, sourceScaleY);
    const destX = getAlignedPixelRange(contentX, visibleWidth, outputScale);
    const destY = getAlignedPixelRange(contentY, visibleHeight, outputScale);
    return {
      sx: sourceX.start,
      sy: sourceY.start,
      sw: sourceX.size,
      sh: sourceY.size,
      dx: destX.start,
      dy: destY.start,
      dw: destX.size,
      dh: destY.size,
    };
  }

  function clampCaptureSourceRect(rect, imageWidth, imageHeight) {
    const maxW = Math.max(0, Number(imageWidth) || 0);
    const maxH = Math.max(0, Number(imageHeight) || 0);
    const sx = Math.max(0, Math.min(Number(rect?.sx) || 0, Math.max(0, maxW - 1)));
    const sy = Math.max(0, Math.min(Number(rect?.sy) || 0, Math.max(0, maxH - 1)));
    return {
      ...rect,
      sx,
      sy,
      sw: Math.max(0, Math.min(Number(rect?.sw) || 0, maxW - sx)),
      sh: Math.max(0, Math.min(Number(rect?.sh) || 0, maxH - sy)),
    };
  }

  function isOpaqueCssColor(color) {
    const value = String(color || '').trim().toLowerCase();
    if (!value || value === 'transparent') return false;
    const rgba = value.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/);
    if (rgba) {
      const alpha = rgba[4] == null ? 1 : Number(rgba[4]);
      return alpha > 0;
    }
    return true;
  }

  function getExportBackgroundColor(colors, fallback = '#ffffff') {
    const list = Array.isArray(colors) ? colors : [colors];
    for (const color of list) {
      if (isOpaqueCssColor(color)) return color;
    }
    return fallback;
  }

  function getExportBackgroundColorFromElement(element, fallback = '#ffffff') {
    const colors = [];
    let current = element;
    while (current && current.nodeType === 1) {
      try {
        const style = typeof getComputedStyle === 'function' ? getComputedStyle(current) : current.style;
        colors.push(style?.backgroundColor);
      } catch {
        colors.push(current.style?.backgroundColor);
      }
      current = current.parentElement;
    }
    return getExportBackgroundColor(colors, fallback);
  }

  function isScrollableOverflow(value) {
    return ['auto', 'overlay', 'scroll'].includes(String(value || '').toLowerCase());
  }

  function getScrollableExportStyle(element, computedStyle) {
    const style = {};
    const scrollWidth = Number(element?.scrollWidth) || 0;
    const clientWidth = Number(element?.clientWidth) || 0;
    const scrollHeight = Number(element?.scrollHeight) || 0;
    const clientHeight = Number(element?.clientHeight) || 0;
    const sourceStyle = computedStyle
      || (typeof getComputedStyle === 'function' ? getComputedStyle(element) : element?.style)
      || {};
    const expandsWidth = scrollWidth > clientWidth && isScrollableOverflow(sourceStyle.overflowX || sourceStyle.overflow);
    const expandsHeight = scrollHeight > clientHeight && isScrollableOverflow(sourceStyle.overflowY || sourceStyle.overflow);

    if (expandsWidth) {
      style.width = `${scrollWidth}px`;
      style.maxWidth = 'none';
      style.overflowX = 'visible';
    }
    if (expandsHeight) {
      style.height = `${scrollHeight}px`;
      style.maxHeight = 'none';
      style.overflowY = 'visible';
    }
    if (expandsWidth || expandsHeight) style.overflow = 'visible';
    return style;
  }

  function getElementExportSize(element, computedStyle) {
    const rect = element?.getBoundingClientRect?.() || {};
    const sourceStyle = computedStyle
      || (typeof getComputedStyle === 'function' ? getComputedStyle(element) : element?.style)
      || {};
    const scrollWidth = isScrollableOverflow(sourceStyle.overflowX || sourceStyle.overflow)
      ? Number(element?.scrollWidth) || 0
      : 0;
    const scrollHeight = isScrollableOverflow(sourceStyle.overflowY || sourceStyle.overflow)
      ? Number(element?.scrollHeight) || 0
      : 0;
    return {
      width: Math.max(1, Math.ceil(Number(rect.width) || 0), Math.ceil(scrollWidth)),
      height: Math.max(1, Math.ceil(Number(rect.height) || 0), Math.ceil(scrollHeight)),
    };
  }

  function getScrollableAncestors(element, styleResolver) {
    const ancestors = [];
    const pageBody = typeof document !== 'undefined' ? document.body : null;
    const pageRoot = typeof document !== 'undefined' ? document.documentElement : null;
    let current = element;
    while (current && current !== pageBody && current !== pageRoot) {
      const computedStyle = styleResolver
        ? styleResolver(current)
        : (typeof getComputedStyle === 'function' ? getComputedStyle(current) : current.style);
      if (Object.keys(getScrollableExportStyle(current, computedStyle)).length > 0) ancestors.push(current);
      current = current.parentElement;
    }
    return ancestors;
  }

  function getInternalScrollPosition(scrollContainer, selectedElement, tile, originalPosition = {}) {
    const maxLeft = Math.max(0, (Number(scrollContainer?.scrollWidth) || 0) - (Number(scrollContainer?.clientWidth) || 0));
    const maxTop = Math.max(0, (Number(scrollContainer?.scrollHeight) || 0) - (Number(scrollContainer?.clientHeight) || 0));
    const baseLeft = scrollContainer === selectedElement ? 0 : Number(originalPosition.left) || 0;
    const baseTop = scrollContainer === selectedElement ? 0 : Number(originalPosition.top) || 0;
    return {
      left: Math.min(maxLeft, Math.max(0, baseLeft + (Number(tile?.x) || 0))),
      top: Math.min(maxTop, Math.max(0, baseTop + (Number(tile?.y) || 0))),
    };
  }

  function getCaptureTilePositions(width, height, viewportWidth, viewportHeight) {
    const tiles = [];
    const stepX = Math.max(1, Number(viewportWidth));
    const stepY = Math.max(1, Number(viewportHeight));
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) tiles.push({ x, y });
    }
    return tiles;
  }

  function getVisibleCaptureDelay(lastCaptureAt, now = Date.now(), interval = 550) {
    const last = Number(lastCaptureAt) || 0;
    const elapsed = Math.max(0, Number(now) - last);
    return Math.max(0, Number(interval) - elapsed);
  }

  function getExportToolbarPosition(targetRect, toolbarSize, viewport, gap = 16, margin = 12) {
    const toolbar = toolbarSize || {};
    const screen = viewport || {};
    const width = Math.max(1, Number(toolbar.width) || 1);
    const height = Math.max(1, Number(toolbar.height) || 1);
    const viewportWidth = Math.max(1, Number(screen.width) || width + margin * 2);
    const viewportHeight = Math.max(1, Number(screen.height) || height + margin * 2);
    const edge = Math.max(0, Number(margin) || 0);
    const maxLeft = Math.max(edge, viewportWidth - width - edge);
    const left = Math.min(maxLeft, Math.max(edge, (viewportWidth - width) / 2));
    const top = Math.min(Math.max(edge, viewportHeight - height - edge), Math.max(edge, Number(gap) || 0));
    return { left, top };
  }

  // An ancestor with transform / filter / perspective / zoom turns position:fixed
  // into a box positioned relative to that ancestor. A zero-offset probe reveals
  // both the drift and the applied scale so overlays can be compensated.
  function getOverlayCompensation(probeRect, probeSize = 100) {
    const expected = Number(probeSize) > 0 ? Number(probeSize) : 100;
    const measuredWidth = Number(probeRect?.width) || 0;
    const measuredHeight = Number(probeRect?.height) || 0;
    const scaleX = measuredWidth > 0 ? measuredWidth / expected : 1;
    const scaleY = measuredHeight > 0 ? measuredHeight / expected : 1;
    return {
      left: Number(probeRect?.left) || 0,
      top: Number(probeRect?.top) || 0,
      scaleX: scaleX > 0 ? scaleX : 1,
      scaleY: scaleY > 0 ? scaleY : 1,
    };
  }

  function compensationScales(compensation) {
    const scaleX = Number(compensation?.scaleX) > 0 ? Number(compensation.scaleX) : 1;
    const scaleY = Number(compensation?.scaleY) > 0 ? Number(compensation.scaleY) : 1;
    return { scaleX, scaleY };
  }

  // Maps a viewport rect into the local coordinate space of an overlay whose
  // containing block is not the viewport.
  function getCompensatedOverlayRect(rect, compensation) {
    const { scaleX, scaleY } = compensationScales(compensation);
    return {
      left: ((Number(rect?.left) || 0) - (Number(compensation?.left) || 0)) / scaleX,
      top: ((Number(rect?.top) || 0) - (Number(compensation?.top) || 0)) / scaleY,
      width: (Number(rect?.width) || 0) / scaleX,
      height: (Number(rect?.height) || 0) / scaleY,
    };
  }

  function getCompensatedOverlayPoint(rect, compensation) {
    const compensated = getCompensatedOverlayRect(rect, compensation);
    return { left: compensated.left, top: compensated.top };
  }

  // Keeps a fixed overlay at its intended visual size inside a scaled ancestor.
  function getCompensatedOverlayScaleTransform(compensation) {
    const { scaleX, scaleY } = compensationScales(compensation);
    const invertedX = 1 / scaleX;
    const invertedY = 1 / scaleY;
    if (Math.abs(invertedX - 1) < 0.001 && Math.abs(invertedY - 1) < 0.001) return '';
    return `scale(${invertedX}, ${invertedY})`;
  }

  // CSSStyleDeclaration.setProperty() ignores names that are not valid CSS
  // identifiers, so camelCase keys such as maxWidth have to be converted first.
  function toCssPropertyName(property) {
    return String(property || '').replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
  }

  function applyStyleProperties(target, styles, priority) {
    if (!target?.style) return;
    for (const [property, value] of Object.entries(styles || {})) {
      const name = toCssPropertyName(property);
      if (!name) continue;
      if (priority) target.style.setProperty(name, String(value), priority);
      else target.style.setProperty(name, String(value));
    }
  }

  // The picked element keeps its own computed position/top/left/transform, which
  // would offset the export clone inside the off-screen wrapper and leave blank
  // margins. The root clone is re-anchored to the wrapper's own flow origin.
  //
  // It stays position:relative rather than static so that absolutely positioned
  // descendants keep using the clone as their containing block; switching it to
  // static would reparent them onto the wrapper and distort the layout.
  function getExportRootResetStyle() {
    return {
      position: 'relative',
      top: 'auto',
      right: 'auto',
      bottom: 'auto',
      left: 'auto',
      inset: 'auto',
      float: 'none',
      clear: 'none',
      transform: 'none',
      maxWidth: 'none',
      maxHeight: 'none',
      margin: '0',
    };
  }

  function getSuccessfulExportCleanup(action, succeeded) {
    const exportAction = ['copy', 'markdown', 'png'].includes(action);
    return {
      removeToolbar: Boolean(succeeded && exportAction),
      keepSelection: true,
    };
  }

  function isSelectionForUrl(selection, currentUrl) {
    return Boolean(selection?.url && currentUrl && String(selection.url) === String(currentUrl));
  }

  function shouldRetryWithoutResources(error) {
    return error?.name === 'SecurityError' || /tainted canvas/i.test(String(error?.message || ''));
  }

  function stripExternalResources(root, baseUrl) {
    const elements = [root, ...Array.from(root.querySelectorAll?.('*') || [])];
    for (const element of elements) {
      const tag = String(element.tagName || '').toUpperCase();
      if (tag === 'IMG') {
        const src = element.getAttribute('src');
        if (src && !isSameOriginResource(src, baseUrl)) {
          element.removeAttribute('src');
          element.removeAttribute('srcset');
          element.style.objectFit = 'contain';
        }
      }
      if (tag === 'IMAGE') {
        const href = element.getAttribute('href') || element.getAttribute('xlink:href');
        if (href && !isSameOriginResource(href, baseUrl)) {
          element.removeAttribute('href');
          element.removeAttribute('xlink:href');
        }
      }
      if (['IFRAME', 'OBJECT', 'EMBED', 'VIDEO', 'AUDIO'].includes(tag)) {
        element.removeAttribute('src');
        element.removeAttribute('srcset');
        element.removeAttribute('poster');
        element.removeAttribute('data');
      }
      const backgroundImage = element.style?.backgroundImage || '';
      if (backgroundImage && /url\(/i.test(backgroundImage)) {
        const urls = Array.from(backgroundImage.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi));
        if (urls.some((match) => !isSameOriginResource(match[1], baseUrl))) {
          element.style.backgroundImage = 'none';
        }
      }
    }
  }

  function stripAllResources(root) {
    const elements = [root, ...Array.from(root.querySelectorAll?.('*') || [])];
    for (const element of elements) {
      const tag = String(element.tagName || '').toUpperCase();
      if (tag === 'IMG') {
        element.removeAttribute('src');
        element.removeAttribute('srcset');
        element.style.visibility = 'hidden';
      }
      if (tag === 'IMAGE' || tag === 'USE') {
        element.removeAttribute('href');
        element.removeAttribute('xlink:href');
      }
      if (['IFRAME', 'OBJECT', 'EMBED', 'VIDEO', 'AUDIO'].includes(tag)) {
        element.removeAttribute('src');
        element.removeAttribute('srcset');
        element.removeAttribute('poster');
        element.removeAttribute('data');
      }
      if (element.style) {
        for (let index = element.style.length - 1; index >= 0; index -= 1) {
          const property = element.style[index];
          if (/url\(/i.test(element.style.getPropertyValue(property))) {
            element.style.removeProperty(property);
          }
        }
      }
    }
  }

  function yieldToBrowser(frames = 1) {
    return new Promise((resolve) => {
      const nextFrame = () => {
        if (frames <= 1) {
          resolve();
          return;
        }
        frames -= 1;
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(nextFrame);
        else setTimeout(nextFrame, 16);
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(nextFrame);
      else setTimeout(nextFrame, 16);
    });
  }

  async function copyComputedStyles(source, target, state) {
    if (typeof getComputedStyle === 'function') {
      const computed = getComputedStyle(source);
      for (const property of EXPORT_STYLE_PROPERTIES) {
        target.style.setProperty(
          property,
          computed.getPropertyValue(property),
          computed.getPropertyPriority(property),
        );
      }
    }
    state.nodes += 1;
    if (state.nodes % 40 === 0) await yieldToBrowser();
    const sourceChildren = Array.from(source.children || []);
    const targetChildren = Array.from(target.children || []);
    for (let index = 0; index < sourceChildren.length; index += 1) {
      if (targetChildren[index]) await copyComputedStyles(sourceChildren[index], targetChildren[index], state);
    }
  }

  async function cloneForExport(element) {
    const clone = element.cloneNode(true);
    await copyComputedStyles(element, clone, { nodes: 0 });
    const size = getElementExportSize(element, getComputedStyle(element));
    clone.style.boxSizing = 'border-box';
    clone.style.width = `${size.width}px`;
    clone.style.height = 'auto';
    clone.style.margin = '0';
    // The clone is rendered inside an off-screen wrapper, so the positioning it
    // inherited from its ancestors on the live page must not be carried over.
    applyStyleProperties(clone, getExportRootResetStyle(), 'important');
    const sourceElements = [element, ...Array.from(element.querySelectorAll?.('*') || [])];
    const cloneElements = [clone, ...Array.from(clone.querySelectorAll?.('*') || [])];
    sourceElements.forEach((sourceNode, index) => {
      const cloneNode = cloneElements[index];
      if (!cloneNode?.style) return;
      const expandedStyle = getScrollableExportStyle(sourceNode, getComputedStyle(sourceNode));
      applyStyleProperties(cloneNode, expandedStyle, 'important');
    });
    return clone;
  }

  async function renderCloneToPng(clone, width, options) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;background:${options.background || '#ffffff'};z-index:-1;`;
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);
    try {
      const cloneRect = clone.getBoundingClientRect();
      const renderedWidth = Math.max(1, width, Math.ceil(cloneRect.width));
      const height = Math.max(1, Math.ceil(cloneRect.height));
      wrapper.style.width = `${renderedWidth}px`;
      const serialized = new XMLSerializer().serializeToString(clone);
      const background = options.background || '#ffffff';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${renderedWidth}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${renderedWidth}px;min-height:${height}px;background:${background};">${serialized}</div></foreignObject></svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.width = renderedWidth;
        image.height = height;
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('Unable to render selected content as image'));
          image.src = url;
        });
        const outputScale = getExportScale(renderedWidth, height, options.scale);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(renderedWidth * outputScale));
        canvas.height = Math.max(1, Math.floor(height * outputScale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas context unavailable');
        context.scale(canvas.width / renderedWidth, canvas.height / height);
        context.drawImage(image, 0, 0, renderedWidth, height);
        return canvasToPngBlob(canvas);
      } finally {
        URL.revokeObjectURL(url);
      }
    } finally {
      wrapper.remove();
    }
  }

  function imageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to load captured page image'));
      image.src = dataUrl;
    });
  }

  async function canvasToPngBlob(canvas) {
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (png) return png;
    const dataUrl = canvas.toDataURL('image/png');
    const binary = atob(dataUrl.split(',')[1]);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: 'image/png' });
  }

  async function renderElementFromVisibleCaptures(element, captureVisibleTab, options = {}) {
    if (typeof captureVisibleTab !== 'function') throw new Error('Visible capture unavailable');
    const scrollContainer = getScrollableAncestors(element)[0] || null;
    const pageSize = options.fullPage ? {
      width: Math.max(window.innerWidth, document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
      height: Math.max(window.innerHeight, document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
    } : null;
    const pageRect = () => ({ left: -window.scrollX, top: -window.scrollY,
      right: pageSize.width - window.scrollX, bottom: pageSize.height - window.scrollY });
    const rect = options.fullPage ? pageRect() : element.getBoundingClientRect();
    const { width, height } = pageSize || getElementExportSize(element, getComputedStyle(element));
    const viewportWidth = Math.max(1, Math.floor(window.innerWidth));
    const viewportHeight = Math.max(1, Math.floor(window.innerHeight));
    const captureWidth = scrollContainer
      ? Math.min(viewportWidth, Math.max(1, Number(scrollContainer.clientWidth) || viewportWidth))
      : viewportWidth;
    const captureHeight = scrollContainer
      ? Math.min(viewportHeight, Math.max(1, Number(scrollContainer.clientHeight) || viewportHeight))
      : viewportHeight;
    const documentLeft = rect.left + window.scrollX;
    const documentTop = rect.top + window.scrollY;
    const outputScale = getVisibleCaptureScale(
      width,
      height,
      Number(window.devicePixelRatio) > 0 ? Number(window.devicePixelRatio) : 1,
      options.scale,
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * outputScale));
    canvas.height = Math.max(1, Math.round(height * outputScale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable');
    context.fillStyle = options.background || getExportBackgroundColorFromElement(element);
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = 'high';

    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;
    const originalInternalScroll = scrollContainer
      ? { left: scrollContainer.scrollLeft, top: scrollContainer.scrollTop }
      : null;
    try {
      for (const tile of getCaptureTilePositions(width, height, captureWidth, captureHeight)) {
        if (scrollContainer) {
          const position = getInternalScrollPosition(scrollContainer, element, tile, originalInternalScroll);
          scrollContainer.scrollLeft = position.left;
          scrollContainer.scrollTop = position.top;
        } else {
          window.scrollTo(documentLeft + tile.x, documentTop + tile.y);
        }
        await yieldToBrowser(2);
        const currentRect = options.fullPage ? pageRect() : element.getBoundingClientRect();
        const containerRect = scrollContainer?.getBoundingClientRect?.();
        const dataUrl = await captureVisibleTab();
        const image = await imageFromDataUrl(dataUrl);
        const sourceScaleX = image.naturalWidth / viewportWidth;
        const sourceScaleY = image.naturalHeight / viewportHeight;
        const visibleLeft = Math.max(0, currentRect.left, containerRect?.left ?? 0);
        const visibleTop = Math.max(0, currentRect.top, containerRect?.top ?? 0);
        const visibleRight = Math.min(viewportWidth, currentRect.right, containerRect?.right ?? viewportWidth);
        const visibleBottom = Math.min(viewportHeight, currentRect.bottom, containerRect?.bottom ?? viewportHeight);
        const visibleWidth = visibleRight - visibleLeft;
        const visibleHeight = visibleBottom - visibleTop;
        if (visibleWidth <= 0 || visibleHeight <= 0) continue;

        const internalDeltaX = scrollContainer
          ? scrollContainer.scrollLeft - (scrollContainer === element ? 0 : originalInternalScroll.left)
          : 0;
        const internalDeltaY = scrollContainer
          ? scrollContainer.scrollTop - (scrollContainer === element ? 0 : originalInternalScroll.top)
          : 0;
        const rects = clampCaptureSourceRect(
          getCaptureDrawRects({
            visibleLeft,
            visibleTop,
            visibleWidth,
            visibleHeight,
            contentX: window.scrollX + visibleLeft + internalDeltaX - documentLeft,
            contentY: window.scrollY + visibleTop + internalDeltaY - documentTop,
            sourceScaleX,
            sourceScaleY,
            outputScale,
          }),
          image.naturalWidth,
          image.naturalHeight,
        );
        if (rects.sw <= 0 || rects.sh <= 0 || rects.dw <= 0 || rects.dh <= 0) continue;
        context.imageSmoothingEnabled = Math.abs(rects.sw - rects.dw) > 2 || Math.abs(rects.sh - rects.dh) > 2;
        context.drawImage(
          image,
          rects.sx,
          rects.sy,
          rects.sw,
          rects.sh,
          rects.dx,
          rects.dy,
          rects.dw,
          rects.dh,
        );
      }
      return canvasToPngBlob(canvas);
    } finally {
      if (scrollContainer && originalInternalScroll) {
        scrollContainer.scrollLeft = originalInternalScroll.left;
        scrollContainer.scrollTop = originalInternalScroll.top;
      }
      window.scrollTo(originalScrollX, originalScrollY);
    }
  }

  async function renderElementToPng(element, options = {}) {
    if (!element || typeof document === 'undefined') throw new Error('No element selected');
    const exportOptions = {
      ...options,
      background: options.background || getExportBackgroundColorFromElement(element),
    };
    const { width } = getElementExportSize(element, getComputedStyle(element));
    const clone = await cloneForExport(element);
    stripExternalResources(clone, location.href);
    try {
      return await renderCloneToPng(clone, width, exportOptions);
    } catch (error) {
      if (!shouldRetryWithoutResources(error)) throw error;
      const safeClone = await cloneForExport(element);
      stripAllResources(safeClone);
      try {
        return await renderCloneToPng(safeClone, width, exportOptions);
      } catch (safeError) {
        if (!exportOptions.captureVisibleTab) throw safeError;
        return renderElementFromVisibleCaptures(element, exportOptions.captureVisibleTab, exportOptions);
      }
    }
  }

  return {
    elementToMarkdown,
    renderElementToPng,
    isSameOriginResource,
    getExportScale,
    getVisibleCaptureScale,
    getAlignedPixelRange,
    getCaptureDrawRects,
    getExportBackgroundColor,
    getScrollableExportStyle,
    getElementExportSize,
    getScrollableAncestors,
    getInternalScrollPosition,
    shouldRetryWithoutResources,
    getCaptureTilePositions,
    getVisibleCaptureDelay,
    getExportToolbarPosition,
    getSuccessfulExportCleanup,
    isSelectionForUrl,
    renderElementFromVisibleCaptures,
    shouldHideViewportOverlay,
    decodePrivateUseText,
    matchInkToDigits,
    getPickChain,
    getPickParent,
    getPickEventTarget,
    shiftPickIndex,
    getPickDepthAfterRebuild,
    getPickLabel,
    getPickBadgePosition,
    pickIndexDeltaFromWheel,
    isComposedAncestor,
    getOverlayCompensation,
    getCompensatedOverlayRect,
    getCompensatedOverlayPoint,
    getCompensatedOverlayScaleTransform,
    getExportRootResetStyle,
    toCssPropertyName,
    applyStyleProperties,
    selectorForElement,
    querySelectorDeep,
  };
});

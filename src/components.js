export const icons = {
  home: 'M3.5 11 11 4.4a1.5 1.5 0 0 1 2 0l7.5 6.6M5.5 10.2v8.3A1.5 1.5 0 0 0 7 20h2.5v-5.5h5V20H17a1.5 1.5 0 0 0 1.5-1.5v-8.3',
  cycle: 'M6.5 4.5h11A2.5 2.5 0 0 1 20 7v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V7a2.5 2.5 0 0 1 2.5-2.5ZM8 3v3m8-3v3M4 8.5h16M15 13a3.4 3.4 0 1 0 0 3m0-3v-2m0 2h-2',
  insights: 'M4 19.5h16M6 16.5v-4m6 4V8m6 8.5v-5M5 9l6-3 6 2 2-3',
  care: 'M12 4a8 8 0 0 0-6.3 12.9L4.5 20l3.5-.9A8 8 0 1 0 12 4Zm-.5 3.9a4.2 4.2 0 0 0 4.9 6.2 4.1 4.1 0 1 1-4.9-6.2Zm4.6-.1v2.8m-1.4-1.4h2.8',
  spark: 'M12 3c0 5-3 8-8 8 5 0 8 3 8 8 0-5 3-8 8-8-5 0-8-3-8-8Zm7 13v5m-2.5-2.5h5',
  user: 'M15.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM5.4 19.5a6.6 6.6 0 0 1 13.2 0',
  shield: 'M12 3.5c2.1 1.5 4.2 2.3 7 2.9v5.4c0 4.1-2.6 7-7 8.7-4.4-1.7-7-4.6-7-8.7V6.4c2.8-.6 4.9-1.4 7-2.9Z M10 12l1.4 1.4L14.5 10',
  download: 'M12 3.5v11m-4-4 4 4 4-4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3',
  book: 'M3 5c3-1 6-.5 9 2 3-2.5 6-3 9-2v14c-3-1-6-.5-9 2-3-2.5-6-3-9-2zM12 7v14',
  settings: 'M4 7h16M4 17h16M9 4v6m6 4v6',
  right: 'M4 12h15m-6-6 6 6-6 6',
  left: 'M20 12H5m6-6-6 6 6 6',
  chevron: 'm9 5.5 6.5 6.5L9 18.5',
  chevronBack: 'm15 5.5-6.5 6.5 6.5 6.5',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M18 6 6 18',
  calendar: 'M4 6h16v14H4zm0 4h16M8 4v4m8-4v4',
  heart: 'M20 9c0 4-8 9-8 9S4 13 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1Z',
  note: 'M6 3h9l3 3v15H6zm3 8h6m-6 4h6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  moon: 'M20 15A8 8 0 0 1 9 4a8.5 8.5 0 1 0 11 11Z',
  leaf: 'M20 4c-9 0-15 4-15 10a5 5 0 0 0 5 5c6 0 10-6 10-15ZM4 20l9-9',
};

export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function createImage(catalog) {
  const assets = new Map(catalog.map(entry => [entry.id, entry]));
  return (id, { className = '', eager = false, decorative = false, motion } = {}) => {
    const asset = assets.get(id);
    if (!asset) throw new Error(`Missing artwork ${id}`);
    const position = asset.focalPoint.map(value => `${value * 100}%`).join(' ');
    const animation = motion ? assets.get(motion) : null;
    if (motion && !animation) throw new Error(`Missing motion artwork ${motion}`);
    const reaction = animation ? ` data-mascot-motion="${animation.src}" data-mascot-duration="${animation.durationMs}"` : '';
    return `<img class="${className}" src="${asset.src}" width="${asset.width}" height="${asset.height}" alt="${decorative ? '' : escapeHtml(asset.alt)}" decoding="async" loading="${eager ? 'eager' : 'lazy'}" style="object-position:${position}"${reaction}>`;
  };
}

export function link(href, label, { style = 'text', glyph = '' } = {}) {
  return `<a class="action ${style}" href="#/${href}">${label}${glyph ? icon(glyph) : ''}</a>`;
}

export function button(action, label, { style = 'primary', glyph = '' } = {}) {
  return `<button class="action ${style}" type="button" data-action="${action}">${glyph ? icon(glyph) : ''}${label}</button>`;
}

export function heading(title, summary = '', action = '') {
  return `<header class="page-heading"><div><h1 id="page-title" tabindex="-1">${title}</h1>${summary ? `<p>${summary}</p>` : ''}</div>${action}</header>`;
}

export function empty(image, id, title, copy, action = '') {
  return `<section class="surface empty">${image(id)}<div><h2>${title}</h2><p>${copy}</p>${action}</div></section>`;
}

export function field(label, name, type = 'text', attributes = '') {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" ${attributes}></label>`;
}

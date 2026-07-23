export function Loader(size = 'medium') {
  return `<div class="loader loader-${size}"><div class="spinner"></div></div>`;
}

export function Skeleton(type = 'text', lines = 1) {
  if (type === 'card') {
    return `<div class="skeleton-card"><div class="skeleton-line skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`;
  }
  return Array(lines).fill(`<div class="skeleton-line"></div>`).join('');
}
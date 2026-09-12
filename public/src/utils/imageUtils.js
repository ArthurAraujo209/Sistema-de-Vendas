/**
 * Utilitário de imagens.
 * - Gera thumbnails otimizadas via proxy wsrv.nl (funciona com qualquer URL)
 * - Faz fallback para a original se a URL não for suportada
 */

const PROXY = 'https://wsrv.nl/';

/**
 * Gera uma URL de thumbnail redimensionada.
 * Usa wsrv.nl (proxy gratuito) que redimensiona no servidor e serve WebP.
 *
 * @param {string} url     URL original da imagem
 * @param {number} width   Largura máxima em pixels
 * @param {number} quality Qualidade (1-100)
 * @returns {string}       URL otimizada
 */
export function thumbUrl(url, width = 400, quality = 78) {
  if (!url || typeof url !== 'string') return '';
  // Só passa pelo proxy se for uma URL http(s)
  if (!/^https?:\/\//i.test(url)) return url;
  // Evita reprocessar URLs que já passaram pelo proxy
  if (url.startsWith(PROXY)) return url;

  const params = new URLSearchParams({
    url: url,
    w: String(width),
    q: String(quality),
    output: 'webp',
    we: '' // preserva orientação EXIF
  });
  return `${PROXY}?${params.toString()}`;
}

/**
 * Retorna a URL original (full) para exibição em modal/detalhe.
 */
export function fullUrl(url) {
  return url || '';
}

/**
 * Gera uma imagem com:
 * - loading lazy (exceto se priority=true)
 * - decoding async
 * - placeholder cinza enquanto carrega
 * - fallback de ícone se falhar
 *
 * @param {string} src
 * @param {object} opts  { alt, width, height, priority, className, onClick }
 */
export function imgTag(src, opts = {}) {
  const {
    alt = '',
    width = 400,
    height = null,
    priority = false,
    className = '',
    onClick = ''
  } = opts;

  const small = thumbUrl(src, width);
  const safeAlt = escapeAttr(alt);
  const safeCls = escapeAttr(className);
  const loading = priority ? 'eager' : 'lazy';
  const onClickAttr = onClick ? ` onclick="${onClick}"` : '';
  const heightAttr = height ? ` height="${height}"` : '';

  return `<img src="${escapeAttr(small)}" alt="${safeAlt}" class="${safeCls}"
    loading="${loading}" decoding="async"${heightAttr}${onClickAttr}
    onerror="this.onerror=null;this.src='${escapeAttr(src)}';"
    onload="this.classList.add('img-loaded');">`;
}

function escapeAttr(t) {
  return String(t ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

/**
 * Gera link do WhatsApp a partir de um telefone.
 * Adiciona DDI 55 automaticamente se necessário.
 */
export function whatsappLink(phone, message = '') {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (!digits.startsWith('55') && digits.length <= 11) {
    digits = '55' + digits;
  }
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
}
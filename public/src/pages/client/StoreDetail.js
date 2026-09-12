import { getSellerPublicProfile, getOpenCampaignsBySeller } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { Loader } from '../../components/Loader.js';
import { imgTag } from '../../utils/imageUtils.js';

export async function ClientStoreDetailPage(params) {
  const sellerId = params.id;
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const [seller, campaigns] = await Promise.all([
      getSellerPublicProfile(sellerId),
      getOpenCampaignsBySeller(sellerId)
    ]);
    if (!seller) {
      content.innerHTML = '<div class="error-message">Loja não encontrada.</div>';
      return;
    }
    render(seller, campaigns);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar loja.</div>';
  }
}

function render(seller, campaigns) {
  const content = document.getElementById('app-content');
  const wa = seller.whatsapp ? seller.whatsapp.replace(/\D/g, '') : '';
  const insta = seller.instagram ? seller.instagram.replace(/^@/, '') : '';

  content.innerHTML = `
    <div class="store-detail-page">
      <button class="btn btn-outline" onclick="window.history.back()">← Voltar</button>

      <div class="store-header card">
        <div class="store-avatar-wrap">
          ${seller.photoUrl
            ? `<div class="img-wrap img-wrap-circle">${imgTag(seller.photoUrl, { alt: seller.displayName, width: 240, priority: true, className: 'store-avatar' })}</div>`
            : `<div class="store-avatar store-avatar-initials">${initials(seller.displayName)}</div>`}
        </div>
        <div class="store-header-info">
          <h1>${esc(seller.displayName)}</h1>
          ${seller.description ? `<p class="store-desc">${esc(seller.description)}</p>` : ''}
          <div class="store-actions">
            ${wa ? `<a href="https://wa.me/55${wa}" target="_blank" rel="noopener" class="btn btn-success btn-sm">📱 WhatsApp</a>` : ''}
            ${insta ? `<a href="https://instagram.com/${esc(insta)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">📷 ${esc(seller.instagram)}</a>` : ''}
          </div>
        </div>
      </div>

      <h2 class="store-section-title">Campanhas abertas (${campaigns.length})</h2>
      ${campaigns.length === 0
        ? '<div class="empty-state">Esta loja não tem campanhas abertas no momento.</div>'
        : `<div class="campaigns-grid">
            ${campaigns.map(c => `
              <div class="card campaign-card">
                ${c.images?.[0]
                  ? `<div class="img-wrap">${imgTag(c.images[0], { alt: c.title, width: 500, className: 'campaign-cover' })}</div>`
                  : `<div class="campaign-cover-placeholder">📷</div>`}
                <div class="card-body">
                  <h3>${esc(c.title)}</h3>
                  <p class="campaign-description">${esc((c.description || '').slice(0, 90))}</p>
                  <div class="campaign-meta">
                    <span><strong>${curr(c.price)}</strong></span>
                    <span>${fmtDate(c.estimatedDelivery)}</span>
                  </div>
                  <button class="btn btn-primary btn-block store-campaign-btn" data-id="${c.id}">Ver campanha</button>
                </div>
              </div>
            `).join('')}
          </div>`}
    </div>
  `;

  content.querySelectorAll('.store-campaign-btn').forEach(btn =>
    btn.addEventListener('click', () => router.navigate(`/client/campaigns/${btn.dataset.id}`))
  );
}

const curr = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const esc = t => String(t ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const initials = n => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
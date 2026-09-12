import { getOpenCampaigns, getActiveSellers } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { Loader } from '../../components/Loader.js';
import { imgTag } from '../../utils/imageUtils.js';

let currentTab = 'campaigns';

export async function ClientExplorePage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const [campaigns, sellers] = await Promise.all([
      getOpenCampaigns(),
      getActiveSellers()
    ]);
    render(campaigns, sellers);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar.</div>';
  }
}

function render(campaigns, sellers) {
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="explore-page">
      <header class="explore-hero">
        <h1>Descubra</h1>
        <p class="text-muted">Campanhas e lojas ativas no momento</p>
      </header>

      <div class="explore-tabs">
        <button class="tab-btn ${currentTab === 'campaigns' ? 'active' : ''}" data-tab="campaigns">
          📢 Campanhas (${campaigns.length})
        </button>
        <button class="tab-btn ${currentTab === 'sellers' ? 'active' : ''}" data-tab="sellers">
          🏪 Lojas (${sellers.length})
        </button>
      </div>

      <div id="explore-content"></div>
    </div>
  `;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderTabContent(campaigns, sellers);
    });
  });

  renderTabContent(campaigns, sellers);
}

function renderTabContent(campaigns, sellers) {
  const container = document.getElementById('explore-content');
  if (currentTab === 'campaigns') {
    if (!campaigns.length) {
      container.innerHTML = '<div class="empty-state">Nenhuma campanha ativa no momento.</div>';
      return;
    }
    container.innerHTML = `
      <div class="campaigns-grid">
        ${campaigns.map(c => `
          <div class="card campaign-card">
            ${c.images?.[0]
              ? `<div class="img-wrap">${imgTag(c.images[0], { alt: c.title, width: 500, className: 'campaign-cover' })}</div>`
              : `<div class="campaign-cover-placeholder">📷</div>`}
            <div class="card-body">
              <h2>${esc(c.title)}</h2>
              <p class="campaign-description">${esc((c.description || '').slice(0, 100))}</p>
              <div class="campaign-meta">
                <span><strong>${curr(c.price)}</strong></span>
                <span>${fmtDate(c.estimatedDelivery)}</span>
              </div>
              <button class="btn btn-primary btn-block view-campaign-btn" data-id="${c.id}">Ver campanha</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    container.querySelectorAll('.view-campaign-btn').forEach(btn =>
      btn.addEventListener('click', () => router.navigate(`/client/campaigns/${btn.dataset.id}`))
    );
  } else {
    if (!sellers.length) {
      container.innerHTML = '<div class="empty-state">Nenhuma loja ativa no momento.</div>';
      return;
    }
    container.innerHTML = `
      <div class="sellers-grid">
        ${sellers.map(s => `
          <div class="card seller-card">
            <div class="seller-avatar-wrap">
              ${s.photoUrl
                ? `<div class="img-wrap img-wrap-circle">${imgTag(s.photoUrl, { alt: s.displayName, width: 200, className: 'seller-avatar' })}</div>`
                : `<div class="seller-avatar seller-avatar-initials">${initials(s.displayName)}</div>`}
            </div>
            <div class="seller-info">
              <h3>${esc(s.displayName)}</h3>
              <p class="seller-desc">${esc((s.description || 'Sem descrição').slice(0, 90))}</p>
              ${s.instagram ? `<p class="seller-instagram">${esc(s.instagram)}</p>` : ''}
            </div>
            <button class="btn btn-outline btn-sm seller-view-btn" data-id="${s.id}">Ver loja</button>
          </div>
        `).join('')}
      </div>
    `;
    container.querySelectorAll('.seller-view-btn').forEach(btn =>
      btn.addEventListener('click', () => router.navigate(`/client/stores/${btn.dataset.id}`))
    );
  }
}

const curr = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const esc = t => String(t ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const initials = n => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
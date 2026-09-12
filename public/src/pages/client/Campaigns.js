import { getOpenCampaigns } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { Loader } from '../../components/Loader.js';
import { imgTag } from '../../utils/imageUtils.js';

export async function ClientCampaignsPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const campaigns = await getOpenCampaigns();
    renderCampaigns(campaigns);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar campanhas.</div>';
  }
}

function renderCampaigns(campaigns) {
  const content = document.getElementById('app-content');
  if (!campaigns.length) {
    content.innerHTML = `<div class="empty-state"><h2>Nenhuma campanha disponível no momento</h2><p>Volte em breve!</p></div>`;
    return;
  }

  content.innerHTML = `
    <div class="client-campaigns">
      <h1 class="page-title">Campanhas Abertas</h1>
      <div class="campaigns-grid">
        ${campaigns.map(c => `
          <div class="card campaign-card">
            ${c.images?.[0]
              ? `<div class="img-wrap">${imgTag(c.images[0], { alt: c.title, width: 500, className: 'campaign-cover' })}</div>`
              : `<div class="campaign-cover-placeholder">📷</div>`}
            <div class="card-body">
              <h2>${esc(c.title)}</h2>
              <p class="campaign-description">${esc(c.description || '')}</p>
              <div class="campaign-meta">
                <span><strong>Preço:</strong> ${curr(c.price)}</span>
                <span><strong>Previsão de entrega:</strong> ${fmtDate(c.estimatedDelivery)}</span>
              </div>
              <button class="btn btn-primary btn-block order-btn" data-id="${c.id}">Ver Detalhes</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.querySelectorAll('.order-btn').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(`/client/campaigns/${btn.dataset.id}`));
  });
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const curr = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = t => String(t ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
import { getCampaign } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { Loader } from '../../components/Loader.js';

export async function ClientCampaignDetailPage(params) {
  const campaignId = params.id;
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign || campaign.status !== 'open') {
      content.innerHTML = '<div class="error-message">Campanha não disponível.</div>';
      return;
    }
    renderDetail(campaign);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar campanha.</div>';
  }
}

function renderDetail(campaign) {
  const content = document.getElementById('app-content');
  const images = campaign.images || [];

  content.innerHTML = `
    <div class="campaign-detail-page">
      <button class="btn btn-outline" onclick="window.history.back()">← Voltar</button>
      <div class="campaign-detail-content">
        <div class="campaign-gallery">
          ${images.length > 0 ? `
            <div class="main-image-container">
              <img id="main-image" src="${esc(images[0])}" alt="${esc(campaign.title)}" class="main-image" onclick="openFullscreen('${esc(images[0])}')">
            </div>
            ${images.length > 1 ? `
              <div class="thumbnail-strip">
                ${images.map((url, idx) => `
                  <img src="${esc(url)}" class="thumb ${idx === 0 ? 'active' : ''}" data-index="${idx}" onclick="document.getElementById('main-image').src='${esc(url)}'; this.parentElement.querySelectorAll('.thumb').forEach(t=>t.classList.remove('active')); this.classList.add('active');">
                `).join('')}
              </div>
            ` : ''}
            <button class="btn btn-outline fullscreen-btn" onclick="openFullscreen('${esc(images[0])}')">🔍 Ver em tela cheia</button>
          ` : '<div class="no-image">📷 Sem imagem</div>'}
        </div>
        <div class="campaign-info">
          <h1>${esc(campaign.title)}</h1>
          <p class="campaign-description">${esc(campaign.description || '')}</p>
          <div class="campaign-meta">
            <p><strong>Preço:</strong> ${curr(campaign.price)}</p>
            <p><strong>Previsão de entrega:</strong> ${fmtDate(campaign.estimatedDelivery)}</p>
          </div>
          <button class="btn btn-primary btn-block" id="make-order-btn">Fazer Pedido</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('make-order-btn').addEventListener('click', () => {
    router.navigate(`/client/campaigns/${campaign.id}/order`);
  });

  // Função global para abrir imagem em tela cheia
  window.openFullscreen = (url) => {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `<span class="close-modal">&times;</span><img src="${url}" class="modal-image-content">`;
    document.body.appendChild(modal);
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  };
}

const curr = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const esc = t => String(t).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
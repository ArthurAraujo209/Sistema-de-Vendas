import { getCampaign } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { Loader } from '../../components/Loader.js';
import { imgTag, thumbUrl } from '../../utils/imageUtils.js';

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
            <div class="main-image-container img-wrap">
              ${imgTag(images[0], { alt: campaign.title, width: 900, priority: true, className: 'main-image', onClick: `openFullscreen('${esc(images[0])}')` })}
            </div>
            ${images.length > 1 ? `
              <div class="thumbnail-strip">
                ${images.map((url, idx) => `
                  <img src="${thumbUrl(url, 140)}" loading="lazy" decoding="async"
                       class="thumb ${idx === 0 ? 'active' : ''}" data-index="${idx}"
                       data-full="${esc(url)}"
                       alt="Foto ${idx + 1}">
                `).join('')}
              </div>
            ` : ''}
            <button class="btn btn-outline fullscreen-btn" data-full="${esc(images[0])}">🔍 Ver em tela cheia</button>
          ` : '<div class="no-image">📷 Sem imagem</div>'}
        </div>
        <div class="campaign-info">
          <h1>${esc(campaign.title)}</h1>
          <p class="campaign-description">${esc(campaign.description || '')}</p>
          <div class="campaign-meta">
            <p><strong>Preço:</strong> ${curr(campaign.price)}</p>
            ${campaign.maxInstallments > 1 ? `<p><strong>Parcelamento:</strong> até ${campaign.maxInstallments}x</p>` : ''}
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

  // Thumbs
  content.querySelectorAll('.thumbnail-strip .thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const full = thumb.dataset.full;
      const mainImg = content.querySelector('#main-image, .main-image');
      if (mainImg) mainImg.src = thumbUrl(full, 900);
      content.querySelectorAll('.thumbnail-strip .thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });

  // Fullscreen
  const fullBtn = content.querySelector('.fullscreen-btn');
  const mainImg = content.querySelector('.main-image');
  const openFs = (url) => {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `<span class="close-modal">&times;</span><img src="${url}" class="modal-image-content">`;
    document.body.appendChild(modal);
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  };
  if (fullBtn) fullBtn.addEventListener('click', () => openFs(fullBtn.dataset.full));
  if (mainImg && images[0]) mainImg.addEventListener('click', () => openFs(images[0]));
}

const curr = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const esc = t => String(t ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
import { getCampaign } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { Loader } from '../../components/Loader.js';
import { imgTag, thumbUrl } from '../../utils/imageUtils.js';

let countdownTimer = null;

export async function ClientCampaignDetailPage(params) {
  const campaignId = params.id;
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign || !['open', 'scheduled'].includes(campaign.status)) {
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
  const isScheduled = campaign.status === 'scheduled';

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
          ${isScheduled ? `<span class="badge badge-scheduled" style="margin-bottom:0.75rem;">Em breve</span>` : ''}
          <h1>${esc(campaign.title)}</h1>
          <p class="campaign-description">${esc(campaign.description || '')}</p>
          <div class="campaign-meta">
            <p><strong>Preço:</strong> ${curr(campaign.price)}</p>
            ${campaign.maxInstallments > 1 ? `<p><strong>Parcelamento:</strong> até ${campaign.maxInstallments}x</p>` : ''}
            <p><strong>Previsão de entrega:</strong> ${fmtDate(campaign.estimatedDelivery)}</p>
          </div>
          ${isScheduled
            ? `<div class="countdown-big" data-open="${esc(campaign.openDate || '')}">
                 <div class="countdown-label" style="font-size:1rem;">Esta campanha abre em</div>
                 <div class="countdown-timer">
                   <span class="cd-seg" data-seg="d">--</span><span class="cd-unit">d</span>
                   <span class="cd-seg" data-seg="h">--</span><span class="cd-unit">h</span>
                   <span class="cd-seg" data-seg="m">--</span><span class="cd-unit">m</span>
                   <span class="cd-seg" data-seg="s">--</span><span class="cd-unit">s</span>
                 </div>
               </div>`
            : `<button class="btn btn-primary btn-block" id="make-order-btn">Fazer Pedido</button>`}
        </div>
      </div>
    </div>
  `;

  const orderBtn = document.getElementById('make-order-btn');
  if (orderBtn) {
    orderBtn.addEventListener('click', () => {
      router.navigate(`/client/campaigns/${campaign.id}/order`);
    });
  }

  content.querySelectorAll('.thumbnail-strip .thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const full = thumb.dataset.full;
      const mainImg = content.querySelector('#main-image, .main-image');
      if (mainImg) mainImg.src = thumbUrl(full, 900);
      content.querySelectorAll('.thumbnail-strip .thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });

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

  // Countdown (só em agendada)
  if (isScheduled) {
    const el = content.querySelector('.countdown-big');
    if (el) startCountdown(el);
  }
}

function startCountdown(el) {
  const update = () => {
    const target = el.dataset.open ? new Date(el.dataset.open + 'T00:00:00').getTime() : 0;
    const diff = target - Date.now();
    if (!target || diff <= 0) {
      el.innerHTML = '<div style="color:var(--success); font-weight:700; font-size:1.1rem;">Disponível agora! Recarregue a página.</div>';
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      return;
    }
    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const set = (seg, val) => {
      const x = el.querySelector(`[data-seg="${seg}"]`);
      if (x) x.textContent = String(val).padStart(2, '0');
    };
    set('d', d); set('h', h); set('m', m); set('s', sec);
  };
  update();
  countdownTimer = setInterval(update, 1000);
}

const curr = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const esc = t => String(t ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
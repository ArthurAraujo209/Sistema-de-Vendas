import { getCampaign, getCampaignVotes, submitVote, removeVote } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { Loader } from '../../components/Loader.js';
import { showToast } from '../../components/Toast.js';
import { ConfirmDialog } from '../../components/Modal.js';
import { imgTag, thumbUrl } from '../../utils/imageUtils.js';

let countdownTimer = null;

export async function ClientCampaignDetailPage(params) {
  const campaignId = params.id;
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign || !['open', 'scheduled', 'voting'].includes(campaign.status)) {
      content.innerHTML = '<div class="error-message">Campanha não disponível.</div>';
      return;
    }

    let votes = null;
    if (campaign.status === 'voting') {
      votes = await getCampaignVotes(campaignId);
    }
    renderDetail(campaign, votes);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar campanha.</div>';
  }
}

function renderDetail(campaign, votes) {
  const content = document.getElementById('app-content');
  const images = campaign.images || [];
  const isScheduled = campaign.status === 'scheduled';
  const isVoting = campaign.status === 'voting';
  const hasDate = !!(campaign.openDate);

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
          ${isVoting ? `<span class="badge badge-voting" style="margin-bottom:0.75rem;">Em votação</span>` : ''}

          <h1>${esc(campaign.title)}</h1>
          <p class="campaign-description">${esc(campaign.description || '')}</p>

          <div class="campaign-meta">
            <p><strong>Preço:</strong> ${curr(campaign.price)}</p>
            ${campaign.maxInstallments > 1 ? `<p><strong>Parcelamento:</strong> até ${campaign.maxInstallments}x</p>` : ''}
            ${campaign.estimatedDelivery ? `<p><strong>Previsão de entrega:</strong> ${fmtDate(campaign.estimatedDelivery)}</p>` : ''}
          </div>

          ${isVoting ? renderVotingBlock(campaign, votes) : ''}

          ${isScheduled
            ? (hasDate
                ? `<div class="countdown-big" data-open="${esc(campaign.openDate)}">
                     <div class="countdown-label" style="font-size:1rem;">Esta campanha abre em</div>
                     <div class="countdown-timer">
                       <span class="cd-seg" data-seg="d">--</span><span class="cd-unit">d</span>
                       <span class="cd-seg" data-seg="h">--</span><span class="cd-unit">h</span>
                       <span class="cd-seg" data-seg="m">--</span><span class="cd-unit">m</span>
                       <span class="cd-seg" data-seg="s">--</span><span class="cd-unit">s</span>
                     </div>
                   </div>`
                : `<div class="countdown-big"><div class="countdown-label" style="font-size:1rem;">Em breve</div></div>`)
            : ''}

          ${campaign.status === 'open'
            ? `<button class="btn btn-primary btn-block" id="make-order-btn">Fazer Pedido</button>`
            : ''}
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

  // Votação: votar
  if (isVoting) {
    content.querySelectorAll('.vote-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const vote = btn.dataset.vote;
        content.querySelectorAll('.vote-btn').forEach(b => b.disabled = true);
        try {
          await submitVote(campaign.id, vote);
          showToast('Voto registrado!', 'success');
          ClientCampaignDetailPage({ id: campaign.id });
        } catch (err) {
          console.error(err);
          showToast(err.message || 'Erro ao votar.', 'error');
          content.querySelectorAll('.vote-btn').forEach(b => b.disabled = false);
        }
      });
    });

    // Votação: remover voto
    const removeBtn = content.querySelector('#remove-vote-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        ConfirmDialog({
          title: 'Remover voto',
          message: 'Tem certeza que deseja remover seu voto desta campanha? Você poderá votar de novo depois.',
          confirmText: 'Remover',
          cancelText: 'Cancelar',
          onConfirm: async () => {
            try {
              await removeVote(campaign.id);
              showToast('Voto removido.', 'success');
              ClientCampaignDetailPage({ id: campaign.id });
            } catch (err) {
              console.error(err);
              showToast('Erro ao remover voto.', 'error');
            }
          }
        });
      });
    }
  }

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

  // Countdown
  const cdEl = content.querySelector('.countdown-big[data-open]');
  if (cdEl) startCountdown(cdEl);
}

function renderVotingBlock(campaign, votes) {
  const yes = votes?.yes || 0;
  const no = votes?.no || 0;
  const total = votes?.total || 0;
  const myVote = votes?.myVote || null;

  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 0;
  const noPct = total > 0 ? 100 - yesPct : 0;

  return `
    <div class="voting-box">
      <div class="voting-title">Vale a pena produzir esta campanha?</div>
      <div class="voting-sub">Vote e ajude a loja a decidir se essa campanha vai ser produzida.</div>

      ${total > 0 ? `
        <div class="vote-count">
          <span>👍 ${yes} voto${yes !== 1 ? 's' : ''}</span>
          <span>${total} voto${total !== 1 ? 's' : ''} no total</span>
          <span>${no} voto${no !== 1 ? 's' : ''} 👎</span>
        </div>
        <div class="vote-bar">
          <div class="vote-bar-fill vote-bar-yes" style="width:${yesPct}%">
            ${yesPct >= 15 ? `<span>${yesPct}%</span>` : ''}
          </div>
          <div class="vote-bar-fill vote-bar-no" style="width:${noPct}%">
            ${noPct >= 15 ? `<span>${noPct}%</span>` : ''}
          </div>
        </div>
      ` : `<p class="text-muted" style="font-size:0.85rem; margin-bottom:0.75rem;">Nenhum voto ainda. Seja o primeiro!</p>`}

      ${myVote ? `
        <div class="vote-thanks">
          Você votou: <strong>${myVote === 'yes' ? 'Vale a pena 👍' : 'Não vale 👎'}</strong>
        </div>
        <div class="vote-actions" style="margin-top:0.75rem;">
          <button class="btn btn-outline vote-btn ${myVote === 'yes' ? 'voted-yes' : ''}" data-vote="yes" ${myVote === 'yes' ? 'disabled' : ''}>👍 Vale a pena</button>
          <button class="btn btn-outline vote-btn ${myVote === 'no' ? 'voted-no' : ''}" data-vote="no" ${myVote === 'no' ? 'disabled' : ''}>👎 Não vale</button>
        </div>
        <button class="btn btn-outline btn-block" id="remove-vote-btn" style="margin-top:0.5rem; color:var(--danger); border-color:var(--danger);">
          Remover meu voto
        </button>
      ` : `
        <div class="vote-actions">
          <button class="btn btn-accent vote-btn" data-vote="yes">👍 Vale a pena</button>
          <button class="btn btn-outline vote-btn" data-vote="no">👎 Não vale</button>
        </div>
      `}
    </div>
  `;
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
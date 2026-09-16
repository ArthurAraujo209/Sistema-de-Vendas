import { getOpenCampaigns, getActiveSellers } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { Loader } from '../../components/Loader.js';
import { imgTag } from '../../utils/imageUtils.js';

let currentTab = 'campaigns';
let countdownTimer = null;

export async function ClientExplorePage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

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
      container.innerHTML = '<div class="empty-state">Nenhuma campanha disponível no momento.</div>';
      return;
    }
    container.innerHTML = `
      <div class="campaigns-grid">
        ${campaigns.map(c => {
          const isScheduled = c.status === 'scheduled';
          const isVoting = c.status === 'voting';
          const hasDate = !!(c.openDate);
          return `
            <div class="card campaign-card">
              ${c.images?.[0]
                ? `<div class="img-wrap">${imgTag(c.images[0], { alt: c.title, width: 500, className: 'campaign-cover' })}</div>`
                : `<div class="campaign-cover-placeholder">📷</div>`}
              <div class="card-body">
                ${isScheduled ? `<span class="badge badge-scheduled" style="margin-bottom:0.5rem;">Em breve</span>` : ''}
                ${isVoting ? `<span class="badge badge-voting" style="margin-bottom:0.5rem;">Em votação</span>` : ''}
                <h2>${esc(c.title)}</h2>
                <p class="campaign-description">${esc((c.description || '').slice(0, 100))}</p>
                <div class="campaign-meta">
                  <span><strong>${curr(c.price)}</strong></span>
                  ${c.estimatedDelivery ? `<span>${fmtDate(c.estimatedDelivery)}</span>` : ''}
                </div>
                ${isScheduled && hasDate
                  ? `<div class="countdown" data-open="${esc(c.openDate)}">
                       <div class="countdown-label">Abre em</div>
                       <div class="countdown-timer">
                         <span class="cd-seg" data-seg="d">--</span><span class="cd-unit">d</span>
                         <span class="cd-seg" data-seg="h">--</span><span class="cd-unit">h</span>
                         <span class="cd-seg" data-seg="m">--</span><span class="cd-unit">m</span>
                         <span class="cd-seg" data-seg="s">--</span><span class="cd-unit">s</span>
                       </div>
                     </div>
                     <button class="btn btn-outline btn-block view-campaign-btn" data-id="${c.id}">Ver detalhes</button>`
                  : isScheduled
                    ? `<button class="btn btn-outline btn-block view-campaign-btn" data-id="${c.id}">Ver detalhes</button>`
                    : isVoting
                      ? `<button class="btn btn-accent btn-block view-campaign-btn" data-id="${c.id}">Votar</button>`
                      : `<button class="btn btn-primary btn-block view-campaign-btn" data-id="${c.id}">Ver campanha</button>`}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    container.querySelectorAll('.view-campaign-btn').forEach(btn =>
      btn.addEventListener('click', () => router.navigate(`/client/campaigns/${btn.dataset.id}`))
    );
    startCountdowns(container);
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

function startCountdowns(container) {
  const items = container.querySelectorAll('.countdown');
  if (!items.length) return;

  const update = () => {
    const now = Date.now();
    items.forEach(el => {
      const openDate = el.dataset.open;
      const target = openDate ? new Date(openDate + 'T00:00:00').getTime() : 0;
      const diff = target - now;

      const set = (seg, val) => {
        const s = el.querySelector(`[data-seg="${seg}"]`);
        if (s) s.textContent = String(val).padStart(2, '0');
      };

      if (!target || diff <= 0) {
        el.innerHTML = '<div class="countdown-label" style="color:var(--warning); font-weight:700;">Em Breve</div>';
      } else {
        const s = Math.floor(diff / 1000);
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        set('d', d); set('h', h); set('m', m); set('s', sec);
      }
    });
  };

  update();
  countdownTimer = setInterval(update, 1000);
}

const curr = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const esc = t => String(t ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const initials = n => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
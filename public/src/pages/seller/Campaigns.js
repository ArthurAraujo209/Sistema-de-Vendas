import { getCampaigns, duplicateCampaign, archiveCampaign, deleteCampaign } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { showToast } from '../../components/Toast.js';
import { ConfirmDialog } from '../../components/Modal.js';
import { Loader } from '../../components/Loader.js';

export async function CampaignsPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="campaigns-page">
      <div class="page-header">
        <h1 class="page-title">Campanhas</h1>
        <button class="btn btn-primary" id="new-campaign-btn">+ Nova Campanha</button>
      </div>
      <div class="filters-bar">
        <input type="text" class="form-input search-input" id="search-campaigns" placeholder="Buscar campanhas...">
        <select class="form-select" id="filter-status">
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="open">Aberta</option>
          <option value="closed">Encerrada</option>
          <option value="archived">Arquivada</option>
        </select>
      </div>
      <div id="campaigns-list" class="table-container">
        ${Loader()}
      </div>
    </div>
  `;

  document.getElementById('new-campaign-btn').addEventListener('click', () => {
    router.navigate('/seller/campaigns/new');
  });

  let allCampaigns = [];

  async function loadCampaigns() {
    const listEl = document.getElementById('campaigns-list');
    try {
      allCampaigns = await getCampaigns();
      filterAndRender();
    } catch (err) {
      console.error(err);
      listEl.innerHTML = '<p class="error-message">Erro ao carregar campanhas.</p>';
    }
  }

  function filterAndRender() {
    const search = document.getElementById('search-campaigns').value.toLowerCase();
    const status = document.getElementById('filter-status').value;

    let filtered = allCampaigns;
    if (search) {
      filtered = filtered.filter(c => c.title?.toLowerCase().includes(search));
    }
    if (status) {
      filtered = filtered.filter(c => c.status === status);
    }

    renderCampaignsTable(filtered);
  }

  function renderCampaignsTable(campaigns) {
    const listEl = document.getElementById('campaigns-list');

    if (!campaigns.length) {
      listEl.innerHTML = '<div class="empty-state">Nenhuma campanha encontrada.</div>';
      return;
    }

    listEl.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th style="width:70px;">Imagem</th>
            <th>Título</th>
            <th>Status</th>
            <th>Abertura</th>
            <th>Fechamento</th>
            <th>Previsão Entrega</th>
            <th>Preço</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${campaigns.map(c => `
            <tr>
              <td>
                ${c.images && c.images.length 
                  ? `<img src="${escapeHtml(c.images[0])}" class="campaign-thumb" onerror="this.style.display='none'" alt="Capa">` 
                  : `<div class="campaign-thumb-placeholder">📷</div>`}
              </td>
              <td><strong>${escapeHtml(c.title)}</strong></td>
              <td><span class="badge badge-${c.status}">${statusLabel(c.status)}</span></td>
              <td>${formatDate(c.openDate)}</td>
              <td>${formatDate(c.closeDate)}</td>
              <td>${formatDate(c.estimatedDelivery)}</td>
              <td>${formatCurrency(c.price)}</td>
              <td class="actions-cell">
                <button class="btn btn-sm btn-outline edit-campaign" data-id="${c.id}">Editar</button>
                <button class="btn btn-sm btn-outline duplicate-campaign" data-id="${c.id}">Duplicar</button>
                ${c.status !== 'archived' ? `<button class="btn btn-sm btn-outline archive-campaign" data-id="${c.id}">Arquivar</button>` : ''}
                <button class="btn btn-sm btn-danger delete-campaign" data-id="${c.id}">Excluir</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    attachTableEvents();
  }

  function attachTableEvents() {
    document.querySelectorAll('.edit-campaign').forEach(btn => {
      btn.addEventListener('click', () => router.navigate(`/seller/campaigns/${btn.dataset.id}`));
    });
    document.querySelectorAll('.duplicate-campaign').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await duplicateCampaign(btn.dataset.id);
          showToast('Campanha duplicada!', 'success');
          await loadCampaigns();
        } catch (err) {
          showToast('Erro ao duplicar.', 'error');
        }
      });
    });
    document.querySelectorAll('.archive-campaign').forEach(btn => {
      btn.addEventListener('click', async () => {
        ConfirmDialog({
          title: 'Arquivar Campanha',
          message: 'A campanha será movida para arquivada. Continuar?',
          onConfirm: async () => {
            await archiveCampaign(btn.dataset.id);
            showToast('Arquivada.', 'success');
            await loadCampaigns();
          }
        });
      });
    });
    document.querySelectorAll('.delete-campaign').forEach(btn => {
      btn.addEventListener('click', async () => {
        ConfirmDialog({
          title: 'Excluir Campanha',
          message: 'Esta ação é irreversível. Todos os pedidos vinculados permanecerão. Deseja excluir?',
          confirmText: 'Excluir',
          onConfirm: async () => {
            await deleteCampaign(btn.dataset.id);
            showToast('Excluída.', 'success');
            await loadCampaigns();
          }
        });
      });
    });
  }

  document.getElementById('search-campaigns').addEventListener('input', filterAndRender);
  document.getElementById('filter-status').addEventListener('change', filterAndRender);

  await loadCampaigns();
}

function statusLabel(status) {
  const map = { draft: 'Rascunho', open: 'Aberta', closed: 'Encerrada', archived: 'Arquivada' };
  return map[status] || status;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
  if (value === undefined || value === null) return '-';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
  });
}
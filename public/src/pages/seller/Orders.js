import { getOrders, getCampaigns, updateOrder } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';
import { ConfirmDialog } from '../../components/Modal.js';

export async function OrdersPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="orders-page">
      <div class="page-header">
        <h1 class="page-title">Pedidos</h1>
        <button class="btn btn-primary" id="new-order-btn">+ Novo Pedido</button>
      </div>
      <div class="filters-bar">
        <input type="text" class="form-input search-input" id="search-orders" placeholder="Buscar por cliente ou campanha...">
        <select class="form-select" id="filter-status">
          <option value="">Todos os status</option>
          <option value="awaiting_payment">Aguardando pagamento</option>
          <option value="partial_payment">Pagamento parcial</option>
          <option value="paid">Pago</option>
          <option value="sent_to_factory">Enviado p/ fábrica</option>
          <option value="in_production">Em produção</option>
          <option value="production_completed">Produção concluída</option>
          <option value="in_transit">Em transporte</option>
          <option value="available_for_pickup">Disponível p/ retirada</option>
          <option value="delivered">Entregue</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <select class="form-select" id="filter-campaign">
          <option value="">Todas as campanhas</option>
        </select>
        <div class="batch-actions" style="display:none;" id="batch-actions">
          <select id="batch-status" class="form-select">
            <option value="">Alterar status para...</option>
            <option value="sent_to_factory">Enviar p/ fábrica</option>
            <option value="in_production">Em produção</option>
            <option value="delivered">Entregue</option>
            <option value="cancelled">Cancelar</option>
          </select>
          <button id="apply-batch" class="btn btn-primary">Aplicar em lote</button>
          <span id="selected-count"></span>
        </div>
      </div>
      <div id="orders-list" class="table-container">
        ${Loader()}
      </div>
    </div>
  `;

  document.getElementById('new-order-btn').addEventListener('click', () => router.navigate('/seller/orders/new'));

  let allOrders = [];
  let campaigns = [];

  async function loadData() {
    try {
      campaigns = await getCampaigns();
      const campaignSelect = document.getElementById('filter-campaign');
      campaigns.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.title;
        campaignSelect.appendChild(opt);
      });
      await loadOrders();
    } catch (err) {
      console.error(err);
      document.getElementById('orders-list').innerHTML = '<p class="error-message">Erro ao carregar.</p>';
    }
  }

  async function loadOrders() {
    const status = document.getElementById('filter-status').value;
    const campaignId = document.getElementById('filter-campaign').value;
    const filters = {};
    if (status) filters.status = status;
    if (campaignId) filters.campaignId = campaignId;
    allOrders = await getOrders(filters);
    filterAndRender();
  }

  function filterAndRender() {
    const search = document.getElementById('search-orders').value.toLowerCase();
    let filtered = allOrders;
    if (search) {
      filtered = filtered.filter(o => 
        (o.clientName || '').toLowerCase().includes(search) ||
        (o.campaignTitle || '').toLowerCase().includes(search)
      );
    }
    renderTable(filtered);
  }

  function renderTable(orders) {
    const listEl = document.getElementById('orders-list');
    if (!orders.length) {
      listEl.innerHTML = '<div class="empty-state">Nenhum pedido encontrado.</div>';
      document.getElementById('batch-actions').style.display = 'none';
      return;
    }
    listEl.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th><input type="checkbox" id="select-all"></th>
            <th>Cliente</th>
            <th>Campanha</th>
            <th>Qtd</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Data</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td><input type="checkbox" class="order-check" data-id="${o.id}" data-status="${o.status}"></td>
              <td>${esc(o.clientName)}</td>
              <td>${esc(o.campaignTitle)}</td>
              <td>${o.quantity || 1}</td>
              <td>${curr(o.totalAmount)}</td>
              <td><span class="badge badge-${o.status}">${statusLabel(o.status)}</span></td>
              <td>${fmtDate(o.createdAt)}</td>
              <td class="actions-cell">
                <button class="btn btn-sm btn-outline view-order" data-id="${o.id}">Ver</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Eventos de seleção
    const selectAllCheck = document.getElementById('select-all');
    const checkboxes = listEl.querySelectorAll('.order-check');
    const batchDiv = document.getElementById('batch-actions');
    const selectedCount = document.getElementById('selected-count');

    function updateBatchVisibility() {
      const checked = listEl.querySelectorAll('.order-check:checked');
      batchDiv.style.display = checked.length > 0 ? 'flex' : 'none';
      selectedCount.textContent = `${checked.length} selecionado(s)`;
    }

    selectAllCheck.addEventListener('change', (e) => {
      checkboxes.forEach(cb => cb.checked = e.target.checked);
      updateBatchVisibility();
    });
    checkboxes.forEach(cb => cb.addEventListener('change', updateBatchVisibility));

    // Aplicar lote
    document.getElementById('apply-batch').addEventListener('click', async () => {
      const newStatus = document.getElementById('batch-status').value;
      if (!newStatus) return showToast('Selecione um status.', 'warning');
      const checked = listEl.querySelectorAll('.order-check:checked');
      const ids = Array.from(checked).map(cb => cb.dataset.id);
      if (!ids.length) return;

      ConfirmDialog({
        title: 'Alterar em Lote',
        message: `Alterar ${ids.length} pedido(s) para "${statusLabel(newStatus)}"?`,
        onConfirm: async () => {
          let success = 0;
          for (const id of ids) {
            try {
              await updateOrder(id, { status: newStatus }, `Status alterado em lote para ${statusLabel(newStatus)}`);
              success++;
            } catch (err) {
              console.error(`Erro no pedido ${id}:`, err);
            }
          }
          showToast(`${success} pedido(s) atualizados.`, 'success');
          await loadOrders();
        }
      });
    });

    // Links
    listEl.querySelectorAll('.view-order').forEach(btn => btn.addEventListener('click', () => router.navigate(`/seller/orders/${btn.dataset.id}`)));
    listEl.querySelectorAll('.edit-order').forEach(btn => btn.addEventListener('click', () => router.navigate(`/seller/orders/${btn.dataset.id}/edit`)));

    updateBatchVisibility();
  }

  document.getElementById('search-orders').addEventListener('input', filterAndRender);
  document.getElementById('filter-status').addEventListener('change', loadOrders);
  document.getElementById('filter-campaign').addEventListener('change', loadOrders);

  await loadData();
}

const statusLabel = s => ({
  awaiting_payment:'Aguardando pagamento', partial_payment:'Pagamento parcial', paid:'Pago',
  sent_to_factory:'Enviado p/ fábrica', in_production:'Em produção',
  production_completed:'Produção concluída', in_transit:'Em transporte',
  available_for_pickup:'Disponível p/ retirada', delivered:'Entregue', cancelled:'Cancelado'
}[s] || s);
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const curr = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc = t => String(t).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
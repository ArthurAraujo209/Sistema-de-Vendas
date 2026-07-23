import {
  getOrder, createOrder, updateOrder, deleteOrder,
  getCampaigns, getCampaign,
  getUserByEmail, createClientUser,
  addPayment, getPayments
} from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';
import { ConfirmDialog, Modal, closeModal } from '../../components/Modal.js';

let orderId = null;

export async function OrderDetailPage(params) {
  orderId = params.id;
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  if (orderId === 'new') {
    await renderNewOrderForm();
  } else {
    await renderOrderDetail(orderId);
  }
}

async function renderNewOrderForm() {
  const content = document.getElementById('app-content');
  const campaigns = await getCampaigns({ status: 'open' });
  if (!campaigns.length) {
    content.innerHTML = '<div class="page-placeholder"><h2>Nenhuma campanha aberta</h2><p>Abra uma campanha antes de criar pedidos.</p></div>';
    return;
  }

  content.innerHTML = `
    <div class="order-form-page">
      <h1>Novo Pedido</h1>
      <form id="new-order-form" class="card">
        <div class="form-row">
          <div class="form-group flex-1">
            <label for="order-campaign">Campanha *</label>
            <select id="order-campaign" class="form-select" required>
              <option value="">Selecione...</option>
              ${campaigns.map(c => `<option value="${c.id}" data-price="${c.price}">${esc(c.title)} - ${curr(c.price)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="order-qty">Quantidade</label>
            <input type="number" id="order-qty" class="form-input" value="1" min="1" required>
          </div>
        </div>
        <div class="form-group">
          <label>Cliente (e-mail) *</label>
          <div class="input-with-button">
            <input type="email" id="order-client-email" class="form-input" placeholder="cliente@email.com" required>
            <button type="button" id="search-client-btn" class="btn btn-outline">Buscar</button>
          </div>
          <div id="client-info" class="client-info"></div>
        </div>
        <div id="custom-fields-container"></div>
        <div class="form-row">
          <div class="form-group">
            <label>Valor Total</label>
            <input type="text" id="order-total" class="form-input" readonly>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Salvar Pedido</button>
        </div>
      </form>
    </div>
  `;

  const campaignSelect = document.getElementById('order-campaign');
  const qtyInput = document.getElementById('order-qty');
  const totalInput = document.getElementById('order-total');
  const searchBtn = document.getElementById('search-client-btn');
  const emailInput = document.getElementById('order-client-email');
  const clientInfoDiv = document.getElementById('client-info');
  let selectedClientId = null, selectedClientName = '';

  function updateTotal() {
    const price = parseFloat(campaignSelect.selectedOptions[0]?.dataset.price) || 0;
    const qty = parseInt(qtyInput.value) || 1;
    totalInput.value = curr(price * qty);
  }
  campaignSelect.addEventListener('change', () => { updateTotal(); loadCustomFields(campaignSelect.value); });
  qtyInput.addEventListener('input', updateTotal);
  updateTotal();

  searchBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    if (!email) return showToast('Digite um e-mail.', 'warning');
    const user = await getUserByEmail(email);
    if (user) {
      if (user.role !== 'client') return showToast('Usuário não é cliente.', 'error');
      selectedClientId = user.id;
      selectedClientName = user.displayName || email;
      clientInfoDiv.innerHTML = `<span class="client-found">✅ ${selectedClientName} (existente)</span>`;
    } else {
      ConfirmDialog({
        title: 'Cliente não encontrado',
        message: `Criar novo cliente com email "${email}"?`,
        confirmText: 'Criar',
        onConfirm: async () => {
          const name = prompt('Nome do cliente:');
          if (!name) return;
          try {
            const newClient = await createClientUser(email, name);
            selectedClientId = newClient.id;
            selectedClientName = name;
            clientInfoDiv.innerHTML = `<span class="client-found">✅ ${name} (criado agora)</span>`;
            showToast('Cliente criado.', 'success');
          } catch (err) {
            console.error(err);
            showToast('Erro ao criar cliente.', 'error');
          }
        }
      });
    }
  });

  async function loadCustomFields(campaignId) {
    const container = document.getElementById('custom-fields-container');
    if (!campaignId) { container.innerHTML = ''; return; }
    const campaign = await getCampaign(campaignId);
    if (!campaign.customFields?.length) {
      container.innerHTML = '<p class="text-muted">Sem campos personalizados.</p>';
      return;
    }
    container.innerHTML = campaign.customFields.map((f, i) => {
      const name = `cf-${i}`;
      let inp = '';
      if (f.type === 'text') inp = `<input type="text" name="${name}" class="form-input" ${f.required?'required':''}>`;
      else if (f.type === 'number') inp = `<input type="number" name="${name}" class="form-input" ${f.required?'required':''}>`;
      else if (f.type === 'select' || f.type === 'radio') inp = `<select name="${name}" class="form-select" ${f.required?'required':''}><option value=""></option>${(f.options||[]).map(o=>`<option>${o}</option>`).join('')}</select>`;
      else if (f.type === 'checkbox') inp = `<label><input type="checkbox" name="${name}" ${f.required?'required':''}> Sim</label>`;
      return `<div class="form-group"><label>${esc(f.label)} ${f.required?'*':''}</label>${inp}</div>`;
    }).join('');
  }

  document.getElementById('new-order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedClientId) return showToast('Busque um cliente.', 'warning');
    const campaignId = campaignSelect.value;
    const campaign = await getCampaign(campaignId);
    const qty = parseInt(qtyInput.value) || 1;
    const total = (parseFloat(campaign.price) * qty) || 0;
    const customFields = campaign.customFields || [];
    const fields = customFields.map((f, i) => {
      const input = document.querySelector(`[name="cf-${i}"]`);
      let value = null;
      if (input) {
        if (f.type === 'checkbox') value = input.checked;
        else value = input.value;
      }
      return { label: f.label, value };
    });
    try {
      const newId = await createOrder({
        campaignId, campaignTitle: campaign.title,
        clientId: selectedClientId, clientName: selectedClientName,
        quantity: qty, totalAmount: total,
        items: [{ quantity: qty, fields }],
        remainingAmount: total, paidAmount: 0
      });
      showToast('Pedido criado!', 'success');
      router.navigate(`/seller/orders/${newId}`);
    } catch (err) {
      console.error(err);
      showToast('Erro ao criar pedido.', 'error');
    }
  });
}

// *** Nova função que carrega e exibe os detalhes do pedido ***
async function renderOrderDetail(orderId) {
  const content = document.getElementById('app-content');
  try {
    const order = await getOrder(orderId);
    if (!order) {
      content.innerHTML = '<div class="error-message">Pedido não encontrado.</div>';
      return;
    }
    const campaign = await getCampaign(order.campaignId);
    const payments = await getPayments(orderId);

    renderEditOrderForm(order, campaign, payments);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar pedido.</div>';
  }
}

// *** renderEditOrderForm agora aceita payments como parâmetro ***
function renderEditOrderForm(order, campaign, payments) {
  const content = document.getElementById('app-content');
  const statusOptions = [
    'awaiting_payment','partial_payment','paid','sent_to_factory',
    'in_production','production_completed','in_transit',
    'available_for_pickup','delivered','cancelled'
  ];

  const paid = order.paidAmount || 0;
  const total = order.totalAmount || 0;
  const remaining = Math.max(0, total - paid);

  content.innerHTML = `
    <div class="order-detail-page">
      <div class="page-header">
        <h1>Pedido #${order.id.substring(0,6)}</h1>
        <div>
          <button id="delete-order-btn" class="btn btn-danger">Excluir Pedido</button>
        </div>
      </div>
      <div class="card">
        <h3>Detalhes</h3>
        <p><strong>Cliente:</strong> ${esc(order.clientName)}</p>
        <p><strong>Campanha:</strong> ${esc(order.campaignTitle)}</p>
        <p><strong>Quantidade:</strong> ${order.quantity}</p>
        <p><strong>Valor Total:</strong> ${curr(total)}</p>
        <p><strong>Pago:</strong> ${curr(paid)} / <strong>Restante:</strong> ${curr(remaining)}</p>
        <p><strong>Status:</strong> ${statusLabel(order.status)}</p>
        <div class="form-group">
          <label>Alterar Status:</label>
          <select id="status-select" class="form-select">
            ${statusOptions.map(s => `<option value="${s}" ${order.status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}
          </select>
          <button id="update-status-btn" class="btn btn-primary mt-1">Atualizar Status</button>
        </div>
        <h4>Campos Personalizados</h4>
        ${order.items?.[0]?.fields?.length ? order.items[0].fields.map(f => `<p><strong>${esc(f.label)}:</strong> ${f.value}</p>`).join('') : '<p>Nenhum</p>'}
      </div>

      <!-- Seção de Pagamentos -->
      <div class="card">
        <h3>Pagamentos</h3>
        <div id="payments-list">
          ${payments.length ? `
            <table class="table">
              <thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Observações</th></tr></thead>
              <tbody>
                ${payments.map(p => `
                  <tr>
                    <td>${fmtDate(p.createdAt || p.date)}</td>
                    <td>${curr(p.amount)}</td>
                    <td>${paymentMethodLabel(p.method)}</td>
                    <td>${p.notes && p.notes.includes('Comprovante:') 
                    ? `<img src="${esc(p.notes.split('Comprovante: ')[1])}" class="payment-thumb" onclick="window.open('${esc(p.notes.split('Comprovante: ')[1])}')">` 
                    : (esc(p.notes || '-'))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p class="text-muted">Nenhum pagamento registrado.</p>'}
        </div>
        <button id="add-payment-btn" class="btn btn-primary">+ Adicionar Pagamento</button>
      </div>

      <!-- Histórico do Pedido -->
      <div class="card">
        <h4>Histórico</h4>
        <ul class="history-list">
          ${(order.history||[]).map(h => `<li>${fmtDate(h.timestamp)} - ${esc(h.userName)}: ${esc(h.action)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  // Evento de alterar status
  document.getElementById('update-status-btn').addEventListener('click', async () => {
    const newStatus = document.getElementById('status-select').value;
    await updateOrder(order.id, { status: newStatus }, `Status alterado para ${statusLabel(newStatus)}`);
    showToast('Status atualizado.', 'success');
    await renderOrderDetail(order.id); // recarrega sem sair da página
  });

  // Evento de excluir pedido
  document.getElementById('delete-order-btn').addEventListener('click', () => {
    ConfirmDialog({
      title: 'Excluir Pedido',
      message: 'Tem certeza? Esta ação não pode ser desfeita. Todos os pagamentos vinculados também serão excluídos.',
      confirmText: 'Excluir',
      onConfirm: async () => {
        try {
          await deleteOrder(order.id);
          showToast('Pedido excluído.', 'success');
          router.navigate('/seller/orders');
        } catch (err) {
          showToast('Erro ao excluir pedido.', 'error');
        }
      }
    });
  });

  // Evento de adicionar pagamento
  document.getElementById('add-payment-btn').addEventListener('click', () => {
    openPaymentModal(order.id, paid, total);
  });
}

function openPaymentModal(orderId, currentPaid, totalAmount) {
  const remaining = Math.max(0, totalAmount - currentPaid);
  const modalContent = `
    <form id="payment-form">
      <div class="form-group">
        <label for="payment-amount">Valor *</label>
        <input type="number" id="payment-amount" class="form-input" step="0.01" min="0.01" max="${remaining.toFixed(2)}" required>
        <small>Máximo restante: ${curr(remaining)}</small>
      </div>
      <div class="form-group">
        <label for="payment-date">Data</label>
        <input type="date" id="payment-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label for="payment-method">Forma de Pagamento</label>
        <select id="payment-method" class="form-select">
          <option value="pix">PIX</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="cartao">Cartão</option>
          <option value="boleto">Boleto</option>
          <option value="transferencia">Transferência</option>
        </select>
      </div>
      <div class="form-group">
        <label for="payment-notes">Observações</label>
        <input type="text" id="payment-notes" class="form-input">
      </div>
      <div class="modal-footer" style="padding: 1rem 0 0; border-top: none;">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar Pagamento</button>
      </div>
    </form>
  `;

  const modal = Modal({
    id: 'payment-modal-' + Date.now(),
    title: 'Novo Pagamento',
    content: modalContent,
    size: 'medium',
    onClose: () => {}
  });

  document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('payment-amount').value);
    if (isNaN(amount) || amount <= 0 || amount > remaining) {
      showToast('Valor inválido.', 'error');
      return;
    }
    const paymentData = {
      amount,
      date: document.getElementById('payment-date').value,
      method: document.getElementById('payment-method').value,
      notes: document.getElementById('payment-notes').value
    };

    try {
      await addPayment(orderId, paymentData);
      showToast('Pagamento registrado!', 'success');
      closeModal(modal.id);
      // Recarregar os detalhes do pedido (incluindo pagamentos) sem sair da página
      await renderOrderDetail(orderId);
    } catch (err) {
      console.error(err);
      showToast('Erro ao registrar pagamento.', 'error');
    }
  });
}

// Helpers
const statusLabel = s => ({
  awaiting_payment:'Aguardando pagamento', partial_payment:'Pagamento parcial', paid:'Pago',
  sent_to_factory:'Enviado p/ fábrica', in_production:'Em produção',
  production_completed:'Produção concluída', in_transit:'Em transporte',
  available_for_pickup:'Disponível p/ retirada', delivered:'Entregue', cancelled:'Cancelado'
}[s] || s);
const fmtDate = d => d ? new Date(d).toLocaleString('pt-BR') : '-';
const curr = v => v ? Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '-';
const esc = t => String(t).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
function paymentMethodLabel(m) {
  const map = { pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão', boleto: 'Boleto', transferencia: 'Transferência' };
  return map[m] || m;
}
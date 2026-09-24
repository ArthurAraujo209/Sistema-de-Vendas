import { getClientOrder, getPayments, addPayment, cancelClientOrder } from '../../firebase/firestore.js';
import { uploadImage } from '../../firebase/upload.js';
import { router } from '../../router.js';
import { Loader } from '../../components/Loader.js';
import { showToast } from '../../components/Toast.js';
import { Modal, closeModal, ConfirmDialog } from '../../components/Modal.js';
import { whatsappLink } from '../../utils/imageUtils.js';

export async function ClientOrderDetailPage(params) {
  const orderId = params.id;
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const order = await getClientOrder(orderId);
    if (!order) {
      content.innerHTML = '<div class="error-message">Pedido não encontrado ou acesso negado.</div>';
      return;
    }
    const payments = await getPayments(orderId);
    renderOrderDetail(order, payments);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar pedido.</div>';
  }
}

function renderOrderDetail(order, payments) {
  const content = document.getElementById('app-content');
  const paid = order.paidAmount || 0;
  const total = order.totalAmount || 0;
  const remaining = Math.max(0, total - paid);
  const canCancel = ['awaiting_payment', 'payment_under_review', 'partial_payment', 'paid'].includes(order.status);

  // Botão de enviar comprovante no WhatsApp
  const hasVerifiedPayment = payments.some(p => p.verified !== false);
  const hasAnyPayment = payments.length > 0;
  const showWhatsButton = !hasVerifiedPayment && order.status !== 'cancelled' && order.sellerPhone;

  const waMessage = buildReceiptMessage(order, paid, remaining);
  const waHref = showWhatsButton ? whatsappLink(order.sellerPhone, waMessage) : '';

  content.innerHTML = `
    <div class="order-detail-page">
      <h1>Pedido #${order.id.substring(0,6)}</h1>

      ${!hasVerifiedPayment && order.status !== 'cancelled' ? `
        <div class="card receipt-callout" style="border-color: var(--primary); background: var(--primary-soft);">
          <h3 style="margin-bottom:0.35rem;">Envie o comprovante de pagamento</h3>
          <p style="font-size:0.9rem; margin-bottom:1rem;">
            ${hasAnyPayment
              ? 'Seu comprovante ainda está em análise. Se preferir, envie por aqui também.'
              : 'Você ainda não anexou o comprovante. Envie para o vendedor pelo WhatsApp.'}
          </p>
          ${showWhatsButton
            ? `<a href="${waHref}" target="_blank" rel="noopener" class="btn btn-success btn-block" id="send-receipt-btn">
                 📱 Enviar comprovante no WhatsApp
               </a>`
            : `<p class="text-muted" style="font-size:0.85rem;">Vendedor sem telefone cadastrado. Entre em contato por outro canal.</p>`}
        </div>
      ` : ''}

      <div class="card">
        <h3>Detalhes</h3>
        <p><strong>Campanha:</strong> ${esc(order.campaignTitle)}</p>
        <p><strong>Quantidade:</strong> ${order.quantity}</p>
        <p><strong>Valor Total:</strong> ${curr(total)}</p>
        <p><strong>Pago:</strong> ${curr(paid)} / <strong>Restante:</strong> ${curr(remaining)}</p>
        <p><strong>Status:</strong> <span class="badge badge-${order.status}">${statusLabel(order.status)}</span></p>
        <h4>Personalizações</h4>
        ${order.items?.[0]?.fields?.length ? order.items[0].fields.map(f => `<p><strong>${esc(f.label)}:</strong> ${esc(f.value ?? '-')}</p>`).join('') : '<p>Nenhuma</p>'}
        ${canCancel ? `<button id="cancel-order-btn" class="btn btn-danger" style="margin-top:1rem;">Cancelar Pedido</button>` : ''}
      </div>

      <div class="card">
        <h3>Pagamentos</h3>
        ${payments.length ? `
          <table class="table">
            <thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Comprovante</th><th>Status</th></tr></thead>
            <tbody>
              ${payments.map(p => `
                <tr>
                  <td>${fmtDate(p.createdAt || p.date)}</td>
                  <td>${curr(p.amount)}</td>
                  <td>${paymentMethodLabel(p.method)}</td>
                  <td>${p.notes && p.notes.includes('Comprovante:')
                    ? `<img src="${esc(p.notes.split('Comprovante: ')[1])}" class="payment-thumb" onclick="window.open('${esc(p.notes.split('Comprovante: ')[1])}')">`
                    : (esc(p.notes || '-'))}</td>
                  <td>${p.verified === false
                    ? '<span class="badge badge-payment_under_review">Em análise</span>'
                    : '<span class="badge badge-paid">Confirmado</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p class="text-muted">Nenhum pagamento registrado.</p>'}
        ${remaining > 0 ? `<button id="add-payment-btn" class="btn btn-primary" style="margin-top:1rem;">+ Adicionar Pagamento</button>` : ''}
      </div>

      <div class="card">
        <h4>Histórico</h4>
        <ul class="history-list">
          ${(order.history||[]).map(h => `<li>${fmtDate(h.timestamp)} - ${esc(h.userName)}: ${esc(h.action)}</li>`).join('')}
        </ul>
      </div>
      <button class="btn btn-outline" onclick="window.history.back()">Voltar</button>
    </div>
  `;

  if (canCancel) {
    document.getElementById('cancel-order-btn').addEventListener('click', () => {
      ConfirmDialog({
        title: 'Cancelar Pedido',
        message: 'Tem certeza que deseja cancelar este pedido?',
        confirmText: 'Cancelar Pedido',
        onConfirm: async () => {
          try {
            await cancelClientOrder(order.id);
            showToast('Pedido cancelado.', 'success');
            router.navigate('/client/dashboard');
          } catch (err) {
            showToast('Erro ao cancelar: ' + err.message, 'error');
          }
        }
      });
    });
  }

  if (remaining > 0) {
    document.getElementById('add-payment-btn').addEventListener('click', () => {
      openClientPaymentModal(order.id, remaining);
    });
  }
}

function buildReceiptMessage(order, paid, remaining) {
  const shortId = order.id.substring(0, 6);
  const firstLine = `Oi! Estou enviando o comprovante do meu pedido *#${shortId}* (${order.campaignTitle}).`;
  const money = `Valor total: ${curr(order.totalAmount)}
Pago: ${curr(paid)}
Falta: ${curr(remaining)}`;
  return `${firstLine}\n\n${money}\n\n📎 Segue em anexo.`;
}

function openClientPaymentModal(orderId, remaining) {
  const modalContent = `
    <form id="client-payment-form">
      <div class="form-group">
        <label>Valor (máx. ${curr(remaining)})</label>
        <input type="number" id="pay-amount" class="form-input" step="0.01" min="0.01" max="${remaining.toFixed(2)}" required>
      </div>
      <div class="form-group">
        <label>Forma de Pagamento</label>
        <select id="pay-method" class="form-select">
          <option value="pix">PIX</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="cartao">Cartão</option>
          <option value="boleto">Boleto</option>
          <option value="transferencia">Transferência</option>
        </select>
      </div>
      <div class="form-group">
        <label>Comprovante (imagem)</label>
        <input type="file" id="pay-receipt" accept="image/*">
        <img id="modal-receipt-preview" class="receipt-preview" style="display:none;">
      </div>
      <div class="modal-footer" style="padding: 1rem 0 0; border-top: none;">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar</button>
      </div>
    </form>
  `;

  const modal = Modal({
    id: 'client-payment-modal-' + Date.now(),
    title: 'Adicionar Pagamento',
    content: modalContent,
    size: 'medium'
  });

  const receiptInput = modal.content.querySelector('#pay-receipt');
  const preview = modal.content.querySelector('#modal-receipt-preview');
  receiptInput.addEventListener('change', () => {
    const file = receiptInput.files[0];
    if (file) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  });

  modal.content.querySelector('#client-payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(modal.content.querySelector('#pay-amount').value);
    if (isNaN(amount) || amount <= 0 || amount > remaining) {
      showToast('Valor inválido.', 'error');
      return;
    }
    const method = modal.content.querySelector('#pay-method').value;
    const file = receiptInput.files[0];
    let receiptUrl = '';
    if (file) {
      try {
        receiptUrl = await uploadImage(file);
      } catch (err) {
        showToast('Erro no upload do comprovante.', 'error');
        return;
      }
    }
    const notes = receiptUrl ? `Comprovante: ${receiptUrl}` : '';

    try {
      await addPayment(orderId, {
        amount,
        date: new Date().toISOString().split('T')[0],
        method,
        notes,
        status: 'pending',
        verified: receiptUrl ? false : true
      });
      showToast('Pagamento registrado!', 'success');
      closeModal(modal.id);
      router.navigate(`/client/orders/${orderId}`);
    } catch (err) {
      showToast('Erro ao registrar pagamento.', 'error');
    }
  });
}

const statusLabel = s => ({
  awaiting_payment:'Aguardando pagamento', payment_under_review:'Comprovante em análise', partial_payment:'Pagamento parcial', paid:'Pago',
  sent_to_factory:'Enviado p/ fábrica', in_production:'Em produção',
  production_completed:'Produção concluída', in_transit:'Em transporte',
  available_for_pickup:'Disponível p/ retirada', delivered:'Entregue', cancelled:'Cancelado'
}[s] || s);
const fmtDate = d => d ? new Date(d).toLocaleString('pt-BR') : '-';
const curr = v => Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc = t => String(t ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
const paymentMethodLabel = m => ({ pix:'PIX', dinheiro:'Dinheiro', cartao:'Cartão', boleto:'Boleto', transferencia:'Transferência' }[m] || m);
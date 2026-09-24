import { getClientOrder, getPayments, cancelClientOrder } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { Loader } from '../../components/Loader.js';
import { showToast } from '../../components/Toast.js';
import { ConfirmDialog } from '../../components/Modal.js';
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

  const isCancelled = order.status === 'cancelled';
  const isFullyPaid = remaining <= 0;

  // Só mostra o card se ainda houver saldo devedor e não estiver cancelado
  const showReceiptCard = !isCancelled && !isFullyPaid;
  const showWhatsButton = showReceiptCard && order.sellerPhone;

  // Estatísticas dos pagamentos
  const hasAnyPayment = payments.length > 0;
  const hasPendingReview = payments.some(p => p.verified === false);
  const hasVerified = payments.some(p => p.verified !== false);

  const waMessage = buildReceiptMessage(order, paid, remaining);
  const waHref = showWhatsButton ? whatsappLink(order.sellerPhone, waMessage) : '';

  // Mensagem contextual
  let cardTitle = 'Envie o comprovante de pagamento';
  let cardMessage = '';
  if (hasPendingReview) {
    cardTitle = 'Comprovante em análise';
    cardMessage = `Seu comprovante está sendo conferido pelo vendedor.${
      hasVerified ? ` Ainda falta pagar ${curr(remaining)}.` : ''
    } Se preferir, envie novamente pelo WhatsApp.`;
  } else if (hasVerified && remaining > 0) {
    cardTitle = 'Ainda falta pagar';
    cardMessage = `Já recebemos ${curr(paid)}. Ainda faltam ${curr(remaining)}. Envie o comprovante do restante pelo WhatsApp.`;
  } else {
    cardTitle = 'Envie o comprovante de pagamento';
    cardMessage = `Você ainda não anexou o comprovante. Envie para o vendedor pelo WhatsApp.`;
  }

  content.innerHTML = `
    <div class="order-detail-page">
      <h1>Pedido #${order.id.substring(0,6)}</h1>

      ${showReceiptCard ? `
        <div class="card receipt-callout" style="border-color: var(--primary); background: var(--primary-soft);">
          <h3 style="margin-bottom:0.35rem;">${cardTitle}</h3>
          <p style="font-size:0.9rem; margin-bottom:1rem;">${cardMessage}</p>
          ${showWhatsButton
            ? `<a href="${waHref}" target="_blank" rel="noopener" class="btn btn-success btn-block" id="send-receipt-btn">
                 📱 Enviar comprovante no WhatsApp
               </a>`
            : `<p class="text-muted" style="font-size:0.85rem;">Vendedor sem telefone cadastrado. Entre em contato por outro canal.</p>`}
        </div>
      ` : ''}

      ${isFullyPaid && !isCancelled ? `
        <div class="card" style="border-color: var(--success); background: rgba(16, 185, 129, 0.08);">
          <h3 style="margin:0; color: var(--success);">✅ Pagamento completo</h3>
          <p style="font-size:0.9rem; margin-top:0.35rem;">Você já pagou o valor total deste pedido. Obrigado!</p>
        </div>
      ` : ''}

      <div class="card">
        <h3>Detalhes</h3>
        <p><strong>Campanha:</strong> ${esc(order.campaignTitle)}</p>
        <p><strong>Quantidade:</strong> ${order.quantity}</p>
        ${order.installments && order.installments > 1 ? `<p><strong>Parcelamento:</strong> ${order.installments}x</p>` : ''}
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
        ` : `
          <div class="empty-payments">
            <p class="text-muted" style="text-align:center; padding:1rem 0;">
              Nenhum pagamento registrado ainda.
            </p>
            <p class="text-muted" style="font-size:0.85rem; text-align:center;">
              Assim que o vendedor confirmar o seu pagamento, ele aparecerá aqui automaticamente.
            </p>
          </div>
        `}
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
}

function buildReceiptMessage(order, paid, remaining) {
  const shortId = order.id.substring(0, 6);
  const firstLine = `Oi! Estou enviando o comprovante do meu pedido *#${shortId}* (${order.campaignTitle}).`;
  const money = `Valor total: ${curr(order.totalAmount)}
Pago: ${curr(paid)}
Falta: ${curr(remaining)}`;
  return `${firstLine}\n\n${money}\n\n📎 Segue em anexo.`;
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
import { getCampaign, createClientOrder, addPayment } from '../../firebase/firestore.js';
import { uploadImage } from '../../firebase/upload.js';
import { db } from '../../firebase/config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { router } from '../../router.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';
import { store } from '../../store.js';

export async function CampaignOrderPage(params) {
  const campaignId = params.campaignId;
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign || campaign.status !== 'open') {
      content.innerHTML = '<div class="error-message">Campanha não disponível.</div>';
      return;
    }
    const configSnap = await getDoc(doc(db, 'sellerConfigs', campaign.sellerId));
    const pixKey = configSnap.exists() ? configSnap.data().pixKey || '' : '';
    renderOrderForm(campaign, pixKey);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar campanha.</div>';
  }
}

function renderOrderForm(campaign, pixKey) {
  const content = document.getElementById('app-content');
  const customFields = campaign.customFields || [];
  const maxInst = campaign.maxInstallments || 1;

  content.innerHTML = `
    <div class="order-form-page">
      <h1>Pedido: ${esc(campaign.title)}</h1>
      <form id="client-order-form" class="card">
        <div class="form-row">
          <div class="form-group">
            <label>Preço unitário</label>
            <p class="form-static">${curr(campaign.price)}</p>
          </div>
          <div class="form-group">
            <label for="order-qty">Quantidade</label>
            <input type="number" id="order-qty" class="form-input" value="1" min="1" required>
          </div>
        </div>
        <div class="form-group">
          <label>Valor Total</label>
          <p id="order-total-display" class="form-static">${curr(campaign.price)}</p>
        </div>

        <h3>Pagamento</h3>
        <div class="form-group">
          <label for="payment-method">Forma de Pagamento</label>
          <select id="payment-method" class="form-select" required>
            <option value="pix">PIX</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="cartao">Cartão</option>
            <option value="boleto">Boleto</option>
            <option value="transferencia">Transferência</option>
          </select>
        </div>
        ${pixKey ? `<div class="form-group"><label>Chave PIX do vendedor:</label><p class="form-static">${esc(pixKey)}</p></div>` : ''}
        <div class="form-group">
          <label for="payment-installments">Parcelamento</label>
          <select id="payment-installments" class="form-select" required>
            ${Array.from({ length: maxInst }, (_, i) => i + 1)
              .map(n => `<option value="${n}">${n === 1 ? 'À vista' : `${n}x de ${curr(campaign.price / n)}`}</option>`)
              .join('')}
          </select>
          <small id="installment-preview" class="text-muted"></small>
        </div>
        <div class="form-group">
          <label for="payment-amount">Valor a pagar agora</label>
          <input type="number" id="payment-amount" class="form-input" step="0.01" min="0" readonly>
        </div>
        <div class="form-group">
          <label>Comprovante (imagem)</label>
          <input type="file" id="payment-receipt" accept="image/*">
          <img id="receipt-preview" class="receipt-preview" style="display:none;">
        </div>

        <div id="custom-fields-container">
          ${customFields.length === 0 ? '<p class="text-muted">Nenhuma personalização necessária.</p>' : ''}
          ${customFields.map((field, idx) => renderCustomField(field, idx)).join('')}
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Confirmar Pedido</button>
        </div>
      </form>
    </div>
  `;

  const qtyInput = document.getElementById('order-qty');
  const totalDisplay = document.getElementById('order-total-display');
  const installmentSelect = document.getElementById('payment-installments');
  const amountInput = document.getElementById('payment-amount');
  const preview = document.getElementById('installment-preview');

  function updateInstallments() {
    const qty = parseInt(qtyInput.value) || 1;
    const total = qty * campaign.price;

    // Reconstrói as opções apenas se a quantidade mudou
    const key = `${qty}-${maxInst}`;
    if (installmentSelect.dataset.key !== key) {
      installmentSelect.dataset.key = key;
      const currentValue = installmentSelect.value || '1';
      installmentSelect.innerHTML = Array.from({ length: maxInst }, (_, i) => i + 1)
        .map(n => `<option value="${n}">${n === 1 ? 'À vista' : `${n}x de ${curr(total / n)}`}</option>`)
        .join('');
      installmentSelect.value = Array.from(installmentSelect.options).some(o => o.value === currentValue)
        ? currentValue : '1';
    }

    const n = parseInt(installmentSelect.value) || 1;
    const per = total / n;

    if (n === 1) {
      preview.textContent = 'Pagamento único no valor total.';
    } else {
      preview.textContent = `${n} parcelas de ${curr(per)}. Você paga a primeira agora.`;
    }
    amountInput.value = per.toFixed(2);
    totalDisplay.textContent = curr(total);
  }

  qtyInput.addEventListener('input', updateInstallments);
  installmentSelect.addEventListener('change', updateInstallments);
  updateInstallments();

  const receiptInput = document.getElementById('payment-receipt');
  const receiptPreview = document.getElementById('receipt-preview');
  receiptInput.addEventListener('change', () => {
    const file = receiptInput.files[0];
    if (file) {
      receiptPreview.src = URL.createObjectURL(file);
      receiptPreview.style.display = 'block';
    } else {
      receiptPreview.style.display = 'none';
    }
  });

  document.getElementById('client-order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const qty = parseInt(qtyInput.value) || 1;
    const total = qty * campaign.price;
    const installments = parseInt(installmentSelect.value) || 1;

    const fields = customFields.map((field, idx) => {
      const input = document.querySelector(`[name="cf-${idx}"]`);
      let value = null;
      if (input) {
        if (field.type === 'checkbox') value = input.checked;
        else value = input.value;
      }
      return { label: field.label, value };
    });

    const orderData = {
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      sellerId: campaign.sellerId,
      quantity: qty,
      totalAmount: total,
      installments,
      items: [{ quantity: qty, fields }],
      paidAmount: 0,
      remainingAmount: total,
      clientName: store.get('currentUser').displayName || 'Cliente'
    };

    try {
      const newOrderId = await createClientOrder(orderData);

      const method = document.getElementById('payment-method').value;
      let payAmount = parseFloat(amountInput.value) || total;
      if (isNaN(payAmount) || payAmount <= 0) payAmount = total;
      payAmount = Math.min(payAmount, total);

      const receiptFile = document.getElementById('payment-receipt').files[0];
      let receiptUrl = '';
      if (receiptFile) {
        try {
          receiptUrl = await uploadImage(receiptFile);
        } catch (upErr) {
          showToast('Erro ao enviar comprovante, continuando sem ele.', 'warning');
        }
      }

      if (payAmount > 0) {
        await addPayment(newOrderId, {
          amount: payAmount,
          date: new Date().toISOString().split('T')[0],
          method,
          notes: receiptUrl ? `Comprovante: ${receiptUrl}` : '',
          status: 'pending',
          installmentInfo: installments > 1 ? `Parcela 1 de ${installments}` : 'À vista'
        });
      }

      showToast('Pedido criado com sucesso!', 'success');
      router.navigate('/client/dashboard');
    } catch (err) {
      console.error(err);
      showToast('Erro ao criar pedido.', 'error');
    }
  });
}

function renderCustomField(field, idx) {
  const name = `cf-${idx}`;
  let inputHtml = '';
  if (field.type === 'text') {
    inputHtml = `<input type="text" name="${name}" class="form-input" ${field.required ? 'required' : ''}>`;
  } else if (field.type === 'number') {
    inputHtml = `<input type="number" name="${name}" class="form-input" ${field.required ? 'required' : ''}>`;
  } else if (field.type === 'select' || field.type === 'radio') {
    inputHtml = `<select name="${name}" class="form-select" ${field.required ? 'required' : ''}>
      <option value="">Selecione</option>
      ${(field.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('')}
    </select>`;
  } else if (field.type === 'checkbox') {
    inputHtml = `<label><input type="checkbox" name="${name}" ${field.required ? 'required' : ''}> Sim</label>`;
  }
  return `<div class="form-group">
    <label>${esc(field.label)} ${field.required ? '*' : ''}</label>
    ${inputHtml}
  </div>`;
}

const curr = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = t => String(t ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
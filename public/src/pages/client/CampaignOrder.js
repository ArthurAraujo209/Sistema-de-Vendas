import { getCampaign, createClientOrder, addPayment, getSellerPaymentConfig } from '../../firebase/firestore.js';
import { uploadImage } from '../../firebase/upload.js';
import { router } from '../../router.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';
import { store } from '../../store.js';

const METHOD_LABEL = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  boleto: 'Boleto',
  transferencia: 'Transferência'
};

export async function CampaignOrderPage(params) {
  const campaignId = params.campaignId;
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign || campaign.status !== 'open') {
      content.innerHTML = '<div class="error-message">Campanha não disponível para pedidos.</div>';
      return;
    }
    const cfg = await getSellerPaymentConfig(campaign.sellerId);
    renderOrderForm(campaign, cfg);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar campanha.</div>';
  }
}

function renderOrderForm(campaign, cfg) {
  const content = document.getElementById('app-content');
  const customFields = campaign.customFields || [];
  const maxInst = campaign.maxInstallments || 1;

  const methods = (cfg.paymentMethods && cfg.paymentMethods.length)
    ? cfg.paymentMethods
    : ['pix']; // fallback: se vendedor não configurou, assume PIX

  const methodOptions = methods.map(m =>
    `<option value="${m}">${METHOD_LABEL[m] || m}</option>`
  ).join('');

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
          <label for="payment-method">Forma de Pagamento *</label>
          <select id="payment-method" class="form-select" required>
            ${methodOptions}
          </select>
        </div>

        <div class="form-group" id="pix-box" style="display:none;">
          <label>Chave PIX do vendedor</label>
          <div class="pix-copy-box">
            <code id="pix-value">${esc(cfg.pixKey || '')}</code>
            <button type="button" class="btn btn-sm btn-outline" id="copy-pix-btn">Copiar</button>
          </div>
          <small class="text-muted">Faça o pagamento para essa chave e anexe o comprovante abaixo.</small>
        </div>

        <div class="form-group">
          <label for="payment-installments">Parcelamento *</label>
          <select id="payment-installments" class="form-select" required>
            ${Array.from({ length: maxInst }, (_, i) => i + 1)
              .map(n => `<option value="${n}">${n === 1 ? 'À vista' : `${n}x de ${curr(campaign.price / n)}`}</option>`)
              .join('')}
          </select>
          <small id="installment-preview" class="text-muted"></small>
        </div>

        <div class="form-group">
          <label for="payment-amount">Valor a pagar agora *</label>
          <input type="number" id="payment-amount" class="form-input" step="0.01" min="0" readonly>
        </div>

        <div class="form-group">
          <label for="payment-receipt">Comprovante (imagem) *</label>
          <input type="file" id="payment-receipt" accept="image/*">
          <small class="text-muted">Seu pedido ficará com status <strong>"Comprovante em análise"</strong> até o vendedor confirmar.</small>
          <p class="text-muted">Caso não consiga enviar o comprovante, entre em contato com o vendedor.</p>
          <a href="https://api.whatsapp.com/send?phone=${cfg.whatsapp || ''}" target="_blank" class="btn btn-sm btn-outline">Falar com vendedor</a>
          <br><br>
          <img id="receipt-preview" class="receipt-preview" style="display:none;">
        </div>

        <div id="custom-fields-container">
          ${customFields.length === 0 ? '<p class="text-muted">Nenhuma personalização necessária.</p>' : ''}
          ${customFields.map((field, idx) => renderCustomField(field, idx)).join('')}
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="order-submit">Confirmar Pedido</button>
        </div>
      </form>
    </div>
  `;

  const qtyInput = document.getElementById('order-qty');
  const totalDisplay = document.getElementById('order-total-display');
  const installmentSelect = document.getElementById('payment-installments');
  const amountInput = document.getElementById('payment-amount');
  const preview = document.getElementById('installment-preview');
  const methodSelect = document.getElementById('payment-method');
  const pixBox = document.getElementById('pix-box');
  const pixValue = document.getElementById('pix-value');

  function togglePixBox() {
    pixBox.style.display = methodSelect.value === 'pix' ? 'block' : 'none';
  }
  methodSelect.addEventListener('change', togglePixBox);
  togglePixBox();

  const copyBtn = document.getElementById('copy-pix-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pixValue.textContent);
        showToast('Chave PIX copiada!', 'success');
      } catch (err) {
        showToast('Não foi possível copiar. Copie manualmente.', 'warning');
      }
    });
  }

  function updateInstallments() {
    const qty = parseInt(qtyInput.value) || 1;
    const total = qty * campaign.price;

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

    preview.textContent = n === 1
      ? 'Pagamento único no valor total.'
      : `${n} parcelas de ${curr(per)}. Você paga a primeira agora.`;
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
    const submitBtn = document.getElementById('order-submit');
    const qty = parseInt(qtyInput.value) || 1;
    const total = qty * campaign.price;
    const installments = parseInt(installmentSelect.value) || 1;
    const method = methodSelect.value;

    // Validações
    if (!receiptInput.files[0]) {
      return showToast('Anexe o comprovante para concluir o pedido.', 'error');
    }

    const fields = customFields.map((field, idx) => {
      const input = document.querySelector(`[name="cf-${idx}"]`);
      let value = null;
      if (input) {
        if (field.type === 'checkbox') value = input.checked;
        else value = input.value;
      }
      return { label: field.label, value };
    });

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando comprovante...';

    try {
      // Upload do comprovante antes de tudo (obrigatório)
      let receiptUrl = '';
      try {
        receiptUrl = await uploadImage(receiptInput.files[0]);
      } catch (err) {
        showToast('Erro ao enviar comprovante. Tente novamente.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirmar Pedido';
        return;
      }

      let payAmount = parseFloat(amountInput.value) || total;
      if (isNaN(payAmount) || payAmount <= 0) payAmount = total;
      payAmount = Math.min(payAmount, total);

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
        clientName: store.get('currentUser').displayName || 'Cliente',
        status: 'payment_under_review'
      };

      const newOrderId = await createClientOrder(orderData);

      await addPayment(newOrderId, {
        amount: payAmount,
        date: new Date().toISOString().split('T')[0],
        method,
        notes: `Comprovante: ${receiptUrl}`,
        status: 'pending',
        verified: false,
        installmentInfo: installments > 1 ? `Parcela 1 de ${installments}` : 'À vista'
      });

      showToast('Pedido criado! Comprovante em análise.', 'success');
      router.navigate('/client/dashboard');
    } catch (err) {
      console.error(err);
      showToast('Erro ao criar pedido.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirmar Pedido';
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
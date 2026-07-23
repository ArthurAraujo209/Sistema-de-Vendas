import { getCampaign, createCampaign, updateCampaign, deleteCampaign } from '../../firebase/firestore.js';
import { uploadImage } from '../../firebase/upload.js';
import { router } from '../../router.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';
import { ConfirmDialog, Modal, closeModal } from '../../components/Modal.js';
import Cropper from 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.esm.js';

let campaignId = null;

export async function CampaignDetailPage(params) {
  campaignId = params.id;
  const isNew = campaignId === 'new';
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  let campaign = null;
  if (!isNew) {
    campaign = await getCampaign(campaignId);
    if (!campaign) {
      content.innerHTML = '<div class="error-message">Campanha não encontrada.</div>';
      return;
    }
  }
  renderForm(campaign);
}

function renderForm(campaign) {
  const isNew = !campaign;
  const title = isNew ? 'Nova Campanha' : `Editando: ${campaign.title}`;
  const canEdit = isNew || campaign.status === 'draft' || campaign.status === 'open';

  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="campaign-form-page">
      <div class="page-header">
        <h1>${esc(title)}</h1>
        <button class="btn btn-outline" id="back-to-campaigns">← Voltar</button>
      </div>
      <form id="campaign-form" class="card">
        <div class="form-row">
          <div class="form-group flex-1">
            <label for="camp-title">Título *</label>
            <input type="text" id="camp-title" class="form-input" value="${esc(campaign?.title || '')}" ${!canEdit ? 'disabled' : ''} required>
          </div>
          <div class="form-group">
            <label for="camp-status">Status</label>
            <select id="camp-status" class="form-select" ${!canEdit ? 'disabled' : ''}>
              <option value="draft" ${campaign?.status === 'draft' ? 'selected' : ''}>Rascunho</option>
              <option value="open" ${campaign?.status === 'open' ? 'selected' : ''}>Aberta</option>
              <option value="closed" ${campaign?.status === 'closed' ? 'selected' : ''}>Encerrada</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="camp-description">Descrição</label>
          <textarea id="camp-description" class="form-textarea" rows="4" ${!canEdit ? 'disabled' : ''}>${esc(campaign?.description || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="camp-price">Preço (R$) *</label>
            <input type="number" id="camp-price" class="form-input" step="0.01" min="0" value="${campaign?.price || ''}" ${!canEdit ? 'disabled' : ''} required>
          </div>
          <div class="form-group">
            <label for="camp-cost">Custo (R$)</label>
            <input type="number" id="camp-cost" class="form-input" step="0.01" min="0" value="${campaign?.cost || ''}" ${!canEdit ? 'disabled' : ''}>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="camp-open-date">Data de Abertura</label>
            <input type="date" id="camp-open-date" class="form-input" value="${campaign?.openDate || ''}" ${!canEdit ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="camp-close-date">Data de Fechamento</label>
            <input type="date" id="camp-close-date" class="form-input" value="${campaign?.closeDate || ''}" ${!canEdit ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="camp-estimated-delivery">Previsão de Entrega</label>
            <input type="date" id="camp-estimated-delivery" class="form-input" value="${campaign?.estimatedDelivery || ''}" ${!canEdit ? 'disabled' : ''}>
          </div>
        </div>
        <div class="form-group">
          <label>Imagens (URLs, uma por linha, ou faça upload)</label>
          <textarea id="camp-images" class="form-textarea" rows="3" placeholder="https://..." ${!canEdit ? 'disabled' : ''}>${(campaign?.images || []).join('\n')}</textarea>
          ${canEdit ? `<input type="file" id="image-upload" accept="image/*" multiple style="margin-top:0.5rem">` : ''}
          ${campaign?.images?.length ? `<div class="image-previews">${campaign.images.map(url => `<img src="${esc(url)}" class="preview-thumb" onerror="this.style.display='none'">`).join('')}</div>` : ''}
        </div>

        <h3>Campos Personalizados</h3>
        <div id="custom-fields-container">
          ${renderCustomFields(campaign?.customFields || [], canEdit)}
        </div>
        ${canEdit ? `<button type="button" class="btn btn-sm btn-outline" id="add-custom-field">+ Adicionar Campo</button>` : ''}

        ${canEdit ? `
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Salvar</button>
            ${!isNew ? `<button type="button" class="btn btn-danger" id="delete-campaign-btn">Excluir Campanha</button>` : ''}
          </div>
        ` : `<p class="text-muted">Campanha encerrada/arquivada não pode ser editada.</p>`}
      </form>
    </div>
  `;

  document.getElementById('back-to-campaigns').addEventListener('click', () => router.navigate('/seller/campaigns'));

  if (canEdit) {
    const imageUpload = document.getElementById('image-upload');
    if (imageUpload) {
      imageUpload.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files.length) return;
        const file = files[0];

        // Modal de recorte
        const modalId = 'crop-modal-' + Date.now();
        const modalContent = `
          <div style="text-align:center;">
            <div style="max-width:100%; max-height:60vh; display:flex; justify-content:center;">
              <img id="crop-image" src="${URL.createObjectURL(file)}" style="max-width:100%;">
            </div>
            <div style="margin-top:1rem; display:flex; gap:1rem; justify-content:center;">
              <button class="btn btn-secondary" id="crop-cancel">Cancelar</button>
              <button class="btn btn-primary" id="crop-confirm">Recortar e Enviar</button>
            </div>
          </div>
        `;
        const modal = Modal({
          id: modalId,
          title: 'Recortar Imagem',
          content: modalContent,
          size: 'large',
          onClose: () => {}
        });

        const cropImage = document.getElementById('crop-image');
        let cropper = new Cropper(cropImage, {
          aspectRatio: NaN,
          viewMode: 1,
          autoCropArea: 1,
          responsive: true,
        });

        document.getElementById('crop-confirm').addEventListener('click', async () => {
          cropper.getCroppedCanvas().toBlob(async (blob) => {
            if (!blob) {
              showToast('Erro ao processar imagem.', 'error');
              return;
            }
            try {
              const url = await uploadImage(blob);
              const textarea = document.getElementById('camp-images');
              textarea.value = textarea.value ? textarea.value + '\n' + url : url;
              showToast('Imagem enviada!', 'success');
              closeModal(modalId);
              cropper.destroy();
            } catch (err) {
              showToast('Erro no upload: ' + err.message, 'error');
            }
          }, 'image/jpeg', 0.9);
        });

        document.getElementById('crop-cancel').addEventListener('click', () => {
          cropper.destroy();
          closeModal(modalId);
        });
        imageUpload.value = ''; // limpar input
      });
    }

    document.getElementById('add-custom-field').addEventListener('click', () => addCustomFieldRow());
    document.getElementById('campaign-form').addEventListener('submit', handleSubmit);
    document.getElementById('delete-campaign-btn')?.addEventListener('click', handleDelete);

    document.getElementById('custom-fields-container').addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-custom-field')) {
        e.target.closest('.custom-field-row').remove();
      }
    });
  }
}

function renderCustomFields(fields, canEdit) {
  if (!fields.length) return '<p class="text-muted">Nenhum campo personalizado.</p>';
  return fields.map((field, index) => `
    <div class="custom-field-row" data-index="${index}">
      <div class="form-row">
        <div class="form-group">
          <label>Nome do Campo</label>
          <input type="text" name="cf-label" class="form-input" value="${esc(field.label)}" ${!canEdit ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select name="cf-type" class="form-select" ${!canEdit ? 'disabled' : ''}>
            <option value="text" ${field.type === 'text' ? 'selected' : ''}>Texto</option>
            <option value="number" ${field.type === 'number' ? 'selected' : ''}>Número</option>
            <option value="select" ${field.type === 'select' ? 'selected' : ''}>Lista de Opções</option>
            <option value="checkbox" ${field.type === 'checkbox' ? 'selected' : ''}>Checkbox</option>
            <option value="radio" ${field.type === 'radio' ? 'selected' : ''}>Radio</option>
          </select>
        </div>
        <div class="form-group">
          <label>Obrigatório</label>
          <select name="cf-required" class="form-select" ${!canEdit ? 'disabled' : ''}>
            <option value="true" ${field.required ? 'selected' : ''}>Sim</option>
            <option value="false" ${!field.required ? 'selected' : ''}>Não</option>
          </select>
        </div>
      </div>
      <div class="form-group cf-options" ${['select', 'radio'].includes(field.type) ? '' : 'style="display:none"'}>
        <label>Opções (separadas por vírgula)</label>
        <input type="text" name="cf-options" class="form-input" value="${(field.options || []).join(', ')}" ${!canEdit ? 'disabled' : ''}>
      </div>
      ${canEdit ? `<button type="button" class="btn btn-sm btn-outline remove-custom-field">Remover</button>` : ''}
    </div>
  `).join('');
}

function addCustomFieldRow() {
  const container = document.getElementById('custom-fields-container');
  const row = document.createElement('div');
  row.className = 'custom-field-row';
  row.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label>Nome do Campo</label>
        <input type="text" name="cf-label" class="form-input" placeholder="Ex: Tamanho">
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select name="cf-type" class="form-select">
          <option value="text">Texto</option>
          <option value="number">Número</option>
          <option value="select">Lista de Opções</option>
          <option value="checkbox">Checkbox</option>
          <option value="radio">Radio</option>
        </select>
      </div>
      <div class="form-group">
        <label>Obrigatório</label>
        <select name="cf-required" class="form-select">
          <option value="true">Sim</option>
          <option value="false" selected>Não</option>
        </select>
      </div>
    </div>
    <div class="form-group cf-options" style="display:none">
      <label>Opções (separadas por vírgula)</label>
      <input type="text" name="cf-options" class="form-input" placeholder="P, M, G, GG">
    </div>
    <button type="button" class="btn btn-sm btn-outline remove-custom-field">Remover</button>
  `;
  container.appendChild(row);
  const typeSelect = row.querySelector('[name="cf-type"]');
  typeSelect.addEventListener('change', function() {
    const optionsDiv = row.querySelector('.cf-options');
    optionsDiv.style.display = ['select', 'radio'].includes(this.value) ? '' : 'none';
  });
}

async function handleSubmit(e) {
  e.preventDefault();
  const isNew = campaignId === 'new';
  const data = {
    title: document.getElementById('camp-title').value.trim(),
    status: document.getElementById('camp-status').value,
    description: document.getElementById('camp-description').value.trim(),
    price: parseFloat(document.getElementById('camp-price').value) || 0,
    cost: parseFloat(document.getElementById('camp-cost').value) || 0,
    openDate: document.getElementById('camp-open-date').value,
    closeDate: document.getElementById('camp-close-date').value,
    estimatedDelivery: document.getElementById('camp-estimated-delivery').value,
    images: document.getElementById('camp-images').value.split('\n').map(u => u.trim()).filter(Boolean),
    customFields: getCustomFieldsFromForm()
  };

  if (!data.title) { showToast('O título é obrigatório.', 'error'); return; }

  try {
    if (isNew) {
      await createCampaign(data);
      showToast('Campanha criada!', 'success');
    } else {
      await updateCampaign(campaignId, data);
      showToast('Campanha atualizada!', 'success');
    }
    router.navigate('/seller/campaigns'); // sempre volta para a lista
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar campanha.', 'error');
  }
}

function getCustomFieldsFromForm() {
  const rows = document.querySelectorAll('.custom-field-row');
  return Array.from(rows).map(row => {
    const label = row.querySelector('[name="cf-label"]')?.value || '';
    const type = row.querySelector('[name="cf-type"]')?.value || 'text';
    const required = row.querySelector('[name="cf-required"]')?.value === 'true';
    const optionsStr = row.querySelector('[name="cf-options"]')?.value || '';
    const options = optionsStr ? optionsStr.split(',').map(o => o.trim()).filter(Boolean) : [];
    return { label, type, required, options };
  }).filter(f => f.label);
}

async function handleDelete() {
  ConfirmDialog({
    title: 'Excluir Campanha',
    message: 'Tem certeza?',
    confirmText: 'Excluir',
    onConfirm: async () => {
      await deleteCampaign(campaignId);
      showToast('Campanha excluída.', 'success');
      router.navigate('/seller/campaigns');
    }
  });
}

function esc(t) { return String(t).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]); }
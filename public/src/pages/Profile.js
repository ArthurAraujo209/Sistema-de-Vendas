import { store } from '../store.js';
import { db, auth } from '../firebase/config.js';
import { doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { saveUserProfile } from '../firebase/auth.js';
import { uploadImage } from '../firebase/upload.js';
import { showToast } from '../components/Toast.js';
import { Loader } from '../components/Loader.js';
import { router } from '../router.js';

const PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'cartao', label: 'Cartão' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'transferencia', label: 'Transferência' }
];

export async function ProfilePage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  const user = store.get('currentUser');
  const profile = store.get('userProfile') || {};
  const wasComplete = !!profile.profileCompleted;

  const isSeller = user.role === 'seller';
  const isAdmin = user.role === 'admin';

  const savedMethods = Array.isArray(profile.paymentMethods) && profile.paymentMethods.length
    ? profile.paymentMethods
    : ['pix'];

  content.innerHTML = `
    <div class="profile-page">
      <h1>${isSeller ? 'Configurações da Loja' : 'Meu Perfil'}</h1>

      <div class="card" id="profile-incomplete-card" style="display:${wasComplete ? 'none' : 'block'};">
        <strong>⚠️ Complete seu perfil</strong>
        <p style="margin-top:0.35rem; font-size:0.9rem;">Preencha telefone e foto para que seus pedidos e cobranças funcionem corretamente.</p>
      </div>

      <form id="profile-form" class="card">
        <div class="form-row">
          <div class="form-group" style="text-align:center;">
            <div class="avatar-upload">
              <img id="avatar-preview" src="${esc(profile.photoUrl || '')}" class="avatar-img" style="display:${profile.photoUrl ? 'block' : 'none'};">
              <div class="avatar-placeholder" style="display:${profile.photoUrl ? 'none' : 'flex'};">📷</div>
              <input type="file" id="photo-upload" accept="image/*" style="display:none;">
              <button type="button" class="btn btn-sm btn-outline" id="change-photo-btn">Alterar Foto</button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="profile-name">Nome *</label>
          <input type="text" id="profile-name" class="form-input" value="${esc(user.displayName || '')}" required>
        </div>

        <div class="form-group">
          <label for="profile-phone">Telefone (WhatsApp) *</label>
          <input type="tel" id="profile-phone" class="form-input" value="${esc(profile.phone || '')}" placeholder="(11) 99999-9999">
        </div>

        <div class="form-group">
          <label>E-mail</label>
          <p class="form-static">${esc(user.email)}</p>
        </div>

        ${isSeller ? `
          <div class="form-group">
            <label for="profile-description">Descrição da Loja</label>
            <textarea id="profile-description" class="form-textarea" rows="3">${esc(profile.description || '')}</textarea>
          </div>
          <div class="form-group">
            <label for="profile-instagram">Instagram</label>
            <input type="text" id="profile-instagram" class="form-input" value="${esc(profile.instagram || '')}" placeholder="@sualoja">
          </div>

          <h3 style="margin-top:1.5rem; margin-bottom:1rem;">Pagamentos aceitos</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-bottom:0.75rem;">
            Selecione os métodos que você aceita. O cliente só verá essas opções ao fazer o pedido.
          </p>

          <div class="form-group">
            <div class="payment-methods-grid">
              ${PAYMENT_METHODS.map(m => `
                <label class="payment-check">
                  <input type="checkbox" name="pm" value="${m.id}" ${savedMethods.includes(m.id) ? 'checked' : ''}>
                  <span>${m.label}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label for="profile-pix">Chave PIX</label>
            <input type="text" id="profile-pix" class="form-input" value="${esc(profile.pixKey || '')}" placeholder="CPF, e-mail, telefone ou chave aleatória">
            <small class="text-muted">Será exibida ao cliente quando o método PIX estiver habilitado.</small>
          </div>
        ` : ''}

        <button type="submit" class="btn btn-primary" id="profile-submit">Salvar</button>
      </form>
    </div>
  `;

  const photoInput = document.getElementById('photo-upload');
  const previewImg = document.getElementById('avatar-preview');
  const placeholder = document.querySelector('.avatar-placeholder');
  const changeBtn = document.getElementById('change-photo-btn');

  changeBtn.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (file) {
      previewImg.src = URL.createObjectURL(file);
      previewImg.style.display = 'block';
      placeholder.style.display = 'none';
    }
  });

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('profile-submit');
    const name = document.getElementById('profile-name').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();

    if (!name) return showToast('Informe seu nome.', 'error');
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return showToast('Telefone inválido. Informe DDD + número.', 'error');
    }

    const updates = { displayName: name, phone };

    if (isSeller) {
      updates.description = document.getElementById('profile-description').value.trim();
      updates.instagram = document.getElementById('profile-instagram').value.trim();
      updates.pixKey = document.getElementById('profile-pix').value.trim();

      const selected = Array.from(document.querySelectorAll('input[name="pm"]:checked')).map(i => i.value);
      if (!selected.length) return showToast('Selecione pelo menos um método de pagamento.', 'error');
      if (selected.includes('pix') && !updates.pixKey) {
        return showToast('Informe a chave PIX para aceitar pagamentos via PIX.', 'error');
      }
      updates.paymentMethods = selected;
    }

    const photoFile = photoInput.files[0];
    if (photoFile) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando foto...';
      try {
        updates.photoUrl = await uploadImage(photoFile);
      } catch (err) {
        showToast('Erro ao enviar foto.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar';
        return;
      }
    }

    try {
      const saved = await saveUserProfile(user.uid, updates);
      store.update({
        currentUser: { ...user, displayName: name },
        userProfile: saved
      });
      showToast('Perfil salvo!', 'success');

      const justCompleted = !wasComplete && saved.profileCompleted;
      if (justCompleted) {
        let homePath = '/client/explore';
        if (user.role === 'seller') homePath = '/seller/dashboard';
        else if (user.role === 'admin') homePath = '/admin/dashboard';
        setTimeout(() => router.navigate(homePath), 400);
      } else {
        const card = document.getElementById('profile-incomplete-card');
        if (card) card.style.display = saved.profileCompleted ? 'none' : 'block';
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar perfil.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Salvar';
    }
  });
}

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
import { store } from '../store.js';
import { db, auth } from '../firebase/config.js';
import { doc, updateDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { uploadImage } from '../firebase/upload.js';
import { showToast } from '../components/Toast.js';
import { Loader } from '../components/Loader.js';

export async function ProfilePage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  const user = store.get('currentUser');
  const profile = store.get('userProfile') || {};

  // Determinar campos de acordo com a role
  const isSeller = user.role === 'seller';
  const isAdmin = user.role === 'admin';

  content.innerHTML = `
    <div class="profile-page">
      <h1>${isSeller ? 'Configurações da Loja' : 'Meu Perfil'}</h1>
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
          <label for="profile-phone">Telefone</label>
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
          <div class="form-group">
            <label for="profile-pix">Chave PIX</label>
            <input type="text" id="profile-pix" class="form-input" value="${esc(profile.pixKey || '')}" placeholder="CPF, e-mail, telefone...">
          </div>
        ` : ''}
        <button type="submit" class="btn btn-primary">Salvar</button>
      </form>
    </div>
  `;

  // Preview da foto
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
    const name = document.getElementById('profile-name').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    const updates = { displayName: name, phone, updatedAt: new Date().toISOString() };

    if (isSeller) {
      updates.description = document.getElementById('profile-description').value.trim();
      updates.instagram = document.getElementById('profile-instagram').value.trim();
      updates.pixKey = document.getElementById('profile-pix').value.trim();
    }

    // Upload da foto se selecionada
    const photoFile = photoInput.files[0];
    if (photoFile) {
      try {
        updates.photoUrl = await uploadImage(photoFile);
        showToast('Foto atualizada!', 'success');
      } catch (err) {
        showToast('Erro ao enviar foto.', 'error');
        return;
      }
    }

    try {
      // Atualizar Auth
      await updateProfile(auth.currentUser, { displayName: name });
      // Atualizar Firestore
      await updateDoc(doc(db, 'users', user.uid), updates);
      // Atualizar store local
      store.update({
        currentUser: { ...user, displayName: name },
        userProfile: { ...profile, ...updates }
      });
      showToast('Perfil salvo!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar perfil.', 'error');
    }
  });
}

function esc(text) {
  return String(text).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]);
}
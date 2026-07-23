import { store } from '../../store.js';
import { db, auth } from '../../firebase/config.js';
import { doc, updateDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';

export async function ClientProfilePage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  const user = store.get('currentUser');
  const profile = store.get('userProfile') || {};

  content.innerHTML = `
    <div class="profile-page">
      <h1>Meu Perfil</h1>
      <form id="profile-form" class="card">
        <div class="form-group">
          <label for="profile-name">Nome</label>
          <input type="text" id="profile-name" class="form-input" value="${esc(user.displayName || '')}" required>
        </div>
        <div class="form-group">
          <label for="profile-phone">Telefone</label>
          <input type="text" id="profile-phone" class="form-input" value="${esc(profile.phone || '')}" placeholder="(11) 99999-9999">
        </div>
        <div class="form-group">
          <label>E-mail</label>
          <p class="form-static">${esc(user.email)}</p>
        </div>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </form>
    </div>
  `;

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('profile-name').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();

    try {
      // Atualizar nome no Auth
      await updateProfile(auth.currentUser, { displayName: name });
      // Atualizar telefone no Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { displayName: name, phone, updatedAt: new Date().toISOString() });
      // Atualizar store local
      store.update({
        currentUser: { ...user, displayName: name },
        userProfile: { ...profile, phone }
      });
      showToast('Perfil atualizado!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar perfil.', 'error');
    }
  });
}

function esc(text) {
  return String(text).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]);
}
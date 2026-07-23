import { db } from '../../firebase/config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { store } from '../../store.js';
import { showToast } from '../../components/Toast.js';

export async function SettingsPage() {
  const content = document.getElementById('app-content');
  const sellerId = store.get('currentUser').uid;
  const ref = doc(db, 'sellerConfigs', sellerId);
  const snap = await getDoc(ref);
  const config = snap.exists() ? snap.data() : {};

  content.innerHTML = `
    <div class="settings-page">
      <h1>Configurações</h1>
      <form id="settings-form" class="card">
        <div class="form-group">
          <label for="pix-key">Chave PIX (exibida para os clientes)</label>
          <input type="text" id="pix-key" class="form-input" value="${esc(config.pixKey || '')}" placeholder="CPF, e-mail, telefone ou chave aleatória">
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pixKey = document.getElementById('pix-key').value.trim();
    await setDoc(ref, { pixKey, updatedAt: new Date().toISOString() }, { merge: true });
    showToast('Configurações salvas!', 'success');
  });
}

function esc(t) {
  return String(t).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]);
}
import { db } from '../../firebase/config.js';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, deleteField } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { Loader } from '../../components/Loader.js';
import { showToast } from '../../components/Toast.js';
import { thumbUrl } from '../../utils/imageUtils.js';

export async function AdminApplicationsPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const snap = await getDocs(query(collection(db, 'sellerApplications'), where('status', '==', 'pending')));
    const applications = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    content.innerHTML = `
      <div class="admin-page">
        <h1>Solicitações Pendentes</h1>
        ${applications.length === 0 ? '<p class="text-muted">Nenhuma solicitação pendente.</p>' : `
        <table class="table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Instagram</th><th>Descrição</th><th>Foto</th><th>Ações</th></tr></thead>
          <tbody>
            ${applications.map(a => `
              <tr>
                <td>${esc(a.name)}</td>
                <td>${esc(a.email)}</td>
                <td>${esc(a.instagram)}</td>
                <td>${esc((a.description || '').slice(0, 80))}</td>
                <td>${app.photoUrl ? `<img src="${thumbUrl(app.photoUrl, 80)}" loading="lazy" class="payment-thumb" alt="Foto">` : '-'}</td>
                <td>
                  <button class="btn btn-sm btn-success approve-btn" data-id="${a.id}">Aprovar</button>
                  <button class="btn btn-sm btn-danger reject-btn" data-id="${a.id}">Rejeitar</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>`;

    content.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const appId = btn.dataset.id;
        const app = applications.find(a => a.id === appId);
        if (!app) return;
        try {
          // Instância secundária → NÃO desloga o admin
          const firebaseConfig = {
            apiKey: "AIzaSyD_ViGX4OUPr_6jY_Ia_LYj4tQMFj0pN8w",
            authDomain: "sistema-de-camisas.firebaseapp.com",
            projectId: "sistema-de-camisas",
            storageBucket: "sistema-de-camisas.firebasestorage.app",
            messagingSenderId: "34250824813",
            appId: "1:34250824813:web:2d060650a010638c937364"
          };
          const name = `secondary-approve-${Date.now()}`;
          const secondaryApp = initializeApp(firebaseConfig, name);
          const secondaryAuth = getAuth(secondaryApp);

          try {
            // Cria usuário com senha temporária aleatória
            const tmpPass = 'Tmp' + Math.random().toString(36).slice(2,12) + 'Aa1!';
            const cred = await createUserWithEmailAndPassword(secondaryAuth, app.email, tmpPass);

            await setDoc(doc(db, 'users', cred.user.uid), {
              uid: cred.user.uid,
              email: app.email,
              displayName: app.name,
              phone: app.phone || '',
              role: 'seller',
              description: app.description || '',
              instagram: app.instagram || '',
              photoUrl: app.photoUrl || '',
              subscriptionStatus: 'active',
              subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0],
              approvedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });

            // Envia link de "definir senha" para o vendedor
            await sendPasswordResetEmail(secondaryAuth, app.email).catch(() => {});
            await signOut(secondaryAuth).catch(() => {});
          } finally {
            await deleteApp(secondaryApp).catch(() => {});
          }

          await updateDoc(doc(db, 'sellerApplications', appId), {
            status: 'approved',
            password: deleteField(),   // remove qualquer senha residual
            updatedAt: new Date().toISOString()
          });

          showToast('Vendedor aprovado! E-mail de definição de senha enviado.', 'success');
          AdminApplicationsPage();
        } catch (err) {
          console.error('[approve]', err?.code || err?.message);
          showToast('Erro ao aprovar: ' + (err?.code || err?.message || ''), 'error');
          btn.disabled = false;
        }
      });
    });

    content.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await updateDoc(doc(db, 'sellerApplications', btn.dataset.id), {
            status: 'rejected',
            password: deleteField(),
            updatedAt: new Date().toISOString()
          });
          showToast('Solicitação rejeitada.', 'info');
          AdminApplicationsPage();
        } catch (err) {
          showToast('Erro ao rejeitar.', 'error');
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    console.error('[applications]', err);
    content.innerHTML = '<div class="error-message">Erro ao carregar.</div>';
  }
}

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
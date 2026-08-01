import { db, auth } from '../../firebase/config.js';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, addDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { Loader } from '../../components/Loader.js';
import { showToast } from '../../components/Toast.js';

export async function AdminApplicationsPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const appsSnap = await getDocs(query(collection(db, 'sellerApplications'), where('status', '==', 'pending')));
    const applications = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    content.innerHTML = `
      <div class="admin-page">
        <h1>Solicitações Pendentes</h1>
        ${applications.length === 0 ? '<p class="text-muted">Nenhuma solicitação pendente.</p>' : `
          <table class="table">
            <thead><tr><th>Nome</th><th>Email</th><th>Instagram</th><th>Descrição</th><th>Foto</th><th>Ações</th></tr></thead>
            <tbody>
              ${applications.map(app => `
                <tr>
                  <td>${esc(app.name)}</td>
                  <td>${esc(app.email)}</td>
                  <td>${esc(app.instagram)}</td>
                  <td>${esc(app.description)}</td>
                  <td>${app.photoUrl ? `<img src="${esc(app.photoUrl)}" class="payment-thumb">` : '-'}</td>
                  <td>
                    <button class="btn btn-sm btn-success approve-btn" data-id="${app.id}">Aprovar</button>
                    <button class="btn btn-sm btn-danger reject-btn" data-id="${app.id}">Rejeitar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;

    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const appId = btn.dataset.id;
        const appData = applications.find(a => a.id === appId);
        try {
          // Criar usuário vendedor
          const userCred = await createUserWithEmailAndPassword(auth, appData.email, appData.password);
          await setDoc(doc(db, 'users', userCred.user.uid), {
            uid: userCred.user.uid,
            email: appData.email,
            displayName: appData.name,
            phone: appData.phone,
            role: 'seller',
            description: appData.description,      // ← adicionar
            instagram: appData.instagram,          // ← adicionar
            photoUrl: appData.photoUrl,            // ← adicionar
            subscriptionStatus: 'active',
            subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            approvedBy: 'admin',
            approvedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          // Marcar solicitação como aprovada
          await updateDoc(doc(db, 'sellerApplications', appId), { status: 'approved', updatedAt: new Date().toISOString() });
          showToast('Vendedor aprovado!', 'success');
          AdminApplicationsPage(); // recarrega
        } catch (err) {
          console.error(err);
          showToast('Erro ao aprovar: ' + (err.message || ''), 'error');
        }
      });
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const appId = btn.dataset.id;
        try {
          await updateDoc(doc(db, 'sellerApplications', appId), { status: 'rejected', updatedAt: new Date().toISOString() });
          showToast('Solicitação rejeitada.', 'info');
          AdminApplicationsPage();
        } catch (err) {
          showToast('Erro ao rejeitar.', 'error');
        }
      });
    });
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar.</div>';
  }
}

function esc(t) { return String(t).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]); }
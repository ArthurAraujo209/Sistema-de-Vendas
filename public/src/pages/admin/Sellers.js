import { db } from '../../firebase/config.js';
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { Loader } from '../../components/Loader.js';
import { showToast } from '../../components/Toast.js';

export async function AdminSellersPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const sellersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'seller'), orderBy('createdAt', 'desc')));
    const sellers = sellersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    content.innerHTML = `
      <div class="admin-page">
        <h1>Vendedores Cadastrados</h1>
        <table class="table">
          <thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Assinatura</th><th>Vencimento</th><th>Ações</th></tr></thead>
          <tbody>
            ${sellers.map(s => `
              <tr>
                <td>${esc(s.displayName)}</td>
                <td>${esc(s.email)}</td>
                <td>${esc(s.phone || '-')}</td>
                <td><span class="badge badge-${s.subscriptionStatus || 'inactive'}">${subLabel(s.subscriptionStatus)}</span></td>
                <td>${s.subscriptionExpiry ? new Date(s.subscriptionExpiry).toLocaleDateString('pt-BR') : '-'}</td>
                <td>
                  <button class="btn btn-sm btn-outline edit-sub" data-id="${s.id}" data-expiry="${s.subscriptionExpiry || ''}">Editar Assinatura</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('.edit-sub').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sellerId = btn.dataset.id;
        const currentExpiry = btn.dataset.expiry || '';
        const newExpiry = prompt('Data de vencimento da assinatura (AAAA-MM-DD):', currentExpiry);
        if (newExpiry === null) return;
        const status = prompt('Status (active/inactive/expired):', 'active');
        if (!status) return;
        try {
          await updateDoc(doc(db, 'users', sellerId), {
            subscriptionStatus: status,
            subscriptionExpiry: newExpiry,
            updatedAt: new Date().toISOString()
          });
          showToast('Assinatura atualizada!', 'success');
          AdminSellersPage(); // recarrega
        } catch (err) {
          showToast('Erro ao atualizar.', 'error');
        }
      });
    });
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar.</div>';
  }
}

function subLabel(s) {
  return { active: 'Ativa', inactive: 'Inativa', expired: 'Expirada' }[s] || 'Inativa';
}
function esc(t) { return String(t).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]); }
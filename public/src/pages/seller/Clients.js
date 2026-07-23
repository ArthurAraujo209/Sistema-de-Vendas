import { getOrders } from '../../firebase/firestore.js';
import { getDocs, collection, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from '../../firebase/config.js';
import { store } from '../../store.js';
import { Loader } from '../../components/Loader.js';

export async function ClientsPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const sellerId = store.get('currentUser').uid;
    // Buscar pedidos para extrair clientes únicos
    const ordersSnap = await getDocs(query(collection(db, 'orders'), where('sellerId', '==', sellerId), orderBy('createdAt', 'desc')));
    const clientMap = new Map();
    ordersSnap.forEach(doc => {
      const order = doc.data();
      if (!clientMap.has(order.clientId)) {
        clientMap.set(order.clientId, {
          id: order.clientId,
          name: order.clientName || 'Desconhecido',
          email: '', // preencher depois se necessário
          phone: ''
        });
      }
    });

    // Buscar detalhes dos usuários (email, telefone)
    const clientIds = Array.from(clientMap.keys());
    if (clientIds.length) {
      const usersSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', clientIds)));
      usersSnap.forEach(doc => {
        const user = doc.data();
        if (clientMap.has(user.uid)) {
          const client = clientMap.get(user.uid);
          client.email = user.email || '';
          client.phone = user.phone || '';
        }
      });
    }

    const clients = Array.from(clientMap.values());
    renderClients(clients);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar clientes.</div>';
  }
}

function renderClients(clients) {
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="clients-page">
      <h1>Clientes</h1>
      ${clients.length === 0 ? '<div class="empty-state">Nenhum cliente encontrado.</div>' : `
        <table class="table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Ação</th></tr></thead>
          <tbody>
            ${clients.map(c => `
              <tr>
                <td>${esc(c.name)}</td>
                <td>${c.email || '-'}</td>
                <td>${c.phone || '-'}</td>
                <td>
                  ${c.phone ? `<a href="https://wa.me/55${c.phone.replace(/\D/g,'')}" target="_blank" class="btn btn-sm btn-success">📱 WhatsApp</a>` : '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

const esc = t => String(t).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
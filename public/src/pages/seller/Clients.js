import { getOrders } from '../../firebase/firestore.js';
import { collection, query, where, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from '../../firebase/config.js';
import { store } from '../../store.js';
import { Loader } from '../../components/Loader.js';

export async function ClientsPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const sellerId = store.get('currentUser').uid;

    // Buscar todos os pedidos do vendedor
    const ordersSnap = await getDocs(
      query(collection(db, 'orders'), where('sellerId', '==', sellerId), orderBy('createdAt', 'desc'))
    );

    // Extrair clientId únicos e guardar nome do pedido como fallback
    const clientMap = new Map();
    ordersSnap.forEach(doc => {
      const order = doc.data();
      if (!clientMap.has(order.clientId)) {
        clientMap.set(order.clientId, {
          id: order.clientId,
          name: order.clientName || 'Sem nome',   // fallback
          email: '',
          phone: ''
        });
      }
    });

    // Buscar detalhes dos usuários (displayName, email, phone)
    const clientIds = Array.from(clientMap.keys());

    if (clientIds.length > 0) {
      // Firestore 'in' só aceita até 10 valores – dividir em lotes
      const chunkSize = 10;
      for (let i = 0; i < clientIds.length; i += chunkSize) {
        const chunk = clientIds.slice(i, i + chunkSize);
        const usersSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', chunk)));
        usersSnap.forEach(doc => {
          const user = doc.data();
          const client = clientMap.get(user.uid);
          if (client) {
            // Substituir pelo nome do perfil, se disponível
            client.name = user.displayName || client.name;
            client.email = user.email || '';
            client.phone = user.phone || '';
          }
        });
      }
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
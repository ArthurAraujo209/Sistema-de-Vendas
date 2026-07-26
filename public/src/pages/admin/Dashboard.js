import { db } from '../../firebase/config.js';
import { collection, query, where, getCountFromServer, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { Loader } from '../../components/Loader.js';

export async function AdminDashboardPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const [usersCount, sellersCount, campaignsCount, ordersCount, applicationsCount] = await Promise.all([
      getCountFromServer(collection(db, 'users')),
      getCountFromServer(query(collection(db, 'users'), where('role', '==', 'seller'))),
      getCountFromServer(collection(db, 'campaigns')),
      getCountFromServer(collection(db, 'orders')),
      getCountFromServer(query(collection(db, 'sellerApplications'), where('status', '==', 'pending')))
    ]);

    content.innerHTML = `
      <div class="admin-dashboard">
        <h1>Painel Administrativo</h1>
        <div class="dashboard-grid">
          <div class="card card-stat">
            <div class="stat-icon">👥</div>
            <div class="stat-info"><div class="stat-value">${usersCount.data().count}</div><div class="stat-label">Total de Usuários</div></div>
          </div>
          <div class="card card-stat">
            <div class="stat-icon">🏪</div>
            <div class="stat-info"><div class="stat-value">${sellersCount.data().count}</div><div class="stat-label">Vendedores</div></div>
          </div>
          <div class="card card-stat">
            <div class="stat-icon">📢</div>
            <div class="stat-info"><div class="stat-value">${campaignsCount.data().count}</div><div class="stat-label">Campanhas</div></div>
          </div>
          <div class="card card-stat">
            <div class="stat-icon">📋</div>
            <div class="stat-info"><div class="stat-value">${ordersCount.data().count}</div><div class="stat-label">Pedidos</div></div>
          </div>
          <div class="card card-stat">
            <div class="stat-icon">⏳</div>
            <div class="stat-info"><div class="stat-value">${applicationsCount.data().count}</div><div class="stat-label">Solicitações Pendentes</div></div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar dashboard.</div>';
  }
}
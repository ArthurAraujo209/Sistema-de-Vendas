import { db } from '../../firebase/config.js';
import { collection, query, where, getDocs, getCountFromServer, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { store } from '../../store.js';
import { Loader } from '../../components/Loader.js';
import { showToast } from '../../components/Toast.js';

export async function DashboardPage() {
  const content = document.getElementById('app-content');
  const sellerId = store.get('currentUser').uid;

  // Exibir esqueleto de carregamento
  content.innerHTML = `
    <div class="dashboard">
      <h1 class="page-title">Dashboard</h1>
      <div class="dashboard-grid">
        ${Array(8).fill(0).map(() => `
          <div class="card card-stat">
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line short"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  try {
    const data = await fetchDashboardData(sellerId);
    renderDashboard(data);
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    showToast('Erro ao carregar dados do dashboard.', 'error');
    content.innerHTML = `
      <div class="dashboard">
        <h1 class="page-title">Dashboard</h1>
        <div class="error-message">Não foi possível carregar os indicadores.</div>
      </div>
    `;
  }
}

async function fetchDashboardData(sellerId) {
  // 1. Contagens de pedidos por status
  const ordersRef = collection(db, 'orders');
  const sellerOrdersQuery = query(ordersRef, where('sellerId', '==', sellerId));

  // Contagens usando getCountFromServer (mais barato)
  const allCountSnap = await getCountFromServer(sellerOrdersQuery);
  const totalOrders = allCountSnap.data().count;

  // Pedidos pagos (status 'paid')
  const paidQuery = query(ordersRef, where('sellerId', '==', sellerId), where('status', '==', 'paid'));
  const paidSnap = await getCountFromServer(paidQuery);
  const paidOrders = paidSnap.data().count;

  // Pedidos pendentes (status 'awaiting_payment')
  const pendingQuery = query(ordersRef, where('sellerId', '==', sellerId), where('status', '==', 'awaiting_payment'));
  const pendingSnap = await getCountFromServer(pendingQuery);
  const pendingOrders = pendingSnap.data().count;

  // Em produção (status 'in_production')
  const productionQuery = query(ordersRef, where('sellerId', '==', sellerId), where('status', '==', 'in_production'));
  const productionSnap = await getCountFromServer(productionQuery);
  const productionOrders = productionSnap.data().count;

  // Entregues (status 'delivered')
  const deliveredQuery = query(ordersRef, where('sellerId', '==', sellerId), where('status', '==', 'delivered'));
  const deliveredSnap = await getCountFromServer(deliveredQuery);
  const deliveredOrders = deliveredSnap.data().count;

  // 2. Campanhas ativas (status 'open') e encerradas (status 'closed')
  const campaignsRef = collection(db, 'campaigns');
  const openCampaignsQuery = query(campaignsRef, where('sellerId', '==', sellerId), where('status', '==', 'open'));
  const openCampaignsSnap = await getCountFromServer(openCampaignsQuery);
  const openCampaigns = openCampaignsSnap.data().count;

  const closedCampaignsQuery = query(campaignsRef, where('sellerId', '==', sellerId), where('status', '==', 'closed'));
  const closedCampaignsSnap = await getCountFromServer(closedCampaignsQuery);
  const closedCampaigns = closedCampaignsSnap.data().count;

  // 3. Clientes: contar documentos em clientProfiles
  const profilesRef = collection(db, 'clientProfiles');
  const profilesQuery = query(profilesRef, where('sellerId', '==', sellerId));
  const profilesSnap = await getCountFromServer(profilesQuery);
  const totalClients = profilesSnap.data().count;

  // 4. Financeiro: valor vendido (soma totalAmount), valor pendente (soma remainingAmount), lucro (soma totalAmount - custos)
  // Para evitar muitas leituras, faremos uma única consulta de todos os pedidos e calcularemos no cliente.
  // No MVP isso é aceitável. Se houver muitos pedidos, implemente paginação futuramente.
  const allOrdersSnapshot = await getDocs(query(ordersRef, where('sellerId', '==', sellerId)));
  let totalSold = 0;
  let totalPending = 0;
  let totalCost = 0;
  const campaignCosts = {}; // cache para custos de campanha

  // Primeiro, coletar os custos das campanhas
  const campaignsSnapshot = await getDocs(query(campaignsRef, where('sellerId', '==', sellerId)));
  campaignsSnapshot.forEach(doc => {
    campaignCosts[doc.id] = doc.data().cost || 0;
  });

  allOrdersSnapshot.forEach(doc => {
    const order = doc.data();
    totalSold += order.totalAmount || 0;
    totalPending += order.remainingAmount || 0;
    // Custo: usar o cost da campanha (multiplicar pela quantidade? Assumindo 1 por enquanto)
    const campaignId = order.campaignId;
    if (campaignId && campaignCosts[campaignId]) {
      totalCost += campaignCosts[campaignId];
    }
  });

  const profit = totalSold - totalCost;

  return {
    totalOrders,
    paidOrders,
    pendingOrders,
    productionOrders,
    deliveredOrders,
    openCampaigns,
    closedCampaigns,
    totalClients,
    totalSold,
    totalPending,
    profit
  };
}

function renderDashboard(data) {
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="dashboard">
      <h1 class="page-title">Dashboard</h1>
      <div class="dashboard-grid">
        <div class="card card-stat">
          <div class="stat-icon">📋</div>
          <div class="stat-info">
            <div class="stat-value">${data.totalOrders}</div>
            <div class="stat-label">Pedidos Totais</div>
          </div>
        </div>
        <div class="card card-stat">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <div class="stat-value">${data.paidOrders}</div>
            <div class="stat-label">Pedidos Pagos</div>
          </div>
        </div>
        <div class="card card-stat">
          <div class="stat-icon">⏳</div>
          <div class="stat-info">
            <div class="stat-value">${data.pendingOrders}</div>
            <div class="stat-label">Pendentes</div>
          </div>
        </div>
        <div class="card card-stat">
          <div class="stat-icon">🏭</div>
          <div class="stat-info">
            <div class="stat-value">${data.productionOrders}</div>
            <div class="stat-label">Em Produção</div>
          </div>
        </div>
        <div class="card card-stat">
          <div class="stat-icon">📦</div>
          <div class="stat-info">
            <div class="stat-value">${data.deliveredOrders}</div>
            <div class="stat-label">Entregues</div>
          </div>
        </div>
        <div class="card card-stat">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <div class="stat-value">${data.totalClients}</div>
            <div class="stat-label">Clientes</div>
          </div>
        </div>
        <div class="card card-stat">
          <div class="stat-icon">📢</div>
          <div class="stat-info">
            <div class="stat-value">${data.openCampaigns}</div>
            <div class="stat-label">Campanhas Ativas</div>
          </div>
        </div>
        <div class="card card-stat">
          <div class="stat-icon">🔒</div>
          <div class="stat-info">
            <div class="stat-value">${data.closedCampaigns}</div>
            <div class="stat-label">Campanhas Encerradas</div>
          </div>
        </div>
        <div class="card card-stat">
          <div class="stat-icon">💰</div>
          <div class="stat-info">
            <div class="stat-value">${formatCurrency(data.totalSold)}</div>
            <div class="stat-label">Valor Vendido</div>
          </div>
        </div>
        <div class="card card-stat">
          <div class="stat-icon">📈</div>
          <div class="stat-info">
            <div class="stat-value">${formatCurrency(data.profit)}</div>
            <div class="stat-label">Lucro</div>
          </div>
        </div>
        <div class="card card-stat">
          <div class="stat-icon">💳</div>
          <div class="stat-info">
            <div class="stat-value">${formatCurrency(data.totalPending)}</div>
            <div class="stat-label">Valor Pendente</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
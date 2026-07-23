import { getClientOrders } from '../../firebase/firestore.js';
import { router } from '../../router.js';
import { Loader } from '../../components/Loader.js';

export async function ClientDashboardPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const orders = await getClientOrders();
    renderDashboard(orders);
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error-message">Erro ao carregar pedidos.</div>';
  }
}

function renderDashboard(orders) {
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="client-dashboard">
      <h1 class="page-title">Meus Pedidos</h1>
      ${orders.length === 0 ? 
        '<div class="empty-state">Você ainda não fez nenhum pedido. <a href="#/client/campaigns">Ver campanhas</a></div>' :
        `<div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Data</th>
                <th>Valor</th>
                <th>Pago</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(o => `
                <tr>
                  <td>${esc(o.campaignTitle)}</td>
                  <td>${fmtDate(o.createdAt)}</td>
                  <td>${curr(o.totalAmount)}</td>
                  <td>${curr(o.paidAmount || 0)}</td>
                  <td><span class="badge badge-${o.status}">${statusLabel(o.status)}</span></td>
                  <td>
                    <button class="btn btn-sm btn-outline view-order" data-id="${o.id}">Ver</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`
      }
    </div>
  `;

  document.querySelectorAll('.view-order').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(`/client/orders/${btn.dataset.id}`));
  });
}

// Helpers (reutilizados)
const statusLabel = s => ({
  awaiting_payment:'Aguardando pagamento', partial_payment:'Pagamento parcial', paid:'Pago',
  sent_to_factory:'Enviado p/ fábrica', in_production:'Em produção',
  production_completed:'Produção concluída', in_transit:'Em transporte',
  available_for_pickup:'Disponível p/ retirada', delivered:'Entregue', cancelled:'Cancelado'
}[s] || s);
const fmtDate = d => d ? new Date(d).toLocaleString('pt-BR') : '-';
const curr = v => v ? Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '-';
const esc = t => String(t).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
import { exportOrdersData, getCampaigns } from '../../firebase/firestore.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';
import { store } from '../../store.js';

export async function ExportsPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  try {
    const campaigns = await getCampaigns();
    renderExportPage(campaigns);
  } catch (err) {
    content.innerHTML = '<div class="error-message">Erro ao carregar campanhas.</div>';
  }
}

function renderExportPage(campaigns) {
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="exports-page">
      <h1>Exportar Pedidos</h1>
      <div class="card">
        <div class="filters-bar">
          <div class="form-group">
            <label>Campanha</label>
            <select id="export-campaign" class="form-select">
              <option value="">Todas</option>
              ${campaigns.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select id="export-status" class="form-select">
              <option value="">Todos</option>
              <option value="awaiting_payment">Aguardando pagamento</option>
              <option value="paid">Pago</option>
              <option value="in_production">Em produção</option>
              <option value="delivered">Entregue</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <button id="btn-export" class="btn btn-primary">📥 Exportar CSV</button>
        </div>
      </div>
      <div id="export-preview" class="card" style="overflow-x:auto;"></div>
    </div>
  `;

  document.getElementById('btn-export').addEventListener('click', async () => {
    const campaignId = document.getElementById('export-campaign').value;
    const status = document.getElementById('export-status').value;
    try {
      const orders = await exportOrdersData({ campaignId: campaignId || undefined, status: status || undefined });
      if (!orders.length) {
        showToast('Nenhum pedido encontrado.', 'warning');
        return;
      }
      const csv = generateCSV(orders);
      downloadCSV(csv, `pedidos_${new Date().toISOString().slice(0,10)}.csv`);
      showToast(`Exportados ${orders.length} pedidos.`, 'success');
      renderPreview(orders);
    } catch (err) {
      console.error(err);
      showToast('Erro ao exportar.', 'error');
    }
  });
}

function generateCSV(orders) {
  // Cabeçalho
  const headers = ['ID Pedido','Cliente','Email','Telefone','Campanha','Quantidade','Valor Total','Pago','Restante','Status','Data','Campos Personalizados','Observações'];
  const rows = orders.map(o => {
    const customFields = o.items?.[0]?.fields?.map(f => `${f.label}: ${f.value}`).join('; ') || '';
    return [
      o.id.substring(0,6),
      escapeCSV(o.clientName || ''),
      escapeCSV(o.clientEmail || ''),
      escapeCSV(o.clientPhone || ''),
      escapeCSV(o.campaignTitle || ''),
      o.quantity || 1,
      o.totalAmount,
      o.paidAmount || 0,
      o.remainingAmount || 0,
      statusLabel(o.status),
      formatDate(o.createdAt),
      escapeCSV(customFields),
      escapeCSV(o.notes || '')
    ];
  });
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  return '\uFEFF' + csvContent; // BOM para acentos
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function renderPreview(orders) {
  const preview = document.getElementById('export-preview');
  // Resumo
  const totalCount = orders.length;
  const totalValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalPaid = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  preview.innerHTML = `
    <h3>Resumo</h3>
    <p>Total de pedidos: ${totalCount} | Valor total: ${formatCurrency(totalValue)} | Pago: ${formatCurrency(totalPaid)}</p>
  `;
}

const statusLabel = s => ({
  awaiting_payment:'Aguardando pagamento', partial_payment:'Pagamento parcial', paid:'Pago',
  sent_to_factory:'Enviado p/ fábrica', in_production:'Em produção',
  production_completed:'Produção concluída', in_transit:'Em transporte',
  available_for_pickup:'Disponível p/ retirada', delivered:'Entregue', cancelled:'Cancelado'
}[s] || s);
const formatCurrency = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const formatDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const esc = t => String(t).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
const escapeCSV = v => `"${String(v).replace(/"/g, '""')}"`;
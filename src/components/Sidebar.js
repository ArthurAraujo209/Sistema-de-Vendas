import { store } from '../store.js';
import { router } from '../router.js';
import { eventBus } from '../eventBus.js';

const sellerLinks = [
  { path: '/seller/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/seller/campaigns', icon: '📢', label: 'Campanhas' },
  { path: '/seller/orders', icon: '📋', label: 'Pedidos' },
  { path: '/seller/clients', icon: '👥', label: 'Clientes' },
  { path: '/seller/exports', icon: '📥', label: 'Exportar' },
  { path: '/seller/notifications', icon: '🔔', label: 'Notificações' }
];

const clientLinks = [
  { path: '/client/dashboard', icon: '🏠', label: 'Início' },
  { path: '/client/campaigns', icon: '🛍️', label: 'Campanhas' }
];

export function Sidebar() {
  const user = store.get('currentUser');
  const collapsed = store.get('sidebarCollapsed');
  const role = user?.role || 'client';
  const links = role === 'seller' ? sellerLinks : clientLinks;
  const currentPath = router.getCurrentPath();

  const nav = document.createElement('nav');
  nav.className = `sidebar ${collapsed ? 'collapsed' : ''}`;
  nav.innerHTML = `
    <ul class="nav-list">
      ${links.map(link => `
        <li class="nav-item">
          <a href="#${link.path}" class="nav-link ${currentPath === link.path ? 'active' : ''}" data-path="${link.path}">
            <span class="nav-icon">${link.icon}</span>
            <span class="nav-label">${link.label}</span>
          </a>
        </li>
      `).join('')}
    </ul>
  `;

  nav.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-link');
    if (link) {
      e.preventDefault();
      router.navigate(link.dataset.path);
    }
  });

  eventBus.on('stateChange', (changes) => {
    if ('sidebarCollapsed' in changes) {
      nav.classList.toggle('collapsed', changes.sidebarCollapsed);
    }
    if ('currentUser' in changes) {
      // Recriar sidebar se necessário, mas por simplicidade o layout será recriado ao mudar de usuário
    }
  });

  return nav;
}
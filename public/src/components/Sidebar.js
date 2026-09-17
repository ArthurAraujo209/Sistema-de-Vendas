import { store } from '../store.js';
import { router } from '../router.js';
import { eventBus } from '../eventBus.js';
import { icon } from './icons.js';

const sellerLinks = [
  { path: '/seller/dashboard', icon: icon('dashboard'), label: 'Dashboard' },
  { path: '/seller/campaigns', icon: icon('campaign'), label: 'Campanhas' },
  { path: '/seller/orders', icon: icon('orders'), label: 'Pedidos' },
  { path: '/seller/clients', icon: icon('clients'), label: 'Clientes' },
  { path: '/seller/exports', icon: icon('download'), label: 'Exportar' },
  { path: '/seller/notifications', icon: icon('bell'), label: 'Notificações' },
  { path: '/seller/settings', icon: icon('settings'), label: 'Configurações' }
];

const clientLinks = [
  { path: '/client/explore', icon: icon('search'), label: 'Descobrir' },
  { path: '/client/dashboard', icon: icon('orders'), label: 'Meus Pedidos' },
  { path: '/client/profile', icon: icon('user'), label: 'Perfil' }
];

const adminLinks = [
  { path: '/admin/dashboard', icon: icon('shield'), label: 'Dashboard' },
  { path: '/admin/sellers', icon: icon('store'), label: 'Vendedores' },
  { path: '/admin/applications', icon: icon('clipboard'), label: 'Solicitações' }
];

export function Sidebar() {
  const user = store.get('currentUser');
  const collapsed = store.get('sidebarCollapsed');
  const role = user?.role || 'client';
  const links = role === 'admin' ? adminLinks : (role === 'seller' ? sellerLinks : clientLinks);
  const currentPath = router.getCurrentPath();

  const nav = document.createElement('nav');
  nav.className = `sidebar ${collapsed ? 'collapsed' : ''}`;
  nav.innerHTML = `
    <div class="sidebar-brand">
      <img src="src/assets/logo.svg" alt="Logo" class="brand-logo"
           onerror="this.outerHTML='<span class=&quot;brand-text&quot;>Encomendas</span>'">
    </div>
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
      if (window.innerWidth <= 768) store.set('sidebarCollapsed', true);
    }
  });

  let overlay = null;
  const updateOverlay = (isOpen) => {
    if (window.innerWidth <= 768) {
      if (isOpen && !overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', () => store.set('sidebarCollapsed', true));
      } else if (!isOpen && overlay) {
        overlay.remove();
        overlay = null;
      }
    }
  };

  updateOverlay(!collapsed);

  eventBus.on('stateChange', (changes) => {
    if ('sidebarCollapsed' in changes) {
      nav.classList.toggle('collapsed', changes.sidebarCollapsed);
      updateOverlay(!changes.sidebarCollapsed);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && overlay) { overlay.remove(); overlay = null; }
    else if (window.innerWidth <= 768 && !store.get('sidebarCollapsed')) updateOverlay(true);
  });

  return nav;
}
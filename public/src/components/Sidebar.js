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
  { path: '/client/dashboard', icon: icon('home'), label: 'Início' },
  { path: '/client/campaigns', icon: icon('shop'), label: 'Campanhas' },
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
      <div class="brand-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
      </div>
      <span class="brand-text">Encomendas</span>
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
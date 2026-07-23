import { store } from '../store.js';
import { router } from '../router.js';
import { eventBus } from '../eventBus.js';

const sellerLinks = [
  { path: '/seller/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/seller/campaigns', icon: '📢', label: 'Campanhas' },
  { path: '/seller/orders', icon: '📋', label: 'Pedidos' },
  { path: '/seller/clients', icon: '👥', label: 'Clientes' },
  { path: '/seller/exports', icon: '📥', label: 'Exportar' },
  { path: '/seller/notifications', icon: '🔔', label: 'Notificações' },
  { path: '/seller/settings', icon: '⚙️', label: 'Configurações' }
];

const clientLinks = [
  { path: '/client/dashboard', icon: '🏠', label: 'Início' },
  { path: '/client/campaigns', icon: '🛍️', label: 'Campanhas' },
  { path: '/client/profile', icon: '👤', label: 'Perfil' }
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

  // Navegação: ao clicar em um link, fecha a sidebar em mobile
  nav.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-link');
    if (link) {
      e.preventDefault();
      router.navigate(link.dataset.path);
      if (window.innerWidth <= 768) {
        store.set('sidebarCollapsed', true);
      }
    }
  });

  // Controle do overlay mobile
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

  // Estado inicial
  updateOverlay(!collapsed);

  // Reage a mudanças de estado (ex: clique no toggle do header)
  eventBus.on('stateChange', (changes) => {
    if ('sidebarCollapsed' in changes) {
      nav.classList.toggle('collapsed', changes.sidebarCollapsed);
      updateOverlay(!changes.sidebarCollapsed);
    }
  });

  // Se redimensionar a janela para desktop, remove overlay
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && overlay) {
      overlay.remove();
      overlay = null;
    } else if (window.innerWidth <= 768 && !store.get('sidebarCollapsed')) {
      updateOverlay(true);
    }
  });

  return nav;
}
import { store } from '../store.js';
import { logout } from '../firebase/auth.js';
import { getUnreadNotificationCount } from '../firebase/firestore.js';
import { router } from '../router.js';
import { eventBus } from '../eventBus.js';

export function Header() {
  const user = store.get('currentUser');
  const theme = store.get('theme');

  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <div class="header-left">
      <button class="btn-icon sidebar-toggle" title="Menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
      <h1 class="logo-text">Encomendas</h1>
    </div>
    <div class="header-right">
      ${user?.role === 'seller' ? `
        <button class="btn-icon notification-bell" id="notification-bell" title="Notificações">
          <span style="font-size:1.2rem;">🔔</span>
          <span id="notif-badge" class="notif-badge" style="display:none;">0</span>
        </button>
      ` : ''}
      <button class="btn-icon theme-toggle" title="Alternar tema">
        <span class="theme-icon">${theme === 'dark' ? '☀️' : '🌙'}</span>
      </button>
      <div class="user-menu">
        <span class="user-name">${user?.displayName || user?.email}</span>
        <button class="btn btn-sm btn-outline" id="logout-btn">Sair</button>
      </div>
    </div>
  `;

  header.querySelector('.sidebar-toggle').addEventListener('click', () => {
    store.set('sidebarCollapsed', !store.get('sidebarCollapsed'));
  });

  header.querySelector('.theme-toggle').addEventListener('click', () => {
    const newTheme = store.get('theme') === 'dark' ? 'light' : 'dark';
    store.set('theme', newTheme);
    localStorage.setItem('theme', newTheme);
    header.querySelector('.theme-icon').textContent = newTheme === 'dark' ? '☀️' : '🌙';
    document.documentElement.setAttribute('data-theme', newTheme);
  });

  header.querySelector('#logout-btn').addEventListener('click', async () => await logout());

  // Atualizar contagem de notificações
  if (user?.role === 'seller') {
    updateNotificationBadge(user.uid);
    eventBus.on('notificationsChanged', () => updateNotificationBadge(user.uid));
  }

  const notifBell = header.querySelector('#notification-bell');
  if (notifBell) {
    notifBell.addEventListener('click', () => router.navigate('/seller/notifications'));
  }

  return header;
}

async function updateNotificationBadge(uid) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  try {
    const count = await getUnreadNotificationCount(uid);
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  } catch (err) {
    console.error('Erro ao buscar notificações', err);
  }
}
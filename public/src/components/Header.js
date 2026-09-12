import { store } from '../store.js';
import { logout } from '../firebase/auth.js';
import { getUnreadNotificationCount } from '../firebase/firestore.js';
import { router } from '../router.js';
import { icon } from './icons.js';

// Guarda o unsubscribe atual para não acumular listeners entre re-renders.
let notifUnsubscribe = null;
let notifBadgeUpdater = null;

export function Header() {
  const user = store.get('currentUser');
  const theme = store.get('theme');

  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <div class="header-left">
      <button class="btn-icon sidebar-toggle" title="Menu" aria-label="Abrir menu">${icon('menu')}</button>
      <h1 class="logo-text">Encomendas</h1>
    </div>
    <div class="header-right">
      ${user?.role === 'seller' ? `
        <button class="btn-icon notification-bell" id="notification-bell" title="Notificações" aria-label="Notificações">
          ${icon('bell')}
          <span id="notif-badge" class="notif-badge" style="display:none;">0</span>
        </button>` : ''}
      <button class="btn-icon theme-toggle" title="Alternar tema" aria-label="Alternar tema">
        ${theme === 'dark' ? icon('sun') : icon('moon')}
      </button>
      <div class="user-menu">
        <span class="user-name">${esc(user?.displayName || user?.email || '')}</span>
        <button class="btn btn-sm btn-outline" id="logout-btn">Sair</button>
      </div>
    </div>`;

  header.querySelector('.sidebar-toggle').addEventListener('click', () => {
    store.set('sidebarCollapsed', !store.get('sidebarCollapsed'));
  });

  header.querySelector('.theme-toggle').addEventListener('click', () => {
    const newTheme = store.get('theme') === 'dark' ? 'light' : 'dark';
    store.set('theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    header.querySelector('.theme-toggle').innerHTML = newTheme === 'dark' ? icon('sun') : icon('moon');
  });

  header.querySelector('#logout-btn').addEventListener('click', async () => {
    // Limpa listener antes de deslogar para evitar callbacks pendentes
    if (notifUnsubscribe) { notifUnsubscribe(); notifUnsubscribe = null; }
    notifBadgeUpdater = null;
    await logout();
  });

  // Notificações — registra UMA única vez por sessão, mesmo que Header() seja chamado N vezes.
  const notifBell = header.querySelector('#notification-bell');
  if (notifBell && user?.role === 'seller') {
    notifBadgeUpdater = () => updateNotificationBadge(user.uid);
    notifBadgeUpdater();
    if (!notifUnsubscribe) {
      // Assina o evento uma vez. O callback sempre lê o uid atualizado.
      const { eventBus } = window.__eventBusRef || {};
      // Usamos import dinâmico para evitar ciclo:
      import('../eventBus.js').then(({ eventBus }) => {
        const handler = () => notifBadgeUpdater && notifBadgeUpdater();
        eventBus.on('notificationsChanged', handler);
        notifUnsubscribe = () => eventBus.off('notificationsChanged', handler);
      });
    }
    notifBell.addEventListener('click', () => router.navigate('/seller/notifications'));
  }

  return header;
}

async function updateNotificationBadge(uid) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  try {
    const count = await getUnreadNotificationCount(uid);
    if (!badge.isConnected) return;
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  } catch (err) {
    console.warn('[notif badge]', err?.code || err?.message);
  }
}

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
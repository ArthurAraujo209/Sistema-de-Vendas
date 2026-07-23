import { getNotifications, markNotificationRead } from '../../firebase/firestore.js';
import { store } from '../../store.js';
import { router } from '../../router.js';
import { eventBus } from '../../eventBus.js';
import { Loader } from '../../components/Loader.js';

export async function NotificationsPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `<div class="loader-container">${Loader()}</div>`;

  const uid = store.get('currentUser').uid;
  try {
    const notifs = await getNotifications(uid);
    renderNotifications(notifs);
  } catch (err) {
    content.innerHTML = '<div class="error-message">Erro ao carregar notificações.</div>';
  }
}

function renderNotifications(notifs) {
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="notifications-page">
      <h1>Notificações</h1>
      ${notifs.length === 0 ? '<p class="text-muted">Nenhuma notificação.</p>' : `
        <ul class="notif-list">
          ${notifs.map(n => `
            <li class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
              <div class="notif-content">
                <strong>${esc(n.title)}</strong>
                <p>${esc(n.message)}</p>
                <small>${formatDate(n.createdAt)}</small>
              </div>
              ${!n.read ? '<span class="unread-dot"></span>' : ''}
            </li>
          `).join('')}
        </ul>
      `}
    </div>
  `;

  // Marcar como lida ao clicar e redirecionar se houver link
  document.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', async () => {
      const notifId = item.dataset.id;
      await markNotificationRead(store.get('currentUser').uid, notifId);
      eventBus.emit('notificationsChanged');
      const notif = notifs.find(n => n.id === notifId);
      if (notif?.link) router.navigate(notif.link);
      else router.navigate('/seller/notifications'); // recarregar para atualizar visual
    });
  });
}

const formatDate = d => d ? new Date(d).toLocaleString('pt-BR') : '-';
const esc = t => String(t).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
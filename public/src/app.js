import { router } from './router.js';
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { observeAuthState, getUserProfile } from './firebase/auth.js';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/auth/Login.js';
import { RegisterPage } from './pages/auth/Register.js';
import { DashboardPage } from './pages/seller/Dashboard.js';
import { CampaignsPage } from './pages/seller/Campaigns.js';
import { CampaignDetailPage } from './pages/seller/CampaignDetail.js';
import { OrdersPage } from './pages/seller/Orders.js';
import { OrderDetailPage } from './pages/seller/OrderDetail.js';
import { ClientsPage } from './pages/seller/Clients.js';
import { ExportsPage } from './pages/seller/Exports.js';
import { NotificationsPage } from './pages/seller/Notifications.js';
import { SettingsPage } from './pages/seller/Settings.js';
import { ClientDashboardPage } from './pages/client/Dashboard.js';
import { ClientCampaignsPage } from './pages/client/Campaigns.js';
import { ClientCampaignDetailPage } from './pages/client/CampaignDetail.js';
import { CampaignOrderPage } from './pages/client/CampaignOrder.js';
import { ClientOrderDetailPage } from './pages/client/OrderDetail.js';
import { ClientProfilePage } from './pages/client/Profile.js';
import { Loader } from './components/Loader.js';
import { AdminDashboardPage } from './pages/admin/Dashboard.js';
import { AdminSellersPage } from './pages/admin/Sellers.js';
import { AdminApplicationsPage } from './pages/admin/Applications.js';
import { SellerRequestPage } from './pages/auth/SellerRequest.js';

// Rotas (mantidas exatamente como antes)
router.addRoute('/login', () => LoginPage(), { public: true });
router.addRoute('/register', () => RegisterPage(), { public: true });
router.addRoute('/seller/dashboard', () => DashboardPage(), { role: 'seller' });
router.addRoute('/seller/campaigns', () => CampaignsPage(), { role: 'seller' });
router.addRoute('/seller/campaigns/:id', (params) => CampaignDetailPage(params), { role: 'seller' });
router.addRoute('/seller/orders', () => OrdersPage(), { role: 'seller' });
router.addRoute('/seller/orders/new', () => OrderDetailPage({ id: 'new' }), { role: 'seller' });
router.addRoute('/seller/orders/:id', (params) => OrderDetailPage(params), { role: 'seller' });
router.addRoute('/seller/clients', () => ClientsPage(), { role: 'seller' });
router.addRoute('/seller/exports', () => ExportsPage(), { role: 'seller' });
router.addRoute('/seller/notifications', () => NotificationsPage(), { role: 'seller' });
router.addRoute('/seller/settings', () => SettingsPage(), { role: 'seller' });
router.addRoute('/seller-request', () => SellerRequestPage(), { public: true });
router.addRoute('/client/dashboard', () => ClientDashboardPage(), { role: 'client' });
router.addRoute('/client/campaigns/:campaignId/order', (params) => CampaignOrderPage(params), { role: 'client' });
router.addRoute('/client/campaigns/:id', (params) => ClientCampaignDetailPage(params), { role: 'client' });
router.addRoute('/client/campaigns', () => ClientCampaignsPage(), { role: 'client' });
router.addRoute('/client/orders/:id', (params) => ClientOrderDetailPage(params), { role: 'client' });
router.addRoute('/client/profile', () => ClientProfilePage(), { role: 'client' });
router.addRoute('/admin/dashboard', () => AdminDashboardPage(), { role: 'admin' });
router.addRoute('/admin/sellers', () => AdminSellersPage(), { role: 'admin' });
router.addRoute('/admin/applications', () => AdminApplicationsPage(), { role: 'admin' });

router.beforeNavigate(async (path) => {
  const user = store.get('currentUser');
  const publicRoutes = ['/login', '/register', '/seller-request'];
  if (path.startsWith('/admin') && user.role !== 'admin') return '/login';
  if (publicRoutes.includes(path)) {
    if (user) {
      return user.role === 'seller' ? '/seller/dashboard' : '/client/dashboard';
    }
    return;
  }
  if (!user) return '/login';
  if (path.startsWith('/seller') && user.role !== 'seller') return '/client/dashboard';
  if (path.startsWith('/client') && user.role !== 'client') return '/seller/dashboard';
});

router.addRoute('/', async () => {
  const user = store.get('currentUser');
  if (user) router.navigate(user.role === 'seller' ? '/seller/dashboard' : '/client/dashboard');
  else router.navigate('/login');
});

async function init() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="full-loader">${Loader('large')}</div>`;

  observeAuthState(async (firebaseUser) => {
  const currentPath = router.getCurrentPath();
  const isPublic = ['/login', '/register'].includes(currentPath);

  if (firebaseUser) {
    const profile = await getUserProfile(firebaseUser.uid);
    store.update({
      currentUser: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        role: profile?.role || 'client'
      },
      userProfile: profile
    });
  } else {
    store.update({ currentUser: null, userProfile: null });
  }

  // 1️⃣ Remove todo o conteúdo antigo do #app (sidebar, header, loader, etc.)
  const app = document.getElementById('app');
  while (app.firstChild) {
    app.removeChild(app.firstChild);
  }

  // 2️⃣ Recria a estrutura correta de acordo com o estado
  if (firebaseUser) {
    // Remove estilo inline que possa ter sido colocado por estado deslogado
    app.removeAttribute('style');
    // Monta layout completo (sidebar, header, app-content)
    Layout();
  } else {
    // Estado não autenticado: apenas um container centralizado
    app.style.display = 'block';
    const appContent = document.createElement('div');
    appContent.id = 'app-content';
    app.appendChild(appContent);
  }

  // 3️⃣ Garante que a rota seja resolvida após a criação do container
  requestAnimationFrame(() => router.resolve());
});
}

document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'light');
eventBus.on('stateChange', (changes) => {
  if ('theme' in changes) {
    document.documentElement.setAttribute('data-theme', changes.theme);
    localStorage.setItem('theme', changes.theme);
  }
});

init();
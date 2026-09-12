import { router } from './router.js';
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { observeAuthState, getUserProfile, resolveGoogleRedirect, applyAuthPersistence } from './firebase/auth.js';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/auth/Login.js';
import { RegisterPage } from './pages/auth/Register.js';
import { ForgotPasswordPage } from './pages/auth/ForgotPassword.js';
import { DashboardPage } from './pages/seller/Dashboard.js';
import { CampaignsPage } from './pages/seller/Campaigns.js';
import { CampaignDetailPage } from './pages/seller/CampaignDetail.js';
import { OrdersPage } from './pages/seller/Orders.js';
import { OrderDetailPage } from './pages/seller/OrderDetail.js';
import { ClientsPage } from './pages/seller/Clients.js';
import { ExportsPage } from './pages/seller/Exports.js';
import { NotificationsPage } from './pages/seller/Notifications.js';
import { ClientDashboardPage } from './pages/client/Dashboard.js';
import { ClientCampaignsPage } from './pages/client/Campaigns.js';
import { ClientCampaignDetailPage } from './pages/client/CampaignDetail.js';
import { CampaignOrderPage } from './pages/client/CampaignOrder.js';
import { ClientOrderDetailPage } from './pages/client/OrderDetail.js';
import { ClientExplorePage } from './pages/client/Explore.js';
import { ClientStoreDetailPage } from './pages/client/StoreDetail.js';
import { ProfilePage } from './pages/Profile.js';
import { AdminDashboardPage } from './pages/admin/Dashboard.js';
import { AdminSellersPage } from './pages/admin/Sellers.js';
import { AdminApplicationsPage } from './pages/admin/Applications.js';
import { SellerRequestPage } from './pages/auth/SellerRequest.js';
import { NotFoundPage } from './pages/NotFound.js';
import { Loader } from './components/Loader.js';
import { showToast } from './components/Toast.js';

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/seller-request'];

// ===== Públicas =====
router.addRoute('/login', () => LoginPage(), { public: true });
router.addRoute('/register', () => RegisterPage(), { public: true });
router.addRoute('/forgot-password', () => ForgotPasswordPage(), { public: true });
router.addRoute('/seller-request', () => SellerRequestPage(), { public: true });

// ===== Vendedor =====
router.addRoute('/seller/dashboard', () => DashboardPage(), { role: 'seller' });
router.addRoute('/seller/campaigns', () => CampaignsPage(), { role: 'seller' });
router.addRoute('/seller/campaigns/:id', (p) => CampaignDetailPage(p), { role: 'seller' });
router.addRoute('/seller/orders', () => OrdersPage(), { role: 'seller' });
router.addRoute('/seller/orders/new', () => OrderDetailPage({ id: 'new' }), { role: 'seller' });
router.addRoute('/seller/orders/:id', (p) => OrderDetailPage(p), { role: 'seller' });
router.addRoute('/seller/clients', () => ClientsPage(), { role: 'seller' });
router.addRoute('/seller/exports', () => ExportsPage(), { role: 'seller' });
router.addRoute('/seller/notifications', () => NotificationsPage(), { role: 'seller' });
router.addRoute('/seller/settings', () => ProfilePage(), { role: 'seller' });

// ===== Cliente =====
router.addRoute('/client/explore', () => ClientExplorePage(), { role: 'client' });
router.addRoute('/client/stores/:id', (p) => ClientStoreDetailPage(p), { role: 'client' });
router.addRoute('/client/dashboard', () => ClientDashboardPage(), { role: 'client' });
router.addRoute('/client/campaigns/:campaignId/order', (p) => CampaignOrderPage(p), { role: 'client' });
router.addRoute('/client/campaigns/:id', (p) => ClientCampaignDetailPage(p), { role: 'client' });
router.addRoute('/client/campaigns', () => ClientCampaignsPage(), { role: 'client' });
router.addRoute('/client/orders/:id', (p) => ClientOrderDetailPage(p), { role: 'client' });
router.addRoute('/client/profile', () => ProfilePage(), { role: 'client' });

// ===== Admin =====
router.addRoute('/admin/dashboard', () => AdminDashboardPage(), { role: 'admin' });
router.addRoute('/admin/sellers', () => AdminSellersPage(), { role: 'admin' });
router.addRoute('/admin/applications', () => AdminApplicationsPage(), { role: 'admin' });
router.addRoute('/admin/profile', () => ProfilePage(), { role: 'admin' });

// ===== Raiz =====
router.addRoute('/', () => {
  const user = store.get('currentUser');
  if (!user) return router.navigate('/login');
  if (user.role === 'admin') router.navigate('/admin/dashboard');
  else router.navigate(user.role === 'seller' ? '/seller/dashboard' : '/client/explore');
});

router.addRoute('/:path*', () => NotFoundPage());

// ===== Guarda =====
router.beforeNavigate(async (path) => {
  const user = store.get('currentUser');
  const isPublic = PUBLIC_ROUTES.includes(path);

  if (isPublic) {
    if (user) {
      if (user.role === 'admin') return '/admin/dashboard';
      return user.role === 'seller' ? '/seller/dashboard' : '/client/explore';
    }
    return;
  }

  if (!user) return '/login';

  if (path.startsWith('/admin') && user.role !== 'admin') return '/login';
  if (path.startsWith('/seller') && user.role !== 'seller') {
    return user.role === 'admin' ? '/admin/dashboard' : '/client/explore';
  }
  if (path.startsWith('/client') && user.role !== 'client') {
    return user.role === 'admin' ? '/admin/dashboard' : '/seller/dashboard';
  }
});

// ===== Init =====
async function init() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="full-loader">${Loader('large')}</div>`;

  await applyAuthPersistence();
  await resolveGoogleRedirect();

  observeAuthState(async (firebaseUser) => {
    if (firebaseUser) {
      let profile = null;
      try {
        profile = await getUserProfile(firebaseUser.uid);
      } catch (err) {
        console.error('[init profile]', err?.code || err?.message);
      }

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

    const root = document.getElementById('app');
    while (root.firstChild) root.removeChild(root.firstChild);

    if (firebaseUser) {
      root.removeAttribute('style');
      Layout();
    } else {
      root.style.display = 'block';
      const c = document.createElement('div');
      c.id = 'app-content';
      root.appendChild(c);
    }

    requestAnimationFrame(() => router.resolve());

    // Redireciona para completar perfil se necessário.
    // Usa o flag profileCompleted gravado no doc do usuário.
    if (firebaseUser) {
      const prof = store.get('userProfile');
      if (prof && prof.role !== 'admin') {
        const profilePath = prof.role === 'seller' ? '/seller/settings' : '/client/profile';
        const currentPath = router.getCurrentPath();
        const needsCompletion = !prof.profileCompleted;

        if (needsCompletion && currentPath !== profilePath) {
          showToast(
            prof.phone ? 'Bem-vindo! Confira seus dados para continuar.' : 'Complete seu perfil para continuar.',
            'info'
          );
          router.navigate(profilePath);
        }
      }
    }
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
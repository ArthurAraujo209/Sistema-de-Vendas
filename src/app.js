import { router } from './router.js';
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { observeAuthState, getUserProfile } from './firebase/auth.js';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/auth/Login.js';
import { RegisterPage } from './pages/auth/Register.js';
import { Loader } from './components/Loader.js';

// Placeholders para páginas futuras (Etapas seguintes)
function placeholderPage(title) {
  return () => {
    document.getElementById('app-content').innerHTML = `<div class="page-placeholder"><h2>${title}</h2><p>Em desenvolvimento...</p></div>`;
  };
}

// Configuração de rotas
router.addRoute('/login', () => LoginPage(), { public: true });
router.addRoute('/register', () => RegisterPage(), { public: true });

// Rotas do vendedor (temporariamente placeholders)
router.addRoute('/seller/dashboard', placeholderPage('Dashboard'), { role: 'seller' });
router.addRoute('/seller/campaigns', placeholderPage('Campanhas'), { role: 'seller' });
router.addRoute('/seller/campaigns/:id', placeholderPage('Campanha'), { role: 'seller' });
router.addRoute('/seller/orders', placeholderPage('Pedidos'), { role: 'seller' });
router.addRoute('/seller/orders/:id', placeholderPage('Pedido'), { role: 'seller' });
router.addRoute('/seller/clients', placeholderPage('Clientes'), { role: 'seller' });
router.addRoute('/seller/clients/:id', placeholderPage('Cliente'), { role: 'seller' });
router.addRoute('/seller/exports', placeholderPage('Exportar'), { role: 'seller' });
router.addRoute('/seller/notifications', placeholderPage('Notificações'), { role: 'seller' });

// Rotas do cliente
router.addRoute('/client/dashboard', placeholderPage('Meus Pedidos'), { role: 'client' });
router.addRoute('/client/campaigns', placeholderPage('Campanhas'), { role: 'client' });
router.addRoute('/client/orders/:id', placeholderPage('Pedido'), { role: 'client' });

// Guarda de navegação
router.beforeNavigate(async (path) => {
  const user = store.get('currentUser');
  const publicRoutes = ['/login', '/register'];

  if (publicRoutes.includes(path)) {
    if (user) {
      return user.role === 'seller' ? '/seller/dashboard' : '/client/dashboard';
    }
    return;
  }

  if (!user) {
    return '/login';
  }

  // Verificar role para rotas protegidas
  if (path.startsWith('/seller') && user.role !== 'seller') {
    return '/client/dashboard';
  }
  if (path.startsWith('/client') && user.role !== 'client') {
    return '/seller/dashboard';
  }
});

// Redirecionar raiz
router.addRoute('/', async () => {
  const user = store.get('currentUser');
  if (user) {
    router.navigate(user.role === 'seller' ? '/seller/dashboard' : '/client/dashboard');
  } else {
    router.navigate('/login');
  }
});

// Inicialização
async function init() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="full-loader">${Loader('large')}</div>`;

  observeAuthState(async (firebaseUser) => {
    if (firebaseUser) {
      const profile = await getUserProfile(firebaseUser.uid);
      store.update({
        currentUser: { uid: firebaseUser.uid, email: firebaseUser.email, displayName: firebaseUser.displayName, role: profile?.role || 'client' },
        userProfile: profile
      });
    } else {
      store.update({ currentUser: null, userProfile: null });
    }

    // Garantir que o layout seja montado apenas uma vez
    if (!document.querySelector('.sidebar')) {
      Layout();
    } else {
      // Atualizar sidebar e header se necessário
      const sidebar = document.querySelector('.sidebar');
      const header = document.querySelector('.app-header');
      if (sidebar) sidebar.remove();
      if (header) header.remove();
      Layout();
    }

    router.resolve();
  });
}

// Aplicar tema salvo
document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'light');

// Ouvir mudanças de tema para persistir
eventBus.on('stateChange', (changes) => {
  if ('theme' in changes) {
    document.documentElement.setAttribute('data-theme', changes.theme);
    localStorage.setItem('theme', changes.theme);
  }
});

init();
import { router } from '../router.js';
import { store } from '../store.js';

export function NotFoundPage() {
  const content = document.getElementById('app-content') || document.getElementById('app');
  const user = store.get('currentUser');

  const homePath = !user
    ? '/login'
    : user.role === 'admin'
      ? '/admin/dashboard'
      : user.role === 'seller'
        ? '/seller/dashboard'
        : '/client/dashboard';

  content.innerHTML = `
    <div class="not-found-page">
      <div class="not-found-content">
        <h1>404</h1>
        <h2>Página não encontrada</h2>
        <p>A página que você procura não existe ou foi movida.</p>
        <a href="#${homePath}" class="btn btn-primary" id="not-found-home-btn">
          Voltar ao início
        </a>
      </div>
    </div>
  `;

  document.getElementById('not-found-home-btn').addEventListener('click', (e) => {
    e.preventDefault();
    router.navigate(homePath);
  });
}
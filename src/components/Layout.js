import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';
import { store } from '../store.js';

export function Layout() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const sidebar = Sidebar();
  const header = Header();
  const main = document.createElement('main');
  main.id = 'app-content';
  main.className = 'app-content';

  app.appendChild(sidebar);
  app.appendChild(header);
  app.appendChild(main);

  // Aplicar tema inicial
  applyTheme(store.get('theme'));

  // Reagir a mudanças de tema global
  document.addEventListener('themeChange', (e) => applyTheme(e.detail));
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}
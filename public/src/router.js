import { store } from './store.js';
import { eventBus } from './eventBus.js';

class Router {
  constructor() {
    this.routes = [];
    this.guards = [];
    this.currentRoute = null;
    window.addEventListener('hashchange', () => this.resolve());
    window.addEventListener('load', () => this.resolve());
  }

  addRoute(pattern, handler, meta = {}) {
    const regex = new RegExp('^' + pattern.replace(/:\w+/g, '([\\w-]+)') + '$');
    this.routes.push({ pattern, regex, handler, meta });
    return this;
  }

  beforeNavigate(guard) {
    this.guards.push(guard);
  }

  navigate(path) {
    window.location.hash = '#' + path;
  }

  getCurrentPath() {
    return window.location.hash.slice(1) || '/';
  }

  async resolve() {
    const path = this.getCurrentPath();
    for (const guard of this.guards) {
      const result = await guard(path);
      if (result === false) return;
      if (typeof result === 'string') {
        this.navigate(result);
        return;
      }
    }

    for (const route of this.routes) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        const paramNames = (route.pattern.match(/:(\w+)/g) || []).map(p => p.slice(1));
        paramNames.forEach((name, i) => params[name] = match[i + 1]);

        this.currentRoute = { path, params, meta: route.meta };

        // Container de conteúdo: usa #app-content se existir (layout montado), senão cria um em #app
        let appContent = document.getElementById('app-content');
        if (!appContent) {
          const app = document.getElementById('app');
          appContent = document.createElement('div');
          appContent.id = 'app-content';
          app.appendChild(appContent);
        }
        appContent.innerHTML = '';
        await route.handler(params);
        return;
      }
    }

    const appContent = document.getElementById('app-content') || document.getElementById('app');
    if (appContent) {
      appContent.innerHTML = '<div class="page-404"><h2>404</h2><p>Página não encontrada</p></div>';
    }
  }
}

export const router = new Router();
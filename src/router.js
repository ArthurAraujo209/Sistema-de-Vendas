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
    this.routes.push({ pattern: new RegExp('^' + pattern.replace(/:\w+/g, '([\\w-]+)') + '$'), handler, meta });
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
      const match = path.match(route.pattern);
      if (match) {
        const params = {};
        const paramNames = (route.pattern.source.match(/:(\w+)/g) || []).map(p => p.slice(1));
        paramNames.forEach((name, i) => params[name] = match[i + 1]);
        
        this.currentRoute = { path, params, meta: route.meta };
        document.getElementById('app-content').innerHTML = '';
        await route.handler(params);
        return;
      }
    }

    document.getElementById('app-content').innerHTML = '<div class="page-404"><h2>404</h2><p>Página não encontrada</p></div>';
  }
}

export const router = new Router();
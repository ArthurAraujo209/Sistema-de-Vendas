import { eventBus } from './eventBus.js';

const initialState = {
  currentUser: null,
  userProfile: null,  // dados extras do Firestore
  theme: localStorage.getItem('theme') || 'light',
  sidebarCollapsed: false,
  loading: false,
  notifications: []
};

class Store {
  constructor() {
    this.state = new Proxy(initialState, {
      set: (target, prop, value) => {
        if (target[prop] !== value) {
          target[prop] = value;
          eventBus.emit('stateChange', { [prop]: value });
        }
        return true;
      }
    });
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
  }

  update(partial) {
    Object.entries(partial).forEach(([key, value]) => {
      this.state[key] = value;
    });
  }
}

export const store = new Store();
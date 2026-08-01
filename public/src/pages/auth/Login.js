import { login, loginWithGoogle } from '../../firebase/auth.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';
import { validateEmail } from '../../utils/validators.js';
import { icon } from '../../components/icons.js';

export function LoginPage() {
  const content = document.getElementById('app-content') || document.getElementById('app');
  content.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          <h2>Entrar</h2>
          <p>Acesse sua conta</p>
        </div>
        <form id="login-form" class="auth-form">
          <div class="form-group">
            <label for="email">E-mail</label>
            <input type="email" id="email" class="form-input" required placeholder="seu@email.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label for="password">Senha</label>
            <input type="password" id="password" class="form-input" required placeholder="Mínimo 6 caracteres" autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="login-submit">Entrar</button>
        </form>
        <div class="auth-divider"><span>ou</span></div>
        <button id="google-login-btn" class="btn btn-outline btn-block google-btn">
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continuar com Google
        </button>
        <div id="login-error" class="auth-error" style="display:none;"></div>
        <div class="auth-footer">
          Não tem conta? <a href="#/register">Cadastre-se como cliente</a><br>
          Quer vender? <a href="#/seller-request">Solicite conta de vendedor</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');
  const googleBtn = document.getElementById('google-login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!validateEmail(email)) { showError('E-mail inválido.'); return; }
    if (password.length < 6) { showError('A senha deve ter pelo menos 6 caracteres.'); return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = Loader('small');
    errorDiv.style.display = 'none';

    try {
      await login(email, password);
      showToast('Login realizado com sucesso!', 'success');
    } catch (err) {
      const messages = {
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-credential': 'Credenciais inválidas.',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.'
      };
      showError(messages[err.code] || 'Erro ao fazer login.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Entrar';
    }
  });

  googleBtn.addEventListener('click', async () => {
    googleBtn.disabled = true;
    googleBtn.innerHTML = Loader('small');
    errorDiv.style.display = 'none';
    try {
      await loginWithGoogle();
      showToast('Login realizado com sucesso!', 'success');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        showError('Erro ao fazer login com Google.');
      }
    } finally {
      googleBtn.disabled = false;
      googleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Continuar com Google`;
    }
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
    errorDiv.classList.add('shake');
    setTimeout(() => errorDiv.classList.remove('shake'), 500);
  }
}
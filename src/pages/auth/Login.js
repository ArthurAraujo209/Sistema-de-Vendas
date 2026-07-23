import { login } from '../../firebase/auth.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';
import { router } from '../../router.js';
import { store } from '../../store.js';
import { validateEmail } from '../../utils/validators.js';

export function LoginPage() {
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo">📦</div>
          <h2>Entrar</h2>
          <p>Acesse sua conta</p>
        </div>
        <form id="login-form" class="auth-form">
          <div class="form-group">
            <label for="email">E-mail</label>
            <input type="email" id="email" class="form-input" required placeholder="seu@email.com">
          </div>
          <div class="form-group">
            <label for="password">Senha</label>
            <input type="password" id="password" class="form-input" required placeholder="Mínimo 6 caracteres">
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="login-submit">Entrar</button>
        </form>
        <div id="login-error" class="auth-error" style="display:none;"></div>
        <div class="auth-footer">
          Não tem conta? <a href="#/register">Cadastre-se</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!validateEmail(email)) {
      showError('E-mail inválido.');
      return;
    }
    if (password.length < 6) {
      showError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = Loader('small');
    errorDiv.style.display = 'none';

    try {
      await login(email, password);
      showToast('Login realizado com sucesso!', 'success');
      // redirecionamento será feito pelo auth observer
    } catch (err) {
      console.error(err);
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

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
  }
}
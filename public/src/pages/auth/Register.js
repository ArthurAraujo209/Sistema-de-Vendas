import { register } from '../../firebase/auth.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';
import { router } from '../../router.js';
import { validateEmail, validatePassword } from '../../utils/validators.js';

export function RegisterPage() {
  const content = document.getElementById('app-content') || document.getElementById('app');
  content.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo">📦</div>
          <h2>Criar Conta</h2>
          <p>Escolha o tipo de conta</p>
        </div>
        <form id="register-form" class="auth-form">
          <div class="form-group">
            <label for="reg-name">Nome</label>
            <input type="text" id="reg-name" class="form-input" required placeholder="Seu nome completo">
          </div>
          <div class="form-group">
            <label for="reg-email">E-mail</label>
            <input type="email" id="reg-email" class="form-input" required placeholder="seu@email.com">
          </div>
          <div class="form-group">
            <label for="reg-phone">Telefone (WhatsApp)</label>
            <input type="tel" id="reg-phone" class="form-input" placeholder="(11) 99999-9999">
          </div>
          <div class="form-group">
            <label for="reg-password">Senha</label>
            <input type="password" id="reg-password" class="form-input" required placeholder="Mínimo 6 caracteres">
          </div>
          <div class="form-group">
            <label style="display: none;">Tipo de conta</label>
            <div class="radio-group">
              <label style="display: none;"><input type="radio" name="role" value="client" checked style="display: none;"> Cliente</label>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="register-submit">Criar Conta</button>
        </form>
        <div id="register-error" class="auth-error" style="display:none;"></div>
        <div class="auth-footer">
          Já tem conta? <a href="#/login">Entrar</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('register-form');
  const errorDiv = document.getElementById('register-error');
  const submitBtn = document.getElementById('register-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = form.querySelector('input[name="role"]:checked').value;

    if (!name) {
      showError('Informe seu nome.');
      return;
    }
    if (!validateEmail(email)) {
      showError('E-mail inválido.');
      return;
    }
    if (!validatePassword(password)) {
      showError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = Loader('small');
    errorDiv.style.display = 'none';

    try {
      await register(email, password, name, role, phone);
      showToast('Conta criada com sucesso!', 'success');
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'E-mail já cadastrado.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/weak-password': 'Senha muito fraca.'
      };
      showError(messages[err.code] || 'Erro ao criar conta.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Criar Conta';
    }
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
  }
}
import { resetPassword } from '../../firebase/auth.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';
import { validateEmail } from '../../utils/validators.js';

export function ForgotPasswordPage() {
  const content = document.getElementById('app-content') || document.getElementById('app');
  content.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <h2>Recuperar Senha</h2>
          <p>Enviaremos um link para o seu e-mail</p>
        </div>
        <form id="forgot-form" class="auth-form">
          <div class="form-group">
            <label for="forgot-email">E-mail</label>
            <input type="email" id="forgot-email" class="form-input" required
                   placeholder="seu@email.com" autocomplete="email">
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="forgot-submit">
            Enviar Link
          </button>
        </form>
        <div id="forgot-error" class="auth-error" style="display:none;"></div>
        <div id="forgot-success" class="auth-footer"
             style="display:none; color:var(--success); font-weight:600;"></div>
        <div class="auth-footer">
          Lembrou a senha? <a href="#/login">Voltar ao login</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('forgot-form');
  const errorDiv = document.getElementById('forgot-error');
  const successDiv = document.getElementById('forgot-success');
  const submitBtn = document.getElementById('forgot-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();

    if (!validateEmail(email)) {
      errorDiv.textContent = 'E-mail inválido.';
      errorDiv.style.display = 'block';
      errorDiv.classList.add('shake');
      setTimeout(() => errorDiv.classList.remove('shake'), 500);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = Loader('small');
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    try {
      await resetPassword(email);
      successDiv.textContent = 'E-mail enviado! Verifique sua caixa de entrada (e o spam).';
      successDiv.style.display = 'block';
      showToast('E-mail enviado!', 'success');
    } catch (err) {
      // Não vaza se o email existe ou não (evita enumeração de usuários)
      const messages = {
        'auth/invalid-email': 'E-mail inválido.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.'
      };
      errorDiv.textContent = messages[err.code] || 'Erro ao enviar e-mail. Verifique o endereço.';
      errorDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Enviar Link';
    }
  });
}
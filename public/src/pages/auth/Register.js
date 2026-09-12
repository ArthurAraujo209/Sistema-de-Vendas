import { register } from '../../firebase/auth.js';
import { uploadImage } from '../../firebase/upload.js';
import { showToast } from '../../components/Toast.js';
import { Loader } from '../../components/Loader.js';
import { router } from '../../router.js';
import { validateEmail, validatePassword } from '../../utils/validators.js';

export function RegisterPage() {
  const content = document.getElementById('app-content') || document.getElementById('app');
  content.innerHTML = `
    <div class="auth-container">
      <div class="auth-card" style="max-width: 500px;">
        <div class="auth-header">
          <div class="auth-logo">📦</div>
          <h2>Criar Conta</h2>
          <p>Preencha seus dados</p>
        </div>
        <form id="register-form" class="auth-form">
          <div class="form-group" style="text-align:center;">
            <div class="avatar-upload">
              <img id="reg-avatar-preview" class="avatar-img" style="display:none;" alt="Prévia da foto">
              <div id="reg-avatar-placeholder" class="avatar-placeholder">📷</div>
              <input type="file" id="reg-photo" accept="image/*" style="display:none;">
              <button type="button" class="btn btn-sm btn-outline" id="reg-photo-btn">Adicionar foto</button>
            </div>
          </div>

          <div class="form-group">
            <label for="reg-name">Nome *</label>
            <input type="text" id="reg-name" class="form-input" required placeholder="Seu nome completo">
          </div>

          <div class="form-group">
            <label for="reg-email">E-mail *</label>
            <input type="email" id="reg-email" class="form-input" required placeholder="seu@email.com">
          </div>

          <div class="form-group">
            <label for="reg-phone">Telefone (WhatsApp) *</label>
            <input type="tel" id="reg-phone" class="form-input" required
                   placeholder="(11) 99999-9999" autocomplete="tel">
            <small class="text-muted">Usado para contato e cobranças. Importante preencher corretamente.</small>
          </div>

          <div class="form-group">
            <label for="reg-password">Senha *</label>
            <input type="password" id="reg-password" class="form-input" required
                   placeholder="Mínimo 6 caracteres" autocomplete="new-password">
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
  const photoInput = document.getElementById('reg-photo');
  const photoBtn = document.getElementById('reg-photo-btn');
  const previewImg = document.getElementById('reg-avatar-preview');
  const placeholder = document.getElementById('reg-avatar-placeholder');

  photoBtn.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (file) {
      previewImg.src = URL.createObjectURL(file);
      previewImg.style.display = 'block';
      placeholder.style.display = 'none';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!name) return showError('Informe seu nome.');
    if (!validateEmail(email)) return showError('E-mail inválido.');
    if (!phone || phone.replace(/\D/g, '').length < 10) return showError('Telefone inválido. Informe DDD + número.');
    if (!validatePassword(password)) return showError('A senha deve ter pelo menos 6 caracteres.');

    submitBtn.disabled = true;
    submitBtn.innerHTML = Loader('small');
    errorDiv.style.display = 'none';

    try {
      // 1) Se tiver foto, faz upload antes de criar a conta
      let photoUrl = '';
      const file = photoInput.files[0];
      if (file) {
        try {
          photoUrl = await uploadImage(file);
        } catch (err) {
          console.warn('[register upload]', err);
          showError('Não foi possível enviar a foto, mas a conta será criada sem ela.');
        }
      }

      // 2) Cria a conta (sempre como 'client' — vendedor só via solicitação)
      await register(email, password, name, 'client', phone, photoUrl);
      showToast('Conta criada com sucesso!', 'success');
      // O observer cuida do redirecionamento
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
    errorDiv.classList.add('shake');
    setTimeout(() => errorDiv.classList.remove('shake'), 500);
  }
}
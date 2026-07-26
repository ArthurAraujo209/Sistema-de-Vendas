import { requestSellerAccount } from '../../firebase/auth.js';
import { showToast } from '../../components/Toast.js';
import { router } from '../../router.js';

export function SellerRequestPage() {
  const content = document.getElementById('app-content') || document.getElementById('app');
  content.innerHTML = `
    <div class="auth-container">
      <div class="auth-card" style="max-width: 560px;">
        <div class="auth-header">
          <div class="auth-logo">📦</div>
          <h2>Solicitar Conta de Vendedor</h2>
          <p>Preencha seus dados para análise</p>
        </div>
        <form id="seller-request-form" class="auth-form">
          <div class="form-group">
            <label for="req-name">Nome da Empresa *</label>
            <input type="text" id="req-name" class="form-input" required>
          </div>
          <div class="form-group">
            <label for="req-email">E-mail *</label>
            <input type="email" id="req-email" class="form-input" required>
          </div>
          <div class="form-group">
            <label for="req-password">Senha *</label>
            <input type="password" id="req-password" class="form-input" required minlength="6">
          </div>
          <div class="form-group">
            <label for="req-phone">Telefone/WhatsApp *</label>
            <input type="tel" id="req-phone" class="form-input" required>
          </div>
          <div class="form-group">
            <label for="req-instagram">Instagram (@) *</label>
            <input type="text" id="req-instagram" class="form-input" required placeholder="@seuinstagram">
          </div>
          <div class="form-group">
            <label for="req-description">Descrição da empresa/produtos *</label>
            <textarea id="req-description" class="form-textarea" rows="3" required></textarea>
          </div>
          <div class="form-group">
            <label for="req-photo">Foto de perfil (URL)</label>
            <input type="url" id="req-photo" class="form-input" placeholder="https://...">
          </div>
          <button type="submit" class="btn btn-primary btn-block">Enviar Solicitação</button>
        </form>
        <div id="request-error" class="auth-error" style="display:none;"></div>
        <div class="auth-footer">
          Já tem conta? <a href="#/login">Entrar</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('seller-request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('req-name').value.trim(),
      email: document.getElementById('req-email').value.trim().toLowerCase(),
      password: document.getElementById('req-password').value,
      phone: document.getElementById('req-phone').value.trim(),
      instagram: document.getElementById('req-instagram').value.trim(),
      description: document.getElementById('req-description').value.trim(),
      photoUrl: document.getElementById('req-photo').value.trim()
    };

    if (!data.name || !data.email || !data.password || !data.phone || !data.instagram || !data.description) {
      document.getElementById('request-error').textContent = 'Preencha todos os campos obrigatórios.';
      document.getElementById('request-error').style.display = 'block';
      return;
    }

    try {
      await requestSellerAccount(data);
      showToast('Solicitação enviada! Aguarde a aprovação.', 'success');
      router.navigate('/login');
    } catch (err) {
      console.error(err);
      document.getElementById('request-error').textContent = 'Erro ao enviar solicitação.';
      document.getElementById('request-error').style.display = 'block';
    }
  });
}
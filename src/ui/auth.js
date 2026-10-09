import { loginTeacher } from '../data/firebase.js';
import { iconPrimogem, iconFiligreeDivider } from '../components/genshin-icons.js';

export function renderAuth(root) {
  root.innerHTML = `
    <div class="container flex flex-col items-center justify-center" style="min-height: 90vh;">
      <div style="filter: drop-shadow(0 0 20px var(--gold-glow)); margin-bottom: 8px;">
        ${iconPrimogem(56)}
      </div>
      <h1 class="fantasy-title text-center text-xl" style="margin: 0 0 4px 0; font-size: 26px;">Зоряний клас</h1>
      <p class="text-muted text-center" style="margin: 0 0 12px 0; font-size: 14px;">Вхід до кабінету класного керівника</p>
      ${iconFiligreeDivider()}

      <div class="surface-card" style="width: 100%; max-width: 380px; margin-top: 12px; border: 1.5px solid var(--gold-border);">
        <form id="auth-form" class="flex flex-col gap-md">
          <div class="form-group">
            <label for="email">Електронна пошта вчителя</label>
            <input type="email" id="email" required autocomplete="username" placeholder="teacher@school.edu">
          </div>
          <div class="form-group">
            <label for="password">Пароль</label>
            <input type="password" id="password" required autocomplete="current-password" placeholder="••••••••">
          </div>
          <div id="auth-error" class="error-text"></div>
          <button type="submit" class="btn-genshin-gold" style="margin-top: var(--spacing-sm); width: 100%; padding: 14px;">
            Увійти до кабінету
          </button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('auth-form');
  const errorEl = document.getElementById('auth-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Авторизація...';

    try {
      await loginTeacher(email, password);
      // navigation handled by onTeacherStateChanged in app.js
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        errorEl.textContent = 'Невірний email або пароль';
      } else {
        errorEl.textContent = 'Помилка входу. Перевірте інтернет-з\'єднання.';
      }
      btn.disabled = false;
      btn.textContent = 'Увійти до кабінету';
    }
  });
}

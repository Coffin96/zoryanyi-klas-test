import { loginTeacher } from '../data/firebase.js';

export function renderAuth(root) {
  root.innerHTML = `
    <div class="container flex flex-col items-center justify-center" style="min-height: 100vh;">
      <div class="surface-card" style="width: 100%; max-width: 400px;">
        <h1 class="text-center text-xl" style="margin-top: 0;">Вхід для вчителя</h1>
        <form id="auth-form" class="flex flex-col gap-md">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" required autocomplete="username">
          </div>
          <div class="form-group">
            <label for="password">Пароль</label>
            <input type="password" id="password" required autocomplete="current-password">
          </div>
          <div id="auth-error" class="error-text"></div>
          <button type="submit" class="primary" style="margin-top: var(--spacing-sm);">Увійти</button>
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
    btn.textContent = 'Вхід...';

    try {
      await loginTeacher(email, password);
      // navigation handled by onTeacherStateChanged in app.js
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        errorEl.textContent = 'Невірний email або пароль';
      } else {
        errorEl.textContent = 'Помилка входу. Перевірте з\'єднання.';
      }
      btn.disabled = false;
      btn.textContent = 'Увійти';
    }
  });
}

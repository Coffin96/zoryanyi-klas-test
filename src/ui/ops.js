import { exportAllData, downloadBackupFile, importBackupData, checkDataIntegrity, fixIntegrityIssues, archiveYearEnd } from '../data/export.js';
import { showToast } from './app.js';

/**
 * Рендеринг розділу «Експлуатація та резервні копії» (M8) у стилі Genshin
 */
export function renderOpsSection(container, profiles, onRefresh) {
  let integrityIssues = null;

  function updateView() {
    container.innerHTML = `
      <div class="surface-card flex flex-col gap-md" style="margin-bottom: var(--spacing-md); border: 1.5px solid var(--gold-border);">
        <h3 class="fantasy-title" style="margin:0; font-size: 17px; color: var(--gold-light);">⚙️ Експлуатація та резервні копії</h3>
        <p class="text-muted" style="margin:0; font-size: 13px;">
          Керування безпекою даних, регулярне резервне копіювання та підготовка до нового навчального року.
        </p>

        <!-- 1. Резервне копіювання (T8.1) -->
        <div style="background: rgba(10, 15, 34, 0.6); padding: 14px; border-radius: var(--radius-md); border: 1px solid rgba(214, 181, 115, 0.3);">
          <div class="fantasy-title" style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: var(--gold-light);">💾 Резервна копія бази (JSON)</div>
          <p class="text-muted" style="font-size: 12px; margin: 0 0 10px 0;">
            Рекомендується робити експорт раз на місяць або перед будь-якими масовими змінами.
          </p>

          <div class="flex gap-sm flex-wrap">
            <button id="btn-export-json" class="btn-genshin-gold" style="padding: 8px 16px; font-size: 13px; border-radius: 12px;">
              📥 Завантажити бекап (.json)
            </button>
            <label class="surface-card" style="padding: 8px 14px; font-size: 13px; border: 1px solid var(--gold-border); border-radius: 12px; cursor: pointer; display: inline-flex; align-items: center; color: var(--gold-light); min-height: 42px;">
              📤 Відновити з файлу
              <input type="file" id="input-import-json" accept=".json" style="display: none;">
            </label>
          </div>
        </div>

        <!-- 2. Перевірка цілісності даних (T8.2) -->
        <div style="background: rgba(10, 15, 34, 0.6); padding: 14px; border-radius: var(--radius-md); border: 1px solid rgba(214, 181, 115, 0.3);">
          <div class="flex justify-between items-center" style="margin-bottom: 4px;">
            <div class="fantasy-title" style="font-weight: 600; font-size: 14px; color: var(--gold-light);">🔍 Перевірка цілісності бази</div>
            <button id="btn-check-integrity" class="surface-card" style="padding: 6px 14px; font-size: 12px; border: 1px solid var(--gold-border); border-radius: 10px; color: var(--gold-light); min-height: 36px;">
              Перевірити зараз
            </button>
          </div>
          <p class="text-muted" style="font-size: 12px; margin: 0 0 10px 0;">
            Автоматичний пошук від'ємних балансів, розбіжностей у сумах та дублів псевдонімів.
          </p>

          <div id="integrity-results">
            ${integrityIssues === null ? `
              <div class="text-muted" style="font-size: 12px;">Натисніть кнопку, щоб запустити діагностику.</div>
            ` : integrityIssues.length === 0 ? `
              <div style="color: var(--cyan-accent); font-size: 13px; font-weight: 600;">
                ✓ Усі дані цілісні. Помилок не виявлено (перевірено ${profiles.length} учнів).
              </div>
            ` : `
              <div style="background: rgba(207, 67, 67, 0.15); border: 1px solid #cf4343; padding: 10px; border-radius: var(--radius-sm); margin-bottom: 8px;">
                <div style="color: #ff8585; font-weight: bold; font-size: 13px; margin-bottom: 4px;">
                  ⚠️ Знайдено порушень: ${integrityIssues.length}
                </div>
                <div class="flex flex-col gap-xs" style="font-size: 12px; color: #ffb8b8;">
                  ${integrityIssues.map(i => `
                    <div>• <strong>${i.alias}</strong>: ${i.message}</div>
                  `).join('')}
                </div>
              </div>
              <button id="btn-fix-integrity" class="btn-genshin-gold" style="padding: 8px 14px; font-size: 12px; border-radius: 10px;">
                🔧 Автоматично виправити виявлені помилки
              </button>
            `}
          </div>
        </div>

        <!-- 3. Завершення навчального року (T8.5) -->
        <div style="background: rgba(10, 15, 34, 0.6); padding: 14px; border-radius: var(--radius-md); border: 1px solid rgba(207, 67, 67, 0.4);">
          <div class="fantasy-title" style="font-weight: 600; font-size: 14px; color: #ff8585; margin-bottom: 4px;">🎓 Завершення навчального року</div>
          <p class="text-muted" style="font-size: 12px; margin: 0 0 10px 0;">
            Наприкінці травня баланси учнів фіксуються в історії та обнуляються для нового навчального року.
          </p>
          <button id="btn-archive-year" class="btn-genshin-crimson" style="padding: 8px 16px; font-size: 13px; border-radius: 12px;">
            🧹 Обнулити баланси для нового року
          </button>
        </div>
      </div>
    `;

    // 1. Експорт JSON
    const btnExport = container.querySelector('#btn-export-json');
    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        btnExport.disabled = true;
        btnExport.textContent = 'Збирання даних...';
        try {
          const data = await exportAllData();
          downloadBackupFile(data);
          showToast(`Резервну копію збережено (${data.profilesCount} учнів)!`);
        } catch (e) {
          console.error(e);
          alert('Помилка створення бекапу: ' + e.message);
        } finally {
          btnExport.disabled = false;
          btnExport.textContent = '📥 Завантажити бекап (.json)';
        }
      });
    }

    // 2. Імпорт JSON
    const inputImport = container.querySelector('#input-import-json');
    if (inputImport) {
      inputImport.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm(`Відновити базу даних із вибраного файлу "${file.name}"? Увага: профілі з файлу будуть об'єднані з поточною базою.`)) {
          inputImport.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const content = evt.target.result;
            const res = await importBackupData(content);
            alert(`Успішно відновлено ${res.profilesRestored} учнів!`);
            if (onRefresh) onRefresh();
          } catch (err) {
            console.error(err);
            alert('Помилка імпорту: ' + err.message);
          } finally {
            inputImport.value = '';
          }
        };
        reader.readAsText(file);
      });
    }

    // 3. Діагностика
    const btnCheck = container.querySelector('#btn-check-integrity');
    if (btnCheck) {
      btnCheck.addEventListener('click', () => {
        integrityIssues = checkDataIntegrity(profiles);
        updateView();
      });
    }

    // 4. Виправлення цілісності
    const btnFix = container.querySelector('#btn-fix-integrity');
    if (btnFix) {
      btnFix.addEventListener('click', async () => {
        if (!confirm('Виправити виявлені помилки в базі?')) return;
        btnFix.disabled = true;
        btnFix.textContent = 'Виправлення...';
        try {
          const fixed = await fixIntegrityIssues(profiles, integrityIssues);
          alert(`Успішно виправлено помилок: ${fixed}`);
          integrityIssues = null;
          if (onRefresh) onRefresh();
        } catch (e) {
          console.error(e);
          alert('Помилка виправлення: ' + e.message);
        }
      });
    }

    // 5. Завершення року
    const btnArchive = container.querySelector('#btn-archive-year');
    if (btnArchive) {
      btnArchive.addEventListener('click', async () => {
        const answer = prompt('УВАГА! Баланси всіх учнів буде обнулено, а дані збережено в архіві статистики.\n\nДля підтвердження введіть слово: ОБНУЛИТИ');
        if (answer !== 'ОБНУЛИТИ') {
          if (answer !== null) alert('Дію скасовано (невірне слово підтвердження).');
          return;
        }

        btnArchive.disabled = true;
        btnArchive.textContent = 'Обнулення...';
        try {
          await archiveYearEnd(profiles);
          alert('Баланси успішно обнулено для нового навчального року!');
          if (onRefresh) onRefresh();
        } catch (e) {
          console.error(e);
          alert('Помилка: ' + e.message);
        } finally {
          btnArchive.disabled = false;
          btnArchive.textContent = '🧹 Обнулити баланси для нового року';
        }
      });
    }
  }

  updateView();
}

import { forecastDemand } from '../engine/helpers.js';

/**
 * Рендеринг розділу «Бюджет та прогноз потреби» (M7)
 */
export function renderBudgetSection(container, profiles, config, stock = {}) {
  let priceMultiplier = 1.0;

  function calculate(multiplier) {
    // Створюємо симульовану конфігурацію зі скоригованими цінами
    const simConfig = {
      ...config,
      shop: (config.shop || []).map(item => ({
        ...item,
        price: Math.max(1, Math.round(item.price * multiplier))
      }))
    };

    const demand = forecastDemand(profiles, simConfig, Date.now(), stock);
    
    let totalEstimatedUah = 0;
    let totalItemsCount = 0;
    const itemsBreakdown = [];

    (config.shop || []).filter(i => i.category === 'sweet').forEach(item => {
      const count = demand[item.id] || 0;
      const unitCost = item.unitCost || 0;
      const itemTotalUah = count * unitCost;
      
      totalEstimatedUah += itemTotalUah;
      totalItemsCount += count;

      if (count > 0 || item.active) {
        itemsBreakdown.push({
          id: item.id,
          name: item.name,
          icon: item.icon || '🍬',
          price: Math.max(1, Math.round(item.price * multiplier)),
          originalPrice: item.price,
          unitCost,
          count,
          totalUah: itemTotalUah
        });
      }
    });

    const budgetLimit = config.settings?.budgetAlertUah || 550;
    const percent = Math.min(100, Math.round((totalEstimatedUah / budgetLimit) * 100));
    const isExceeded = totalEstimatedUah > budgetLimit;

    return {
      demand,
      totalEstimatedUah,
      totalItemsCount,
      itemsBreakdown,
      budgetLimit,
      percent,
      isExceeded
    };
  }

  function updateView() {
    const data = calculate(priceMultiplier);

    container.innerHTML = `
      <div class="surface-card flex flex-col gap-md" style="margin-bottom: var(--spacing-md);">
        <div class="flex justify-between items-center">
          <h3 style="margin:0;">📊 Бюджет та прогноз потреби</h3>
          <span class="badge" style="background: ${data.isExceeded ? 'rgba(255, 82, 82, 0.2)' : 'rgba(61, 220, 151, 0.2)'}; color: ${data.isExceeded ? 'var(--danger)' : 'var(--ok)'}; font-weight: bold; font-size: 13px;">
            ${data.isExceeded ? '⚠️ Перевищення ліміту' : '✓ В межах бюджету'}
          </span>
        </div>

        <p class="text-muted" style="margin:0; font-size: 13px;">
          Аналіз поточних балансів <strong>${profiles.length}</strong> учнів: яка кількість солодощів може бути затребувана найближчим часом та скільки гривень це коштуватиме.
        </p>

        <!-- Картка статусу бюджету -->
        <div style="background: var(--bg); padding: 14px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.1);">
          <div class="flex justify-between items-center" style="margin-bottom: 8px;">
            <span style="font-size: 14px;">Очікувані витрати:</span>
            <span style="font-size: 20px; font-weight: bold; color: ${data.isExceeded ? 'var(--danger)' : 'var(--ok)'};">
              ${data.totalEstimatedUah.toFixed(2)} грн / ${data.budgetLimit} грн
            </span>
          </div>

          <!-- Смуга витрат -->
          <div style="width: 100%; background: rgba(255,255,255,0.1); height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 6px;">
            <div style="width: ${data.percent}%; background: ${data.isExceeded ? 'var(--danger)' : 'var(--ok)'}; height: 100%;"></div>
          </div>
          <div class="flex justify-between text-muted" style="font-size: 11px;">
            <span>Використано ${data.percent}%</span>
            <span>Залишок: ${(Math.max(0, data.budgetLimit - data.totalEstimatedUah)).toFixed(2)} грн</span>
          </div>
        </div>

        ${data.isExceeded ? `
          <div style="background: rgba(255, 82, 82, 0.12); border-left: 4px solid var(--danger); padding: 10px 14px; border-radius: 4px; font-size: 13px;">
            <strong>Порада для стабілізації:</strong> учні мають достатньо зірок, щоб викупити солодкі призи понад ліміт 550 грн/місяць. Рекомендується підвищити вартість солодощів на 1–2 ✦ або додати цікаві нематеріальні привілеї (музика, сидіння з другом).
          </div>
        ` : ''}

        <!-- Прогноз потреби за товарами -->
        <div>
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">🛒 Очікуваний попит на солодощі:</div>
          <div class="flex flex-col gap-xs">
            ${data.itemsBreakdown.map(item => `
              <div class="flex justify-between items-center" style="padding: 8px 12px; background: var(--bg); border-radius: var(--radius-sm); font-size: 13px;">
                <div class="flex items-center gap-sm">
                  <span>${item.icon}</span>
                  <div>
                    <span style="font-weight: 600;">${item.name}</span>
                    <span class="text-muted" style="font-size: 11px;">(${item.price} ✦ · собівартість ${item.unitCost} грн)</span>
                  </div>
                </div>
                <div style="text-align: right;">
                  <strong>${item.count} шт.</strong>
                  <div class="text-muted" style="font-size: 11px;">${item.totalUah.toFixed(2)} грн</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Симулятор «Що, якщо» (T7.4) -->
        <div style="background: rgba(124, 77, 255, 0.08); border: 1px dashed var(--accent); padding: 14px; border-radius: var(--radius-md);">
          <div class="flex justify-between items-center" style="margin-bottom: 6px;">
            <span style="font-weight: 600; font-size: 14px;">🎛️ Симулятор цін («Що, якщо»):</span>
            <strong style="color: var(--accent);">${priceMultiplier.toFixed(1)}x</strong>
          </div>
          <p class="text-muted" style="font-size: 12px; margin: 0 0 10px 0;">
            Потягніть повзунок, щоб перевірити, як зміна цін у зірках вплине на щомісячний бюджет класу.
          </p>
          <div class="flex items-center gap-md">
            <span style="font-size: 12px;">Дешевше (0.7x)</span>
            <input type="range" id="price-sim-slider" min="0.7" max="1.8" step="0.1" value="${priceMultiplier}" style="flex:1;">
            <span style="font-size: 12px;">Дорожче (1.8x)</span>
          </div>
        </div>
      </div>
    `;

    const slider = container.querySelector('#price-sim-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        priceMultiplier = parseFloat(e.target.value);
        updateView();
      });
    }
  }

  updateView();
}

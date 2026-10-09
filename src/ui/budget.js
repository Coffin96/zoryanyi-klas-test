import { forecastDemand } from '../engine/helpers.js';

/**
 * Рендеринг розділу «Бюджет та прогноз потреби» (M7) у стилі Genshin
 */
export function renderBudgetSection(container, profiles, config, stock = {}) {
  let priceMultiplier = 1.0;

  function calculate(multiplier) {
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
      <div class="surface-card flex flex-col gap-md" style="margin-bottom: var(--spacing-md); border: 1.5px solid var(--gold-border);">
        <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: 8px;">
          <h3 class="fantasy-title" style="margin:0; font-size: 17px; color: var(--gold-light);">📊 Бюджет та прогноз потреби</h3>
          <span class="badge-tag" style="background: ${data.isExceeded ? 'rgba(255, 82, 82, 0.25)' : 'rgba(61, 220, 151, 0.25)'}; color: ${data.isExceeded ? '#ff8585' : 'var(--cyan-accent)'}; font-weight: bold; border-color: ${data.isExceeded ? '#cf4343' : 'var(--cyan-accent)'}; font-size: 12px;">
            ${data.isExceeded ? '⚠️ Перевищення ліміту' : '✓ В межах бюджету'}
          </span>
        </div>

        <p class="text-muted" style="margin:0; font-size: 13px;">
          Аналіз поточних балансів <strong>${profiles.length}</strong> учнів: яка кількість солодощів може бути затребувана найближчим часом та скільки гривень це коштуватиме.
        </p>

        <!-- Картка статусу бюджету -->
        <div style="background: rgba(10, 15, 34, 0.6); padding: 14px; border-radius: var(--radius-md); border: 1px solid rgba(214, 181, 115, 0.3);">
          <div class="flex justify-between items-center" style="margin-bottom: 8px;">
            <span style="font-size: 13px; color: var(--gold-light);">Очікувані витрати:</span>
            <span style="font-size: 18px; font-weight: 800; font-family: var(--font-fantasy); color: ${data.isExceeded ? '#ff8585' : 'var(--cyan-accent)'};">
              ${data.totalEstimatedUah.toFixed(2)} грн / ${data.budgetLimit} грн
            </span>
          </div>

          <!-- Смуга витрат у латунному жолобі -->
          <div class="genshin-progress-track dark-track" style="height: 10px; margin-bottom: 6px;">
            <div class="${data.isExceeded ? 'genshin-progress-fill-gold' : 'genshin-progress-fill-cyan'}" style="width: ${data.percent}%; ${data.isExceeded ? 'background: linear-gradient(90deg, #e67e22, #cf4343);' : ''}"></div>
          </div>
          <div class="flex justify-between text-muted" style="font-size: 11px;">
            <span>Використано ${data.percent}%</span>
            <span>Залишок: ${(Math.max(0, data.budgetLimit - data.totalEstimatedUah)).toFixed(2)} грн</span>
          </div>
        </div>

        ${data.isExceeded ? `
          <div style="background: rgba(207, 67, 67, 0.15); border-left: 3px solid #cf4343; padding: 10px 14px; border-radius: 4px; font-size: 13px; color: #ffb8b8;">
            <strong>Порада для стабілізації:</strong> учні мають достатньо зірок, щоб викупити солодкі призи понад ліміт 550 грн/місяць. Рекомендується підвищити вартість солодощів на 1–2 ✦ або додати цікаві нематеріальні привілеї (музика, сидіння з другом).
          </div>
        ` : ''}

        <!-- Прогноз потреби за товарами -->
        <div>
          <div class="fantasy-title" style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--gold-light);">🛒 Очікуваний попит на солодощі:</div>
          <div class="flex flex-col gap-xs">
            ${data.itemsBreakdown.map(item => `
              <div class="parchment-card flex justify-between items-center" style="padding: 8px 12px; font-size: 13px;">
                <div class="flex items-center gap-sm">
                  <span style="font-size: 20px;">${item.icon}</span>
                  <div>
                    <span style="font-weight: 700; color: var(--text-parchment);">${item.name}</span>
                    <span style="font-size: 11px; color: var(--text-parchment-muted);">(${item.price} ✦ · собівартість ${item.unitCost} грн)</span>
                  </div>
                </div>
                <div style="text-align: right;">
                  <strong style="color: var(--text-parchment);">${item.count} шт.</strong>
                  <div style="font-size: 11px; color: var(--text-parchment-muted);">${item.totalUah.toFixed(2)} грн</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Симулятор «Що, якщо» (T7.4) -->
        <div style="background: rgba(14, 38, 56, 0.7); border: 1px dashed var(--gold-border); padding: 14px; border-radius: var(--radius-md);">
          <div class="flex justify-between items-center" style="margin-bottom: 6px;">
            <span class="fantasy-title" style="font-weight: 600; font-size: 14px; color: var(--gold-light);">🎛️ Симулятор цін («Що, якщо»):</span>
            <strong style="color: var(--cyan-accent); font-family: var(--font-fantasy);">${priceMultiplier.toFixed(1)}x</strong>
          </div>
          <p class="text-muted" style="font-size: 12px; margin: 0 0 10px 0;">
            Потягніть повзунок, щоб перевірити, як зміна цін у зірках вплине на щомісячний бюджет класу.
          </p>
          <div class="flex items-center gap-md">
            <span style="font-size: 12px; color: var(--muted);">Дешевше (0.7x)</span>
            <input type="range" id="price-sim-slider" min="0.7" max="1.8" step="0.1" value="${priceMultiplier}" style="flex:1;">
            <span style="font-size: 12px; color: var(--muted);">Дорожче (1.8x)</span>
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

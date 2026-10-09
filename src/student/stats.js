import { iconPrimogem, iconFiligreeDivider } from '../components/genshin-icons.js';

/**
 * Парсинг часової мітки у мілісекунди.
 * Підтримує Firestore Timestamp, числа, об'єкти Date та ISO-рядки.
 */
export function parseTimestamp(ts) {
  if (!ts) return Date.now();
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds != null) {
    return ts.seconds * 1000 + (ts.nanoseconds ? Math.round(ts.nanoseconds / 1e6) : 0);
  }
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    if (!isNaN(parsed)) return parsed;
  }
  if (ts instanceof Date) return ts.getTime();
  return Date.now();
}

/**
 * Форматування дати точки для графіка (українською).
 */
export function formatPointDate(ms) {
  try {
    const d = new Date(ms);
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  } catch (e) {
    return '';
  }
}

/**
 * Витягує хронологічну послідовність оцінок із записів журналу (ledger).
 * Повертає масив точок, впорядкованих від найдавніших до найновіших.
 *
 * @param {Array} ledgerItems Записи з колекції ledger учня
 * @returns {Array} Масив точок { grade, stars, ts, dateStr, fullDateStr, cumAvg, index }
 */
export function extractGradeHistory(ledgerItems = []) {
  if (!Array.isArray(ledgerItems)) return [];

  const creditItems = ledgerItems.filter(item =>
    item && item.type === 'credit' && Array.isArray(item.entries) && item.entries.length > 0
  );

  const rawPoints = [];
  creditItems.forEach((item, itemIdx) => {
    const ts = parseTimestamp(item.ts);
    let dateStr = '';
    let fullDateStr = '';
    try {
      dateStr = formatPointDate(ts);
      fullDateStr = new Date(ts).toLocaleString('uk-UA', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      dateStr = '';
      fullDateStr = '';
    }

    item.entries.forEach((entry, entryIdx) => {
      const g = Number(entry.g);
      if (!isNaN(g) && g >= 1 && g <= 12) {
        rawPoints.push({
          grade: g,
          stars: Number(entry.v) || 0,
          ts,
          order: itemIdx * 100 + entryIdx,
          dateStr,
          fullDateStr
        });
      }
    });
  });

  // Сортуємо хронологічно від найстаріших до найновіших
  rawPoints.sort((a, b) => a.ts - b.ts || a.order - b.order);

  // Обчислюємо кумулятивний середній бал у кожній точці
  let runningSum = 0;
  return rawPoints.map((pt, idx) => {
    runningSum += pt.grade;
    const count = idx + 1;
    const cumAvg = Math.round((runningSum / count) * 10) / 10;
    return {
      ...pt,
      index: count,
      cumAvg
    };
  });
}

/**
 * Розраховує статистику успішності учня.
 *
 * @param {Array} gradeHistory Хронологічний масив оцінок (з extractGradeHistory)
 * @param {object} profileStats Об'єкт profile.stats (якщо є)
 * @returns {object} Повні статистичні показники
 */
export function calculateGradeStats(gradeHistory = [], profileStats = null) {
  const historyGrades = (gradeHistory || []).map(p => p.grade);

  const counts = {};
  for (let g = 1; g <= 12; g++) counts[g] = 0;

  let totalCount = 0;
  let totalSum = 0;
  let totalStars = 0;

  if (historyGrades.length > 0) {
    historyGrades.forEach(g => {
      counts[g] = (counts[g] || 0) + 1;
      totalCount++;
      totalSum += g;
    });
    totalStars = gradeHistory.reduce((sum, p) => sum + (p.stars || 0), 0);
  } else if (profileStats && profileStats.gradeCount) {
    // Резервний розрахунок із profile.stats.gradeCount, якщо журнал порожній або ще вантажиться
    Object.entries(profileStats.gradeCount).forEach(([gradeStr, cnt]) => {
      const g = Number(gradeStr);
      const count = Number(cnt) || 0;
      if (!isNaN(g) && g >= 1 && g <= 12 && count > 0) {
        counts[g] = count;
        totalCount += count;
        totalSum += g * count;
      }
    });
  }

  const hasData = totalCount > 0;
  const averageGrade = hasData ? Math.round((totalSum / totalCount) * 10) / 10 : 0;

  let minGrade = 12;
  let maxGrade = 1;
  let highestCount = 0;
  for (let g = 1; g <= 12; g++) {
    if (counts[g] > 0) {
      if (g < minGrade) minGrade = g;
      if (g > maxGrade) maxGrade = g;
      if (counts[g] > highestCount) highestCount = counts[g];
    }
  }
  if (!hasData) {
    minGrade = 0;
    maxGrade = 0;
  }

  // Розподіл оцінок для гістограми (12 -> 1)
  const distribution = [];
  for (let g = 12; g >= 1; g--) {
    if (counts[g] > 0 || (hasData && g >= Math.max(1, minGrade - 1) && g <= maxGrade)) {
      const cnt = counts[g] || 0;
      distribution.push({
        grade: g,
        count: cnt,
        percent: hasData ? Math.round((cnt / totalCount) * 100) : 0
      });
    }
  }

  // Розрахунок тренду динаміки (останні 3 оцінки проти загального середнього)
  let trend = 'steady';
  let trendLabel = 'Стабільно';
  let trendIcon = '✦';
  let trendColor = 'var(--gold-primary)';

  if (historyGrades.length >= 3) {
    const recent = historyGrades.slice(-3);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const diff = recentAvg - averageGrade;
    if (diff >= 0.4) {
      trend = 'up';
      trendLabel = 'Зростання';
      trendIcon = '▲';
      trendColor = 'var(--cyan-accent)';
    } else if (diff <= -0.4) {
      trend = 'down';
      trendLabel = 'Потребує уваги';
      trendIcon = '▼';
      trendColor = '#ff9292';
    }
  }

  return {
    hasData,
    totalCount,
    totalSum,
    averageGrade,
    minGrade,
    maxGrade,
    totalStars,
    distribution,
    counts,
    trend,
    trendLabel,
    trendIcon,
    trendColor
  };
}

/**
 * Генерує нативний SVG-графік прогресії оцінок та середнього балу.
 * Чистий SVG без жодних сторонніх бібліотек.
 *
 * @param {Array} gradeHistory Хронологічний масив оцінок
 * @param {object} stats Об'єкт статистики з calculateGradeStats
 * @returns {string} Валідний рядок SVG
 */
export function renderProgressionChartSvg(gradeHistory = [], stats) {
  if (!stats || !stats.hasData) {
    return '';
  }

  const width = 520;
  const height = 230;
  const padLeft = 38;
  const padRight = 20;
  const padTop = 26;
  const padBottom = 42;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Межі осі Y
  const minY = Math.max(1, Math.min(stats.minGrade - 1, 6));
  const maxY = 12;
  const yRange = Math.max(1, maxY - minY);

  const getY = (val) => padTop + plotH - ((val - minY) / yRange) * plotH;

  // Сітка значень осі Y (наприклад: 12, 10, 8, 6...)
  const yTicks = [];
  for (let g = maxY; g >= minY; g -= 2) {
    yTicks.push(g);
  }
  if (!yTicks.includes(minY)) yTicks.push(minY);

  let gridLinesSvg = '';
  yTicks.forEach(tick => {
    const y = getY(tick);
    gridLinesSvg += `
      <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="rgba(214, 181, 115, 0.16)" stroke-dasharray="3,3" stroke-width="1"/>
      <text x="${padLeft - 8}" y="${y + 4}" fill="var(--gold-light)" opacity="0.75" font-size="11" font-family="var(--font-fantasy)" font-weight="700" text-anchor="end">${tick}</text>
    `;
  });

  // Якщо маємо хронологічні точки з журналу:
  const n = gradeHistory.length;
  let pointsMarkup = '';
  let gradePolyline = '';
  let areaPolygon = '';
  let avgPolyline = '';
  let xLabelsSvg = '';

  if (n > 0) {
    const getX = (idx) => n === 1 ? (padLeft + plotW / 2) : (padLeft + (idx / (n - 1)) * plotW);

    const gradePointsCoords = gradeHistory.map((pt, i) => ({
      x: getX(i),
      y: getY(pt.grade),
      cumY: getY(pt.cumAvg),
      pt
    }));

    // Полілінія оцінок
    const polyPoints = gradePointsCoords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    gradePolyline = `
      <polyline points="${polyPoints}" fill="none" stroke="url(#zk-line-gold)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    `;

    // Полігон під графіком (золоте сяйво)
    const yBottom = padTop + plotH;
    const firstX = gradePointsCoords[0].x.toFixed(1);
    const lastX = gradePointsCoords[gradePointsCoords.length - 1].x.toFixed(1);
    const areaPoints = `${firstX},${yBottom} ${polyPoints} ${lastX},${yBottom}`;
    areaPolygon = `
      <polygon points="${areaPoints}" fill="url(#zk-area-grad)" opacity="0.85"/>
    `;

    // Лінія прогресії середнього балу (блакитна пунктирна лінія Anemo)
    if (n > 1) {
      const avgPoints = gradePointsCoords.map(p => `${p.x.toFixed(1)},${p.cumY.toFixed(1)}`).join(' ');
      avgPolyline = `
        <polyline points="${avgPoints}" fill="none" stroke="var(--cyan-accent)" stroke-width="2.2" stroke-dasharray="5,4" stroke-linecap="round"/>
      `;
    }

    // Маркери точок та мітки дат
    // Щоб не перевантажувати мітками дат, показуємо першу, проміжні та останню
    const labelStep = n <= 6 ? 1 : Math.ceil(n / 5);

    gradePointsCoords.forEach((p, i) => {
      // 4-кінцевий діамант Genshin Primogem для точки оцінки
      const d = 5.5;
      const diamondPts = `${p.x},${p.y - d} ${p.x + d},${p.y} ${p.x},${p.y + d} ${p.x - d},${p.y}`;
      
      const showLabel = n <= 10;
      const gradeTextSvg = showLabel ? `
        <text x="${p.x}" y="${p.y - 8}" fill="var(--gold-light)" font-size="11" font-weight="bold" font-family="var(--font-fantasy)" text-anchor="middle">${p.pt.grade}</text>
      ` : '';

      pointsMarkup += `
        <g class="zk-chart-point" tabindex="0">
          <title>Оцінка: ${p.pt.grade} | Сер. на той момент: ${p.pt.cumAvg} | ${p.pt.fullDateStr || p.pt.dateStr || ''}</title>
          <polygon points="${diamondPts}" fill="#ffffff" stroke="var(--gold-primary)" stroke-width="2"/>
          <circle cx="${p.x}" cy="${p.cumY}" r="3" fill="var(--cyan-accent)" opacity="${n > 1 ? '0.85' : '0'}"/>
          ${gradeTextSvg}
        </g>
      `;

      // Мітка осі X
      if (i % labelStep === 0 || i === n - 1) {
        const dateText = p.pt.dateStr || `#${i + 1}`;
        xLabelsSvg += `
          <text x="${p.x}" y="${yBottom + 16}" fill="var(--muted)" font-size="10" text-anchor="middle">${dateText}</text>
        `;
      }
    });
  }

  // Горизонтальна лінія загального середнього балу
  const overallAvgY = getY(stats.averageGrade);
  const avgRefLine = `
    <g class="zk-avg-ref-line">
      <line x1="${padLeft}" y1="${overallAvgY}" x2="${width - padRight}" y2="${overallAvgY}" stroke="var(--cyan-accent)" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6"/>
      <rect x="${width - padRight - 66}" y="${overallAvgY - 14}" width="66" height="14" rx="4" fill="rgba(10, 15, 34, 0.85)" stroke="var(--cyan-accent)" stroke-width="0.75" opacity="0.9"/>
      <text x="${width - padRight - 33}" y="${overallAvgY - 3}" fill="var(--cyan-accent)" font-size="9.5" font-weight="bold" text-anchor="middle">Сер: ${stats.averageGrade}</text>
    </g>
  `;

  return `
    <svg class="genshin-stats-svg" width="100%" height="auto" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Графік успішності та динаміки оцінок">
      <defs>
        <!-- Градієнт заливки під лінією графіка -->
        <linearGradient id="zk-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f5cc70" stop-opacity="0.38"/>
          <stop offset="60%" stop-color="#dfaa3e" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="#121934" stop-opacity="0"/>
        </linearGradient>

        <!-- Золотий металевий градієнт лінії оцінок -->
        <linearGradient id="zk-line-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#fce8b8"/>
          <stop offset="50%" stop-color="#e5c378"/>
          <stop offset="100%" stop-color="#c49942"/>
        </linearGradient>
      </defs>

      <!-- Вісі та сітка -->
      ${gridLinesSvg}

      <!-- Заливка та криві -->
      ${areaPolygon}
      ${avgRefLine}
      ${avgPolyline}
      ${gradePolyline}

      <!-- Точки та значення -->
      ${pointsMarkup}

      <!-- Мітки часу осі X -->
      ${xLabelsSvg}
    </svg>
  `.trim();
}

/**
 * Генерує блок розподілу оцінок на чистому CSS (flex/grid).
 *
 * @param {object} stats Об'єкт статистики
 * @returns {string} HTML-розмітка розподілу оцінок
 */
export function renderGradeDistributionHtml(stats) {
  if (!stats || !stats.hasData) return '';

  const maxCount = Math.max(1, ...stats.distribution.map(d => d.count));

  const rowsHtml = stats.distribution.map(item => {
    const widthPct = Math.round((item.count / maxCount) * 100);
    const isTopGrade = item.grade >= 10;
    return `
      <div class="stats-dist-row">
        <span class="stats-dist-badge" style="color: ${isTopGrade ? 'var(--gold-primary)' : 'var(--muted)'};">
          ${item.grade}
        </span>
        <div class="stats-dist-track">
          <div class="stats-dist-fill" style="width: ${widthPct}%; ${isTopGrade ? 'background: var(--gold-btn-gradient);' : 'background: rgba(155, 164, 196, 0.6);'}"></div>
        </div>
        <span class="stats-dist-count">
          ${item.count} шт. <span style="opacity: 0.7;">(${item.percent}%)</span>
        </span>
      </div>
    `;
  }).join('');

  return `
    <div class="stats-distribution-grid">
      ${rowsHtml}
    </div>
  `;
}

/**
 * Стилізована заглушка у стилі Genshin Impact, якщо оцінок немає.
 */
export function renderEmptyStatsHtml() {
  return `
    <div class="surface-card text-center" style="padding: 28px 16px; border: 1.5px dashed var(--gold-border); background: rgba(15, 21, 45, 0.7); margin-bottom: var(--spacing-md);">
      <div style="font-size: 40px; margin-bottom: 8px; filter: drop-shadow(0 0 12px var(--gold-glow));">
        ${iconPrimogem(48)}
      </div>
      <h3 class="fantasy-title" style="margin: 0 0 6px 0; font-size: 17px; color: var(--gold-light);">Немає даних</h3>
      <p class="text-muted" style="max-width: 340px; margin: 0 auto; font-size: 13px; line-height: 1.5;">
        Оцінки з щоденника ще не внесені вчителем. Графік прогресії та динаміка середнього балу з'являться тут одразу після першого зарахування!
      </p>
    </div>
  `;
}

/**
 * Головна функція рендерингу секції статистики учня у вказаний DOM-контейнер.
 *
 * @param {HTMLElement} container Цільовий контейнер
 * @param {object} param1 Об'єкт { profile, ledgerItems }
 */
export function renderStudentStats(container, { profile, ledgerItems = [] }) {
  if (!container) return;

  const gradeHistory = extractGradeHistory(ledgerItems);
  const stats = calculateGradeStats(gradeHistory, profile?.stats);

  if (!stats.hasData) {
    container.innerHTML = renderEmptyStatsHtml();
    return;
  }

  const svgChart = renderProgressionChartSvg(gradeHistory, stats);
  const distributionHtml = renderGradeDistributionHtml(stats);

  container.innerHTML = `
    <!-- Картка статистики та прогресу -->
    <div class="stats-chart-card">
      <div class="stats-chart-header">
        <div class="flex items-center gap-xs">
          <span style="display:inline-flex; align-items:center; filter:drop-shadow(0 0 6px var(--gold-glow));">
            ${iconPrimogem(18)}
          </span>
          <h3 class="fantasy-title" style="margin:0; font-size: 15px; color: var(--gold-light);">
            Успішність та динаміка
          </h3>
        </div>
        <div class="stats-chart-legend">
          <span class="stats-legend-item">
            <span style="display:inline-block; width:8px; height:8px; background:var(--gold-primary); transform:rotate(45deg);"></span>
            <span>Оцінки</span>
          </span>
          <span class="stats-legend-item">
            <span style="display:inline-block; width:12px; height:2px; background:var(--cyan-accent); border-top:1px dashed var(--cyan-accent);"></span>
            <span>Сер. бал</span>
          </span>
        </div>
      </div>

      <!-- KPI картки показників -->
      <div class="stats-kpi-grid">
        <div class="stats-kpi-card">
          <div class="stats-kpi-val" style="color: var(--gold-light);">
            ${stats.averageGrade}
          </div>
          <div class="stats-kpi-label">Середній бал</div>
        </div>
        <div class="stats-kpi-card">
          <div class="stats-kpi-val" style="color: #fff;">
            ${stats.totalCount}
          </div>
          <div class="stats-kpi-label">Всього оцінок</div>
        </div>
        <div class="stats-kpi-card">
          <div class="stats-kpi-val" style="color: var(--star);">
            ${stats.maxGrade}
          </div>
          <div class="stats-kpi-label">Найвищий бал</div>
        </div>
        <div class="stats-kpi-card">
          <div class="stats-kpi-val" style="color: ${stats.trendColor}; font-size: 17px;">
            ${stats.trendIcon} ${stats.trendLabel}
          </div>
          <div class="stats-kpi-label">Динаміка</div>
        </div>
      </div>

      <!-- Нативний SVG-графік -->
      <div class="stats-svg-container" style="background: rgba(10, 15, 34, 0.7); border-radius: var(--radius-md); border: 1px solid rgba(214, 181, 115, 0.25); padding: 8px 4px; margin-bottom: var(--spacing-sm);">
        ${svgChart}
      </div>

      <!-- Розподіл оцінок (Flex/Grid) -->
      <div style="background: rgba(10, 15, 34, 0.5); border-radius: var(--radius-md); padding: 10px 12px; border: 1px solid rgba(214, 181, 115, 0.15);">
        <div class="flex justify-between items-center" style="margin-bottom: 8px;">
          <span style="font-size: 12px; font-weight: 700; color: var(--gold-light); font-family: var(--font-fantasy);">Розподіл балів у щоденнику</span>
          <span style="font-size: 11px; color: var(--muted);">${stats.totalCount} оцінок</span>
        </div>
        ${distributionHtml}
      </div>
    </div>
  `;
}

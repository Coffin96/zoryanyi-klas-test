/**
 * Модуль генерації легких та автономних SVG-іконок та орнаментів у стилі Genshin Impact.
 * Не потребує зовнішніх CDN, шрифтів чи бібліотек.
 */

/**
 * 4-кінцева діамантова зірка Примогем (✦)
 */
export function iconPrimogem(size = 24, className = '') {
  return `
    <svg class="genshin-icon primogem-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="primogem-gold-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fff0c2"/>
          <stop offset="35%" stop-color="#f5cc70"/>
          <stop offset="70%" stop-color="#dfaa3e"/>
          <stop offset="100%" stop-color="#ad7a22"/>
        </linearGradient>
        <linearGradient id="primogem-inner-grad" x1="7" y1="7" x2="17" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#f5cc70"/>
        </linearGradient>
      </defs>
      <!-- Зовнішній 4-променевий ромб -->
      <path d="M12 1.5C12.5 7 16.5 11.5 22.5 12C16.5 12.5 12.5 17 12 22.5C11.5 17 7.5 12.5 1.5 12C7.5 11.5 11.5 7 12 1.5Z" fill="url(#primogem-gold-grad)"/>
      <!-- Внутрішні фасетки -->
      <path d="M12 4.5C12.3 8 15.5 11.2 19.5 12C15.5 12.8 12.3 16 12 19.5C11.7 16 8.5 12.8 4.5 12C8.5 11.2 11.7 8 12 4.5Z" fill="url(#primogem-inner-grad)" opacity="0.85"/>
      <!-- Центральне діамантове ядро -->
      <polygon points="12,8 14.5,12 12,16 9.5,12" fill="#fff" opacity="0.95"/>
    </svg>
  `.trim();
}

/**
 * Мішечок скарбів / мори (іконка вкладки «Магазин»)
 */
export function iconMoraPouch(size = 24, className = '') {
  return `
    <svg class="genshin-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="pouch-grad" x1="5" y1="5" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fae4b5"/>
          <stop offset="100%" stop-color="#c49740"/>
        </linearGradient>
      </defs>
      <!-- Горловина мішечка -->
      <path d="M9 4.5C9 3.5 10 3 12 3C14 3 15 3.5 15 4.5C16.5 5 17.5 6 17 7C16 8 14.5 8 12 8C9.5 8 8 8 7 7C6.5 6 7.5 5 9 4.5Z" fill="url(#pouch-grad)" stroke="#8e6a25" stroke-width="0.75"/>
      <!-- Перев'язка -->
      <ellipse cx="12" cy="8.2" rx="3.5" ry="1.2" fill="#8e6a25"/>
      <!-- Тіло мішечка -->
      <path d="M8.5 8.5C5.5 10.5 4 14.5 5 18C6 21 8.5 22 12 22C15.5 22 18 21 19 18C20 14.5 18.5 10.5 15.5 8.5C14.5 9.2 13.5 9.5 12 9.5C10.5 9.5 9.5 9.2 8.5 8.5Z" fill="url(#pouch-grad)" stroke="#8e6a25" stroke-width="0.75"/>
      <!-- Золота монета / емблема на мішечку -->
      <circle cx="12" cy="15.5" r="2.8" fill="#ffe9af" stroke="#a37626" stroke-width="0.75"/>
      <path d="M12 13.8L12.7 15.5L12 17.2L11.3 15.5Z" fill="#a37626"/>
    </svg>
  `.trim();
}

/**
 * Компас Шукача Пригод (вкладка «Квести»)
 */
export function iconCompassQuest(size = 24, className = '') {
  return `
    <svg class="genshin-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="compass-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fae4b5"/>
          <stop offset="100%" stop-color="#c49740"/>
        </linearGradient>
      </defs>
      <!-- Зовнішній круг зі шкалою -->
      <circle cx="12" cy="12" r="9.5" stroke="url(#compass-grad)" stroke-width="1.2" fill="none"/>
      <circle cx="12" cy="12" r="8" stroke="url(#compass-grad)" stroke-width="0.5" stroke-dasharray="1 2" fill="none"/>
      <!-- 4-променева зірка компаса -->
      <path d="M12 3.5L14 10.5L20.5 12L14 13.5L12 20.5L10 13.5L3.5 12L10 10.5Z" fill="url(#compass-grad)"/>
      <polygon points="12,7 13.5,12 12,17 10.5,12" fill="#fff" opacity="0.8"/>
      <circle cx="12" cy="12" r="1.5" fill="#5a3d0f"/>
    </svg>
  `.trim();
}

/**
 * Стародавній сувій хронік (вкладка «Історія»)
 */
export function iconChronicleScroll(size = 24, className = '') {
  return `
    <svg class="genshin-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="scroll-grad" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fae4b5"/>
          <stop offset="100%" stop-color="#c49740"/>
        </linearGradient>
      </defs>
      <!-- Закручений верх -->
      <path d="M6 5C5 5 4 5.8 4 7C4 8.2 5 9 6 9L18 9C19 9 20 8.2 20 7C20 5.8 19 5 18 5L6 5Z" fill="url(#scroll-grad)" stroke="#8e6a25" stroke-width="0.75"/>
      <!-- Тіло пергаменту -->
      <path d="M5 8V18C5 19.5 6 20.5 7.5 20.5H17C18.5 20.5 19 19.5 19 18V8H5Z" fill="#fdf8ea" stroke="#8e6a25" stroke-width="0.75"/>
      <!-- Рядки тексту на сувої -->
      <line x1="8" y1="11.5" x2="16" y2="11.5" stroke="#ba964e" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="8" y1="14.5" x2="16" y2="14.5" stroke="#ba964e" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="8" y1="17.5" x2="13" y2="17.5" stroke="#ba964e" stroke-width="1.2" stroke-linecap="round"/>
      <!-- Закручений низ -->
      <path d="M7.5 19C6.5 19 5.5 19.8 5.5 21C5.5 21.8 6.2 22 7 22H18C19 22 20 21.2 20 20C20 19 19 19 18 19L7.5 19Z" fill="url(#scroll-grad)" stroke="#8e6a25" stroke-width="0.75"/>
    </svg>
  `.trim();
}

/**
 * Арканний гліф / QR-матриця (вкладка «Мій QR»)
 */
export function iconArcaneQr(size = 24, className = '') {
  return `
    <svg class="genshin-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="qr-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fae4b5"/>
          <stop offset="100%" stop-color="#c49740"/>
        </linearGradient>
      </defs>
      <!-- Зовнішні кутові рамки -->
      <path d="M3 7V4C4 4 4 3 7 3" stroke="url(#qr-grad)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M17 3C20 3 20 4 21 4V7" stroke="url(#qr-grad)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M21 17V20C20 20 20 21 17 21" stroke="url(#qr-grad)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7 21C4 21 4 20 3 20V17" stroke="url(#qr-grad)" stroke-width="1.5" stroke-linecap="round"/>
      <!-- 4 квадратні рунічні вузли -->
      <rect x="5.5" y="5.5" width="4" height="4" rx="0.8" fill="url(#qr-grad)"/>
      <rect x="14.5" y="5.5" width="4" height="4" rx="0.8" fill="url(#qr-grad)"/>
      <rect x="5.5" y="14.5" width="4" height="4" rx="0.8" fill="url(#qr-grad)"/>
      <!-- Центральний діамант -->
      <polygon points="14.5,16.5 16.5,14.5 18.5,16.5 16.5,18.5" fill="url(#qr-grad)"/>
      <circle cx="12" cy="12" r="1.2" fill="#fff"/>
    </svg>
  `.trim();
}

/**
 * Орнаментальний герб рангу учня (Adventure Rank Crest)
 */
export function iconRankCrest(levelNum = 1) {
  return `
    <div class="genshin-rank-crest" style="position:relative; width:52px; height:52px; display:inline-flex; align-items:center; justify-content:center;">
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute; inset:0;" aria-hidden="true">
        <defs>
          <linearGradient id="crest-gold" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fff0c2"/>
            <stop offset="40%" stop-color="#e2b963"/>
            <stop offset="80%" stop-color="#c19036"/>
            <stop offset="100%" stop-color="#845b16"/>
          </linearGradient>
          <radialGradient id="crest-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#243159"/>
            <stop offset="100%" stop-color="#121832"/>
          </radialGradient>
        </defs>
        <!-- Зовнішнє філігранне 8-кутне обрамлення -->
        <polygon points="26,2 34,9 43,9 43,18 50,26 43,34 43,43 34,43 26,50 18,43 9,43 9,34 2,26 9,18 9,9 18,9" fill="url(#crest-gold)" stroke="#6d470d" stroke-width="0.75"/>
        <!-- Внутрішній сапфіровий щит -->
        <polygon points="26,6 32,12 39,12 39,19 45,26 39,33 39,40 32,40 26,46 20,40 13,40 13,33 7,26 13,19 13,12 20,12" fill="url(#crest-bg)"/>
        <!-- Внутрішня золота нитка -->
        <polygon points="26,8 31,13 37,13 37,19 43,26 37,33 37,39 31,39 26,44 21,39 15,39 15,33 9,26 15,19 15,13 21,13" stroke="url(#crest-gold)" stroke-width="0.8" fill="none"/>
      </svg>
      <span style="position:relative; z-index:1; font-family:var(--font-fantasy); font-size:20px; font-weight:bold; color:#fff; text-shadow:0 0 6px rgba(247,215,138,0.8), 0 2px 4px #000;">
        ${levelNum}
      </span>
    </div>
  `.trim();
}

/**
 * Горизонтальний витончений філігранний розділювач у стилі Genshin
 */
export function iconFiligreeDivider() {
  return `
    <div class="genshin-divider" style="display:flex; align-items:center; justify-content:center; width:100%; margin:12px 0; opacity:0.85;" aria-hidden="true">
      <div style="flex:1; height:1px; background:linear-gradient(90deg, transparent, rgba(214,181,115,0.7));"></div>
      <div style="margin:0 8px; display:inline-flex; align-items:center; gap:4px; color:var(--gold-primary);">
        <span style="font-size:8px;">◆</span>
        <span style="font-size:12px;">✦</span>
        <span style="font-size:8px;">◆</span>
      </div>
      <div style="flex:1; height:1px; background:linear-gradient(270deg, transparent, rgba(214,181,115,0.7));"></div>
    </div>
  `.trim();
}

/**
 * Іконка вогню / серії (quest streak)
 */
export function iconFlame(size = 28) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2C10.5 4.5 9 7 9 9.5C9 10.5 9.3 11.4 9.8 12.1C8.2 11.2 7 9.5 7 7.5C4.5 10 3 13.5 3 16.5C3 20 6 22 12 22C18 22 21 20 21 16.5C21 12 18.5 7.5 14.5 3.5C14 6 13 8 11.5 9.5C11.8 7 12 4.5 12 2Z" fill="url(#flame-grad)"/>
      <defs>
        <linearGradient id="flame-grad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffe17d"/>
          <stop offset="45%" stop-color="#ff7b39"/>
          <stop offset="100%" stop-color="#d42626"/>
        </linearGradient>
      </defs>
    </svg>
  `.trim();
}

/**
 * Іконка зростання / динаміки (quest growth)
 */
export function iconGrowth(size = 28) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 20H21" stroke="#48d1c9" stroke-width="2" stroke-linecap="round"/>
      <path d="M4 16L9.5 10.5L14 14L20 6" stroke="#e5c378" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15.5 6H20V10.5" stroke="#e5c378" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `.trim();
}

/**
 * Іконка внеску / підтримки (quest contrib)
 */
export function iconContrib(size = 28) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7 11L10.5 7.5C11.3 6.7 12.7 6.7 13.5 7.5C14.3 8.3 14.3 9.7 13.5 10.5L11 13" stroke="#e5c378" stroke-width="2" stroke-linecap="round"/>
      <path d="M17 13L13.5 16.5C12.7 17.3 11.3 17.3 10.5 16.5C9.7 15.7 9.7 14.3 10.5 13.5L13 11" stroke="#e5c378" stroke-width="2" stroke-linecap="round"/>
      <path d="M3 15L7 11L9 13L5 17L3 15Z" fill="#d6b573" opacity="0.6"/>
      <path d="M21 9L17 13L15 11L19 7L21 9Z" fill="#d6b573" opacity="0.6"/>
    </svg>
  `.trim();
}

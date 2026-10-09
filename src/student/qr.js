import { encodeP } from '../engine/qr-protocol.js';
import { iconFiligreeDivider, iconPrimogem } from '../components/genshin-icons.js';

export function renderQr(root, state) {
  root.innerHTML = `
    <div class="container flex flex-col items-center" style="padding-top: var(--spacing-md); text-align: center;">
      <h2 class="fantasy-title" style="margin: 0 0 4px 0; font-size: 22px;">Покажи вчителю</h2>
      <p class="text-muted" style="margin: 0; font-size: 13px;">Магічна картка учня для нарахування та обміну</p>
      ${iconFiligreeDivider()}

      <!-- Скрижаль із QR-кодом -->
      <div class="parchment-card flex flex-col items-center" style="padding: 24px 20px; max-width: 320px; width: 100%; margin: var(--spacing-sm) 0 var(--spacing-md) 0; border: 2px solid var(--gold-deep);">
        <div id="qr-display" style="background: #ffffff; padding: 12px; border-radius: var(--radius-md); border: 2px solid var(--gold-border); box-shadow: 0 4px 14px rgba(0,0,0,0.15); margin-bottom: 14px;"></div>
        
        <div class="flex items-center gap-xs" style="margin-bottom: 4px;">
          ${iconPrimogem(18)}
          <span style="font-weight: 800; font-size: 18px; font-family: var(--font-fantasy); color: var(--text-parchment);">
            ${state.profile ? state.profile.alias : ''}
          </span>
          ${iconPrimogem(18)}
        </div>
        <div style="font-size: 13px; font-weight: 600; color: var(--gold-deep); font-family: var(--font-fantasy);">
          Баланс: ${state.profile ? state.profile.balance : 0} ✦
        </div>
      </div>

      <p class="text-muted text-center" style="font-size: 13px; max-width: 320px; line-height: 1.4;">
        💡 <strong>Порада:</strong> збільши яскравість екрана при скануванні.<br>
        Цей код діє для нарахування зірок, замовлення нагород та швидкого входу.
      </p>
    </div>
  `;

  const payload = encodeP(state.uuid);
  
  if (window.qrcode) {
    const typeNumber = 0; // auto
    const errorCorrectionLevel = 'M';
    const qr = window.qrcode(typeNumber, errorCorrectionLevel);
    qr.addData(payload);
    qr.make();
    document.getElementById('qr-display').innerHTML = qr.createImgTag(6, 12);
  }
}

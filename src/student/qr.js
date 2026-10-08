import { encodeP } from '../engine/qr-protocol.js';

export function renderQr(root, state) {
  root.innerHTML = `
    <div class="container flex flex-col items-center" style="padding-top: var(--spacing-xl);">
      <h2 style="margin-bottom: var(--spacing-md);">Покажи вчителю</h2>
      <div id="qr-display" style="background: white; padding: 16px; border-radius: var(--radius-md); box-shadow: 0 4px 12px rgba(0,0,0,0.2); margin-bottom: var(--spacing-lg);">
      </div>
      <p style="font-weight: bold; margin-bottom: var(--spacing-xs);">${state.profile ? state.profile.alias : ''}</p>
      <p class="text-muted text-center" style="font-size: 13px; max-width: 320px;">
        Збільши яскравість екрана при скануванні.<br>
        Цей код використовується для зарахування зірок, покупки нагород та входу на іншому пристрої.
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

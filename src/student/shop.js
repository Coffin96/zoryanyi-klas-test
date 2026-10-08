import { encodeR } from '../engine/qr-protocol.js';
import { kyivParts } from '../engine/time.js';

export function renderShop(root, state) {
  const p = state.profile;
  const c = state.config;
  const shop = (c.shop || []).filter(item => item.active !== false);

  root.innerHTML = `
    <div class="container">
      <h2>Магазин нагород</h2>
      <p class="text-muted" style="margin-bottom: var(--spacing-md);">Обирай нагороду та покажи свій QR вчителю.</p>
      
      <div class="flex flex-col gap-sm">
        ${shop.map(item => {
          const percent = Math.min(100, Math.floor((p.balance / item.price) * 100));
          const canAfford = p.balance >= item.price;
          
          return `
            <div class="surface-card">
              <div class="flex justify-between items-center" style="margin-bottom: var(--spacing-sm);">
                <div class="flex items-center gap-sm">
                  <span style="font-size: 28px;">${item.icon || '🎁'}</span>
                  <div>
                    <div style="font-weight: bold; font-size: 16px;">${item.name}</div>
                    <div class="text-muted" style="font-size: 12px;">
                      ${item.category === 'sweet' ? 'Смаколик' : 'Привілей'}
                    </div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: bold; font-size: 18px; color: ${canAfford ? 'var(--ok)' : 'var(--text)'};">
                    ${item.price} ✦
                  </div>
                  ${canAfford ? `
                    <button class="btn-order primary" data-id="${item.id}" style="padding: 4px 10px; font-size: 12px; min-height: 32px; margin-top: 4px;">
                      🎁 Замовити
                    </button>
                  ` : `
                    <span class="text-muted" style="font-size: 11px;">ще ${item.price - p.balance} ✦</span>
                  `}
                </div>
              </div>
              <div style="width: 100%; background: var(--bg); height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="width: ${percent}%; background: ${canAfford ? 'var(--ok)' : 'var(--star)'}; height: 100%;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Модальне вікно замовлення конкретної нагороди -->
    <div id="order-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:200; align-items:center; justify-content:center; padding:16px;">
      <div class="surface-card text-center" style="max-width:320px; width:100%; padding:20px;">
        <div id="order-icon" style="font-size: 38px; margin-bottom: 2px;"></div>
        <h3 id="order-title" style="margin: 0 0 4px 0; font-size: 18px;"></h3>
        <div id="order-price" style="font-size: 14px; color: var(--muted); margin-bottom: 8px;"></div>
        
        <!-- Вибір кількості -->
        <div id="order-qty-row" class="flex justify-center items-center gap-sm" style="margin: 8px 0;">
          <button id="btn-qty-minus" style="width: 38px; height: 38px; min-height: 38px; border-radius: 50%; font-size: 20px; font-weight: bold; padding: 0; background: var(--bg); border: 1px solid rgba(255,255,255,0.2); cursor: pointer; display: flex; align-items: center; justify-content: center;">−</button>
          <span id="order-qty-val" style="font-size: 17px; font-weight: bold; min-width: 54px; text-align: center;">1 шт.</span>
          <button id="btn-qty-plus" style="width: 38px; height: 38px; min-height: 38px; border-radius: 50%; font-size: 20px; font-weight: bold; padding: 0; background: var(--bg); border: 1px solid rgba(255,255,255,0.2); cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
        </div>
        <div id="order-total" style="font-size: 16px; font-weight: bold; color: var(--star); margin-bottom: 12px;"></div>

        <div id="order-qr-container" style="background:white; padding:10px; border-radius:12px; display:inline-block; margin-bottom:10px;"></div>
        
        <p class="text-muted" style="font-size: 12px; margin: 0 0 14px 0;">
          Покажи цей QR вчителю для отримання нагороди.<br>
          <span style="color: var(--ok); font-weight: 600;">Дійсний лише сьогодні!</span>
        </p>

        <button id="btn-close-order" class="primary" style="width: 100%; padding: 10px; font-weight: bold;">Зрозуміло</button>
      </div>
    </div>
  `;

  const orderModal = document.getElementById('order-modal');
  const btnClose = document.getElementById('btn-close-order');
  if (btnClose) {
    btnClose.addEventListener('click', () => { orderModal.style.display = 'none'; });
  }
  orderModal.addEventListener('click', (e) => {
    if (e.target === orderModal) orderModal.style.display = 'none';
  });

  let currentItem = null;
  let currentQty = 1;
  let maxQty = 1;

  function updateOrderQR() {
    if (!currentItem) return;
    const orderQtyVal = document.getElementById('order-qty-val');
    const orderTotal = document.getElementById('order-total');
    const btnMinus = document.getElementById('btn-qty-minus');
    const btnPlus = document.getElementById('btn-qty-plus');

    orderQtyVal.textContent = `${currentQty} шт.`;
    orderTotal.textContent = `Разом: ${currentItem.price * currentQty} ✦`;
    
    btnMinus.disabled = currentQty <= 1;
    btnMinus.style.opacity = currentQty <= 1 ? '0.4' : '1';
    btnPlus.disabled = currentQty >= maxQty;
    btnPlus.style.opacity = currentQty >= maxQty ? '0.4' : '1';

    const orderId = crypto.randomUUID().slice(0, 8);
    const { ymd } = kyivParts(Date.now());
    const payload = encodeR(state.uuid, orderId, currentItem.id, currentQty, ymd);

    const qrContainer = document.getElementById('order-qr-container');
    qrContainer.innerHTML = '';
    if (window.qrcode) {
      const qr = window.qrcode(0, 'M');
      qr.addData(payload);
      qr.make();
      qrContainer.innerHTML = qr.createImgTag(5, 0);
    }
  }

  document.getElementById('btn-qty-minus').addEventListener('click', () => {
    if (currentQty > 1) {
      currentQty--;
      updateOrderQR();
    }
  });

  document.getElementById('btn-qty-plus').addEventListener('click', () => {
    if (currentQty < maxQty) {
      currentQty++;
      updateOrderQR();
    }
  });

  root.querySelectorAll('.btn-order').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.id;
      const item = shop.find(x => x.id === itemId);
      if (!item) return;

      currentItem = item;
      currentQty = 1;
      maxQty = Math.max(1, Math.floor(p.balance / item.price));

      document.getElementById('order-icon').textContent = item.icon || '🎁';
      document.getElementById('order-title').textContent = item.name;
      document.getElementById('order-price').textContent = `${item.price} ✦ за 1 шт.`;

      updateOrderQR();
      orderModal.style.display = 'flex';
    });
  });
}

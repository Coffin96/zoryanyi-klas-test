import { encodeR } from '../engine/qr-protocol.js';
import { kyivParts } from '../engine/time.js';
import { iconFiligreeDivider, iconPrimogem } from '../components/genshin-icons.js';

export function renderShop(root, state) {
  const p = state.profile;
  const c = state.config;
  const shop = (c.shop || []).filter(item => item.active !== false);

  root.innerHTML = `
    <div class="container">
      <div class="text-center" style="margin-bottom: var(--spacing-sm);">
        <h2 class="fantasy-title" style="margin: 0 0 4px 0; font-size: 22px;">Магазин нагород</h2>
        <p class="text-muted" style="margin: 0; font-size: 13px;">Обирай нагороду та покажи свій QR вчителю.</p>
        ${iconFiligreeDivider()}
      </div>
      
      <div class="flex flex-col gap-sm">
        ${shop.map(item => {
          const hasStock = typeof item.stock === 'number';
          const isSoldOut = hasStock && item.stock <= 0;
          const percent = Math.min(100, Math.floor((p.balance / item.price) * 100));
          const canAfford = p.balance >= item.price && !isSoldOut;
          const isSweet = item.category === 'sweet';
          
          return `
            <div class="parchment-card" style="padding: 14px 16px; opacity: ${isSoldOut ? '0.75' : '1'};">
              <div class="flex justify-between items-center" style="margin-bottom: 8px;">
                <div class="flex items-center gap-sm">
                  <!-- Круглий золотий слот нагороди -->
                  <div style="width: 44px; height: 44px; min-width: 44px; border-radius: 50%; background: radial-gradient(circle, #fff9ee 0%, #ebd7b2 100%); border: 1.5px solid var(--gold-deep); display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: inset 0 1px 2px #fff, 0 2px 4px rgba(0,0,0,0.12); ${isSoldOut ? 'filter: grayscale(0.8);' : ''}">
                    ${item.icon || '🎁'}
                  </div>
                  <div>
                    <div style="font-weight: 700; font-size: 15px; color: var(--text-parchment);">${item.name}</div>
                    <div class="flex items-center gap-xs" style="margin-top: 2px;">
                      <span class="badge-tag">${isSweet ? 'Смаколик' : 'Привілей'}</span>
                      ${hasStock ? `
                        <span class="badge-tag" style="background: ${isSoldOut ? 'rgba(183, 28, 28, 0.12)' : 'rgba(33, 115, 70, 0.12)'}; color: ${isSoldOut ? '#b71c1c' : '#217346'}; border: 1px solid ${isSoldOut ? 'rgba(183, 28, 28, 0.3)' : 'rgba(33, 115, 70, 0.3)'}; font-weight: 700;">
                          Залишилось: ${item.stock} шт.
                        </span>
                      ` : ''}
                    </div>
                  </div>
                </div>

                <div style="text-align: right;">
                  <div style="font-weight: 800; font-size: 17px; font-family: var(--font-fantasy); color: ${isSoldOut ? 'var(--text-parchment-subtle)' : (canAfford ? 'var(--ok)' : 'var(--text-parchment)')};">
                    ${item.price} ✦
                  </div>
                  ${isSoldOut ? `
                    <button class="btn-genshin-gold disabled" disabled style="padding: 5px 12px; font-size: 12px; min-height: 34px; margin-top: 4px; border-radius: 12px; opacity: 0.55; cursor: not-allowed; filter: grayscale(1);">
                      Розпродано
                    </button>
                  ` : canAfford ? `
                    <button class="btn-order btn-genshin-gold" data-id="${item.id}" style="padding: 5px 12px; font-size: 12px; min-height: 34px; margin-top: 4px; border-radius: 12px;">
                      🎁 Замовити
                    </button>
                  ` : `
                    <span style="font-size: 11px; color: var(--text-parchment-subtle); display: block; margin-top: 2px;">ще ${item.price - p.balance} ✦</span>
                  `}
                </div>
              </div>

              <!-- Смуга накопичення до нагороди -->
              <div class="genshin-progress-track">
                <div class="${isSoldOut ? 'genshin-progress-fill-gold' : (canAfford ? 'genshin-progress-fill-cyan' : 'genshin-progress-fill-gold')}" style="width: ${isSoldOut ? 0 : percent}%;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Модальне вікно замовлення конкретної нагороди у стилі магічної грамоти Genshin -->
    <div id="order-modal" class="genshin-modal-overlay" style="display:none;">
      <div class="genshin-modal-content text-center">
        <!-- Іконка та назва товару -->
        <div id="order-icon" style="font-size: 42px; margin-bottom: 2px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));"></div>
        <h3 id="order-title" class="fantasy-title" style="margin: 0 0 4px 0; font-size: 18px; color: var(--text-parchment); text-shadow: none;"></h3>
        <div id="order-price" style="font-size: 13px; color: var(--text-parchment-muted); margin-bottom: 8px;"></div>
        
        <!-- Вибір кількості з круглими латунними кнопками -->
        <div id="order-qty-row" class="flex justify-center items-center gap-md" style="margin: 10px 0;">
          <button id="btn-qty-minus" style="width: 40px; height: 40px; min-height: 40px; min-width: 40px; border-radius: 50%; font-size: 20px; font-weight: bold; padding: 0; background: var(--surface-parchment-inner); border: 1.5px solid var(--gold-deep); color: var(--text-parchment); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">−</button>
          <span id="order-qty-val" style="font-size: 17px; font-weight: 800; min-width: 54px; text-align: center; color: var(--text-parchment); font-family: var(--font-fantasy);">1 шт.</span>
          <button id="btn-qty-plus" style="width: 40px; height: 40px; min-height: 40px; min-width: 40px; border-radius: 50%; font-size: 20px; font-weight: bold; padding: 0; background: var(--surface-parchment-inner); border: 1.5px solid var(--gold-deep); color: var(--text-parchment); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">+</button>
        </div>
        <div id="order-total" style="font-size: 16px; font-weight: 800; color: var(--gold-deep); margin-bottom: 12px; font-family: var(--font-fantasy);"></div>

        <!-- Контейнер для QR-коду з контрастною білою підкладкою -->
        <div id="order-qr-container" style="background:#ffffff; padding:10px; border-radius:14px; border:2px solid var(--gold-border); display:inline-block; margin-bottom:10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></div>
        
        <p style="font-size: 12px; margin: 0 0 14px 0; color: var(--text-parchment-muted); line-height: 1.35;">
          Покажи цей QR вчителю для отримання нагороди.<br>
          <strong style="color: #217346;">Дійсний лише сьогодні!</strong>
        </p>

        <button id="btn-close-order" class="btn-genshin-gold" style="width: 100%; padding: 12px; font-weight: bold; border-radius: 12px;">
          Зрозуміло
        </button>
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
      const affordableQty = Math.max(1, Math.floor(p.balance / item.price));
      const hasStock = typeof item.stock === 'number';
      maxQty = hasStock ? Math.min(item.stock, affordableQty) : affordableQty;
      if (maxQty < 1) maxQty = 1;

      document.getElementById('order-icon').textContent = item.icon || '🎁';
      document.getElementById('order-title').textContent = item.name;
      const stockInfo = hasStock ? ` · Залишилось: ${item.stock} шт.` : '';
      document.getElementById('order-price').textContent = `${item.price} ✦ за 1 шт.${stockInfo}`;

      updateOrderQR();
      orderModal.style.display = 'flex';
    });
  });
}

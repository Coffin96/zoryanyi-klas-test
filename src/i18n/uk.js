export const texts = {
  scan: {
    unknown: 'Це не картка Зоряного класу',
    noCamera: 'Немає доступу до камери. Дозволь камеру в налаштуваннях браузера або вибери учня зі списку'
  },
  order: {
    expired: 'Замовлення не на сьогодні'
  },
  credit: {
    done: 'Зараховано +{n} ✦',
    repeat: 'Щойно вже зараховували {g}. Підтвердити ще раз?'
  },
  redeem: {
    done: 'Видано {item} −{n} ✦',
    insufficient: 'Ще {n} ✦',
    cooldown: 'Знову через {days} дн.',
    stock: 'Закінчилось'
  },
  offline: {
    teacher: 'Немає зв\'язку, спробуйте ще раз'
  },
  undo: 'Скасувати',
  receipt: {
    credit: '+{n} ✦',
    redeem: 'Отримано {item} −{n} ✦, залишок {left} ✦'
  },
  year: {
    countdown: 'До кінця року {days} дн. Залишок {n} ✦: встигни обміняти'
  }
};

export function plural(n, forms) {
  let idx;
  if (n % 10 === 1 && n % 100 !== 11) {
    idx = 0; // 1 зірка, 21 зірка
  } else if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) {
    idx = 1; // 2, 3, 4 зірки
  } else {
    idx = 2; // 5 зірок
  }
  return forms[idx] || forms[0];
}

export function formatStars(n) {
  return `${n} ✦`;
}

# 03. Архітектура

## 1. Рішення

| Тема | Рішення | Причина |
|---|---|---|
| Фронтенд | HTML + CSS + JS, ES-модулі, без фреймворків і збірки | простота, нульові витрати, зрозумілість власнику |
| Хостинг | GitHub Pages (статика, публічний репозиторій) | безкоштовно |
| База | Cloud Firestore, план Spark | безкоштовно, реальний час, офлайн-кеш |
| Автентифікація | Firebase Auth, лише вчитель (email+пароль або Google; вирішує власник) | учні без акаунтів |
| Логіка | в браузері вчителя (чиста бібліотека `engine`) + Security Rules | на Spark немає Cloud Functions |
| Маршрутизація | хеш-роутер (`#/...`) | GitHub Pages без серверної маршрутизації |
| QR | `BarcodeDetector` + запасний `jsQR`; генерація `qrcode-generator` (локально в `vendor/`) | підтримка Safari/iOS |
| PWA | `manifest.webmanifest` + service worker | встановлення на телефон, офлайн-оболонка |
| Тести | `node --test` для логіки; емулятор Firebase для Rules | швидко, без збірки |

## 2. Схема

```
┌──────────────────────┐    HTTPS     ┌──────────────────────────────────┐
│ GitHub Pages (статика)│◄────────────│ Браузер учня      Браузер вчителя │
│ HTML + CSS + JS (ES) │              │ PWA, «Мій QR»     сканер, панель  │
└──────────────────────┘              │ engine · data · ui   адмінпанель  │
                                      └──────────────┬───────────────────┘
                                                     │ Firestore SDK
                                      ┌──────────────▼─────────────┐
                                      │ Firebase (Spark)           │
                                      │ Firestore · Auth · Rules   │
                                      └────────────────────────────┘
```

**Довірча модель.** Cloud Functions немає, тому економіку виконує браузер вчителя, а Rules визначають, хто може писати. Пише лише вчитель (автентифікований); учні тільки читають за непідбираємим UUID. Повна модель загроз: `05-security-privacy.md`.

## 3. Структура репозиторію

```
zoryanyi-klas/
├─ AGENTS.md, README.md, PLAN.md
├─ docs/                      # цей пакет документації
├─ index.html                 # застосунок учня (#/p/<uuid>)
├─ teacher/index.html         # застосунок вчителя
├─ src/
│  ├─ engine/                 # чиста логіка (час, зарахування, квести, списання, скасування, бюджет, перевірка конфігурації)
│  │  ├─ time.js  economy.js  quests.js  redeem.js  undo.js  budget.js  config-check.js
│  ├─ qr/                     # protocol.js, scanner.js, render.js
│  ├─ data/                   # firebase.js, firebase-config.js, repo.js, tx.js, export.js, local-names.js
│  ├─ ui/
│  │  ├─ student/             # home.js, my-qr.js, shop.js, quests.js, history.js, receipt.js
│  │  ├─ teacher/             # login.js, scanner-view.js, student-panel.js, students.js, print-cards.js,
│  │  │                       # admin/ (shop.js, quests.js, grades-levels.js, settings.js, budget.js, audit.js, data.js, access.js)
│  │  └─ components/          # star-icon.js, progress-bar.js, toast.js, keypad.js, qr-view.js
│  ├─ i18n/                   # uk.js, plural.js
│  └─ router.js, main-student.js, main-teacher.js
├─ vendor/                    # jsQR, qrcode-generator, LICENSES.md
├─ styles/                    # tokens.css, base.css, student.css, teacher.css, print.css
├─ assets/                    # icons/, manifest-icons/
├─ tests/                     # engine/*.test.js, qr.test.js, rules/*.test.js
├─ firebase/                  # firestore.rules, firebase.json, seed/published.json
├─ manifest.webmanifest, sw.js
└─ package.json               # лише devDependencies і скрипти
```

## 4. Модулі та відповідальність

| Модуль | Відповідальність | Не робить |
|---|---|---|
| `engine/*` | чиста логіка без I/O (див. `07-engine-spec.md`) | не знає про DOM/Firebase/час системи |
| `qr/protocol.js` | кодування/декодування QR | не працює з камерою |
| `qr/scanner.js` | камера, декодування кадрів, дебаунс, зворотний зв'язок | не вирішує, що робити зі скану |
| `data/repo.js` | читання (`get`, `onSnapshot`), кеш конфігурації | не змінює баланс |
| `data/tx.js` | **усі** записи, що змінюють баланс/журнал/запас, у `runTransaction` | не містить бізнес-правил (викликає `engine`) |
| `data/local-names.js` | локальна довідка імен (IndexedDB), опційне шифрування | ніколи не пише у Firebase |
| `ui/*` | відображення, обробники подій, виклик `engine` для попереднього розрахунку та `tx` для запису | не містить бізнес-правил |

## 5. Потік «зарахування»

```
Сканер → decode(P) → repo.getProfile(uuid) → екран панелі
Вчитель тапає оцінки → engine.creditGrades(profile, grades, cfg, now) → попередній розрахунок у UI
«Зарахувати» → tx.credit(uuid, grades, opId):
   runTransaction:
     p  = get profile              (перевірка v)
     r  = engine.creditGrades(p, grades, cfg, now)
     set profile (v+1, lastOp = opId)
     create ledger/opId {type:'credit', entries, events, delta, prev: snapshot(p), ts: serverTimestamp()}
→ onSnapshot у телефоні учня → анімація «+N ✦»
```

Якщо документ `ledger/opId` уже існує, транзакція відхиляється (Rules забороняють перезапис), нічого не дублюється. `opId` створюється при відкритті панелі й оновлюється лише після успішного запису.

## 6. Час і часовий пояс

Усі місяці, дні й «сьогодні» рахуються за `Europe/Kyiv` (`Intl.DateTimeFormat` із `timeZone`). Ключ місяця: `YYMM`; номер дня: кількість днів від епохи за київською датою. Тести обов'язково охоплюють перехід через північ і перехід на літній/зимовий час.

## 7. PWA і офлайн

- **Service worker:** кешує статичні файли оболонки (cache-first із версіонуванням кешу за `CACHE_VERSION`), не кешує Firestore-запити. Оновлення: нова версія SW → повідомлення «Є оновлення, перезавантажити».
- **Firestore offline persistence** (`persistentLocalCache`) увімкнено лише для читання кешу (швидкий старт, останній відомий баланс). Не вмикати на спільних комп'ютерах.
- **Учень офлайн:** бачить останній відомий баланс і може показати QR (генерується локально).
- **Вчитель офлайн:** транзакції Firestore (`runTransaction`) офлайн не виконуються, а «сліпі» записи з черги небезпечні для балансу (можливий конфлікт версій). Рішення: **операції зі зміною балансу потребують інтернету**; без зв'язку панель показує «Немає зв'язку, спробуйте ще раз» і не ставить дію в чергу. Офлайн лишається доступним для перегляду кешованих даних і показу QR.

## 8. Продуктивність і квоти (Spark)

| Метрика | Значення |
|---|---|
| Перегляд профілю учнем | 2–3 читання (профіль, `config/published`, остання подія) |
| Зарахування | 1 читання + 2 записи (профіль, журнал) |
| Тиждень роботи класу | сотні операцій |
| Ліміти Spark (на момент написання, перевірити в документації Firebase) | ≈ 50 тис. читань і 20 тис. записів на добу, 1 ГіБ; платіжний метод не потрібен, при перевищенні сервіс обмежується |

Запас понад 100×. Не робіть `onSnapshot` на всю колекцію `profiles` для кожного учня; вчитель підписується на список лише на екрані «Учні».

## 9. Налаштування середовища (покроково)

**Firebase (виконує власник; агент готує інструкції та файли):**

1. Створити проєкт у консолі Firebase на плані Spark (без банківської картки).
2. Створити базу Firestore у **виробничому режимі**; регіон вибрати уважно (змінити потім не можна; рекомендація: європейський).
3. Увімкнути Authentication → Sign-in method (email/пароль або Google). Створити акаунт вчителя.
4. У налаштуваннях Auth додати домен GitHub Pages (`<user>.github.io`) до «Authorized domains».
5. Додати веб-застосунок у проєкті → скопіювати веб-конфігурацію в `src/data/firebase-config.js`.
6. У консолі Firestore вручну створити документ `admins/<UID вчителя>` (порожній).
7. Розгорнути правила: `firebase deploy --only firestore:rules` (спершу тести на емуляторі).
8. Завантажити початкову конфігурацію (seed) через адмінпанель («Дані → Імпорт») або скрипт.
9. За бажання: App Check (reCAPTCHA) для додаткового захисту.

**GitHub:**

1. Створити публічний репозиторій; покласти код.
2. Settings → Pages → Source: гілка `main`, корінь `/`.
3. Додати GitHub Actions: `npm test` на кожен push (за бажання).
4. Перевірити, що в репозиторії немає секретів і даних учнів.

## 10. Підтримка браузерів

Chrome/Edge (Android і десктоп), Safari 15+ (iOS і macOS), Firefox (для вчителя без сканера: вибір зі списку). Сканер: `BarcodeDetector`, якщо доступний, інакше `jsQR`. Обов'язково протестувати на реальних iOS і Android до запуску.

## 11. Логування

Без аналітики. У консоль лише технічні помилки без особистих даних. Журнал подій профілю в Firestore це єдиний «аудит» операцій; зміни конфігурації фіксує колекція `audit`.

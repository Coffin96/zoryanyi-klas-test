# 04. Модель даних (Firestore)

## 1. Колекції

```
config/published           читають усі, пише вчитель   — уся конфігурація одним документом
config/stock               читають усі, пише вчитель   — запаси {itemId: n} (лише для позицій з обмеженим запасом)
config/draft               лише вчитель                — чернетка (та сама форма, що й published)
config_history/{version}   лише вчитель                — знімки опублікованих версій (останні 20)
audit/{id}                 лише вчитель, append-only   — зміни конфігурації та ручні втручання
admins/{uid}               створюється вручну в консолі
profiles/{uuid}                    get: усі за UUID; list/запис: вчитель
profiles/{uuid}/ledger/{opId}      append-only; читає власник посилання (get/list)
```

`uuid` це UUID v4 у нижньому регістрі. `opId` це рядок: для панелі `<sessionId>-<n>` (8 символів сесії + лічильник), для замовлень `R-<id>`.

## 2. `config/published`

```json
{
  "schema": 1,
  "version": 8,
  "publishedAt": "2026-10-09T14:00:00Z",
  "settings": {
    "currency": {"name": "зірки", "icon": "✦", "forms": ["зірка", "зірки", "зірок"]},
    "refItem": "caramel",
    "dupWindowMin": 10,
    "undoSeconds": 10,
    "yearEnd": "2027-05-31",
    "budgetAlertUah": 550
  },
  "grades": {"12": 6, "11": 5, "10": 4, "9": 3, "8": 2, "7": 1},
  "questMonthlyCap": 8,
  "shop": [
    {"id": "caramel", "name": "Карамель", "icon": "🍬", "kind": "sweet", "price": 7,
     "active": true, "order": 1, "limits": {}, "unitCost": 2.25},
    {"id": "jelly", "name": "Желейка", "icon": "🍮", "kind": "sweet", "price": 12,
     "active": true, "order": 2, "limits": {}, "unitCost": 3.96},
    {"id": "tartlet", "name": "Тарталетка", "icon": "🥧", "kind": "sweet", "price": 17,
     "active": true, "order": 3, "limits": {"cooldownDays": 30}, "unitCost": 15.0, "acceptSubsidy": true},
    {"id": "priv_music", "name": "Музика на перерві", "icon": "🎵", "kind": "privilege", "price": 6,
     "active": true, "order": 4, "limits": {"perMonth": 2}, "unitCost": 0},
    {"id": "priv_pc", "name": "10 хв творчого часу за комп'ютером", "icon": "💻", "kind": "privilege", "price": 8,
     "active": true, "order": 5, "limits": {"perMonth": 2}, "unitCost": 0}
  ],
  "quests": [
    {"id": "growth", "type": "growth", "title": "Зростання", "icon": "📈", "active": true, "reward": 3, "perMonth": 2,
     "params": {"window": 10, "minHistory": 5, "delta": 2, "minGrade": 7}},
    {"id": "streak", "type": "streak", "title": "Активний тиждень", "icon": "🔥", "active": true, "reward": 2, "perMonth": 2,
     "params": {"length": 3, "minGrade": 8, "windowDays": 7}},
    {"id": "contrib", "type": "manual", "title": "Внесок у клас", "icon": "🤝", "active": true, "reward": 2, "perMonth": 2}
  ],
  "levels": [
    {"min": 0, "name": "Іскорка"}, {"min": 30, "name": "Зірка"}, {"min": 80, "name": "Сузір'я"},
    {"min": 150, "name": "Туманність"}, {"min": 250, "name": "Галактика"}, {"min": 400, "name": "Всесвіт"}
  ],
  "news": [{"id": "n1", "date": "2026-10-09", "text": "Нова нагорода місяця!"}]
}
```

**Обмеження полів.**

| Поле | Правило |
|---|---|
| `shop[].id` | унікальний, `[a-z0-9_]{2,24}`, незмінний |
| `shop[].kind` | `sweet`, `privilege`, `custom` |
| `shop[].price` | ціле ≥ 1 |
| `shop[].limits` | необов'язкові ключі: `perMonth` (ціле ≥ 1), `cooldownDays` (ціле ≥ 1), `perDay`, `total` |
| `shop[].unitCost` | число ≥ 0 (грн за штуку; для привілеїв 0) |
| `shop[].priceSchedule` | необов'язково: `[{"from": "YYYY-MM-DD", "price": N}]`; чинна ціна = остання з `from` ≤ сьогодні (за Києвом), інакше `price` |
| `shop[].acceptSubsidy` | необов'язково, bool: свідомо субсидована позиція (без попередження про «перекіс») |
| `shop[].window` | необов'язково: `{"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"}` період доступності |
| `quests[].type` | `growth`, `streak`, `manual` |
| `grades` | ключі «7»…«12», значення цілі ≥ 0 |
| `levels` | `min` зростає, перший рівень `min: 0` |
| `settings.yearEnd` | дата `YYYY-MM-DD` |

**`config/stock`:** `{"items": {"tartlet": 24}}`. Присутність ключа означає обмежений запас; відсутність: необмежений. Зменшується в тій самій транзакції, що й видача.

## 3. `profiles/{uuid}`

```json
{
  "alias": "Лис-07",
  "archived": false,
  "balance": 23,
  "earned": 187,
  "recent": [9, 10, 11, 10, 12, 8, 10, 11, 9, 12],
  "hot": [20745, 20747],
  "last": {"t": 1791540000000, "gs": [11, 9]},
  "lastOp": "ab12cd34-3",
  "lastAt": {"tartlet": 1791000000000},
  "stats": {"gradeCount": {"12": 3, "11": 5}, "quests": {"growth": 2}, "redeemed": {"caramel": 4}},
  "counters": {"2610": {"growth": 1, "streak": 0, "contrib": 1, "questStars": 5, "priv_music": 1}},
  "achievements": [],
  "v": 31
}
```

| Поле | Тип | Призначення |
|---|---|---|
| `alias` | string ≤ 24 | вигаданий псевдонім («Лис-07») |
| `archived` | bool | профіль прихований із робочих списків, історія збережена |
| `balance` | int ≥ 0 | поточні зірки |
| `earned` | int ≥ 0 | зароблено за весь час (для рівня); не зменшується витратами |
| `recent` | int[] ≤ 10 | останні зараховані оцінки (для «Зростання») |
| `hot` | int[] | номери київських днів зарахованих оцінок ≥ `minGrade` для «Активного тижня» |
| `last` | {t, gs} | час і оцінки останнього зарахування (для м'якого застереження про повтор) |
| `lastOp` | string \| null | `opId` останньої операції; скасувати можна лише її |
| `lastAt` | map | мс останньої видачі позиції з `cooldownDays` |
| `stats` | map | лічильники для статистики/майбутніх досягнень |
| `counters` | map | лічильники за місяцем `YYMM` (квести, ліміти `perMonth`) |
| `achievements` | string[] | зарезервовано (порожньо в MVP) |
| `v` | int | версія для оптимістичного блокування (кожне оновлення `+1`) |

## 4. Журнал `profiles/{uuid}/ledger/{opId}`

Спільні поля кожного документа: `type`, `ts` (`serverTimestamp()`), `delta` (ціле, зміна балансу), `prev` (знімок полів профілю **до** операції; потрібен для скасування).

| `type` | Додаткові поля | `delta` |
|---|---|---|
| `credit` | `entries: [{g, v}]`, `events: [{quest, delta}]` | сума `v` + бонуси квестів |
| `redeem` | `item`, `qty` | від'ємна |
| `quest` | `quest` (ручний квест) | додатна |
| `adjust` | `reason` (код зі списку) | будь-яка |
| `void` | `ref` (скасований `opId`), `refType` | протилежна до `delta` скасованої операції |

**Знімок `prev`** містить поля: `balance`, `earned`, `recent`, `hot`, `last`, `lastOp`, `lastAt`, `stats`, `counters`, `achievements`. Розмір до ~1 КБ.

**Приклад `credit`:**

```json
{"type": "credit", "ts": "<serverTimestamp>", "delta": 11,
 "entries": [{"g": 11, "v": 5}, {"g": 9, "v": 3}],
 "events": [{"quest": "growth", "delta": 3}],
 "prev": {"balance": 12, "earned": 176, "recent": [...], "hot": [], "last": null, "lastOp": null,
          "lastAt": {}, "stats": {...}, "counters": {...}, "achievements": []}}
```

## 5. Інваріанти

1. `balance ≥ 0` завжди (Rules + транзакція).
2. `balance == Σ delta` усіх документів журналу (включно з `void`, які мають протилежну дельту).
3. `earned == Σ delta` документів `credit` і `quest`, зменшена на скасовані `credit`/`quest`.
4. Документи журналу не змінюються і не видаляються.
5. Скасувати можна лише операцію, `opId` якої дорівнює `profile.lastOp`; після скасування `lastOp = null`, тому повторно скасувати не вийде.
6. Профіль оновлюється лише із `v` на 1 більшим за поточне.
7. Запас у `config/stock` ≥ 0.

**Перевірка цілісності** (адмінпанель «Дані → Перевірити»): для кожного профілю прочитати журнал, порахувати `Σ delta` і `earned`, порівняти з профілем; розбіжності показати списком із кнопкою «Перерахувати з журналу» (записує `adjust` або виправляє поля після підтвердження).

## 6. Індекси та запити

| Запит | Індекс |
|---|---|
| Журнал профілю: `orderBy('ts','desc').limit(20)` | автоматичний одно-польовий |
| Список профілів (вчитель): `where('archived','==',false)` | автоматичний |
| Журнал для бюджету (за період): вибірка за `ts` у межах профілів | автоматичний; складені індекси не потрібні |

Жодних collection-group-запитів; Rules для них не відкриваються.

## 7. Міграції

Поле `schema` у `config/published` задає версію форми. При зміні форми: збільшити `schema`, написати ідемпотентний скрипт міграції в `src/data/migrate.js` (запускається вчителем вручну з адмінпанелі «Дані»), перед міграцією автоматично зробити експорт JSON.

## 8. Формат експорту

Один JSON-файл: `{"exportedAt", "schema", "config", "stock", "profiles": [{"id", "data", "ledger": [...]}], "audit": [...]}`. Без таблиці «UUID ↔ дитина» (її в базі немає). Імпорт: перевірка схеми, попередній перегляд відмінностей, підтвердження.

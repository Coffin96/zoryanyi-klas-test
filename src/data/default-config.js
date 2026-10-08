export const defaultConfig = {
  schema: 1,
  version: 1,
  publishedAt: "2026-10-09T14:00:00Z",
  settings: {
    currency: { name: "зірки", icon: "✦", forms: ["зірка", "зірки", "зірок"] },
    refItem: "caramel",
    dupWindowMin: 10,
    undoSeconds: 10,
    yearEnd: "2027-05-31",
    budgetAlertUah: 550,
    refPerStar: 0.321
  },
  grades: { "12": 6, "11": 5, "10": 4, "9": 3, "8": 2, "7": 1 },
  questMonthlyCap: 8,
  questWeeklyCap: 6,
  shop: [
    { id: "caramel", name: "Карамель", icon: "🍬", category: "sweet", price: 7, active: true, order: 1, unitCost: 2.25 },
    { id: "jelly", name: "Желейка", icon: "🍮", category: "sweet", price: 12, active: true, order: 2, unitCost: 3.96 },
    { id: "tartlet", name: "Тарталетка", icon: "🥧", category: "sweet", price: 17, active: true, order: 3, limits: { cooldownDays: 30 }, unitCost: 15.0, acceptSubsidy: true },
    { id: "priv_music", name: "Музика на перерві", icon: "🎵", category: "privilege", price: 6, active: true, order: 4, limits: { perMonth: 2 }, unitCost: 0 },
    { id: "priv_pc", name: "10 хв творчого часу за комп'ютером", icon: "💻", category: "privilege", price: 8, active: true, order: 5, limits: { perMonth: 2 }, unitCost: 0 }
  ],
  quests: [
    { id: "growth", type: "growth", title: "Зростання", icon: "📈", period: "week", active: true, reward: 3, perWeek: 1, params: { window: 10, minHistory: 5, delta: 2, minGrade: 7 } },
    { id: "streak", type: "streak", title: "Активний тиждень", icon: "🔥", period: "week", active: true, reward: 2, perWeek: 1, params: { length: 3, minGrade: 8, windowDays: 7 } },
    { id: "contrib", type: "manual", title: "Внесок у клас", icon: "🤝", period: "week", active: true, reward: 2, perWeek: 2 },
    { id: "clean", type: "manual", title: "Чистота й чергування", icon: "🧹", period: "week", active: true, reward: 1, perWeek: 2 },
    { id: "help", type: "manual", title: "Взаємодопомога", icon: "💛", period: "week", active: true, reward: 2, perWeek: 1 }
  ],
  levels: [
    { min: 0, name: "Іскорка" },
    { min: 30, name: "Зірка" },
    { min: 80, name: "Сузір'я" },
    { min: 150, name: "Туманність" },
    { min: 250, name: "Галактика" },
    { min: 400, name: "Всесвіт" }
  ],
  news: [
    { id: "n1", date: "2026-10-09", text: "Нова нагорода місяця!" }
  ]
};

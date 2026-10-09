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
  questMonthlyCap: 30,
  questWeeklyCap: 15,
  event: {
    name: "Конкурс",
    reward: 10,
    active: false
  },
  shop: [
    { id: "caramel", name: "Карамель", icon: "🍬", category: "sweet", price: 7, active: true, order: 1, unitCost: 2.25 },
    { id: "jelly", name: "Желейка", icon: "🍮", category: "sweet", price: 12, active: true, order: 2, unitCost: 3.96 },
    { id: "tartlet", name: "Тарталетка", icon: "🥧", category: "sweet", price: 17, active: true, order: 3, stock: 3, unitCost: 15.0, acceptSubsidy: true },
    { id: "priv_music", name: "Музика на перерві", icon: "🎵", category: "privilege", price: 6, active: true, order: 4, unitCost: 0 },
    { id: "priv_pc", name: "10 хв творчого часу за комп'ютером", icon: "💻", category: "privilege", price: 8, active: true, order: 5, unitCost: 0 }
  ],
  quests: [
    { id: "knowledge_gatherer", type: "weekly_count", title: "Збирач знань", icon: "📚", period: "weekly", active: true, reward: 3, perWeek: 1, params: { count: 4 }, desc: "Отримай 4 будь-які оцінки протягом тижня" },
    { id: "sequence", type: "consecutive", title: "Послідовність", icon: "🎯", period: "weekly", active: true, reward: 3, perWeek: 1, params: { minGrade: 7, length: 3 }, desc: "3 оцінки від 7 балів поспіль" },
    { id: "brilliant_result", type: "target_grade", title: "Блискучий результат", icon: "✨", period: "weekly", active: true, reward: 4, perWeek: 2, params: { grade: 12 }, desc: "Отримай оцінку 12 (до 2 разів на тиждень)" },
    { id: "steady_step", type: "monthly_growth", title: "Впевнений крок", icon: "📈", period: "monthly", active: true, reward: 10, perMonth: 1, params: { minTotalGrades: 10 }, desc: "Середній бал місяця вищий за попередній (від 10 оцінок)" },
    { id: "holding_height", type: "monthly_average", title: "Утримання висоти", icon: "👑", period: "monthly", active: true, reward: 15, perMonth: 1, params: { minAverage: 10 }, desc: "Середній бал понад 10 протягом місяця" },
    { id: "lifetime_50", type: "lifetime_milestone", title: "Перший ювілей", icon: "⭐", period: "lifetime", active: true, reward: 3, target: 50, limit: 1, description: "Назбирай 50 зірочок за весь час", desc: "Назбирай 50 зірочок за весь час" },
    { id: "lifetime_100", type: "lifetime_milestone", title: "Сотник зірок", icon: "🌟", period: "lifetime", active: true, reward: 5, target: 100, limit: 1, description: "Назбирай 100 зірочок за весь час", desc: "Назбирай 100 зірочок за весь час" }
  ],
  levels: [
    { min: 0, name: "Іскорка" },
    { min: 30, name: "Зірка" },
    { min: 80, name: "Сузір'я" },
    { min: 150, name: "Туманність" },
    { min: 250, name: "Галактика" },
    { min: 400, name: "Всесвіт" },
    { min: 600, name: "Наднова" },
    { min: 850, name: "Пульсар" },
    { min: 1150, name: "Квазар" },
    { min: 1500, name: "Астральний Вартовий" },
    { min: 2000, name: "Магістр Ефіру" },
    { min: 3000, name: "Астральний Лорд" },
    { min: 4500, name: "Хранитель Селестії" },
    { min: 6000, name: "Володар Зорепаду" },
    { min: 8000, name: "Творець Ефіру" },
    { min: 10000, name: "Легенда Всесвіту" }
  ],
  news: [
    { id: "n1", date: "2026-10-09", text: "Нова нагорода місяця!" }
  ]
};

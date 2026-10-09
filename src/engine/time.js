const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * Отримує рядок ISO тижня за київським часом (напр. '26W41').
 */
function getKyivWeek(y, m, d) {
  const target = new Date(Date.UTC(y, m - 1, d));
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNum = 1 + Math.round(((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return `${String(target.getUTCFullYear()).slice(2)}W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Київська дата з мілісекунд.
 * @param {number} ms 
 * @returns {{ymd: string, month: string, day: number, week: string}}
 */
export function kyivParts(ms) {
  const parts = fmt.formatToParts(ms);
  let y = 0, m = 0, d = 0;
  for (const p of parts) {
    if (p.type === 'year') y = Number(p.value);
    else if (p.type === 'month') m = Number(p.value);
    else if (p.type === 'day') d = Number(p.value);
  }
  return {
    ymd: `${String(y).slice(2)}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`,
    month: `${String(y).slice(2)}${String(m).padStart(2, '0')}`,
    day: Math.floor(Date.UTC(y, m - 1, d) / 86400000),
    week: getKyivWeek(y, m, d)
  };
}

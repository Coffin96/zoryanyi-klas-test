// Minimal local names DB using localStorage
const NAMES_KEY = 'zk_names_db';

export function getNamesDb() {
  try {
    const data = localStorage.getItem(NAMES_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
}

export function saveNamesDb(db) {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save names db', e);
  }
}

export function getInitials(alias) {
  const db = getNamesDb();
  const name = db[alias];
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0].toUpperCase()}.${parts[1][0].toUpperCase()}.`;
  }
  return parts[0] ? `${parts[0][0].toUpperCase()}.` : '';
}

export function setStudentName(alias, fullName) {
  const db = getNamesDb();
  db[alias] = fullName;
  saveNamesDb(db);
}

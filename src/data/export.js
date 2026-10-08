import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * Експорт усіх профілів та конфігурації у JSON-об'єкт
 */
export async function exportAllData() {
  const profilesSnap = await getDocs(collection(db, "profiles"));
  const profiles = [];
  profilesSnap.forEach(d => {
    profiles.push({ id: d.id, ...d.data() });
  });

  let config = null;
  try {
    const configSnap = await getDoc(doc(db, "config", "published"));
    if (configSnap.exists()) {
      config = configSnap.data();
    }
  } catch (e) {
    console.warn("Could not fetch config for backup", e);
  }

  let stock = null;
  try {
    const stockSnap = await getDoc(doc(db, "config", "stock"));
    if (stockSnap.exists()) {
      stock = stockSnap.data();
    }
  } catch (e) {
    console.warn("Could not fetch stock for backup", e);
  }

  return {
    version: 1,
    app: "zoryanyi-klas",
    exportedAt: new Date().toISOString(),
    profilesCount: profiles.length,
    profiles,
    config,
    stock
  };
}

/**
 * Завантажити файл резервної копії на пристрій
 */
export function downloadBackupFile(backupData) {
  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `zoryanyi-klas-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Відновлення даних із JSON-резервної копії
 */
export async function importBackupData(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    throw new Error("Невірний формат файлу. Очікується дійсний JSON.");
  }

  if (!data || !Array.isArray(data.profiles)) {
    throw new Error("Файл не містить списку учнів (profiles).");
  }

  const batch = writeBatch(db);

  data.profiles.forEach(p => {
    const pId = p.id || crypto.randomUUID();
    const pRef = doc(db, "profiles", pId);
    const pData = { ...p };
    delete pData.id; // Не зберігаємо id всередині документу
    batch.set(pRef, pData, { merge: true });
  });

  if (data.config) {
    const cfgRef = doc(db, "config", "published");
    batch.set(cfgRef, data.config, { merge: true });
  }

  if (data.stock) {
    const stockRef = doc(db, "config", "stock");
    batch.set(stockRef, data.stock, { merge: true });
  }

  await batch.commit();

  return {
    profilesRestored: data.profiles.length,
    configRestored: !!data.config
  };
}

import { checkDataIntegrity } from '../engine/helpers.js';
export { checkDataIntegrity };

/**
 * Автоматичне виправлення виявлених порушень цілісності
 */
export async function fixIntegrityIssues(profiles, issues) {
  const batch = writeBatch(db);
  let fixedCount = 0;

  for (const issue of issues) {
    const prof = profiles.find(p => p.id === issue.uuid);
    if (!prof) continue;

    const pRef = doc(db, "profiles", prof.id);
    const updates = {};

    if (issue.type === 'negative-balance') {
      updates.balance = 0;
      fixedCount++;
    } else if (issue.type === 'earned-less-than-balance') {
      updates.earned = Math.max(0, prof.balance || 0);
      fixedCount++;
    }

    if (Object.keys(updates).length > 0) {
      batch.update(pRef, updates);
    }
  }

  if (fixedCount > 0) {
    await batch.commit();
  }

  return fixedCount;
}

/**
 * Завершення року: обнулення балансів з архівацією
 */
export async function archiveYearEnd(profiles) {
  const batch = writeBatch(db);
  const nowStr = new Date().toISOString().slice(0, 10);

  profiles.forEach(p => {
    const pRef = doc(db, "profiles", p.id);
    const prevBalances = p.stats?.yearEndBalances || [];
    prevBalances.push({ date: nowStr, balance: p.balance || 0, earned: p.earned || 0 });

    batch.update(pRef, {
      balance: 0,
      'stats.yearEndBalances': prevBalances,
      counters: {} // Скидаємо місячні ліміти квестів
    });
  });

  await batch.commit();
}

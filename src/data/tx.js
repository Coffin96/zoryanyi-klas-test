import { runTransaction as firestoreRunTransaction, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { creditGrades } from "../engine/economy.js";
import { redeem as engineRedeem } from "../engine/redeem.js";
import { undoLast, adjust as engineAdjust } from "../engine/undo.js";
import { awardManual as engineAwardManual } from "../engine/quests.js";

// Helper to run a generic profile update transaction
async function runOp(uuid, opId, cfg, opFn) {
  return firestoreRunTransaction(db, async (tx) => {
    const pRef = doc(db, "profiles", uuid);
    const pSnap = await tx.get(pRef);
    if (!pSnap.exists()) throw new Error("profile-not-found");
    const profile = pSnap.data();

    if (profile.lastOp === opId) return { ok: true, reason: 'already-applied' };

    // Читаємо актуальний документ конфігурації для контролю залишків
    const cfgRef = doc(db, "config", "published");
    const cfgSnap = await tx.get(cfgRef);
    const publishedCfg = cfgSnap.exists() ? cfgSnap.data() : (cfg || {});

    const stockRef = doc(db, "config", "stock");
    const stockSnap = await tx.get(stockRef);
    const stock = stockSnap.exists() ? (stockSnap.data().items || {}) : {};

    const nowMs = Date.now(); // Note: server time is ideal, but logic needs MS. We use client time for logic, but serverTimestamp for 'ts'.
    
    const result = opFn(profile, publishedCfg, nowMs, stock);
    if (!result.ok) throw new Error(result.reason);

    const { profile: nextProfile, delta, prev, entries, events, item, qty, stockDelta, type, reason } = result;

    // 1. Оптимістичне блокування (v + 1)
    nextProfile.v = profile.v + 1;
    nextProfile.lastOp = opId;

    // 2. Оновлення профілю
    tx.update(pRef, nextProfile);

    // 3. Запис у журнал (ledger)
    const ledgerRef = doc(db, "profiles", uuid, "ledger", opId);
    
    const ledgerEntry = {
      type: type,
      ts: serverTimestamp(),
      delta: delta,
      prev: prev
    };

    if (type === 'credit') {
      ledgerEntry.entries = entries;
      ledgerEntry.events = events;
    } else if (type === 'redeem') {
      ledgerEntry.item = item;
      ledgerEntry.qty = qty;
    } else if (type === 'adjust') {
      ledgerEntry.reason = reason;
    } else if (type === 'quest') {
      ledgerEntry.quest = events[0]?.quest;
    } else if (type === 'void') {
      ledgerEntry.ref = result.refId;
      ledgerEntry.refType = result.refType;
    }

    tx.set(ledgerRef, ledgerEntry);

    // 4. Оновлення глобального залишку товару в config/published у цій же транзакції
    if (type === 'redeem') {
      const shopItems = publishedCfg.shop ? [...publishedCfg.shop] : [];
      const shopItemIndex = shopItems.findIndex(it => it.id === item);
      if (shopItemIndex !== -1 && typeof shopItems[shopItemIndex].stock === 'number') {
        const currentStock = shopItems[shopItemIndex].stock;
        if (currentStock <= 0) {
          throw new Error("Розпродано");
        }
        const dec = qty != null ? qty : 1;
        if (currentStock < dec) {
          throw new Error("Розпродано");
        }
        shopItems[shopItemIndex] = {
          ...shopItems[shopItemIndex],
          stock: currentStock - dec
        };
        tx.update(cfgRef, { shop: shopItems });
      }
    } else if (type === 'void' && result.refType === 'redeem' && result.item) {
      const shopItems = publishedCfg.shop ? [...publishedCfg.shop] : [];
      const shopItemIndex = shopItems.findIndex(it => it.id === result.item);
      if (shopItemIndex !== -1 && typeof shopItems[shopItemIndex].stock === 'number') {
        const inc = result.qty != null ? result.qty : 1;
        shopItems[shopItemIndex] = {
          ...shopItems[shopItemIndex],
          stock: shopItems[shopItemIndex].stock + inc
        };
        tx.update(cfgRef, { shop: shopItems });
      }
    }

    // 5. Оновлення запасів config/stock (сумісність)
    if (stockDelta && Object.keys(stockDelta).length > 0) {
      const nextStock = { ...stock };
      let stockChanged = false;
      for (const [id, d] of Object.entries(stockDelta)) {
        if (nextStock[id] != null) {
          nextStock[id] += d;
          stockChanged = true;
        }
      }
      if (stockChanged) {
        tx.update(stockRef, { items: nextStock });
      }
    }

    return { ok: true, delta };
  });
}

export async function credit(uuid, opId, cfg, grades) {
  return runOp(uuid, opId, cfg, (p, c, nowMs) => {
    const res = creditGrades(p, grades, c, nowMs);
    return { ok: true, type: 'credit', ...res };
  });
}

export async function redeem(uuid, opId, cfg, itemObj, qty = 1) {
  return runOp(uuid, opId, cfg, (p, c, nowMs, stock) => {
    const shopItem = (c.shop || []).find(it => it.id === itemObj.id) || itemObj;
    if (typeof shopItem.stock === 'number') {
      if (shopItem.stock <= 0 || (qty != null && shopItem.stock < qty)) {
        return { ok: false, reason: 'Розпродано' };
      }
    }
    const res = engineRedeem(p, shopItem, qty, c, nowMs, stock);
    if (!res.ok) {
      if (res.reason === 'out-of-stock') return { ok: false, reason: 'Розпродано' };
      return res;
    }
    return { ...res, type: 'redeem', item: itemObj.id, qty };
  });
}

export async function awardManual(uuid, opId, cfg, questId) {
  return runOp(uuid, opId, cfg, (p, c, nowMs) => {
    const res = engineAwardManual(p, questId, c, nowMs);
    if (!res.ok) return res;
    return { ...res, type: 'quest' };
  });
}

export async function undo(uuid, opId, cfg, targetOpDoc) {
  return runOp(uuid, opId, cfg, (p) => {
    const res = undoLast(p, targetOpDoc);
    if (!res.ok) return res;
    return { ...res, type: 'void', refId: targetOpDoc.id, refType: targetOpDoc.type, item: targetOpDoc.item, qty: targetOpDoc.qty };
  });
}

export async function adjust(uuid, opId, cfg, amount, reasonCode) {
  return runOp(uuid, opId, cfg, (p) => {
    const res = engineAdjust(p, amount, reasonCode);
    if (!res.ok) return res;
    return { ...res, type: 'adjust' };
  });
}

export async function runTransaction(uuid, type, amount, reason) {
  const opId = crypto.randomUUID();
  const cfg = (typeof window !== 'undefined' && window.zklas?.config) || {};
  const numAmount = Number(amount) || 0;
  const delta = (type === 'add' || type === 'credit') ? Math.abs(numAmount) : -Math.abs(numAmount);

  return runOp(uuid, opId, cfg, (p) => {
    if (delta < 0 && p.balance + delta < 0) {
      return { ok: false, reason: 'insufficient-funds' };
    }
    const prev = structuredClone(p);
    const next = structuredClone(p);
    next.balance += delta;
    if (delta > 0) {
      next.earned = (next.earned || 0) + delta;
    }
    return { ok: true, prev, profile: next, delta, type: 'adjust', reason };
  });
}

if (typeof window !== 'undefined') {
  window.runTransaction = runTransaction;
}


import { runTransaction, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { creditGrades } from "../engine/economy.js";
import { redeem as engineRedeem } from "../engine/redeem.js";
import { undoLast, adjust as engineAdjust } from "../engine/undo.js";
import { awardManual as engineAwardManual } from "../engine/quests.js";

// Helper to run a generic profile update transaction
async function runOp(uuid, opId, cfg, opFn) {
  return runTransaction(db, async (tx) => {
    const pRef = doc(db, "profiles", uuid);
    const pSnap = await tx.get(pRef);
    if (!pSnap.exists()) throw new Error("profile-not-found");
    const profile = pSnap.data();

    if (profile.lastOp === opId) return { ok: true, reason: 'already-applied' };

    const stockRef = doc(db, "config", "stock");
    const stockSnap = await tx.get(stockRef);
    const stock = stockSnap.exists() ? (stockSnap.data().items || {}) : {};

    const nowMs = Date.now(); // Note: server time is ideal, but logic needs MS. We use client time for logic, but serverTimestamp for 'ts'.
    
    const result = opFn(profile, cfg, nowMs, stock);
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

    // 4. Оновлення запасів
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

export async function redeem(uuid, opId, cfg, itemObj, qty) {
  return runOp(uuid, opId, cfg, (p, c, nowMs, stock) => {
    const res = engineRedeem(p, itemObj, qty, c, nowMs, stock);
    if (!res.ok) return res;
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
    return { ...res, type: 'void', refId: targetOpDoc.id, refType: targetOpDoc.type };
  });
}

export async function adjust(uuid, opId, cfg, amount, reasonCode) {
  return runOp(uuid, opId, cfg, (p) => {
    const res = engineAdjust(p, amount, reasonCode);
    if (!res.ok) return res;
    return { ...res, type: 'adjust' };
  });
}

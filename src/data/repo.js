import { doc, collection, onSnapshot, getDoc, getDocs, query, orderBy, limit, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";

export function listenConfig(onNext, onError) {
  return onSnapshot(doc(db, "config", "published"), (docSnap) => {
    if (docSnap.exists()) onNext(docSnap.data());
    else onError(new Error("Config not found"));
  }, onError);
}

export function listenStock(onNext, onError) {
  return onSnapshot(doc(db, "config", "stock"), (docSnap) => {
    if (docSnap.exists()) onNext(docSnap.data().items || {});
    else onNext({}); // no stock limits
  }, onError);
}

export function listenProfile(uuid, onNext, onError) {
  return onSnapshot(doc(db, "profiles", uuid), (docSnap) => {
    if (docSnap.exists()) onNext({ id: docSnap.id, ...docSnap.data() });
    else onError(new Error("Profile not found"));
  }, onError);
}

export async function getProfile(uuid) {
  const snap = await getDoc(doc(db, "profiles", uuid));
  if (!snap.exists()) throw new Error("Profile not found");
  return { id: snap.id, ...snap.data() };
}

export function listenLedger(uuid, limitCount = 20, onNext, onError) {
  const q = query(collection(db, "profiles", uuid, "ledger"), orderBy("ts", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    onNext(items);
  }, onError);
}

export async function getActiveProfiles() {
  const q = query(collection(db, "profiles"), where("archived", "==", false));
  const snap = await getDocs(q);
  const profiles = [];
  snap.forEach(d => profiles.push({ id: d.id, ...d.data() }));
  return profiles;
}

export async function updateStudentAlias(uuid, alias) {
  return updateDoc(doc(db, "profiles", uuid), { alias });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Ініціалізація
const app = initializeApp(firebaseConfig);

// Авторизація
export const auth = getAuth(app);

// Firestore з кешуванням
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Функції для вчителя
export async function loginTeacher(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutTeacher() {
  return signOut(auth);
}

export function onTeacherStateChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

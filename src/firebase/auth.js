import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './config.js';

export async function register(email, password, displayName, role = 'client') {
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCred.user, { displayName });
  const userDoc = doc(db, 'users', userCred.user.uid);
  await setDoc(userDoc, {
    uid: userCred.user.uid,
    email,
    displayName,
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return userCred.user;
}

export async function login(email, password) {
  const userCred = await signInWithEmailAndPassword(auth, email, password);
  return userCred.user;
}

export async function logout() {
  await signOut(auth);
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
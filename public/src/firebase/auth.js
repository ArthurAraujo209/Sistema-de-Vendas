import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, addDoc, getDoc, collection } from 'firebase/firestore';
import { auth, db } from './config.js';

export async function register(email, password, displayName, role = 'client', phone = '') {
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCred.user, { displayName });
  const userDoc = doc(db, 'users', userCred.user.uid);
  await setDoc(userDoc, {
    uid: userCred.user.uid,
    email,
    displayName,
    role,
    phone,
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

export async function requestSellerAccount(data) {
  const docRef = await addDoc(collection(db, 'sellerApplications'), {
    ...data,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
}
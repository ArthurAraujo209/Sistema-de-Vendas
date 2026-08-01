import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, addDoc, getDoc, collection } from 'firebase/firestore';
import { auth, db } from './config.js';
import { store } from '../store.js';

const googleProvider = new GoogleAuthProvider();

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

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  
  // Verifica se o usuário já existe no Firestore; se não, cria com role 'client'
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) {
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: 'client',
      phone: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  return user;
}

export async function logout() {
  await signOut(auth);
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const profile = snap.data();
  
  // Verificação de assinatura para vendedores
  if (profile.role === 'seller') {
    const now = new Date();
    const expiry = profile.subscriptionExpiry ? new Date(profile.subscriptionExpiry) : null;
    if (expiry && now > expiry && profile.subscriptionStatus === 'active') {
      // Assinatura expirou, atualizar status
      await setDoc(doc(db, 'users', uid), { subscriptionStatus: 'expired', updatedAt: new Date().toISOString() }, { merge: true });
      profile.subscriptionStatus = 'expired';
    }
    // Se estiver expirada ou inativa, ainda permite login mas mostra aviso
  }
  
  return profile;
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
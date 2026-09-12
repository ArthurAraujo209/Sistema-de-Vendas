import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, setDoc, addDoc, getDoc, collection } from 'firebase/firestore';
import { auth, db } from './config.js';

const googleProvider = new GoogleAuthProvider();

// ===== Registro (email/senha) =====
export async function register(email, password, displayName, role = 'client', phone = '', photoUrl = '') {
  const userCred = await createUserWithEmailAndPassword(auth, email, password);

  // Atualiza perfil do Auth (displayName + photoURL se houver)
  const authUpdates = { displayName };
  if (photoUrl) authUpdates.photoURL = photoUrl;
  await updateProfile(userCred.user, authUpdates);

  // Só marca profileCompleted=true se os campos essenciais vierem preenchidos
  const completed = !!(displayName && phone);

  await setDoc(doc(db, 'users', userCred.user.uid), {
    uid: userCred.user.uid,
    email: email.toLowerCase().trim(),
    displayName,
    role,
    phone: phone || '',
    photoUrl: photoUrl || '',
    profileCompleted: completed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  return userCred.user;
}

// ===== Login =====
export async function login(email, password) {
  const userCred = await signInWithEmailAndPassword(auth, email, password);
  return userCred.user;
}

// ===== Garante que o doc do usuário exista (Google) =====
async function ensureUserDoc(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      photoUrl: user.photoURL || '',
      role: 'client',
      phone: '',
      profileCompleted: false,   // Google sempre começa incompleto
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

// ===== Google =====
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(result.user);
    return result.user;
  } catch (err) {
    if (err.code === 'auth/popup-blocked'
        || err.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    if (err.code === 'auth/account-exists-with-different-credential') {
      const email = err.customData?.email || '';
      throw new Error(
        `O e-mail ${email} já está cadastrado com senha. Faça login com e-mail e senha.`
      );
    }
    throw err;
  }
}

export async function resolveGoogleRedirect() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await ensureUserDoc(result.user);
      return result.user;
    }
  } catch (err) {
    console.warn('[auth] redirect:', err?.code || err?.message);
  }
  return null;
}

// ===== Logout =====
export async function logout() {
  await signOut(auth);
}

// ===== Perfil (com retry) =====
async function fetchProfileOnce(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Busca o perfil com tentativas — útil no primeiro login logo após o register,
 * quando o setDoc pode ainda não ter terminado de gravar.
 */
export async function getUserProfile(uid, { retries = 4, delayMs = 250 } = {}) {
  for (let i = 0; i <= retries; i++) {
    const profile = await fetchProfileOnce(uid);
    if (profile) {
      // Verificação de assinatura (vendedores)
      if (profile.role === 'seller' && profile.subscriptionExpiry) {
        const now = new Date();
        const expiry = new Date(profile.subscriptionExpiry);
        if (!isNaN(expiry.getTime()) && now > expiry && profile.subscriptionStatus === 'active') {
          setDoc(
            doc(db, 'users', uid),
            { subscriptionStatus: 'expired', updatedAt: new Date().toISOString() },
            { merge: true }
          ).catch(() => {});
          profile.subscriptionStatus = 'expired';
        }
      }
      return profile;
    }
    if (i < retries) await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}

export function observeAuthState(cb) {
  return onAuthStateChanged(auth, cb);
}

// ===== Reset de senha =====
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ===== Solicitação de vendedor =====
export async function requestSellerAccount(data) {
  const { password, ...safeData } = data;
  const docRef = await addDoc(collection(db, 'sellerApplications'), {
    ...safeData,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
}

// ===== Persistência =====
export async function applyAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    console.warn('[auth] persistence:', err?.message);
  }
}

// ===== Atualização de perfil (usada pelo Profile.js) =====
export async function saveUserProfile(uid, updates) {
  // Atualiza Auth (se veio displayName ou photoUrl)
  const authUpdates = {};
  if (updates.displayName) authUpdates.displayName = updates.displayName;
  if (updates.photoUrl) authUpdates.photoURL = updates.photoUrl;
  if (Object.keys(authUpdates).length && auth.currentUser) {
    await updateProfile(auth.currentUser, authUpdates);
  }

  // Verifica se o perfil fica completo agora
  const snap = await getDoc(doc(db, 'users', uid));
  const existing = snap.exists() ? snap.data() : {};
  const merged = { ...existing, ...updates };
  const completed = !!(merged.displayName && merged.phone);

  await setDoc(doc(db, 'users', uid), {
    ...updates,
    profileCompleted: completed,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  return { ...merged, profileCompleted: completed };
}
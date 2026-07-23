import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAnalytics } from "firebase/analytics";
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';


const firebaseConfig = {
  apiKey: "AIzaSyD_ViGX4OUPr_6jY_Ia_LYj4tQMFj0pN8w",
  authDomain: "sistema-de-camisas.firebaseapp.com",
  projectId: "sistema-de-camisas",
  storageBucket: "sistema-de-camisas.firebasestorage.app",
  messagingSenderId: "34250824813",
  appId: "1:34250824813:web:2d060650a010638c937364",
  measurementId: "G-7E28CEYPB2"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);


// Se quiser usar emuladores localmente, descomente:
// connectFirestoreEmulator(db, 'localhost', 8080);
// connectAuthEmulator(auth, 'http://localhost:9099');
// connectStorageEmulator(storage, 'localhost', 9199);
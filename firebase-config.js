// firebase-config.js

// Imports necessários para Auth, Firestore e Storage
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js"; 

// Seus detalhes de configuração do Firebase (COPIADOS DO SEU PROJETO!)
const firebaseConfig = {
  apiKey: "AIzaSyBBbTjpef6IjmfRlTSAE-VfU07-JFWkFS4",
  authDomain: "choro-2650b.firebaseapp.com",
  projectId: "choro-2650b",
  storageBucket: "choro-2650b.firebasestorage.app",
  messagingSenderId: "546533596573",
  appId: "1:546533596573:web:3336dda4b8991c45882374"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços que você vai usar
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Você pode remover o `storage` das exportações, já que ele não será usado com o plano Spark/Local.
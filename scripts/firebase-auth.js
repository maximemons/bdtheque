import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyB74A20CTGGkH-UCQzBofLDx7iBMy3LzV0",
    authDomain: "bdtheque-5d26a.firebaseapp.com",
    projectId: "bdtheque-5d26a",
    storageBucket: "bdtheque-5d26a.firebasestorage.app",
    messagingSenderId: "361933014530",
    appId: "1:361933014530:web:72f1e10d3e891ac245c91b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function getCurrentUser() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => {
            resolve(user);
        }, reject);
    });
}

async function logout() {
    try {
        await signOut(auth);
        window.location.href = "https://maximemons.github.io/bdtheque/";
    } catch (error) {
        console.error("Erreur lors de la déconnexion :", error);
    }
}

export { app, auth, getCurrentUser, logout };
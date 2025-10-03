import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

export { auth };
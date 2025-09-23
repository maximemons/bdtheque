const auth = firebase.auth();

const googleProvider = new firebase.auth.GoogleAuthProvider();

// DOM Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const googleBtn = document.getElementById('googleBtn');
const errorDiv = document.getElementById('error');

// Login avec email/mot de passe
loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Connexion réussie, rediriger ou faire autre chose
            window.location.href = 'dashboard/dashboard.html';
        })
        .catch((error) => {
            errorDiv.textContent = error.message;
        });
});

// Login avec Google
googleBtn.addEventListener('click', () => {
    auth.signInWithPopup(googleProvider)
        .then((result) => {
            // Connexion réussie, rediriger ou faire autre chose
            window.location.href = 'dashboard/dashboard.html';
        })
        .catch((error) => {
            errorDiv.textContent = error.message;
        });
});
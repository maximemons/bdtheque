const auth = firebase.auth();

// DOM Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
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

[document.getElementById("email"), document.getElementById("password")].forEach(input => {
    input.addEventListener('keydown', function(event) { 
        if (event.key === 'Enter') 
            loginBtn.click();
    });
});
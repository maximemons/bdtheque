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

let eeh1Clics = 0;
let eeh1 = document.getElementById("loginTitle");
eeh1.addEventListener("click", () => {
    let h1 = eeh1;
    eeh1Clics++;
      
    if (eeh1Clics >= 4) {
        // On split chaque lettre dans un span
        const text = h1.textContent;
        h1.textContent = ''; // on vide le H1
        for (let char of text) {
          const span = document.createElement('span');
          span.textContent = char;
          h1.appendChild(span);
        }

        // On fait un effet “cassé” sur chaque lettre
        const spans = h1.querySelectorAll('span');
        spans.forEach(span => {
          const x = (Math.random() - 0.5) * 20; // déplacement horizontal
          const y = (Math.random() - 0.5) * 20; // déplacement vertical
          const r = (Math.random() - 0.5) * 30; // rotation
          const color = `hsl(${Math.random()*360}, 100%, 50%)`; // couleur aléatoire
          span.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
          span.style.color = color;
        });
    }
});

function resetPassword(e) {
    e.preventDefault();
    const email = document.getElementById("email").value;

    if(email.trim() == "") {
        alert("Entrez d'abord votre mail !");
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {alert("Un email de réinitialisation à été envoyé !");})
        .catch((error) => {alert("Une erreur s'est produite : " + error.message());});
}

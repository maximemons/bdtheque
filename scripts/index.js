import { auth } from './firebase-auth.js';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorDiv = document.getElementById('error');
const successDiv = document.getElementById('success');

loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            window.location.href = 'dashboard/dashboard.html';
        })
        .catch((error) => {
            errorDiv.textContent = error.message;
        });
});

document.getElementById("forgetPwd").addEventListener('click', (event) => {
    event.preventDefault();
    const email = emailInput.value;

    if(email.trim() == "") {
        errorDiv.textContent = "Entrez d'abord votre mail !";
        successDiv.textContent = "";
        return;
    }
    sendPasswordResetEmail(auth, email)
        .then(() => {
            successDiv.textContent = "Email de réinitialisation envoyé !";
            errorDiv.textContent = "";
        })
        .catch((error) => {
            errorDiv.textContent = error.message;
            successDiv.textContent = "";
        });

    auth.sendPasswordResetEmail(email)
        .then(() => {alert("Un email de réinitialisation à été envoyé !");})
        .catch((error) => {alert("Une erreur s'est produite : " + error.message());});

});


[document.getElementById("email"), document.getElementById("password")].forEach(input => {
    input.addEventListener('keydown', function(event) { 
        if (event.key === 'Enter') 
            loginBtn.click();
    });
});


//INIT EASTER EGG
let eeh1Clics = 0;
let eeh1 = document.getElementById("loginTitle");
eeh1.addEventListener("click", (event) => {
    event.preventDefault();
    let h1 = eeh1;
    eeh1Clics++;
      
    if (eeh1Clics >= 4) {
        const text = h1.textContent;
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
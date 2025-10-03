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
const el = document.getElementById('myEgg');
const text = el.textContent.trim();

el.innerHTML = '';
for (let i = 0; i < text.length; i++){
    const ch = text[i];
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? '\u00A0' : ch;
    el.appendChild(span);
}

el.addEventListener('mousedown', e => e.preventDefault());
el.addEventListener('selectstart', e => e.preventDefault());

function triggerGlitch(){
    el.classList.add('active');
    setTimeout(()=> el.classList.remove('active'), 800);
}

el.addEventListener('click', triggerGlitch);
el.addEventListener('keydown', function(e){
    if (e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      triggerGlitch();
  }
});
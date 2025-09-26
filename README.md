<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inscription</title>
  <link rel="stylesheet" href="style.css">
  <!-- Firebase SDK -->
  <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore-compat.js"></script>
</head>
<body>
  <div class="container">
    <h1>Inscription</h1>
    <form id="inscriptionForm">
      <div class="form-group">
        <label for="email">Email*</label>
        <input type="email" id="email" required>
      </div>
      <div class="form-group">
        <label for="password">Mot de passe*</label>
        <input type="password" id="password" required>
        <div id="passwordHelp" class="help-text"></div>
      </div>
      <div class="form-group">
        <label for="nom">Nom</label>
        <input type="text" id="nom">
      </div>
      <div class="form-group">
        <label for="prenom">Prénom</label>
        <input type="text" id="prenom">
      </div>
      <div class="form-group">
        <label for="avatar">Avatar (URL)</label>
        <input type="url" id="avatar">
      </div>
      <div class="form-group checkbox-group">
        <input type="checkbox" id="peutModifier">
        <label for="peutModifier">Peut modifier</label>
      </div>
      <button type="submit">S'inscrire</button>
      <div id="errorMessage" class="error-message"></div>
    </form>
  </div>
  <script src="app.js"></script>
</body>
</html>

body {
  font-family: Arial, sans-serif;
  background-color: #f5f5f5;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.container {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

h1 {
  text-align: center;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

input[type="email"],
input[type="password"],
input[type="text"],
input[type="url"] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.checkbox-group {
  display: flex;
  align-items: center;
}

.checkbox-group input {
  margin-right: 0.5rem;
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

button:hover {
  background-color: #3367d6;
}

.help-text {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.25rem;
}

.error-message {
  color: #d32f2f;
  margin-top: 1rem;
  text-align: center;
}

// Configuration Firebase (à remplacer par la tienne)
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TON_PROJET.firebaseapp.com",
  projectId: "TON_PROJET",
  storageBucket: "TON_PROJET.appspot.com",
  messagingSenderId: "TON_ID",
  appId: "TON_APP_ID"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Gestion du formulaire
document.getElementById('inscriptionForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const nom = document.getElementById('nom').value;
  const prenom = document.getElementById('prenom').value;
  const avatar = document.getElementById('avatar').value;
  const peutModifier = document.getElementById('peutModifier').checked;

  // Validation du mot de passe
  if (!validerMotDePasse(password)) {
    document.getElementById('errorMessage').textContent = "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.";
    return;
  }

  try {
    // Création de l'utilisateur dans Firebase Auth
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Sauvegarde des données supplémentaires dans Firestore
    await db.collection('users').doc(email).set({
      uid: user.uid,
      email: email,
      nom: nom || null,
      prenom: prenom || null,
      avatar: avatar || null,
      peutModifier: peutModifier,
      dateInscription: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Utilisateur créé avec succès !");
    document.getElementById('inscriptionForm').reset();
  } catch (error) {
    document.getElementById('errorMessage').textContent = error.message;
  }
});

// Validation du mot de passe en temps réel
document.getElementById('password').addEventListener('input', (e) => {
  const password = e.target.value;
  const helpText = document.getElementById('passwordHelp');
  if (password.length === 0) {
    helpText.textContent = "";
    return;
  }
  if (validerMotDePasse(password)) {
    helpText.textContent = "Mot de passe valide";
    helpText.style.color = "green";
  } else {
    helpText.textContent = "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.";
    helpText.style.color = "red";
  }
});

// Fonction de validation du mot de passe
function validerMotDePasse(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
}

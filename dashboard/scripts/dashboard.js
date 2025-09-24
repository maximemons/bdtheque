const auth = firebase.auth();

auth.onAuthStateChange((user) => {
  if(!user) {
    window.location.href = "../index.html";
  } else {
    // Afficher le user name et mail
  }
});

function logout() {
  auth.signOut().then(() => window.location.href = "../login.html");
}

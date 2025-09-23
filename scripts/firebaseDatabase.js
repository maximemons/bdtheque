// Initialiser Firebase
firebase.initializeApp(firebaseConfig);

// Initialiser Firestore
const db = firebase.firestore();

// Lire la collection "parametres"
db.collection("parametres").get()
  .then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      console.log("ID du document :", doc.id);
      console.log("Données :", doc.data());
    });
  })
  .catch((error) => {
    console.error("Erreur lors de la récupération des paramètres :", error);
  });

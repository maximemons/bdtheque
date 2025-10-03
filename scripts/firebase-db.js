import { getFirestore, collection, getCountFromServer, query, where, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from "./firebase-auth.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const db = getFirestore(app);
const auth = getAuth(app);

// Fonction utilitaire pour vérifier l'authentification
async function checkAuth() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                resolve(user);
            } else {
                reject(new Error("Non authentifié. Veuillez vous connecter."));
            }
        });
    });
}

// GET: Tous les documents d'une collection
async function getAllDocuments(collectionName) {
    await checkAuth();
    const coll = collection(db, collectionName);
    const snapshot = await getDocs(coll);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// GET: Documents d'une collection avec un filtre where
async function getDocumentsWithWhere(collectionName, whereClauses) {
    await checkAuth();
    const coll = collection(db, collectionName);
    let q = query(coll);
    whereClauses.forEach(clause => {
        q = query(q, where(clause.field, clause.operator, clause.value));
    });
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// GET: Un document spécifique par son ID
async function getDocumentById(collectionName, docId) {
    await checkAuth();
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
    } else {
        throw new Error("Document non trouvé");
    }
}

// CREATE/UPDATE: Ajouter ou mettre à jour un document (avec ou sans ID spécifique)
async function setDocument(collectionName, docId, data) {
    await checkAuth();
    const docRef = docId ? doc(db, collectionName, docId) : doc(collection(db, collectionName));
    await setDoc(docRef, data);
    return docRef.id;
}

// UPDATE: Mettre à jour un document existant
async function updateDocument(collectionName, docId, data) {
    await checkAuth();
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, data);
}

// DELETE: Supprimer un document
async function deleteDocument(collectionName, docId) {
    await checkAuth();
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
}

// COUNT: Compter tous les documents d'une collection
async function countDocuments(collectionName) {
    await checkAuth();
    const coll = collection(db, collectionName);
    const snapshot = await getCountFromServer(coll);
    return snapshot.data().count;
}

// COUNT: Compter les documents d'une collection avec un filtre where
async function countDocumentsWithWhere(collectionName, whereClauses) {
    await checkAuth();
    const coll = collection(db, collectionName);

    let q = query(coll);
    whereClauses.forEach(clause => {
        q = query(q, where(clause.field, clause.operator, clause.value));
    });

    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
}

export {
    db,
    getAllDocuments,
    getDocumentsWithWhere,
    getDocumentById,
    setDocument,
    updateDocument,
    deleteDocument,
    countDocuments,
    countDocumentsWithWhere
};

import { getFirestore, collection, getCountFromServer, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from "./firebase-auth.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const db = getFirestore(app);
const auth = getAuth(app);

// Vérifie que l'utilisateur est connecté.
// Après le bootstrap de la page (getCurrentUser() résolu), Firebase Auth maintient
// l'état en mémoire — auth.currentUser est disponible de façon synchrone et instantanée,
// sans aucun listener ni requête réseau.
function checkAuth() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Non authentifié. Veuillez vous connecter.");
    }
    return user;
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

// GET: Une page de documents, filtrée et triée, avec pagination par curseur.
// whereClauses : [{field, operator, value}, ...]
// orderByField : champ de tri (obligatoire pour une pagination stable)
// pageSize : nombre de documents à charger
// afterDoc : le dernier "rawDoc" de la page précédente (voir rawDoc ci-dessous), ou undefined pour la 1ère page.
// Retourne { items: [{id, ...data}], rawDocs: [QueryDocumentSnapshot], hasMore: boolean }
// rawDocs doit être conservé par l'appelant et repassé en tant que afterDoc (son dernier élément)
// pour charger la page suivante.
async function getDocumentsPage(collectionName, whereClauses, orderByField, pageSize, afterDoc) {
    await checkAuth();
    const coll = collection(db, collectionName);
    let q = query(coll);
    whereClauses.forEach(clause => {
        q = query(q, where(clause.field, clause.operator, clause.value));
    });
    q = query(q, orderBy(orderByField));
    if (afterDoc) {
        q = query(q, startAfter(afterDoc));
    }
    q = query(q, limit(pageSize));

    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return {
        items,
        rawDocs: snapshot.docs,
        hasMore: snapshot.docs.length === pageSize
    };
}

// GET: Documents dont orderByField commence par "prefix" (recherche "préfixe", native Firestore,
// rapide même sur de grosses collections car elle s'appuie sur l'index du champ).
// N'attrape PAS les correspondances "contient" (ex: "prefix"="aru" ne trouvera pas "Naruto").
async function getDocumentsByPrefix(collectionName, whereClauses, orderByField, prefix, pageSize = 50) {
    await checkAuth();
    const coll = collection(db, collectionName);
    let q = query(coll);
    whereClauses.forEach(clause => {
        q = query(q, where(clause.field, clause.operator, clause.value));
    });
    q = query(q, orderBy(orderByField), where(orderByField, '>=', prefix), where(orderByField, '<', prefix + '\uf8ff'), limit(pageSize));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// GET: Un document spécifique par son ID.
// Retourne undefined si le document n'existe pas (cas normal, pas une erreur).
async function getDocumentById(collectionName, docId) {
    await checkAuth();
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
    }
    return undefined;
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

// INCREMENT: Incrémenter (ou décrémenter si delta < 0) un champ numérique atomiquement.
// Utilise FieldValue.increment, donc safe en écriture concurrente.
async function incrementField(collectionName, docId, field, delta) {
    await checkAuth();
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, { [field]: increment(delta) });
}

export {
    db,
    getAllDocuments,
    getDocumentsWithWhere,
    getDocumentsPage,
    getDocumentsByPrefix,
    getDocumentById,
    setDocument,
    updateDocument,
    incrementField,
    deleteDocument,
    countDocuments,
    countDocumentsWithWhere
};

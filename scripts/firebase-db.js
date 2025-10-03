import { getFirestore, collection, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from "./firebase-auth.js";

const db = getFirestore(app);

/**
 * Compte le nombre de documents dans une collection Firestore.
 * @param {string} collectionName - Nom de la collection
 * @returns {Promise<number>} - Nombre de documents
 */
async function countDocuments(collectionName) {
    const coll = collection(db, collectionName);
    const snapshot = await getCountFromServer(coll);
    return snapshot.data().count;
}

export { db, countDocuments };

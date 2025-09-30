async function createElement(collectionName, object) {
    await db.collection(collectionName).add(JSON.parse(JSON.stringify(object)))
      .then((docRef) => { return docRef.id; })
      .catch((error) => { return null; });
}

async function createOrUpdateElement(collectionName, object, docId) {
  try {
    const docRef = db.collection(collectionName).doc(docId);
    await docRef.set(JSON.parse(JSON.stringify(object)));

    return docRef.id;
  } catch (error) {
    console.error("Erreur lors de la création/mise à jour :", error);
    return undefined;
  }
}

async function getElements(collectionName) {
  try {
    const doc = await db.collection(collectionName).get();
    if (doc.size > 0) {
      let results = [];
      doc.docs.forEach(curDoc => { results.push({"id": curDoc.id, "object": curDoc.data() }); });
      return results;
    }
    return [];
  } catch (error) {
    console.error("Erreur lors de la récupération des paramètres :", error);
    return undefined;
  }
}

async function getElementsSize(collectionName) {
  try {
    const doc = await db.collection(collectionName).get();
    return doc.size;
  } catch (error) {
    console.error("Erreur lors de la récupération des paramètres :", error);
    return undefined;
  }
}


async function getElement(collectionName, docId) {
  try {
    const doc = await db.collection(collectionName).doc(docId).get();
    if (doc.exists) {
      return doc.data();
    }
    return undefined;
  } catch (error) {
    console.error("Erreur lors de la récupération des paramètres :", error);
    return undefined;
  }
}

async function changeDocId(collectionName, oldId, newId) {
  const oldRef = db.collection(collectionName).doc(oldId);
  const newRef = db.collection(collectionName).doc(newId);

  try {
    // Récupérer les données de l’ancien doc
    const snapshot = await oldRef.get();
    if (!snapshot.exists) {
      throw new Error("Le document n'existe pas : " + oldId);
    }

    const data = snapshot.data();
    await newRef.set(data);
    await oldRef.delete();

    console.log(`✅ Document déplacé de ${oldId} vers ${newId}`);
    return true;
  } catch (error) {
    console.error("❌ Erreur lors du changement d'ID :", error);
    return false;
  }
}
async function createElement(collectionName, object) {
    await db.collection(collectionName).add(JSON.parse(JSON.stringify(object)))
      .then((docRef) => { return docRef.id; })
      .catch((error) => { return null; });
}

async function getElements(collectionName) {
  try {
    const doc = await db.collection(collectionName).get();
    if (doc.size > 0) {
      let results = [];
      doc.docs.forEach(curDoc => { results.push(doc.data()); });
      return results;
    }
    return [];
  } catch (error) {
    console.error("Erreur lors de la récupération des paramètres :", error);
    return undefined;
  }
}

async function getElements(collectionName, docId) {
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

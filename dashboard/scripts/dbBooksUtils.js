import { getAllDocuments, setDocument, updateDocument, deleteDocument } from '../../scripts/firebase-db.js';
import { Table } from '../../scripts/enums.js';

let ALLCOLLECTIONS = [];
let ALLEDITIONS = [];
let ALLBDS = [];

function generateShortUUID(length = 8) {
  return [...Array(length)]
    .map(() => Math.floor(Math.random() * 36).toString(36))
    .join('');
}

function findIdByCollection(arr, criteria) {
  const item = arr.find(
    (el) =>
      el.object.name === criteria.name &&
      (el.object.specialedition === criteria.specialedition)
  );
  return item ? item.id : undefined;
}

function findIdByEdition(arr, criteria) {
  const item = arr.find((el) =>
    Object.entries(criteria).every(([key, value]) => el.object[key] === value)
  );
  return item ? item.id : undefined;
}

// Retrouve (ou crée) l'id de la collection et de l'édition correspondant aux objets fournis.
// Mutates ALLCOLLECTIONS / ALLEDITIONS en mémoire si une création a lieu.
async function resolveCollectionAndEdition(COLLECTION, EDITION) {
  let collectionId = undefined;
  let editionId = undefined;

  if (COLLECTION.name != undefined) {
    collectionId = findIdByCollection(ALLCOLLECTIONS, COLLECTION);
    if (collectionId == undefined) {
      collectionId = `${COLLECTION.name}:${COLLECTION.specialedition}:${generateShortUUID()}`;
      await setDocument(Table.Collections, collectionId, COLLECTION);
      ALLCOLLECTIONS.push({ id: collectionId, object: { ...COLLECTION } });
    }
  }
  if (EDITION.name != undefined) {
    editionId = findIdByEdition(ALLEDITIONS, EDITION);
    if (editionId == undefined) {
      editionId = `${EDITION.name}:${generateShortUUID()}`;
      await setDocument(Table.Editeurs, editionId, EDITION);
      ALLEDITIONS.push({ id: editionId, object: { ...EDITION } });
    }
  }

  return { collectionId, editionId };
}

// Crée (si besoin) la collection et l'édition liées, puis la BD elle-même.
// Retourne l'id du document BD créé.
async function createBook(BD, COLLECTION, EDITION) {
  const { collectionId, editionId } = await resolveCollectionAndEdition(COLLECTION, EDITION);

  BD.fk_collection = collectionId;
  BD.fk_edition = editionId;

  const bdId = `${BD.base_info?.title || ''}:${BD.base_info?.number || ''}:${BD.base_info?.year || ''}:${BD.base_info?.ISBN || ''}:${generateShortUUID()}`;

  await setDocument(Table.BDs, bdId, BD);

  const enriched = enrichBDs(
    [{ id: bdId, object: { ...BD } }],
    ALLCOLLECTIONS,
    ALLEDITIONS
  )[0];
  ALLBDS.push(enriched);

  return bdId;
}

// Met à jour une BD existante (id inchangé), en résolvant collection/édition au besoin.
// Met aussi à jour ALLBDS en mémoire pour que l'affichage reflète le changement sans rechargement.
async function updateBook(bdId, BD, COLLECTION, EDITION) {
  const { collectionId, editionId } = await resolveCollectionAndEdition(COLLECTION, EDITION);

  BD.fk_collection = collectionId;
  BD.fk_edition = editionId;

  await updateDocument(Table.BDs, bdId, BD);

  const index = ALLBDS.findIndex(bd => bd.id === bdId);
  const enriched = enrichBDs(
    [{ id: bdId, object: { ...BD } }],
    ALLCOLLECTIONS,
    ALLEDITIONS
  )[0];

  if (index === -1) {
    ALLBDS.push(enriched);
  } else {
    ALLBDS[index] = enriched;
  }
}

// Supprime une BD, à la fois côté Firestore et dans le cache mémoire.
async function deleteBook(bdId) {
  await deleteDocument(Table.BDs, bdId);
  ALLBDS = ALLBDS.filter(bd => bd.id !== bdId);
}

// --- Collections ---

// Crée une collection "à vide" (sans BD associée pour l'instant).
// Retourne l'id créé, ou undefined si une collection identique existe déjà.
async function createCollection(COLLECTION) {
  if (COLLECTION.name == undefined) return undefined;
  if (findIdByCollection(ALLCOLLECTIONS, COLLECTION) != undefined) return undefined;

  const collectionId = `${COLLECTION.name}:${COLLECTION.specialedition}:${generateShortUUID()}`;
  await setDocument(Table.Collections, collectionId, COLLECTION);
  ALLCOLLECTIONS.push({ id: collectionId, object: { ...COLLECTION } });
  return collectionId;
}

// Renomme une collection. Les BD qui la référencent par id n'ont rien à mettre à jour
// (elles gardent le même id de collection), seul l'objet enrichi affiché change.
async function renameCollection(collectionId, COLLECTION) {
  await updateDocument(Table.Collections, collectionId, COLLECTION);

  const item = ALLCOLLECTIONS.find(c => c.id === collectionId);
  if (item) item.object = { ...COLLECTION };

  ALLBDS.forEach(bd => {
    if (bd.object.fk_collection_id === collectionId) {
      bd.object.fk_collection = { ...COLLECTION };
    }
  });
}

// Supprime une collection. Les BD qui y étaient rattachées ne sont pas supprimées,
// elles repassent simplement "sans collection".
async function deleteCollection(collectionId) {
  await deleteDocument(Table.Collections, collectionId);
  ALLCOLLECTIONS = ALLCOLLECTIONS.filter(c => c.id !== collectionId);

  const bdsToDetach = ALLBDS.filter(bd => bd.object.fk_collection_id === collectionId);
  for (const bd of bdsToDetach) {
    bd.object.fk_collection = null;
    bd.object.fk_collection_id = undefined;
    await updateDocument(Table.BDs, bd.id, { ...bd.object, fk_collection: undefined });
  }
}

function countBDsInCollection(collectionId) {
  return ALLBDS.filter(bd => bd.object.fk_collection_id === collectionId).length;
}

// --- Éditeurs ---

async function createEditeur(EDITION) {
  if (EDITION.name == undefined) return undefined;
  if (findIdByEdition(ALLEDITIONS, EDITION) != undefined) return undefined;

  const editionId = `${EDITION.name}:${generateShortUUID()}`;
  await setDocument(Table.Editeurs, editionId, EDITION);
  ALLEDITIONS.push({ id: editionId, object: { ...EDITION } });
  return editionId;
}

async function renameEditeur(editionId, EDITION) {
  await updateDocument(Table.Editeurs, editionId, EDITION);

  const item = ALLEDITIONS.find(e => e.id === editionId);
  if (item) item.object = { ...EDITION };

  ALLBDS.forEach(bd => {
    if (bd.object.fk_edition_id === editionId) {
      bd.object.fk_edition = { ...EDITION };
    }
  });
}

async function deleteEditeur(editionId) {
  await deleteDocument(Table.Editeurs, editionId);
  ALLEDITIONS = ALLEDITIONS.filter(e => e.id !== editionId);

  const bdsToDetach = ALLBDS.filter(bd => bd.object.fk_edition_id === editionId);
  for (const bd of bdsToDetach) {
    bd.object.fk_edition = null;
    bd.object.fk_edition_id = undefined;
    await updateDocument(Table.BDs, bd.id, { ...bd.object, fk_edition: undefined });
  }
}

function countBDsForEditeur(editionId) {
  return ALLBDS.filter(bd => bd.object.fk_edition_id === editionId).length;
}

// Remplace les fk_collection / fk_edition (qui sont des ids) par les objets complets correspondants,
// pour un affichage direct sans requête supplémentaire. Conserve l'id brut sous
// fk_collection_id / fk_edition_id pour pouvoir retrouver les BD d'une collection/édition donnée.
function enrichBDs(bds, collections, editions) {
  const collectionMap = Object.fromEntries(collections.map(c => [c.id, c.object]));
  const editionMap = Object.fromEntries(editions.map(e => [e.id, e.object]));

  return bds.map(bd => {
    const collectionId = bd.object.fk_collection;
    const editionId = bd.object.fk_edition;
    bd.object.fk_collection_id = collectionId;
    bd.object.fk_edition_id = editionId;
    bd.object.fk_collection = collectionMap[collectionId] || null;
    bd.object.fk_edition = editionMap[editionId] || null;
    return bd;
  });
}

// Charge en mémoire toutes les collections, éditions et BDs de l'utilisateur connecté.
// À appeler une fois avant d'utiliser searchBD / displayBDs / createBook.
async function initBdBooksUtils() {
  const [rawCollections, rawEditions, rawBDs] = await Promise.all([
    getAllDocuments(Table.Collections),
    getAllDocuments(Table.Editeurs),
    getAllDocuments(Table.BDs)
  ]);

  ALLCOLLECTIONS = rawCollections.map(doc => ({ id: doc.id, object: doc }));
  ALLEDITIONS = rawEditions.map(doc => ({ id: doc.id, object: doc }));
  const rawBdEntries = rawBDs.map(doc => ({ id: doc.id, object: doc }));

  ALLBDS = enrichBDs(rawBdEntries, ALLCOLLECTIONS, ALLEDITIONS);
}

function getAllBDs() {
  return ALLBDS;
}

function getAllCollections() {
  return ALLCOLLECTIONS;
}

function getAllEditions() {
  return ALLEDITIONS;
}

function searchBD(searchQuery) {
  return ALLBDS.filter(item =>
    item.id
      .substring(0, item.id.lastIndexOf(':'))
      .replaceAll(":", "")
      .replaceAll("-", "")
      .toLowerCase()
      .includes(searchQuery.replaceAll("-", "").toLowerCase().trim())
  );
}

export {
  initBdBooksUtils,
  createBook,
  updateBook,
  deleteBook,
  searchBD,
  getAllBDs,
  getAllCollections,
  getAllEditions,
  createCollection,
  renameCollection,
  deleteCollection,
  countBDsInCollection,
  createEditeur,
  renameEditeur,
  deleteEditeur,
  countBDsForEditeur
};

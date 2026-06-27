import { getAllDocuments, setDocument } from '../../scripts/firebase-db.js';
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

// Crée (si besoin) la collection et l'édition liées, puis la BD elle-même.
// Retourne l'id du document BD créé.
async function createBook(BD, COLLECTION, EDITION) {
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

// Remplace les fk_collection / fk_edition (qui sont des ids) par les objets complets correspondants,
// pour un affichage direct sans requête supplémentaire.
function enrichBDs(bds, collections, editions) {
  const collectionMap = Object.fromEntries(collections.map(c => [c.id, c.object]));
  const editionMap = Object.fromEntries(editions.map(e => [e.id, e.object]));

  return bds.map(bd => {
    bd.object.fk_collection = collectionMap[bd.object.fk_collection] || null;
    bd.object.fk_edition = editionMap[bd.object.fk_edition] || null;
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
  searchBD,
  getAllBDs,
  getAllCollections,
  getAllEditions
};

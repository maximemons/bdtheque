import {
  getDocumentsPage,
  getDocumentsByPrefix,
  getDocumentsWithWhere,
  getDocumentById,
  setDocument,
  updateDocument,
  deleteDocument,
  countDocumentsWithWhere
} from '../../scripts/firebase-db.js';
import { Table } from '../../scripts/enums.js';

const PAGE_SIZE = 30;

let OWNER_ID = undefined;
let CAN_WRITE = false;

// Caches "déjà chargé" — pas la totalité des données, juste ce qu'on a demandé jusqu'ici.
let LOADED_COLLECTIONS = [];
let LOADED_EDITIONS = [];
let LOADED_BDS = [];

// Curseurs de pagination Firestore
let bdCursor = undefined;
let bdHasMore = true;
let collectionCursor = undefined;
let collectionHasMore = true;
let editeurCursor = undefined;
let editeurHasMore = true;

// Curseur pour la recherche étendue
let expandCursor = undefined;
let expandExhausted = false;

function generateShortUUID(length = 8) {
  return [...Array(length)]
    .map(() => Math.floor(Math.random() * 36).toString(36))
    .join('');
}

function ownerClause() {
  return [{ field: "ownerId", operator: "==", value: OWNER_ID }];
}

// Initialise le contexte (propriétaire effectif + droit d'écriture) et réinitialise les caches/curseurs.
function initBdBooksUtils(ownerId, canWriteFlag) {
  OWNER_ID = ownerId;
  CAN_WRITE = canWriteFlag;
  LOADED_COLLECTIONS = [];
  LOADED_EDITIONS = [];
  LOADED_BDS = [];
  bdCursor = undefined;
  bdHasMore = true;
  collectionCursor = undefined;
  collectionHasMore = true;
  editeurCursor = undefined;
  editeurHasMore = true;
  expandCursor = undefined;
  expandExhausted = false;
}

function isCanWrite() {
  return CAN_WRITE;
}

function ensureWritable() {
  if (!CAN_WRITE) {
    throw new Error("Ce compte n'a pas le droit de modifier cette BDthèque (accès en lecture seule).");
  }
}

// Remplace fk_collection/fk_edition (ids) par les objets complets, en fetchant au besoin.
async function enrichBDs(bds) {
  const missingCollectionIds = [...new Set(
    bds.map(bd => bd.fk_collection).filter(id => id && !LOADED_COLLECTIONS.some(c => c.id === id))
  )];
  const missingEditionIds = [...new Set(
    bds.map(bd => bd.fk_edition).filter(id => id && !LOADED_EDITIONS.some(e => e.id === id))
  )];

  await Promise.all(missingCollectionIds.map(async id => {
    const doc = await getDocumentById(Table.Collections, id).catch(() => undefined);
    if (doc) LOADED_COLLECTIONS.push({ id, object: doc });
  }));
  await Promise.all(missingEditionIds.map(async id => {
    const doc = await getDocumentById(Table.Editeurs, id).catch(() => undefined);
    if (doc) LOADED_EDITIONS.push({ id, object: doc });
  }));

  return bds.map(bdRaw => {
    const collectionId = bdRaw.fk_collection;
    const editionId = bdRaw.fk_edition;
    const object = { ...bdRaw };
    object.fk_collection_id = collectionId;
    object.fk_edition_id = editionId;
    object.fk_collection = LOADED_COLLECTIONS.find(c => c.id === collectionId)?.object || null;
    object.fk_edition = LOADED_EDITIONS.find(e => e.id === editionId)?.object || null;
    return { id: bdRaw.id, object };
  });
}

// --- Chargement par lots ---

async function loadNextBdPage() {
  if (!bdHasMore) return { items: [], hasMore: false };

  const { items, rawDocs, hasMore } = await getDocumentsPage(
    Table.BDs, ownerClause(), "base_info.title", PAGE_SIZE, bdCursor
  );

  bdCursor = rawDocs[rawDocs.length - 1];
  bdHasMore = hasMore;

  const enriched = await enrichBDs(items);
  LOADED_BDS.push(...enriched);

  return { items: enriched, hasMore: bdHasMore };
}

async function loadNextCollectionPage() {
  if (!collectionHasMore) return { items: [], hasMore: false };

  const { items, rawDocs, hasMore } = await getDocumentsPage(
    Table.Collections, ownerClause(), "name", PAGE_SIZE, collectionCursor
  );

  collectionCursor = rawDocs[rawDocs.length - 1];
  collectionHasMore = hasMore;

  const entries = items.map(doc => ({ id: doc.id, object: doc }));
  // Dédoublonner : ne pas ajouter si déjà en cache (possible via enrichBDs)
  entries.forEach(e => {
    if (!LOADED_COLLECTIONS.some(c => c.id === e.id)) LOADED_COLLECTIONS.push(e);
  });

  return { items: entries, hasMore: collectionHasMore };
}

async function loadNextEditeurPage() {
  if (!editeurHasMore) return { items: [], hasMore: false };

  const { items, rawDocs, hasMore } = await getDocumentsPage(
    Table.Editeurs, ownerClause(), "name", PAGE_SIZE, editeurCursor
  );

  editeurCursor = rawDocs[rawDocs.length - 1];
  editeurHasMore = hasMore;

  const entries = items.map(doc => ({ id: doc.id, object: doc }));
  entries.forEach(e => {
    if (!LOADED_EDITIONS.some(ed => ed.id === e.id)) LOADED_EDITIONS.push(e);
  });

  return { items: entries, hasMore: editeurHasMore };
}

// --- Recherche ---

// Recherche rapide côté serveur : BD dont le titre OU l'ISBN commence par "prefix".
async function searchBdByPrefix(prefix) {
  const cleanPrefix = prefix.trim();
  if (cleanPrefix === "") return [];

  const [byTitle, byIsbn] = await Promise.all([
    getDocumentsByPrefix(Table.BDs, ownerClause(), "base_info.title", cleanPrefix, 50),
    getDocumentsByPrefix(Table.BDs, ownerClause(), "base_info.ISBN", cleanPrefix.replaceAll("-", ""), 50)
  ]);

  const merged = [...byTitle];
  byIsbn.forEach(doc => {
    if (!merged.some(d => d.id === doc.id)) merged.push(doc);
  });

  return enrichBDs(merged);
}

// Réinitialise le curseur de recherche étendue (appeler avant chaque nouvelle recherche).
function resetExpandSearch() {
  expandCursor = undefined;
  expandExhausted = false;
}

// Recherche étendue "contient" — scanne un lot de PAGE_SIZE BD, filtre en mémoire.
// Retourne { matches, exhausted } ; appeler en boucle jusqu'à exhausted=true ou résultats suffisants.
// onBatchChecked(count) est appelé après chaque lot pour afficher la progression.
async function expandSearchNextBatch(searchQuery, onBatchChecked) {
  if (expandExhausted) return { matches: [], exhausted: true };

  const { items, rawDocs, hasMore } = await getDocumentsPage(
    Table.BDs, ownerClause(), "base_info.title", PAGE_SIZE, expandCursor
  );

  expandCursor = rawDocs[rawDocs.length - 1];
  expandExhausted = !hasMore;

  const needle = searchQuery.replaceAll("-", "").toLowerCase().trim();
  const matchingRaw = items.filter(bd => {
    const haystack = [
      bd.base_info?.title,
      bd.base_info?.ISBN,
      String(bd.base_info?.number ?? ''),
      String(bd.base_info?.year ?? '')
    ].join(' ').replaceAll("-", "").toLowerCase();
    return haystack.includes(needle);
  });

  if (onBatchChecked) onBatchChecked(items.length);

  const matches = await enrichBDs(matchingRaw);
  return { matches, exhausted: expandExhausted };
}

// --- Création / édition / suppression ---

async function findCollectionId(COLLECTION) {
  if (COLLECTION.name == undefined) return undefined;
  const clauses = [...ownerClause(), { field: "name", operator: "==", value: COLLECTION.name }];
  const matches = await getDocumentsWithWhere(Table.Collections, clauses);
  const exact = matches.find(m => m.specialedition === COLLECTION.specialedition);
  return exact?.id;
}

async function findEditeurId(EDITION) {
  if (EDITION.name == undefined) return undefined;
  const clauses = [...ownerClause(), { field: "name", operator: "==", value: EDITION.name }];
  const matches = await getDocumentsWithWhere(Table.Editeurs, clauses);
  return matches[0]?.id;
}

async function resolveCollectionAndEdition(COLLECTION, EDITION) {
  let collectionId = undefined;
  let editionId = undefined;

  if (COLLECTION.name != undefined) {
    collectionId = await findCollectionId(COLLECTION);
    if (collectionId == undefined) {
      collectionId = `${COLLECTION.name}:${COLLECTION.specialedition}:${generateShortUUID()}`;
      await setDocument(Table.Collections, collectionId, { ...COLLECTION, ownerId: OWNER_ID });
      LOADED_COLLECTIONS.push({ id: collectionId, object: { ...COLLECTION, ownerId: OWNER_ID } });
    }
  }
  if (EDITION.name != undefined) {
    editionId = await findEditeurId(EDITION);
    if (editionId == undefined) {
      editionId = `${EDITION.name}:${generateShortUUID()}`;
      await setDocument(Table.Editeurs, editionId, { ...EDITION, ownerId: OWNER_ID });
      LOADED_EDITIONS.push({ id: editionId, object: { ...EDITION, ownerId: OWNER_ID } });
    }
  }

  return { collectionId, editionId };
}

async function createBook(BD, COLLECTION, EDITION) {
  ensureWritable();
  const { collectionId, editionId } = await resolveCollectionAndEdition(COLLECTION, EDITION);

  BD.fk_collection = collectionId;
  BD.fk_edition = editionId;
  BD.ownerId = OWNER_ID;

  const bdId = `${BD.base_info?.title || ''}:${BD.base_info?.number || ''}:${BD.base_info?.year || ''}:${BD.base_info?.ISBN || ''}:${generateShortUUID()}`;
  await setDocument(Table.BDs, bdId, BD);

  const [enriched] = await enrichBDs([{ id: bdId, ...BD }]);
  LOADED_BDS.push(enriched);
  return bdId;
}

async function updateBook(bdId, BD, COLLECTION, EDITION) {
  ensureWritable();
  const { collectionId, editionId } = await resolveCollectionAndEdition(COLLECTION, EDITION);

  BD.fk_collection = collectionId;
  BD.fk_edition = editionId;
  BD.ownerId = OWNER_ID;

  await updateDocument(Table.BDs, bdId, BD);

  const index = LOADED_BDS.findIndex(bd => bd.id === bdId);
  const [enriched] = await enrichBDs([{ id: bdId, ...BD }]);
  if (index === -1) {
    LOADED_BDS.push(enriched);
  } else {
    LOADED_BDS[index] = enriched;
  }
}

async function deleteBook(bdId) {
  ensureWritable();
  await deleteDocument(Table.BDs, bdId);
  LOADED_BDS = LOADED_BDS.filter(bd => bd.id !== bdId);
}

// --- Collections CRUD ---

async function createCollection(COLLECTION) {
  ensureWritable();
  if (COLLECTION.name == undefined) return undefined;
  if (await findCollectionId(COLLECTION) != undefined) return undefined;
  const collectionId = `${COLLECTION.name}:${COLLECTION.specialedition}:${generateShortUUID()}`;
  await setDocument(Table.Collections, collectionId, { ...COLLECTION, ownerId: OWNER_ID });
  LOADED_COLLECTIONS.push({ id: collectionId, object: { ...COLLECTION, ownerId: OWNER_ID } });
  return collectionId;
}

async function renameCollection(collectionId, COLLECTION) {
  ensureWritable();
  await updateDocument(Table.Collections, collectionId, { ...COLLECTION, ownerId: OWNER_ID });
  const item = LOADED_COLLECTIONS.find(c => c.id === collectionId);
  if (item) item.object = { ...COLLECTION, ownerId: OWNER_ID };
  LOADED_BDS.forEach(bd => {
    if (bd.object.fk_collection_id === collectionId) {
      bd.object.fk_collection = { ...COLLECTION, ownerId: OWNER_ID };
    }
  });
}

async function deleteCollection(collectionId) {
  ensureWritable();
  await deleteDocument(Table.Collections, collectionId);
  LOADED_COLLECTIONS = LOADED_COLLECTIONS.filter(c => c.id !== collectionId);

  const clauses = [...ownerClause(), { field: "fk_collection", operator: "==", value: collectionId }];
  const bdsToDetach = await getDocumentsWithWhere(Table.BDs, clauses);
  await Promise.all(bdsToDetach.map(bd => {
    const { id, ...rest } = bd;
    return updateDocument(Table.BDs, id, { ...rest, fk_collection: null });
  }));

  LOADED_BDS.forEach(bd => {
    if (bd.object.fk_collection_id === collectionId) {
      bd.object.fk_collection = null;
      bd.object.fk_collection_id = undefined;
    }
  });
}

async function countBDsInCollection(collectionId) {
  const clauses = [...ownerClause(), { field: "fk_collection", operator: "==", value: collectionId }];
  return countDocumentsWithWhere(Table.BDs, clauses);
}

async function loadBDsForCollection(collectionId) {
  const clauses = [...ownerClause(), { field: "fk_collection", operator: "==", value: collectionId }];
  const raw = await getDocumentsWithWhere(Table.BDs, clauses);
  return enrichBDs(raw);
}

// --- Éditeurs CRUD ---

async function createEditeur(EDITION) {
  ensureWritable();
  if (EDITION.name == undefined) return undefined;
  if (await findEditeurId(EDITION) != undefined) return undefined;
  const editionId = `${EDITION.name}:${generateShortUUID()}`;
  await setDocument(Table.Editeurs, editionId, { ...EDITION, ownerId: OWNER_ID });
  LOADED_EDITIONS.push({ id: editionId, object: { ...EDITION, ownerId: OWNER_ID } });
  return editionId;
}

async function renameEditeur(editionId, EDITION) {
  ensureWritable();
  await updateDocument(Table.Editeurs, editionId, { ...EDITION, ownerId: OWNER_ID });
  const item = LOADED_EDITIONS.find(e => e.id === editionId);
  if (item) item.object = { ...EDITION, ownerId: OWNER_ID };
  LOADED_BDS.forEach(bd => {
    if (bd.object.fk_edition_id === editionId) {
      bd.object.fk_edition = { ...EDITION, ownerId: OWNER_ID };
    }
  });
}

async function deleteEditeur(editionId) {
  ensureWritable();
  await deleteDocument(Table.Editeurs, editionId);
  LOADED_EDITIONS = LOADED_EDITIONS.filter(e => e.id !== editionId);

  const clauses = [...ownerClause(), { field: "fk_edition", operator: "==", value: editionId }];
  const bdsToDetach = await getDocumentsWithWhere(Table.BDs, clauses);
  await Promise.all(bdsToDetach.map(bd => {
    const { id, ...rest } = bd;
    return updateDocument(Table.BDs, id, { ...rest, fk_edition: null });
  }));

  LOADED_BDS.forEach(bd => {
    if (bd.object.fk_edition_id === editionId) {
      bd.object.fk_edition = null;
      bd.object.fk_edition_id = undefined;
    }
  });
}

async function countBDsForEditeur(editionId) {
  const clauses = [...ownerClause(), { field: "fk_edition", operator: "==", value: editionId }];
  return countDocumentsWithWhere(Table.BDs, clauses);
}

async function loadBDsForEditeur(editionId) {
  const clauses = [...ownerClause(), { field: "fk_edition", operator: "==", value: editionId }];
  const raw = await getDocumentsWithWhere(Table.BDs, clauses);
  return enrichBDs(raw);
}

// --- Accès aux caches locaux ---

function getLoadedBDs() { return LOADED_BDS; }
function getLoadedCollections() { return LOADED_COLLECTIONS; }
function getLoadedEditions() { return LOADED_EDITIONS; }
function getBdHasMore() { return bdHasMore; }
function getCollectionHasMore() { return collectionHasMore; }
function getEditeurHasMore() { return editeurHasMore; }

export {
  initBdBooksUtils,
  isCanWrite,
  loadNextBdPage,
  loadNextCollectionPage,
  loadNextEditeurPage,
  searchBdByPrefix,
  resetExpandSearch,
  expandSearchNextBatch,
  createBook,
  updateBook,
  deleteBook,
  getLoadedBDs,
  getLoadedCollections,
  getLoadedEditions,
  getBdHasMore,
  getCollectionHasMore,
  getEditeurHasMore,
  createCollection,
  renameCollection,
  deleteCollection,
  countBDsInCollection,
  loadBDsForCollection,
  createEditeur,
  renameEditeur,
  deleteEditeur,
  countBDsForEditeur,
  loadBDsForEditeur
};

import {
  getDocumentsPage,
  getDocumentsByPrefix,
  getDocumentsWithWhere,
  getDocumentById,
  setDocument,
  updateDocument,
  incrementField,
  deleteDocument,
} from '../../scripts/firebase-db.js';
import { Table } from '../../scripts/enums.js';

const PAGE_SIZE = 30;

let CAN_WRITE = false;

// Caches locaux (ce qui a déjà été chargé sur cette page)
let LOADED_BDS = [];
let LOADED_COLLECTIONS = [];
let LOADED_EDITIONS = [];

// Curseurs de pagination
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

// Initialise le contexte (droit d'écriture) et réinitialise les caches/curseurs.
function initBdBooksUtils(canWriteFlag) {
  CAN_WRITE = canWriteFlag;
  LOADED_BDS = [];
  LOADED_COLLECTIONS = [];
  LOADED_EDITIONS = [];
  bdCursor = undefined;
  bdHasMore = true;
  collectionCursor = undefined;
  collectionHasMore = true;
  editeurCursor = undefined;
  editeurHasMore = true;
  expandCursor = undefined;
  expandExhausted = false;
}

function isCanWrite() { return CAN_WRITE; }

function ensureWritable() {
  if (!CAN_WRITE) throw new Error("Ce compte est en lecture seule. Vous ne pouvez pas modifier la BDthèque. (canWrite = false — vérifiez la table 'sharing' dans Firestore si vous êtes le propriétaire)");
}

// Convertit un document Firestore brut en entrée de cache {id, object}.
// Les noms collection/édition sont normalement dénormalisés dans la BD.
// Fallback sur le cache local LOADED_COLLECTIONS/LOADED_EDITIONS pour les anciennes
// BD créées avant la dénormalisation (avant migration).
function rawToEntry(raw) {
  const { id, ...object } = raw;

  const collectionId = raw.fk_collection || null;
  const editionId = raw.fk_edition || null;

  // Nom de collection : champ dénormalisé, ou fallback depuis le cache
  let collectionName = raw.collection_name ?? null;
  let collectionSpecial = raw.collection_special ?? null;
  if (collectionId && collectionName === null) {
    const cached = LOADED_COLLECTIONS.find(c => c.id === collectionId);
    if (cached) {
      collectionName = cached.object.name ?? null;
      collectionSpecial = cached.object.specialedition ?? null;
    }
  }

  // Nom d'éditeur : champ dénormalisé, ou fallback depuis le cache
  let editionName = raw.edition_name ?? null;
  if (editionId && editionName === null) {
    const cached = LOADED_EDITIONS.find(e => e.id === editionId);
    if (cached) editionName = cached.object.name ?? null;
  }

  object.fk_collection = collectionId
    ? { id: collectionId, name: collectionName, specialedition: collectionSpecial }
    : null;
  object.fk_edition = editionId
    ? { id: editionId, name: editionName }
    : null;
  object.fk_collection_id = collectionId;
  object.fk_edition_id = editionId;
  object.collection_name = collectionName;
  object.collection_special = collectionSpecial;
  object.edition_name = editionName;

  return { id: raw.id, object };
}

// Charge toutes les collections et éditeurs disponibles en arrière-plan,
// pour alimenter l'autocomplete du formulaire d'ajout/édition de BD.
// N'affecte pas les curseurs de pagination des BD.
async function preloadAllCollectionsAndEditions() {
  // Collections
  while (collectionHasMore) {
    await loadNextCollectionPage();
  }
  // Éditeurs
  while (editeurHasMore) {
    await loadNextEditeurPage();
  }
}

// --- Chargement par lots ---

async function loadNextBdPage() {
  if (!bdHasMore) return { items: [], hasMore: false };
  const { items, rawDocs, hasMore } = await getDocumentsPage(
    Table.BDs, [], "base_info.title", PAGE_SIZE, bdCursor
  );
  bdCursor = rawDocs[rawDocs.length - 1];
  bdHasMore = hasMore;
  const entries = items.map(rawToEntry);
  LOADED_BDS.push(...entries);
  return { items: entries, hasMore: bdHasMore };
}

async function loadNextCollectionPage() {
  if (!collectionHasMore) return { items: [], hasMore: false };
  const { items, rawDocs, hasMore } = await getDocumentsPage(
    Table.Collections, [], "name", PAGE_SIZE, collectionCursor
  );
  collectionCursor = rawDocs[rawDocs.length - 1];
  collectionHasMore = hasMore;
  const entries = items.map(raw => ({ id: raw.id, object: raw }));
  entries.forEach(e => {
    if (!LOADED_COLLECTIONS.some(c => c.id === e.id)) LOADED_COLLECTIONS.push(e);
  });
  return { items: entries, hasMore: collectionHasMore };
}

async function loadNextEditeurPage() {
  if (!editeurHasMore) return { items: [], hasMore: false };
  const { items, rawDocs, hasMore } = await getDocumentsPage(
    Table.Editeurs, [], "name", PAGE_SIZE, editeurCursor
  );
  editeurCursor = rawDocs[rawDocs.length - 1];
  editeurHasMore = hasMore;
  const entries = items.map(raw => ({ id: raw.id, object: raw }));
  entries.forEach(e => {
    if (!LOADED_EDITIONS.some(ed => ed.id === e.id)) LOADED_EDITIONS.push(e);
  });
  return { items: entries, hasMore: editeurHasMore };
}

// --- Recherche ---

async function searchBdByPrefix(prefix) {
  const cleanPrefix = prefix.trim();
  if (cleanPrefix === "") return [];
  const [byTitle, byIsbn] = await Promise.all([
    getDocumentsByPrefix(Table.BDs, [], "base_info.title", cleanPrefix, 50),
    getDocumentsByPrefix(Table.BDs, [], "base_info.ISBN", cleanPrefix.replaceAll("-", ""), 50)
  ]);
  const merged = [...byTitle];
  byIsbn.forEach(doc => {
    if (!merged.some(d => d.id === doc.id)) merged.push(doc);
  });
  return merged.map(rawToEntry);
}

function resetExpandSearch() {
  expandCursor = undefined;
  expandExhausted = false;
}

async function expandSearchNextBatch(searchQuery, onBatchChecked) {
  if (expandExhausted) return { matches: [], exhausted: true };
  const { items, rawDocs, hasMore } = await getDocumentsPage(
    Table.BDs, [], "base_info.title", PAGE_SIZE, expandCursor
  );
  expandCursor = rawDocs[rawDocs.length - 1];
  expandExhausted = !hasMore;
  const needle = searchQuery.replaceAll("-", "").toLowerCase().trim();
  const matching = items.filter(bd => {
    const haystack = [
      bd.base_info?.title,
      bd.base_info?.ISBN,
      String(bd.base_info?.number ?? ''),
      String(bd.base_info?.year ?? ''),
      bd.collection_name ?? ''
    ].join(' ').replaceAll("-", "").toLowerCase();
    return haystack.includes(needle);
  });
  if (onBatchChecked) onBatchChecked(items.length);
  return { matches: matching.map(rawToEntry), exhausted: expandExhausted };
}

// --- Helpers création ---

// Normalise un nom pour la comparaison/recherche : minuscules, sans accents, sans espaces superflus.
function normalizeName(s) {
  return String(s ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/\s+/g, ' ');
}

async function findOrCreateCollection(COLLECTION) {
  if (!COLLECTION.name) return { collectionId: undefined, collectionName: undefined, collectionSpecial: undefined };

  const normName    = normalizeName(COLLECTION.name);
  const normSpecial = normalizeName(COLLECTION.specialedition ?? '');

  // 1. Chercher dans le cache local (insensible à la casse)
  const cached = LOADED_COLLECTIONS.find(
    c => normalizeName(c.object.name) === normName &&
         normalizeName(c.object.specialedition ?? '') === normSpecial
  );
  if (cached) return { collectionId: cached.id, collectionName: cached.object.name, collectionSpecial: cached.object.specialedition };

  // 2. Chercher dans Firestore via le champ name_normalized (insensible à la casse)
  const matches = await getDocumentsWithWhere(Table.Collections, [{ field: "name_normalized", operator: "==", value: normName }]);
  const exact = matches.find(m => normalizeName(m.specialedition ?? '') === normSpecial);
  if (exact) {
    if (!LOADED_COLLECTIONS.some(c => c.id === exact.id))
      LOADED_COLLECTIONS.push({ id: exact.id, object: exact });
    return { collectionId: exact.id, collectionName: exact.name, collectionSpecial: exact.specialedition };
  }

  // 3. Créer (avec name_normalized pour les futures recherches)
  const collectionId = `${COLLECTION.name}:${COLLECTION.specialedition ?? ''}:${generateShortUUID()}`;
  const data = {
    name: COLLECTION.name,
    name_normalized: normName,
    specialedition: COLLECTION.specialedition ?? null,
    bdCount: 0
  };
  await setDocument(Table.Collections, collectionId, data);
  LOADED_COLLECTIONS.push({ id: collectionId, object: { id: collectionId, ...data } });
  return { collectionId, collectionName: COLLECTION.name, collectionSpecial: COLLECTION.specialedition };
}

async function findOrCreateEditeur(EDITION) {
  if (!EDITION.name) return { editionId: undefined, editionName: undefined };

  const normName = normalizeName(EDITION.name);

  // 1. Chercher dans le cache local (insensible à la casse)
  const cached = LOADED_EDITIONS.find(e => normalizeName(e.object.name) === normName);
  if (cached) return { editionId: cached.id, editionName: cached.object.name };

  // 2. Chercher dans Firestore via name_normalized
  const matches = await getDocumentsWithWhere(Table.Editeurs, [{ field: "name_normalized", operator: "==", value: normName }]);
  if (matches[0]) {
    if (!LOADED_EDITIONS.some(e => e.id === matches[0].id))
      LOADED_EDITIONS.push({ id: matches[0].id, object: matches[0] });
    return { editionId: matches[0].id, editionName: matches[0].name };
  }

  // 3. Créer (avec name_normalized)
  const editionId = `${EDITION.name}:${generateShortUUID()}`;
  const data = { name: EDITION.name, name_normalized: normName, bdCount: 0 };
  await setDocument(Table.Editeurs, editionId, data);
  LOADED_EDITIONS.push({ id: editionId, object: { id: editionId, ...data } });
  return { editionId, editionName: EDITION.name };
}

// --- BD CRUD ---

async function createBook(BD, COLLECTION, EDITION) {
  ensureWritable();
  const [colResult, edResult] = await Promise.all([
    findOrCreateCollection(COLLECTION),
    findOrCreateEditeur(EDITION)
  ]);
  const { collectionId, collectionName, collectionSpecial } = colResult;
  const { editionId, editionName } = edResult;

  // Sérialiser en objet plain et remplacer undefined par null (Firestore refuse undefined)
  const clean = v => v ?? null;
  const bdData = {
    fk_collection: collectionId ?? null,
    collection_name: collectionName ?? null,
    collection_special: collectionSpecial ?? null,
    fk_edition: editionId ?? null,
    edition_name: editionName ?? null,
    base_info: {
      ISBN: clean(BD.base_info?.ISBN),
      number: clean(BD.base_info?.number),
      title: clean(BD.base_info?.title),
      year: clean(BD.base_info?.year),
      state: clean(BD.base_info?.state),
      cover: clean(BD.base_info?.cover)
    },
    details: {
      reputation: clean(BD.details?.reputation),
      goldedition: clean(BD.details?.goldedition),
      special: clean(BD.details?.special)
    },
    purchasedate: clean(BD.purchasedate)
  };

  const bdId = `${bdData.base_info?.title || ''}:${bdData.base_info?.number || ''}:${bdData.base_info?.year || ''}:${generateShortUUID()}`;
  await setDocument(Table.BDs, bdId, bdData);
  await Promise.all([
    collectionId ? incrementField(Table.Collections, collectionId, "bdCount", 1) : Promise.resolve(),
    editionId ? incrementField(Table.Editeurs, editionId, "bdCount", 1) : Promise.resolve()
  ]);
  const entry = rawToEntry({ id: bdId, ...bdData });
  LOADED_BDS.push(entry);
  return bdId;
}

async function updateBook(bdId, BD, COLLECTION, EDITION) {
  ensureWritable();
  const oldEntry = LOADED_BDS.find(b => b.id === bdId);
  const oldCollectionId = oldEntry?.object?.fk_collection_id ?? null;
  const oldEditionId = oldEntry?.object?.fk_edition_id ?? null;
  const [colResult, edResult] = await Promise.all([
    findOrCreateCollection(COLLECTION),
    findOrCreateEditeur(EDITION)
  ]);
  const { collectionId, collectionName, collectionSpecial } = colResult;
  const { editionId, editionName } = edResult;

  // Sérialiser en objet plain et remplacer undefined par null (Firestore refuse undefined)
  const clean = v => v ?? null;
  const bdData = {
    fk_collection: collectionId ?? null,
    collection_name: collectionName ?? null,
    collection_special: collectionSpecial ?? null,
    fk_edition: editionId ?? null,
    edition_name: editionName ?? null,
    base_info: {
      ISBN: clean(BD.base_info?.ISBN),
      number: clean(BD.base_info?.number),
      title: clean(BD.base_info?.title),
      year: clean(BD.base_info?.year),
      state: clean(BD.base_info?.state),
      cover: clean(BD.base_info?.cover)
    },
    details: {
      reputation: clean(BD.details?.reputation),
      goldedition: clean(BD.details?.goldedition),
      special: clean(BD.details?.special)
    },
    purchasedate: clean(BD.purchasedate)
  };

  await updateDocument(Table.BDs, bdId, bdData);
  const counterUpdates = [];
  if (oldCollectionId !== collectionId) {
    if (oldCollectionId) counterUpdates.push(incrementField(Table.Collections, oldCollectionId, "bdCount", -1));
    if (collectionId) counterUpdates.push(incrementField(Table.Collections, collectionId, "bdCount", 1));
  }
  if (oldEditionId !== editionId) {
    if (oldEditionId) counterUpdates.push(incrementField(Table.Editeurs, oldEditionId, "bdCount", -1));
    if (editionId) counterUpdates.push(incrementField(Table.Editeurs, editionId, "bdCount", 1));
  }
  if (counterUpdates.length > 0) await Promise.all(counterUpdates);
  const entry = rawToEntry({ id: bdId, ...bdData });
  const index = LOADED_BDS.findIndex(b => b.id === bdId);
  if (index === -1) LOADED_BDS.push(entry); else LOADED_BDS[index] = entry;
}

async function deleteBook(bdId) {
  ensureWritable();
  const oldEntry = LOADED_BDS.find(b => b.id === bdId);
  const oldCollectionId = oldEntry?.object?.fk_collection_id ?? null;
  const oldEditionId = oldEntry?.object?.fk_edition_id ?? null;
  await deleteDocument(Table.BDs, bdId);
  await Promise.all([
    oldCollectionId ? incrementField(Table.Collections, oldCollectionId, "bdCount", -1) : Promise.resolve(),
    oldEditionId ? incrementField(Table.Editeurs, oldEditionId, "bdCount", -1) : Promise.resolve()
  ]);
  LOADED_BDS = LOADED_BDS.filter(b => b.id !== bdId);
}

// --- Collections CRUD ---

async function createCollection(COLLECTION) {
  ensureWritable();
  if (!COLLECTION.name) return undefined;
  const existing = await findOrCreateCollection(COLLECTION);
  return existing.collectionId;
}

async function renameCollection(collectionId, COLLECTION) {
  ensureWritable();
  await updateDocument(Table.Collections, collectionId, {
    name: COLLECTION.name,
    name_normalized: normalizeName(COLLECTION.name),
    specialedition: COLLECTION.specialedition ?? null
  });
  const item = LOADED_COLLECTIONS.find(c => c.id === collectionId);
  if (item) item.object = { ...item.object, ...COLLECTION, name_normalized: normalizeName(COLLECTION.name) };
  const bdsToUpdate = await getDocumentsWithWhere(Table.BDs, [{ field: "fk_collection", operator: "==", value: collectionId }]);
  await Promise.all(bdsToUpdate.map(bd =>
    updateDocument(Table.BDs, bd.id, { collection_name: COLLECTION.name, collection_special: COLLECTION.specialedition ?? null })
  ));
  LOADED_BDS.forEach(bd => {
    if (bd.object.fk_collection_id === collectionId) {
      bd.object.collection_name = COLLECTION.name;
      bd.object.collection_special = COLLECTION.specialedition ?? null;
      bd.object.fk_collection = { id: collectionId, name: COLLECTION.name, specialedition: COLLECTION.specialedition };
    }
  });
}

async function deleteCollection(collectionId) {
  ensureWritable();
  await deleteDocument(Table.Collections, collectionId);
  LOADED_COLLECTIONS = LOADED_COLLECTIONS.filter(c => c.id !== collectionId);
  const bdsToDetach = await getDocumentsWithWhere(Table.BDs, [{ field: "fk_collection", operator: "==", value: collectionId }]);
  await Promise.all(bdsToDetach.map(bd =>
    updateDocument(Table.BDs, bd.id, { fk_collection: null, collection_name: null, collection_special: null })
  ));
  LOADED_BDS.forEach(bd => {
    if (bd.object.fk_collection_id === collectionId) {
      bd.object.fk_collection = null;
      bd.object.fk_collection_id = null;
      bd.object.collection_name = null;
    }
  });
}

function countBDsInCollection(collectionId) {
  const col = LOADED_COLLECTIONS.find(c => c.id === collectionId);
  return col?.object?.bdCount ?? 0;
}

async function loadBDsForCollection(collectionId) {
  const raw = await getDocumentsWithWhere(Table.BDs, [{ field: "fk_collection", operator: "==", value: collectionId }]);
  return raw.map(rawToEntry);
}

// --- Éditeurs CRUD ---

async function createEditeur(EDITION) {
  ensureWritable();
  if (!EDITION.name) return undefined;
  const existing = await findOrCreateEditeur(EDITION);
  return existing.editionId;
}

async function renameEditeur(editionId, EDITION) {
  ensureWritable();
  await updateDocument(Table.Editeurs, editionId, { name: EDITION.name, name_normalized: normalizeName(EDITION.name) });
  const item = LOADED_EDITIONS.find(e => e.id === editionId);
  if (item) item.object = { ...item.object, ...EDITION, name_normalized: normalizeName(EDITION.name) };
  const bdsToUpdate = await getDocumentsWithWhere(Table.BDs, [{ field: "fk_edition", operator: "==", value: editionId }]);
  await Promise.all(bdsToUpdate.map(bd =>
    updateDocument(Table.BDs, bd.id, { edition_name: EDITION.name })
  ));
  LOADED_BDS.forEach(bd => {
    if (bd.object.fk_edition_id === editionId) {
      bd.object.edition_name = EDITION.name;
      bd.object.fk_edition = { id: editionId, name: EDITION.name };
    }
  });
}

async function deleteEditeur(editionId) {
  ensureWritable();
  await deleteDocument(Table.Editeurs, editionId);
  LOADED_EDITIONS = LOADED_EDITIONS.filter(e => e.id !== editionId);
  const bdsToDetach = await getDocumentsWithWhere(Table.BDs, [{ field: "fk_edition", operator: "==", value: editionId }]);
  await Promise.all(bdsToDetach.map(bd =>
    updateDocument(Table.BDs, bd.id, { fk_edition: null, edition_name: null })
  ));
  LOADED_BDS.forEach(bd => {
    if (bd.object.fk_edition_id === editionId) {
      bd.object.fk_edition = null;
      bd.object.fk_edition_id = null;
      bd.object.edition_name = null;
    }
  });
}

function countBDsForEditeur(editionId) {
  const ed = LOADED_EDITIONS.find(e => e.id === editionId);
  return ed?.object?.bdCount ?? 0;
}

async function loadBDsForEditeur(editionId) {
  const raw = await getDocumentsWithWhere(Table.BDs, [{ field: "fk_edition", operator: "==", value: editionId }]);
  return raw.map(rawToEntry);
}

// --- Accès aux caches ---
function getLoadedBDs() { return LOADED_BDS; }
function getLoadedCollections() { return LOADED_COLLECTIONS; }
function getLoadedEditions() { return LOADED_EDITIONS; }
function getBdHasMore() { return bdHasMore; }
function getCollectionHasMore() { return collectionHasMore; }
function getEditeurHasMore() { return editeurHasMore; }

export {
  initBdBooksUtils,
  isCanWrite,
  preloadAllCollectionsAndEditions,
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
  loadBDsForEditeur,
  rawToEntry
};

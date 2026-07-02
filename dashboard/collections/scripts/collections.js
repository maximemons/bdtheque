import { checkAuthAndRedirect } from '../../../scripts/auth-guard.js';
import { Collection } from '../../../scripts/records.js';
import { getCurrentUser } from '../../../scripts/firebase-auth.js';
import { resolveCanWrite } from '../../../scripts/ownership.js';
import { showFatalError } from '../../../scripts/ui-error.js';
import {
  initBdBooksUtils,
  loadNextCollectionPage,
  getLoadedCollections,
  getCollectionHasMore,
  createCollection,
  renameCollection,
  deleteCollection,
  countBDsInCollection,
  loadBDsForCollection
} from '../../scripts/dbBooksUtils.js';

checkAuthAndRedirect();

let editingCollectionId = null;

getCurrentUser().then(async (user) => {
  if (!user) return;

  try {
    const canWrite = await resolveCanWrite(user.email);
    initBdBooksUtils(canWrite);

    initForm();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("collection")) {
      Array.from(document.getElementsByClassName("shortcut-show")).forEach(e => e.classList.remove("shortcut-show"));
      await displayCollectionDetail(urlParams.get("collection"));
      return;
    }

    Array.from(document.getElementsByClassName("shortcut-search")).forEach(e => e.classList.remove("shortcut-search"));

    document.getElementById("searchBarInput").addEventListener("change", search);
    document.getElementById("searchBarInput").addEventListener("keydown", e => { if (e.key === "Enter") search(); });
    document.getElementById("searchBar").addEventListener("click", search);

    await loadMoreCollections();
  } catch (error) {
    showFatalError("collectionsList", error, "chargement de la page Mes Collections");
  }
}).catch(error => {
  showFatalError("collectionsList", error, "vérification de l'authentification");
});

function backToList() {
  window.location.href = window.location.origin + window.location.pathname;
}

function selectCollection(collectionId) {
  window.location.href = window.location.origin + window.location.pathname + "?collection=" + encodeURIComponent(collectionId);
}

async function loadMoreCollections() {
  const btn = document.getElementById("loadMoreBtn");
  if (btn) btn.disabled = true;

  const list = document.getElementById("collectionsList");
  let loader = document.getElementById("listLoader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "listLoader";
    loader.className = "bd-list-loader";
    loader.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Chargement...`;
    list.appendChild(loader);
  }

  try {
    await loadNextCollectionPage();
    renderCollectionList(getLoadedCollections(), getCollectionHasMore());
  } catch (error) {
    showFatalError("collectionsList", error, "chargement des collections");
  }
}

function renderCollectionList(collections, hasMore) {
  const list = document.getElementById("collectionsList");
  list.innerHTML = "";

  if (!collections || collections.length === 0) {
    list.innerHTML = `<div class="empty">Aucune collection pour le moment.</div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.classList.add("bd-list");

  collections.forEach(collectionEntry => {
    const displayName = collectionEntry.object.specialedition
      ? `${collectionEntry.object.name} : ${collectionEntry.object.specialedition}`
      : collectionEntry.object.name;
    const count = countBDsInCollection(collectionEntry.id);

    const card = document.createElement("div");
    card.classList.add("bd-card", "collection-card");
    card.addEventListener("click", () => selectCollection(collectionEntry.id));
    card.innerHTML = `
      <div class="collection-card-icon"><i class="fas fa-layer-group"></i></div>
      <div class="bd-info">
        <h3>${displayName}</h3>
        <p>${count} BD</p>
      </div>`;
    grid.appendChild(card);
  });

  list.appendChild(grid);

  if (hasMore) {
    const btn = document.createElement("button");
    btn.id = "loadMoreBtn";
    btn.className = "load-more-btn";
    btn.innerHTML = `<i class="fas fa-chevron-down"></i> Charger plus`;
    btn.addEventListener("click", loadMoreCollections);
    list.appendChild(btn);
  }
}

function search() {
  const query = document.getElementById("searchBarInput").value.trim().toLowerCase();
  const all = getLoadedCollections();
  const filtered = query === "" ? all : all.filter(c => (c.object.name || "").toLowerCase().includes(query));
  renderCollectionList(filtered, false); // pas de "charger plus" en mode recherche
}

function initForm() {
  document.getElementById("collection-form").addEventListener("submit", onSubmitForm);
  document.getElementById("cancelAddCollection").addEventListener("click", hideForm);
  document.getElementById("openAddCollectionForm").addEventListener("click", showForm);
  document.getElementById("backToListBtn").addEventListener("click", backToList);
}

function showForm() {
  document.getElementById("addCollection").style.display = "block";
  document.getElementById("modal").style.display = "block";
}

function hideForm() {
  document.getElementById("addCollection").style.display = "none";
  document.getElementById("modal").style.display = "none";
  document.getElementById("collectionName").value = "";
  document.getElementById("collectionSpecial").value = "";
  editingCollectionId = null;
  document.getElementById("formTitle").textContent = "Ajouter une collection";
  document.querySelector('#collection-form button[type="submit"]').textContent = "Créer";
}

function openEditForm(collectionEntry) {
  editingCollectionId = collectionEntry.id;
  showForm();
  document.getElementById("formTitle").textContent = "Modifier la collection";
  document.querySelector('#collection-form button[type="submit"]').textContent = "Enregistrer";
  document.getElementById("collectionName").value = collectionEntry.object.name || "";
  document.getElementById("collectionSpecial").value = collectionEntry.object.specialedition || "";
}

async function onSubmitForm(e) {
  e.preventDefault();
  Array.from(document.getElementsByClassName("formAction")).forEach(btn => { btn.disabled = true; });
  try {
    const collection = new Collection(
      document.getElementById("collectionName").value.trim() || undefined,
      document.getElementById("collectionSpecial").value.trim() || undefined
    );
    if (editingCollectionId) {
      const id = editingCollectionId;
      await renameCollection(id, collection);
      hideForm();
      selectCollection(id);
    } else {
      const newId = await createCollection(collection);
      hideForm();
      newId ? selectCollection(newId) : backToList();
    }
  } finally {
    Array.from(document.getElementsByClassName("formAction")).forEach(btn => { btn.disabled = false; });
  }
}

async function onDeleteCollection(collectionEntry) {
  const count = countBDsInCollection(collectionEntry.id);
  const warning = count > 0 ? `${count} BD seront détachées de cette collection (elles ne seront pas supprimées). ` : "";
  if (!window.confirm(`${warning}Supprimer définitivement la collection « ${collectionEntry.object.name} » ?`)) return;
  await deleteCollection(collectionEntry.id);
  backToList();
}

async function displayCollectionDetail(collectionId) {
  const decodedId = decodeURIComponent(collectionId);
  // Charger la collection si elle n'est pas encore dans le cache local
  let collectionEntry = getLoadedCollections().find(c => c.id === decodedId);
  if (!collectionEntry) {
    // On recharge les collections jusqu'à la trouver ou être à court
    while (!collectionEntry && getCollectionHasMore()) {
      await loadNextCollectionPage();
      collectionEntry = getLoadedCollections().find(c => c.id === decodedId);
    }
  }
  if (!collectionEntry) { backToList(); return; }

  const bdsInCollection = await loadBDsForCollection(decodedId);
  const displayName = collectionEntry.object.specialedition
    ? `${collectionEntry.object.name} : ${collectionEntry.object.specialedition}`
    : collectionEntry.object.name;

  const list = document.getElementById("collectionsList");
  list.innerHTML = `
    <div class="bd-container-controls">
      <button id="editCollectionBtn" title="Modifier"><i class="fas fa-pencil"></i></button>
      <button id="deleteCollectionBtn" title="Supprimer"><i class="fas fa-trash"></i></button>
    </div>
    <div class="collection-block">
      <h2>${displayName}</h2>
      <p class="hint">${bdsInCollection.length} BD dans cette collection</p>
      <div class="bd-list" id="collectionBdList"></div>
    </div>`;

  const bdListDiv = document.getElementById("collectionBdList");
  if (bdsInCollection.length === 0) {
    bdListDiv.innerHTML = `<div class="empty">Aucune BD n'est encore rattachée à cette collection.</div>`;
  } else {
    bdsInCollection
      .sort((a, b) => (parseInt(a.object.base_info?.number, 10) || 0) - (parseInt(b.object.base_info?.number, 10) || 0))
      .forEach(bd => {
        const number = bd.object.base_info?.number ? bd.object.base_info.number + "- " : "";
        const title = bd.object.base_info?.title || "Sans titre";
        const year = bd.object.base_info?.year || "";
        const cover = bd.object.base_info?.cover || "";
        const card = document.createElement("div");
        card.classList.add("bd-card");
        card.addEventListener("click", () => {
          window.location.href = "../bds/bds.html?bd=" + encodeURIComponent(bd.id);
        });
        card.innerHTML = `
          <img src="${cover}" alt="${title}" class="bd-cover"/>
          <div class="bd-info"><h3>${number}${title}</h3><p>${year}</p></div>`;
        bdListDiv.appendChild(card);
      });
  }

  document.getElementById("editCollectionBtn").addEventListener("click", () => openEditForm(collectionEntry));
  document.getElementById("deleteCollectionBtn").addEventListener("click", () => onDeleteCollection(collectionEntry));
}

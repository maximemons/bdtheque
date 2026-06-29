import { checkAuthAndRedirect } from '../../../scripts/auth-guard.js';
import { Collection } from '../../../scripts/records.js';
import {
  initBdBooksUtils,
  getAllCollections,
  getAllBDs,
  createCollection,
  renameCollection,
  deleteCollection,
  countBDsInCollection
} from '../../scripts/dbBooksUtils.js';
import { getCurrentUser } from '../../../scripts/firebase-auth.js';

checkAuthAndRedirect();

let editingCollectionId = null;

getCurrentUser().then(async (user) => {
  if (!user) {
    return; // checkAuthAndRedirect() prend déjà en charge la redirection
  }

  await initBdBooksUtils();
  initForm();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("search")) {
    document.getElementById("searchBarInput").value = urlParams.get("search");
  } else if (urlParams.has("collection")) {
    Array.from(document.getElementsByClassName("shortcut-show")).forEach(e => e.classList.remove("shortcut-show"));
    displayCollectionDetail(urlParams.get("collection"));
    return;
  }

  Array.from(document.getElementsByClassName("shortcut-search")).forEach(e => e.classList.remove("shortcut-search"));

  document.getElementById("searchBarInput").addEventListener("change", search);
  document.getElementById("searchBar").addEventListener("click", search);

  search();
});

function backToList() {
  window.location.href = window.location.origin + window.location.pathname;
}

function selectCollection(collectionId) {
  window.location.href = window.location.origin + window.location.pathname + "?collection=" + encodeURIComponent(collectionId);
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
      const idBeingEdited = editingCollectionId;
      await renameCollection(idBeingEdited, collection);
      hideForm();
      selectCollection(idBeingEdited);
    } else {
      const newId = await createCollection(collection);
      hideForm();
      if (newId) {
        selectCollection(newId);
      } else {
        backToList();
      }
    }
  } finally {
    Array.from(document.getElementsByClassName("formAction")).forEach(btn => { btn.disabled = false; });
  }
}

async function onDeleteCollection(collectionEntry) {
  const count = countBDsInCollection(collectionEntry.id);
  const warning = count > 0
    ? `${count} BD seront détachées de cette collection (elles ne seront pas supprimées). `
    : "";
  if (!window.confirm(`${warning}Supprimer définitivement la collection « ${collectionEntry.object.name} » ?`)) {
    return;
  }

  await deleteCollection(collectionEntry.id);
  backToList();
}

function displayCollectionDetail(collectionId) {
  const decodedId = decodeURIComponent(collectionId);
  const collectionEntry = getAllCollections().find(c => c.id === decodedId);

  if (collectionEntry == undefined) {
    backToList();
    return;
  }

  const bdsInCollection = getAllBDs().filter(bd => bd.object.fk_collection_id === decodedId);
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
          <div class="bd-info">
            <h3>${number}${title}</h3>
            <p>${year}</p>
          </div>`;

        bdListDiv.appendChild(card);
      });
  }

  document.getElementById("editCollectionBtn").addEventListener("click", () => openEditForm(collectionEntry));
  document.getElementById("deleteCollectionBtn").addEventListener("click", () => onDeleteCollection(collectionEntry));
}

function displayCollections(collections) {
  const list = document.getElementById("collectionsList");

  if (collections == undefined || collections.length === 0) {
    list.innerHTML = `<div class="collection-block"><h2>La liste est vide</h2></div>`;
    return;
  }

  list.innerHTML = "";
  const grid = document.createElement("div");
  grid.classList.add("bd-list");

  collections
    .sort((a, b) => (a.object.name || "").localeCompare(b.object.name || ""))
    .forEach(collectionEntry => {
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
}

function search() {
  const inputSearch = document.getElementById("searchBarInput").value.trim().toLowerCase();

  if (inputSearch === "") {
    displayCollections(getAllCollections());
    return;
  }

  displayCollections(getAllCollections().filter(c =>
    (c.object.name || "").toLowerCase().includes(inputSearch)
  ));
}

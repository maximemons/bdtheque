import { checkAuthAndRedirect } from '../../../scripts/auth-guard.js';
import { Editor } from '../../../scripts/records.js';
import {
  initBdBooksUtils,
  getAllEditions,
  getAllBDs,
  createEditeur,
  renameEditeur,
  deleteEditeur,
  countBDsForEditeur
} from '../../scripts/dbBooksUtils.js';
import { getCurrentUser } from '../../../scripts/firebase-auth.js';

checkAuthAndRedirect();

let editingEditeurId = null;

getCurrentUser().then(async (user) => {
  if (!user) {
    return; // checkAuthAndRedirect() prend déjà en charge la redirection
  }

  await initBdBooksUtils();
  initForm();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("search")) {
    document.getElementById("searchBarInput").value = urlParams.get("search");
  } else if (urlParams.has("editeur")) {
    Array.from(document.getElementsByClassName("shortcut-show")).forEach(e => e.classList.remove("shortcut-show"));
    displayEditeurDetail(urlParams.get("editeur"));
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

function selectEditeur(editeurId) {
  window.location.href = window.location.origin + window.location.pathname + "?editeur=" + encodeURIComponent(editeurId);
}

function initForm() {
  document.getElementById("editeur-form").addEventListener("submit", onSubmitForm);
  document.getElementById("cancelAddEditeur").addEventListener("click", hideForm);
  document.getElementById("openAddEditeurForm").addEventListener("click", showForm);
  document.getElementById("backToListBtn").addEventListener("click", backToList);
}

function showForm() {
  document.getElementById("addEditeur").style.display = "block";
  document.getElementById("modal").style.display = "block";
}

function hideForm() {
  document.getElementById("addEditeur").style.display = "none";
  document.getElementById("modal").style.display = "none";

  document.getElementById("editeurName").value = "";

  editingEditeurId = null;
  document.getElementById("formTitle").textContent = "Ajouter un éditeur";
  document.querySelector('#editeur-form button[type="submit"]').textContent = "Créer";
}

function openEditForm(editeurEntry) {
  editingEditeurId = editeurEntry.id;
  showForm();

  document.getElementById("formTitle").textContent = "Modifier l'éditeur";
  document.querySelector('#editeur-form button[type="submit"]').textContent = "Enregistrer";

  document.getElementById("editeurName").value = editeurEntry.object.name || "";
}

async function onSubmitForm(e) {
  e.preventDefault();
  Array.from(document.getElementsByClassName("formAction")).forEach(btn => { btn.disabled = true; });

  try {
    const editeur = new Editor(document.getElementById("editeurName").value.trim() || undefined);

    if (editingEditeurId) {
      const idBeingEdited = editingEditeurId;
      await renameEditeur(idBeingEdited, editeur);
      hideForm();
      selectEditeur(idBeingEdited);
    } else {
      const newId = await createEditeur(editeur);
      hideForm();
      if (newId) {
        selectEditeur(newId);
      } else {
        backToList();
      }
    }
  } finally {
    Array.from(document.getElementsByClassName("formAction")).forEach(btn => { btn.disabled = false; });
  }
}

async function onDeleteEditeur(editeurEntry) {
  const count = countBDsForEditeur(editeurEntry.id);
  const warning = count > 0
    ? `${count} BD seront détachées de cet éditeur (elles ne seront pas supprimées). `
    : "";
  if (!window.confirm(`${warning}Supprimer définitivement l'éditeur « ${editeurEntry.object.name} » ?`)) {
    return;
  }

  await deleteEditeur(editeurEntry.id);
  backToList();
}

function displayEditeurDetail(editeurId) {
  const decodedId = decodeURIComponent(editeurId);
  const editeurEntry = getAllEditions().find(e => e.id === decodedId);

  if (editeurEntry == undefined) {
    backToList();
    return;
  }

  const bdsForEditeur = getAllBDs().filter(bd => bd.object.fk_edition_id === decodedId);

  const list = document.getElementById("editeursList");
  list.innerHTML = `
    <div class="bd-container-controls">
      <button id="editEditeurBtn" title="Modifier"><i class="fas fa-pencil"></i></button>
      <button id="deleteEditeurBtn" title="Supprimer"><i class="fas fa-trash"></i></button>
    </div>
    <div class="collection-block">
      <h2>${editeurEntry.object.name}</h2>
      <p class="hint">${bdsForEditeur.length} BD chez cet éditeur</p>
      <div class="bd-list" id="editeurBdList"></div>
    </div>`;

  const bdListDiv = document.getElementById("editeurBdList");
  if (bdsForEditeur.length === 0) {
    bdListDiv.innerHTML = `<div class="empty">Aucune BD n'est encore rattachée à cet éditeur.</div>`;
  } else {
    bdsForEditeur
      .sort((a, b) => (a.object.base_info?.title || "").localeCompare(b.object.base_info?.title || ""))
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

  document.getElementById("editEditeurBtn").addEventListener("click", () => openEditForm(editeurEntry));
  document.getElementById("deleteEditeurBtn").addEventListener("click", () => onDeleteEditeur(editeurEntry));
}

function displayEditeurs(editeurs) {
  const list = document.getElementById("editeursList");

  if (editeurs == undefined || editeurs.length === 0) {
    list.innerHTML = `<div class="collection-block"><h2>La liste est vide</h2></div>`;
    return;
  }

  list.innerHTML = "";
  const grid = document.createElement("div");
  grid.classList.add("bd-list");

  editeurs
    .sort((a, b) => (a.object.name || "").localeCompare(b.object.name || ""))
    .forEach(editeurEntry => {
      const count = countBDsForEditeur(editeurEntry.id);

      const card = document.createElement("div");
      card.classList.add("bd-card", "collection-card");
      card.addEventListener("click", () => selectEditeur(editeurEntry.id));
      card.innerHTML = `
        <div class="collection-card-icon"><i class="fas fa-pencil"></i></div>
        <div class="bd-info">
          <h3>${editeurEntry.object.name}</h3>
          <p>${count} BD</p>
        </div>`;

      grid.appendChild(card);
    });

  list.appendChild(grid);
}

function search() {
  const inputSearch = document.getElementById("searchBarInput").value.trim().toLowerCase();

  if (inputSearch === "") {
    displayEditeurs(getAllEditions());
    return;
  }

  displayEditeurs(getAllEditions().filter(e =>
    (e.object.name || "").toLowerCase().includes(inputSearch)
  ));
}

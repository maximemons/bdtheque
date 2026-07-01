import { checkAuthAndRedirect } from '../../../scripts/auth-guard.js';
import { getDocumentById } from '../../../scripts/firebase-db.js';
import { Table, State } from '../../../scripts/enums.js';
import { Preferences, Editor, Collection, BD } from '../../../scripts/records.js';
import { fetchBDFromISBN } from '../../../scripts/openlibrary.js';
import { getCurrentUser } from '../../../scripts/firebase-auth.js';
import { resolveOwnership } from '../../../scripts/ownership.js';
import { showFatalError } from '../../../scripts/ui-error.js';
import {
  initBdBooksUtils,
  isCanWrite,
  loadNextBdPage,
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
  rawToEntry
} from '../../scripts/dbBooksUtils.js';

checkAuthAndRedirect();

// Id de la BD en cours d'édition, ou null si mode "création".
let editingBdId = null;
// Mode courant : "list" | "search-prefix" | "search-expand"
let searchMode = "list";
let currentSearchQuery = "";
let searchResults = [];
let expandScannedTotal = 0;
let expandRunning = false;

getCurrentUser().then(async (user) => {
  if (!user) return;

  try {
    const { ownerId, canWrite } = await resolveOwnership(user.email);
    initBdBooksUtils(ownerId, canWrite);

    initAddForm();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("search")) {
      document.getElementById("searchBarInput").value = urlParams.get("search");
    } else if (urlParams.has("add")) {
      showAddBdForm();
      document.getElementById("isbn").value = urlParams.get("add");
    } else if (urlParams.has("bd")) {
      Array.from(document.getElementsByClassName("shortcut-show")).forEach(e => e.classList.remove("shortcut-show"));
      await displayBD(urlParams.get("bd"));
      return;
    }

    Array.from(document.getElementsByClassName("shortcut-search")).forEach(e => e.classList.remove("shortcut-search"));

    document.getElementById("searchBarInput").addEventListener("change", onSearch);
    document.getElementById("searchBarInput").addEventListener("keydown", e => { if (e.key === "Enter") onSearch(); });
    document.getElementById("searchBar").addEventListener("click", onSearch);

    // Premier chargement
    await loadMoreBds();
  } catch (error) {
    showFatalError("bdList", error, "chargement de la page Mes BDs");
  }
}).catch(error => {
  showFatalError("bdList", error, "vérification de l'authentification");
});

function backToList() {
  window.location.href = window.location.origin + window.location.pathname;
}

function selectBd(idBd) {
  window.location.href = window.location.origin + window.location.pathname + "?bd=" + encodeURIComponent(idBd);
}

// --- Chargement par lots ---

async function loadMoreBds() {
  const btn = document.getElementById("loadMoreBtn");
  if (btn) btn.disabled = true;

  showListLoading();
  try {
    await loadNextBdPage();
    renderBdList(getLoadedBDs(), getBdHasMore());
  } catch (error) {
    showFatalError("bdList", error, "chargement des BDs");
  }
}

function showListLoading() {
  const bdList = document.getElementById("bdList");
  // Garde le contenu existant + ajoute un indicateur de chargement (on ne repart pas de zéro)
  let loader = document.getElementById("bdListLoader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "bdListLoader";
    loader.className = "bd-list-loader";
    loader.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Chargement...`;
    bdList.appendChild(loader);
  }
}

function renderBdList(bds, hasMore) {
  const bdList = document.getElementById("bdList");
  bdList.innerHTML = "";

  if (bds == undefined || bds.length === 0) {
    bdList.innerHTML = `<div class="empty">Aucune BD dans votre BDthèque pour le moment. Ajoutez-en une !</div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.classList.add("bd-list");

  bds.forEach(bd => appendBdCard(grid, bd));

  bdList.appendChild(grid);

  if (hasMore) {
    const btn = document.createElement("button");
    btn.id = "loadMoreBtn";
    btn.className = "load-more-btn";
    btn.innerHTML = `<i class="fas fa-chevron-down"></i> Charger plus`;
    btn.addEventListener("click", loadMoreBds);
    bdList.appendChild(btn);
  }
}

function appendBdCard(container, bd) {
  const number = bd.object.base_info?.number ? bd.object.base_info.number + " · " : "";
  const title = bd.object.base_info?.title || "Sans titre";
  const collection = bd.object.fk_collection?.name || "";
  const cover = bd.object.base_info?.cover || "";
  const state = bd.object.base_info?.state || "";

  const card = document.createElement("div");
  card.classList.add("bd-card");
  card.addEventListener("click", () => selectBd(bd.id));

  card.innerHTML = `
    <img src="${cover}" alt="${title}" class="bd-cover"/>
    <div class="bd-info">
      <h3>${number}${title}</h3>
      ${collection ? `<p class="bd-collection">${collection}</p>` : ""}
      ${state ? `<p><span class="state-badge">${state}</span></p>` : ""}
    </div>`;

  container.appendChild(card);
}

// --- Recherche ---

async function onSearch() {
  const query = document.getElementById("searchBarInput").value.trim();
  if (query === "") {
    searchMode = "list";
    searchResults = [];
    currentSearchQuery = "";
    renderBdList(getLoadedBDs(), getBdHasMore());
    return;
  }

  currentSearchQuery = query;
  searchMode = "search-prefix";
  resetExpandSearch();
  expandScannedTotal = 0;

  renderSearchLoading(query);
  try {
    searchResults = await searchBdByPrefix(query);
    renderSearchResults();
  } catch (error) {
    showFatalError("bdList", error, "recherche de BDs");
  }
}

function renderSearchLoading(query) {
  document.getElementById("bdList").innerHTML = `
    <div class="search-status">
      <i class="fas fa-search"></i> Recherche de <strong>« ${query} »</strong>…
    </div>`;
}

function renderSearchResults() {
  const bdList = document.getElementById("bdList");
  bdList.innerHTML = "";

  if (searchResults.length > 0) {
    const grid = document.createElement("div");
    grid.classList.add("bd-list");
    searchResults.forEach(bd => appendBdCard(grid, bd));
    bdList.appendChild(grid);
  } else {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = `Aucun résultat pour « ${currentSearchQuery} » parmi les titres commençant par ce terme.`;
    bdList.appendChild(empty);
  }

  // Bouton "Étendre la recherche"
  if (!expandRunning) {
    const expandSection = document.createElement("div");
    expandSection.className = "expand-search-section";
    expandSection.id = "expandSearchSection";
    expandSection.innerHTML = `
      <p class="expand-hint">Vous cherchez un terme au milieu du titre ?</p>
      <button id="expandSearchBtn" class="expand-search-btn">
        <i class="fas fa-database"></i> Étendre la recherche à toute la BDthèque
      </button>`;
    bdList.appendChild(expandSection);
    document.getElementById("expandSearchBtn").addEventListener("click", startExpandSearch);
  }
}

async function startExpandSearch() {
  expandRunning = true;
  expandScannedTotal = 0;
  const btn = document.getElementById("expandSearchBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Scan en cours… (0 BD vérifiées)`;
  }

  await runExpandBatch();
}

async function runExpandBatch() {
  const { matches, exhausted } = await expandSearchNextBatch(
    currentSearchQuery,
    count => {
      expandScannedTotal += count;
      const btn = document.getElementById("expandSearchBtn");
      if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Scan en cours… (${expandScannedTotal} BD vérifiées)`;
    }
  );

  // Fusionner sans doublon avec les résultats préfixe déjà affichés
  matches.forEach(bd => {
    if (!searchResults.some(r => r.id === bd.id)) searchResults.push(bd);
  });

  if (exhausted) {
    expandRunning = false;
    renderSearchExhausted();
  } else {
    renderSearchProgress();
    // Continue automatiquement lot par lot avec un délai minimal pour ne pas bloquer l'UI
    setTimeout(runExpandBatch, 20);
  }
}

function renderSearchProgress() {
  const grid = document.querySelector("#bdList .bd-list");
  if (grid) {
    grid.innerHTML = "";
    searchResults.forEach(bd => appendBdCard(grid, bd));
  }
  const btn = document.getElementById("expandSearchBtn");
  if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Scan en cours… (${expandScannedTotal} BD vérifiées)`;
}

function renderSearchExhausted() {
  const grid = document.querySelector("#bdList .bd-list");
  if (grid) {
    grid.innerHTML = "";
    searchResults.forEach(bd => appendBdCard(grid, bd));
  } else if (searchResults.length > 0) {
    const newGrid = document.createElement("div");
    newGrid.classList.add("bd-list");
    searchResults.forEach(bd => appendBdCard(newGrid, bd));
    document.getElementById("bdList").prepend(newGrid);
  }

  const section = document.getElementById("expandSearchSection");
  if (section) {
    section.innerHTML = `<p class="expand-done">
      <i class="fas fa-check-circle"></i> Scan complet — ${expandScannedTotal} BD vérifiées.
      ${searchResults.length === 0 ? `Aucun résultat pour « ${currentSearchQuery} ».` : `${searchResults.length} résultat(s).`}
    </p>`;
  }
}

// --- Fiche détail ---

async function displayBD(bdId) {
  const decodedId = decodeURI(bdId).replaceAll("%27", "'");
  let currentBD = getLoadedBDs().find(bd => bd.id === decodedId);

  if (currentBD == undefined) {
    // Pas encore en cache (accès direct via URL, ex: lien partagé) : charger uniquement cette BD.
    const raw = await getDocumentById(Table.BDs, decodedId).catch(() => undefined);
    currentBD = raw ? rawToEntry(raw) : undefined;
  }

  if (currentBD == undefined) {
    window.location.href = window.location.origin + window.location.pathname;
    return;
  }

  const displayCollection = currentBD.object.fk_collection == undefined ? "" :
    (currentBD.object.fk_collection.specialedition == undefined
      ? currentBD.object.fk_collection.name
      : currentBD.object.fk_collection.name + " : " + currentBD.object.fk_collection.specialedition);
  const displayEdition = currentBD.object.fk_edition == undefined ? "" : currentBD.object.fk_edition.name;

  document.getElementById("bdList").innerHTML =
    `<div class="bd-container-controls">
      ${isCanWrite() ? `
        <button id="editBdBtn" title="Modifier"><i class="fas fa-pencil"></i></button>
        <button id="deleteBdBtn" title="Supprimer"><i class="fas fa-trash"></i></button>
      ` : `<span class="readonly-badge"><i class="fas fa-eye"></i> Lecture seule</span>`}
    </div>
    <div class="bd-container">
      <div class="cover">
        <img src="${currentBD.object.base_info?.cover || ''}" alt="Couverture de la BD">
      </div>
      <div class="details">
        <h1>${currentBD.object.base_info?.title || ''}</h1>
        <h5>Collection : ${displayCollection}</h5>
        <h5>Edition : ${displayEdition}</h5>
        <div class="info-grid">
          <dt>ISBN</dt><dd>${currentBD.object.base_info?.ISBN || ""}</dd>
          <dt>Numéro</dt><dd>${currentBD.object.base_info?.number || ""}</dd>
          <dt>État</dt><dd>${currentBD.object.base_info?.state ? `<span class="state-badge">${currentBD.object.base_info.state}</span>` : ""}</dd>
          <dt>Année</dt><dd>${currentBD.object.base_info?.year || ""}</dd>
          <dt>Date d'achat</dt><dd>${currentBD.object.purchasedate || ""}</dd>
        </div>
        <div class="section">
          <h2>Détails supplémentaires</h2>
          <div class="info-grid">
            <dt>Édition spéciale</dt><dd>${currentBD.object.details?.goldedition || ""}</dd>
            <dt>Spécialité</dt><dd>${currentBD.object.details?.special || ""}</dd>
            <dt>Côte</dt><dd>${currentBD.object.details?.reputation || ""}</dd>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById("editBdBtn")?.addEventListener("click", () => openEditBdForm(currentBD));
  document.getElementById("deleteBdBtn")?.addEventListener("click", () => onDeleteBd(currentBD));
}

function openEditBdForm(currentBD) {
  editingBdId = currentBD.id;
  showAddBdForm();

  document.getElementById("formTitle").textContent = "Modifier la BD";
  document.querySelector('#livre-form button[type="submit"]').textContent = "Enregistrer";

  document.getElementById("collection").value = currentBD.object.fk_collection?.name || "";
  document.getElementById("edition_speciale").value = currentBD.object.fk_collection?.specialedition || "";
  document.getElementById("editeur").value = currentBD.object.fk_edition?.name || "";
  document.getElementById("isbn").value = currentBD.object.base_info?.ISBN || "";
  document.getElementById("numero").value = currentBD.object.base_info?.number || "";
  document.getElementById("titre").value = currentBD.object.base_info?.title || "";
  document.getElementById("annee").value = currentBD.object.base_info?.year || "";
  document.getElementById("couvertureImage").src = currentBD.object.base_info?.cover || "";
  document.getElementById("etat").value = currentBD.object.base_info?.state || "";
  document.getElementById("edition_or").value = currentBD.object.details?.goldedition || "";
  document.getElementById("specialite").value = currentBD.object.details?.special || "";
  document.getElementById("cote").value = currentBD.object.details?.reputation || "";
  document.getElementById("date_achat").value = currentBD.object.purchasedate || "";
}

async function onDeleteBd(currentBD) {
  const title = currentBD.object.base_info?.title || "cette BD";
  if (!window.confirm(`Supprimer définitivement « ${title} » de votre BDthèque ?`)) return;
  document.getElementById("deleteBdBtn").disabled = true;
  await deleteBook(currentBD.id);
  backToList();
}

// --- Formulaire d'ajout/édition ---

function showAddBdForm() {
  document.getElementById("addBd").style.display = "block";
  document.getElementById("modal").style.display = "block";
}

function hideAddBdForm() {
  document.getElementById("addBd").style.display = "none";
  document.getElementById("modal").style.display = "none";
  Array.from(document.getElementById("addBd").getElementsByTagName("input")).forEach(e => { e.value = ""; });
  document.getElementById("couvertureImage").src = "";
  editingBdId = null;
  document.getElementById("formTitle").textContent = "Ajouter une BD";
  document.querySelector('#livre-form button[type="submit"]').textContent = "Créer";
}

function initAddForm() {
  const etats = Object.keys(State);
  const etatSelect = document.getElementById("etat");
  etats.forEach(key => {
    const opt = document.createElement("option");
    opt.value = State[key];
    opt.textContent = key.replace(/([A-Z])/g, (m, p, offset) => offset === 0 ? p : ' ' + p);
    etatSelect.appendChild(opt);
  });

  // Autocomplete sur les valeurs déjà chargées (enrichies au fur et à mesure)
  setupAutocomplete("collection", () => getLoadedCollections().map(c => c.object.name).filter(Boolean), "collection-suggestions");
  setupAutocomplete("editeur", () => getLoadedEditions().map(e => e.object.name).filter(Boolean), "editeur-suggestions");

  document.getElementById("isbn").addEventListener("input", formatIsbnInput);
  document.getElementById("isbn").addEventListener("focusout", e => getInfosFromISBN(e.target.value));
  document.getElementById("livre-form").addEventListener("submit", onSubmitAddBdForm);
  document.getElementById("couverture").addEventListener("change", previewImageForm);
  document.getElementById("cancelAddBd").addEventListener("click", hideAddBdForm);
  document.getElementById("openAddBdForm").addEventListener("click", showAddBdForm);
  document.getElementById("backToListBtn").addEventListener("click", backToList);
}

async function onSubmitAddBdForm(e) {
  e.preventDefault();
  Array.from(document.getElementsByClassName("formAction")).forEach(btn => { btn.disabled = true; });
  try {
    const collection = new Collection(
      document.getElementById("collection").value.trim() || undefined,
      document.getElementById("edition_speciale").value.trim() || undefined
    );
    const editeur = new Editor(document.getElementById("editeur").value.trim() || undefined);
    const bd = formToBd();

    if (editingBdId) {
      const idBeingEdited = editingBdId;
      await updateBook(idBeingEdited, bd, collection, editeur);
      hideAddBdForm();
      selectBd(idBeingEdited);
    } else {
      await createBook(bd, collection, editeur);
      hideAddBdForm();
      backToList();
    }
  } finally {
    Array.from(document.getElementsByClassName("formAction")).forEach(btn => { btn.disabled = false; });
  }
}

// L'autocomplete prend une fonction () => string[] plutôt qu'un tableau fixe,
// pour toujours refléter les collections/éditeurs chargés au moment de la frappe.
function setupAutocomplete(inputId, getItems, listId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  input.addEventListener("input", () => {
    const value = input.value.toLowerCase();
    list.innerHTML = "";
    if (value === "") { list.style.display = "none"; return; }

    const items = [...new Set(getItems())];
    const filtered = items.filter(item => item.toLowerCase().startsWith(value));
    filtered.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item;
      li.addEventListener("click", () => {
        input.value = item;
        list.innerHTML = "";
        list.style.display = "none";
      });
      list.appendChild(li);
    });
    list.style.display = filtered.length ? "block" : "none";
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".autocomplete-container")) {
      list.innerHTML = "";
      list.style.display = "none";
    }
  });
}

function formatIsbnInput(event) {
  const input = event.target;
  let value = input.value.replace(/[^0-9Xx]/g, '');
  if (value.length === 10) {
    input.value = value.toUpperCase().replace(/^(\d{1,5})(\d{1,7})(\d{1,7})([\dX])$/, '$1-$2-$3-$4');
  } else if (value.length === 13) {
    input.value = value.replace(/^(\d{3})(\d{1,5})(\d{1,7})(\d{1,7})(\d)$/, '$1-$2-$3-$4-$5');
  }
}

async function getInfosFromISBN(isbnValue) {
  if (!isbnValue || isbnValue.trim() === "") return;
  const infos = await fetchBDFromISBN(isbnValue.replaceAll("-", ""));
  if (infos) BDtoForm(infos);
}

function BDtoForm(bd) {
  document.getElementById("collection").value = bd.fk_collection || "";
  document.getElementById("editeur").value = bd.fk_edition || "";
  document.getElementById("numero").value = bd.base_info?.number || "";
  document.getElementById("titre").value = bd.base_info?.title || "";
  document.getElementById("annee").value = bd.base_info?.year || "";
  document.getElementById("couvertureImage").src = bd.base_info?.cover || "";
}

function formToBd() {
  const val = id => {
    const v = document.getElementById(id).value.trim();
    return v === "" ? undefined : v;
  };
  const coverSrc = document.getElementById("couvertureImage").src.trim();
  const cover = (coverSrc === "" || coverSrc.startsWith("file://")) ? undefined : coverSrc;
  return new BD(undefined, undefined, val("isbn")?.replaceAll("-", ""), val("numero"),
    val("titre"), val("annee"), val("etat"), cover, val("cote"), val("edition_or"), val("specialite"), val("date_achat"));
}

function previewImageForm() {
  const file = document.getElementById("couverture").files[0];
  const preview = document.getElementById("couvertureImage");
  if (file) {
    const reader = new FileReader();
    reader.onload = e => { preview.src = e.target.result; };
    reader.readAsDataURL(file);
  } else {
    preview.src = "";
  }
}

import { checkAuthAndRedirect } from '../../../scripts/auth-guard.js';
import { getDocumentById } from '../../../scripts/firebase-db.js';
import { Table, State } from '../../../scripts/enums.js';
import { Preferences, Editor, Collection, BD } from '../../../scripts/records.js';
import { fetchBDFromISBN } from '../../../scripts/openlibrary.js';
import {
  initBdBooksUtils,
  createBook,
  updateBook,
  deleteBook,
  searchBD,
  getAllBDs,
  getAllCollections,
  getAllEditions
} from '../../scripts/dbBooksUtils.js';
import { getCurrentUser, logout } from '../../../scripts/firebase-auth.js';

checkAuthAndRedirect();

// Id de la BD en cours d'édition, ou null si on est en mode "création".
let editingBdId = null;

getCurrentUser().then(async (user) => {
  if (!user) {
    return; // checkAuthAndRedirect() prend déjà en charge la redirection
  }

  let userPreferences = await getDocumentById(Table.Preferences, user.email).catch(() => undefined);
  if (userPreferences == undefined) {
    userPreferences = new Preferences();
  }

  // Init scanner code-barres
  initiateScanner("searchCamera", "closeCamera", "video", "overlay", "searchBarInput", function () {
    document.getElementById('searchBar').click();
  });
  document.getElementById("searchCamera").addEventListener("click", function () {
    document.getElementById("contentVideo").style.display = "block";
  });

  await initBdBooksUtils();
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

  document.getElementById("searchBarInput").addEventListener("change", search);
  document.getElementById("searchBar").addEventListener("click", search);
  document.getElementById("logoutBtn")?.addEventListener("click", logout);

  search();
});

function backToList() {
  window.location.href = window.location.origin + window.location.pathname;
}

function selectBd(idBd) {
  window.location.href = window.location.origin + window.location.pathname + "?bd=" + idBd;
}

async function displayBD(bdId) {
  const currentBD = getAllBDs().find(bd => bd.id === decodeURI(bdId).replaceAll("%27", "'"));
  if (currentBD == undefined) {
    window.location.href = window.location.origin + window.location.pathname;
    return;
  }

  const displayCollection = currentBD.object.fk_collection == undefined ? "" :
    (currentBD.object.fk_collection.specialedition == undefined ? currentBD.object.fk_collection.name :
      (currentBD.object.fk_collection.name + " : " + currentBD.object.fk_collection.specialedition));
  const displayEdition = currentBD.object.fk_edition == undefined ? "" : currentBD.object.fk_edition.name;

  document.getElementById("bdList").innerHTML =
    `<div class="bd-container-controls">
      <button id="editBdBtn" title="Modifier">
        <i class="fas fa-pencil"></i>
      </button>
      <button id="deleteBdBtn" title="Supprimer">
        <i class="fas fa-trash"></i>
      </button>
   </div>
   <div class="bd-container">
      <div class="cover">
        <img src="${currentBD.object.base_info?.cover || ''}" alt="Couverture de la BD">
      </div>
      <div class="details">
        <h1 id="title">${currentBD.object.base_info?.title || ''}</h1>
        <h5>Collection : ${displayCollection}</h5>
        <h5>Edition : ${displayEdition}</h5>
        <div class="info-grid">
          <dt>ISBN</dt>
          <dd id="isbn">${currentBD.object.base_info?.ISBN || ""}</dd>
          <dt>Numéro</dt>
          <dd id="number">${currentBD.object.base_info?.number || ""}</dd>
          <dt>État</dt>
          <dd id="state">${currentBD.object.base_info?.state ? `<span class="state-badge">${currentBD.object.base_info.state}</span>` : ""}</dd>
          <dt>Année</dt>
          <dd id="year">${currentBD.object.base_info?.year || ""}</dd>
          <dt>Date d'achat</dt>
          <dd id="purchasedate">${currentBD.object.purchasedate || ""}</dd>
        </div>
        <div class="section">
          <h2>Détails supplémentaires</h2>
          <div class="info-grid">
            <dt>Édition spéciale</dt>
            <dd id="goldedition">${currentBD.object.details?.goldedition || ""}</dd>
            <dt>Spécialité</dt>
            <dd id="special">${currentBD.object.details?.special || ""}</dd>
            <dt>Côte</dt>
            <dd id="reputation">${currentBD.object.details?.reputation || ""}</dd>
          </div>
        </div>
      </div>
  </div>`;

  document.getElementById("editBdBtn").addEventListener("click", () => openEditBdForm(currentBD));
  document.getElementById("deleteBdBtn").addEventListener("click", () => onDeleteBd(currentBD));
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
  if (!window.confirm(`Supprimer définitivement « ${title} » de votre BDthèque ?`)) {
    return;
  }

  document.getElementById("deleteBdBtn").disabled = true;
  await deleteBook(currentBD.id);
  backToList();
}

function displayBDs(bds) {
  const bdList = document.getElementById("bdList");

  if (bds == undefined || bds == null || bds.length == 0) {
    bdList.innerHTML = `<div class="collection-block"><h2>La liste est vide</h2></div>`;
    return;
  }

  const grouped = {};

  bds.sort((a, b) => {
    const numA = parseInt(a.object.base_info?.number, 10) || 0;
    const numB = parseInt(b.object.base_info?.number, 10) || 0;

    if (numA !== numB) return numA - numB;

    const titleA = (a.object.base_info?.title || "").toLowerCase();
    const titleB = (b.object.base_info?.title || "").toLowerCase();

    return titleA.localeCompare(titleB);
  });

  bds.forEach(bd => {
    const col = bd.object.fk_collection?.name || "Sans collection";
    const special = bd.object.fk_collection?.specialedition;
    const key = special ? `${col} : ${special}` : col;

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(bd);
  });

  bdList.innerHTML = "";

  for (const [collectionName, bdsInGroup] of Object.entries(grouped)) {
    const block = document.createElement("div");
    block.classList.add("collection-block");

    const heading = document.createElement("h2");
    heading.textContent = collectionName;
    block.appendChild(heading);

    const listDiv = document.createElement("div");
    listDiv.classList.add("bd-list");

    bdsInGroup.forEach(bd => {
      const number = bd.object.base_info?.number ? bd.object.base_info.number + "- " : "";
      const title = bd.object.base_info?.title || "Sans titre";
      const year = bd.object.base_info?.year || "";
      const cover = bd.object.base_info?.cover || "";

      const card = document.createElement("div");
      card.classList.add("bd-card");
      card.addEventListener("click", () => selectBd(bd.id));

      card.innerHTML = `
        <img src="${cover}" alt="${title}" class="bd-cover"/>
        <div class="bd-info">
          <h3>${number}${title}</h3>
          <p>${year}</p>
        </div>`;

      listDiv.appendChild(card);
    });

    block.appendChild(listDiv);
    bdList.appendChild(block);
  }
}

function showAddBdForm() {
  document.getElementById("addBd").style.display = "block";
  document.getElementById("modal").style.display = "block";
}

function hideAddBdForm() {
  document.getElementById("addBd").style.display = "none";
  document.getElementById("modal").style.display = "none";

  Array.from(document.getElementById("addBd").getElementsByTagName("input")).forEach(elem => {
    elem.value = "";
  });
  document.getElementById("couvertureImage").src = "";

  editingBdId = null;
  document.getElementById("formTitle").textContent = "Ajouter une BD";
  document.querySelector('#livre-form button[type="submit"]').textContent = "Créer";
}

function initAddForm() {
  const etats = Object.keys(State);
  const etatsJson = etats.map(e => ({
    value: State[e],
    libelle: e.replace(/([A-Z])/g, (match, p1, offset) => (offset === 0 ? p1 : ' ' + p1))
  }));

  const etatSelect = document.getElementById("etat");
  etatsJson.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.value;
    opt.textContent = e.libelle;
    etatSelect.appendChild(opt);
  });

  setupAutocomplete("collection", getAllCollections().map(c => c.object.name).filter(Boolean), "collection-suggestions");
  setupAutocomplete("editeur", getAllEditions().map(e => e.object.name).filter(Boolean), "editeur-suggestions");

  document.getElementById("isbn").addEventListener("input", formatIsbnInput);
  document.getElementById("isbn").addEventListener("focusout", (e) => getInfosFromISBN(e.target.value));
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

function setupAutocomplete(inputId, dataArray, listId) {
  dataArray = [...new Set(dataArray)];

  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  input.addEventListener("input", () => {
    const value = input.value.toLowerCase();
    list.innerHTML = "";
    if (value === "") {
      list.style.display = "none";
      return;
    }
    const filtered = dataArray.filter(item => item.toLowerCase().startsWith(value));
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

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-container")) {
      list.innerHTML = "";
      list.style.display = "none";
    }
  });
}

function formatIsbnInput(event) {
  const input = event.target;
  let value = input.value.replace(/[^0-9Xx]/g, ''); // on enlève tout sauf chiffres et X

  if (value.length === 10) {
    // ISBN-10
    value = value.toUpperCase();
    input.value = value.replace(/^(\d{1,5})(\d{1,7})(\d{1,7})([\dX])$/, '$1-$2-$3-$4');
  } else if (value.length === 13) {
    // ISBN-13
    input.value = value.replace(/^(\d{3})(\d{1,5})(\d{1,7})(\d{1,7})(\d)$/, '$1-$2-$3-$4-$5');
  }
  // Sinon : ISBN incomplet, on laisse l'utilisateur continuer à taper sans reformater.
}

async function getInfosFromISBN(isbnValue) {
  if (!isbnValue || isbnValue.trim() === "") return;
  const infos = await fetchBDFromISBN(isbnValue.replaceAll("-", ""));
  if (infos) {
    BDtoForm(infos);
  }
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
  const cover = (coverSrc === "" || coverSrc.indexOf("file://") === 0) ? undefined : coverSrc;

  return new BD(
    undefined,
    undefined,
    val("isbn")?.replaceAll("-", ""),
    val("numero"),
    val("titre"),
    val("annee"),
    val("etat"),
    cover,
    val("cote"),
    val("edition_or"),
    val("specialite"),
    val("date_achat")
  );
}

function previewImageForm() {
  const fileInput = document.getElementById("couverture");
  const preview = document.getElementById("couvertureImage");

  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    preview.src = "";
  }
}

function search() {
  const inputSearch = document.getElementById("searchBarInput").value;

  if (inputSearch.trim() === "") {
    displayBDs(getAllBDs());
    return;
  }
  displayBDs(searchBD(inputSearch));
}

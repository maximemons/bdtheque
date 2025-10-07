const auth = firebase.auth();
const db = firebase.firestore();

auth.onAuthStateChanged(async (user) => {
  if(!user) {
    window.location.href = "../index.html";
  } else {
    let userPreferences = await getElement(CollectionsName.Preferences, user.email);
    if(userPreferences == undefined) {
      userPreferences = new Preferences();
    }

    //Init scanner
    initiateScanner("searchCamera", "closeCamera", "video", "overlay", "searchBarInput", function(){document.getElementById('searchBar').click();});
    document.getElementById("searchCamera").addEventListener("click", function(){ document.getElementById("contentVideo").style.display = "block"; });

    await initBdBooksUtils();

    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.has("search")){
      document.getElementById("searchBarInput").value = urlParams.get("search");
    }else if(urlParams.has("add")){
      showAddBdForm();
      document.getElementById("isbn").value = urlParams.get("add");
    }else if(urlParams.has("bd")){
      Array.from(document.getElementsByClassName("shortcut-show")).forEach(e => e.classList.remove("shortcut-show"));
      await displayBD(urlParams.get("bd"));
      return;
    }

    Array.from(document.getElementsByClassName("shortcut-search")).forEach(e => e.classList.remove("shortcut-search"));
    await initAddForm();

    document.getElementById("searchBarInput").addEventListener("change", search);
    document.getElementById("searchBar").addEventListener("click", search);

    search();
  }
});

function backToList() {
  window.location.href = window.location.origin + window.location.pathname;
}

function selectBd(idBd) {
 window.location.href = window.location.origin + window.location.pathname + "?bd=" + idBd; 
}

async function displayBD(bdId) {
  let currentBD = ALLBDS.find(bd => bd.id === decodeURI(bdId).replaceAll("%27", "'"));
  if(currentBD == undefined) {
    window.location.href = window.location.origin + window.location.pathname;
    return;
  }

  let displayCollection = currentBD.object.fk_collection == undefined ? "" : 
    (currentBD.object.fk_collection.specialedition == undefined ? currentBD.object.fk_collection.name : 
      (currentBD.object.fk_collection.name + " : " + currentBD.object.fk_collection.specialedition));
  let displayEdition = currentBD.object.fk_edition == undefined ? "" : currentBD.object.fk_edition.name;

  document.getElementById("bdList").innerHTML = 
  `<div class="bd-container-controls">
      <button>
        <i class="fas fa-pencil"></i>
      </button>
      <button>
        <i class="fas fa-save"></i>
      </button>
   </div>
   <div class="bd-container">
      <div class="cover">
        <img src="${currentBD.object.base_info.cover}" alt="Couverture de la BD">
      </div>
      <div class="details">
        <h1 id="title">${currentBD.object.base_info.title}</h1>
        <h5>Collection : ${displayCollection}</h5>
        <h5>Edition : ${displayEdition}</h5>
        <div class="info-grid">
          <dt>ISBN</dt>
          <dd id="isbn">${currentBD.object.base_info?.ISBN || ""}</dd>
          <dt>Numéro</dt>
          <dd id="number">${currentBD.object.base_info?.number || ""}</dd>
          <dt>État</dt>
          <dd id="state">${currentBD.object.base_info?.state || ""}</dd>
          <dt>Année</dt>
          <dd id="year">${currentBD.object.base_info?.year || ""}</dd>
          <dt>Date d'achat</dt>
          <dd id="purchasedate">${currentBD.object.purchesedate || ""}</dd>
        </div>
        <div class="section">
          <h2>Détails supplémentaires</h2>
          <div class="info-grid">
            <dt>Édition spéciale</dt>
            <dd id="goldedition">${currentBD.object.details?.goldedition ||""}</dd>
            <dt>Spécialité</dt>
            <dd id="special">${currentBD.object.details?.special ||""}</dd>
            <dt>Côte</dt>
            <dd id="reputation">${currentBD.object.details?.reputation ||""}</dd>
          </div>
        </div>
      </div>
  </div>`;

}

function displayBDs(bds) {
  let bdList = document.getElementById("bdList");

  if(bds == undefined || bds == null || bds.length == 0){
    bdList.innerHTML = `<div class="collection-block"><h2>La liste est vide</h2></div>`;
    return;
  }

  bdList.innerHTML = "";

  const grouped = {};

  bds.sort((a, b) => {
    const numA = parseInt(a.object.base_info.number, 10);
    const numB = parseInt(b.object.base_info.number, 10);

    if (numA !== numB) return numA - numB;

    const titleA = a.object.base_info.title.toLowerCase();
    const titleB = b.object.base_info.title.toLowerCase();

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

  // Générer le HTML
  let html = "";
  for (const [collectionName, bdList] of Object.entries(grouped)) {
    html += `<div class="collection-block"">`;
    html += `<h2>${collectionName}</h2>`;
    html += `<div class="bd-list">`;
    bdList.forEach(bd => {
      const number = (bd.object.base_info?.number) ? bd.object.base_info?.number + "- " : ""; 
      const title = bd.object.base_info?.title || "Sans titre";
      const year = bd.object.base_info?.year || "";
      const cover = bd.object.base_info?.cover || "";

      html += `
      <div class="bd-card" onclick="selectBd('${encodeURI(bd.id.replaceAll("'", "%27"))}')">
      <img src="${cover}" alt="${title}" class="bd-cover"/>
      <div class="bd-info">
      <h3>${number}${title}</h3>
      <p>${year}</p>
      </div>
      </div>
      `;
    });
    html += `</div>`;
    html += `</div>`;
  }

  bdList.innerHTML = html;
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
}

async function initAddForm() {
  let etats = Object.keys(Etat);
  const etatsJson = [];

  etats.forEach(e => {
    etatsJson.push({
      value: Etat[e],
      libelle : e.replace(/([A-Z])/g, (match, p1, offset) => {return offset === 0 ? p1 : ' ' + p1;})
    });
  });

  const fillSelect = () => {
    const etatSelect = document.getElementById("etat");
    etatsJson.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e.value;
      opt.textContent = e.libelle;
      etatSelect.appendChild(opt);
    });
  };
  fillSelect();

  setupAutocomplete("collection", ALLCOLLECTIONS.map(c => c.object.name), "collection-suggestions");
  setupAutocomplete("editeur", ALLEDITIONS.map(e => e.object.name), "editeur-suggestions");

  // Validation ISBN simple
  const form = document.getElementById("livre-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const isbn = document.getElementById("isbn").value;
    Array.from(document.getElementsByClassName("formAction")).forEach(btn => {btn.disabled = true;});

    let collection = new Collection(
      document.getElementById("collection").value.trim() == "" ? undefined : document.getElementById("collection").value.trim(),
      document.getElementById("edition_speciale").value.trim() == "" ? undefined : document.getElementById("edition_speciale").value.trim());
    let editeur = new Editor(document.getElementById("editeur").value.trim() == "" ? undefined : document.getElementById("editeur").value.trim());
    let bd = formToBd();

    await createBook(bd, collection, editeur);
    backToList();
  });
};

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

const isbnInput = document.getElementById("isbn");

isbnInput.addEventListener("input", (input) => {
    let value = input.value.replace(/[^0-9Xx]/g, ''); // on enlève tout sauf chiffres et X

    if (value.length === 10) {
        // ISBN-10
        value = value.toUpperCase();
        // Format standard : 1-234-56789-X
        let formatted = value.replace(/^(\d{1,5})(\d{1,7})(\d{1,7})([\dX])$/, '$1-$2-$3-$4');
        input.value = formatted;
      } else if (value.length === 13) {
        // ISBN-13
        let formatted = value.replace(/^(\d{3})(\d{1,5})(\d{1,7})(\d{1,7})(\d)$/, '$1-$2-$3-$4-$5');
        input.value = formatted;
      } else {
        // Valeur non valide, on ne touche pas
        console.warn('ISBN invalide ou longueur incorrecte');
      }
    });

async function getInfosFromISBN(isbnValue) {
  let infos = await fetchBDFromISBN(isbnValue.replaceAll("-", ""));
  BDtoForm(infos);
}

function BDtoForm(bd) {
  document.getElementById("collection").value = bd.fk_collection || "";
  document.getElementById("editeur").value = bd.fk_edition || "";
  document.getElementById("numero").value = bd.base_info?.numero || "";
  document.getElementById("titre").value = bd.base_info?.title || "";
  document.getElementById("annee").value = bd.base_info?.year || "";
  document.getElementById("couvertureImage").src = bd.base_info?.cover || "";
}

function formToBd() {
  return new BD(
    undefined,
    undefined,
    document.getElementById("isbn").value.trim() == "" ? undefined : document.getElementById("isbn").value.trim().replaceAll("-", ""),
    document.getElementById("numero").value.trim() == "" ? undefined : document.getElementById("numero").value.trim(),
    document.getElementById("titre").value.trim() == "" ? undefined : document.getElementById("titre").value.trim(),
    document.getElementById("annee").value.trim() == "" ? undefined : document.getElementById("annee").value.trim(),
    document.getElementById("etat").value.trim() == "" ? undefined : document.getElementById("etat").value.trim(),
    document.getElementById("couvertureImage").src.trim() == "" ? undefined : 
      (document.getElementById("couvertureImage").src.trim().indexOf("file://") == 0 ? undefined : document.getElementById("couvertureImage").src.trim()),
    document.getElementById("cote").value.trim() == "" ? undefined : document.getElementById("cote").value.trim(),
    document.getElementById("edition_or").value.trim() == "" ? undefined : document.getElementById("edition_or").value.trim(),
    document.getElementById("specialite").value.trim() == "" ? undefined : document.getElementById("specialite").value.trim(),
    document.getElementById("date_achat").value.trim() == "" ? undefined : document.getElementById("date_achat").value.trim()
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
  let inputSearch = document.getElementById("searchBarInput").value;

  if(inputSearch.trim == "") {
    displayBDs(ALLBDS);
    return;
  }
  displayBDs(searchBD(inputSearch));
}
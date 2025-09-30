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
    await initAddForm();
    displayBDs(ALLBDS);
  }
});

function displayBDs(bds) {
  // Grouper les BDs par collection + specialedition
  const grouped = {};

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
    html += `<div class="collection-block">`;
    html += `<h2>${collectionName}</h2>`;
    html += `<div class="bd-list">`;
    bdList.forEach(bd => {
      const title = bd.object.base_info?.title || "Sans titre";
      const year = bd.object.base_info?.year || "";
      const cover = bd.object.base_info?.cover || "https://maximemons.github.io/bdtheque/dashboard/bds/img/nocover.jpg";

      html += `
      <div class="bd-card">
      <img src="${cover}" alt="${title}" class="bd-cover"/>
      <div class="bd-info">
      <h3>${title}</h3>
      <p>${year}</p>
      </div>
      </div>
      `;
    });
    html += `</div>`;
    html += `</div>`;
  }

  document.getElementById("bdList").innerHTML = html;
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
  completeCollection = Array.from(await getElements(CollectionsName.Collections));
  collections = completeCollection.map(c => c.name);
  editeurs = Array.from(await getElements(CollectionsName.Editeurs)).map(e => e.name);
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

  setupAutocomplete("collection", collections, "collection-suggestions");
  setupAutocomplete("editeur", editeurs, "editeur-suggestions");

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
    window.location.reload();
  });
};

function setupAutocomplete(inputId, dataArray, listId) {
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


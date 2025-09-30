const auth = firebase.auth();
const db = firebase.firestore();

let allBDS = undefined;

let collections = [];
let completeCollection = [];
let editions = [];

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

    await getAllBds();
    await displayAllBds();

    await initAddForm();
  }
});

async function getAllBds() {
  let bds = await getElements(CollectionsName.BDs);

  if(bds == undefined || bds.length == 0) {
    allBDS = [];

    return allBDS; 
  }

  allBDS = bds.sort((a, b) => {
    const colA = a.fk_collection ? a.fk_collection.toLowerCase() : null;
    const colB = b.fk_collection ? b.fk_collection.toLowerCase() : null;

    if (colA === null && colB !== null) return 1;
    if (colA !== null && colB === null) return -1;

    if (colA !== null && colB !== null) {
      if (colA < colB) return -1;
      if (colA > colB) return 1;
    }
    const numA = a.base_info?.number ?? null;
    const numB = b.base_info?.number ?? null;

    if (numA === null && numB !== null) return 1;
    if (numA !== null && numB === null) return -1;

    if (numA !== null && numB !== null) {
      return numA - numB;
    }

    return 0;
  });

  return allBDS;
}

async function displayAllBds() {
  let data = allBDS;

  // Récupérer toutes les collections
  let allCollections = Array.from(await getElements(CollectionsName.Collections)).map(item => item.name);
  allCollections.push("Sans collection");

  // Grouper les BDs par collection
  const grouped = {};
  allCollections.forEach(col => grouped[col] = []);
  data.forEach(item => {
    const collection = item.fk_collection || "Sans collection";
    grouped[collection].push(item);
  });

  const bdList = document.getElementById("bdList");
  bdList.innerHTML = ""; // vider avant ajout

  Object.entries(grouped).forEach(([col, items]) => {
    // Séparer normales et spéciales
    const normales = [];
    const specialesMap = {}; // on peut avoir plusieurs types de specialedition

    items.forEach(bd => {
      const specialKey =
        bd.fk_specialedition ||
        (bd.details && Object.keys(bd.details).find(k => k.toLowerCase().includes("special")));

      if (specialKey) {
        const specialValue = bd.fk_specialedition || bd.details[specialKey];
        if (!specialesMap[specialValue]) specialesMap[specialValue] = [];
        specialesMap[specialValue].push(bd);
      } else {
        normales.push(bd);
      }
    });

    // Fonction pour créer une section
    function createSection(title, bds) {
      const section = document.createElement("section");
      section.className = "collection-section";
      section.id = "col-" + title.replace(/\s+/g, "-");

      const h3 = document.createElement("h3");
      h3.textContent = title;
      section.appendChild(h3);

      if (bds.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "empty";
        emptyMsg.textContent = "Liste vide";
        section.appendChild(emptyMsg);
      } else {
        const grid = document.createElement("div");
        grid.className = "bds";

        bds.forEach(bd => {
          const card = document.createElement("div");
          card.className = "bd";

          if (bd.base_info.cover) {
            const img = document.createElement("img");
            img.src = bd.base_info.cover;
            img.alt = bd.base_info.title;
            card.appendChild(img);
          }

          const titleDiv = document.createElement("div");
          titleDiv.className = "title";
          titleDiv.textContent =
            (bd.base_info.number ? bd.base_info.number + ". " : "") + bd.base_info.title;
          card.appendChild(titleDiv);

          if (bd.base_info.year) {
            const year = document.createElement("div");
            year.className = "year";
            year.textContent = bd.base_info.year;
            card.appendChild(year);
          }

          grid.appendChild(card);
        });

        section.appendChild(grid);
      }

      bdList.appendChild(section);
    }

    // Créer la section normales
    createSection(col, normales);

    // Créer les sections spéciales avec le nom exact
    Object.entries(specialesMap).forEach(([specialName, bds]) => {
      createSection(`${col} : ${specialName}`, bds);
    });
  });
}

// async function displayAllBds() {
//   let data = allBDS;

//   const allCollections = Array.from(await getElements(CollectionsName.Collections)).map(item => item.name);
//   allCollections.push("Sans collection");
//     // Grouper par collection
//     const grouped = {};
//     allCollections.forEach(col => grouped[col] = []); // pré-remplir
//     data.forEach(item => {
//       const collection = item.fk_collection || "Sans collection";
//       grouped[collection].push(item);
//     });

//     // Affichage BD
//     const bdList = document.getElementById("bdList");
//     Object.entries(grouped).forEach(([col, items]) => {
//       const section = document.createElement("section");
//       section.className = "collection-section";
//       section.id = "col-" + col;

//       const h3 = document.createElement("h3");
//       h3.textContent = col;
//       section.appendChild(h3);

//       if (items.length === 0) {
//         // Cas liste vide
//         const emptyMsg = document.createElement("div");
//         emptyMsg.className = "empty";
//         emptyMsg.textContent = "Liste vide";
//         section.appendChild(emptyMsg);
//       } else {
//         // Cas avec BD
//         const grid = document.createElement("div");
//         grid.className = "bds";

//         items.forEach(bd => {
//           const card = document.createElement("div");
//           card.className = "bd";

//           if (bd.base_info.cover) {
//             const img = document.createElement("img");
//             img.src = bd.base_info.cover;
//             img.alt = bd.base_info.title;
//             card.appendChild(img);
//           }

//           const title = document.createElement("div");
//           title.className = "title";
//           title.textContent = (bd.base_info.number ? bd.base_info.number + ". " : "") + bd.base_info.title;
//           card.appendChild(title);

//           if (bd.base_info.year) {
//             const year = document.createElement("div");
//             year.className = "year";
//             year.textContent = bd.base_info.year;
//             card.appendChild(year);
//           }

//           grid.appendChild(card);
//         });

//         section.appendChild(grid);
//       }

//       bdList.appendChild(section);
//     });
//   }

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

    let bd = formToBd();
    await createOrUpdateElement(CollectionsName.BDs, bd, bd.fk_collection + ":" + bd.fk_edition + ":" + bd.base_info.title + ":" + generateShortUUID());
    if(bd.fk_collection != undefined) {
      if(completeCollection.findIndex(item => item.name === bd.fk_collection && item.specialedition === bd.fk_specialedition) == -1){
        await createOrUpdateElement(CollectionsName.Collections, new Collection(bd.fk_collection, bd.fk_specialedition), bd.fk_collection + ":" + bd.fk_specialedition + ":" + generateShortUUID());
      }
    }
    if(bd.fk_edition != undefined && editions.indexOf(bd.fk_edition) == -1) {
      await createOrUpdateElement(CollectionsName.Editeurs, new Editor(bd.fk_edition), bd.fk_edition + ":" + generateShortUUID());
    }
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
    document.getElementById("collection").value.trim() == "" ? undefined : document.getElementById("collection").value.trim(),
    document.getElementById("editeur").value.trim() == "" ? undefined : document.getElementById("editeur").value.trim(),
    document.getElementById("edition_speciale").value.trim() == "" ? undefined : document.getElementById("edition_speciale").value.trim(),
    document.getElementById("isbn").value.trim() == "" ? undefined : document.getElementById("isbn").value.trim().replaceAll("-", ""),
    document.getElementById("numero").value.trim() == "" ? undefined : document.getElementById("numero").value.trim(),
    document.getElementById("titre").value.trim() == "" ? undefined : document.getElementById("titre").value.trim(),
    document.getElementById("annee").value.trim() == "" ? undefined : document.getElementById("annee").value.trim(),
    document.getElementById("etat").value.trim() == "" ? undefined : document.getElementById("etat").value.trim(),
    document.getElementById("couvertureImage").src.trim() == "" ? undefined : document.getElementById("couvertureImage").src.trim(),
    document.getElementById("cote").value.trim() == "" ? undefined : document.getElementById("cote").value.trim(),
    document.getElementById("edition_or").value.trim() == "" ? undefined : document.getElementById("edition_or").value.trim(),
    document.getElementById("edition_speciale").value.trim() == "" ? undefined : document.getElementById("edition_speciale").value.trim(),
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

function generateShortUUID(length = 8) {
  return [...Array(length)]
    .map(() => Math.floor(Math.random() * 36).toString(36))
    .join('');
}
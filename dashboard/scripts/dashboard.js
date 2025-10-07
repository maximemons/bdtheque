import { getDocumentById, countDocuments, countDocumentsWithWhere } from '../../scripts/firebase-db.js';
import { getCurrentUser, logout } from '../../scripts/firebase-auth.js';
import { Table, Shortcut } from '../../scripts/enums.js';
import { Preferences } from '../../scripts/records.js';

getCurrentUser().then(async (user) => {
  if(!user) {
    window.location.href = "https://maximemons.github.io/bdtheque";
  }
  let userPreferences = await getDocumentById(Table.Preferences, user.email);
  if(userPreferences == undefined) {
    userPreferences = new Preferences();
  }

  //USERNAME
  document.getElementById("userName").innerText = getDisplayName(userPreferences.self, user.email);
  document.getElementById("userEmail").innerText = user.email;

  //AVATAR
  const avatar = userPreferences?.self?.avatar?.trim();
  if (avatar) {
   const userAvatar = document.getElementById("userAvatar");
   userAvatar.insertAdjacentHTML("beforeend", `
     <div class="avatar-cover">
     <img src="${avatar}" alt="User avatar">
     </div>
     `);
  }else {
    document.getElementById("userAvatar").innerText = getDisplayName(userPreferences.self, user.email).charAt(0).toUpperCase();
  }

  //LOGOUT
  document.getElementById("logoutBtn").addEventListener("click", logout);

  //SHORTCUTS
  generateShortcutsFromPreferences(userPreferences);

  //Init scanner
  initiateScanner("searchCamera", "closeCamera", "video", "overlay", "searchBarInput", function(){document.getElementById('searchBar').click();});//document.getElementById("searchBar").click());

  //Init Search
  document.getElementById("searchCateg").addEventListener("change", changeSearchSource);
  document.getElementById("searchBarInput").addEventListener("click", search);

  //Init EasterEgg
  initEasterEgg();
});

function getDisplayName(user, email) {
  const firstName = user.firstname?.trim();
 const lastName = user.lastname?.trim();

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  } else {
    return email.split('@')[0];
  }
}

async function generateShortcutsFromPreferences(userPreferences) {
  const wantedShortcuts = userPreferences.shortcuts;
  if(wantedShortcuts.length == 0) {
    return;
  }

  const canWrite = Boolean(userPreferences.canWrite);
  const shortcuts = document.getElementById("shortcuts-container");

  wantedShortcuts.forEach(async (shortcut) => {
    if(Shortcut[shortcut] != undefined) {
      if((Shortcut[shortcut][1] && canWrite) || !Shortcut[shortcut][1]) {
        const divCard = document.createElement("div");
        divCard.classList.add("shortcut-card");

        if(Shortcut[shortcut][0] == "AJOUT"){
          divCard.innerHTML =`<button><i class="fas fa-plus"></i></button>`;
          divCard.classList.add("shortcut-card-plus");
        }else {
          const symbol = Shortcut[shortcut][0] == "BD" ? 'fa-book' : (Shortcut[shortcut][0] == "COLLECTIONS" ? 'fa-folder' : (Shortcut[shortcut][0] == "ACHATSRECENTS" ? 'fa-clock' : ''));
          const number = Shortcut[shortcut][0] == "BD" ? await countDocuments(Table.BDs) : 
            (Shortcut[shortcut][0] == "COLLECTIONS" ? await countDocuments(Table.Collections) : 
              (Shortcut[shortcut][0] == "ACHATSRECENTS" ? await countDocumentsWithWhere(Table.BDs, [{ field: "purchasedate", operator: "!=", value: null }, { field: "purchasedate", operator: "<", value: getDateTwoFullMonthsAgo().toISOString().split('T')[0] }]) : 
                '?'));
          const text = (Shortcut[shortcut][0] == "BD" || Shortcut[shortcut][0] == "COLLECTIONS") ? Shortcut[shortcut][0] : 
            (Shortcut[shortcut][0] == "ACHATSRECENTS" ? ("Achat(s) depuis " + new Date(new Date().setMonth(new Date().getMonth() - 2)).toLocaleString("fr-FR", { month: "long", year: "numeric" })) : "");

          divCard.innerHTML =`<i class="fas ${symbol}"></i><h4>${number}</h4><p>${text}</p>`;
        }
        shortcuts.appendChild(divCard);
      }
    }
  });
}

function getDateTwoFullMonthsAgo() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const targetMonth = currentMonth - 2;
    const targetYear = now.getFullYear();
    return new Date(targetYear, targetMonth, 1);
}

function changeSearchSource() {
  const select = document.getElementById("searchCateg");
  const searchInput = document.getElementById("searchBarInput");
  if(select.value == "bd") {
    searchInput.placeholder = "titre, numéro, année ou ISBN";
  } else if(select.value == "") {
    searchInput.placeholder = "";
  } else {
    searchInput.placeholder = "nom";
  }
}

function search() {
  const selectValue = document.getElementById("searchCateg").value;
  const searchInputValue = document.getElementById("searchBarInput").value;

  window.location = "";
}

function initEasterEgg() {
  if(document.getElementsByClassName("avatar-cover").length > 0) {
      let img = document.getElementsByClassName("avatar-cover")[0].getElementsByTagName("img")[0];
      img.addEventListener("click", function() {
        let changeMonkey = Math.floor(Math.random() * 3) == 2;

        this.style.transition = "transform 1s";
        this.style.transform = "rotate(360deg)";

        if(changeMonkey) {
          this.setAttribute("_src", this.src);
          this.src = "../img/avatar_custom.png";
        }

        setTimeout(() => { 
          this.style.transform = "rotate(0deg)";
          if(changeMonkey) {
            this.src = this.getAttribute("_src");
          }
        }, 1000);
      });
    } 
}
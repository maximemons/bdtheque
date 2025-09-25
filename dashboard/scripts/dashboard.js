const auth = firebase.auth();
const db = firebase.firestore();

auth.onAuthStateChanged(async (user) => {
  if(!user) {
    window.location.href = "../index.html";
  } else {
    const userPreferences = await getElement(CollectionsName.Preferences, user.email);
    if(userPreferences == undefined) {
    }else {
      //Implements USERNAME
      document.getElementById("userName").innerText = getDisplayName(userPreferences.self, user.email);
      document.getElementById("userEmail").innerText = user.email;
      
      //IMPLEMENTS AVATAR
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

      //IMPLEMENTS SHORTCUTS
      const shortcuts = document.getElementById("shortcuts-container");
      await Array.from(userPreferences.shortcuts || "").forEach(async shortcut => {
        if(shortcut == Shortcuts.BD || shortcut == Shortcuts.COLLECTIONS){
          shortcuts.appendChild(generateShortcutCard(shortcut, await getElementsSize(shortcut)));
        } else if(shortcut == Shortcuts.ACHATSRECENTS) {
          const bds = await getElements(CollectionsName.BDs);
          shortcuts.appendChild(generateShortcutCard(shortcut, countBoughtSinceTwoMonthsAgo(bds)));
        } else if(shortcut == Shortcuts.AJOUT) {
          shortcuts.appendChild(generateShortcutCard(shortcut));
        }
      });
    }

    //Init scanner
    initiateScanner("searchCamera", "closeCamera", "video", "overlay", "searchBarInput", function(){document.getElementById('searchBar').click();});//document.getElementById("searchBar").click());
  }
});

function logout() {
  auth.signOut().then(() => window.location.href = "../index.html");
}

function displayHamburgerMenu() {
  let sidebar = document.getElementById("sidebar");
  const classname = "open";
  
  if(sidebar.classList.contains(classname)) {
    sidebar.classList.remove(classname);
  }else {
    sidebar.classList.add(classname);
  }
}

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

function generateShortcutCard(shortcut, number) {
  const divCard = document.createElement("div");
  divCard.classList.add("shortcut-card");

  if(shortcut == Shortcuts.AJOUT) {
    divCard.innerHTML =`<button>
                          <i class="fas fa-plus"></i>
                        </button>`;

    divCard.classList.add("shortcut-card-plus");
    return divCard;
  }

  divCard.innerHTML =`<i class="fas ${shortcut == Shortcuts.BD ? 'fa-book' : 
                                        shortcut == Shortcuts.COLLECTIONS ? 'fa-folder' : 
                                          shortcut == Shortcuts.ACHATSRECENTS ? 'fa-clock' : ''}"></i>
                      <h4>${number}</h4>
                      <p>${(shortcut == Shortcuts.BD || shortcut == Shortcuts.COLLECTIONS) ? shortcut : 
                            shortcut == Shortcuts.ACHATSRECENTS  ? 
                            "Achat(s) depuis " + new Date(new Date().setMonth(new Date().getMonth() - 2)).toLocaleString("fr-FR", { month: "long", year: "numeric" }) : ""}</p>
                      `;

    return divCard;  
}

function countBoughtSinceTwoMonthsAgo(data) {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);

  return data.filter(item => item.boughtdate && item.boughtdate * 1000 >= cutoff.getTime()).length;
}

function changeSearchSubject(value) {
  if(value == "bd") {
    document.getElementById("searchCamera").classList.add("show-camera");
  }else {
    document.getElementById("searchCamera").classList.remove("show-camera");
  }
}

function search() {
  
}
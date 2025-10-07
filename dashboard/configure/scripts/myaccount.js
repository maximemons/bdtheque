const auth = firebase.auth();
const db = firebase.firestore();

let userPreferences;
let userMail;
let alreadyExists = false;

auth.onAuthStateChanged(async (user) => {
  if(!user) {
    window.location.href = "../..//index.html";
  } else {
    userMail = user.email;
    userPreferences = await getElement(CollectionsName.Preferences, user.email);

    initShortcut();

    if(userPreferences == undefined) {
    }else {
      alreadyExists = true;
      //Implements USERNAME
      if(userPreferences.self.firstname) {
        document.getElementById("firstname").value = userPreferences.self.firstname;
      }
      if(userPreferences.self.lastname) {
        document.getElementById("lastname").value = userPreferences.self.lastname;
      }
      const _avatar = userPreferences?.self?.avatar?.trim();
      if (_avatar) {
        const preview = document.getElementById('avatarPreview');
        const plus = document.querySelector('.avatar-upload .plus');
        const deleteBtn = document.querySelector('.avatar-upload .delete-btn');
        const userAvatar = document.getElementById("userAvatar");
        
        preview.src = _avatar;
        preview.style.display = "block";
        plus.style.display =  "none";
        deleteBtn.style.display = "block";
      }

      //IMPLEMENTS SHORTCUTS
      const shortcuts = document.getElementById("shortcuts-container");
      Array.from(userPreferences.shortcuts || "").forEach(shortcut => {
        document.getElementById("checkbox" + shortcut).checked = true;
      });
    }
  }
});

function previewAvatar(event) {
    const preview = document.getElementById('avatarPreview');
    const plus = document.querySelector('.avatar-upload .plus');
    const deleteBtn = document.querySelector('.avatar-upload .delete-btn');
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            plus.style.display = 'none';
            deleteBtn.style.display = 'block';
        }
        reader.readAsDataURL(file);
    }
}

function deleteAvatar(event) {
    event.stopPropagation();
    const preview = document.getElementById('avatarPreview');
    const plus = document.querySelector('.avatar-upload .plus');
    const deleteBtn = document.querySelector('.avatar-upload .delete-btn');
    const input = document.getElementById('avatarInput');
    preview.style.display = 'none';
    plus.style.display = 'block';
    deleteBtn.style.display = 'none';
    input.value = '';
    preview.src = "";
}

document.getElementById('registrationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    let shortcuts = [];

    Array.from(document.getElementsByClassName("shortcutsChecks")).forEach(s => {
        if(s.checked && s.getAttribute("data") != undefined) {
            shortcuts.push(s.getAttribute("data"));
        }
    });

    let prefs = new Preferences(
        userPreferences?.canWrite || false, 
        document.getElementById("firstname").value.length > 0 ? document.getElementById("firstname").value.trim() : null, 
        document.getElementById("lastname").value.length > 0 ? document.getElementById("lastname").value.trim() : null, 
        (document.getElementById("avatarPreview").getAttribute("src") == null || document.getElementById("avatarPreview").getAttribute("src").length > 0) ? document.getElementById("avatarPreview").getAttribute("src") : null, 
        shortcuts);
    let res = await createOrUpdateElement(CollectionsName.Preferences, prefs, userMail);

    if(res == undefined) {
        document.getElementById("modalText").innerText = "La mise à jour à échouée. Veuillez ressayer plus tard...";
    }else {
        document.getElementById("modalText").innerText = "La mise à jour à été effectuée avec succès !"
    }

    document.getElementById("modal").style.display = "inherit";

    document.getElementById("modal").addEventListener("click", function() {
        document.getElementById("modal").style.display = "none";
    });
});

//On charge les shortcuts
function initShortcut() {
    const shortcutContainer = document.getElementById("shortcuts-container");
    Object.values(Shortcuts).forEach(shortcut => {
        if(shortcut[1] == false ||  (shortcut[1] && userPreferences.canWrite))
            shortcutContainer.appendChild(generateShortcutCard(shortcut, Math.floor(Math.random() * 50)));
    });
}

function generateShortcutCard(shortcut, number) {
  const divCard = document.createElement("div");
  divCard.classList.add("shortcut-card");

  if(shortcut == Shortcuts.AJOUT) {
    divCard.innerHTML =`<input type="checkbox" class="shortcutsChecks" id="checkbox${shortcut[0]}" data="${shortcut[0]}"/><button><i class="fas fa-plus"></i></button>`;

    divCard.classList.add("shortcut-card-plus");
    return divCard;
  }

  divCard.innerHTML =`<input type="checkbox" class="shortcutsChecks" id="checkbox${shortcut[0]}" data="${shortcut[0]}"/>
                        <i class="fas ${shortcut == Shortcuts.BD ? 'fa-book' : shortcut == Shortcuts.COLLECTIONS ? 'fa-folder' : shortcut == Shortcuts.ACHATSRECENTS ? 'fa-clock' : ''}"></i>
                        <h4>${number}</h4>
                        <p>${(shortcut == Shortcuts.BD || shortcut == Shortcuts.COLLECTIONS) ? shortcut[0] : shortcut == Shortcuts.ACHATSRECENTS  ? "Achat(s) depuis " + new Date(new Date().setMonth(new Date().getMonth() - 2)).toLocaleString("fr-FR", { month: "long", year: "numeric" }) : ""}</p>`;
    return divCard;  
}
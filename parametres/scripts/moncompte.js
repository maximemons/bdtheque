import { checkAuthAndRedirect } from '../../scripts/auth-guard.js';
import { getDocumentById, setDocument } from '../../scripts/firebase-db.js';
import { getCurrentUser } from '../../scripts/firebase-auth.js';
import { resolveOwnership } from '../../scripts/ownership.js';
import { showFatalError } from '../../scripts/ui-error.js';
import { Table, Shortcut } from '../../scripts/enums.js';
import { Preferences } from '../../scripts/records.js';

checkAuthAndRedirect();

let userPreferences;
let userMail;

getCurrentUser().then(async (user) => {
  if (!user) return;

  try {
    const { ownerId } = await resolveOwnership(user.email);
    userMail = ownerId;
    userPreferences = await getDocumentById(Table.Preferences, userMail).catch(() => undefined);
    if (userPreferences == undefined) {
      userPreferences = new Preferences();
    }

    // Informations personnelles
    if (userPreferences.self?.firstname) {
      document.getElementById("firstname").value = userPreferences.self.firstname;
    }
    if (userPreferences.self?.lastname) {
      document.getElementById("lastname").value = userPreferences.self.lastname;
    }

    // Avatar
    const avatar = userPreferences?.self?.avatar?.trim();
    if (avatar) {
      showAvatarPreview(avatar);
    }

    // Raccourcis
    generateShortcutsFromPreferences(userPreferences);

    // Listeners
    document.getElementById("avatarUploadTrigger").addEventListener("click", () => {
      document.getElementById("avatarInput").click();
    });
    document.getElementById("avatarInput").addEventListener("change", previewAvatar);
    document.getElementById("deleteAvatarBtn").addEventListener("click", deleteAvatar);
    document.getElementById("registrationForm").addEventListener("submit", onSubmitForm);
    document.getElementById("modalValidate")?.addEventListener("click", () => {
      document.getElementById("modal").style.display = "none";
    });
  } catch (error) {
    showFatalError("registrationForm", error, "chargement de la page Mon compte");
  }
}).catch(error => {
  showFatalError("registrationForm", error, "vérification de l'authentification");
});

function showAvatarPreview(src) {
  const preview = document.getElementById('avatarPreview');
  const plus = document.querySelector('.avatar-upload .plus');
  const deleteBtn = document.querySelector('.avatar-upload .delete-btn');

  preview.src = src;
  preview.style.display = "block";
  plus.style.display = "none";
  deleteBtn.style.display = "block";
}

function previewAvatar(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => showAvatarPreview(e.target.result);
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

async function onSubmitForm(e) {
  e.preventDefault();

  const shortcuts = [];
  Array.from(document.getElementsByClassName("shortcutsChecks")).forEach(s => {
    if (s.checked && s.getAttribute("data") != undefined) {
      shortcuts.push(s.getAttribute("data"));
    }
  });

  const avatarSrc = document.getElementById("avatarPreview").getAttribute("src");

  const prefs = new Preferences(
    userPreferences?.canWrite || false,
    document.getElementById("firstname").value.trim() || null,
    document.getElementById("lastname").value.trim() || null,
    (avatarSrc && avatarSrc.length > 0) ? avatarSrc : null,
    shortcuts
  );

  const res = await setDocument(Table.Preferences, userMail, prefs).catch(() => undefined);

  document.getElementById("modalText").innerText = (res === undefined)
    ? "La mise à jour a échoué. Veuillez réessayer plus tard..."
    : "La mise à jour a été effectuée avec succès !";

  document.getElementById("modal").style.display = "inherit";
}

function generateShortcutsFromPreferences(preferences) {
  const shortcutContainer = document.getElementById("shortcuts-container");
  const canWrite = Boolean(preferences.canWrite);
  const activeShortcuts = new Set(preferences.shortcuts || []);

  Object.keys(Shortcut).forEach(key => {
    const shortcut = Shortcut[key];
    if (shortcut[1] && !canWrite) return; // raccourci réservé aux comptes en écriture

    const card = generateShortcutCard(key, shortcut, Math.floor(Math.random() * 50));
    if (activeShortcuts.has(key)) {
      card.querySelector("input[type=checkbox]").checked = true;
    }
    shortcutContainer.appendChild(card);
  });
}

function generateShortcutCard(key, shortcut, number) {
  const divCard = document.createElement("div");
  divCard.classList.add("shortcut-card");

  if (shortcut[0] === "AJOUT") {
    divCard.innerHTML = `<input type="checkbox" class="shortcutsChecks" id="checkbox${key}" data="${key}"/><button type="button"><i class="fas fa-plus"></i></button>`;
    divCard.classList.add("shortcut-card-plus");
    return divCard;
  }

  const symbol = shortcut[0] === "BD" ? 'fa-book' : (shortcut[0] === "COLLECTIONS" ? 'fa-folder' : (shortcut[0] === "ACHATSRECENTS" ? 'fa-clock' : ''));
  const text = (shortcut[0] === "BD" || shortcut[0] === "COLLECTIONS") ? shortcut[0] :
    (shortcut[0] === "ACHATSRECENTS" ? ("Achat(s) depuis " + new Date(new Date().setMonth(new Date().getMonth() - 2)).toLocaleString("fr-FR", { month: "long", year: "numeric" })) : "");

  divCard.innerHTML = `<input type="checkbox" class="shortcutsChecks" id="checkbox${key}" data="${key}"/>
                        <i class="fas ${symbol}"></i>
                        <h4>${number}</h4>
                        <p>${text}</p>`;
  return divCard;
}

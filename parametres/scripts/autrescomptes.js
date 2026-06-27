import { checkAuthAndRedirect } from '../../scripts/auth-guard.js';
import { getDocumentsWithWhere, setDocument, deleteDocument } from '../../scripts/firebase-db.js';
import { getCurrentUser } from '../../scripts/firebase-auth.js';
import { Table } from '../../scripts/enums.js';

checkAuthAndRedirect();

let ownerEmail;

getCurrentUser().then(async (user) => {
  if (!user) {
    return; // checkAuthAndRedirect() prend déjà en charge la redirection
  }

  ownerEmail = user.email;

  document.getElementById("addAccountForm").addEventListener("submit", onInvite);
  document.getElementById("modalValidate")?.addEventListener("click", () => {
    document.getElementById("modal").style.display = "none";
  });

  await refreshAccountsList();
});

async function refreshAccountsList() {
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = "";

  const shares = await getDocumentsWithWhere(Table.Sharing, [
    { field: "owner", operator: "==", value: ownerEmail }
  ]).catch(() => []);

  const list = document.getElementById("accountsList");
  list.innerHTML = "";

  if (shares.length === 0) {
    list.innerHTML = `<li class="empty">Aucun compte n'a accès à votre BDthèque pour le moment.</li>`;
    return;
  }

  shares.forEach(share => {
    const li = document.createElement("li");
    li.classList.add("account-row");

    const label = document.createElement("span");
    label.textContent = `${share.id} ${share.canWrite ? "(lecture/écriture)" : "(lecture seule)"}`;

    const revokeBtn = document.createElement("button");
    revokeBtn.type = "button";
    revokeBtn.classList.add("revoke-btn");
    revokeBtn.innerHTML = `<i class="fas fa-trash"></i>`;
    revokeBtn.addEventListener("click", () => onRevoke(share.id));

    li.appendChild(label);
    li.appendChild(revokeBtn);
    list.appendChild(li);
  });
}

async function onInvite(e) {
  e.preventDefault();
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = "";

  const email = document.getElementById("newAccountEmail").value.trim().toLowerCase();
  const canWrite = document.getElementById("newAccountCanWrite").checked;

  if (email === ownerEmail.toLowerCase()) {
    errorDiv.textContent = "Vous ne pouvez pas vous inviter vous-même.";
    return;
  }

  try {
    await setDocument(Table.Sharing, email, { owner: ownerEmail, canWrite });
    document.getElementById("newAccountEmail").value = "";
    document.getElementById("newAccountCanWrite").checked = false;
    await refreshAccountsList();
  } catch (err) {
    errorDiv.textContent = "Impossible d'inviter ce compte pour le moment.";
  }
}

async function onRevoke(email) {
  await deleteDocument(Table.Sharing, email).catch(() => {});
  await refreshAccountsList();
}

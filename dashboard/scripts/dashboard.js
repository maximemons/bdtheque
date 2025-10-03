import { countDocuments, countDocumentsWithWhere } from '../../scripts/firebase-db.js';
import { getCurrentUser, logout } from '../../scripts/firebase-auth.js';

getCurrentUser().then(async (user) => {
  if(!user) {
    window.location.href = "../index.html";
  }
  const userPreferences = await getDocumentById(CollectionsName.Preferences, user.email);
  console.log(userPreferences);
})

// auth.onAuthStateChanged(async (user) => {
//   if(!user) {
//     window.location.href = "../index.html";
//   } else {
//     let userPreferences = await getElement(CollectionsName.Preferences, user.email);
//     if(userPreferences == undefined) {
//       userPreferences = new Preferences();
//     }
//     //Implements USERNAME
//     document.getElementById("userName").innerText = getDisplayName(userPreferences.self, user.email);
//     document.getElementById("userEmail").innerText = user.email;
      
//     //IMPLEMENTS AVATAR
//     const avatar = userPreferences?.self?.avatar?.trim();
//     if (avatar) {
//       const userAvatar = document.getElementById("userAvatar");
//       userAvatar.insertAdjacentHTML("beforeend", `
//         <div class="avatar-cover">
//           <img src="${avatar}" alt="User avatar">
//         </div>
//       `);
//     }else {
//       document.getElementById("userAvatar").innerText = getDisplayName(userPreferences.self, user.email).charAt(0).toUpperCase();
//     }

//     //IMPLEMENTS SHORTCUTS
//     const shortcuts = document.getElementById("shortcuts-container");
//     await Array.from(userPreferences.shortcuts || "").forEach(async shortcut => {
//       if(shortcut == Shortcuts.BD[0] || shortcut == Shortcuts.COLLECTIONS[0]){
//         shortcuts.appendChild(generateShortcutCard(shortcut, await getElementsSize(shortcut == Shortcuts.BD[0] ? CollectionsName.BDs : CollectionsName.Collections)));
//       } else if(shortcut == Shortcuts.ACHATSRECENTS[0]) {
//         const bds = await getElements(CollectionsName.BDs);
//         shortcuts.appendChild(generateShortcutCard(shortcut, countBoughtSinceTwoMonthsAgo(bds)));
//       } else if(shortcut == Shortcuts.AJOUT[0]) {
//         shortcuts.appendChild(generateShortcutCard(shortcut));
//       }
//     });

//     //Init scanner
//     initiateScanner("searchCamera", "closeCamera", "video", "overlay", "searchBarInput", function(){document.getElementById('searchBar').click();});//document.getElementById("searchBar").click());
  
//     document.getElementById("searchBar").addEventListener("click", search);

//     //easterEggs ? 
//     if(Math.floor(Math.random() * 3) == 2) {
//       if(document.getElementsByClassName("avatar-cover").length > 0) {
//         let img = document.getElementsByClassName("avatar-cover")[0].classList.add("avatar-cover-easter-egg");  
//       }
//     }
//   }
// });

// function logout() {
//   auth.signOut().then(() => window.location.href = "../index.html");
// }

// function getDisplayName(user, email) {
//   const firstName = user.firstname?.trim();
//   const lastName = user.lastname?.trim();

//   if (firstName && lastName) {
//     return `${firstName} ${lastName}`;
//   } else if (firstName) {
//     return firstName;
//   } else if (lastName) {
//     return lastName;
//   } else {
//     return email.split('@')[0];
//   }
// }

// function generateShortcutCard(shortcut, number) {
//   const divCard = document.createElement("div");
//   divCard.classList.add("shortcut-card");

//   if(shortcut == Shortcuts.AJOUT[0]) {
//     divCard.innerHTML =`<button>
//                           <i class="fas fa-plus"></i>
//                         </button>`;

//     divCard.classList.add("shortcut-card-plus");
//     return divCard;
//   }

//   divCard.innerHTML =`<i class="fas ${shortcut == Shortcuts.BD[0] ? 'fa-book' : 
//                                         shortcut == Shortcuts.COLLECTIONS[0] ? 'fa-folder' : 
//                                           shortcut == Shortcuts.ACHATSRECENTS[0] ? 'fa-clock' : ''}"></i>
//                       <h4>${number}</h4>
//                       <p>${(shortcut == Shortcuts.BD[0] || shortcut == Shortcuts.COLLECTIONS[0]) ? shortcut : 
//                             shortcut == Shortcuts.ACHATSRECENTS[0]  ? 
//                             "Achat(s) depuis " + new Date(new Date().setMonth(new Date().getMonth() - 2)).toLocaleString("fr-FR", { month: "long", year: "numeric" }) : ""}</p>
//                       `;
//     return divCard;  
// }

// function countBoughtSinceTwoMonthsAgo(items) {
//   const now = new Date();
//     const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

//     let count = 0;

//     for (const item of items.map(d => d.object)) {
//         if (item.purchasedate) {
//             const purchaseDate = new Date(item.purchasedate);
//             if (purchaseDate > twoMonthsAgo) {
//                 count++;
//             }
//         }
//     }

//     return count;
// }

// function changeSearchSubject(value) {
//   if(value == "bd") {
//     document.getElementById("searchCamera").classList.add("show-camera");
//   }else {
//     document.getElementById("searchCamera").classList.remove("show-camera");
//   }

//   document.getElementById("searchBarInput").placeholder = 
//     value == "bd" ? "titre, numéro, année ou ISBN" : (
//     (value == "collection" || value == "editor") ? "nom" : "");
// }

// function search() {
//   let searchCateg = document.getElementById("searchCateg").value;

//   if(searchCateg == "bd") {
//     window.location = "bds/bds.html?search=" + document.getElementById("searchBarInput").value;
//   }
// }
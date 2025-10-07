import { getDocumentById, countDocuments, countDocumentsWithWhere } from '../../scripts/firebase-db.js';
import { getCurrentUser, logout } from '../../scripts/firebase-auth.js';
import { Table, Shortcut } from '../../scripts/enums.js';
import { Preferences } from '../../scripts/records.js';

getCurrentUser().then(async (user) => {
    if(!user) {
        window.location.href = "https://maximemons.github.io/bdtheque";
    } else {
        let userPreferences = await getDocumentById(Table.Preferences, user.email);
        if(userPreferences == undefined) {
            userPreferences = new Preferences();
        }

        //Person Info

        //Avatar

        //Shortcuts
        generateShortcutsFromPreferences(userPreferences)
    }
});

function generateShortcutsFromPreferences(userPreferences) {
    let allShortcuts = Array.from(Object.keys(Shortcut));
    const shortcutContainer = document.getElementById("shortcuts-container");
    allShortcuts.forEach(shortcut => {
        
        shortcutContainer.appendChild(generateShortcutCard(shortcut, Math.floor(Math.random() * 50)));

    });
}
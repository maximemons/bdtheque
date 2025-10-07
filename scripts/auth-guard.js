import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from "./firebase-auth.js";

const auth = getAuth(app);

function checkAuthAndRedirect() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "index.html";
        }
    });
}

export { checkAuthAndRedirect };

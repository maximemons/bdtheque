import { logout } from './firebase-auth.js';

function generateMenu() {
	const asideMenu = document.getElementById("sidebar");
	asideMenu.innerHTML = `
		<div class="logo">
        	<i class="fas fa-book"></i>
            <span>BDthèque</span>
        </div>
        <ul class="nav-links">
            <li class=""><a href="https://maximemons.github.io/bdtheque/dashboard/dashboard.html">
            	<i class="fas fa-home"></i>Accueil</a>
            </li>
            <li><a href="#"><i class="fas fa-folder-open"></i>Ma BDtheque</a>
                <ul>
                	<li><a href="https://maximemons.github.io/bdtheque/dashboard/bds/bds.html"><i class="fas fa-book"></i>Mes BDs</a></li>
                    <li class="disabled-nav-link"><a href="#" title="Bientôt disponible"><i class="fas fa-folder"></i>Mes Collections</a></li>
                    <li class="disabled-nav-link"><a href="#" title="Bientôt disponible"><i class="fas fa-pencil"></i>Mes Editeurs</a></li>
                </ul>
            </li>
            <li><a href="#"><i class="fas fa-cog"></i>Paramètres</a>
                <ul>
                    <li><a href="https://maximemons.github.io/bdtheque/parametres/moncompte.html"><i class="fas fa-user"></i>Mon compte</a></li>
                    <li><a href="https://maximemons.github.io/bdtheque/parametres/autrescomptes.html"><i class="fas fa-users"></i>Autres comptes</a></li>
            	</ul>
        	</li>
        </ul>
        <footer>
        	<i id="menuLogout" class="fas fa-sign-out-alt"></i>
        </footer>`;

    Array.from(document.getElementById("sidebar").getElementsByTagName("a")).forEach(a => {
    	if(a.href.split("?")[0] == window.location.href.split("?")[0]) {
    		a.parentElement.classList.add("selected-nav-link");
    	}
    });

	document.getElementById("hamburger").addEventListener("click", function(){
	  let sidebar = document.getElementById("sidebar");
	  const classname = "open";

	  if(sidebar.classList.contains(classname)) {
	    sidebar.classList.remove(classname);
	  }else {
	    sidebar.classList.add(classname);
	  }
	});

	document.getElementById("menuLogout").addEventListener("click", logout);
}

generateMenu();
class Preferences {
	constructor(canWrite, firstname, lastname, avatar, shortcuts = []) {
		this.canWrite = canWrite;
		this.self = {
			firstname,
			lastname,
			avatar
		};
		this.shortcuts = shortcuts;
	}
};

class Editor {
	constructor(name) {
		this.name = name;
	}
};

class Collection {
	constructor(name, specialedition) {
		this.name = name;
		this.specialedition = specialedition;
	}
};

class BD {
	constructor(fk_collection, fk_edition, ISBN, number, title, year, state, cover, reputation, goldedition, special, purchasedate) {
		this.fk_collection = fk_collection;
		this.fk_edition = fk_edition;
		this.base_info = {
			ISBN,
			number,
			title,
			year,
			state,
			cover
		};
		this.details = {
			reputation,
			goldedition,
			special
		};
		this.purchasedate = purchasedate;
	}

	// Construit une instance BD à partir d'un objet "plat" (ex: retour API OpenLibrary).
	// Évite les erreurs liées à l'ordre des paramètres positionnels.
	static fromPartial({
		fk_collection = undefined,
		fk_edition = undefined,
		ISBN = undefined,
		number = undefined,
		title = undefined,
		year = undefined,
		state = undefined,
		cover = undefined,
		reputation = undefined,
		goldedition = undefined,
		special = undefined,
		purchasedate = undefined
	} = {}) {
		return new BD(fk_collection, fk_edition, ISBN, number, title, year, state, cover, reputation, goldedition, special, purchasedate);
	}
}

export { Preferences, Editor, Collection, BD };
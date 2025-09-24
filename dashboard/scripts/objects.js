//ENUMS
const CollectionsName = {
  Preferences: 'preferences',
  Collections: 'collections',
  Editeurs: 'editeurs',
  BDs: 'bds'
};

const Etat = {
    MauvaisEtat: "ME",
    BonEtat: "BE",
    TresBonEtat: "TBE",
    TresBonEtatPlus: "TBE+",
    Neuf: "Neuf"
};

//OBJECTS
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
	constructor(fk_collection, fk_edition, ISBN, number, title, year, state, reputation, goldedition, special, purchasedate) {
		this.fk_collection = fk_collection;
		this.fk_edition = fk_edition;
		this.base_info = {
			ISBN,
			number,
			title,
			year,
			state
		};
		this.details = {
			reputation,
			goldedition,
			special
		};
		this.purchasedate;
	}
};

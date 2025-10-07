const Table = {
  Preferences: 'preferences',
  Collections: 'collections',
  Editeurs: 'editeurs',
  BDs: 'bds'
};

const State = {
	MauvaisEtat: "ME",
  BonEtat: "BE",
  TresBonEtat: "TBE",
  TresBonEtatPlus: "TBE+",
  Neuf: "Neuf"
};

const Shortcut = {
	BD: ["BD", false],
	COLLECTIONS: ["COLLECTIONS", false],
	ACHATSRECENTS: ["ACHATSRECENTS", false],
	AJOUT: ["AJOUT", true]
};

export { Table, State, Shortcut };
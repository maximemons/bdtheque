let ALLCOLLECTIONS;
let ALLEDITIONS;
let ALLBDS;

function generateShortUUID(length = 8) {
  return [...Array(length)]
    .map(() => Math.floor(Math.random() * 36).toString(36))
    .join('');
}

async function createBook(BD, COLLECTION, EDITION) {
	let collectionId = undefined;
	let editionId = undefined;

	if(COLLECTION.name != undefined) {
		collectionId = findIdByCollection(ALLCOLLECTIONS, COLLECTION);
		if(collectionId == undefined) {
			collectionId = `${COLLECTION.name}:${COLLECTION.specialedition}:${generateShortUUID()}`;
			await createOrUpdateElement(CollectionsName.Collections, COLLECTION, collectionId);
		}
	}
	if(EDITION.name != undefined) {
		editionId = findIdByEdition(ALLEDITIONS, EDITION);
		if(editionId == undefined) {
			editionId = `${EDITION.name}:${generateShortUUID()}`;
			await createOrUpdateElement(CollectionsName.Editeurs, EDITION, editionId);
		}
	}

	BD.fk_collection = collectionId;
	BD.fk_edition = editionId;

	let bdId = `${BD.base_info?.title || ''}:${BD.base_info?.number || ''}:${BD.base_info?.year || ''}:${BD.base_info.ISBN}:${generateShortUUID()}`;

	await createOrUpdateElement(CollectionsName.BDs, BD, bdId);
}

function findIdByCollection(arr, criteria) {
  const item = arr.find(
    (el) =>
      el.object.name === criteria.name &&
      (el.object.specialedition === criteria.specialedition)
  );
  return item ? item.id : undefined;
}

function findIdByEdition(arr, criteria) {
  const item = arr.find((el) =>
    Object.entries(criteria).every(([key, value]) => el.object[key] === value)
  );
  return item ? item.id : undefined;
}

function enrichBDs(ALLBDS, ALLCOLLECTIONS, ALLEDITIONS) {
  const collectionMap = Object.fromEntries(ALLCOLLECTIONS.map(c => [c.id, c.object]));
  const editionMap = Object.fromEntries(ALLEDITIONS.map(e => [e.id, e.object]));

  return ALLBDS.map(bd => {
    bd.object.fk_collection = collectionMap[bd.object.fk_collection] || null;
    bd.object.fk_edition = editionMap[bd.object.fk_edition] || null;
    return bd;
  });
}

async function initBdBooksUtils() {
	ALLCOLLECTIONS = await getElements(CollectionsName.Collections);
	ALLEDITIONS = await getElements(CollectionsName.Editeurs);
	ALLBDS = await getElements(CollectionsName.BDs);

	ALLBDS = enrichBDs(ALLBDS, ALLCOLLECTIONS, ALLEDITIONS);
}

function searchBD(searchQuery) {
	return ALLBDS.filter(item => item.id.substring(0, item.id.lastIndexOf(':')).replaceAll(":", "").replaceAll("-","").toLowerCase().includes(searchQuery.replaceAll("-","").toLowerCase().trim()));
}

function parseTitleForCollection(title) {
  // ex: "Naruto - Tome 3 - Le réveil"
  const regex = /^(.+?)\s*-\s*Tome\s*(\d+)\s*-\s*(.+)$/i;
  const match = title.match(regex);
  if (match) {
    return {
      collection: match[1].trim(),
      number: parseInt(match[2], 10),
      cleanTitle: match[3].trim()
    };
  }
  return { collection: null, number: null, cleanTitle: title };
}

async function fetchBDFromISBN(isbn, {
  fk_collection = null,
  fk_edition = null,
  fk_specialedition = null,
  number = null
} = {}) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Erreur API Open Library");

    const data = await response.json();
    const book = data[`ISBN:${isbn}`];

    if (!book) {
      console.warn(`Aucune donnée trouvée pour ISBN ${isbn}`);
      return new BD(fk_collection, fk_edition, fk_specialedition, isbn, number, null, null, state, null, reputation, goldedition, special, purchasedate);
    }

    let title = book.title || null;
    //Si titre au format {Collection} - Tome {num} - {Titre} 
    let parsed = title ? parseTitleForCollection(title) : { collection: null, number: null, cleanTitle: null };
    
    if (!fk_collection && parsed.collection) fk_collection = parsed.collection;
    if (!number && parsed.number) number = parsed.number;
    
    title = parsed.cleanTitle;

    const year = book.publish_date ? book.publish_date.match(/\d{4}/)?.[0] : null;
    const cover = book.cover?.large || book.cover?.medium || book.cover?.small || null;

    //Récupérer l'éditeur si dispo
    if (!fk_edition && book.publishers && book.publishers.length > 0) {
      fk_edition = book.publishers[0].name;
    }

    let bd = new BD();
    bd.fk_collection = fk_collection;
    bd.fk_edition = fk_edition
    bd.ISBN = isbn;
    bd.number = number;
    bd.title = title;
    bd.year = year;
    bd.state = state;
    bd.cover = cover;

  } catch (err) {
    console.error("Erreur lors de la récupération :", err);
    return null;
  }
}

import { BD } from './records.js';

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

// Récupère les informations d'une BD depuis l'API Open Library à partir de son ISBN.
// Retourne toujours une instance de BD (éventuellement avec des champs vides si
// l'ISBN n'est pas trouvé), ou null en cas d'erreur réseau/API.
async function fetchBDFromISBN(isbn, {
  fk_collection = null,
  fk_edition = null,
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
      return BD.fromPartial({ fk_collection, fk_edition, ISBN: isbn, number });
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

    return BD.fromPartial({
      fk_collection,
      fk_edition,
      ISBN: isbn,
      number,
      title,
      year,
      cover
    });

  } catch (err) {
    console.error("Erreur lors de la récupération :", err);
    return null;
  }
}

export { fetchBDFromISBN, parseTitleForCollection };

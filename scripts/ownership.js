import { getDocumentById } from './firebase-db.js';
import { Table } from './enums.js';

const CACHE_KEY = 'bdtheque_canwrite';

// Détermine si l'utilisateur connecté peut modifier la BDthèque.
// - Propriétaire (aucun doc sharing pour son email) : canWrite = true
// - Invité (doc sharing trouvé) : canWrite selon ce que le propriétaire a configuré
// Résultat mis en cache sessionStorage pour ne pas refaire la requête à chaque page.
async function resolveCanWrite(userEmail) {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached !== null) {
    return cached === 'true';
  }

  const share = await getDocumentById(Table.Sharing, userEmail).catch(() => undefined);
  const canWrite = (share == undefined) ? true : Boolean(share.canWrite);

  sessionStorage.setItem(CACHE_KEY, String(canWrite));
  return canWrite;
}

// Invalider après un changement de partage (invite/révocation depuis autrescomptes.js).
function invalidateOwnershipCache() {
  sessionStorage.removeItem(CACHE_KEY);
}

export { resolveCanWrite, invalidateOwnershipCache };

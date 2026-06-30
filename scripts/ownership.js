import { getDocumentById } from './firebase-db.js';
import { Table } from './enums.js';

const CACHE_KEY = 'bdtheque_ownership';

// Détermine à quelle bédéthèque l'utilisateur connecté doit accéder.
// Le résultat est mis en cache dans sessionStorage (valide jusqu'à fermeture de l'onglet)
// pour éviter une requête Firestore à chaque chargement de page.
// Appeler invalidateOwnershipCache() après un changement de partage (invite/révocation).
async function resolveOwnership(userEmail) {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (_) { /* cache corrompu, on recalcule */ }
  }

  const share = await getDocumentById(Table.Sharing, userEmail).catch(() => undefined);
  const result = (share != undefined && share.owner)
    ? { ownerId: share.owner, canWrite: Boolean(share.canWrite) }
    : { ownerId: userEmail, canWrite: true };

  sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
  return result;
}

// À appeler depuis autrescomptes.js après invite ou révocation,
// pour forcer le recalcul au prochain chargement de page.
function invalidateOwnershipCache() {
  sessionStorage.removeItem(CACHE_KEY);
}

export { resolveOwnership, invalidateOwnershipCache };

import { getDocumentById } from './firebase-db.js';
import { Table } from './enums.js';

// Détermine à quelle bédéthèque l'utilisateur connecté doit accéder :
// - normalement, la sienne (son propre email)
// - si un compte propriétaire lui a donné accès (table "sharing"), celle du propriétaire
// Retourne { ownerId, canWrite } : ownerId est l'email à utiliser comme filtre sur toutes
// les requêtes BDs/Collections/Editeurs, canWrite indique si l'utilisateur peut modifier/créer.
async function resolveOwnership(userEmail) {
  const share = await getDocumentById(Table.Sharing, userEmail).catch(() => undefined);

  if (share != undefined && share.owner) {
    return { ownerId: share.owner, canWrite: Boolean(share.canWrite) };
  }

  return { ownerId: userEmail, canWrite: true };
}

export { resolveOwnership };

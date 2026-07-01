// Affiche une erreur bloquante claire dans un conteneur de la page, au lieu de laisser
// un écran de chargement infini silencieux quand une promesse rejette sans catch.
// Loggue aussi l'erreur complète en console pour le diagnostic (F12 > Console).
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showFatalError(containerId, error, context) {
  console.error(`[BDthèque] Erreur dans ${context} :`, error);

  const container = document.getElementById(containerId);
  if (!container) return;

  const message = escapeHtml(error?.message || String(error));
  container.innerHTML = `
    <div class="fatal-error">
      <i class="fas fa-triangle-exclamation"></i>
      <p><strong>Une erreur est survenue.</strong></p>
      <p class="fatal-error-detail">${message}</p>
      <p class="fatal-error-hint">Si le problème persiste, ouvrez la console du navigateur (F12) pour plus de détails, ou contactez le support.</p>
      <button type="button" onclick="window.location.reload()">Recharger la page</button>
    </div>`;
}

export { showFatalError };

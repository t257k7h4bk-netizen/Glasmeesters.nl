/* =========================================================
   Glasmeesters Planner – menu
   Dit bestand zet op elke pagina hetzelfde menu neer.
   Een tabblad toevoegen? Voeg één regel toe aan de lijst
   MENU hieronder.
   ========================================================= */

const VERSIE = "Versie 0.1 – fase 2a";

const MENU = [
  { pagina: "dashboard",      titel: "Dashboard",      icoon: "🏠", bestand: "index.html" },
  { pagina: "planning",       titel: "Planning",       icoon: "📅", bestand: "planning.html" },
  { pagina: "werkopdrachten", titel: "Werkopdrachten", icoon: "📋", bestand: "werkopdrachten.html" },
  { pagina: "opnames",        titel: "Opnames",        icoon: "📐", bestand: "opnames.html" },
  { pagina: "kaart",          titel: "Kaart",          icoon: "🗺️", bestand: "kaart.html" },
  { pagina: "medewerkers",    titel: "Medewerkers",    icoon: "👷", bestand: "medewerkers.html" },
  { pagina: "voertuigen",     titel: "Voertuigen",     icoon: "🚐", bestand: "voertuigen.html" },
  { pagina: "gereedschap",    titel: "Gereedschap",    icoon: "🧰", bestand: "gereedschap.html" },
  { pagina: "beheer",         titel: "Beheer",         icoon: "⚙️", bestand: "beheer.html" }
];

function bouwMenu() {
  const huidigePagina = document.body.dataset.pagina;

  const links = MENU.map(function (item) {
    const actief = item.pagina === huidigePagina ? ' class="actief"' : "";
    return '<a href="' + item.bestand + '"' + actief + '>' +
             '<span class="icoon" aria-hidden="true">' + item.icoon + '</span>' +
             '<span>' + item.titel + '</span>' +
           '</a>';
  }).join("");

  const menu = document.createElement("aside");
  menu.className = "menu";
  menu.innerHTML =
    '<a class="logo" href="index.html">' +
      '<span class="logo-glas">GLAS</span>' +
      '<span class="logo-meesters">MEESTERS</span>' +
      '<span class="logo-planner">PLANNER</span>' +
    '</a>' +
    '<nav aria-label="Hoofdmenu">' + links + '</nav>' +
    '<div class="versie">' + VERSIE + '</div>';

  document.body.prepend(menu);

  // Zet de paginatitel in het tabblad van de browser
  const item = MENU.find(function (m) { return m.pagina === huidigePagina; });
  if (item) {
    document.title = item.titel + " – Glasmeesters Planner";
  }
}

bouwMenu();

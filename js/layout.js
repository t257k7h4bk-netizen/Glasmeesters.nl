/* =========================================================
   Glasmeesters Planner – menu en rollen
   Dit bestand zet op elke pagina hetzelfde menu neer en
   bepaalt welke tabbladen een rol mag zien.

   Een tabblad toevoegen? Voeg één regel toe aan MENU.
   Rechten aanpassen? Pas de lijst "rollen" van dat tabblad aan.
   ========================================================= */

const VERSIE = "Versie 0.2 – stap 2b";

// Alle rollen uit het ontwerp
const ROLLEN = {
  beheerder:  "Beheerder",
  planner:    "Planner",
  opnemer:    "Opnemer",
  medewerker: "Medewerker",
  wagenpark:  "Wagenparkbeheerder"
};

const MENU = [
  { pagina: "dashboard",      titel: "Dashboard",      icoon: "🏠", bestand: "index.html",
    rollen: ["beheerder", "planner", "opnemer", "medewerker", "wagenpark"] },
  { pagina: "planning",       titel: "Planning",       icoon: "📅", bestand: "planning.html",
    rollen: ["beheerder", "planner", "opnemer", "medewerker", "wagenpark"] },
  { pagina: "werkopdrachten", titel: "Werkopdrachten", icoon: "📋", bestand: "werkopdrachten.html",
    rollen: ["beheerder", "planner", "opnemer", "medewerker"] },
  { pagina: "opnames",        titel: "Opnames",        icoon: "📐", bestand: "opnames.html",
    rollen: ["beheerder", "planner", "opnemer"] },
  { pagina: "kaart",          titel: "Kaart",          icoon: "🗺️", bestand: "kaart.html",
    rollen: ["beheerder", "planner", "opnemer", "medewerker", "wagenpark"] },
  { pagina: "medewerkers",    titel: "Medewerkers",    icoon: "👷", bestand: "medewerkers.html",
    rollen: ["beheerder", "planner", "opnemer", "wagenpark"] },
  { pagina: "voertuigen",     titel: "Voertuigen",     icoon: "🚐", bestand: "voertuigen.html",
    rollen: ["beheerder", "planner", "wagenpark"] },
  { pagina: "gereedschap",    titel: "Gereedschap",    icoon: "🧰", bestand: "gereedschap.html",
    rollen: ["beheerder", "planner", "opnemer", "wagenpark"] },
  { pagina: "beheer",         titel: "Beheer",         icoon: "⚙️", bestand: "beheer.html",
    rollen: ["beheerder"] }
];

// Welke rol is gekozen? (alleen nagespeeld tot er echt ingelogd wordt)
function huidigeRol() {
  try {
    const rol = localStorage.getItem("gm-rol");
    return ROLLEN[rol] ? rol : "beheerder";
  } catch (e) {
    return "beheerder";
  }
}

function kiesRol(rol) {
  try { localStorage.setItem("gm-rol", rol); } catch (e) {}
  location.reload();
}

function bouwMenu() {
  const huidigePagina = document.body.dataset.pagina;
  const rol = huidigeRol();

  const links = MENU
    .filter(function (item) { return item.rollen.indexOf(rol) !== -1; })
    .map(function (item) {
      const actief = item.pagina === huidigePagina ? ' class="actief"' : "";
      return '<a href="' + item.bestand + '"' + actief + '>' +
               '<span class="icoon" aria-hidden="true">' + item.icoon + '</span>' +
               '<span>' + item.titel + '</span>' +
             '</a>';
    }).join("");

  const keuzes = Object.keys(ROLLEN).map(function (r) {
    return '<option value="' + r + '"' + (r === rol ? " selected" : "") + '>' + ROLLEN[r] + '</option>';
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
    '<div class="rolkeuze">' +
      '<label for="rol">Bekijk als <span>(testmodus)</span></label>' +
      '<select id="rol">' + keuzes + '</select>' +
    '</div>' +
    '<div class="versie">' + VERSIE + '</div>';

  document.body.prepend(menu);
  document.getElementById("rol").addEventListener("change", function (e) { kiesRol(e.target.value); });

  // Op de telefoon staat de rolkeuze bovenaan de pagina
  const balk = document.createElement("div");
  balk.className = "rolbalk";
  balk.innerHTML = 'Bekijk als: <select id="rol-mobiel">' + keuzes + '</select>';
  const inhoud = document.querySelector(".inhoud");
  if (inhoud) inhoud.prepend(balk);
  document.getElementById("rol-mobiel").addEventListener("change", function (e) { kiesRol(e.target.value); });

  const item = MENU.find(function (m) { return m.pagina === huidigePagina; });
  if (item) {
    document.title = item.titel + " – Glasmeesters Planner";

    // Mag deze rol deze pagina niet zien? Dan tonen we een melding.
    if (item.rollen.indexOf(rol) === -1 && inhoud) {
      inhoud.innerHTML = "";
      inhoud.appendChild(balk);
      inhoud.insertAdjacentHTML("beforeend",
        '<h1>Geen toegang</h1>' +
        '<p class="ondertitel">De rol <strong>' + ROLLEN[rol] + '</strong> mag het onderdeel ' +
        item.titel + ' niet bekijken.</p>' +
        '<a class="knop" href="index.html">Naar het dashboard</a>');
      document.body.classList.add("geen-toegang");
    }
  }
}

bouwMenu();

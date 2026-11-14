/* =========================================================
   Glasmeesters Planner – keuzelijsten
   Vaste lijsten die op meerdere plekken gebruikt worden.
   Later kan de beheerder deze zelf aanvullen in Beheer.
   ========================================================= */

// Functies binnen het bedrijf, met de groep waar ze bij horen
const FUNCTIES = [
  { naam: "Bedrijfsleider",       groep: "kantoor" },
  { naam: "Planner",              groep: "kantoor" },
  { naam: "Administratie",        groep: "kantoor" },
  { naam: "Opnemer",              groep: "opname" },
  { naam: "Voorman",              groep: "buitendienst" },
  { naam: "Glaszetter",           groep: "buitendienst" },
  { naam: "Leerling glaszetter",  groep: "buitendienst" }
];

const GROEPEN = {
  kantoor: "Kantoor",
  opname: "Opnemers",
  buitendienst: "Buitendienst"
};

// Opleidingen, certificaten, rijbewijzen en vaardigheden
// wettelijk: true  = harde blokkade in de planning als het ontbreekt (fase 4)
// verloopt:  true  = heeft een vervaldatum
const BEVOEGDHEDEN = [
  { code: "rijbewijs_b",    naam: "Rijbewijs B",               soort: "Rijbewijs",   wettelijk: true,  verloopt: true },
  { code: "rijbewijs_be",   naam: "Rijbewijs BE",              soort: "Rijbewijs",   wettelijk: true,  verloopt: true },
  { code: "rijbewijs_c",    naam: "Rijbewijs C",               soort: "Rijbewijs",   wettelijk: true,  verloopt: true },
  { code: "rijbewijs_ce",   naam: "Rijbewijs CE",              soort: "Rijbewijs",   wettelijk: true,  verloopt: true },
  { code: "vca_basis",      naam: "VCA Basis",                 soort: "Certificaat", wettelijk: false, verloopt: true },
  { code: "vca_vol",        naam: "VCA VOL",                   soort: "Certificaat", wettelijk: false, verloopt: true },
  { code: "hoogwerker",     naam: "Hoogwerker",                soort: "Certificaat", wettelijk: true,  verloopt: true },
  { code: "heftruck",       naam: "Heftruck",                  soort: "Certificaat", wettelijk: true,  verloopt: true },
  { code: "bhv",            naam: "BHV",                       soort: "Certificaat", wettelijk: false, verloopt: true },
  { code: "hoogte",         naam: "Veilig werken op hoogte",   soort: "Certificaat", wettelijk: false, verloopt: true },
  { code: "kraan",          naam: "Werken met een kraan",      soort: "Certificaat", wettelijk: true,  verloopt: true },
  { code: "verreiker",      naam: "Werken met een verreiker",  soort: "Certificaat", wettelijk: true,  verloopt: true },
  { code: "minihijskraan",  naam: "Werken met een minihijskraan", soort: "Certificaat", wettelijk: true, verloopt: true },
  { code: "glaszetten",     naam: "Glaszetten",                soort: "Vaardigheid", wettelijk: false, verloopt: false },
  { code: "glas_tillen",    naam: "Glas tillen en plaatsen",   soort: "Vaardigheid", wettelijk: false, verloopt: false },
  { code: "glaszuigers",    naam: "Werken met glaszuigers",    soort: "Vaardigheid", wettelijk: false, verloopt: false },
  { code: "aanhanger",      naam: "Werken met een aanhanger",  soort: "Vaardigheid", wettelijk: false, verloopt: false },
  { code: "ervaring_hr",    naam: "Ervaring met HR++ glas",    soort: "Ervaring",    wettelijk: false, verloopt: false },
  { code: "ervaring_triple",naam: "Ervaring met triple glas",  soort: "Ervaring",    wettelijk: false, verloopt: false },
  { code: "ervaring_monument", naam: "Ervaring met monumentaal glas", soort: "Ervaring", wettelijk: false, verloopt: false }
];

// Soorten werkzaamheden (uit het ontwerp)
const WERKZAAMHEDEN = [
  "Enkel glas vervangen",
  "HR++ glas plaatsen",
  "HR+++ glas plaatsen",
  "Triple glas plaatsen",
  "Veiligheidsglas plaatsen",
  "Gelaagd glas plaatsen",
  "Gehard glas plaatsen",
  "Isolatieglas plaatsen",
  "Glas vervangen in bestaande kozijnen",
  "Glaslatten vervangen",
  "Nieuwe glaslatten plaatsen",
  "Kitwerkzaamheden",
  "Reparatie / herstel",
  "Opname / inmeten"
];

// Glassoorten (zelfde lijst als bij de opnames in fase 5)
const GLASSOORTEN = [
  "Enkel glas", "Dubbel glas", "HR++", "HR+++", "Triple glas", "Gelaagd glas",
  "Gehard glas", "Figuurglas", "Zonwerend glas", "Brandwerend glas", "Glas-in-lood", "Overig"
];

// Status van een werkopdracht
const STATUSSEN = [
  { code: "concept",      naam: "Concept",       kleur: "grijs"  },
  { code: "voorbereiden", naam: "Voorbereiden",  kleur: "oranje" },
  { code: "gepland",      naam: "Gepland",       kleur: "blauw"  },
  { code: "bezig",        naam: "Bezig",         kleur: "goud"   },
  { code: "klaar",        naam: "Klaar",         kleur: "groen"  },
  { code: "geannuleerd",  naam: "Geannuleerd",   kleur: "rood"   }
];

function statusNaam(code) {
  const s = STATUSSEN.find(function (x) { return x.code === code; });
  return s ? s.naam : "Gepland";
}
function statusKleur(code) {
  const s = STATUSSEN.find(function (x) { return x.code === code; });
  return s ? s.kleur : "blauw";
}

const ROL_IN_PROGRAMMA = {
  beheerder: "Beheerder",
  planner: "Planner",
  opnemer: "Opnemer",
  medewerker: "Medewerker",
  wagenpark: "Wagenparkbeheerder"
};

function bevoegdheidNaam(code) {
  const b = BEVOEGDHEDEN.find(function (x) { return x.code === code; });
  return b ? b.naam : code;
}

function groepVanFunctie(functie) {
  const f = FUNCTIES.find(function (x) { return x.naam === functie; });
  return f ? f.groep : "buitendienst";
}

// Status van een certificaat op een bepaalde datum:
// "geldig", "bijna" (binnen 30 dagen), "verlopen" of "geen" (niet behaald)
function statusBevoegdheid(item, opDatum) {
  if (!item || !item.behaald) return "geen";
  if (!item.geldig_tot) return "geldig";
  const dag = opDatum ? new Date(opDatum) : new Date();
  dag.setHours(0, 0, 0, 0);
  const tot = new Date(item.geldig_tot + "T00:00:00");
  if (tot < dag) return "verlopen";
  const grens = new Date(dag);
  grens.setDate(grens.getDate() + 30);
  return tot <= grens ? "bijna" : "geldig";
}

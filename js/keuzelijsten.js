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

// Veelgebruikte materialen (snelknoppen in de werkopdracht)
const MATERIALEN = [
  { omschrijving: "Glaslatten", eenheid: "m" },
  { omschrijving: "Kit", eenheid: "kokers" },
  { omschrijving: "Beglazingsband", eenheid: "rol" },
  { omschrijving: "Stelblokjes", eenheid: "stuks" },
  { omschrijving: "Afstandhouders", eenheid: "stuks" },
  { omschrijving: "Glaslatspijkers / schroeven", eenheid: "doos" },
  { omschrijving: "Grondverf", eenheid: "blik" },
  { omschrijving: "Afdekfolie", eenheid: "rol" }
];

const GEREEDSCHAP_CATEGORIEEN = [
  "Glaszuigers", "Glasliften", "Glasbokken", "Glasdragers", "Accugereedschap",
  "Boormachines", "Slijpmachines", "Ladders", "Steigers", "Overig"
];

const GEREEDSCHAP_STATUS = {
  beschikbaar: "Beschikbaar",
  in_gebruik: "In gebruik",
  defect: "Defect",
  afgekeurd: "Afgekeurd"
};

const VOERTUIG_STATUS = {
  actief: "Actief",
  buiten_gebruik: "Tijdelijk niet inzetbaar"
};

const VOERTUIG_SOORTEN = { bus: "Bus", bakwagen: "Bakwagen", auto: "Auto", aanhanger: "Aanhanger" };
const BRANDSTOFFEN = ["Diesel", "Benzine", "Elektrisch", "Hybride", "LPG", "Geen (aanhanger)"];
const ONDERHOUD_SOORTEN = ["Onderhoudsbeurt", "APK", "Keuring", "Reparatie", "Banden", "Schade", "Overig"];

function datumNL(iso) {
  return iso ? new Date(iso + "T00:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "";
}

// Vervaldatum t.o.v. een dag: "verlopen", "bijna" (binnen 30 dagen), "geldig" of "geen"
function vervalStatus(datum, opDatum) {
  if (!datum) return "geen";
  return statusBevoegdheid({ behaald: true, geldig_tot: datum }, opDatum);
}

// Alle aandachtspunten van een voertuig (of gereedschap) op een dag
// niveau: "rood" = actie vereist, "oranje" = aandacht nodig, "grijs" = niet actief
function voertuigMeldingen(v, opDatum) {
  const m = [];
  if (v.status === "buiten_gebruik") m.push({ niveau: "grijs", soort: "status", tekst: "Tijdelijk niet inzetbaar" + (v.bijzonderheden ? " – " + v.bijzonderheden : "") });
  const apk = vervalStatus(v.apk_tot, opDatum);
  if (apk === "verlopen") m.push({ niveau: "rood", soort: "apk", tekst: "APK verlopen sinds " + datumNL(v.apk_tot) });
  else if (apk === "bijna") m.push({ niveau: "oranje", soort: "apk", tekst: "APK verloopt op " + datumNL(v.apk_tot) });
  const vz = vervalStatus(v.verzekering_tot, opDatum);
  if (vz === "verlopen") m.push({ niveau: "rood", soort: "verzekering", tekst: "Verzekering verlopen sinds " + datumNL(v.verzekering_tot) });
  else if (vz === "bijna") m.push({ niveau: "oranje", soort: "verzekering", tekst: "Verzekering verloopt op " + datumNL(v.verzekering_tot) });
  const ond = vervalStatus(v.volgende_onderhoud, opDatum);
  if (ond === "verlopen") m.push({ niveau: "rood", soort: "onderhoud", tekst: "Onderhoud te laat (gepland " + datumNL(v.volgende_onderhoud) + ")" });
  else if (ond === "bijna") m.push({ niveau: "oranje", soort: "onderhoud", tekst: "Onderhoud gepland op " + datumNL(v.volgende_onderhoud) });
  if (v.onderhoud_interval_km && v.km_laatste_onderhoud !== undefined && v.km_laatste_onderhoud !== "" && v.kilometerstand) {
    const rest = Number(v.km_laatste_onderhoud) + Number(v.onderhoud_interval_km) - Number(v.kilometerstand);
    if (rest <= 0) m.push({ niveau: "rood", soort: "onderhoud", tekst: "Onderhoud nodig: " + Math.abs(rest).toLocaleString("nl-NL") + " km over de grens" });
    else if (rest <= 1500) m.push({ niveau: "oranje", soort: "onderhoud", tekst: "Onderhoud over " + rest.toLocaleString("nl-NL") + " km" });
  }
  return m;
}

// Welke ervaring hoort bij welk werk of glas (geeft een oranje waarschuwing als niemand het heeft)
const ERVARING_VOOR_WERK = {
  "Triple glas plaatsen": "ervaring_triple",
  "HR++ glas plaatsen": "ervaring_hr",
  "HR+++ glas plaatsen": "ervaring_hr"
};
const ERVARING_VOOR_GLAS = {
  "Triple glas": "ervaring_triple",
  "Glas-in-lood": "ervaring_monument"
};

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

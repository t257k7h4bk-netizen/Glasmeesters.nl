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
  "Ventilatieroosters plaatsen",
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

// Alle aandachtspunten van gereedschap op een dag
function gereedschapMeldingen(g, opDatum) {
  const m = [];
  if (g.status === "defect") m.push({ niveau: "rood", soort: "status", tekst: "Defect" + (g.bijzonderheden ? " – " + g.bijzonderheden : "") });
  if (g.status === "afgekeurd") m.push({ niveau: "grijs", soort: "status", tekst: "Afgekeurd" + (g.bijzonderheden ? " – " + g.bijzonderheden : "") });
  const k = vervalStatus(g.volgende_keuring, opDatum);
  if (k === "verlopen") m.push({ niveau: "rood", soort: "keuring", tekst: "Keuring verlopen sinds " + datumNL(g.volgende_keuring) });
  else if (k === "bijna") m.push({ niveau: "oranje", soort: "keuring", tekst: "Keuring vóór " + datumNL(g.volgende_keuring) });
  const o = vervalStatus(g.volgende_onderhoud, opDatum);
  if (o === "verlopen") m.push({ niveau: "oranje", soort: "onderhoud", tekst: "Onderhoud te laat (gepland " + datumNL(g.volgende_onderhoud) + ")" });
  else if (o === "bijna") m.push({ niveau: "oranje", soort: "onderhoud", tekst: "Onderhoud gepland op " + datumNL(g.volgende_onderhoud) });
  return m;
}

// Alle aandachtspunten van een voertuig op een dag
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

// ---------- Opnames (fase 5) ----------
const GEBOUWTYPES = ["Woning", "Appartement", "Bedrijfspand", "Kantoor", "School", "Winkel", "Monument", "Overig"];
const OPNAME_STATUS = [
  { code: "nieuw",       naam: "Nieuw",              kleur: "blauw"  },
  { code: "uitwerken",   naam: "Uitwerken",          kleur: "oranje" },
  { code: "offerte",     naam: "Offerte verstuurd",  kleur: "goud"   },
  { code: "akkoord",     naam: "Akkoord klant",      kleur: "groen"  },
  { code: "omgezet",     naam: "Omgezet naar opdracht", kleur: "groen" },
  { code: "vervallen",   naam: "Vervallen",          kleur: "grijs"  }
];
const GEVELS = ["Voorzijde", "Achterzijde", "Linkerzijde", "Rechterzijde", "Dak", "Binnen"];
const VERDIEPINGEN = ["Begane grond", "1e verdieping", "2e verdieping", "3e verdieping of hoger", "Zolder", "Kelder / souterrain"];
const RAAMVORMEN = ["Rechthoekig", "Vierkant", "Rond", "Driehoekig", "Schuin", "Gebogen", "Overig"];
const KOZIJNSOORTEN = ["Houten kozijn", "Kunststof kozijn", "Aluminium kozijn", "Stalen kozijn", "Overig"];
const GLASLAT_SOORTEN = ["Houten glaslatten", "Kunststof glaslatten", "Aluminium glaslatten", "Geen / stopverf", "Overig"];
const BEGLAZING = ["Binnenbeglazing", "Buitenbeglazing"];
const KITSOORTEN = ["Beglazingskit", "Siliconenkit", "MS-polymeer", "Acrylaatkit", "Stopverf", "Onbekend"];
const AFSTANDHOUDERS = ["Aluminium", "Warm edge (kunststof)", "RVS", "Onbekend"];
const KLEUREN_AFSTANDHOUDER = ["Zilver / aluminium", "Zwart", "Grijs", "Wit", "Bruin", "Onbekend"];
// Ventilatieroosters
const ROOSTER_SOORTEN = ["Geen", "Gewoon rooster", "Isolerend rooster"];
const ROOSTER_KLEUREN = ["Wit", "Zwart", "Aluminium (blank)", "Brons", "Crème", "Andere kleur (zie opmerking)"];
const ROOSTER_PLAATSING = ["In het glas", "Op het kozijn (bovendorpel)", "In de glaslat"];
// Oude opnames hadden alleen "ventilatierooster: Ja/Nee"
function roosterSoort(r) {
  if (r.rooster_soort) return r.rooster_soort;
  if (r.ventilatierooster === "Ja") return "Gewoon rooster";
  if (r.ventilatierooster === "Nee") return "Geen";
  return "";
}

// Extra materieel bij een opname; "bevoegdheid" = welk certificaat daar later bij nodig is
const MATERIEEL_OPNAME = [
  { code: "glaszuigers",   naam: "Glaszuigers" },
  { code: "glaslift",      naam: "Glaslift" },
  { code: "glasbok",       naam: "Glasbok / glastransport" },
  { code: "ladder",        naam: "Ladder" },
  { code: "rolsteiger",    naam: "Rolsteiger" },
  { code: "steiger",       naam: "Steiger (vast)" },
  { code: "hoogwerker",    naam: "Hoogwerker",    bevoegdheid: "hoogwerker" },
  { code: "kraan",         naam: "Kraan",         bevoegdheid: "kraan" },
  { code: "minihijskraan", naam: "Minihijskraan", bevoegdheid: "minihijskraan" },
  { code: "verreiker",     naam: "Verreiker",     bevoegdheid: "verreiker" },
  { code: "aanhanger",     naam: "Aanhanger" },
  { code: "mankracht",     naam: "Extra mankracht (zwaar glas)" }
];
function materieelNaam(code) {
  const m = MATERIEEL_OPNAME.find(function (x) { return x.code === code; });
  return m ? m.naam : code;
}
function opnameStatusNaam(code) { const s = OPNAME_STATUS.find(function (x) { return x.code === code; }); return s ? s.naam : "Nieuw"; }
function opnameStatusKleur(code) { const s = OPNAME_STATUS.find(function (x) { return x.code === code; }); return s ? s.kleur : "blauw"; }

// Oppervlakte van een raam in m² (breedte × hoogte × aantal ruiten) – werkelijke maat, voor het bestellen
function raamOppervlakte(r) {
  const b = Number(r.breedte) || 0, h = Number(r.hoogte) || 0, n = Number(r.aantal_ruiten) || 1;
  return (b * h * n) / 1000000;
}

// Rekenregel prijs: elke ruit kleiner dan het minimum wordt als het minimum berekend.
// Standaard 0,65 m² per ruit; aan te passen in Beheer (instelling "opname").
let MINIMUM_M2_PER_RUIT = 0.65;
function raamRekenOppervlakte(r, minimum) {
  const min = minimum !== undefined ? minimum : MINIMUM_M2_PER_RUIT;
  const b = Number(r.breedte) || 0, h = Number(r.hoogte) || 0, n = Number(r.aantal_ruiten) || 1;
  if (!b || !h) return 0;
  return Math.max((b * h) / 1000000, min) * n;
}
async function laadOpnameInstellingen() {
  const s = await Opslag.haal("instellingen", "opname");
  if (s && s.minimum_m2 !== undefined && s.minimum_m2 !== "") MINIMUM_M2_PER_RUIT = Number(s.minimum_m2);
  return MINIMUM_M2_PER_RUIT;
}

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


// ---------- Opname → werkopdracht (stap 5c) ----------

// Materieel van een opname: wat bij de ramen of voor het hele project is aangevinkt
function opnameMaterieel(o) {
  return MATERIEEL_OPNAME.map(function (m) {
    const bijRamen = (o.ramen || []).filter(function (r) { return (r.materieel || []).indexOf(m.code) !== -1; });
    const p = (o.materieel || {})[m.code] || {};
    return { code: m.code, naam: m.naam, bevoegdheid: m.bevoegdheid, project: !!p.nodig, toelichting: p.toelichting || "",
             ramen: bijRamen.map(function (r) { return r.nummer; }), nodig: !!p.nodig || bijRamen.length > 0 };
  });
}

// Volgend opdrachtnummer, bijv. 2026-0012 (gedeeld door werkopdrachten en opnames)
async function nieuwOpdrachtNummer() {
  const jaar = new Date().getFullYear();
  const teller = (await Opslag.haal("instellingen", "teller")) || { id: "teller" };
  const laatste = teller.jaar === jaar ? teller.laatste : 0;
  teller.jaar = jaar;
  teller.laatste = laatste + 1;
  await Opslag.bewaar("instellingen", teller);
  return jaar + "-" + String(teller.laatste).padStart(4, "0");
}

// ---------- Nij Begun (isolatiesubsidie Groningen en Noord-Drenthe) ----------
const NB_REGELINGEN = [
  "100% subsidie (HR++ zonder kozijn)",
  "50% subsidie (HR++ zonder kozijn)",
  "30% subsidie (triple glas met kozijnen)",
  "Nog niet bekend"
];
const NB_STATUS = [
  { code: "",             naam: "Nog niet gestart" },
  { code: "offerte",      naam: "Offerte verstuurd" },
  { code: "akkoord",      naam: "Akkoord klant" },
  { code: "aangevraagd",  naam: "Aanvraag bij SNN ingediend" },
  { code: "goedgekeurd",  naam: "Subsidie goedgekeurd" },
  { code: "uitgevoerd",   naam: "Werk uitgevoerd" },
  { code: "gefactureerd", naam: "Factuur verstuurd" },
  { code: "uitbetaald",   naam: "Subsidie uitbetaald" }
];
function nbStatusNaam(code) { const s = NB_STATUS.find(function (x) { return x.code === (code || ""); }); return s ? s.naam : "Nog niet gestart"; }

// Maatregelcodes uit de maatregelencatalogus van Nij Begun, in te vullen in Beheer
// glas[glassoort] = { code, waarde }   rooster[soort] = { code, waarde }
// glas[soort] / rooster[soort] = { code, waarde, max (maximumprijs incl. btw per eenheid), eenheid ("m²" | "m" | "stuk") }
let NB_CODES = { glas: {}, rooster: {}, zin: "" };
async function laadNijBegun() {
  const s = await Opslag.haal("instellingen", "nijbegun");
  NB_CODES = { glas: (s && s.glas) || {}, rooster: (s && s.rooster) || {}, zin: (s && s.zin) || "" };
  return NB_CODES;
}
// Subsidiepercentage bij een gekozen regeling ("100% subsidie …" → 100)
function nbPercentage(regeling) { const m = String(regeling || "").match(/(\d+)%/); return m ? Number(m[1]) : null; }

// Maatregelen van een opname, gegroepeerd zoals ze op de offerte en factuur moeten
function nbMaatregelen(o) {
  const groepen = {};
  (o.ramen || []).forEach(function (r) {
    if (r.glas_nieuw) {
      const c = NB_CODES.glas[r.glas_nieuw] || {};
      const k = "glas|" + r.glas_nieuw;
      const g = groepen[k] = groepen[k] || { type: "glas", soort: r.glas_nieuw, code: c.code || "", waarde: c.waarde || "", omschrijving: r.glas_nieuw, eenheid: "m²", hoeveel: 0, mm: 0, ramen: [],
                                              max: c.max === undefined || c.max === "" ? null : Number(c.max), max_eenheid: c.eenheid || "m²" };
      g.hoeveel += raamOppervlakte(r); g.ramen.push(r.nummer);
    }
    const rs = roosterSoort(r);
    if (rs && rs !== "Geen") {
      const c = NB_CODES.rooster[rs] || {};
      const k = "rooster|" + rs;
      const g = groepen[k] = groepen[k] || { type: "rooster", soort: rs, code: c.code || "", waarde: c.waarde || "", omschrijving: rs, eenheid: "stuks", hoeveel: 0, mm: 0, ramen: [],
                                              max: c.max === undefined || c.max === "" ? null : Number(c.max), max_eenheid: c.eenheid || "stuk" };
      const n = Number(r.rooster_aantal) || 1;
      g.hoeveel += n; g.mm += (Number(r.rooster_lengte) || 0) * n; g.ramen.push(r.nummer);
    }
  });
  // Zijn er codes of maximumprijzen ingesteld? Dan alleen die soorten (andere vallen niet onder Nij Begun)
  const ingesteld = Object.keys(NB_CODES.glas).length + Object.keys(NB_CODES.rooster).length > 0;
  return Object.keys(groepen).map(function (k) { return groepen[k]; })
    .filter(function (g) { return !ingesteld || g.code || g.max !== null; });
}

// ---------- Calculatie en winst (fase C) ----------
// Wie mag bedragen, kostprijs en winst zien?
function magGeldZien(rol) { return rol === "beheerder" || rol === "administratie"; }

const BTW_TARIEVEN = [21, 9, 0];
const CALC_SOORTEN = { glas: "Glas", materiaal: "Materiaal", arbeid: "Arbeid", huur: "Huur materieel", vervoer: "Vervoer", overig: "Overig" };

// Standaardtarieven – FICTIEF, kantoor past ze aan onder Tarieven. Alle bedragen excl. btw.
const TARIEVEN_STANDAARD = {
  uurloon: 45,              // kosten per uur buitendienst (loon + lasten)
  marge: 35,                // standaard opslag op de kostprijs in %
  btw: 21,                  // standaard btw in %
  klein_materiaal: 3,       // % van glas en materiaal voor schroeven, afval, klein spul
  km_standaard: 30,         // standaard afstand heen en terug per werkdag
  glas: { "Enkel glas": 30, "Dubbel glas": 60, "HR++": 95, "HR+++": 120, "Triple glas": 140, "Gelaagd glas": 110,
          "Gehard glas": 100, "Figuurglas": 70, "Zonwerend glas": 115, "Brandwerend glas": 300, "Glas-in-lood": 250, "Overig": 90 },
  rooster: { "Gewoon rooster": 35, "Isolerend rooster": 65 },   // per meter
  glaslatten: 6,            // per meter
  kit: 3,                   // per meter
  huur: { kraan: 650, hoogwerker: 275, steiger: 400, verreiker: 350, rolsteiger: 0, minihijskraan: 0, glaslift: 0, ladder: 0,
          glaszuigers: 0, glasbok: 0, aanhanger: 0, mankracht: 360 },   // per dag
  km: { bus: 0.35, bakwagen: 0.45, auto: 0.25, aanhanger: 0.10 }        // afschrijving + brandstof per km
};
let TARIEVEN = JSON.parse(JSON.stringify(TARIEVEN_STANDAARD));
async function laadTarieven() {
  const s = await Opslag.haal("instellingen", "tarieven");
  const t = JSON.parse(JSON.stringify(TARIEVEN_STANDAARD));
  if (s) {
    ["uurloon", "marge", "btw", "klein_materiaal", "km_standaard", "glaslatten", "kit"].forEach(function (k) { if (s[k] !== undefined && s[k] !== "") t[k] = Number(s[k]); });
    ["glas", "rooster", "huur", "km"].forEach(function (k) { Object.assign(t[k], s[k] || {}); });
  }
  TARIEVEN = t;
  return t;
}

function euro(x, zonderCenten) {
  return (Number(x) || 0).toLocaleString("nl-NL", { style: "currency", currency: "EUR",
    minimumFractionDigits: zonderCenten ? 0 : 2, maximumFractionDigits: zonderCenten ? 0 : 2 });
}
function leesGetal(x) {
  if (x === "" || x === null || x === undefined) return null;
  const n = Number(String(x).replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

// Totalen van een calculatie
// regel: { omschrijving, soort, aantal, eenheid, prijs (begroot per eenheid), werkelijk (echte inkoop totaal, optioneel), btw }
function calcTotalen(c) {
  const marge = Number(c.marge) || 0;
  let kostBegroot = 0, kostWerkelijk = 0, verkoopExcl = 0, btwBedrag = 0;
  const perBtw = {};
  (c.regels || []).forEach(function (r) {
    const begroot = (Number(r.aantal) || 0) * (Number(r.prijs) || 0);
    const werkelijk = r.werkelijk !== null && r.werkelijk !== undefined && r.werkelijk !== "" ? Number(r.werkelijk) : begroot;
    const verkoop = begroot * (1 + marge / 100);
    const btw = Number(r.btw === undefined ? 21 : r.btw);
    kostBegroot += begroot; kostWerkelijk += werkelijk; verkoopExcl += verkoop;
    btwBedrag += verkoop * btw / 100;
    perBtw[btw] = (perBtw[btw] || 0) + verkoop * btw / 100;
  });
  const gefactureerd = c.gefactureerd_excl !== null && c.gefactureerd_excl !== undefined && c.gefactureerd_excl !== "" ? Number(c.gefactureerd_excl) : null;
  return {
    kostBegroot: kostBegroot, kostWerkelijk: kostWerkelijk,
    verkoopExcl: verkoopExcl, btw: btwBedrag, perBtw: perBtw, verkoopIncl: verkoopExcl + btwBedrag,
    winstVerwacht: verkoopExcl - kostBegroot,
    gefactureerd: gefactureerd,
    winstNetto: gefactureerd === null ? null : gefactureerd - kostWerkelijk,
    margeEcht: gefactureerd === null || !kostWerkelijk ? null : (gefactureerd / kostWerkelijk - 1) * 100
  };
}

// ---------- Kaart, route en Street View (fase 6, gratis variant) ----------
// Links openen de Google Maps-app of -website; daarvoor is geen account of sleutel nodig.
function routeLink(adres) { return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(adres || ""); }
function zoekLink(adres) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(adres || ""); }
function streetViewLink(adres, plek) {
  return plek && plek.lat && !plek.benadering ? "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=" + plek.lat + "," + plek.lon : zoekLink(adres);
}
// Route langs meerdere adressen (Google staat er maximaal 9 tussenstops toe)
function routeLangs(adressen) {
  const lijst = adressen.filter(Boolean);
  if (!lijst.length) return "";
  const doel = lijst[lijst.length - 1], tussen = lijst.slice(0, -1).slice(0, 9);
  return routeLink(doel) + (tussen.length ? "&waypoints=" + encodeURIComponent(tussen.join("|")) : "");
}

// Adres → plek op de kaart via OpenStreetMap (Nominatim). Het resultaat wordt op dit apparaat
// bewaard (opslag "locaties"), zodat elk adres maar één keer wordt opgezocht.
// Nominatim vraagt om maximaal 1 zoekvraag per seconde.
function adresSleutel(adres) { return String(adres || "").toLowerCase().replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").trim(); }
let _laatsteZoek = 0;
async function zoekLocatie(adres, opties) {
  const o = opties || {};
  const sleutel = adresSleutel(adres);
  if (!sleutel) return null;
  const bekend = await Opslag.haal("locaties", sleutel);
  if (bekend && (bekend.lat || (bekend.niet_gevonden && !o.opnieuw))) return bekend;
  if (o.alleenBekend) return null;
  const vraag = async function (q) {
    const wacht = 1100 - (Date.now() - _laatsteZoek);
    if (wacht > 0) await new Promise(function (r) { setTimeout(r, wacht); });
    _laatsteZoek = Date.now();
    const antwoord = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=nl&accept-language=nl&q=" + encodeURIComponent(q));
    if (!antwoord.ok) throw new Error("Zoeken mislukt (" + antwoord.status + ")");
    const lijst = await antwoord.json();
    return lijst[0] || null;
  };
  try {
    let r = await vraag(adres), benadering = false;
    // Niet gevonden? Probeer alleen de plaats (achter de laatste komma)
    if (!r && adres.indexOf(",") !== -1) { r = await vraag(adres.split(",").pop().trim()); benadering = !!r; }
    const plek = r ? { id: sleutel, adres: adres, lat: Number(r.lat), lon: Number(r.lon), benadering: benadering, bron: "openstreetmap" }
                   : { id: sleutel, adres: adres, niet_gevonden: true };
    await Opslag.bewaar("locaties", plek);
    return plek;
  } catch (e) {
    return { adres: adres, fout: e.message || "geen verbinding" };
  }
}
async function zetLocatieHandmatig(adres, lat, lon) {
  return Opslag.bewaar("locaties", { id: adresSleutel(adres), adres: adres, lat: lat, lon: lon, handmatig: true, bron: "handmatig" });
}

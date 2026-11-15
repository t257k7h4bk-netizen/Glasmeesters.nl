/* =========================================================
   Glasmeesters Planner – milieuzones en zero-emissiezones (stap Z)

   Bron van de zones: Nationaal Dataportaal Wegverkeer (NDW), open data
   (CC-0), GeoJSON. Wordt op dit apparaat bewaard en hooguit één keer per
   dag opnieuw opgehaald. Lukt ophalen niet, dan kan de beheerder een
   GeoJSON-bestand laden (Beheer → Zones).

   De toegangsregels staan hieronder als standaard en zijn aan te passen
   onder Beheer, omdat de overheid ze geregeld wijzigt.
   ========================================================= */

const Zones = (function () {
  const BRON = "https://data.ndw.nu/api/rest/static-road-data/emission-zones/v1/map";
  const EEN_DAG = 24 * 60 * 60 * 1000;

  // Standaardregels (stand november 2026) – aanpasbaar in Beheer
  const REGELS_STANDAARD = {
    ze: {
      // Bestelauto's (N1)
      bestel_euro5_tot: "2027-01-01",       // Euro 5: toegang tot deze datum
      bestel_euro6_tot: "2029-01-01",       // Euro 6: toegang tot deze datum …
      bestel_euro6_det_voor: "2025-01-01",  // … als het kenteken vóór deze datum is afgegeven
      // Vrachtauto's / bakwagens (N2, N3) met Euro 6
      vracht_a_det_van: "2017-01-01", vracht_a_det_tot: "2019-12-31", vracht_a_tot: "2028-01-01",
      vracht_b_det_van: "2020-01-01", vracht_b_det_tot: "2024-12-31", vracht_b_tot: "2030-01-01"
    },
    milieu: {
      // Milieuzones gelden vooral voor diesel: minimale emissieklasse per soort voertuig
      diesel_personen: 4, diesel_bestel: 4, diesel_vracht: 6
    }
  };
  let REGELS = JSON.parse(JSON.stringify(REGELS_STANDAARD));
  let ZONES = [];          // [{ id, naam, type: "ze"|"milieu"|"zone", gemeente, vanaf, tot, url, geometry, bbox }]
  let INFO = { opgehaald_op: null, bron: "", fout: "" };

  const EMISSIEKLASSEN = [
    { code: "", naam: "Onbekend" }, { code: "euro4", naam: "Euro 4 of lager" }, { code: "euro5", naam: "Euro 5" },
    { code: "euro6", naam: "Euro 6" }, { code: "ze", naam: "Uitstootvrij (elektrisch of waterstof)" }
  ];
  const CATEGORIEEN = { bestel: "Bestelauto (N1)", vracht: "Vrachtauto / bakwagen (N2, N3)", personen: "Personenauto (M1)" };

  function datumNLkort(d) { return d ? new Date(d + "T12:00").toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : ""; }

  // ---------- Rijksdriehoek (RD, EPSG:28992) → graden (WGS84), benadering op ~1 m ----------
  function rdNaarWgs(x, y) {
    const dX = (x - 155000) * 1e-5, dY = (y - 463000) * 1e-5;
    const N = 3235.65389 * dY - 32.58297 * dX * dX - 0.2475 * dY * dY - 0.84978 * dX * dX * dY - 0.0655 * dY * dY * dY
            - 0.01709 * dX * dX * dY * dY - 0.00738 * dX + 0.0053 * Math.pow(dX, 4) - 0.00039 * dX * dX * Math.pow(dY, 3)
            + 0.00033 * Math.pow(dX, 4) * dY - 0.00012 * dX * dY;
    const E = 5260.52916 * dX + 105.94684 * dX * dY + 2.45656 * dX * dY * dY - 0.81885 * Math.pow(dX, 3) + 0.05594 * dX * Math.pow(dY, 3)
            - 0.05607 * Math.pow(dX, 3) * dY + 0.01199 * dY - 0.00256 * Math.pow(dX, 3) * dY * dY + 0.00128 * dX * Math.pow(dY, 4)
            + 0.00022 * dY * dY - 0.00022 * dX * dX + 0.00026 * Math.pow(dX, 5);
    return [5.387206 + E / 3600, 52.15517 + N / 3600];   // [lon, lat] zoals in GeoJSON
  }
  function zetOmAlsRd(geometry) {
    const eerste = (function vind(c) { return typeof c[0] === "number" ? c : vind(c[0]); })(geometry.coordinates);
    if (Math.abs(eerste[0]) <= 180 && Math.abs(eerste[1]) <= 90) return geometry;
    const om = function (c) { return typeof c[0] === "number" ? rdNaarWgs(c[0], c[1]) : c.map(om); };
    return { type: geometry.type, coordinates: om(geometry.coordinates) };
  }

  // ---------- Een zone uit de bron omzetten naar ons eigen formaat ----------
  // De bron kan van vorm veranderen; daarom zoeken we de velden op naam.
  function plat(obj, pad, uit) {
    uit = uit || [];
    if (obj === null || obj === undefined) return uit;
    if (typeof obj !== "object") { uit.push([pad.toLowerCase(), obj]); return uit; }
    Object.keys(obj).forEach(function (k) { plat(obj[k], pad ? pad + "." + k : k, uit); });
    return uit;
  }
  function zoek(paren, patroon, filter) {
    const p = paren.find(function (x) { return patroon.test(x[0].split(".").pop()) && (!filter || filter(x[1])); });
    return p ? p[1] : "";
  }
  function alsDatum(w) {
    if (!w) return "";
    const s = String(w);
    if (/^\d{8}$/.test(s)) return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
    const m = s.match(/^\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : "";
  }
  function normaliseer(f, i) {
    if (!f || !f.geometry || !/Polygon/.test(f.geometry.type)) return null;
    const props = f.properties || {};
    const paren = plat(props, "");
    const alles = JSON.stringify(props).toUpperCase();
    const type = /ZERO[_ -]?EMISSION|NUL[- ]?EMISSIE|ZERO-EMISSIE|ZES\b/.test(alles) ? "ze"
               : /ENVIRONMENTAL|LOW[_ -]?EMISSION|MILIEU/.test(alles) ? "milieu" : "zone";
    const naam = zoek(paren, /^(name|naam|zonename|zone_name|zonenaam|title|titel)$/i, function (v) { return typeof v === "string" && v.trim(); }) ||
                 zoek(paren, /^(description|omschrijving)$/i, function (v) { return typeof v === "string" && v.trim(); }) || "Zone " + (i + 1);
    const gemeenteParen = paren.filter(function (x) { return /municipal|gemeente|authorit/i.test(x[0]) && typeof x[1] === "string" && !/^\d+$/.test(x[1]) && !/code|id$/i.test(x[0].split(".").pop()); });
    const gemeente = gemeenteParen.length ? gemeenteParen[0][1] : "";
    const vanaf = alsDatum(zoek(paren, /^(validfrom|valid_from|startdate|start|startdatum|ingangsdatum|geldigvanaf|effectivefrom|from)$/i, alsDatum));
    const tot = alsDatum(zoek(paren, /^(validto|valid_to|validuntil|enddate|end|einddatum|geldigtot|effectiveto|to)$/i, alsDatum));
    const url = zoek(paren, /url|link|website/i, function (v) { return /^https?:\/\//.test(String(v)); });
    const geometry = zetOmAlsRd(f.geometry);
    return { id: String(props.id || f.id || i), naam: String(naam).trim(), type: type, gemeente: gemeente || "", vanaf: vanaf, tot: tot, url: url || "",
             geometry: geometry, bbox: grenzen(geometry) };
  }
  function grenzen(geometry) {
    let b = [180, 90, -180, -90];
    (function loop(c) { if (typeof c[0] === "number") { b = [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])]; } else c.forEach(loop); })(geometry.coordinates);
    return b;
  }
  function verwerk(data) {
    const lijst = Array.isArray(data) ? data : (data && (data.features || (data.data && data.data.features))) || [];
    return lijst.map(normaliseer).filter(Boolean);
  }

  // ---------- Laden en bewaren ----------
  async function laadRegels() {
    const s = await Opslag.haal("instellingen", "zoneregels");
    REGELS = JSON.parse(JSON.stringify(REGELS_STANDAARD));
    if (s) { Object.assign(REGELS.ze, s.ze || {}); Object.assign(REGELS.milieu, s.milieu || {}); }
    return REGELS;
  }
  async function laad(opties) {
    const o = opties || {};
    await laadRegels();
    const opgeslagen = await Opslag.haal("instellingen", "zones");
    if (opgeslagen) { ZONES = opgeslagen.zones || []; INFO = { opgehaald_op: opgeslagen.opgehaald_op, bron: opgeslagen.bron || "", fout: "" }; }
    const oud = !opgeslagen || !opgeslagen.opgehaald_op || (Date.now() - new Date(opgeslagen.opgehaald_op).getTime() > EEN_DAG);
    if (!o.alleenOpgeslagen && (o.opnieuw || (oud && (!opgeslagen || opgeslagen.bron !== "bestand")))) {
      try {
        const antwoord = await fetch(BRON, { headers: { Accept: "application/json" } });
        if (!antwoord.ok) throw new Error("de bron gaf foutcode " + antwoord.status);
        const zones = verwerk(await antwoord.json());
        if (!zones.length) throw new Error("er zaten geen zones in het antwoord");
        await bewaar(zones, "ndw");
      } catch (e) {
        INFO.fout = "Zones konden niet worden opgehaald (" + (e.message || "geen verbinding") + ")." + (ZONES.length ? " De laatst bekende zones worden gebruikt." : "");
      }
    }
    return ZONES;
  }
  async function bewaar(zones, bron) {
    ZONES = zones;
    INFO = { opgehaald_op: new Date().toISOString(), bron: bron, fout: "" };
    await Opslag.bewaar("instellingen", { id: "zones", zones: zones, opgehaald_op: INFO.opgehaald_op, bron: bron });
  }
  async function laadUitBestand(tekst) {
    const zones = verwerk(JSON.parse(tekst));
    if (!zones.length) throw new Error("In dit bestand staan geen zones (vlakken).");
    await bewaar(zones, "bestand");
    return zones;
  }

  // ---------- Ligt een punt in een zone? ----------
  function inRing(lon, lat, ring) {
    let binnen = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) binnen = !binnen;
    }
    return binnen;
  }
  function inPolygoon(lon, lat, poly) {
    if (!inRing(lon, lat, poly[0])) return false;
    for (let k = 1; k < poly.length; k++) if (inRing(lon, lat, poly[k])) return false;   // gaten
    return true;
  }
  function bevat(zone, lat, lon) {
    const b = zone.bbox;
    if (b && (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3])) return false;
    const g = zone.geometry;
    if (g.type === "Polygon") return inPolygoon(lon, lat, g.coordinates);
    return g.coordinates.some(function (p) { return inPolygoon(lon, lat, p); });
  }
  function actief(zone, datum) {
    return (!zone.vanaf || zone.vanaf <= datum) && (!zone.tot || zone.tot > datum);
  }
  // Zones op een plek; met datum alleen de zones die dan gelden (of binnen 90 dagen ingaan)
  function op(lat, lon, datum) {
    if (lat === undefined || lat === null) return [];
    return ZONES.filter(function (z) { return bevat(z, lat, lon); }).filter(function (z) {
      if (!datum) return true;
      return actief(z, datum) || (z.vanaf && z.vanaf > datum && (new Date(z.vanaf) - new Date(datum)) / 86400000 <= 90);
    });
  }

  // ---------- Mag dit voertuig de zone in? ----------
  function categorie(v) {
    if (v.rdw_categorie) return v.rdw_categorie;
    return v.soort === "auto" ? "personen" : v.soort === "bakwagen" ? "vracht" : "bestel";
  }
  function klasse(v) {
    if (/elektrisch|waterstof/i.test(v.brandstof || "")) return "ze";
    return v.emissieklasse || "";
  }
  // Antwoord: { mag: true|false|null (onbekend), tot: "jjjj-mm-dd" (toegang eindigt), reden }
  function toegang(v, zone, datum) {
    if (!v || v.soort === "aanhanger") return { mag: true, reden: "" };
    const kl = klasse(v), cat = categorie(v), det = v.datum_eerste_toelating || "";
    const naam = v.naam + (kl === "ze" ? "" : " (" + (v.brandstof || "?").toLowerCase() + (kl ? ", " + (EMISSIEKLASSEN.find(function (e) { return e.code === kl; }) || {}).naam : "") + ")");
    if (zone.type === "milieu") {
      if (kl === "ze" || !/diesel/i.test(v.brandstof || "")) return { mag: true, reden: "" };
      const min = REGELS.milieu["diesel_" + cat] || 4;
      const n = kl === "euro4" ? 4 : kl === "euro5" ? 5 : kl === "euro6" ? 6 : null;
      if (n === null) return { mag: null, reden: "Van " + v.naam + " is de emissieklasse onbekend: controleer of hij milieuzone " + zone.naam + " in mag." };
      if (n >= min) return { mag: true, reden: "" };
      return { mag: false, reden: naam + " mag milieuzone " + zone.naam + " niet in (diesel minimaal Euro " + min + ")." };
    }
    // Zero-emissiezone: geldt voor bestel- en vrachtauto's, niet voor personenauto's
    if (cat === "personen" || kl === "ze") return { mag: true, reden: "" };
    if (!kl) return { mag: null, reden: "Van " + v.naam + " is de emissieklasse onbekend: controleer of hij zero-emissiezone " + zone.naam + " in mag." };
    const r = REGELS.ze;
    let tot = null;
    if (cat === "bestel") {
      if (kl === "euro5") tot = r.bestel_euro5_tot;
      else if (kl === "euro6") {
        if (!det) return { mag: null, reden: "Van " + v.naam + " ontbreekt de datum eerste toelating: die bepaalt of hij zero-emissiezone " + zone.naam + " in mag." };
        tot = det < r.bestel_euro6_det_voor ? r.bestel_euro6_tot : null;
      }
    } else {
      if (kl === "euro6" && det) {
        if (det >= r.vracht_a_det_van && det <= r.vracht_a_det_tot) tot = r.vracht_a_tot;
        else if (det >= r.vracht_b_det_van && det <= r.vracht_b_det_tot) tot = r.vracht_b_tot;
      } else if (kl === "euro6") return { mag: null, reden: "Van " + v.naam + " ontbreekt de datum eerste toelating." };
    }
    if (!tot) return { mag: false, reden: naam + " mag zero-emissiezone " + zone.naam + " niet in." };
    if (datum >= tot) return { mag: false, tot: tot, reden: naam + " mag sinds " + datumNLkort(tot) + " zero-emissiezone " + zone.naam + " niet meer in." };
    return { mag: true, tot: tot, reden: naam + " mag zero-emissiezone " + zone.naam + " nog in tot " + datumNLkort(tot) + "." };
  }

  // Controle voor een werkopdracht: rood (mag niet) en oranje (onbekend of loopt binnenkort af)
  function controleerKlus(plek, voertuig, datum) {
    const rood = [], oranje = [];
    if (!plek || !plek.lat || !voertuig || !datum) return { rood: rood, oranje: oranje, zones: [] };
    const zones = op(plek.lat, plek.lon, datum);
    zones.forEach(function (z) {
      if (!actief(z, datum)) { oranje.push("Let op: " + (z.type === "ze" ? "zero-emissiezone " : "milieuzone ") + z.naam + " gaat in op " + datumNLkort(z.vanaf) + "."); return; }
      const t = toegang(voertuig, z, datum);
      if (t.mag === false) rood.push(t.reden + " Kies een ander voertuig of regel een ontheffing.");
      else if (t.mag === null) oranje.push(t.reden);
      else if (t.tot && (new Date(t.tot) - new Date(datum)) / 86400000 <= 90) oranje.push(t.reden);
    });
    return { rood: rood, oranje: oranje, zones: zones };
  }

  return {
    BRON: BRON, REGELS_STANDAARD: REGELS_STANDAARD, EMISSIEKLASSEN: EMISSIEKLASSEN, CATEGORIEEN: CATEGORIEEN,
    laad: laad, laadRegels: laadRegels, laadUitBestand: laadUitBestand, verwerk: verwerk,
    alle: function () { return ZONES; }, info: function () { return INFO; }, regels: function () { return REGELS; },
    op: op, bevat: bevat, actief: actief, toegang: toegang, controleerKlus: controleerKlus, categorie: categorie, klasse: klasse, rdNaarWgs: rdNaarWgs
  };
})();

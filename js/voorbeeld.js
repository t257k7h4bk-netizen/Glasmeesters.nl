/* =========================================================
   Glasmeesters Planner – voorbeeldgegevens
   30 VERZONNEN medewerkers om mee te testen. Namen, telefoon-
   nummers en e-mailadressen zijn fictief. Alles is aan te passen.

   Bewust ingebouwd om de waarschuwingen te kunnen testen:
   - Jan Bakker heeft GEEN rijbewijs BE (aanhanger)
   - Peter de Vries heeft een VERLOPEN VCA VOL
   - Mark Hoekstra: hoogwerker-certificaat verloopt BINNEN 30 DAGEN
   - Ali Yilmaz heeft een VERLOPEN BHV
   - Luuk Venema en Jesse Scholten hebben nog GEEN rijbewijs
   ========================================================= */

const Voorbeeld = (function () {

  // Datum als "JJJJ-MM-DD" in Nederlandse tijd
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // n dagen vanaf vandaag (negatief = verleden)
  function dag(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return iso(d);
  }

  const GLAS = "glaszetten glas_tillen glaszuigers ervaring_hr";

  // voornaam, achternaam, functie, rol in programma, in dienst sinds (jaar), bevoegdheden
  const MENSEN = [
    ["Sandra",  "Mulder",     "Bedrijfsleider", "beheerder", 2015, "rijbewijs_b bhv"],
    ["Lisa",    "de Boer",    "Planner",        "planner",   2019, "rijbewijs_b bhv"],
    ["Erik",    "Smit",       "Planner",        "planner",   2021, "rijbewijs_b"],
    ["Monique", "Veenstra",   "Administratie",  "wagenpark", 2018, "rijbewijs_b"],

    ["Henk",    "Dijkstra",   "Opnemer", "opnemer", 2012, "rijbewijs_b rijbewijs_be vca_basis ervaring_monument ervaring_hr"],
    ["Femke",   "Bosma",      "Opnemer", "opnemer", 2020, "rijbewijs_b vca_basis ervaring_hr"],
    ["Rutger",  "Kuipers",    "Opnemer", "opnemer", 2017, "rijbewijs_b vca_basis hoogte ervaring_hr ervaring_triple"],
    ["Daan",    "Postma",     "Opnemer", "opnemer", 2022, "rijbewijs_b vca_basis"],

    ["Peter",   "de Vries",   "Voorman", "medewerker", 2010, "rijbewijs_b rijbewijs_be vca_vol hoogte aanhanger ervaring_triple " + GLAS],
    ["Bert",    "Huizinga",   "Voorman", "medewerker", 2011, "rijbewijs_b rijbewijs_be rijbewijs_c vca_vol kraan aanhanger bhv " + GLAS],
    ["Wim",     "Wierenga",   "Voorman", "medewerker", 2013, "rijbewijs_b rijbewijs_be vca_vol hoogwerker minihijskraan hoogte aanhanger " + GLAS],
    ["Gerrit",  "Meijer",     "Voorman", "medewerker", 2014, "rijbewijs_b rijbewijs_be vca_vol verreiker heftruck aanhanger ervaring_monument " + GLAS],

    ["Jan",     "Bakker",     "Glaszetter", "medewerker", 2016, "rijbewijs_b vca_basis hoogte " + GLAS],
    ["Mark",    "Hoekstra",   "Glaszetter", "medewerker", 2018, "rijbewijs_b rijbewijs_be vca_basis hoogwerker aanhanger ervaring_triple " + GLAS],
    ["Ali",     "Yilmaz",     "Glaszetter", "medewerker", 2019, "rijbewijs_b vca_basis bhv ervaring_triple " + GLAS],
    ["Thomas",  "Visser",     "Glaszetter", "medewerker", 2017, "rijbewijs_b rijbewijs_be vca_basis minihijskraan aanhanger " + GLAS],
    ["Sven",    "Hofstra",    "Glaszetter", "medewerker", 2015, "rijbewijs_b rijbewijs_be rijbewijs_c vca_basis heftruck aanhanger " + GLAS],
    ["Joost",   "Kramer",     "Glaszetter", "medewerker", 2020, "rijbewijs_b vca_basis hoogwerker hoogte " + GLAS],
    ["Rick",    "Brouwer",    "Glaszetter", "medewerker", 2016, "rijbewijs_b rijbewijs_be vca_basis aanhanger ervaring_monument " + GLAS],
    ["Bas",     "van Dijk",   "Glaszetter", "medewerker", 2021, "rijbewijs_b vca_basis ervaring_triple " + GLAS],
    ["Niels",   "Jonker",     "Glaszetter", "medewerker", 2014, "rijbewijs_b vca_basis hoogwerker kraan " + GLAS],
    ["Ruben",   "Zijlstra",   "Glaszetter", "medewerker", 2019, "rijbewijs_b rijbewijs_be vca_basis hoogte aanhanger " + GLAS],
    ["Mehmet",  "Kaya",       "Glaszetter", "medewerker", 2018, "rijbewijs_b vca_basis bhv minihijskraan " + GLAS],
    ["Tim",     "de Jong",    "Glaszetter", "medewerker", 2022, "rijbewijs_b vca_basis " + GLAS],
    ["Stefan",  "Wolters",    "Glaszetter", "medewerker", 2013, "rijbewijs_b vca_basis verreiker heftruck " + GLAS],
    ["Pieter",  "Bos",        "Glaszetter", "medewerker", 2009, "rijbewijs_b rijbewijs_be rijbewijs_c rijbewijs_ce vca_basis aanhanger ervaring_monument ervaring_triple " + GLAS],

    ["Luuk",    "Venema",     "Leerling glaszetter", "medewerker", 2025, "vca_basis glas_tillen glaszuigers"],
    ["Jesse",   "Scholten",   "Leerling glaszetter", "medewerker", 2025, "vca_basis glas_tillen glaszuigers"],
    ["Milan",   "Hiemstra",   "Leerling glaszetter", "medewerker", 2024, "rijbewijs_b vca_basis glas_tillen glaszuigers"],
    ["Noah",    "Prins",      "Leerling glaszetter", "medewerker", 2024, "rijbewijs_b vca_basis glas_tillen glaszuigers"]
  ];

  // Normale geldigheid (in dagen vanaf vandaag), licht gevarieerd per persoon
  function geldigTot(code, i) {
    const spreiding = (i * 37) % 300;
    if (code.indexOf("rijbewijs") === 0) return dag(900 + spreiding * 5);
    if (code === "vca_basis" || code === "vca_vol") return dag(200 + spreiding * 2);
    if (code === "bhv") return dag(120 + spreiding);
    return dag(300 + spreiding * 2); // overige certificaten
  }

  // Bewuste uitzonderingen om waarschuwingen te testen
  const UITZONDERINGEN = {
    "Peter de Vries": { vca_vol: -20 },
    "Mark Hoekstra":  { hoogwerker: 18 },
    "Ali Yilmaz":     { bhv: -45 }
  };

  function maakMedewerkers() {
    return MENSEN.map(function (m, i) {
      const naam = m[0] + " " + m[1];
      const codes = m[5].split(" ").filter(Boolean);
      const bevoegdheden = codes.map(function (code) {
        const def = BEVOEGDHEDEN.find(function (b) { return b.code === code; });
        const item = {
          code: code,
          behaald: true,
          datum_behaald: (m[4] + (i % 3)) + "-0" + (1 + (i % 9)) + "-15"
        };
        if (def && def.verloopt) {
          const afwijking = UITZONDERINGEN[naam] && UITZONDERINGEN[naam][code];
          item.geldig_tot = afwijking !== undefined ? dag(afwijking) : geldigTot(code, i);
        }
        return item;
      });
      const nummer = String(101 + i);
      return {
        voornaam: m[0],
        achternaam: m[1],
        functie: m[2],
        rol: m[3],
        telefoon: "06-00000" + nummer,
        email: (m[0] + "." + m[1]).toLowerCase().replace(/ /g, "") + "@example.com",
        in_dienst_sinds: m[4] + "-0" + (1 + (i % 9)) + "-01",
        actief: true,
        bijzonderheden: "",
        foto: "",
        bevoegdheden: bevoegdheden,
        voorbeeld: true
      };
    });
  }

  // Laadt de voorbeeldmedewerkers ÉÉN keer automatisch.
  // Daarna nooit meer vanzelf, ook niet als je ze verwijdert.
  async function zorgVoorMedewerkers() {
    const vlag = (await Opslag.haal("instellingen", "voorbeeld")) || { id: "voorbeeld" };
    if (vlag.medewerkers) return false;
    const bestaand = await Opslag.alle("medewerkers");
    if (bestaand.length === 0) {
      for (const m of maakMedewerkers()) await Opslag.bewaar("medewerkers", m);
    }
    vlag.medewerkers = true;
    await Opslag.bewaar("instellingen", vlag);
    return bestaand.length === 0;
  }

  // Vanuit Beheer: verwijdert de voorbeeldmedewerkers en zet ze opnieuw neer
  async function herstelMedewerkers() {
    const bestaand = await Opslag.alle("medewerkers");
    // Zelfde nummer (id) houden, zodat ingeplande klussen blijven kloppen
    const oudeId = {};
    for (const m of bestaand) {
      if (m.voorbeeld) {
        oudeId[m.email] = m.id;
        await Opslag.verwijder("medewerkers", m.id);
      }
    }
    for (const m of maakMedewerkers()) {
      if (oudeId[m.email]) m.id = oudeId[m.email];
      await Opslag.bewaar("medewerkers", m);
    }
    const vlag = (await Opslag.haal("instellingen", "voorbeeld")) || { id: "voorbeeld" };
    vlag.medewerkers = true;
    await Opslag.bewaar("instellingen", vlag);
  }

  // ----- Voorbeeldklussen en afwezigheid voor de eerstvolgende werkweek -----

  // dag (0 = maandag), start, eind, klant, adres, telefoon, werkzaamheden, medewerkers
  const KLUSSEN = [
    [0, "07:30", "12:00", "Familie Jansen", "Voorbeeldstraat 12, Groningen", "050-0000001",
      "Vervangen van 4 HR++ ruiten\nNieuwe glaslatten plaatsen\nAfkitten van de ramen",
      ["Jan Bakker", "Peter de Vries", "Mark Hoekstra"], "Eerst aanbellen bij de achterdeur."],
    [0, "08:00", "16:30", "Basisschool De Fontein", "Schoolweg 3, Haren", "050-0000002",
      "Veiligheidsglas plaatsen in 6 deuren", ["Bert Huizinga", "Ali Yilmaz"], ""],
    [0, "12:30", "16:30", "Familie de Groot", "Kerkstraat 8, Zuidlaren", "050-0000003",
      "Glasschade herstellen in de woonkamer", ["Jan Bakker", "Mark Hoekstra"], ""],
    [1, "07:30", "16:30", "Café Het Hoekje", "Grote Markt 5, Groningen", "050-0000004",
      "Gelaagd glas in de pui", ["Wim Wierenga", "Thomas Visser", "Sven Hofstra"], "Parkeren achter het pand."],
    [1, "07:30", "12:00", "Familie Smits", "Hereweg 120, Groningen", "050-0000005",
      "Enkel glas vervangen door HR+++", ["Gerrit Meijer", "Rick Brouwer"], ""],
    [2, "07:30", "16:30", "VvE Parkzicht", "Parklaan 40, Groningen", "050-0000006",
      "Triple glas plaatsen, 12 ramen", ["Peter de Vries", "Bas van Dijk", "Pieter Bos", "Joost Kramer"], ""],
    [2, "08:00", "12:00", "Familie Kok", "Dorpsstraat 2, Haren", "050-0000007",
      "Opname: 8 ramen inmeten", ["Henk Dijkstra"], ""],
    [3, "07:30", "12:00", "Prinsenhof (monument)", "Prinsenhof 1, Groningen", "050-0000008",
      "Glas-in-lood isoleren", ["Gerrit Meijer", "Rick Brouwer"], "Monument: voorzichtig met de kozijnen."],
    [3, "12:30", "16:30", "Familie Wiersma", "Zuiderweg 9, Zuidlaren", "050-0000009",
      "Kitwerkzaamheden", ["Tim de Jong", "Luuk Venema"], ""],
    [4, "07:30", "14:00", "Kantoorpand Noorderhaven", "Noorderhaven 10, Groningen", "050-0000010",
      "Isolatieglas plaatsen, 10 ramen", ["Bert Huizinga", "Niels Jonker", "Mehmet Kaya"], ""]
  ];

  // Soort werk en glas per voorbeeldopdracht
  const SOORT = {
    "Familie Jansen": [["HR++ glas plaatsen", "Nieuwe glaslatten plaatsen", "Kitwerkzaamheden"], "HR++"],
    "Basisschool De Fontein": [["Veiligheidsglas plaatsen"], "Gelaagd glas"],
    "Familie de Groot": [["Reparatie / herstel"], "Dubbel glas"],
    "Café Het Hoekje": [["Gelaagd glas plaatsen"], "Gelaagd glas"],
    "Familie Smits": [["Enkel glas vervangen", "HR+++ glas plaatsen"], "HR+++"],
    "VvE Parkzicht": [["Triple glas plaatsen", "Glas vervangen in bestaande kozijnen"], "Triple glas"],
    "Familie Kok": [["Opname / inmeten"], ""],
    "Prinsenhof (monument)": [["Reparatie / herstel"], "Glas-in-lood"],
    "Familie Wiersma": [["Kitwerkzaamheden"], ""],
    "Kantoorpand Noorderhaven": [["Isolatieglas plaatsen"], "HR++"]
  };

  // medewerker, soort, van (dag), tot (dag)
  const AFWEZIG = [
    ["Stefan Wolters", "Vakantie", 0, 2],
    ["Ruben Zijlstra", "Cursus", 3, 3]
  ];

  // Maandag van de eerstvolgende werkweek (op za/zo: komende maandag)
  function eersteMaandag() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const wd = d.getDay(); // 0 = zondag
    if (wd === 6) d.setDate(d.getDate() + 2);
    else if (wd === 0) d.setDate(d.getDate() + 1);
    else d.setDate(d.getDate() - (wd - 1));
    return d;
  }

  async function zorgVoorPlanning() {
    const vlag = (await Opslag.haal("instellingen", "voorbeeld")) || { id: "voorbeeld" };
    if (vlag.planning) return false;
    const bestaand = await Opslag.alle("klussen");
    if (bestaand.length === 0) {
      const mensen = await Opslag.alle("medewerkers");
      const idVan = function (naam) {
        const m = mensen.find(function (x) { return (x.voornaam + " " + x.achternaam) === naam; });
        return m ? m.id : null;
      };
      const ma = eersteMaandag();
      const opDag = function (n) { const d = new Date(ma); d.setDate(d.getDate() + n); return iso(d); };
      for (const k of KLUSSEN) {
        await Opslag.bewaar("klussen", {
          datum: opDag(k[0]), start: k[1], eind: k[2], klant: k[3], adres: k[4], telefoon_klant: k[5],
          werkzaamheden: k[6], medewerkers: k[7].map(idVan).filter(Boolean), bijzonderheden: k[8],
          status: "gepland", voorbeeld: true,
          soort_werk: (SOORT[k[3]] || [[], ""])[0], soort_glas: (SOORT[k[3]] || [[], ""])[1]
        });
      }
      for (const a of AFWEZIG) {
        const id = idVan(a[0]);
        if (id) await Opslag.bewaar("afwezigheid", {
          medewerker: id, soort: a[1], van: opDag(a[2]), tot: opDag(a[3]), opmerking: "", voorbeeld: true
        });
      }
    }
    vlag.planning = true;
    await Opslag.bewaar("instellingen", vlag);
    return true;
  }

  // ----- Voorbeeldvoertuigen en -gereedschap (fictief) -----

  // naam, soort, merk, type, kenteken, vereist rijbewijs, status
  const VOERTUIGEN = [
    ["Bus 1", "bus", "Mercedes-Benz", "Sprinter", "XX-101-A", "rijbewijs_b", "actief"],
    ["Bus 2", "bus", "Mercedes-Benz", "Sprinter", "XX-102-A", "rijbewijs_b", "actief"],
    ["Bus 3", "bus", "Volkswagen", "Crafter", "XX-103-A", "rijbewijs_b", "actief"],
    ["Bus 4", "bus", "Renault", "Master", "XX-104-A", "rijbewijs_b", "actief"],
    ["Bus 5", "bus", "Ford", "Transit", "XX-105-A", "rijbewijs_b", "actief"],
    ["Bus 6", "bus", "Volkswagen", "Transporter", "XX-106-A", "rijbewijs_b", "buiten_gebruik"],
    ["Bakwagen", "bakwagen", "Iveco", "Daily 7,2 ton", "XX-107-B", "rijbewijs_c", "actief"],
    ["Opnamewagen 1", "auto", "Volkswagen", "Caddy", "XX-108-C", "rijbewijs_b", "actief"],
    ["Opnamewagen 2", "auto", "Peugeot", "Partner", "XX-109-C", "rijbewijs_b", "actief"],
    ["Aanhanger 1 (glasbok)", "aanhanger", "Humbaur", "Glastransport", "WX-01-AA", "rijbewijs_be", "actief"],
    ["Aanhanger 2 (open)", "aanhanger", "Anssems", "Bakwagen 750 kg", "WX-02-AA", "rijbewijs_b", "actief"]
  ];

  // naam, categorie, merk, status
  const GEREEDSCHAP = [
    ["Glaszuiger 1", "Glaszuigers", "Bohle", "beschikbaar"],
    ["Glaszuiger 2", "Glaszuigers", "Bohle", "beschikbaar"],
    ["Glaszuiger 3", "Glaszuigers", "Bohle", "beschikbaar"],
    ["Glaszuiger 4", "Glaszuigers", "Bohle", "defect"],
    ["Glaslift 1", "Glasliften", "Smart Lift", "beschikbaar"],
    ["Glasbok 1", "Glasbokken", "Bohle", "beschikbaar"],
    ["Glasbok 2", "Glasbokken", "Bohle", "beschikbaar"],
    ["Glasdrager 1", "Glasdragers", "Bohle", "beschikbaar"],
    ["Glasdrager 2", "Glasdragers", "Bohle", "beschikbaar"],
    ["Accuboormachine 1", "Accugereedschap", "Makita", "beschikbaar"],
    ["Accuboormachine 2", "Accugereedschap", "Makita", "beschikbaar"],
    ["Accuboormachine 3", "Accugereedschap", "Makita", "beschikbaar"],
    ["Klopboormachine 1", "Boormachines", "Bosch", "beschikbaar"],
    ["Slijpmachine 1", "Slijpmachines", "Makita", "beschikbaar"],
    ["Slijpmachine 2", "Slijpmachines", "Makita", "beschikbaar"],
    ["Ladder 1 (3-delig)", "Ladders", "Altrex", "beschikbaar"],
    ["Ladder 2 (3-delig)", "Ladders", "Altrex", "beschikbaar"],
    ["Ladder 3 (reform)", "Ladders", "Altrex", "afgekeurd"],
    ["Rolsteiger 1", "Steigers", "Altrex", "beschikbaar"],
    ["Rolsteiger 2", "Steigers", "Altrex", "beschikbaar"],
    ["Kitpistool-set 1", "Overig", "Cox", "beschikbaar"],
    ["Kitpistool-set 2", "Overig", "Cox", "beschikbaar"],
    ["Minihijskraan", "Overig", "Unic", "beschikbaar", "minihijskraan"]
  ];

  async function zorgVoorMaterieel() {
    const vlag = (await Opslag.haal("instellingen", "voorbeeld")) || { id: "voorbeeld" };
    if (vlag.materieel) return false;
    if ((await Opslag.alle("voertuigen")).length === 0) {
      for (const v of VOERTUIGEN) {
        await Opslag.bewaar("voertuigen", {
          naam: v[0], soort: v[1], merk: v[2], type: v[3], kenteken: v[4],
          vereist_rijbewijs: v[5], status: v[6], bijzonderheden: v[6] === "buiten_gebruik" ? "In reparatie bij de garage" : "",
          voorbeeld: true
        });
      }
    }
    if ((await Opslag.alle("gereedschap")).length === 0) {
      for (const g of GEREEDSCHAP) {
        await Opslag.bewaar("gereedschap", {
          naam: g[0], categorie: g[1], merk: g[2], status: g[3], vereist: g[4] || "",
          bijzonderheden: g[3] === "defect" ? "Rubber gescheurd" : g[3] === "afgekeurd" ? "Afgekeurd bij keuring" : "",
          voorbeeld: true
        });
      }
    }
    vlag.materieel = true;
    await Opslag.bewaar("instellingen", vlag);
    return true;
  }

  // ----- Voorbeeldopname (fictief) -----
  async function zorgVoorOpname() {
    const vlag = (await Opslag.haal("instellingen", "voorbeeld")) || { id: "voorbeeld" };
    if (vlag.opname) return false;
    if ((await Opslag.alle("opnames")).length === 0) {
      const mensen = await Opslag.alle("medewerkers");
      const henk = mensen.find(function (m) { return m.voornaam === "Henk" && m.achternaam === "Dijkstra"; });
      const basis = { glas_huidig: "Dubbel glas", glas_nieuw: "HR++", kozijn: "Houten kozijn", beglazing: "Buitenbeglazing",
                      kitsoort: "Beglazingskit", glaslat_soort: "Houten glaslatten", glaslat_profiel: "Schuin", glaslat_maten: "18 × 22 mm",
                      afstandhouder: "Aluminium", afstandhouder_kleur: "Zilver / aluminium", aantal_ruiten: 1, vorm: "Rechthoekig",
                      glasdikte: "24", spouwbreedte: "12", ventilatierooster: "Nee", schade: "", bereikbaarheid: "", opmerkingen: "", vorm_toelichting: "" };
      const raam = function (nr, ruimte, gevel, verdieping, b, h, extra) {
        return Object.assign({ id: Opslag.nieuwId(), nummer: nr, ruimte: ruimte, gevel: gevel, verdieping: verdieping,
          breedte: String(b), hoogte: String(h), glaslatten_vervangen: "Ja", materieel: ["glaszuigers"] }, basis, extra || {});
      };
      const t = (await Opslag.haal("instellingen", "teller_opname")) || { id: "teller_opname" };
      t.jaar = new Date().getFullYear(); t.laatste = (t.laatste || 0) + 1;
      await Opslag.bewaar("instellingen", t);
      await Opslag.bewaar("opnames", {
        nummer: "OP-" + t.jaar + "-" + String(t.laatste).padStart(4, "0"), datum: dag(-3), status: "uitwerken",
        klant: "Familie Kok", telefoon: "050-0000007", email: "familie.kok@example.com", adres: "Dorpsstraat 2, 9751 AA Haren",
        gebouwtype: "Woning", bouwjaar: "1934", opnemer: henk ? henk.id : "", voorbeeld: true,
        opmerkingen: "Jaren-30 woning. Klant wil alle ramen naar HR++, glas-in-lood bovenlichten behouden.",
        materieel: { steiger: { nodig: false, toelichting: "" }, hoogwerker: { nodig: true, toelichting: "Voor de ramen op de verdieping aan de voorzijde, smalle stoep" } },
        personen: "2", duur_uren: "14", bereikbaarheid: "Parkeren op de oprit mogelijk. Achterom via de tuin.",
        ramen: [
          raam("01", "Woonkamer", "Voorzijde", "Begane grond", 1850, 1600, { aantal_ruiten: 2, materieel: ["glaszuigers", "glasbok"] }),
          raam("02", "Woonkamer bovenlicht", "Voorzijde", "Begane grond", 1850, 450, { glas_huidig: "Glas-in-lood", glas_nieuw: "Glas-in-lood", glaslatten_vervangen: "Nee",
            opmerkingen: "Glas-in-lood behouden; isoleren met voorzetbeglazing bespreken.", materieel: [] }),
          raam("03", "Slaapkamer voor", "Voorzijde", "1e verdieping", 1200, 1400, { materieel: ["glaszuigers", "hoogwerker"], bereikbaarheid: "Alleen van buitenaf" }),
          raam("04", "Keuken", "Achterzijde", "Begane grond", 1000, 1100, { schade: "Glaslat links onder rot" }),
          raam("05", "Badkamer", "Linkerzijde", "1e verdieping", 600, 800, { glas_nieuw: "Figuurglas", materieel: ["ladder"] })
        ]
      });
    }
    vlag.opname = true;
    await Opslag.bewaar("instellingen", vlag);
    return true;
  }

  // ----- Fictieve afgeronde opdrachten met calculatie (voor het winstoverzicht, fase C2) -----
  async function zorgVoorFinancieel() {
    const vlag = (await Opslag.haal("instellingen", "voorbeeld")) || { id: "voorbeeld" };
    if (vlag.financieel) return false;
    let zaad = 7;
    const toeval = function () { zaad = (zaad * 9301 + 49297) % 233280; return zaad / 233280; };
    const tussen = function (a, b) { return a + toeval() * (b - a); };
    const KLANTEN = ["Familie Mulder", "Familie de Boer", "Familie Smit", "Familie Bos", "Familie Meijer", "Familie de Groot",
      "Familie Hoekstra", "Familie Veenstra", "Familie Kuipers", "Familie Postma", "Familie Wiersma", "Familie Brouwer",
      "VvE De Linde (fictief)", "Kantoor Noordzijde (fictief)", "Familie Zijlstra", "Familie van Dijk"];
    const PLAATSEN = ["Groningen", "Haren", "Hoogezand", "Leek", "Zuidhorn", "Winsum", "Bedum", "Ten Boer"];
    const vandaag = new Date();
    const lijst = [];
    // 2025: ongeveer 1 per maand; 2026: 2 tot 4 per maand tot vandaag
    for (let jaar = vandaag.getFullYear() - 1; jaar <= vandaag.getFullYear(); jaar++) {
      for (let maand = 0; maand < 12; maand++) {
        const aantal = jaar < vandaag.getFullYear() ? 1 + Math.floor(toeval() * 2) : 2 + Math.floor(toeval() * 3);
        for (let i = 0; i < aantal; i++) {
          const d = new Date(jaar, maand, 2 + Math.floor(toeval() * 25));
          if (d.getDay() === 0) d.setDate(d.getDate() + 1);
          if (d.getDay() === 6) d.setDate(d.getDate() + 2);
          if (d >= vandaag) continue;
          lijst.push(d);
        }
      }
    }
    lijst.sort(function (a, b) { return a - b; });
    for (let n = 0; n < lijst.length; n++) {
      const d = lijst[n];
      const datum = iso(d);
      const dagenGeleden = (vandaag - d) / 86400000;
      const m2 = Math.round(tussen(2.5, 16) * 100) / 100;
      const glas = toeval() < 0.7 ? "HR++" : toeval() < 0.6 ? "HR+++" : "Triple glas";
      const prijsGlas = { "HR++": 95, "HR+++": 120, "Triple glas": 140 }[glas];
      const personen = toeval() < 0.6 ? 2 : 3;
      const uren = Math.round(tussen(4, 16) * 2) / 2;
      const regels = [
        { soort: "glas", omschrijving: glas + " glas", aantal: m2, eenheid: "m²", prijs: prijsGlas, werkelijk: null, btw: 21 },
        { soort: "materiaal", omschrijving: "Glaslatten en kit", aantal: Math.round(m2 * 4), eenheid: "m", prijs: 9, werkelijk: null, btw: 21 },
        { soort: "arbeid", omschrijving: "Arbeid: " + personen + " personen × " + String(uren).replace(".", ",") + " uur", aantal: personen * uren, eenheid: "uur", prijs: 45, werkelijk: null, btw: 21 },
        { soort: "vervoer", omschrijving: "Vervoer bus – heen en terug", aantal: 30, eenheid: "km", prijs: 0.35, werkelijk: null, btw: 21 }
      ];
      if (toeval() < 0.15) regels.push({ soort: "huur", omschrijving: "Hoogwerker", aantal: 1, eenheid: "dag", prijs: 275, werkelijk: null, btw: 21 });
      // Soms viel de inkoop hoger of lager uit
      if (toeval() < 0.4) regels[0].werkelijk = Math.round(m2 * prijsGlas * tussen(0.9, 1.25) * 100) / 100;
      const marge = [25, 30, 35, 40][Math.floor(toeval() * 4)];
      const calc = { regels: regels, marge: marge, factuurnummer: "", factuurdatum: "", notitie: "Fictief voorbeeld", gefactureerd_excl: null };
      const t = calcTotalen(calc);
      if (dagenGeleden > 10) {
        // Meestal rond de verkoopprijs gefactureerd; af en toe korting (een paar keer met verlies)
        const factor = toeval() < 0.08 ? tussen(0.62, 0.75) : tussen(0.93, 1.03);
        calc.gefactureerd_excl = Math.round(t.verkoopExcl * factor / 5) * 5;
        const fd = new Date(d); fd.setDate(fd.getDate() + 3 + Math.floor(toeval() * 7));
        calc.factuurdatum = iso(fd > vandaag ? vandaag : fd);
        calc.factuurnummer = "F" + d.getFullYear() + "-" + String(n + 1).padStart(4, "0");
      }
      const t2 = calcTotalen(calc);
      calc.totalen = { kost: Math.round(t2.kostWerkelijk * 100) / 100, verkoop_excl: Math.round(t2.verkoopExcl * 100) / 100,
                       verkoop_incl: Math.round(t2.verkoopIncl * 100) / 100, winst: t2.winstNetto === null ? null : Math.round(t2.winstNetto * 100) / 100 };
      calc.bijgewerkt_op = new Date().toISOString();
      const klant = KLANTEN[Math.floor(toeval() * KLANTEN.length)];
      await Opslag.bewaar("klussen", {
        datum: datum, start: "07:30", eind: uren > 8 ? "16:30" : "12:00", klant: klant,
        adres: "Voorbeeldstraat " + (1 + Math.floor(toeval() * 120)) + ", " + PLAATSEN[Math.floor(toeval() * PLAATSEN.length)],
        werkzaamheden: m2.toString().replace(".", ",") + " m² " + glas + " plaatsen (fictief voorbeeld)",
        medewerkers: [], soort_werk: [glas === "Triple glas" ? "Triple glas plaatsen" : glas + " glas plaatsen"], soort_glas: glas,
        status: "klaar", voorbeeld: true, voorbeeld_financieel: true, calculatie: calc
      });
    }
    vlag.financieel = true;
    await Opslag.bewaar("instellingen", vlag);
    return true;
  }

  return {
    zorgVoorFinancieel: zorgVoorFinancieel,
    zorgVoorOpname: zorgVoorOpname,
    zorgVoorMedewerkers: zorgVoorMedewerkers,
    herstelMedewerkers: herstelMedewerkers,
    zorgVoorPlanning: zorgVoorPlanning,
    zorgVoorMaterieel: zorgVoorMaterieel,
    // Alles wat een pagina met werkopdrachten nodig heeft
    zorgVoorAlles: async function () {
      await zorgVoorMedewerkers();
      await zorgVoorPlanning();
      await zorgVoorMaterieel();
      // Fase 4: voertuigdetails aanvullen (ook in eerder geladen gegevens)
      const vlag = (await Opslag.haal("instellingen", "voorbeeld")) || { id: "voorbeeld" };
      if (!vlag.voertuigdetails) {
        const mensen = await Opslag.alle("medewerkers");
        const idVan = function (n) { const m = mensen.find(function (x) { return x.voornaam + " " + x.achternaam === n; }); return m ? m.id : ""; };
        // naam: [bouwjaar, km, brandstof, apk (dagen vanaf nu), verzekering (dagen), km laatste onderhoud, interval km, volgend onderhoud (dagen), verantwoordelijke]
        const DETAILS = {
          "Bus 1": [2021, 84200, "Diesel", 210, 160, 80000, 30000, 120, "Peter de Vries"],
          "Bus 2": [2020, 112500, "Diesel", 95, 160, 90000, 30000, 60, "Bert Huizinga"],
          "Bus 3": [2019, 143800, "Diesel", 20, 160, 120000, 30000, 75, "Wim Wierenga"],
          "Bus 4": [2018, 178900, "Diesel", 140, 160, 150000, 30000, 40, "Gerrit Meijer"],
          "Bus 5": [2022, 61300, "Diesel", 300, 160, 60000, 30000, 200, "Thomas Visser"],
          "Bus 6": [2016, 231000, "Diesel", 50, 160, 210000, 30000, 10, "Sven Hofstra"],
          "Bakwagen": [2017, 198400, "Diesel", 180, 25, 170000, 40000, 90, "Bert Huizinga"],
          "Opnamewagen 1": [2023, 28400, "Elektrisch", 700, 160, 20000, 30000, 250, "Henk Dijkstra"],
          "Opnamewagen 2": [2021, 54800, "Benzine", 260, 160, 40000, 20000, 150, "Femke Bosma"],
          "Aanhanger 1 (glasbok)": [2019, "", "Geen (aanhanger)", 120, 160, "", "", 180, "Peter de Vries"],
          "Aanhanger 2 (open)": [2015, "", "Geen (aanhanger)", null, 160, "", "", 300, "Monique Veenstra"]
        };
        const voertuigen = await Opslag.alle("voertuigen");
        for (const v of voertuigen) {
          const d = DETAILS[v.naam];
          if (!v.voorbeeld || !d || v.bouwjaar) continue;
          Object.assign(v, {
            bouwjaar: d[0], kilometerstand: d[1], brandstof: d[2],
            apk_tot: d[3] === null ? "" : dag(d[3]),
            verzekeraar: "Voorbeeld Verzekeringen", polisnummer: "POL-" + v.kenteken.replace(/-/g, ""), verzekering_tot: dag(d[4]),
            km_laatste_onderhoud: d[5], onderhoud_interval_km: d[6], datum_laatste_onderhoud: dag(-200),
            volgende_onderhoud: dag(d[7]), verantwoordelijke: idVan(d[8])
          });
          await Opslag.bewaar("voertuigen", v);
        }
        vlag.voertuigdetails = true;
        await Opslag.bewaar("instellingen", vlag);
      }
      // Stap Z: emissieklasse en datum eerste toelating van de voorbeeldvoertuigen (fictief)
      if (!vlag.zonedetails) {
        const ZD = {
          "Bus 1": ["euro6", "2021-03-15"], "Bus 2": ["euro6", "2020-06-02"], "Bus 3": ["euro5", "2015-04-20", 2015],
          "Bus 4": ["ze", "2023-09-01", 2023, "Elektrisch"], "Bus 5": ["euro6", "2025-02-10", 2025], "Bus 6": ["euro5", "2016-03-08"],
          "Bakwagen": ["euro6", "2017-06-12"], "Opnamewagen 1": ["ze", "2023-05-01"], "Opnamewagen 2": ["euro6", "2021-07-01"]
        };
        for (const v of await Opslag.alle("voertuigen")) {
          const d = ZD[v.naam];
          if (!v.voorbeeld || !d || v.emissieklasse) continue;
          v.emissieklasse = d[0]; v.datum_eerste_toelating = d[1];
          if (d[2]) v.bouwjaar = d[2];
          if (d[3]) v.brandstof = d[3];
          await Opslag.bewaar("voertuigen", v);
        }
        vlag.zonedetails = true;
        await Opslag.bewaar("instellingen", vlag);
      }

      // Fase 4: gereedschapdetails aanvullen (ook in eerder geladen gegevens)
      const vlag2 = (await Opslag.haal("instellingen", "voorbeeld")) || { id: "voorbeeld" };
      if (!vlag2.gereedschapdetails) {
        const mensen = await Opslag.alle("medewerkers");
        const idVan = function (n) { const m = mensen.find(function (x) { return x.voornaam + " " + x.achternaam === n; }); return m ? m.id : ""; };
        // Afwijkende keuringen om meldingen te kunnen testen (dagen vanaf vandaag)
        const KEURING = { "Glaszuiger 2": 12, "Glaslift 1": -5, "Ladder 1 (3-delig)": 25, "Rolsteiger 2": 18 };
        const UITGIFTE = { "Accuboormachine 1": "Peter de Vries", "Accuboormachine 2": "Bert Huizinga", "Kitpistool-set 1": "Jan Bakker" };
        const lijst = await Opslag.alle("gereedschap");
        let i = 0;
        for (const g of lijst) {
          i++;
          if (!g.voorbeeld || g.serienummer) continue;
          const keuring = KEURING[g.naam] !== undefined ? KEURING[g.naam] : 60 + (i * 23) % 280;
          Object.assign(g, {
            serienummer: "SN-" + String(10400 + i * 37),
            type: g.type || "",
            aankoopdatum: dag(-(400 + i * 41)),
            locatie: UITGIFTE[g.naam] ? "Bus van medewerker" : "Magazijn",
            verantwoordelijke: idVan("Monique Veenstra"),
            uitgegeven_aan: UITGIFTE[g.naam] ? idVan(UITGIFTE[g.naam]) : "",
            laatste_keuring: dag(keuring - 365),
            volgende_keuring: dag(keuring),
            laatste_onderhoud: dag(-(90 + i * 5)),
            volgende_onderhoud: dag(120 + (i * 17) % 200)
          });
          await Opslag.bewaar("gereedschap", g);
        }
        vlag2.gereedschapdetails = true;
        await Opslag.bewaar("instellingen", vlag2);
      }

      // Fase 4: de minihijskraan vraagt een certificaat (ook in eerder geladen gegevens)
      const lijst = await Opslag.alle("gereedschap");
      for (const g of lijst) {
        if (g.voorbeeld && g.naam === "Minihijskraan" && g.vereist === undefined) {
          g.vereist = "minihijskraan";
          await Opslag.bewaar("gereedschap", g);
        }
      }
    }
  };
})();

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
          status: "gepland", voorbeeld: true
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

  return { zorgVoorMedewerkers: zorgVoorMedewerkers, herstelMedewerkers: herstelMedewerkers, zorgVoorPlanning: zorgVoorPlanning };
})();

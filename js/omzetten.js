/* =========================================================
   Glasmeesters Planner – opname omzetten naar werkopdracht
   Met één knop wordt van een opname een werkopdracht gemaakt.
   Overgenomen worden: klant, adres, werkzaamheden, glas,
   materialen (glas, roosters, glaslatten, kit), gereedschap
   dat het bedrijf zelf heeft, en wat er nog geregeld moet
   worden (kraan, hoogwerker enz.). De opdracht krijgt de
   status Concept: de planner kiest daarna datum en ploeg.
   ========================================================= */

const Omzetten = (function () {

  // Welk werk hoort bij welk nieuw glas
  const WERK_VOOR_GLAS = {
    "HR++": "HR++ glas plaatsen", "HR+++": "HR+++ glas plaatsen", "Triple glas": "Triple glas plaatsen",
    "Gelaagd glas": "Gelaagd glas plaatsen", "Gehard glas": "Gehard glas plaatsen"
  };

  // Materieel uit de opname dat het bedrijf zelf heeft (gereedschapslijst)
  const EIGEN_GEREEDSCHAP = {
    glaszuigers:   { categorie: "Glaszuigers", aantal: 2 },
    glaslift:      { categorie: "Glasliften",  aantal: 1 },
    glasbok:       { categorie: "Glasbokken",  aantal: 1 },
    ladder:        { categorie: "Ladders",     aantal: 1 },
    rolsteiger:    { categorie: "Steigers",    aantal: 1, naam: "rolsteiger" },
    minihijskraan: { vereist: "minihijskraan", aantal: 1 }
  };

  function getal(x, cijfers) {
    return Number(x).toLocaleString("nl-NL", { minimumFractionDigits: cijfers, maximumFractionDigits: cijfers });
  }
  function vandaag() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function meestVoorkomend(lijst) {
    const tel = {};
    lijst.filter(Boolean).forEach(function (x) { tel[x] = (tel[x] || 0) + 1; });
    return Object.keys(tel).sort(function (a, b) { return tel[b] - tel[a]; })[0] || "";
  }
  function omtrekMeter(r) {
    return 2 * ((Number(r.breedte) || 0) + (Number(r.hoogte) || 0)) * (Number(r.aantal_ruiten) || 1) / 1000;
  }

  // Een korte regel per raam voor de omschrijving van de werkzaamheden
  function raamTekst(r) {
    const plaats = [r.gevel, r.verdieping].filter(Boolean).join(", ").toLowerCase();
    const delen = [];
    if (r.breedte && r.hoogte) delen.push(r.breedte + " × " + r.hoogte + " mm");
    const n = Number(r.aantal_ruiten) || 1;
    if (n > 1) delen.push(n + " ruiten");
    if (r.glas_nieuw) delen.push(r.glas_nieuw);
    if (r.glaslatten_vervangen === "Ja") delen.push("glaslatten vervangen");
    const rs = roosterSoort(r);
    if (rs && rs !== "Geen") delen.push(rs.toLowerCase() + (r.rooster_lengte ? " " + r.rooster_lengte + " mm" : "") + (r.rooster_aantal > 1 ? " × " + r.rooster_aantal : ""));
    if (r.vorm && r.vorm !== "Rechthoekig") delen.push("vorm: " + r.vorm.toLowerCase());
    return "• Raam " + r.nummer + (r.ruimte ? " " + r.ruimte : "") + (plaats ? " (" + plaats + ")" : "") + ": " +
           delen.join(" · ") + (r.opmerkingen ? " – " + r.opmerkingen : "");
  }

  // Gereedschap kiezen dat beschikbaar is en waarvan de keuring niet verlopen is
  function kiesGereedschap(materieel, gereedschap) {
    const gekozen = [], nietGevonden = [];
    materieel.filter(function (m) { return m.nodig && EIGEN_GEREEDSCHAP[m.code]; }).forEach(function (m) {
      const regel = EIGEN_GEREEDSCHAP[m.code];
      const kandidaten = gereedschap.filter(function (g) {
        if (gekozen.indexOf(g.id) !== -1) return false;
        if (g.status && g.status !== "beschikbaar") return false;
        if (gereedschapMeldingen(g, vandaag()).some(function (x) { return x.niveau === "rood"; })) return false;
        if (regel.vereist) return g.vereist === regel.vereist;
        if (g.categorie !== regel.categorie) return false;
        return !regel.naam || String(g.naam).toLowerCase().indexOf(regel.naam) !== -1;
      }).sort(function (a, b) { return String(a.naam).localeCompare(String(b.naam), "nl", { numeric: true }); });
      const stuks = kandidaten.slice(0, regel.aantal);
      stuks.forEach(function (g) { gekozen.push(g.id); });
      if (stuks.length < regel.aantal) nietGevonden.push(m.naam);
    });
    return { gekozen: gekozen, nietGevonden: nietGevonden };
  }

  // De werkopdracht samenstellen (nog niet bewaren)
  async function stelSamen(o) {
    await laadNijBegun();
    const ramen = (o.ramen || []).slice().sort(function (a, b) { return String(a.nummer).localeCompare(String(b.nummer), "nl", { numeric: true }); });
    const materieel = opnameMaterieel(o);
    const gereedschap = await Opslag.alle("gereedschap");
    const medewerkers = await Opslag.alle("medewerkers");
    const opnemer = medewerkers.find(function (m) { return m.id === o.opnemer; });

    // Soort werk
    const werk = [];
    const voegToe = function (w) { if (w && werk.indexOf(w) === -1) werk.push(w); };
    ramen.forEach(function (r) {
      if (r.glas_huidig === "Enkel glas") voegToe("Enkel glas vervangen");
      voegToe(WERK_VOOR_GLAS[r.glas_nieuw] || (r.glas_nieuw ? "Glas vervangen in bestaande kozijnen" : ""));
      if (r.glaslatten_vervangen === "Ja") voegToe("Glaslatten vervangen");
      if (r.kitsoort) voegToe("Kitwerkzaamheden");
      const rs = roosterSoort(r);
      if (rs && rs !== "Geen") voegToe("Ventilatieroosters plaatsen");
    });

    // Materialen: glas per soort, roosters, glaslatten, kit
    const materialen = [];
    const glas = {};
    ramen.forEach(function (r) {
      if (!r.glas_nieuw) return;
      const g = glas[r.glas_nieuw] = glas[r.glas_nieuw] || { m2: 0, ruiten: 0, ramen: [] };
      g.m2 += raamOppervlakte(r); g.ruiten += Number(r.aantal_ruiten) || 1; g.ramen.push(r.nummer);
    });
    Object.keys(glas).forEach(function (soort) {
      const g = glas[soort];
      materialen.push({ omschrijving: soort + (/glas/i.test(soort) ? "" : " glas") + " – " + g.ruiten + " ruit" + (g.ruiten === 1 ? "" : "en") + " (raam " + g.ramen.join(", ") + ")",
                        aantal: getal(g.m2, 2), eenheid: "m²" });
    });
    const roosters = {};
    ramen.forEach(function (r) {
      const rs = roosterSoort(r);
      if (!rs || rs === "Geen") return;
      const sleutel = [rs, r.rooster_kleur, r.rooster_plaatsing].join("|");
      const g = roosters[sleutel] = roosters[sleutel] || { soort: rs, kleur: r.rooster_kleur, plaatsing: r.rooster_plaatsing, stuks: 0, mm: 0, ramen: [] };
      const n = Number(r.rooster_aantal) || 1;
      g.stuks += n; g.mm += (Number(r.rooster_lengte) || 0) * n; g.ramen.push(r.nummer);
    });
    Object.keys(roosters).forEach(function (k) {
      const g = roosters[k];
      materialen.push({ omschrijving: g.soort + [g.kleur, g.plaatsing ? g.plaatsing.toLowerCase() : ""].filter(Boolean).map(function (x) { return ", " + x; }).join("") +
                        (g.mm ? " – totaal " + getal(g.mm / 1000, 2) + " m" : "") + " (raam " + g.ramen.join(", ") + ")",
                        aantal: String(g.stuks), eenheid: "stuks" });
    });
    const latten = ramen.filter(function (r) { return r.glaslatten_vervangen === "Ja"; });
    if (latten.length) {
      const soort = meestVoorkomend(latten.map(function (r) { return r.glaslat_soort; }));
      materialen.push({ omschrijving: "Glaslatten" + (soort ? " (" + soort.toLowerCase() + ")" : "") + " – omtrek ramen " + latten.map(function (r) { return r.nummer; }).join(", "),
                        aantal: getal(latten.reduce(function (t, r) { return t + omtrekMeter(r); }, 0), 1), eenheid: "m" });
    }
    const kit = {};
    ramen.forEach(function (r) { if (r.kitsoort) kit[r.kitsoort] = (kit[r.kitsoort] || 0) + omtrekMeter(r); });
    Object.keys(kit).forEach(function (soort) {
      materialen.push({ omschrijving: "Kit: " + soort + " (omtrek)", aantal: getal(kit[soort], 1), eenheid: "m" });
    });

    // Gereedschap en wat nog geregeld moet worden
    const keuze = kiesGereedschap(materieel, gereedschap);
    const regelen = materieel.filter(function (m) { return m.nodig && (!EIGEN_GEREEDSCHAP[m.code] || keuze.nietGevonden.indexOf(m.naam) !== -1); });
    const bevoegdheden = materieel.filter(function (m) { return m.nodig && m.bevoegdheid; }).map(function (m) { return m.bevoegdheid; });

    // Omschrijving
    const omschrijving = ["Volgens opname " + o.nummer + ":"].concat(ramen.map(raamTekst)).join("\n");

    // Bijzonderheden
    const bijz = [];
    bijz.push("Gemaakt vanuit opname " + o.nummer + (opnemer ? " van " + opnemer.voornaam + " " + opnemer.achternaam : "") +
              (o.datum ? " (" + new Date(o.datum + "T12:00").toLocaleDateString("nl-NL") + ")" : "") + ".");
    if (o.nij_begun === "Ja") {
      bijz.push("NIJ BEGUN: " + (o.nb_regeling || "subsidie, soort nog niet bekend") +
                ". Noteer de uitvoerdatum per maatregel; die moet op de factuur.");
    }
    if (regelen.length) {
      bijz.push("Nog te regelen: " + regelen.map(function (m) {
        return m.naam + (m.toelichting ? " (" + m.toelichting + ")" : "") + (keuze.nietGevonden.indexOf(m.naam) !== -1 ? " – niet vrij in de gereedschapslijst" : "");
      }).join("; ") + ".");
    }
    if (o.personen || o.duur_uren) {
      bijz.push("Inschatting opnemer: " + [o.personen ? o.personen + " personen" : "", o.duur_uren ? getal(o.duur_uren, 1).replace(",0", "") + " uur" : ""].filter(Boolean).join(", ") + ".");
    }
    if (o.bereikbaarheid) bijz.push("Bereikbaarheid: " + o.bereikbaarheid);
    if (o.opmerkingen) bijz.push("Opmerkingen opname: " + o.opmerkingen);

    return {
      klant: o.klant, telefoon_klant: o.telefoon || "", email_klant: o.email || "", adres: o.adres || "",
      datum: "", start: "", eind: "", medewerkers: [],
      soort_werk: werk, soort_glas: meestVoorkomend(ramen.map(function (r) { return r.glas_nieuw; })),
      werkzaamheden: omschrijving, bijzonderheden: bijz.join("\n"),
      voertuig: "", aanhanger: "", gereedschap: keuze.gekozen, materialen: materialen,
      vereiste_bevoegdheden: bevoegdheden.filter(function (c, i) { return bevoegdheden.indexOf(c) === i; }),
      status: "concept",
      opname: o.id, opname_nummer: o.nummer,
      nij_begun: o.nij_begun === "Ja" ? { regeling: o.nb_regeling || "" } : null
    };
  }

  // Werkopdracht maken, bewaren en de opname bijwerken
  async function maakWerkopdracht(o, rol) {
    const klus = await stelSamen(o);
    klus.nummer = await nieuwOpdrachtNummer();
    const bewaard = await Opslag.bewaar("klussen", klus);
    const opgeslagen = (await Opslag.haal("opnames", o.id)) || o;
    opgeslagen.werkopdracht = bewaard.id;
    opgeslagen.werkopdracht_nummer = bewaard.nummer;
    opgeslagen.status = "omgezet";
    await Opslag.bewaar("opnames", opgeslagen);
    await Opslag.bewaar("logboek", {
      wanneer: new Date().toISOString(), rol: rol || "", actie: "Opname omgezet",
      details: "Opname " + o.nummer + " (" + o.klant + ") → werkopdracht " + bewaard.nummer
    });
    return bewaard;
  }

  return { stelSamen: stelSamen, maakWerkopdracht: maakWerkopdracht };
})();

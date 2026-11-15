/* =========================================================
   Glasmeesters Planner – opnameformulier (PDF)
   Zet een opname netjes op A4: klant, Nij Begun, overzicht,
   per raam de schets, de gegevens en de foto's.
   Met "PDF maken / afdrukken" bewaar je het als PDF.
   ========================================================= */

(async function () {
  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function m2(x) { return x.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m²"; }
  function meter(mm) { return (mm / 1000).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m"; }
  function datum(d) { return d ? new Date(d + "T12:00").toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : ""; }
  function stop(tekst) { $("blad").innerHTML = '<p class="fout">' + tekst + '</p>'; $("afdrukken").hidden = true; }

  $("terug").addEventListener("click", function () { if (history.length > 1) history.back(); else location.href = "opnames.html"; });
  $("afdrukken").addEventListener("click", function () { window.print(); });

  const id = new URLSearchParams(location.search).get("id");
  const o = id ? await Opslag.haal("opnames", id) : null;
  if (!o) { stop("Deze opname is niet gevonden op dit apparaat."); return; }

  // ----- Wie mag dit zien? (testmodus: rol uit "Bekijk als") -----
  let rol = "beheerder";
  try { rol = localStorage.getItem("gm-rol") || "beheerder"; } catch (e) {}
  if (rol === "medewerker") {
    // Een medewerker ziet alleen de opname van een opdracht waarop hij is ingepland
    let ikBen = null;
    try { ikBen = localStorage.getItem("gm-ik-ben"); } catch (e) {}
    const mensen = await Opslag.alle("medewerkers");
    if (!mensen.some(function (m) { return m.id === ikBen; })) {
      const jan = mensen.find(function (m) { return m.voornaam === "Jan" && m.achternaam === "Bakker"; });
      ikBen = jan ? jan.id : null;
    }
    const klussen = await Opslag.alle("klussen");
    if (!klussen.some(function (k) { return k.opname === o.id && (k.medewerkers || []).indexOf(ikBen) !== -1; })) {
      stop("Je kunt alleen het opnameformulier zien van een opdracht waarop je bent ingepland."); return;
    }
  } else if (["beheerder", "planner", "opnemer", "administratie"].indexOf(rol) === -1) {
    stop("Deze rol mag opnameformulieren niet bekijken."); return;
  }

  await laadOpnameInstellingen();
  await laadNijBegun();
  const medewerkers = await Opslag.alle("medewerkers");
  const bestanden = (await Opslag.alle("bestanden")).filter(function (b) { return b.opname === o.id && b.data && String(b.type || "").indexOf("image") === 0; })
    .sort(function (a, b) { return (a.aangemaakt_op || "").localeCompare(b.aangemaakt_op || ""); });
  const fotoUrl = {};
  bestanden.forEach(function (b) { fotoUrl[b.id] = URL.createObjectURL(b.data); });

  const opnemer = medewerkers.find(function (m) { return m.id === o.opnemer; });
  const ramen = (o.ramen || []).slice().sort(function (a, b) { return String(a.nummer).localeCompare(String(b.nummer), "nl", { numeric: true }); });
  const opp = ramen.reduce(function (t, r) { return t + raamOppervlakte(r); }, 0);
  const reken = ramen.reduce(function (t, r) { return t + raamRekenOppervlakte(r); }, 0);
  const ruiten = ramen.reduce(function (t, r) { return t + (Number(r.aantal_ruiten) || 1); }, 0);
  const materieel = opnameMaterieel(o).filter(function (m) { return m.nodig; });
  const nb = o.nij_begun === "Ja";

  function rij(label, waarde) { return waarde === "" || waarde == null ? "" : '<tr><th>' + label + '</th><td>' + esc(waarde) + '</td></tr>'; }
  function fotos(lijst) {
    return lijst.length ? '<div class="fotos">' + lijst.map(function (b) {
      return '<figure><img src="' + fotoUrl[b.id] + '" alt=""><figcaption>' + esc(b.gevel || "") + '</figcaption></figure>';
    }).join("") + '</div>' : "";
  }

  // ----- Kop en klant -----
  let html =
    '<header class="kop">' +
      '<div class="logo"><span class="logo-glas">GLAS</span><span class="logo-meesters">MEESTERS</span></div>' +
      '<div class="kop-titel"><h1>Opnameformulier</h1><div>' + esc(o.nummer) + (o.datum ? " · " + datum(o.datum) : "") + '</div></div>' +
    '</header>' +
    '<section class="twee">' +
      '<div><h2>Klant</h2><table class="gegevens">' +
        rij("Naam", o.klant) + rij("Adres", o.adres) + rij("Telefoon", o.telefoon) + rij("E-mail", o.email) +
      '</table></div>' +
      '<div><h2>Project</h2><table class="gegevens">' +
        rij("Opnemer", opnemer ? opnemer.voornaam + " " + opnemer.achternaam : "") + rij("Status", opnameStatusNaam(o.status)) +
        rij("Type gebouw", o.gebouwtype) + rij("Bouwjaar", o.bouwjaar) +
        rij("Werkopdracht", o.werkopdracht_nummer || "") +
      '</table></div>' +
    '</section>';

  // ----- Nij Begun -----
  if (nb) {
    const lijst = nbMaatregelen(o);
    html += '<section class="nb"><h2>Nij Begun – isolatiesubsidie</h2><table class="gegevens">' +
      rij("Subsidie", o.nb_regeling) + rij("Stand van zaken", nbStatusNaam(o.nb_status)) +
      rij("Isolatieplan", o.nb_isolatieplan) + rij("Dossiernummer SNN", o.nb_dossier) + '</table>' +
      (lijst.length ? '<table class="lijst"><thead><tr><th>Maatregelcode</th><th>Maatregel</th><th>Waarde</th><th>Aantal</th><th>Ramen</th></tr></thead><tbody>' +
        lijst.map(function (g) {
          return '<tr><td>' + esc(g.code || "– ontbreekt –") + '</td><td>' + esc(g.omschrijving) + '</td><td>' + esc(g.waarde || "–") + '</td><td>' +
                 (g.eenheid === "m²" ? m2(g.hoeveel) : g.hoeveel + (g.hoeveel === 1 ? " stuk" : " stuks") + (g.mm ? " (" + meter(g.mm) + ")" : "")) + '</td><td>' + esc(g.ramen.join(", ")) + '</td></tr>';
        }).join("") + '</tbody></table>' : "") +
      '</section>';
  }

  // ----- Overzicht van de ramen -----
  html += '<section><h2>Overzicht ramen</h2>' +
    '<p class="samen"><strong>' + ramen.length + '</strong> ramen · <strong>' + ruiten + '</strong> ruiten · werkelijk <strong>' + m2(opp) +
    '</strong> · te berekenen <strong>' + m2(reken) + '</strong> <span class="zacht">(minimaal ' + MINIMUM_M2_PER_RUIT.toLocaleString("nl-NL") + ' m² per ruit)</span></p>' +
    (ramen.length ? '<table class="lijst"><thead><tr><th>Nr</th><th>Ruimte</th><th>Plaats</th><th>B × H (mm)</th><th>Ruiten</th><th>m²</th><th>Nieuw glas</th><th>Rooster</th></tr></thead><tbody>' +
      ramen.map(function (r) {
        const rs = roosterSoort(r);
        return '<tr><td>' + esc(r.nummer) + '</td><td>' + esc(r.ruimte) + '</td><td>' + esc([r.gevel, r.verdieping].filter(Boolean).join(", ")) +
               '</td><td>' + esc(r.breedte && r.hoogte ? r.breedte + " × " + r.hoogte : "") + '</td><td>' + (Number(r.aantal_ruiten) || 1) +
               '</td><td>' + m2(raamOppervlakte(r)).replace(" m²", "") + '</td><td>' + esc(r.glas_nieuw) + '</td><td>' +
               esc(rs && rs !== "Geen" ? rs.replace(" rooster", "") + (r.rooster_lengte ? " " + r.rooster_lengte + " mm" : "") : "–") + '</td></tr>';
      }).join("") + '</tbody></table>' : '<p class="zacht">Nog geen ramen.</p>') +
    '</section>';

  // ----- Materieel, roosters en uitvoering -----
  const roosters = {};
  ramen.forEach(function (r) {
    const rs = roosterSoort(r);
    if (!rs || rs === "Geen") return;
    const k = [rs, r.rooster_kleur, r.rooster_plaatsing].join("|");
    const g = roosters[k] = roosters[k] || { soort: rs, kleur: r.rooster_kleur, plaatsing: r.rooster_plaatsing, stuks: 0, mm: 0 };
    const n = Number(r.rooster_aantal) || 1; g.stuks += n; g.mm += (Number(r.rooster_lengte) || 0) * n;
  });
  const rList = Object.keys(roosters).map(function (k) { return roosters[k]; });
  html += '<section class="twee">' +
    '<div><h2>Materieel</h2>' + (materieel.length ? '<ul class="opsom">' + materieel.map(function (m) {
      return '<li><strong>' + esc(m.naam) + '</strong>' + (m.ramen.length ? ' <span class="zacht">(raam ' + esc(m.ramen.join(", ")) + ')</span>' : "") +
             (m.toelichting ? '<br>' + esc(m.toelichting) : "") + '</li>';
    }).join("") + '</ul>' : '<p class="zacht">Geen bijzonder materieel.</p>') +
    (rList.length ? '<h2>Ventilatieroosters</h2><ul class="opsom">' + rList.map(function (g) {
      return '<li><strong>' + g.stuks + ' × ' + esc(g.soort) + '</strong>' + (g.mm ? ", totaal " + meter(g.mm) : "") +
             (g.kleur || g.plaatsing ? '<br>' + esc([g.kleur, g.plaatsing].filter(Boolean).join(", ")) : "") + '</li>';
    }).join("") + '</ul>' : "") + '</div>' +
    '<div><h2>Uitvoering</h2><table class="gegevens">' +
      rij("Aantal personen", o.personen) + rij("Geschatte duur", o.duur_uren ? o.duur_uren + " uur" : "") +
      rij("Bereikbaarheid", o.bereikbaarheid) + rij("Opmerkingen", o.opmerkingen) +
    '</table></div>' +
  '</section>';

  // ----- Foto's van het gebouw -----
  const gevelFotos = bestanden.filter(function (b) { return !b.raam; });
  if (gevelFotos.length) html += '<section class="breek-voor"><h2>Foto\'s van het gebouw</h2>' + fotos(gevelFotos) + '</section>';

  // ----- Per raam -----
  ramen.forEach(function (r, i) {
    const rs = roosterSoort(r);
    const nbCode = nb && r.glas_nieuw && NB_CODES.glas[r.glas_nieuw] ? NB_CODES.glas[r.glas_nieuw].code : "";
    html += '<section class="raam' + "" + '">' +
      '<h2>Raam ' + esc(r.nummer) + (r.ruimte ? " – " + esc(r.ruimte) : "") + '</h2>' +
      '<div class="raam-inhoud">' +
        '<div class="schets">' + Schets.svg(r.schets, r, { titel: false }) + '</div>' +
        '<table class="gegevens">' +
          rij("Plaats", [r.gevel, r.verdieping].filter(Boolean).join(", ")) +
          rij("Maat (b × h)", r.breedte && r.hoogte ? r.breedte + " × " + r.hoogte + " mm" : "") +
          rij("Aantal ruiten", Number(r.aantal_ruiten) || 1) +
          rij("Oppervlakte", m2(raamOppervlakte(r)) + (raamRekenOppervlakte(r) > raamOppervlakte(r) + 0.0001 ? " (berekend " + m2(raamRekenOppervlakte(r)) + ")" : "")) +
          rij("Vorm", r.vorm && r.vorm !== "Rechthoekig" ? r.vorm + (r.vorm_toelichting ? " – " + r.vorm_toelichting : "") : "") +
          rij("Glasdikte", r.glasdikte ? r.glasdikte + " mm" : "") + rij("Spouw", r.spouwbreedte ? r.spouwbreedte + " mm" : "") +
          rij("Huidig glas", r.glas_huidig) + rij("Nieuw glas", r.glas_nieuw) +
          rij("Maatregelcode Nij Begun", nbCode) +
          rij("Kozijn", r.kozijn) + rij("Beglazing", r.beglazing) + rij("Kit", r.kitsoort) +
          rij("Glaslatten vervangen", r.glaslatten_vervangen) +
          rij("Glaslatten", [r.glaslat_soort, r.glaslat_profiel, r.glaslat_maten].filter(Boolean).join(", ")) +
          rij("Afstandhouder", [r.afstandhouder, r.afstandhouder_kleur].filter(Boolean).join(", ")) +
          rij("Ventilatierooster", rs && rs !== "Geen" ? rs + (r.rooster_lengte ? ", " + r.rooster_lengte + " mm" : "") + (r.rooster_aantal > 1 ? " × " + r.rooster_aantal : "") +
              [r.rooster_kleur, r.rooster_plaatsing].filter(Boolean).map(function (x) { return ", " + x.toLowerCase(); }).join("") : rs === "Geen" ? "Geen" : "") +
          rij("Materieel", (r.materieel || []).map(materieelNaam).join(", ")) +
          rij("Schade", r.schade) + rij("Bereikbaarheid", r.bereikbaarheid) + rij("Opmerkingen", r.opmerkingen) +
        '</table>' +
      '</div>' +
      fotos(bestanden.filter(function (b) { return b.raam === r.id; })) +
    '</section>';
  });

  // ----- Ondertekening -----
  html += '<section class="handtekening">' +
    '<div><div class="lijn"></div>Opgenomen door' + (opnemer ? ": " + esc(opnemer.voornaam + " " + opnemer.achternaam) : "") + '</div>' +
    '<div><div class="lijn"></div>Voor gezien, klant' + (o.klant ? ": " + esc(o.klant) : "") + '</div>' +
  '</section>' +
  '<footer class="voet">Glasmeesters Groningen · glasmeesters.nl · gemaakt op ' + new Date().toLocaleDateString("nl-NL") + '</footer>';

  $("blad").innerHTML = html;
  document.title = "Opname " + o.nummer + " " + (o.klant || "") + " – Glasmeesters";
})();

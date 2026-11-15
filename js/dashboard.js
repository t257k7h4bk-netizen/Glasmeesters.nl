/* =========================================================
   Glasmeesters Planner – dashboard
   Telt alles op basis van de opgeslagen gegevens.
   Kleuren: groen = in orde, oranje = aandacht, rood = actie,
   grijs = (nog) niet actief.

   "Werkdag" = vandaag, of op za/zo de komende maandag.
   ========================================================= */

(function () {
  if (document.body.classList.contains("geen-toegang")) return;
  const rol = huidigeRol();

  // ---------- Datums ----------
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function plus(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function volgendeWerkdag(d) {
    let x = new Date(d);
    while (x.getDay() === 0 || x.getDay() === 6) x = plus(x, 1);
    return x;
  }
  const nu = new Date();
  const vandaag = new Date(nu); vandaag.setHours(0, 0, 0, 0);
  const dag1 = volgendeWerkdag(vandaag);
  const dag2 = volgendeWerkdag(plus(dag1, 1));

  function dagNaam(d) {
    if (iso(d) === iso(vandaag)) return "vandaag";
    if (iso(d) === iso(plus(vandaag, 1))) return "morgen";
    return d.toLocaleDateString("nl-NL", { weekday: "long" });
  }
  function hoofdletter(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  document.getElementById("vandaag").textContent =
    nu.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const uur = nu.getHours();
  document.getElementById("groet").textContent = uur < 12 ? "Goedemorgen" : uur < 18 ? "Goedemiddag" : "Goedenavond";

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- Tegel ----------
  function tegel(t) {
    // t = { label, getal, status: "groen"|"oranje"|"rood"|"grijs", tekst, link }
    const binnen =
      '<div class="label">' + esc(t.label) + '</div>' +
      '<div class="getal">' + esc(t.getal) + '</div>' +
      '<div class="status"><span class="stip ' + t.status + '"></span>' + esc(t.tekst) + '</div>';
    return t.link
      ? '<a class="tegel klikbaar rand-' + t.status + '" href="' + t.link + '">' + binnen + '</a>'
      : '<div class="tegel rand-' + t.status + '">' + binnen + '</div>';
  }

  function regel(soort, tekst, link) {
    return '<a class="actieregel" href="' + (link || "#") + '"><span class="stip ' + soort + '"></span><span>' + tekst + '</span></a>';
  }

  async function start() {
    await Voorbeeld.zorgVoorAlles();
    await Werkopdracht.zorgVoorNummers();
    const medewerkers = await Opslag.alle("medewerkers");
    const klussen = await Opslag.alle("klussen");
    const afwezigheid = await Opslag.alle("afwezigheid");
    const voertuigen = await Opslag.alle("voertuigen");
    const gereedschap = await Opslag.alle("gereedschap");
    await Werkopdracht.laadGegevens();

    const actief = medewerkers.filter(function (m) { return m.actief; });
    const planbaar = actief.filter(function (m) { return groepVanFunctie(m.functie) !== "kantoor"; });
    const naam = function (id) {
      const m = medewerkers.find(function (x) { return x.id === id; });
      return m ? m.voornaam + " " + m.achternaam : "onbekend";
    };
    const voornaam = function (id) {
      const m = medewerkers.find(function (x) { return x.id === id; });
      return m ? m.voornaam : "?";
    };
    const klussenOp = function (d) {
      return klussen.filter(function (k) { return k.datum === iso(d) && k.status !== "geannuleerd"; })
        .sort(function (a, b) { return a.start.localeCompare(b.start); });
    };
    const afwezigOp = function (id, d) {
      return afwezigheid.find(function (a) { return a.medewerker === id && a.van <= iso(d) && iso(d) <= a.tot; });
    };

    // ===== Persoonlijk dashboard voor de rol Medewerker =====
    if (rol === "medewerker") {
      let ikId = null;
      try { ikId = localStorage.getItem("gm-ik-ben"); } catch (e) {}
      const ik = planbaar.find(function (m) { return m.id === ikId; }) ||
                 planbaar.find(function (m) { return m.voornaam + " " + m.achternaam === "Jan Bakker"; }) || planbaar[0];
      if (!ik) return;
      const mijn = function (d) { return klussenOp(d).filter(function (k) { return (k.medewerkers || []).indexOf(ik.id) !== -1; }); };
      document.getElementById("groet").textContent += ", " + ik.voornaam;
      document.getElementById("tegels").innerHTML =
        tegel({ label: "Mijn klussen " + dagNaam(dag1), getal: mijn(dag1).length, status: mijn(dag1).length ? "groen" : "grijs",
                tekst: mijn(dag1).length ? "zie hieronder" : "niets ingepland", link: "planning.html" }) +
        tegel({ label: "Mijn klussen " + dagNaam(dag2), getal: mijn(dag2).length, status: mijn(dag2).length ? "groen" : "grijs",
                tekst: mijn(dag2).length ? "ingepland" : "niets ingepland", link: "planning.html" });

      const certs = (ik.bevoegdheden || []).filter(function (b) { const s = statusBevoegdheid(b); return s === "verlopen" || s === "bijna"; });
      document.getElementById("acties").innerHTML = certs.length
        ? certs.map(function (b) {
            const s = statusBevoegdheid(b);
            return regel(s === "verlopen" ? "rood" : "oranje", esc(bevoegdheidNaam(b.code)) + (s === "verlopen" ? " is verlopen" : " verloopt binnenkort") + " – meld het bij kantoor");
          }).join("")
        : '<p class="leeg-tekst"><span class="stip groen"></span> Alles in orde.</p>';

      toonDagplanning(dag1, mijn(dag1), "Mijn planning " + dagNaam(dag1));
      return;
    }

    // ===== Volledig dashboard =====
    const k1 = klussenOp(dag1), k2 = klussenOp(dag2);
    const ingepland1 = planbaar.filter(function (m) { return k1.some(function (k) { return (k.medewerkers || []).indexOf(m.id) !== -1; }); });
    const afwezig1 = planbaar.filter(function (m) { return afwezigOp(m.id, dag1); });
    const beschikbaar1 = planbaar.length - ingepland1.length - afwezig1.filter(function (m) { return ingepland1.indexOf(m) === -1; }).length;
    const zonderMensen = k1.concat(k2).filter(function (k) { return !(k.medewerkers || []).length; });

    // Certificaten
    const verlopen = [], bijna = [];
    actief.forEach(function (m) {
      (m.bevoegdheden || []).forEach(function (b) {
        const s = statusBevoegdheid(b);
        if (s === "verlopen") verlopen.push({ m: m, b: b });
        if (s === "bijna") bijna.push({ m: m, b: b });
      });
    });

    // Klussen met een niet-actieve of afwezige medewerker (bijv. later ziek gemeld of op non-actief gezet)
    const problemen = [];
    klussen.filter(function (k) { return k.datum && k.datum >= iso(vandaag) && k.status !== "geannuleerd"; }).forEach(function (k) {
      (k.medewerkers || []).forEach(function (id) {
        const m = medewerkers.find(function (x) { return x.id === id; });
        if (!m) problemen.push({ k: k, tekst: "een verwijderde medewerker" });
        else if (!m.actief) problemen.push({ k: k, tekst: naam(id) + " (niet actief)" });
      });
    });

    const zienCerts = rol !== "opnemer";
    let html = "";
    html += tegel({
      label: "Ingepland " + dagNaam(dag1), getal: ingepland1.length + " / " + planbaar.length,
      status: k1.length === 0 ? "grijs" : "groen",
      tekst: beschikbaar1 + " beschikbaar" + (afwezig1.length ? " · " + afwezig1.length + " afwezig" : ""),
      link: "planning.html"
    });
    html += tegel({
      label: "Opdrachten " + dagNaam(dag1), getal: k1.length,
      status: zonderMensen.length ? "rood" : k1.length ? "groen" : "grijs",
      tekst: dagNaam(dag2) + ": " + k2.length + (zonderMensen.length ? " · " + zonderMensen.length + " zonder medewerker" : ""),
      link: "planning.html"
    });
    if (zienCerts) {
      html += tegel({
        label: "Opleidingen en certificaten", getal: verlopen.length + bijna.length,
        status: verlopen.length ? "rood" : bijna.length ? "oranje" : "groen",
        tekst: verlopen.length + " verlopen · " + bijna.length + " binnen 30 dagen",
        link: "medewerkers.html"
      });
    }
    html += tegel({ label: "Medewerkers", getal: actief.length, status: "groen",
                    tekst: planbaar.length + " buitendienst en opnemers", link: "medewerkers.html" });
    // Werkvoorbereiding: opdrachten die nog voorbereid of gepland moeten worden
    const binnen5 = iso(plus(vandaag, 7));
    const voorbereiden = klussen.filter(function (k) { return k.status === "voorbereiden"; });
    const voorbereidenSnel = voorbereiden.filter(function (k) { return k.datum && k.datum <= binnen5; });
    const ongepland = klussen.filter(function (k) { return !k.datum && k.status !== "geannuleerd"; });
    if (rol !== "wagenpark") {
      html += tegel({
        label: "Werkvoorbereiding", getal: voorbereiden.length + ongepland.length,
        status: voorbereidenSnel.length ? "oranje" : (voorbereiden.length + ongepland.length) ? "groen" : "grijs",
        tekst: voorbereiden.length + " voorbereiden · " + ongepland.length + " nog niet gepland",
        link: "werkopdrachten.html"
      });
    }
    const wagens = voertuigen.filter(function (v) { return v.soort !== "aanhanger"; });
    const inGebruik = wagens.filter(function (v) { return k1.some(function (k) { return k.voertuig === v.id; }); }).length;
    const nietInzetbaar = wagens.filter(function (v) { return v.status === "buiten_gebruik"; }).length;
    html += tegel({ label: "Voertuigen " + dagNaam(dag1), getal: inGebruik + " / " + wagens.length,
                    status: nietInzetbaar ? "oranje" : "groen",
                    tekst: "in gebruik" + (nietInzetbaar ? " · " + nietInzetbaar + " niet inzetbaar" : "") });
    // Wagenpark: APK, verzekering en onderhoud
    const zienMaterieel = rol !== "opnemer";
    const vMeldingen = [];
    voertuigen.forEach(function (v) {
      voertuigMeldingen(v).forEach(function (m) { if (m.niveau === "rood" || m.niveau === "oranje") vMeldingen.push({ v: v, m: m }); });
    });
    const vRood = vMeldingen.filter(function (x) { return x.m.niveau === "rood"; }).length;
    const gMeldingen = [];
    gereedschap.forEach(function (g) {
      gereedschapMeldingen(g).forEach(function (m) { if (m.niveau === "rood" || m.niveau === "oranje") gMeldingen.push({ g: g, m: m }); });
    });
    const gKeuring = gMeldingen.filter(function (x) { return x.m.soort === "keuring"; });
    const gDefect = gereedschap.filter(function (g) { return g.status === "defect"; }).length;
    if (zienMaterieel) {
      html += tegel({
        label: "APK, verzekering en onderhoud", getal: vMeldingen.length,
        status: vRood ? "rood" : vMeldingen.length ? "oranje" : "groen",
        tekst: vMeldingen.length ? (vRood ? vRood + " verlopen · " : "") + (vMeldingen.length - vRood) + " binnen 30 dagen" : "alles in orde",
        link: "voertuigen.html"
      });
      html += tegel({
        label: "Gereedschapskeuringen", getal: gKeuring.length,
        status: gMeldingen.some(function (x) { return x.m.niveau === "rood"; }) ? "rood" : gKeuring.length ? "oranje" : "groen",
        tekst: gKeuring.filter(function (x) { return x.m.niveau === "rood"; }).length + " verlopen · " +
               gKeuring.filter(function (x) { return x.m.niveau === "oranje"; }).length + " binnen 30 dagen" + (gDefect ? " · " + gDefect + " defect" : ""),
        link: "gereedschap.html"
      });
    }
    html += tegel({ label: "Glasopnames", getal: "–", status: "grijs", tekst: "volgt in fase 5" });
    document.getElementById("tegels").innerHTML = html;

    // Actie nodig: eerst rood, dan oranje
    let acties = "";
    zonderMensen.forEach(function (k) {
      acties += regel("rood", "Opdracht <strong>" + esc(k.klant) + "</strong> (" + dagNaam(new Date(k.datum + "T00:00:00")) + " " + k.start + ") heeft nog geen medewerker", "werkopdrachten.html?id=" + k.id);
    });
    problemen.forEach(function (p) {
      acties += regel("rood", "Klus <strong>" + esc(p.k.klant) + "</strong> op " + esc(new Date(p.k.datum + "T00:00:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })) + " heeft " + esc(p.tekst), "planning.html");
    });
    // Opdrachten de komende 14 dagen met een blokkade of waarschuwing
    const grens14 = iso(plus(vandaag, 14));
    klussen.filter(function (k) { return Werkopdracht.telt(k) && k.datum >= iso(vandaag) && k.datum <= grens14; })
      .sort(function (a, b) { return (a.datum + a.start).localeCompare(b.datum + b.start); })
      .forEach(function (k) {
        const wanneer = esc(new Date(k.datum + "T00:00:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }));
        Werkopdracht.openBlokkades(k).forEach(function (r) {
          acties += regel("rood", "<strong>" + esc(k.klant) + "</strong> (" + wanneer + "): " + esc(r.tekst.replace(/^LET OP: /, "")), "werkopdrachten.html?id=" + k.id);
        });
        const oranje = Werkopdracht.controleer(k).oranje.filter(function (t) { return t !== "Er is nog geen voertuig gekozen."; });
        if (oranje.length) acties += regel("oranje", "<strong>" + esc(k.klant) + "</strong> (" + wanneer + "): " + esc(oranje[0]) +
          (oranje.length > 1 ? " (+" + (oranje.length - 1) + " meer)" : ""), "werkopdrachten.html?id=" + k.id);
      });

    voorbereidenSnel.forEach(function (k) {
      acties += regel("oranje", "Opdracht <strong>" + esc(k.klant) + "</strong> (" + esc(new Date(k.datum + "T00:00:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })) + ") moet nog voorbereid worden", "werkopdrachten.html?id=" + k.id);
    });
    if (zienCerts) {
      verlopen.forEach(function (x) {
        acties += regel("rood", esc(bevoegdheidNaam(x.b.code)) + " van <strong>" + esc(x.m.voornaam + " " + x.m.achternaam) + "</strong> is verlopen", "medewerkers.html");
      });
      bijna.forEach(function (x) {
        acties += regel("oranje", esc(bevoegdheidNaam(x.b.code)) + " van <strong>" + esc(x.m.voornaam + " " + x.m.achternaam) +
          "</strong> verloopt op " + new Date(x.b.geldig_tot + "T00:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "long" }), "medewerkers.html");
      });
    }
    // Voertuigen en gereedschap
    if (zienMaterieel) {
      vMeldingen.forEach(function (x) {
        acties += regel(x.m.niveau, "<strong>" + esc(x.v.naam) + "</strong>: " + esc(x.m.tekst), "voertuigen.html?id=" + x.v.id);
      });
      gMeldingen.forEach(function (x) {
        acties += regel(x.m.niveau, "<strong>" + esc(x.g.naam) + "</strong>: " + esc(x.m.tekst), "gereedschap.html?id=" + x.g.id);
      });
    }

    // Rood bovenaan, dan oranje; bij een lange lijst eerst de eerste 10
    const items = acties.split('<a class="actieregel"').filter(Boolean).map(function (x) { return '<a class="actieregel"' + x; });
    const rang = function (x) { return x.indexOf("stip rood") !== -1 ? 0 : x.indexOf("stip oranje") !== -1 ? 1 : 2; };
    items.sort(function (a, b) { return rang(a) - rang(b); });
    const MAX = 10;
    let lijstHtml = items.slice(0, MAX).join("");
    if (items.length > MAX) {
      lijstHtml += '<div class="meer" hidden>' + items.slice(MAX).join("") + '</div>' +
        '<button type="button" class="meer-knop">Toon alle ' + items.length + ' meldingen</button>';
    }
    const actiesEl = document.getElementById("acties");
    actiesEl.innerHTML = lijstHtml || '<p class="leeg-tekst"><span class="stip groen"></span> Niets dringends. Alles in orde.</p>';
    const meerKnop = actiesEl.querySelector(".meer-knop");
    if (meerKnop) meerKnop.addEventListener("click", function () {
      actiesEl.querySelector(".meer").hidden = false;
      meerKnop.remove();
    });
    const telRood = items.filter(function (x) { return rang(x) === 0; }).length;
    const telOranje = items.filter(function (x) { return rang(x) === 1; }).length;
    document.querySelector("#acties").previousElementSibling.textContent = "Actie nodig" +
      (items.length ? " (" + telRood + " rood · " + telOranje + " oranje)" : "");

    toonDagplanning(dag1, k1, "Planning " + dagNaam(dag1));

    function toonDagplanning(d, lijst, titel) {
      document.getElementById("planning-titel").textContent = hoofdletter(titel) +
        (dagNaam(d) === "vandaag" || dagNaam(d) === "morgen" ? "" : " " + d.toLocaleDateString("nl-NL", { day: "numeric", month: "long" }));
      document.getElementById("dagplanning").innerHTML = lijst.length
        ? lijst.map(function (k) {
            return '<a class="dagregel" href="werkopdrachten.html?id=' + k.id + '">' +
                     '<span class="tijd">' + k.start + "–" + k.eind + '</span>' +
                     '<span class="wat"><strong>' + esc(k.klant) + '</strong>' +
                       (k.adres ? '<span class="zacht">' + esc(k.adres) + '</span>' : "") +
                       '<span class="zacht">' + ((k.medewerkers || []).length ? esc(k.medewerkers.map(voornaam).join(", ")) : '<span class="rood-tekst">nog niemand ingepland</span>') + '</span>' +
                     '</span>' +
                   '</a>';
          }).join("")
        : '<p class="leeg-tekst"><span class="stip grijs"></span> Geen klussen ingepland.</p>';
    }
  }

  start();
})();

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
    await Voorbeeld.zorgVoorMedewerkers();
    await Voorbeeld.zorgVoorPlanning();
    const medewerkers = await Opslag.alle("medewerkers");
    const klussen = await Opslag.alle("klussen");
    const afwezigheid = await Opslag.alle("afwezigheid");

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
      return klussen.filter(function (k) { return k.datum === iso(d); })
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
    klussen.filter(function (k) { return k.datum >= iso(vandaag); }).forEach(function (k) {
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
    html += tegel({ label: "Voertuigen", getal: "–", status: "grijs", tekst: "volgt in fase 4" });
    html += tegel({ label: "APK en onderhoud", getal: "–", status: "grijs", tekst: "volgt in fase 4" });
    html += tegel({ label: "Gereedschapskeuringen", getal: "–", status: "grijs", tekst: "volgt in fase 4" });
    html += tegel({ label: "Glasopnames", getal: "–", status: "grijs", tekst: "volgt in fase 5" });
    document.getElementById("tegels").innerHTML = html;

    // Actie nodig: eerst rood, dan oranje
    let acties = "";
    zonderMensen.forEach(function (k) {
      acties += regel("rood", "Klus <strong>" + esc(k.klant) + "</strong> (" + dagNaam(new Date(k.datum + "T00:00:00")) + " " + k.start + ") heeft nog geen medewerker", "planning.html");
    });
    problemen.forEach(function (p) {
      acties += regel("rood", "Klus <strong>" + esc(p.k.klant) + "</strong> op " + esc(new Date(p.k.datum + "T00:00:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })) + " heeft " + esc(p.tekst), "planning.html");
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
    document.getElementById("acties").innerHTML = acties || '<p class="leeg-tekst"><span class="stip groen"></span> Niets dringends. Alles in orde.</p>';

    toonDagplanning(dag1, k1, "Planning " + dagNaam(dag1));

    function toonDagplanning(d, lijst, titel) {
      document.getElementById("planning-titel").textContent = hoofdletter(titel) +
        (dagNaam(d) === "vandaag" || dagNaam(d) === "morgen" ? "" : " " + d.toLocaleDateString("nl-NL", { day: "numeric", month: "long" }));
      document.getElementById("dagplanning").innerHTML = lijst.length
        ? lijst.map(function (k) {
            return '<a class="dagregel" href="planning.html">' +
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

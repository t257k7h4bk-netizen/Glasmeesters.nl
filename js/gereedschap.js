/* =========================================================
   Glasmeesters Planner – gereedschapsbeheer
   Bewerken: beheerder en wagenparkbeheerder. Planner en
   opnemer kijken mee.
   ========================================================= */

(function () {
  if (document.body.classList.contains("geen-toegang")) return;

  const rol = huidigeRol();
  const magBewerken = rol === "beheerder" || rol === "wagenpark";
  if (!magBewerken) document.body.classList.add("alleen-lezen-wagenpark");

  let gereedschap = [], medewerkers = [], klussen = [], onderhoud = [];
  let huidige = null, nieuweFoto, filter = "alle";

  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  const vandaag = iso(new Date());
  function naamVan(id) { const m = medewerkers.find(function (x) { return x.id === id; }); return m ? m.voornaam + " " + m.achternaam : ""; }
  const ICOON = { Glaszuigers: "🫧", Glasliften: "🏗️", Glasbokken: "🪟", Glasdragers: "🪟", Accugereedschap: "🔋",
                  Boormachines: "🔩", Slijpmachines: "⚙️", Ladders: "🪜", Steigers: "🧱", Overig: "🧰" };

  // Keuzelijsten
  const catOpties = GEREEDSCHAP_CATEGORIEEN.map(function (c) { return "<option>" + c + "</option>"; }).join("");
  $("g-categorie").innerHTML = catOpties;
  $("categorie").innerHTML += catOpties;
  $("g-status").innerHTML = Object.keys(GEREEDSCHAP_STATUS).map(function (k) { return '<option value="' + k + '">' + GEREEDSCHAP_STATUS[k] + '</option>'; }).join("");
  $("g-vereist").innerHTML = '<option value="">– geen –</option>' + BEVOEGDHEDEN.filter(function (b) { return b.soort === "Certificaat"; })
    .map(function (b) { return '<option value="' + b.code + '">' + b.naam + '</option>'; }).join("");
  $("h-soort").innerHTML = ["Keuring", "Onderhoud", "Reparatie", "Overig"].map(function (s) { return "<option>" + s + "</option>"; }).join("");

  function ergste(mld) {
    if (mld.some(function (m) { return m.niveau === "rood"; })) return "rood";
    if (mld.some(function (m) { return m.niveau === "grijs"; })) return "grijs";
    if (mld.some(function (m) { return m.niveau === "oranje"; })) return "oranje";
    return "groen";
  }

  function vandaagBij(g) {
    return klussen.find(function (k) { return k.datum === vandaag && k.status !== "geannuleerd" && (k.gereedschap || []).indexOf(g.id) !== -1; });
  }

  // ---------- Overzicht (per categorie) ----------
  function toon() {
    const zoek = $("zoek").value.trim().toLowerCase();
    const cat = $("categorie").value;
    const lijst = gereedschap.filter(function (g) {
      const mld = gereedschapMeldingen(g);
      if (filter === "aandacht" && !mld.some(function (m) { return m.niveau === "rood" || m.niveau === "oranje"; })) return false;
      if (filter === "keuring" && !mld.some(function (m) { return m.soort === "keuring"; })) return false;
      if (filter === "defect" && g.status !== "defect" && g.status !== "afgekeurd") return false;
      if (filter === "uitgegeven" && !g.uitgegeven_aan) return false;
      if (cat && g.categorie !== cat) return false;
      return !zoek || [g.naam, g.serienummer, g.merk, g.type, g.categorie].join(" ").toLowerCase().indexOf(zoek) !== -1;
    });

    let html = "";
    GEREEDSCHAP_CATEGORIEEN.forEach(function (c) {
      const groep = lijst.filter(function (g) { return g.categorie === c; })
        .sort(function (a, b) { return a.naam.localeCompare(b.naam, "nl", { numeric: true }); });
      if (!groep.length) return;
      html += '<h2 class="categorie-kop">' + esc(c) + ' <span class="zacht">(' + groep.length + ')</span></h2><div class="voertuigen">';
      html += groep.map(function (g) {
        const mld = gereedschapMeldingen(g);
        const bij = vandaagBij(g);
        return '<button class="voertuig rand-' + ergste(mld) + '" data-id="' + g.id + '">' +
                 '<span class="voertuig-foto"' + (g.foto ? ' style="background-image:url(' + g.foto + ')"' : "") + '>' + (g.foto ? "" : (ICOON[g.categorie] || "🧰")) + '</span>' +
                 '<span class="voertuig-tekst">' +
                   '<strong>' + esc(g.naam) + '</strong>' +
                   '<span>' + esc([g.merk, g.type].filter(Boolean).join(" ")) + (g.serienummer ? ' <span class="zacht">· ' + esc(g.serienummer) + '</span>' : "") + '</span>' +
                   (g.uitgegeven_aan ? '<span class="zacht">Uitgegeven aan ' + esc(naamVan(g.uitgegeven_aan)) + '</span>' : (g.locatie ? '<span class="zacht">' + esc(g.locatie) + '</span>' : "")) +
                   (bij ? '<span class="zacht">Vandaag bij ' + esc(bij.klant) + '</span>' : "") +
                   (mld.length ? mld.map(function (m) { return '<span class="label ' + (m.niveau === "grijs" ? "st-grijs" : m.niveau) + '">' + esc(m.tekst) + '</span>'; }).join("")
                               : '<span class="label groen">In orde</span>') +
                 '</span>' +
               '</button>';
      }).join("") + "</div>";
    });
    $("lijst").innerHTML = html || '<div class="binnenkort">Geen gereedschap gevonden.</div>';

    const aandacht = gereedschap.filter(function (g) { return gereedschapMeldingen(g).some(function (m) { return m.niveau === "rood" || m.niveau === "oranje"; }); });
    $("samenvatting").textContent = gereedschap.length + " stuks · " + aandacht.length + " vragen aandacht · " +
      gereedschap.filter(function (g) { return g.uitgegeven_aan; }).length + " vast uitgegeven";
    const tel = {
      alle: gereedschap.length, aandacht: aandacht.length,
      keuring: gereedschap.filter(function (g) { return gereedschapMeldingen(g).some(function (m) { return m.soort === "keuring"; }); }).length,
      defect: gereedschap.filter(function (g) { return g.status === "defect" || g.status === "afgekeurd"; }).length,
      uitgegeven: gereedschap.filter(function (g) { return g.uitgegeven_aan; }).length
    };
    document.querySelectorAll("[data-filter]").forEach(function (k) {
      k.textContent = k.textContent.replace(/ \(\d+\)$/, "") + " (" + tel[k.dataset.filter] + ")";
    });
  }

  // ---------- Detail ----------
  function zetFoto(foto, cat) {
    const el = $("foto-voorbeeld");
    el.style.backgroundImage = foto ? "url(" + foto + ")" : "";
    el.textContent = foto ? "" : (ICOON[cat] || "🧰");
  }

  function tekenMeldingen(g) {
    const mld = gereedschapMeldingen(g);
    $("meldingen").innerHTML = mld.length ? mld.map(function (m) {
      return '<div class="melding zichtbaar ' + (m.niveau === "rood" ? "fout" : m.niveau === "oranje" ? "waarschuwing" : "info") + '">' + esc(m.tekst) + '</div>';
    }).join("") : '<div class="melding zichtbaar goed">Dit gereedschap is in orde.</div>';
  }

  function tekenHistorie() {
    const lijst = huidige ? onderhoud.filter(function (o) { return o.gereedschap === huidige.id; })
      .sort(function (a, b) { return (b.datum || "").localeCompare(a.datum || ""); }) : [];
    $("historie").innerHTML = lijst.length ? '<table class="tabel"><thead><tr><th>Datum</th><th>Soort</th><th>Omschrijving</th><th>Kosten</th>' +
      (magBewerken ? "<th></th>" : "") + '</tr></thead><tbody>' + lijst.map(function (o) {
        return '<tr><td>' + esc(datumNL(o.datum)) + '</td><td>' + esc(o.soort) + (o.uitslag === "afgekeurd" ? ' <span class="label rood">afgekeurd</span>' : "") +
          '</td><td>' + esc(o.omschrijving || "") + (o.door ? ' <span class="zacht">(' + esc(o.door) + ')</span>' : "") + '</td><td>' +
          (o.kosten ? "€ " + Number(o.kosten).toLocaleString("nl-NL", { minimumFractionDigits: 2 }) : "") + '</td>' +
          (magBewerken ? '<td><button type="button" class="m-weg klein-weg" data-historie-weg="' + o.id + '" aria-label="Verwijderen">✕</button></td>' : "") + '</tr>';
      }).join("") + '</tbody></table>' : '<p class="zacht">' + (huidige ? "Nog niets vastgelegd." : "Sla het gereedschap eerst op.") + '</p>';
  }

  function tekenInzet() {
    const lijst = huidige ? klussen.filter(function (k) {
      return k.datum && k.datum >= vandaag && k.status !== "geannuleerd" && (k.gereedschap || []).indexOf(huidige.id) !== -1;
    }).sort(function (a, b) { return (a.datum + a.start).localeCompare(b.datum + b.start); }) : [];
    $("inzet").innerHTML = lijst.length ? lijst.slice(0, 10).map(function (k) {
      return '<a class="dagregel" href="werkopdrachten.html?id=' + k.id + '"><span class="tijd">' +
        esc(new Date(k.datum + "T00:00:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })) + " " + k.start +
        '</span><span class="wat"><strong>' + esc(k.klant) + '</strong></span></a>';
    }).join("") : '<p class="zacht">Niet ingepland vanaf vandaag.</p>';
  }

  function mensenOpties(leegTekst) {
    return '<option value="">' + leegTekst + '</option>' + medewerkers.filter(function (m) { return m.actief; })
      .sort(function (a, b) { return a.voornaam.localeCompare(b.voornaam, "nl"); })
      .map(function (m) { return '<option value="' + m.id + '">' + esc(m.voornaam + " " + m.achternaam) + '</option>'; }).join("");
  }

  function open(g) {
    huidige = g || null;
    nieuweFoto = undefined;
    const o = g || { naam: "", categorie: "Overig", status: "beschikbaar", locatie: "Magazijn" };
    $("titel").textContent = g ? o.naam : "Nieuw gereedschap";
    $("subtitel").textContent = g ? [o.categorie, o.merk, o.serienummer].filter(Boolean).join(" · ") : "";
    const zet = function (id, w) { $(id).value = w === undefined || w === null ? "" : w; };
    $("g-verantwoordelijke").innerHTML = mensenOpties("– niemand –");
    $("g-uitgegeven").innerHTML = mensenOpties("– niet uitgegeven –");
    zet("g-naam", o.naam); zet("g-categorie", o.categorie); zet("g-merk", o.merk); zet("g-type", o.type); zet("g-serie", o.serienummer);
    zet("g-aankoop", o.aankoopdatum); zet("g-status", o.status || "beschikbaar"); zet("g-locatie", o.locatie);
    zet("g-verantwoordelijke", o.verantwoordelijke); zet("g-uitgegeven", o.uitgegeven_aan); zet("g-vereist", o.vereist); zet("g-bijz", o.bijzonderheden);
    zet("g-laatste-keuring", o.laatste_keuring); zet("g-volgende-keuring", o.volgende_keuring);
    zet("g-laatste-onderhoud", o.laatste_onderhoud); zet("g-volgende-onderhoud", o.volgende_onderhoud);
    zetFoto(o.foto, o.categorie);
    tekenMeldingen(o);
    tekenHistorie();
    tekenInzet();
    $("toevoegen").open = false;
    $("h-datum").value = vandaag; $("h-door").value = ""; $("h-kosten").value = ""; $("h-oms").value = ""; $("h-volgende").value = ""; $("h-uitslag").value = "goed";
    $("h-soort").value = "Keuring"; zetHistorieVelden();
    $("verwijder").hidden = !g;
    $("melding").className = "melding";
    document.querySelectorAll("#detail input, #detail select, #detail textarea").forEach(function (el) { if (el.type !== "file") el.disabled = !magBewerken; });
    $("detail").showModal();
  }

  function lees() {
    return Object.assign({}, huidige || { voorbeeld: false }, {
      naam: $("g-naam").value.trim(), categorie: $("g-categorie").value, merk: $("g-merk").value.trim(), type: $("g-type").value.trim(),
      serienummer: $("g-serie").value.trim(), aankoopdatum: $("g-aankoop").value, status: $("g-status").value, locatie: $("g-locatie").value.trim(),
      verantwoordelijke: $("g-verantwoordelijke").value, uitgegeven_aan: $("g-uitgegeven").value, vereist: $("g-vereist").value,
      bijzonderheden: $("g-bijz").value.trim(), laatste_keuring: $("g-laatste-keuring").value, volgende_keuring: $("g-volgende-keuring").value,
      laatste_onderhoud: $("g-laatste-onderhoud").value, volgende_onderhoud: $("g-volgende-onderhoud").value
    });
  }

  function zetHistorieVelden() {
    const soort = $("h-soort").value;
    $("h-uitslag-veld").hidden = soort !== "Keuring";
    $("h-volgende-veld").hidden = soort !== "Keuring" && soort !== "Onderhoud";
    $("h-volgende-veld").querySelector("label").textContent = soort === "Onderhoud" ? "Volgende onderhoud" : "Volgende keuring (uiterlijk)";
    // Standaard: volgende keuring over een jaar
    if (soort === "Keuring" && !$("h-volgende").value && $("h-datum").value) {
      const d = new Date($("h-datum").value + "T00:00:00"); d.setFullYear(d.getFullYear() + 1); $("h-volgende").value = iso(d);
    }
  }
  $("h-soort").addEventListener("change", function () { $("h-volgende").value = ""; zetHistorieVelden(); });
  $("formulier").addEventListener("change", function (e) { if (!e.target.id.startsWith("h-")) tekenMeldingen(lees()); });

  $("formulier").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!magBewerken) return;
    const g = lees();
    if (!g.naam) { $("melding").className = "melding zichtbaar fout"; $("melding").textContent = "Vul een naam in."; $("melding").scrollIntoView({ block: "center" }); return; }
    if (nieuweFoto !== undefined) g.foto = nieuweFoto;
    await Opslag.bewaar("gereedschap", g);
    $("detail").close();
    await laad();
  });

  $("h-opslaan").addEventListener("click", async function () {
    if (!huidige || !magBewerken) return;
    const rec = {
      gereedschap: huidige.id, datum: $("h-datum").value, soort: $("h-soort").value, door: $("h-door").value.trim(),
      kosten: $("h-kosten").value === "" ? "" : Number($("h-kosten").value), omschrijving: $("h-oms").value.trim(),
      uitslag: $("h-soort").value === "Keuring" ? $("h-uitslag").value : ""
    };
    if (!rec.datum) { alert("Vul een datum in."); return; }
    await Opslag.bewaar("onderhoud", rec);
    const g = lees();
    if (rec.soort === "Keuring") {
      g.laatste_keuring = rec.datum;
      if (rec.uitslag === "afgekeurd") { g.status = "afgekeurd"; g.bijzonderheden = (rec.omschrijving || "Afgekeurd bij keuring"); }
      else {
        if ($("h-volgende").value) g.volgende_keuring = $("h-volgende").value;
        if (g.status === "afgekeurd") g.status = "beschikbaar";
      }
    }
    if (rec.soort === "Onderhoud") {
      g.laatste_onderhoud = rec.datum;
      if ($("h-volgende").value) g.volgende_onderhoud = $("h-volgende").value;
    }
    if (rec.soort === "Reparatie" && g.status === "defect") g.status = "beschikbaar";
    if (nieuweFoto !== undefined) g.foto = nieuweFoto;
    huidige = await Opslag.bewaar("gereedschap", g);
    await laad();
    open(gereedschap.find(function (x) { return x.id === huidige.id; }));
    $("melding").className = "melding zichtbaar goed";
    $("melding").textContent = rec.soort + " vastgelegd. Het gereedschap is bijgewerkt.";
  });

  $("historie").addEventListener("click", async function (e) {
    const k = e.target.closest("[data-historie-weg]");
    if (!k || !confirm("Deze regel uit de historie verwijderen?")) return;
    await Opslag.verwijder("onderhoud", k.dataset.historieWeg);
    onderhoud = await Opslag.alle("onderhoud");
    tekenHistorie();
  });

  $("verwijder").addEventListener("click", async function () {
    if (!huidige) return;
    if (!confirm(huidige.naam + " verwijderen?\n\nTip: zet het liever op 'Afgekeurd', dan blijft de historie bewaard.")) return;
    await Opslag.verwijder("gereedschap", huidige.id);
    $("detail").close();
    await laad();
  });

  $("foto-bestand").addEventListener("change", function (e) {
    const bestand = e.target.files[0];
    e.target.value = "";
    if (!bestand) return;
    const img = new Image();
    img.onload = function () {
      const schaal = Math.min(1, 600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * schaal); c.height = Math.round(img.height * schaal);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      nieuweFoto = c.toDataURL("image/jpeg", 0.8);
      zetFoto(nieuweFoto);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(bestand);
  });
  $("foto-weg").addEventListener("click", function () { nieuweFoto = ""; zetFoto("", $("g-categorie").value); });

  document.querySelectorAll("[data-sluit]").forEach(function (k) { k.addEventListener("click", function () { $("detail").close(); }); });
  $("detail").addEventListener("click", function (e) { if (e.target === $("detail")) $("detail").close(); });
  $("lijst").addEventListener("click", function (e) {
    const k = e.target.closest(".voertuig");
    if (k) open(gereedschap.find(function (g) { return g.id === k.dataset.id; }));
  });
  $("nieuw").addEventListener("click", function () { open(null); });
  $("zoek").addEventListener("input", toon);
  $("categorie").addEventListener("change", toon);
  document.querySelectorAll("[data-filter]").forEach(function (k) {
    k.addEventListener("click", function () {
      filter = k.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(function (x) { x.classList.toggle("actief", x === k); });
      toon();
    });
  });
  if (!magBewerken) $("nieuw").hidden = true;

  async function laad() {
    gereedschap = await Opslag.alle("gereedschap");
    medewerkers = await Opslag.alle("medewerkers");
    klussen = await Opslag.alle("klussen");
    onderhoud = await Opslag.alle("onderhoud");
    toon();
  }

  (async function () {
    await Voorbeeld.zorgVoorAlles();
    await laad();
    const id = new URLSearchParams(location.search).get("id");
    if (id) { const g = gereedschap.find(function (x) { return x.id === id; }); if (g) open(g); }
  })();
})();

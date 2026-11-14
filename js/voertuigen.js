/* =========================================================
   Glasmeesters Planner – voertuigenbeheer
   Bewerken: beheerder en wagenparkbeheerder. Planner kijkt mee.
   ========================================================= */

(function () {
  if (document.body.classList.contains("geen-toegang")) return;

  const rol = huidigeRol();
  const magBewerken = rol === "beheerder" || rol === "wagenpark";
  if (!magBewerken) document.body.classList.add("alleen-lezen-wagenpark");

  let voertuigen = [], medewerkers = [], klussen = [], onderhoud = [];
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
  function getal(v) { return v === "" || v === null || v === undefined ? "" : Number(v); }

  // Keuzelijsten vullen
  $("v-soort").innerHTML = Object.keys(VOERTUIG_SOORTEN).map(function (k) { return '<option value="' + k + '">' + VOERTUIG_SOORTEN[k] + '</option>'; }).join("");
  $("v-brandstof").innerHTML = BRANDSTOFFEN.map(function (b) { return "<option>" + b + "</option>"; }).join("");
  $("v-rijbewijs").innerHTML = BEVOEGDHEDEN.filter(function (b) { return b.soort === "Rijbewijs"; })
    .map(function (b) { return '<option value="' + b.code + '">' + b.naam + '</option>'; }).join("");
  $("v-status").innerHTML = Object.keys(VOERTUIG_STATUS).map(function (k) { return '<option value="' + k + '">' + VOERTUIG_STATUS[k] + '</option>'; }).join("");
  $("h-soort").innerHTML = ONDERHOUD_SOORTEN.map(function (s) { return "<option>" + s + "</option>"; }).join("");

  function ergste(meldingen) {
    if (meldingen.some(function (m) { return m.niveau === "rood"; })) return "rood";
    if (meldingen.some(function (m) { return m.niveau === "grijs"; })) return "grijs";
    if (meldingen.some(function (m) { return m.niveau === "oranje"; })) return "oranje";
    return "groen";
  }

  function kenteken(k) { return k ? '<span class="kenteken">' + esc(k) + '</span>' : ""; }

  // ---------- Overzicht ----------
  function toon() {
    const zoek = $("zoek").value.trim().toLowerCase();
    const lijst = voertuigen.filter(function (v) {
      const mld = voertuigMeldingen(v);
      if (filter === "aandacht" && !mld.some(function (m) { return m.niveau === "rood" || m.niveau === "oranje"; })) return false;
      if (filter === "apk" && !mld.some(function (m) { return m.soort === "apk"; })) return false;
      if (filter === "onderhoud" && !mld.some(function (m) { return m.soort === "onderhoud"; })) return false;
      if (filter === "niet" && v.status !== "buiten_gebruik") return false;
      return !zoek || [v.naam, v.kenteken, v.merk, v.type].join(" ").toLowerCase().indexOf(zoek) !== -1;
    }).sort(function (a, b) {
      const volg = { bus: 0, bakwagen: 1, auto: 2, aanhanger: 3 };
      return (volg[a.soort] || 0) - (volg[b.soort] || 0) || a.naam.localeCompare(b.naam, "nl", { numeric: true });
    });

    $("lijst").innerHTML = lijst.length ? lijst.map(function (v) {
      const mld = voertuigMeldingen(v);
      const kleur = ergste(mld);
      const vandaagIngepland = klussen.some(function (k) { return k.datum === vandaag && k.status !== "geannuleerd" && (k.voertuig === v.id || k.aanhanger === v.id); });
      return '<button class="voertuig rand-' + kleur + '" data-id="' + v.id + '">' +
               '<span class="voertuig-foto"' + (v.foto ? ' style="background-image:url(' + v.foto + ')"' : "") + '>' + (v.foto ? "" : (v.soort === "aanhanger" ? "🛞" : "🚐")) + '</span>' +
               '<span class="voertuig-tekst">' +
                 '<strong>' + esc(v.naam) + '</strong>' +
                 '<span>' + esc([v.merk, v.type].filter(Boolean).join(" ")) + '</span>' +
                 '<span class="rij">' + kenteken(v.kenteken) +
                   (v.kilometerstand ? '<span class="zacht">' + Number(v.kilometerstand).toLocaleString("nl-NL") + ' km</span>' : "") + '</span>' +
                 (mld.length ? mld.map(function (m) { return '<span class="label ' + (m.niveau === "grijs" ? "st-grijs" : m.niveau) + '">' + esc(m.tekst) + '</span>'; }).join("")
                             : '<span class="label groen">In orde</span>') +
                 (vandaagIngepland ? '<span class="zacht">Vandaag in gebruik</span>' : "") +
               '</span>' +
             '</button>';
    }).join("") : '<div class="binnenkort">Geen voertuigen gevonden.</div>';

    const wagens = voertuigen.filter(function (v) { return v.soort !== "aanhanger"; });
    const aandacht = voertuigen.filter(function (v) { return voertuigMeldingen(v).some(function (m) { return m.niveau === "rood" || m.niveau === "oranje"; }); });
    $("samenvatting").textContent = wagens.length + " voertuigen en " + (voertuigen.length - wagens.length) + " aanhangers · " +
      aandacht.length + " vragen aandacht · " + voertuigen.filter(function (v) { return v.status === "buiten_gebruik"; }).length + " niet inzetbaar";
    // Aantallen op de filterknoppen
    const tel = {
      alle: voertuigen.length, aandacht: aandacht.length,
      apk: voertuigen.filter(function (v) { return voertuigMeldingen(v).some(function (m) { return m.soort === "apk"; }); }).length,
      onderhoud: voertuigen.filter(function (v) { return voertuigMeldingen(v).some(function (m) { return m.soort === "onderhoud"; }); }).length,
      niet: voertuigen.filter(function (v) { return v.status === "buiten_gebruik"; }).length
    };
    document.querySelectorAll("[data-filter]").forEach(function (k) {
      k.textContent = k.textContent.replace(/ \(\d+\)$/, "") + " (" + tel[k.dataset.filter] + ")";
    });
  }

  // ---------- Detail ----------
  function zetFoto(foto, soort) {
    const el = $("foto-voorbeeld");
    el.style.backgroundImage = foto ? "url(" + foto + ")" : "";
    el.textContent = foto ? "" : (soort === "aanhanger" ? "🛞" : "🚐");
  }

  function tekenMeldingen(v) {
    const mld = voertuigMeldingen(v);
    $("meldingen").innerHTML = mld.length ? mld.map(function (m) {
      return '<div class="melding zichtbaar ' + (m.niveau === "rood" ? "fout" : m.niveau === "oranje" ? "waarschuwing" : "info") + '">' + esc(m.tekst) + '</div>';
    }).join("") : '<div class="melding zichtbaar goed">Dit voertuig is in orde.</div>';
  }

  function tekenHistorie() {
    const lijst = huidige ? onderhoud.filter(function (o) { return o.voertuig === huidige.id; })
      .sort(function (a, b) { return (b.datum || "").localeCompare(a.datum || ""); }) : [];
    $("historie").innerHTML = lijst.length ? '<table class="tabel"><thead><tr><th>Datum</th><th>Soort</th><th>Km</th><th>Omschrijving</th><th>Kosten</th>' +
      (magBewerken ? "<th></th>" : "") + '</tr></thead><tbody>' + lijst.map(function (o) {
        return '<tr><td>' + esc(datumNL(o.datum)) + '</td><td>' + esc(o.soort) + '</td><td>' + (o.km ? Number(o.km).toLocaleString("nl-NL") : "") +
          '</td><td>' + esc(o.omschrijving || "") + (o.door ? ' <span class="zacht">(' + esc(o.door) + ')</span>' : "") + '</td><td>' +
          (o.kosten ? "€ " + Number(o.kosten).toLocaleString("nl-NL", { minimumFractionDigits: 2 }) : "") + '</td>' +
          (magBewerken ? '<td><button type="button" class="m-weg klein-weg" data-historie-weg="' + o.id + '" aria-label="Verwijderen">✕</button></td>' : "") + '</tr>';
      }).join("") + '</tbody></table>' : '<p class="zacht">' + (huidige ? "Nog niets vastgelegd." : "Sla het voertuig eerst op.") + '</p>';
  }

  function tekenInzet() {
    const lijst = huidige ? klussen.filter(function (k) {
      return k.datum && k.datum >= vandaag && k.status !== "geannuleerd" && (k.voertuig === huidige.id || k.aanhanger === huidige.id);
    }).sort(function (a, b) { return (a.datum + a.start).localeCompare(b.datum + b.start); }) : [];
    $("inzet").innerHTML = lijst.length ? lijst.slice(0, 10).map(function (k) {
      return '<a class="dagregel" href="werkopdrachten.html?id=' + k.id + '"><span class="tijd">' +
        esc(new Date(k.datum + "T00:00:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })) + " " + k.start +
        '</span><span class="wat"><strong>' + esc(k.klant) + '</strong></span></a>';
    }).join("") : '<p class="zacht">Niet ingepland vanaf vandaag.</p>';
  }

  function open(v) {
    huidige = v || null;
    nieuweFoto = undefined;
    const g = v || { naam: "", soort: "bus", merk: "", type: "", kenteken: "", status: "actief", vereist_rijbewijs: "rijbewijs_b", brandstof: "Diesel" };
    $("titel").textContent = v ? g.naam : "Nieuw voertuig";
    $("subtitel").textContent = v ? [g.merk, g.type, g.kenteken].filter(Boolean).join(" · ") : "";
    const zet = function (id, waarde) { $(id).value = waarde === undefined || waarde === null ? "" : waarde; };
    zet("v-naam", g.naam); zet("v-soort", g.soort); zet("v-merk", g.merk); zet("v-type", g.type); zet("v-kenteken", g.kenteken);
    zet("v-bouwjaar", g.bouwjaar); zet("v-brandstof", g.brandstof || "Diesel"); zet("v-rijbewijs", g.vereist_rijbewijs || "rijbewijs_b");
    zet("v-status", g.status || "actief"); zet("v-bijz", g.bijzonderheden);
    $("v-verantwoordelijke").innerHTML = '<option value="">– niemand –</option>' + medewerkers.filter(function (m) { return m.actief; })
      .sort(function (a, b) { return a.voornaam.localeCompare(b.voornaam, "nl"); })
      .map(function (m) { return '<option value="' + m.id + '">' + esc(m.voornaam + " " + m.achternaam) + '</option>'; }).join("");
    zet("v-verantwoordelijke", g.verantwoordelijke);
    zet("v-km", g.kilometerstand); zet("v-interval", g.onderhoud_interval_km); zet("v-laatste-datum", g.datum_laatste_onderhoud);
    zet("v-laatste-km", g.km_laatste_onderhoud); zet("v-volgende", g.volgende_onderhoud);
    zet("v-apk", g.apk_tot); zet("v-verzekeraar", g.verzekeraar); zet("v-polis", g.polisnummer); zet("v-verzekering", g.verzekering_tot);
    zetFoto(g.foto, g.soort);
    tekenMeldingen(g);
    tekenHistorie();
    tekenInzet();
    $("toevoegen").open = false;
    $("h-datum").value = vandaag; $("h-km").value = g.kilometerstand || ""; $("h-kosten").value = ""; $("h-door").value = ""; $("h-oms").value = ""; $("h-apk").value = ""; $("h-volgende").value = "";
    $("verwijder").hidden = !v;
    $("melding").className = "melding";
    document.querySelectorAll("#detail input, #detail select, #detail textarea").forEach(function (el) { if (el.type !== "file") el.disabled = !magBewerken; });
    $("detail").showModal();
  }

  function lees() {
    return Object.assign({}, huidige || { voorbeeld: false }, {
      naam: $("v-naam").value.trim(), soort: $("v-soort").value, merk: $("v-merk").value.trim(), type: $("v-type").value.trim(),
      kenteken: $("v-kenteken").value.trim().toUpperCase(), bouwjaar: getal($("v-bouwjaar").value), brandstof: $("v-brandstof").value,
      vereist_rijbewijs: $("v-rijbewijs").value, status: $("v-status").value, verantwoordelijke: $("v-verantwoordelijke").value,
      bijzonderheden: $("v-bijz").value.trim(), kilometerstand: getal($("v-km").value), onderhoud_interval_km: getal($("v-interval").value),
      datum_laatste_onderhoud: $("v-laatste-datum").value, km_laatste_onderhoud: getal($("v-laatste-km").value),
      volgende_onderhoud: $("v-volgende").value, apk_tot: $("v-apk").value, verzekeraar: $("v-verzekeraar").value.trim(),
      polisnummer: $("v-polis").value.trim(), verzekering_tot: $("v-verzekering").value
    });
  }

  // Live bijwerken van de meldingen bovenaan terwijl je typt
  $("formulier").addEventListener("change", function () { tekenMeldingen(lees()); });
  $("h-soort").addEventListener("change", function () {
    $("h-apk-veld").hidden = $("h-soort").value !== "APK";
    $("h-volgende-veld").hidden = $("h-soort").value !== "Onderhoudsbeurt";
  });

  $("formulier").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!magBewerken) return;
    const v = lees();
    if (!v.naam) { $("melding").className = "melding zichtbaar fout"; $("melding").textContent = "Vul een naam of nummer in."; $("melding").scrollIntoView({ block: "center" }); return; }
    if (nieuweFoto !== undefined) v.foto = nieuweFoto;
    await Opslag.bewaar("voertuigen", v);
    $("detail").close();
    await laad();
  });

  // Onderhoud vastleggen (en het voertuig bijwerken)
  $("h-opslaan").addEventListener("click", async function () {
    if (!huidige || !magBewerken) return;
    const rec = {
      voertuig: huidige.id, datum: $("h-datum").value, soort: $("h-soort").value, km: getal($("h-km").value),
      kosten: getal($("h-kosten").value), door: $("h-door").value.trim(), omschrijving: $("h-oms").value.trim()
    };
    if (!rec.datum) { alert("Vul een datum in."); return; }
    await Opslag.bewaar("onderhoud", rec);
    const v = lees();
    if (rec.km && (!v.kilometerstand || rec.km > v.kilometerstand)) v.kilometerstand = rec.km;
    if (rec.soort === "Onderhoudsbeurt") {
      v.datum_laatste_onderhoud = rec.datum;
      if (rec.km) v.km_laatste_onderhoud = rec.km;
      if ($("h-volgende").value) v.volgende_onderhoud = $("h-volgende").value;
    }
    if (rec.soort === "APK" && $("h-apk").value) v.apk_tot = $("h-apk").value;
    if (nieuweFoto !== undefined) v.foto = nieuweFoto;
    huidige = await Opslag.bewaar("voertuigen", v);
    await laad();
    open(voertuigen.find(function (x) { return x.id === huidige.id; }));
    $("melding").className = "melding zichtbaar goed";
    $("melding").textContent = rec.soort + " vastgelegd. Het voertuig is bijgewerkt.";
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
    const gebruikt = klussen.some(function (k) { return k.datum >= vandaag && (k.voertuig === huidige.id || k.aanhanger === huidige.id); });
    if (!confirm(huidige.naam + " verwijderen?" + (gebruikt ? "\n\nLet op: dit voertuig staat nog ingepland bij komende opdrachten." : "") +
      "\n\nTip: zet het liever op 'Tijdelijk niet inzetbaar'.")) return;
    await Opslag.verwijder("voertuigen", huidige.id);
    $("detail").close();
    await laad();
  });

  // Foto (verkleind tot 600 pixels)
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
  $("foto-weg").addEventListener("click", function () { nieuweFoto = ""; zetFoto("", $("v-soort").value); });

  document.querySelectorAll("[data-sluit]").forEach(function (k) { k.addEventListener("click", function () { $("detail").close(); }); });
  $("detail").addEventListener("click", function (e) { if (e.target === $("detail")) $("detail").close(); });
  $("lijst").addEventListener("click", function (e) {
    const k = e.target.closest(".voertuig");
    if (k) open(voertuigen.find(function (v) { return v.id === k.dataset.id; }));
  });
  $("nieuw").addEventListener("click", function () { open(null); });
  $("zoek").addEventListener("input", toon);
  document.querySelectorAll("[data-filter]").forEach(function (k) {
    k.addEventListener("click", function () {
      filter = k.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(function (x) { x.classList.toggle("actief", x === k); });
      toon();
    });
  });
  if (!magBewerken) $("nieuw").hidden = true;

  async function laad() {
    voertuigen = await Opslag.alle("voertuigen");
    medewerkers = await Opslag.alle("medewerkers");
    klussen = await Opslag.alle("klussen");
    onderhoud = await Opslag.alle("onderhoud");
    toon();
  }

  (async function () {
    await Voorbeeld.zorgVoorAlles();
    await laad();
    const id = new URLSearchParams(location.search).get("id");
    if (id) { const v = voertuigen.find(function (x) { return x.id === id; }); if (v) open(v); }
  })();
})();

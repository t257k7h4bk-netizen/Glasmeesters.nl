/* =========================================================
   Glasmeesters Planner – financieel overzicht (fase C2)
   Omzet, kosten en winst per week, maand of jaar.
   Bron: de calculatie bij elke werkopdracht.
   - Omzet  = gefactureerd bedrag excl. btw
   - Kosten = kostprijs met echte inkoop
   - Datum  = factuurdatum, anders de datum van de opdracht
   Opdrachten met een calculatie maar nog zonder factuur tellen
   mee als "nog te factureren", niet in de omzet.
   ========================================================= */

(async function () {
  if (document.body.classList.contains("geen-toegang")) return;

  const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const MAANDEN_LANG = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function pct(x) { return x === null || !isFinite(x) ? "–" : x.toLocaleString("nl-NL", { maximumFractionDigits: 1 }) + "%"; }
  function kort(x) {
    const a = Math.abs(x);
    if (a >= 1000000) return "€ " + (x / 1000000).toLocaleString("nl-NL", { maximumFractionDigits: 1 }) + " mln";
    if (a >= 1000) return "€ " + (x / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1 }) + "k";
    return "€ " + Math.round(x);
  }
  // ISO-weeknummer en het jaar waar die week bij hoort
  function isoWeek(datum) {
    const d = new Date(datum + "T12:00:00");
    const dag = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dag + 3);
    const jaar = d.getFullYear();
    const eerste = new Date(jaar, 0, 4);
    return { jaar: jaar, week: 1 + Math.round(((d - eerste) / 86400000 - 3 + ((eerste.getDay() + 6) % 7)) / 7) };
  }
  function wekenInJaar(j) { return isoWeek(j + "-12-28").week; }

  await Voorbeeld.zorgVoorAlles();
  await Voorbeeld.zorgVoorFinancieel();
  await Werkopdracht_nummers();

  // Opdrachtnummers voor de voorbeeldopdrachten (zelfde als op Werkopdrachten)
  async function Werkopdracht_nummers() {
    const alle = await Opslag.alle("klussen");
    const zonder = alle.filter(function (k) { return !k.nummer; })
      .sort(function (a, b) { return ((a.datum || "") + (a.start || "")).localeCompare((b.datum || "") + (b.start || "")); });
    for (const k of zonder) { k.nummer = await nieuwOpdrachtNummer(); if (!k.status) k.status = k.datum ? "gepland" : "concept"; await Opslag.bewaar("klussen", k); }
  }

  const vandaag = iso(new Date());
  const klussen = await Opslag.alle("klussen");

  // Elke opdracht met een calculatie omzetten naar een regel met bedragen
  const posten = klussen.filter(function (k) { return k.calculatie && k.status !== "geannuleerd"; }).map(function (k) {
    const t = calcTotalen(k.calculatie);
    const datum = k.calculatie.factuurdatum || k.datum || (k.calculatie.bijgewerkt_op || "").slice(0, 10) || vandaag;
    return {
      klus: k, datum: datum, gefactureerd: t.gefactureerd !== null,
      omzet: t.gefactureerd !== null ? t.gefactureerd : 0, kosten: t.kostWerkelijk,
      winst: t.gefactureerd !== null ? t.gefactureerd - t.kostWerkelijk : 0,
      verwachtOmzet: t.verkoopExcl, verwachtWinst: t.verkoopExcl - t.kostWerkelijk
    };
  });

  let indeling = "maand";
  let jaar = new Date().getFullYear();
  let gekozenBak = null;
  try { indeling = localStorage.getItem("gm-fin-indeling") || "maand"; } catch (e) {}

  function bakVan(p) {
    if (indeling === "jaar") return p.datum.slice(0, 4);
    if (indeling === "maand") return p.datum.slice(0, 4) === String(jaar) ? p.datum.slice(5, 7) : null;
    const w = isoWeek(p.datum);
    return w.jaar === jaar ? String(w.week) : null;
  }
  function bakNaam(sleutel, lang) {
    if (indeling === "jaar") return sleutel;
    if (indeling === "maand") return (lang ? MAANDEN_LANG : MAANDEN)[Number(sleutel) - 1] + (lang ? " " + jaar : "");
    return (lang ? "Week " : "wk ") + sleutel + (lang ? " – " + jaar : "");
  }
  function bakken() {
    let sleutels;
    if (indeling === "maand") sleutels = MAANDEN.map(function (m, i) { return String(i + 1).padStart(2, "0"); });
    else if (indeling === "week") { sleutels = []; for (let w = 1; w <= wekenInJaar(jaar); w++) sleutels.push(String(w)); }
    else {
      const jaren = posten.filter(function (p) { return p.gefactureerd; }).map(function (p) { return Number(p.datum.slice(0, 4)); });
      const van = jaren.length ? Math.min.apply(null, jaren) : jaar, tot = Math.max(jaren.length ? Math.max.apply(null, jaren) : jaar, new Date().getFullYear());
      sleutels = []; for (let j = van; j <= tot; j++) sleutels.push(String(j));
    }
    const map = {};
    sleutels.forEach(function (s) { map[s] = { sleutel: s, omzet: 0, kosten: 0, winst: 0, posten: [] }; });
    posten.filter(function (p) { return p.gefactureerd; }).forEach(function (p) {
      const s = bakVan(p);
      if (s === null || !map[s]) return;
      map[s].omzet += p.omzet; map[s].kosten += p.kosten; map[s].winst += p.winst; map[s].posten.push(p);
    });
    return sleutels.map(function (s) { return map[s]; });
  }

  // ---------- Tegels ----------
  function tekenTegels(lijst) {
    const binnen = indeling === "jaar" ? posten : posten.filter(function (p) { return p.datum.slice(0, 4) === String(jaar); });
    const gef = binnen.filter(function (p) { return p.gefactureerd; });
    const som = function (l, k) { return l.reduce(function (s, p) { return s + p[k]; }, 0); };
    const omzet = som(gef, "omzet"), kosten = som(gef, "kosten"), winst = omzet - kosten;
    const open = posten.filter(function (p) { return !p.gefactureerd; });
    // Vergelijking met dezelfde periode vorig jaar (tot dezelfde dag)
    let vergelijk = "";
    if (indeling !== "jaar") {
      const dagNu = vandaag.slice(4);
      const tot = jaar === new Date().getFullYear() ? dagNu : "-12-31";
      const vorig = posten.filter(function (p) { return p.gefactureerd && p.datum.slice(0, 4) === String(jaar - 1) && p.datum.slice(4) <= tot; });
      const wv = som(vorig, "omzet") - som(vorig, "kosten");
      if (vorig.length) {
        const verschil = winst - wv;
        vergelijk = '<span class="fin-vergelijk">' + (verschil >= 0 ? "▲ " : "▼ ") + euro(Math.abs(verschil), true) + " t.o.v. " + (jaar - 1) +
                    (jaar === new Date().getFullYear() ? " (zelfde periode)" : "") + '</span>';
      }
    }
    const titel = indeling === "jaar" ? "alle jaren" : String(jaar) + (jaar === new Date().getFullYear() ? " tot nu toe" : "");
    $("tegels").innerHTML =
      tegel("Omzet " + titel, euro(omzet, true), gef.length + " gefactureerde opdracht" + (gef.length === 1 ? "" : "en")) +
      tegel("Kosten", euro(kosten, true), "kostprijs met echte inkoop") +
      tegel("Nettowinst", euro(winst, true), vergelijk || "omzet min kosten", winst < 0 ? "verlies" : "winst") +
      tegel("Gemiddelde opslag", pct(kosten ? (omzet / kosten - 1) * 100 : null), "winst als % van de kosten") +
      tegel("Nog te factureren", euro(som(open, "verwachtOmzet"), true), open.length + " opdracht" + (open.length === 1 ? "" : "en") + " met calculatie, zonder factuur");
  }
  function tegel(label, waarde, onder, soort) {
    return '<div class="fin-tegel' + (soort ? " " + soort : "") + '"><span class="fin-tegel-label">' + esc(label) + '</span>' +
           '<strong>' + esc(waarde) + '</strong><span class="fin-tegel-onder">' + onder + '</span></div>';
  }

  // ---------- Grafiek (SVG) ----------
  function tekenGrafiek(lijst) {
    const B = Math.max(320, Math.round($("grafiek").clientWidth || 1000)), H = B < 600 ? 260 : 340, L = 58, R = 8, T = 14, O = 30;
    const pw = B - L - R, ph = H - T - O;
    const max = Math.max(1, Math.max.apply(null, lijst.map(function (b) { return Math.max(b.omzet, b.kosten); })));
    const min = Math.min(0, Math.min.apply(null, lijst.map(function (b) { return b.winst; })));
    // Nette stappen voor de as
    const ruw = (max - min) / 4;
    const macht = Math.pow(10, Math.floor(Math.log10(ruw)));
    const stap = [1, 2, 2.5, 5, 10].map(function (f) { return f * macht; }).find(function (s) { return s >= ruw; });
    const top = Math.ceil(max / stap) * stap, bodem = Math.floor(min / stap) * stap;
    const y = function (w) { return T + ph * (top - w) / (top - bodem || 1); };
    const n = lijst.length, kol = pw / n;
    const bw = Math.max(3, Math.min(48, kol * (n > 20 ? 0.62 : 0.56)));
    let svg = '<svg viewBox="0 0 ' + B + ' ' + H + '" role="img" aria-label="Omzet, kosten en winst ' + (indeling === "jaar" ? "per jaar" : "in " + jaar) + '">';
    // Raster en as
    for (let w = bodem; w <= top + 0.001; w += stap) {
      svg += '<line class="fin-raster' + (Math.abs(w) < 0.001 ? " nul" : "") + '" x1="' + L + '" x2="' + (B - R) + '" y1="' + y(w) + '" y2="' + y(w) + '"/>' +
             '<text class="fin-as" x="' + (L - 8) + '" y="' + (y(w) + 4) + '" text-anchor="end">' + esc(kort(w)) + '</text>';
    }
    const elke = Math.max(1, Math.ceil(34 / kol), n > 40 ? 4 : n > 20 ? 2 : 1);
    // Afgerond uiteinde (4px) alleen aan de kant weg van de nullijn
    const staaf = function (x, y1, y2, klasse, omhoog) {
      const h = Math.abs(y2 - y1); if (h < 0.5) return "";
      const r = Math.min(4, h, bw / 2), yt = Math.min(y1, y2), yb = Math.max(y1, y2);
      const d = omhoog
        ? "M" + x + " " + yb + "V" + (yt + r) + "Q" + x + " " + yt + " " + (x + r) + " " + yt + "H" + (x + bw - r) + "Q" + (x + bw) + " " + yt + " " + (x + bw) + " " + (yt + r) + "V" + yb + "Z"
        : "M" + x + " " + yt + "V" + (yb - r) + "Q" + x + " " + yb + " " + (x + r) + " " + yb + "H" + (x + bw - r) + "Q" + (x + bw) + " " + yb + " " + (x + bw) + " " + (yb - r) + "V" + yt + "Z";
      return '<path class="' + klasse + '" d="' + d + '"/>';
    };
    lijst.forEach(function (b, i) {
      const x = L + kol * i + (kol - bw) / 2;
      const gekozen = gekozenBak === b.sleutel;
      svg += '<g class="fin-kolom' + (gekozen ? " gekozen" : "") + '" data-bak="' + b.sleutel + '">' +
             '<rect class="fin-raak" x="' + (L + kol * i) + '" y="' + T + '" width="' + kol + '" height="' + ph + '"/>';
      if (b.posten.length) {
        if (b.winst >= 0) {
          const yk = y(b.kosten);
          svg += staaf(x, y(0), yk, "fin-kosten", b.winst < 0.005);
          svg += staaf(x, yk - (b.winst > 0.005 ? 2 : 0), y(b.omzet), "fin-winst", true);
        } else {
          svg += staaf(x, y(0), y(b.omzet), "fin-kosten", true);
          svg += staaf(x, y(0) + 2, y(b.winst), "fin-verlies", false);
        }
      }
      svg += '</g>';
      if (i % elke === 0) svg += '<text class="fin-as" x="' + (L + kol * i + kol / 2) + '" y="' + (H - 12) + '" text-anchor="middle">' + esc(indeling === "week" ? b.sleutel : bakNaam(b.sleutel)) + '</text>';
    });
    svg += '</svg>';
    $("grafiek").innerHTML = svg;
    $("grafiek-titel").textContent = indeling === "jaar" ? "Omzet en winst per jaar" : "Omzet en winst per " + (indeling === "week" ? "week" : "maand") + " in " + jaar;
  }

  // Tooltip bij aanwijzen of tikken
  function toonTip(e, b) {
    const tip = $("tip");
    tip.innerHTML = '<strong>' + esc(bakNaam(b.sleutel, true)) + '</strong>' +
      (b.posten.length
        ? '<div><span>Omzet</span><span>' + euro(b.omzet) + '</span></div><div><span>Kosten</span><span>' + euro(b.kosten) + '</span></div>' +
          '<div class="' + (b.winst < 0 ? "rood" : "") + '"><span>' + (b.winst < 0 ? "Verlies" : "Winst") + '</span><span>' + euro(b.winst) + '</span></div>' +
          '<div class="zacht"><span>Opdrachten</span><span>' + b.posten.length + '</span></div>'
        : '<div class="zacht">Geen gefactureerde opdrachten</div>');
    tip.hidden = false;
    const vak = $("grafiek").getBoundingClientRect(), kaart = tip.parentElement.getBoundingClientRect();
    let x = e.clientX - kaart.left + 14, yy = e.clientY - kaart.top - 10;
    if (x + 220 > kaart.width) x = e.clientX - kaart.left - 230;
    tip.style.left = Math.max(4, x) + "px"; tip.style.top = Math.max(vak.top - kaart.top, yy) + "px";
  }
  let huidige = [];
  $("grafiek").addEventListener("pointermove", function (e) {
    const g = e.target.closest(".fin-kolom"); if (!g) { $("tip").hidden = true; return; }
    toonTip(e, huidige.find(function (b) { return b.sleutel === g.dataset.bak; }));
  });
  $("grafiek").addEventListener("pointerleave", function () { $("tip").hidden = true; });
  $("grafiek").addEventListener("click", function (e) {
    const g = e.target.closest(".fin-kolom"); if (!g) return;
    kiesBak(g.dataset.bak, true);
    toonTip(e, huidige.find(function (b) { return b.sleutel === g.dataset.bak; }));
  });

  // ---------- Tabellen ----------
  function tekenTabel(lijst) {
    const rijen = indeling === "week" ? lijst.filter(function (b) { return b.posten.length; }) : lijst;
    const tot = lijst.reduce(function (s, b) { s.n += b.posten.length; s.o += b.omzet; s.k += b.kosten; return s; }, { n: 0, o: 0, k: 0 });
    $("tabel-titel").textContent = indeling === "jaar" ? "Per jaar" : "Per " + (indeling === "week" ? "week" : "maand") + " – " + jaar;
    $("tabel").innerHTML = '<thead><tr><th>' + (indeling === "jaar" ? "Jaar" : indeling === "week" ? "Week" : "Maand") +
      '</th><th class="getal">Opdrachten</th><th class="getal">Omzet</th><th class="getal">Kosten</th><th class="getal">Winst</th><th class="getal">Opslag</th></tr></thead><tbody>' +
      (rijen.length ? rijen.map(function (b) {
        return '<tr class="klikbaar' + (gekozenBak === b.sleutel ? " gekozen" : "") + (b.posten.length ? "" : " leeg") + '" data-bak="' + b.sleutel + '"><td>' + esc(bakNaam(b.sleutel, indeling === "week")) + '</td>' +
          '<td class="getal">' + b.posten.length + '</td><td class="getal">' + euro(b.omzet) + '</td><td class="getal">' + euro(b.kosten) + '</td>' +
          '<td class="getal ' + (b.winst < 0 ? "rood-tekst" : "") + '">' + euro(b.winst) + '</td><td class="getal">' + pct(b.kosten ? (b.omzet / b.kosten - 1) * 100 : null) + '</td></tr>';
      }).join("") : '<tr><td colspan="6" class="zacht">Geen gefactureerde opdrachten in ' + jaar + '.</td></tr>') +
      '</tbody><tfoot><tr><td>Totaal</td><td class="getal">' + tot.n + '</td><td class="getal">' + euro(tot.o) + '</td><td class="getal">' + euro(tot.k) +
      '</td><td class="getal ' + (tot.o - tot.k < 0 ? "rood-tekst" : "") + '">' + euro(tot.o - tot.k) + '</td><td class="getal">' + pct(tot.k ? (tot.o / tot.k - 1) * 100 : null) + '</td></tr></tfoot>';
  }
  $("tabel").addEventListener("click", function (e) { const r = e.target.closest("tr[data-bak]"); if (r) kiesBak(r.dataset.bak, true); });

  function postRij(p, metFactuur) {
    const k = p.klus;
    return '<tr><td><a href="werkopdrachten.html?id=' + encodeURIComponent(k.id) + '">' + esc(k.nummer || "–") + '</a></td>' +
      '<td>' + esc(new Date(p.datum + "T12:00").toLocaleDateString("nl-NL")) + '</td><td>' + esc(k.klant) + '</td>' +
      (metFactuur ? '<td>' + esc(k.calculatie.factuurnummer || "–") + '</td><td class="getal">' + euro(p.omzet) + '</td><td class="getal">' + euro(p.kosten) +
                    '</td><td class="getal ' + (p.winst < 0 ? "rood-tekst" : "") + '">' + euro(p.winst) + '</td>'
                  : '<td class="getal">' + euro(p.verwachtOmzet) + '</td><td class="getal">' + euro(p.verwachtWinst) + '</td>') + '</tr>';
  }
  function kiesBak(sleutel, scroll) {
    gekozenBak = gekozenBak === sleutel && !scroll ? null : sleutel;
    const b = huidige.find(function (x) { return x.sleutel === sleutel; });
    teken(true);
    if (!b) return;
    $("detail-kaart").hidden = false;
    $("detail-titel").textContent = "Opdrachten – " + bakNaam(sleutel, true);
    $("detail").innerHTML = '<thead><tr><th>Nr</th><th>Datum</th><th>Klant</th><th>Factuur</th><th class="getal">Omzet</th><th class="getal">Kosten</th><th class="getal">Winst</th></tr></thead><tbody>' +
      (b.posten.length ? b.posten.slice().sort(function (a, c) { return a.datum.localeCompare(c.datum); }).map(function (p) { return postRij(p, true); }).join("")
                       : '<tr><td colspan="7" class="zacht">Geen gefactureerde opdrachten.</td></tr>') + '</tbody>';
  }

  // ---------- Aandacht ----------
  function tekenAandacht() {
    const zonderCalc = klussen.filter(function (k) { return k.status === "klaar" && !k.calculatie; });
    const nogFactureren = posten.filter(function (p) { return !p.gefactureerd && (p.klus.status === "klaar" || (p.klus.datum && p.klus.datum < vandaag)); });
    const verlies = posten.filter(function (p) { return p.gefactureerd && p.winst < 0 && p.datum.slice(0, 4) === String(jaar); });
    let html = "";
    if (nogFactureren.length) html += '<h3 class="sectie">Klaar, maar nog niet gefactureerd (' + nogFactureren.length + ')</h3>' +
      '<div class="fin-tabel-houder"><table class="tabel fin-tabel"><thead><tr><th>Nr</th><th>Datum</th><th>Klant</th><th class="getal">Verwacht</th><th class="getal">Verwachte winst</th></tr></thead><tbody>' +
      nogFactureren.map(function (p) { return postRij(p, false); }).join("") + '</tbody></table></div>';
    if (zonderCalc.length) html += '<h3 class="sectie">Klaar, maar zonder calculatie (' + zonderCalc.length + ')</h3><ul class="fin-lijst">' +
      zonderCalc.map(function (k) { return '<li><a href="werkopdrachten.html?id=' + encodeURIComponent(k.id) + '">' + esc(k.nummer || "") + " – " + esc(k.klant) + '</a></li>'; }).join("") + '</ul>';
    if (verlies.length) html += '<h3 class="sectie">Met verlies in ' + jaar + ' (' + verlies.length + ')</h3>' +
      '<div class="fin-tabel-houder"><table class="tabel fin-tabel"><thead><tr><th>Nr</th><th>Datum</th><th>Klant</th><th>Factuur</th><th class="getal">Omzet</th><th class="getal">Kosten</th><th class="getal">Winst</th></tr></thead><tbody>' +
      verlies.map(function (p) { return postRij(p, true); }).join("") + '</tbody></table></div>';
    $("aandacht").innerHTML = html || '<p class="zacht">Alles is bijgewerkt. 👍</p>';
  }

  function teken(behoudDetail) {
    document.querySelectorAll("[data-indeling]").forEach(function (k) { k.classList.toggle("actief", k.dataset.indeling === indeling); });
    $("jaar-keuze").hidden = indeling === "jaar";
    $("jaar").textContent = jaar;
    $("jaar-verder").disabled = jaar >= new Date().getFullYear();
    huidige = bakken();
    tekenTegels(huidige);
    tekenGrafiek(huidige);
    tekenTabel(huidige);
    tekenAandacht();
    if (!behoudDetail) { gekozenBak = null; $("detail-kaart").hidden = true; }
  }

  document.querySelectorAll("[data-indeling]").forEach(function (k) {
    k.addEventListener("click", function () {
      indeling = k.dataset.indeling;
      try { localStorage.setItem("gm-fin-indeling", indeling); } catch (e) {}
      teken();
    });
  });
  let maatTimer = null;
  window.addEventListener("resize", function () { clearTimeout(maatTimer); maatTimer = setTimeout(function () { tekenGrafiek(huidige); }, 150); });
  $("jaar-terug").addEventListener("click", function () { jaar--; teken(); });
  $("jaar-verder").addEventListener("click", function () { jaar++; teken(); });

  teken();
})();

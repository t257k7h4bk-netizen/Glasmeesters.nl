/* =========================================================
   Glasmeesters Planner – calculatie per werkopdracht (fase C1)
   Alleen voor de beheerder en de Administratie.

   De calculatie wordt bij de werkopdracht bewaard:
   klus.calculatie = {
     regels: [{ soort, omschrijving, aantal, eenheid, prijs, werkelijk, btw }],
     marge, gefactureerd_excl, factuurnummer, factuurdatum, notitie,
     bijgewerkt_op
   }
   prijs     = begrote kostprijs per eenheid (uit het tarievenblad)
   werkelijk = echte inkoop voor de hele regel (leeg = gelijk aan begroot)
   De verkoopprijs = kostprijs + opslag (marge %), per regel met btw.
   ========================================================= */

const Calculatie = (function () {
  let klus = null, opname = null, calc = null, klaar = false, naOpslaan = null;

  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function rond(x, n) { const f = Math.pow(10, n || 2); return Math.round((Number(x) || 0) * f) / f; }
  function getalTekst(x) { return x === null || x === undefined || x === "" ? "" : String(x).replace(".", ","); }
  function uren(van, tot) {
    if (!van || !tot) return 0;
    const a = van.split(":"), b = tot.split(":");
    return Math.max(0, (Number(b[0]) * 60 + Number(b[1]) - Number(a[0]) * 60 - Number(a[1])) / 60);
  }
  function omtrekMeter(r) {
    return 2 * ((Number(r.breedte) || 0) + (Number(r.hoogte) || 0)) * (Number(r.aantal_ruiten) || 1) / 1000;
  }

  // ---------- Regels automatisch opstellen ----------
  async function maakRegels(k, o) {
    const t = await laadTarieven();
    const btw = t.btw;
    const regels = [];
    const regel = function (soort, omschrijving, aantal, eenheid, prijs) {
      regels.push({ soort: soort, omschrijving: omschrijving, aantal: rond(aantal, 2), eenheid: eenheid, prijs: rond(prijs, 2), werkelijk: null, btw: btw });
    };
    const ramen = o ? (o.ramen || []) : [];

    if (o) {
      // Glas per soort (te berekenen m², dus met het minimum per ruit)
      const glas = {};
      ramen.forEach(function (r) {
        if (!r.glas_nieuw) return;
        const g = glas[r.glas_nieuw] = glas[r.glas_nieuw] || { m2: 0, ramen: [] };
        g.m2 += raamRekenOppervlakte(r); g.ramen.push(r.nummer);
      });
      Object.keys(glas).forEach(function (s) {
        regel("glas", s + (/glas/i.test(s) ? "" : " glas") + " (raam " + glas[s].ramen.join(", ") + ")", glas[s].m2, "m²", t.glas[s] !== undefined ? t.glas[s] : t.glas.Overig);
      });
      // Roosters per soort, in meters
      const roosters = {};
      ramen.forEach(function (r) {
        const rs = roosterSoort(r);
        if (!rs || rs === "Geen") return;
        roosters[rs] = (roosters[rs] || 0) + (Number(r.rooster_lengte) || Number(r.breedte) || 0) * (Number(r.rooster_aantal) || 1) / 1000;
      });
      Object.keys(roosters).forEach(function (s) { regel("materiaal", s, roosters[s], "m", t.rooster[s] || 0); });
      const latten = ramen.filter(function (r) { return r.glaslatten_vervangen === "Ja"; }).reduce(function (s, r) { return s + omtrekMeter(r); }, 0);
      if (latten) regel("materiaal", "Glaslatten", latten, "m", t.glaslatten);
      const kit = ramen.filter(function (r) { return r.kitsoort; }).reduce(function (s, r) { return s + omtrekMeter(r); }, 0);
      if (kit) regel("materiaal", "Kit", kit, "m", t.kit);
    } else {
      // Geen opname: de materialen uit de werkopdracht, prijs nog invullen
      (k.materialen || []).forEach(function (m) {
        regel("materiaal", m.omschrijving, leesGetal(m.aantal) || 1, m.eenheid || "stuks", 0);
      });
    }

    // Klein materiaal als percentage van glas en materiaal
    const basis = regels.reduce(function (s, r) { return s + r.aantal * r.prijs; }, 0);
    if (basis && t.klein_materiaal) regel("overig", "Klein materiaal en afvoer (" + getalTekst(t.klein_materiaal) + "%)", 1, "post", basis * t.klein_materiaal / 100);

    // Arbeid: uit de planning, anders de inschatting van de opnemer
    const mensen = (k.medewerkers || []).length;
    const planUren = uren(k.start, k.eind);
    if (k.datum && mensen && planUren) {
      regel("arbeid", "Arbeid: " + mensen + " " + (mensen === 1 ? "persoon" : "personen") + " × " + getalTekst(rond(planUren, 2)) + " uur (planning)", mensen * planUren, "uur", t.uurloon);
    } else if (o && (o.personen || o.duur_uren)) {
      const p = Number(o.personen) || 1, u = Number(o.duur_uren) || 0;
      regel("arbeid", "Arbeid: " + p + " " + (p === 1 ? "persoon" : "personen") + " × " + getalTekst(u) + " uur (inschatting opname)", p * u, "uur", t.uurloon);
    } else {
      regel("arbeid", "Arbeid (uren nog invullen)", 0, "uur", t.uurloon);
    }

    // Huur van materieel uit de opname
    if (o) {
      opnameMaterieel(o).filter(function (m) { return m.nodig && Number(t.huur[m.code]) > 0; }).forEach(function (m) {
        regel("huur", m.naam + (m.toelichting ? " – " + m.toelichting : ""), 1, "dag", t.huur[m.code]);
      });
    }

    // Vervoer: kilometers × tarief van het gekozen voertuig (standaard een bus)
    const voertuigen = await Opslag.alle("voertuigen");
    const v = voertuigen.find(function (x) { return x.id === k.voertuig; });
    const soort = v ? v.soort : "bus";
    regel("vervoer", "Vervoer " + (v ? v.naam : "(bus)") + " – heen en terug", t.km_standaard, "km", t.km[soort] || 0);
    const a = voertuigen.find(function (x) { return x.id === k.aanhanger; });
    if (a) regel("vervoer", "Aanhanger " + a.naam, t.km_standaard, "km", t.km.aanhanger || 0);
    return regels;
  }

  // ---------- Venster ----------
  function zetKlaar() {
    if (klaar) return;
    klaar = true;
    const v = document.createElement("dialog");
    v.id = "calculatie";
    v.className = "venster breed-venster calc-venster";
    v.innerHTML =
      '<form id="calc-form" method="dialog">' +
        '<div class="venster-kop">' +
          '<div><h2 id="calc-titel">Calculatie</h2><span class="zacht" id="calc-sub"></span></div>' +
          '<button type="button" class="sluit" data-calc-sluit aria-label="Sluiten">✕</button>' +
        '</div>' +
        '<div class="venster-inhoud">' +
          '<div class="melding" id="calc-melding"></div>' +
          '<div class="calc-balk">' +
            '<h3 class="sectie">Kostprijs</h3>' +
            '<button type="button" class="knop tweede klein" id="calc-opnieuw">↻ Opnieuw berekenen</button>' +
          '</div>' +
          '<p class="uitleg">De bedragen komen uit het tarievenblad. Vul bij <strong>Echte inkoop</strong> in wat iets werkelijk kostte; leeg = gelijk aan begroot.</p>' +
          '<div class="calc-tabel-houder"><table class="calc-tabel"><thead><tr>' +
            '<th>Soort</th><th>Omschrijving</th><th>Aantal</th><th>Eenheid</th><th>Prijs per eenheid</th><th>Begroot</th><th>Echte inkoop</th><th>Btw</th><th></th>' +
          '</tr></thead><tbody id="calc-regels"></tbody></table></div>' +
          '<button type="button" class="knop tweede klein" id="calc-regel-erbij">+ Regel toevoegen</button>' +

          '<h3 class="sectie">Winstmarge (opslag op de kostprijs)</h3>' +
          '<div class="calc-marge">' +
            '<input type="range" id="calc-marge-schuif" min="0" max="100" step="1" aria-label="Winstmarge">' +
            '<div class="calc-marge-getal"><input type="number" id="calc-marge" min="0" max="500" step="0.5" inputmode="decimal"> %</div>' +
            '<div class="knoppengroep klein-groep" id="calc-marge-snel">' +
              '<button type="button" data-m="20">20%</button><button type="button" data-m="30">30%</button><button type="button" data-m="40">40%</button><button type="button" data-m="50">50%</button>' +
            '</div>' +
          '</div>' +
          '<div class="calc-overzicht" id="calc-overzicht"></div>' +

          '<div class="calc-nb" id="calc-nb" hidden>' +
            '<div class="calc-balk"><h3 class="sectie">Nij Begun – subsidie en eigen bijdrage</h3>' +
              '<button type="button" class="knop tweede klein" id="calc-nb-opnieuw">↻ Maatregelen uit opname</button></div>' +
            '<div class="velden-3"><div class="veld"><label for="calc-nb-regeling">Soort subsidie</label><select id="calc-nb-regeling"></select></div></div>' +
            '<p class="uitleg">Per maatregel de prijs <strong>incl. btw</strong> zoals die op de offerte en factuur komt. Die mag niet hoger zijn dan de maximumprijs uit de catalogus.' +
              ' Wat de klant extra wil (ander materiaal, maatwerk) komt als <strong>meerkosten</strong> apart op de factuur, zonder subsidie.</p>' +
            '<div class="calc-tabel-houder"><table class="calc-tabel nb-tabel"><thead><tr>' +
              '<th>Code</th><th>Maatregel</th><th>Waarde</th><th>Aantal</th><th>Eenheid</th><th>Max. per eenheid</th><th>Max. totaal</th><th>Prijs op offerte (incl. btw)</th><th></th><th></th>' +
            '</tr></thead><tbody id="calc-nb-regels"></tbody></table></div>' +
            '<button type="button" class="knop tweede klein" id="calc-nb-erbij">+ Maatregel toevoegen</button>' +
            '<div class="calc-nb-meldingen" id="calc-nb-meldingen"></div>' +
            '<div class="calc-overzicht" id="calc-nb-overzicht"></div>' +
            '<h3 class="sectie">Afvinklijst offerte en factuur</h3>' +
            '<p class="uitleg">Zonder deze onderdelen kan SNN de subsidieaanvraag niet behandelen. Wat het programma zelf kan controleren, staat al aangevinkt.</p>' +
            '<div class="nb-check" id="calc-nb-check"></div>' +
          '</div>' +

          '<h3 class="sectie">Factuur</h3>' +
          '<div class="velden-3">' +
            '<div class="veld"><label for="calc-gefact">Gefactureerd (excl. btw)</label><input id="calc-gefact" inputmode="decimal" placeholder="bijv. 2.450,00"></div>' +
            '<div class="veld"><label for="calc-factnr">Factuurnummer</label><input id="calc-factnr"></div>' +
            '<div class="veld"><label for="calc-factdatum">Factuurdatum</label><input id="calc-factdatum" type="date"></div>' +
          '</div>' +
          '<div class="calc-winst" id="calc-winst"></div>' +
          '<div class="veld"><label for="calc-notitie">Notitie (alleen voor kantoor)</label><textarea id="calc-notitie" rows="2" class="vol"></textarea></div>' +
        '</div>' +
        '<div class="venster-voet">' +
          '<span class="ruimte"></span>' +
          '<button type="button" class="knop tweede" data-calc-sluit>Annuleren</button>' +
          '<button type="submit" class="knop">Opslaan</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(v);

    v.querySelectorAll("[data-calc-sluit]").forEach(function (k) { k.addEventListener("click", function () { v.close(); }); });
    $("calc-form").addEventListener("submit", function (e) { e.preventDefault(); opslaan(); });
    $("calc-regels").addEventListener("input", function () { leesRegels(); tekenTotalen(); });
    $("calc-regels").addEventListener("change", function () { leesRegels(); tekenRegelBedragen(); tekenTotalen(); });
    $("calc-regels").addEventListener("click", function (e) {
      const weg = e.target.closest("[data-weg]");
      if (!weg) return;
      leesRegels();
      calc.regels.splice(Number(weg.dataset.weg), 1);
      tekenRegels(); tekenTotalen();
    });
    $("calc-regel-erbij").addEventListener("click", function () {
      leesRegels();
      calc.regels.push({ soort: "overig", omschrijving: "", aantal: 1, eenheid: "stuks", prijs: 0, werkelijk: null, btw: TARIEVEN.btw });
      tekenRegels(); tekenTotalen();
      const rijen = $("calc-regels").querySelectorAll("tr");
      rijen[rijen.length - 1].querySelector(".c-oms").focus();
    });
    $("calc-opnieuw").addEventListener("click", async function () {
      if (calc.regels.length && !confirm("Alle regels opnieuw berekenen uit de opname en het tarievenblad?\nIngevulde echte inkoop en eigen regels gaan dan verloren.")) return;
      calc.regels = await maakRegels(klus, opname);
      tekenRegels(); tekenTotalen();
    });
    $("calc-marge-schuif").addEventListener("input", function () { $("calc-marge").value = this.value; calc.marge = Number(this.value); tekenTotalen(); });
    $("calc-marge").addEventListener("input", function () {
      const m = leesGetal(this.value); calc.marge = m === null ? 0 : m;
      $("calc-marge-schuif").value = Math.min(100, calc.marge); tekenTotalen();
    });
    $("calc-marge-snel").addEventListener("click", function (e) {
      const k = e.target.closest("[data-m]"); if (!k) return;
      calc.marge = Number(k.dataset.m); $("calc-marge").value = calc.marge; $("calc-marge-schuif").value = calc.marge; tekenTotalen();
    });
    $("calc-gefact").addEventListener("input", function () { calc.gefactureerd_excl = leesGetal(this.value); tekenTotalen(); });

    // Nij Begun
    $("calc-nb-regeling").innerHTML = NB_REGELINGEN.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join("");
    $("calc-nb-regeling").addEventListener("change", function () { calc.nb.regeling = this.value; tekenNb(); });
    $("calc-nb-regels").addEventListener("input", function () { leesNb(); tekenNbTotalen(); });
    $("calc-nb-regels").addEventListener("change", function () { leesNb(); tekenNbRegels(); tekenNbTotalen(); });
    $("calc-nb-regels").addEventListener("click", function (e) {
      const weg = e.target.closest("[data-nb-weg]");
      const max = e.target.closest("[data-nb-max]");
      if (!weg && !max) return;
      leesNb();
      if (weg) calc.nb.maatregelen.splice(Number(weg.dataset.nbWeg), 1);
      if (max) { const m = calc.nb.maatregelen[Number(max.dataset.nbMax)]; m.prijs = rond(m.max * m.aantal, 2); }
      tekenNbRegels(); tekenNbTotalen();
    });
    $("calc-nb-erbij").addEventListener("click", function () {
      leesNb();
      calc.nb.maatregelen.push({ code: "", omschrijving: "", waarde: "", aantal: 1, eenheid: "m²", max: null, prijs: null });
      tekenNbRegels(); tekenNbTotalen();
    });
    $("calc-nb-opnieuw").addEventListener("click", async function () {
      if (calc.nb.maatregelen.length && !confirm("De maatregelen opnieuw overnemen uit de opname? Aangepaste prijzen gaan dan verloren.")) return;
      leesRegels();
      calc.nb.maatregelen = await nbUitOpname();
      tekenNb();
    });
    $("calc-nb-check").addEventListener("change", function (e) {
      const v = e.target.closest("[data-check]");
      if (!v) return;
      calc.nb.check = calc.nb.check || {};
      calc.nb.check[v.dataset.check] = v.checked;
      tekenNbCheck();
    });
    $("calc-nb-check").addEventListener("click", function (e) {
      const k = e.target.closest("[data-kopieer]");
      if (!k || !navigator.clipboard) return;
      navigator.clipboard.writeText(NB_CODES.zin || "").then(function () { k.textContent = "Gekopieerd ✓"; setTimeout(function () { k.textContent = "Kopieer zin"; }, 2000); });
    });
  }

  // ---------- Nij Begun ----------
  function isNijBegun() { return !!(klus && (klus.nij_begun || (opname && opname.nij_begun === "Ja"))); }

  // Maatregelen uit de opname; prijs vooraf = maximumprijs, maar samen nooit meer dan de verkoopprijs
  async function nbUitOpname() {
    await laadNijBegun();
    if (!opname) return [];
    // Alleen soorten die onder Nij Begun vallen (met een code of maximumprijs bij Tarieven).
    // Is er nog niets ingesteld, dan alles tonen zodat zichtbaar is wat er ontbreekt.
    const ingesteld = Object.keys(NB_CODES.glas).length + Object.keys(NB_CODES.rooster).length > 0;
    const lijst = nbMaatregelen(opname).filter(function (g) { return !ingesteld || g.code || g.max !== null; }).map(function (g) {
      const aantal = g.max_eenheid === "m" ? g.mm / 1000 : g.max_eenheid === "stuk" ? (g.type === "glas" ? g.ramen.length : g.hoeveel) : g.hoeveel;
      return { code: g.code, omschrijving: g.omschrijving, waarde: g.waarde, aantal: rond(aantal, 2), eenheid: g.max_eenheid,
               max: g.max, prijs: g.max === null ? null : rond(g.max * aantal, 2) };
    });
    const totaal = calcTotalen(calc).verkoopIncl;
    const som = lijst.reduce(function (s, m) { return s + (m.prijs || 0); }, 0);
    if (som > totaal && som > 0) lijst.forEach(function (m) { if (m.prijs !== null) m.prijs = rond(m.prijs * totaal / som, 2); });
    return lijst;
  }

  function nbTotalen() {
    const t = calcTotalen(calc);
    const m = (calc.nb && calc.nb.maatregelen) || [];
    let som = 0, subsidiabel = 0;
    const boven = [], zonderMax = [];
    m.forEach(function (x) {
      const prijs = Number(x.prijs) || 0;
      const maxTot = x.max === null || x.max === undefined || x.max === "" ? null : Number(x.max) * (Number(x.aantal) || 0);
      som += prijs;
      if (maxTot === null) zonderMax.push(x);
      if (maxTot !== null && prijs > maxTot + 0.005) boven.push(x);
      subsidiabel += maxTot === null ? prijs : Math.min(prijs, maxTot);
    });
    const pctSub = nbPercentage(calc.nb && calc.nb.regeling);
    const totaal = Math.max(t.verkoopIncl, som);
    const subsidie = pctSub === null ? 0 : subsidiabel * pctSub / 100;
    return { verkoopIncl: t.verkoopIncl, som: som, meerkosten: Math.max(0, t.verkoopIncl - som), boven: boven, zonderMax: zonderMax,
             subsidiabel: subsidiabel, pct: pctSub, subsidie: subsidie, eigen: totaal - subsidie, totaal: totaal, teHoog: som > t.verkoopIncl + 0.005 };
  }

  function tekenNbRegels() {
    $("calc-nb-regels").innerHTML = calc.nb.maatregelen.map(function (m, i) {
      const maxTot = m.max === null || m.max === undefined || m.max === "" ? null : m.max * (Number(m.aantal) || 0);
      const boven = maxTot !== null && (Number(m.prijs) || 0) > maxTot + 0.005;
      return '<tr data-i="' + i + '"' + (boven ? ' class="boven-max"' : "") + '>' +
        '<td><input class="n-code" value="' + esc(m.code) + '" placeholder="ontbreekt" aria-label="Maatregelcode"></td>' +
        '<td><input class="n-oms" value="' + esc(m.omschrijving) + '" aria-label="Maatregel"></td>' +
        '<td><input class="n-waarde" value="' + esc(m.waarde) + '" aria-label="Waarde"></td>' +
        '<td><input class="n-aantal getal" inputmode="decimal" value="' + esc(getalTekst(m.aantal)) + '" aria-label="Aantal"></td>' +
        '<td><select class="n-eenheid" aria-label="Eenheid">' + ["m²", "m", "stuk"].map(function (e) { return '<option' + (e === m.eenheid ? " selected" : "") + '>' + e + '</option>'; }).join("") + '</select></td>' +
        '<td><input class="n-max getal" inputmode="decimal" value="' + esc(getalTekst(m.max)) + '" placeholder="onbekend" aria-label="Maximumprijs per eenheid"></td>' +
        '<td class="getal">' + (maxTot === null ? "–" : euro(maxTot)) + '</td>' +
        '<td><input class="n-prijs getal" inputmode="decimal" value="' + esc(getalTekst(m.prijs)) + '" aria-label="Prijs op offerte"></td>' +
        '<td>' + (maxTot !== null ? '<button type="button" class="knop tweede klein" data-nb-max="' + i + '" title="Prijs gelijk aan maximum">= max</button>' : "") + '</td>' +
        '<td><button type="button" class="sluit" data-nb-weg="' + i + '" aria-label="Maatregel verwijderen">✕</button></td>' +
      '</tr>';
    }).join("") || '<tr><td colspan="10" class="zacht">Nog geen maatregelen.' + (opname ? ' Tik op "Maatregelen uit opname".' : ' Voeg een maatregel toe.') + '</td></tr>';
  }

  function leesNb() {
    $("calc-nb-regels").querySelectorAll("tr[data-i]").forEach(function (rij) {
      const m = calc.nb.maatregelen[Number(rij.dataset.i)];
      m.code = rij.querySelector(".n-code").value.trim();
      m.omschrijving = rij.querySelector(".n-oms").value;
      m.waarde = rij.querySelector(".n-waarde").value;
      m.aantal = leesGetal(rij.querySelector(".n-aantal").value) || 0;
      m.eenheid = rij.querySelector(".n-eenheid").value;
      m.max = leesGetal(rij.querySelector(".n-max").value);
      m.prijs = leesGetal(rij.querySelector(".n-prijs").value);
    });
  }

  function tekenNbTotalen() {
    if (!calc.nb) return;
    const n = nbTotalen();
    let meld = "";
    if (n.boven.length) meld += '<div class="melding zichtbaar fout">⛔ <strong>Boven de maximumprijs:</strong> ' + n.boven.map(function (x) { return esc(x.omschrijving || x.code || "maatregel"); }).join(", ") +
      '. Dat mag niet bij Nij Begun: verlaag de prijs (tik op "= max") en zet het verschil eventueel als meerkosten apart.</div>';
    if (n.teHoog) meld += '<div class="melding zichtbaar waarschuwing">⚠️ De maatregelen samen (' + euro(n.som) + ') zijn hoger dan de verkoopprijs incl. btw (' + euro(n.verkoopIncl) + '). Verhoog de marge of verlaag de prijzen per maatregel.</div>';
    if (n.zonderMax.length) meld += '<div class="melding zichtbaar info">Van ' + n.zonderMax.length + ' maatregel' + (n.zonderMax.length === 1 ? "" : "en") + ' is de maximumprijs niet bekend. Vul die in onder 💶 Tarieven → Nij Begun.</div>';
    if (n.pct === null) meld += '<div class="melding zichtbaar info">Kies de soort subsidie om het subsidiebedrag te berekenen.</div>';
    $("calc-nb-meldingen").innerHTML = meld;
    $("calc-nb-overzicht").innerHTML = '<table>' +
      '<tr><td>Nij Begun-maatregelen</td><td>' + euro(n.som) + '</td></tr>' +
      '<tr><td>Meerkosten (geen subsidie)</td><td>' + euro(n.meerkosten) + '</td></tr>' +
      '<tr class="dik"><td>Totaal incl. btw</td><td>' + euro(n.totaal) + '</td></tr>' +
      '<tr><td>Subsidie via SNN' + (n.pct !== null ? " (" + n.pct + "%)" : "") + '</td><td>− ' + euro(n.subsidie) + '</td></tr>' +
      '<tr class="dik groot"><td>Eigen bijdrage klant</td><td>' + euro(n.eigen) + '</td></tr>' +
    '</table>';
    tekenNbCheck();
  }

  function nbCheckLijst() {
    const n = nbTotalen();
    const m = calc.nb.maatregelen;
    const alle = function (f) { return m.length > 0 && m.every(f); };
    const lijst = [
      { k: "code", t: "Maatregelcode bij elke maatregel", auto: alle(function (x) { return x.code; }) },
      { k: "aantal", t: "Aantal m² en/of stuks", auto: alle(function (x) { return Number(x.aantal) > 0; }) },
      { k: "waarde", t: "Dikte of waarde (bijv. U-waarde)", auto: alle(function (x) { return x.waarde; }) },
      { k: "max", t: "Prijs per maatregel niet hoger dan de maatregelencatalogus", auto: m.length > 0 && !n.boven.length && !n.zonderMax.length },
      { k: "eigen", t: "Eigen bijdrage van de woningeigenaar (" + euro(n.eigen) + ")" },
      { k: "uitvoer", t: "Uitvoerdatum per maatregel (op de factuur)" },
      { k: "totaal", t: "Totale kosten van het geheel (" + euro(n.totaal) + ")" },
      { k: "bewoner", t: "Gegevens bewoner: naam, adres en woonplaats", auto: !!(klus.klant && klus.adres) },
      { k: "bedrijf", t: "Bedrijfsgegevens: naam, adres, KvK, IBAN en BIC" },
      { k: "termijn", t: "Betaaltermijn" },
      { k: "zin", t: "De verplichte zin van Nij Begun", zin: true }
    ];
    if (n.meerkosten > 0.005) lijst.push({ k: "meer", t: "Meerkosten (" + euro(n.meerkosten) + ") als aparte post, met de vermelding dat daar geen subsidie over wordt gegeven" });
    lijst.push({ k: "voorwaarden", t: "Algemene voorwaarden meegestuurd" });
    return lijst;
  }

  function tekenNbCheck() {
    const check = calc.nb.check || {};
    const lijst = nbCheckLijst();
    let ok = 0;
    $("calc-nb-check").innerHTML = lijst.map(function (c) {
      const isAuto = c.auto !== undefined;
      const aan = isAuto ? c.auto : !!check[c.k];
      if (aan) ok++;
      return '<label class="nb-check-regel' + (aan ? " ok" : "") + '">' +
        (isAuto ? '<span class="nb-auto" aria-hidden="true">' + (aan ? "✅" : "⚠️") + '</span>'
                : '<input type="checkbox"' + (aan ? " checked" : "") + ' data-check="' + c.k + '">') + ' ' +
        '<span>' + esc(c.t) + (isAuto ? ' <em class="zacht">(' + (aan ? "gecontroleerd" : "nog niet in orde") + ')</em>' : "") +
        (c.zin ? (NB_CODES.zin ? '<span class="nb-zin">' + esc(NB_CODES.zin) + '</span> <button type="button" class="knop tweede klein" data-kopieer>Kopieer zin</button>'
                               : ' <em class="zacht">– plak de zin eerst onder 💶 Tarieven → Nij Begun</em>') : "") +
        '</span></label>';
    }).join("") + '<p class="nb-check-stand' + (ok === lijst.length ? " compleet" : "") + '">' + ok + ' van ' + lijst.length + ' in orde' + (ok === lijst.length ? " ✅" : "") + '</p>';
    calc.nb.compleet = ok === lijst.length;
  }

  function tekenNb() {
    const nb = isNijBegun();
    $("calc-nb").hidden = !nb;
    if (!nb) return;
    $("calc-nb-regeling").value = calc.nb.regeling || NB_REGELINGEN[0];
    tekenNbRegels();
    tekenNbTotalen();
  }

  function opties(lijst, gekozen) {
    return lijst.map(function (x) { const w = typeof x === "object" ? x[0] : x, n = typeof x === "object" ? x[1] : x;
      return '<option value="' + esc(w) + '"' + (String(w) === String(gekozen) ? " selected" : "") + '>' + esc(n) + '</option>'; }).join("");
  }

  function tekenRegels() {
    const soorten = Object.keys(CALC_SOORTEN).map(function (k) { return [k, CALC_SOORTEN[k]]; });
    $("calc-regels").innerHTML = calc.regels.map(function (r, i) {
      return '<tr data-i="' + i + '">' +
        '<td><select class="c-soort" aria-label="Soort">' + opties(soorten, r.soort) + '</select></td>' +
        '<td><input class="c-oms" value="' + esc(r.omschrijving) + '" aria-label="Omschrijving"></td>' +
        '<td><input class="c-aantal getal" inputmode="decimal" value="' + esc(getalTekst(r.aantal)) + '" aria-label="Aantal"></td>' +
        '<td><input class="c-eenheid" value="' + esc(r.eenheid) + '" aria-label="Eenheid"></td>' +
        '<td><input class="c-prijs getal" inputmode="decimal" value="' + esc(getalTekst(r.prijs)) + '" aria-label="Prijs per eenheid"></td>' +
        '<td class="c-begroot getal"></td>' +
        '<td><input class="c-werkelijk getal" inputmode="decimal" value="' + esc(getalTekst(r.werkelijk)) + '" placeholder="= begroot" aria-label="Echte inkoop"></td>' +
        '<td><select class="c-btw" aria-label="Btw">' + opties(BTW_TARIEVEN.map(function (b) { return [b, b + "%"]; }), r.btw) + '</select></td>' +
        '<td><button type="button" class="sluit" data-weg="' + i + '" aria-label="Regel verwijderen">✕</button></td>' +
      '</tr>';
    }).join("") || '<tr><td colspan="9" class="zacht">Nog geen regels. Tik op "Opnieuw berekenen" of voeg een regel toe.</td></tr>';
    tekenRegelBedragen();
  }

  function tekenRegelBedragen() {
    $("calc-regels").querySelectorAll("tr[data-i]").forEach(function (rij) {
      const r = calc.regels[Number(rij.dataset.i)];
      rij.querySelector(".c-begroot").textContent = euro((Number(r.aantal) || 0) * (Number(r.prijs) || 0));
      const w = rij.querySelector(".c-werkelijk");
      w.classList.toggle("anders", r.werkelijk !== null && Math.abs(r.werkelijk - (Number(r.aantal) || 0) * (Number(r.prijs) || 0)) > 0.005);
    });
  }

  function leesRegels() {
    $("calc-regels").querySelectorAll("tr[data-i]").forEach(function (rij) {
      const r = calc.regels[Number(rij.dataset.i)];
      r.soort = rij.querySelector(".c-soort").value;
      r.omschrijving = rij.querySelector(".c-oms").value;
      r.aantal = leesGetal(rij.querySelector(".c-aantal").value) || 0;
      r.eenheid = rij.querySelector(".c-eenheid").value;
      r.prijs = leesGetal(rij.querySelector(".c-prijs").value) || 0;
      r.werkelijk = leesGetal(rij.querySelector(".c-werkelijk").value);
      r.btw = Number(rij.querySelector(".c-btw").value);
    });
    tekenRegelBedragen();
  }

  function tekenTotalen() {
    const t = calcTotalen(calc);
    const btwRegels = Object.keys(t.perBtw).filter(function (b) { return Number(b) > 0; })
      .map(function (b) { return '<tr><td>Btw ' + b + '%</td><td>' + euro(t.perBtw[b]) + '</td></tr>'; }).join("");
    const inkoopAnders = Math.abs(t.kostWerkelijk - t.kostBegroot) > 0.005;
    $("calc-overzicht").innerHTML =
      '<table>' +
        '<tr><td>Kostprijs (begroot)</td><td>' + euro(t.kostBegroot) + '</td></tr>' +
        (inkoopAnders ? '<tr class="zacht"><td>Kostprijs met echte inkoop</td><td>' + euro(t.kostWerkelijk) + '</td></tr>' : "") +
        '<tr><td>Opslag ' + getalTekst(calc.marge) + '%</td><td>' + euro(t.verkoopExcl - t.kostBegroot) + '</td></tr>' +
        '<tr class="dik"><td>Verkoopprijs excl. btw</td><td>' + euro(t.verkoopExcl) + '</td></tr>' +
        btwRegels +
        '<tr class="dik groot"><td>Verkoopprijs incl. btw</td><td>' + euro(t.verkoopIncl) + '</td></tr>' +
        '<tr class="' + (t.verkoopExcl - t.kostWerkelijk >= 0 ? "groen-tekst" : "rood-tekst") + '"><td>Verwachte winst' + (inkoopAnders ? " (met echte inkoop)" : "") + '</td><td>' + euro(t.verkoopExcl - t.kostWerkelijk) + '</td></tr>' +
      '</table>';
    if (calc.nb && isNijBegun()) tekenNbTotalen();
    if (t.gefactureerd === null) {
      $("calc-winst").innerHTML = '<p class="zacht">Vul het gefactureerde bedrag in zodra de factuur de deur uit is. Dan zie je hier de nettowinst.</p>';
    } else {
      const goed = t.winstNetto >= 0;
      $("calc-winst").innerHTML =
        '<div class="calc-winst-blok ' + (goed ? "goed" : "fout") + '">' +
          '<div><span>Nettowinst</span><strong>' + euro(t.winstNetto) + '</strong></div>' +
          '<div><span>Echte opslag</span><strong>' + (t.margeEcht === null ? "–" : getalTekst(rond(t.margeEcht, 1)) + "%") + '</strong></div>' +
          '<div><span>Gefactureerd incl. ' + TARIEVEN.btw + '% btw</span><strong>' + euro(t.gefactureerd * (1 + (t.verkoopExcl ? t.btw / t.verkoopExcl : TARIEVEN.btw / 100))) + '</strong></div>' +
        '</div>';
    }
  }

  async function open(klusId, opties) {
    zetKlaar();
    naOpslaan = (opties && opties.naOpslaan) || null;
    await laadTarieven();
    await laadOpnameInstellingen();
    klus = await Opslag.haal("klussen", klusId);
    if (!klus) return;
    opname = klus.opname ? await Opslag.haal("opnames", klus.opname) : null;
    calc = JSON.parse(JSON.stringify(klus.calculatie || {}));
    const nieuw = !klus.calculatie;
    if (nieuw) {
      calc = { regels: await maakRegels(klus, opname), marge: TARIEVEN.marge, gefactureerd_excl: null, factuurnummer: "", factuurdatum: "", notitie: "" };
    }
    await laadNijBegun();
    if (isNijBegun() && !calc.nb) {
      calc.nb = { regeling: (opname && opname.nb_regeling) || (klus.nij_begun && klus.nij_begun.regeling) || NB_REGELINGEN[0], maatregelen: [], check: {} };
      calc.nb.maatregelen = await nbUitOpname();
    }
    $("calc-titel").textContent = "Calculatie – " + (klus.klant || "");
    $("calc-sub").textContent = "Opdracht " + (klus.nummer || "") + (opname ? " · opname " + opname.nummer : "") + " · alleen zichtbaar voor beheerder en administratie";
    const m = $("calc-melding");
    m.className = "melding" + (nieuw ? " zichtbaar info" : "");
    m.textContent = nieuw ? (opname ? "Nieuwe calculatie, berekend uit opname " + opname.nummer + " en het tarievenblad. Controleer de regels en sla op."
                                    : "Nieuwe calculatie. Er is geen opname gekoppeld: vul de prijzen van de materialen zelf in.") : "";
    $("calc-marge").value = getalTekst(calc.marge);
    $("calc-marge-schuif").value = Math.min(100, Number(calc.marge) || 0);
    $("calc-gefact").value = calc.gefactureerd_excl === null || calc.gefactureerd_excl === undefined ? "" : getalTekst(rond(calc.gefactureerd_excl, 2));
    $("calc-factnr").value = calc.factuurnummer || "";
    $("calc-factdatum").value = calc.factuurdatum || "";
    $("calc-notitie").value = calc.notitie || "";
    tekenRegels();
    tekenNb();
    tekenTotalen();
    $("calculatie").showModal();
  }

  async function opslaan() {
    leesRegels();
    if (calc.nb && isNijBegun()) {
      leesNb();
      calc.nb.maatregelen = calc.nb.maatregelen.filter(function (m) { return m.code || (m.omschrijving || "").trim() || m.prijs; });
      tekenNbCheck();
    }
    calc.regels = calc.regels.filter(function (r) { return (r.omschrijving || "").trim() || r.aantal || r.prijs || r.werkelijk; });
    calc.factuurnummer = $("calc-factnr").value.trim();
    calc.factuurdatum = $("calc-factdatum").value;
    calc.notitie = $("calc-notitie").value.trim();
    calc.gefactureerd_excl = leesGetal($("calc-gefact").value);
    calc.bijgewerkt_op = new Date().toISOString();
    const t = calcTotalen(calc);
    calc.totalen = { kost: rond(t.kostWerkelijk), verkoop_excl: rond(t.verkoopExcl), verkoop_incl: rond(t.verkoopIncl), winst: t.winstNetto === null ? null : rond(t.winstNetto) };
    if (calc.nb && isNijBegun()) {
      const n = nbTotalen();
      calc.totalen.nb = { boven_max: n.boven.length, subsidie: rond(n.subsidie), eigen_bijdrage: rond(n.eigen), meerkosten: rond(n.meerkosten), compleet: !!calc.nb.compleet };
    }
    const vers = await Opslag.haal("klussen", klus.id);
    vers.calculatie = calc;
    await Opslag.bewaar("klussen", vers);
    let rol = "";
    try { rol = huidigeRol(); } catch (e) {}
    await Opslag.bewaar("logboek", {
      wanneer: new Date().toISOString(), rol: rol, actie: "Calculatie opgeslagen",
      details: "Opdracht " + vers.nummer + " (" + vers.klant + "): verkoop " + euro(t.verkoopExcl) + " excl. btw" +
               (t.winstNetto !== null ? ", nettowinst " + euro(t.winstNetto) : "")
    });
    $("calculatie").close();
    if (naOpslaan) naOpslaan(vers);
  }

  return { open: open, maakRegels: maakRegels };
})();

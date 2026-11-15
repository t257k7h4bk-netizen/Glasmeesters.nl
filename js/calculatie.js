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
    tekenTotalen();
    $("calculatie").showModal();
  }

  async function opslaan() {
    leesRegels();
    calc.regels = calc.regels.filter(function (r) { return (r.omschrijving || "").trim() || r.aantal || r.prijs || r.werkelijk; });
    calc.factuurnummer = $("calc-factnr").value.trim();
    calc.factuurdatum = $("calc-factdatum").value;
    calc.notitie = $("calc-notitie").value.trim();
    calc.gefactureerd_excl = leesGetal($("calc-gefact").value);
    calc.bijgewerkt_op = new Date().toISOString();
    const t = calcTotalen(calc);
    calc.totalen = { kost: rond(t.kostWerkelijk), verkoop_excl: rond(t.verkoopExcl), verkoop_incl: rond(t.verkoopIncl), winst: t.winstNetto === null ? null : rond(t.winstNetto) };
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

/* =========================================================
   Glasmeesters Planner – werkopdracht (gedeeld venster)
   Dit venster wordt gebruikt in de Planning én op het tabblad
   Werkopdrachten, zodat alles op één plek geregeld is.

   In de opslag heet een werkopdracht nog "klussen" (zo heette
   het in fase 2); de gegevens zijn daardoor gewoon bewaard.

   Harde controles bij opslaan (opslaan lukt niet):
   - medewerker staat op hetzelfde moment al op een andere opdracht
   - medewerker is afwezig of niet actief
   ========================================================= */

const Werkopdracht = (function () {

  const ctx = {
    medewerkers: [], klussen: [], afwezigheid: [], voertuigen: [], gereedschap: [],
    dagdelen: { ochtend_van: "07:30", ochtend_tot: "12:00", middag_van: "12:30", middag_tot: "16:30" },
    magBewerken: false,
    magFotos: false,     // foto's toevoegen mag ook de medewerker (bij zijn eigen opdracht)
    naOpslaan: null,     // functie(opdracht) die de pagina na opslaan/verwijderen uitvoert
    toast: null          // functie(tekst, soort, ongedaan)
  };

  let huidige = null;             // opdracht die open staat (null = nieuw)
  let gekozen = [];               // gekozen medewerker-id's
  let gekozenGereedschap = [];    // gekozen gereedschap-id's
  let materialen = [];            // [{ omschrijving, aantal, eenheid }]
  let waarschuwingGezien = "";    // na "Toch opslaan" niet opnieuw vragen
  let opdrachtId = null;          // id van de open opdracht (bij een nieuwe alvast gemaakt)
  let isNieuw = false, isOpgeslagen = false;
  let bestanden = [];             // bestanden van deze opdracht
  let urls = [];                  // tijdelijke adressen voor miniaturen

  let ophefVerzoek = null;        // { reden, redenen } als de beheerder een blokkade opheft
  let naWhatsApp = false;         // na opslaan meteen het WhatsApp-venster openen
  let berichten = [];             // vastgelegde WhatsApp-berichten van deze opdracht

  const MAX_DOCUMENT = 10 * 1024 * 1024;   // 10 MB
  const MAX_FOTO_PIXELS = 1600;            // foto's worden verkleind tot max. 1600 pixels
  let klaarGezet = false;

  // ---------- Hulpfuncties ----------
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function naam(m) { return m ? m.voornaam + " " + m.achternaam : "Onbekend"; }
  function medewerker(id) { return ctx.medewerkers.find(function (m) { return m.id === id; }); }
  function voertuig(id) { return ctx.voertuigen.find(function (v) { return v.id === id; }); }
  function gereedschapItem(id) { return ctx.gereedschap.find(function (g) { return g.id === id; }); }
  function overlapt(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }
  function telt(k) { return k.datum && k.status !== "geannuleerd"; }
  function afwezigOp(id, datum) {
    return ctx.afwezigheid.find(function (a) { return a.medewerker === id && a.van <= datum && datum <= a.tot; });
  }
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // ---------- Controles ----------
  // controleer() geeft alles terug wat er aan een opdracht schort:
  //   rood   = opslaan kan niet ({ tekst, soort: "dubbel" | "bevoegdheid" })
  //   oranje = waarschuwing, opslaan mag na bevestiging (tekst)
  // Een "bevoegdheid"-blokkade kan de beheerder opheffen met een reden.

  // Een hoger rijbewijs telt ook voor een lager (BE en C tellen ook als B, CE telt overal voor)
  const OOK_GELDIG = {
    rijbewijs_b: ["rijbewijs_be", "rijbewijs_c", "rijbewijs_ce"],
    rijbewijs_be: ["rijbewijs_ce"],
    rijbewijs_c: ["rijbewijs_ce"]
  };

  function heeft(m, code, datum) {
    const codes = [code].concat(OOK_GELDIG[code] || []);
    return (m.bevoegdheden || []).some(function (b) {
      if (codes.indexOf(b.code) === -1) return false;
      const s = statusBevoegdheid(b, datum);
      return s === "geldig" || s === "bijna";
    });
  }

  function kleineLetter(t) { return t.charAt(0).toLowerCase() + t.slice(1); }

  function opsomming(namen) {
    if (namen.length <= 1) return namen.join("");
    return namen.slice(0, -1).join(", ") + " en " + namen[namen.length - 1];
  }

  function controleer(klus) {
    const rood = [], oranje = [];
    if (!telt(klus)) return { rood: rood, oranje: oranje };
    const mensen = (klus.medewerkers || []).map(medewerker).filter(Boolean);

    // 1. Dubbele boekingen, afwezigheid, niet actief
    mensen.forEach(function (m) {
      if (!m.actief) rood.push({ tekst: naam(m) + " is niet actief.", soort: "dubbel" });
      const af = afwezigOp(m.id, klus.datum);
      if (af) rood.push({ tekst: naam(m) + " is afwezig (" + af.soort.toLowerCase() + ").", soort: "dubbel" });
      ctx.klussen.forEach(function (k) {
        if (k.id === klus.id || !telt(k) || k.datum !== klus.datum) return;
        if ((k.medewerkers || []).indexOf(m.id) === -1) return;
        if (overlapt(klus.start, klus.eind, k.start, k.eind)) {
          rood.push({ tekst: naam(m) + " staat al ingepland van " + k.start + " tot " + k.eind + " bij " + k.klant + ".", soort: "dubbel" });
        }
      });
    });

    // 2. Voertuig en aanhanger: niet inzetbaar of dubbel geboekt
    const v = voertuig(klus.voertuig), a = voertuig(klus.aanhanger);
    [v, a].forEach(function (x) {
      if (!x) return;
      if (x.status === "buiten_gebruik") rood.push({ tekst: x.naam + " is tijdelijk niet inzetbaar" + (x.bijzonderheden ? " (" + x.bijzonderheden + ")" : "") + ".", soort: "dubbel" });
      // APK of verzekering verlopen op de dag van de klus: mag de weg niet op
      voertuigMeldingen(x, klus.datum).forEach(function (mld) {
        if (mld.niveau === "rood" && (mld.soort === "apk" || mld.soort === "verzekering")) {
          rood.push({ tekst: x.naam + ": " + mld.tekst + ". Dit voertuig mag niet de weg op.", soort: "dubbel" });
        } else if (mld.soort === "onderhoud" && mld.niveau === "rood") {
          oranje.push(x.naam + ": " + mld.tekst + ".");
        }
      });
      ctx.klussen.forEach(function (k) {
        if (k.id === klus.id || !telt(k) || k.datum !== klus.datum) return;
        if (k.voertuig !== x.id && k.aanhanger !== x.id) return;
        if (overlapt(klus.start, klus.eind, k.start, k.eind)) {
          rood.push({ tekst: x.naam + " is al ingepland van " + k.start + " tot " + k.eind + " bij " + k.klant + ".", soort: "dubbel" });
        }
      });
    });

    // 3. Rijbewijs: minstens één medewerker moet voertuig (+ aanhanger) mogen besturen
    if (mensen.length && (v || a)) {
      const nodig = [];
      if (v) nodig.push(v.vereist_rijbewijs || "rijbewijs_b");
      if (a && a.vereist_rijbewijs === "rijbewijs_be") nodig.push(v && v.vereist_rijbewijs === "rijbewijs_c" ? "rijbewijs_ce" : "rijbewijs_be");
      else if (a && !v) nodig.push(a.vereist_rijbewijs || "rijbewijs_b");
      // Dubbele weghalen, en een rijbewijs dat al gedekt wordt door een hoger rijbewijs (C valt onder CE)
      const uniek = nodig.filter(function (c, i) { return nodig.indexOf(c) === i; })
        .filter(function (c, i, lijst) {
          return !lijst.some(function (d) { return d !== c && (OOK_GELDIG[c] || []).indexOf(d) !== -1; });
        });
      const bestuurders = mensen.filter(function (m) { return uniek.every(function (c) { return heeft(m, c, klus.datum); }); });
      if (!bestuurders.length) {
        const wat = opsomming(uniek.map(bevoegdheidNaam).map(kleineLetter));
        const waarvoor = [v ? v.naam : null, a ? a.naam : null].filter(Boolean).join(" met ");
        rood.push({
          soort: "bevoegdheid",
          tekst: mensen.length === 1
            ? "LET OP: " + naam(mensen[0]) + " beschikt niet over een geldig " + wat + ", nodig voor " + waarvoor + "."
            : "LET OP: niemand op deze opdracht heeft een geldig " + wat + ", nodig voor " + waarvoor + "."
        });
      }
    }

    // 4. Gereedschap: defect/afgekeurd, of een bevoegdheid nodig
    (klus.gereedschap || []).forEach(function (gid) {
      const g = gereedschapItem(gid);
      if (!g) return;
      if (g.status === "defect" || g.status === "afgekeurd") {
        rood.push({ tekst: g.naam + " is " + GEREEDSCHAP_STATUS[g.status].toLowerCase() + " en mag niet gebruikt worden.", soort: "dubbel" });
      }
      if (g.vereist && mensen.length && !mensen.some(function (m) { return heeft(m, g.vereist, klus.datum); })) {
        const def = BEVOEGDHEDEN.find(function (d) { return d.code === g.vereist; }) || {};
        const tekst = "LET OP: niemand op deze opdracht heeft een geldig certificaat \"" + bevoegdheidNaam(g.vereist) + "\" voor " + g.naam + ".";
        if (def.wettelijk) rood.push({ tekst: tekst, soort: "bevoegdheid" });
        else oranje.push(tekst);
      }
      const elders = ctx.klussen.find(function (k) {
        return k.id !== klus.id && telt(k) && k.datum === klus.datum && (k.gereedschap || []).indexOf(gid) !== -1 &&
               overlapt(klus.start, klus.eind, k.start, k.eind);
      });
      if (elders) oranje.push(g.naam + " is op dat moment ook ingepland bij " + elders.klant + " (" + elders.start + "–" + elders.eind + ").");
    });

    // 5. Ervaring die bij het werk hoort (waarschuwing)
    if (mensen.length) {
      const nodigErvaring = [];
      (klus.soort_werk || []).forEach(function (w) { if (ERVARING_VOOR_WERK[w]) nodigErvaring.push(ERVARING_VOOR_WERK[w]); });
      if (ERVARING_VOOR_GLAS[klus.soort_glas]) nodigErvaring.push(ERVARING_VOOR_GLAS[klus.soort_glas]);
      nodigErvaring.filter(function (c, i) { return nodigErvaring.indexOf(c) === i; }).forEach(function (code) {
        if (!mensen.some(function (m) { return heeft(m, code, klus.datum); })) {
          oranje.push("Niemand op deze opdracht heeft \"" + kleineLetter(bevoegdheidNaam(code)) + "\".");
        }
      });
    }

    // 6. Verlopen of ontbrekende VCA bij de buitendienst (waarschuwing)
    mensen.forEach(function (m) {
      if (groepVanFunctie(m.functie) !== "buitendienst") return;
      if (!heeft(m, "vca_basis", klus.datum) && !heeft(m, "vca_vol", klus.datum)) {
        const had = (m.bevoegdheden || []).some(function (b) { return b.code === "vca_basis" || b.code === "vca_vol"; });
        oranje.push("VCA van " + naam(m) + (had ? " is verlopen." : " ontbreekt."));
      }
    });

    // 7. Geen voertuig gekozen (waarschuwing)
    if (mensen.length && !klus.voertuig) oranje.push("Er is nog geen voertuig gekozen.");

    return { rood: rood, oranje: oranje };
  }

  // Blokkades die niet (meer) zijn opgeheven door de beheerder
  function openBlokkades(klus) {
    const opgeheven = (klus.opheffing && klus.opheffing.redenen) || [];
    return controleer(klus).rood.filter(function (r) {
      return !(r.soort === "bevoegdheid" && opgeheven.indexOf(r.tekst) !== -1);
    });
  }

  function blokkades(klus) { return openBlokkades(klus).map(function (r) { return r.tekst; }); }
  function waarschuwingen(klus) { return controleer(klus).oranje; }

  function statusVoor(id, datum, start, eind, negeerId) {
    const m = medewerker(id);
    if (!datum) return { soort: "grijs", tekst: "" };
    if (!m.actief) return { soort: "grijs", tekst: "niet actief" };
    const af = afwezigOp(id, datum);
    if (af) return { soort: "grijs", tekst: "afwezig: " + af.soort.toLowerCase() };
    const zelfdeDag = ctx.klussen.filter(function (k) {
      return k.id !== negeerId && telt(k) && k.datum === datum && (k.medewerkers || []).indexOf(id) !== -1;
    });
    const bots = zelfdeDag.find(function (k) { return overlapt(start, eind, k.start, k.eind); });
    if (bots) return { soort: "rood", tekst: "bezet " + bots.start + "–" + bots.eind + " (" + bots.klant + ")" };
    if (zelfdeDag.length) return { soort: "groen", tekst: "vrij (verder: " + zelfdeDag.map(function (k) { return k.start + "–" + k.eind; }).join(", ") + ")" };
    return { soort: "groen", tekst: "vrij" };
  }

  // ---------- Opdrachtnummers: 2026-0001, 2026-0002, ... ----------
  async function nieuwNummer() {
    const jaar = new Date().getFullYear();
    const teller = (await Opslag.haal("instellingen", "teller")) || { id: "teller" };
    const laatste = teller.jaar === jaar ? teller.laatste : 0;
    teller.jaar = jaar;
    teller.laatste = laatste + 1;
    await Opslag.bewaar("instellingen", teller);
    return jaar + "-" + String(teller.laatste).padStart(4, "0");
  }

  // Oudere opdrachten (uit fase 2) krijgen alsnog een nummer en status
  async function zorgVoorNummers() {
    const alle = await Opslag.alle("klussen");
    const zonder = alle.filter(function (k) { return !k.nummer; })
      .sort(function (a, b) { return ((a.datum || "") + (a.start || "")).localeCompare((b.datum || "") + (b.start || "")); });
    for (const k of zonder) {
      k.nummer = await nieuwNummer();
      if (!k.status) k.status = k.datum ? "gepland" : "concept";
      if (!k.soort_werk) k.soort_werk = [];
      await Opslag.bewaar("klussen", k);
    }
    return zonder.length > 0;
  }

  // ---------- Het venster (één keer in de pagina zetten) ----------
  function zetKlaar() {
    if (klaarGezet) return;
    klaarGezet = true;

    const statusOpties = STATUSSEN.map(function (s) { return '<option value="' + s.code + '">' + s.naam + '</option>'; }).join("");
    const glasOpties = '<option value="">– kies –</option>' + GLASSOORTEN.map(function (g) { return '<option>' + g + '</option>'; }).join("");
    const werkVakjes = WERKZAAMHEDEN.map(function (w, i) {
      return '<label class="werkvakje"><input type="checkbox" value="' + esc(w) + '" id="wo-w' + i + '"> ' + esc(w) + '</label>';
    }).join("");

    const venster = document.createElement("dialog");
    venster.id = "werkopdracht";
    venster.className = "venster breed-venster";
    venster.innerHTML =
      '<form id="wo-form" method="dialog">' +
        '<div class="venster-kop">' +
          '<div><h2 id="wo-titel">Werkopdracht</h2><span class="zacht" id="wo-nummer"></span></div>' +
          '<button type="button" class="sluit" data-wo-sluit aria-label="Sluiten">✕</button>' +
        '</div>' +
        '<div class="venster-inhoud">' +

          '<h3 class="sectie">Klant</h3>' +
          '<div class="velden-2">' +
            '<div class="veld"><label for="wo-klant">Naam klant</label><input id="wo-klant" required placeholder="Bijv. Familie Jansen"></div>' +
            '<div class="veld"><label for="wo-status">Status</label><select id="wo-status">' + statusOpties + '</select></div>' +
            '<div class="veld"><label for="wo-tel">Telefoon klant</label><input id="wo-tel" type="tel" inputmode="tel"></div>' +
            '<div class="veld"><label for="wo-mail">E-mail klant</label><input id="wo-mail" type="email"></div>' +
          '</div>' +
          '<div class="veld"><label for="wo-adres">Adres van de werkzaamheden</label><input id="wo-adres" class="vol" placeholder="Straat en huisnummer, plaats"></div>' +

          '<h3 class="sectie">Planning</h3>' +
          '<div class="velden-2">' +
            '<div class="veld"><label for="wo-datum">Datum <span class="zacht">(leeg = nog niet gepland)</span></label><input type="date" id="wo-datum"></div>' +
            '<div class="veld"><label>Tijd</label><div class="dagdelen">' +
              '<button type="button" data-wo-dagdeel="ochtend">Ochtend</button>' +
              '<button type="button" data-wo-dagdeel="middag">Middag</button>' +
              '<button type="button" data-wo-dagdeel="dag">Hele dag</button>' +
            '</div></div>' +
            '<div class="veld"><label for="wo-start">Starttijd</label><input type="time" id="wo-start" step="900"></div>' +
            '<div class="veld"><label for="wo-eind">Verwachte eindtijd</label><input type="time" id="wo-eind" step="900"></div>' +
          '</div>' +
          '<div class="veld">' +
            '<label>Medewerkers <span class="zacht" id="wo-aantal"></span></label>' +
            '<input type="search" id="wo-zoek" class="vol" placeholder="Zoek medewerker…" aria-label="Zoek medewerker" style="margin-bottom:8px">' +
            '<div class="keuzelijst" id="wo-medewerkers"></div>' +
          '</div>' +

          '<h3 class="sectie">Werkzaamheden</h3>' +
          '<div class="werkvakjes" id="wo-werk">' + werkVakjes + '</div>' +
          '<div class="velden-2">' +
            '<div class="veld"><label for="wo-glas">Soort glas</label><select id="wo-glas">' + glasOpties + '</select></div>' +
          '</div>' +
          '<div class="veld"><label for="wo-omschrijving">Omschrijving <span class="zacht">(één regel per onderdeel, bijv. "Vervangen van 4 HR++ ruiten")</span></label>' +
            '<textarea id="wo-omschrijving" rows="4"></textarea></div>' +
          '<div class="veld"><label for="wo-bijz">Bijzonderheden</label><textarea id="wo-bijz" rows="2" placeholder="Bijv. eerst aanbellen bij de achterdeur"></textarea></div>' +
          '<h3 class="sectie">Voertuig en materieel</h3>' +
          '<div class="velden-2">' +
            '<div class="veld"><label for="wo-voertuig">Voertuig</label><select id="wo-voertuig" class="vol"></select></div>' +
            '<div class="veld"><label for="wo-aanhanger">Aanhanger</label><select id="wo-aanhanger" class="vol"></select></div>' +
          '</div>' +
          '<div class="veld"><label>Gereedschap <span class="zacht" id="wo-gereedschap-aantal"></span></label>' +
            '<div class="keuzelijst" id="wo-gereedschap"></div></div>' +
          '<div class="veld"><label>Mee te nemen materialen</label>' +
            '<div class="materialen" id="wo-materialen"></div>' +
            '<div class="snelknoppen wo-bewerk-blok" id="wo-snel"></div>' +
          '</div>' +
          '<h3 class="sectie">Foto\'s en documenten</h3>' +
          '<div class="bestand-knoppen" id="wo-bestand-knoppen">' +
            '<label class="knop tweede klein" for="wo-foto">📷 Foto maken of kiezen</label>' +
            '<input type="file" id="wo-foto" accept="image/*" multiple hidden>' +
            '<label class="knop tweede klein wo-alleen-bewerk" for="wo-document">📄 Document toevoegen</label>' +
            '<input type="file" id="wo-document" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*" multiple hidden>' +
            '<span class="zacht" id="wo-bezig"></span>' +
          '</div>' +
          '<div class="bestanden" id="wo-bestanden"></div>' +
          '<h3 class="sectie">WhatsApp</h3>' +
          '<div id="wo-wa-status" class="wa-status"></div>' +
          '<button type="button" class="knop wa-knop wo-alleen-bewerk" id="wo-wa-knop">💬 Opslaan en WhatsApp sturen</button>' +
          '<p class="zacht">Rijbewijs-controles bij voertuig en aanhanger volgen in fase 4.</p>' +
          '<div class="melding" id="wo-melding"></div>' +
        '</div>' +
        '<div class="venster-voet wo-bewerk">' +
          '<button type="button" class="knop gevaar" id="wo-verwijder">Verwijderen</button>' +
          '<span class="ruimte"></span>' +
          '<button type="button" class="knop tweede" data-wo-sluit>Annuleren</button>' +
          '<button type="submit" class="knop">Opslaan</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(venster);

    // Gebeurtenissen
    venster.querySelectorAll("[data-wo-sluit]").forEach(function (k) { k.addEventListener("click", function () { venster.close(); }); });
    venster.addEventListener("click", function (e) { if (e.target === venster) venster.close(); });

    $("wo-medewerkers").addEventListener("change", function (e) {
      if (e.target.type !== "checkbox") return;
      const id = e.target.value;
      if (e.target.checked) { if (gekozen.indexOf(id) === -1) gekozen.push(id); }
      else gekozen = gekozen.filter(function (x) { return x !== id; });
      tekenMedewerkers();
    });
    ["wo-datum", "wo-start", "wo-eind"].forEach(function (id) {
      $(id).addEventListener("change", function () { markeerDagdeel(); tekenMedewerkers(); tekenVoertuigen(); tekenGereedschap(); waarschuwingGezien = ""; });
    });
    $("wo-zoek").addEventListener("input", tekenMedewerkers);

    venster.querySelectorAll("[data-wo-dagdeel]").forEach(function (k) {
      k.addEventListener("click", function () {
        if (!ctx.magBewerken) return;
        const d = k.dataset.woDagdeel, dd = ctx.dagdelen;
        $("wo-start").value = d === "middag" ? dd.middag_van : dd.ochtend_van;
        $("wo-eind").value = d === "ochtend" ? dd.ochtend_tot : dd.middag_tot;
        markeerDagdeel();
        tekenMedewerkers();
        tekenVoertuigen();
        tekenGereedschap();
        waarschuwingGezien = "";
      });
    });

    $("wo-voertuig").addEventListener("change", function () { waarschuwingGezien = ""; });
    $("wo-aanhanger").addEventListener("change", function () { waarschuwingGezien = ""; });
    $("wo-gereedschap").addEventListener("change", function (e) {
      if (e.target.type !== "checkbox") return;
      const id = e.target.value;
      if (e.target.checked) { if (gekozenGereedschap.indexOf(id) === -1) gekozenGereedschap.push(id); }
      else gekozenGereedschap = gekozenGereedschap.filter(function (x) { return x !== id; });
      waarschuwingGezien = "";
      tekenGereedschap();
    });
    $("wo-snel").innerHTML = MATERIALEN.map(function (m, i) {
      return '<button type="button" class="snel" data-snel="' + i + '">+ ' + esc(m.omschrijving) + '</button>';
    }).join("") + '<button type="button" class="snel" data-snel="leeg">+ Andere regel</button>';
    $("wo-snel").addEventListener("click", function (e) {
      const k = e.target.closest("[data-snel]");
      if (!k) return;
      leesMaterialen();
      const m = k.dataset.snel === "leeg" ? { omschrijving: "", eenheid: "stuks" } : MATERIALEN[Number(k.dataset.snel)];
      materialen.push({ omschrijving: m.omschrijving, aantal: "", eenheid: m.eenheid });
      tekenMaterialen(true);
    });
    $("wo-materialen").addEventListener("click", function (e) {
      const k = e.target.closest("[data-weg]");
      if (!k) return;
      leesMaterialen();
      materialen.splice(Number(k.dataset.weg), 1);
      tekenMaterialen();
    });

    $("wo-foto").addEventListener("change", function (e) { voegToe(e.target.files, "foto"); e.target.value = ""; });
    $("wo-document").addEventListener("change", function (e) { voegToe(e.target.files, "document"); e.target.value = ""; });
    $("wo-bestanden").addEventListener("click", function (e) {
      const weg = e.target.closest("[data-bestand-weg]");
      if (weg) { verwijderBestand(weg.dataset.bestandWeg); return; }
      const open = e.target.closest("[data-bestand]");
      if (open) bekijk(open.dataset.bestand);
    });

    // Groot bekijken van een foto
    const kijker = document.createElement("dialog");
    kijker.id = "wo-kijker";
    kijker.className = "kijker";
    kijker.innerHTML = '<button type="button" class="sluit kijker-sluit" aria-label="Sluiten">✕</button><img id="wo-kijker-img" alt=""><div class="kijker-naam" id="wo-kijker-naam"></div>';
    document.body.appendChild(kijker);
    kijker.addEventListener("click", function () { kijker.close(); });

    // Venster dicht: een nieuwe, niet-opgeslagen opdracht ruimt zijn bestanden op
    venster.addEventListener("close", async function () {
      urls.forEach(function (u) { URL.revokeObjectURL(u); });
      urls = [];
      if (isNieuw && !isOpgeslagen) {
        for (const b of bestanden) await Opslag.verwijder("bestanden", b.id);
      }
    });

    // WhatsApp-venster
    const wa = document.createElement("dialog");
    wa.id = "wo-wa";
    wa.className = "venster breed-venster";
    wa.innerHTML =
      '<div class="venster-kop"><div><h2>WhatsApp-berichten</h2><span class="zacht" id="wo-wa-sub"></span></div>' +
      '<button type="button" class="sluit" data-wa-sluit aria-label="Sluiten">✕</button></div>' +
      '<div class="venster-inhoud">' +
        '<p class="uitleg">Controleer het bericht en pas het eventueel aan. Tik daarna op <strong>Open in WhatsApp</strong> en druk in WhatsApp op Verzenden. Doe dit per medewerker.</p>' +
        '<div id="wo-wa-lijst"></div>' +
      '</div>' +
      '<div class="venster-voet"><span class="ruimte"></span><button type="button" class="knop" data-wa-sluit>Klaar</button></div>';
    document.body.appendChild(wa);
    wa.querySelectorAll("[data-wa-sluit]").forEach(function (k) { k.addEventListener("click", function () { wa.close(); }); });
    wa.addEventListener("input", function (e) {
      if (!e.target.classList.contains("wa-tekst")) return;
      const kaart = e.target.closest(".wa-kaart");
      const knop = kaart.querySelector(".wa-open");
      if (knop && knop.dataset.tel) knop.href = WhatsApp.link(knop.dataset.tel, e.target.value);
    });
    wa.addEventListener("click", async function (e) {
      const open = e.target.closest(".wa-open");
      if (open && !open.classList.contains("uit")) {
        const kaart = open.closest(".wa-kaart");
        await Opslag.bewaar("whatsapp", {
          opdracht: kaart.dataset.opdracht, medewerker: kaart.dataset.medewerker,
          tekst: kaart.querySelector(".wa-tekst").value, geopend_op: new Date().toISOString(),
          door: typeof huidigeRol === "function" ? huidigeRol() : "", status: "geopend"
        });
        await laadBerichten(kaart.dataset.opdracht);
        kaart.querySelector(".wa-kaart-status").innerHTML = statusTekst(kaart.dataset.medewerker);
        return;
      }
      const kopieer = e.target.closest(".wa-kopieer");
      if (kopieer) {
        const tekst = kopieer.closest(".wa-kaart").querySelector(".wa-tekst").value;
        try { await navigator.clipboard.writeText(tekst); kopieer.textContent = "Gekopieerd ✓"; }
        catch (fout) { kopieer.textContent = "Kopiëren lukt niet"; }
        setTimeout(function () { kopieer.textContent = "Kopieer tekst"; }, 2000);
      }
    });

    $("wo-wa-knop").addEventListener("click", function () {
      naWhatsApp = true;
      $("wo-form").requestSubmit();
    });

    $("wo-form").addEventListener("submit", opslaan);
    $("wo-verwijder").addEventListener("click", verwijderen);
  }

  function markeerDagdeel() {
    const s = $("wo-start").value, e = $("wo-eind").value, dd = ctx.dagdelen;
    const welke = s === dd.ochtend_van && e === dd.ochtend_tot ? "ochtend" :
                  s === dd.middag_van && e === dd.middag_tot ? "middag" :
                  s === dd.ochtend_van && e === dd.middag_tot ? "dag" : "";
    document.querySelectorAll("[data-wo-dagdeel]").forEach(function (k) { k.classList.toggle("actief", k.dataset.woDagdeel === welke); });
  }

  function tekenMedewerkers() {
    const datum = $("wo-datum").value, start = $("wo-start").value, eind = $("wo-eind").value;
    const zoek = $("wo-zoek").value.trim().toLowerCase();
    const negeer = huidige ? huidige.id : null;
    const isGekozen = function (id) { return gekozen.indexOf(id) !== -1; };

    const lijst = ctx.medewerkers
      .filter(function (m) { return isGekozen(m.id) || (m.actief && groepVanFunctie(m.functie) !== "kantoor"); })
      .filter(function (m) { return isGekozen(m.id) || !zoek || naam(m).toLowerCase().indexOf(zoek) !== -1; })
      .sort(function (a, b) {
        return (isGekozen(a.id) ? 0 : 1) - (isGekozen(b.id) ? 0 : 1) || a.voornaam.localeCompare(b.voornaam, "nl");
      });

    $("wo-medewerkers").innerHTML = lijst.map(function (m) {
      const s = datum && start && eind ? statusVoor(m.id, datum, start, eind, negeer) : { soort: "grijs", tekst: datum ? "" : "kies eerst een datum" };
      const aan = isGekozen(m.id);
      return '<label class="keuze-item' + (aan ? " aan" : "") + '">' +
               '<input type="checkbox" value="' + m.id + '"' + (aan ? " checked" : "") + (ctx.magBewerken ? "" : " disabled") + '>' +
               '<span class="keuze-naam">' + esc(naam(m)) + ' <span class="zacht">' + esc(m.functie) + '</span></span>' +
               '<span class="status-tekst ' + s.soort + '">' + esc(s.tekst) + '</span>' +
             '</label>';
    }).join("");
    $("wo-aantal").textContent = gekozen.length ? "(" + gekozen.length + " gekozen)" : "";
  }

  // Wie gebruikt dit voertuig/gereedschap al op het gekozen moment?
  function bezetDoor(veld, id) {
    const datum = $("wo-datum").value, start = $("wo-start").value, eind = $("wo-eind").value;
    if (!datum || !start || !eind) return null;
    const negeer = huidige ? huidige.id : null;
    return ctx.klussen.find(function (k) {
      if (k.id === negeer || !telt(k) || k.datum !== datum || !overlapt(start, eind, k.start, k.eind)) return false;
      if (veld === "voertuig") return k.voertuig === id || k.aanhanger === id;
      return (k.gereedschap || []).indexOf(id) !== -1;
    });
  }

  function tekenVoertuigen() {
    const huidigV = $("wo-voertuig").value || (huidige && huidige.voertuig) || "";
    const huidigA = $("wo-aanhanger").value || (huidige && huidige.aanhanger) || "";
    const optie = function (v, gekozenId) {
      let extra = "";
      const datumKlus = $("wo-datum").value;
      const wegverbod = datumKlus ? voertuigMeldingen(v, datumKlus).find(function (m) { return m.niveau === "rood" && (m.soort === "apk" || m.soort === "verzekering"); }) : null;
      if (v.status === "buiten_gebruik") extra = " – niet inzetbaar";
      else if (wegverbod) extra = " – " + (wegverbod.soort === "apk" ? "APK verlopen" : "verzekering verlopen");
      if (!extra) { const b = bezetDoor("voertuig", v.id); if (b) extra = " – bezet " + b.start + "–" + b.eind + " (" + b.klant + ")"; }
      return '<option value="' + v.id + '"' + (v.id === gekozenId ? " selected" : "") + '>' +
             esc(v.naam + " · " + v.merk + " " + v.type + " · " + v.kenteken + extra) + '</option>';
    };
    const sorteer = function (a, b) { return a.naam.localeCompare(b.naam, "nl", { numeric: true }); };
    $("wo-voertuig").innerHTML = '<option value="">– geen voertuig –</option>' +
      ctx.voertuigen.filter(function (v) { return v.soort !== "aanhanger"; }).sort(sorteer).map(function (v) { return optie(v, huidigV); }).join("");
    $("wo-aanhanger").innerHTML = '<option value="">– geen aanhanger –</option>' +
      ctx.voertuigen.filter(function (v) { return v.soort === "aanhanger"; }).sort(sorteer).map(function (v) { return optie(v, huidigA); }).join("");
  }

  function tekenGereedschap() {
    const isGekozen = function (id) { return gekozenGereedschap.indexOf(id) !== -1; };
    const lijst = ctx.gereedschap.slice().sort(function (a, b) {
      return (isGekozen(a.id) ? 0 : 1) - (isGekozen(b.id) ? 0 : 1) ||
             GEREEDSCHAP_CATEGORIEEN.indexOf(a.categorie) - GEREEDSCHAP_CATEGORIEEN.indexOf(b.categorie) ||
             a.naam.localeCompare(b.naam, "nl", { numeric: true });
    });
    $("wo-gereedschap").innerHTML = lijst.map(function (g) {
      let s = { soort: "groen", tekst: GEREEDSCHAP_STATUS[g.status] || "" };
      if (g.status === "defect" || g.status === "afgekeurd") s = { soort: "rood", tekst: GEREEDSCHAP_STATUS[g.status] };
      else { const b = bezetDoor("gereedschap", g.id); if (b) s = { soort: "oranje", tekst: "ook bij " + b.klant + " " + b.start + "–" + b.eind }; }
      const aan = isGekozen(g.id);
      const uit = !ctx.magBewerken || ((g.status === "defect" || g.status === "afgekeurd") && !aan);
      return '<label class="keuze-item' + (aan ? " aan" : "") + '">' +
               '<input type="checkbox" value="' + g.id + '"' + (aan ? " checked" : "") + (uit ? " disabled" : "") + '>' +
               '<span class="keuze-naam">' + esc(g.naam) + ' <span class="zacht">' + esc(g.categorie) + '</span></span>' +
               '<span class="status-tekst ' + s.soort + '">' + esc(s.tekst) + '</span>' +
             '</label>';
    }).join("");
    $("wo-gereedschap-aantal").textContent = gekozenGereedschap.length ? "(" + gekozenGereedschap.length + " gekozen)" : "";
  }

  function leesMaterialen() {
    document.querySelectorAll("#wo-materialen .materiaal").forEach(function (rij, i) {
      if (!materialen[i]) return;
      materialen[i].omschrijving = rij.querySelector(".m-oms").value;
      materialen[i].aantal = rij.querySelector(".m-aantal").value;
      materialen[i].eenheid = rij.querySelector(".m-eenheid").value;
    });
  }

  function tekenMaterialen(focusLaatste) {
    const uit = ctx.magBewerken ? "" : " disabled";
    $("wo-materialen").innerHTML = materialen.length ? materialen.map(function (m, i) {
      return '<div class="materiaal">' +
               '<input class="m-aantal" type="number" min="0" step="any" inputmode="decimal" placeholder="Aantal" value="' + esc(m.aantal) + '"' + uit + '>' +
               '<input class="m-eenheid" placeholder="eenheid" value="' + esc(m.eenheid) + '"' + uit + '>' +
               '<input class="m-oms" placeholder="Omschrijving" value="' + esc(m.omschrijving) + '"' + uit + '>' +
               (ctx.magBewerken ? '<button type="button" class="m-weg" data-weg="' + i + '" aria-label="Regel verwijderen">✕</button>' : "") +
             '</div>';
    }).join("") : '<p class="zacht" style="margin:0 0 8px">Nog geen materialen. Gebruik de knoppen hieronder.</p>';
    if (focusLaatste) {
      const rijen = document.querySelectorAll("#wo-materialen .materiaal");
      const laatste = rijen[rijen.length - 1];
      if (laatste) (laatste.querySelector(".m-oms").value ? laatste.querySelector(".m-aantal") : laatste.querySelector(".m-oms")).focus();
    }
  }

  // ---------- Foto's en documenten ----------
  function grootte(bytes) {
    return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " kB";
  }

  async function laadBestanden() {
    bestanden = (await Opslag.alle("bestanden"))
      .filter(function (b) { return b.opdracht === opdrachtId; })
      .sort(function (a, b) { return (a.aangemaakt_op || "").localeCompare(b.aangemaakt_op || ""); });
    tekenBestanden();
  }

  function tekenBestanden() {
    urls.forEach(function (u) { URL.revokeObjectURL(u); });
    urls = [];
    $("wo-bestanden").innerHTML = bestanden.length ? bestanden.map(function (b) {
      let voorbeeld;
      if (b.type && b.type.indexOf("image/") === 0) {
        const u = URL.createObjectURL(b.data); urls.push(u);
        voorbeeld = '<img src="' + u + '" alt="">';
      } else {
        const ext = (b.naam.split(".").pop() || "").toUpperCase().slice(0, 4);
        voorbeeld = '<span class="doc-icoon">📄<b>' + esc(ext) + '</b></span>';
      }
      return '<div class="bestand">' +
               '<button type="button" class="bestand-open" data-bestand="' + b.id + '">' + voorbeeld + '</button>' +
               '<span class="bestand-naam" title="' + esc(b.naam) + '">' + esc(b.naam) + '</span>' +
               '<span class="zacht">' + grootte(b.grootte || 0) + '</span>' +
               (ctx.magBewerken ? '<button type="button" class="bestand-weg" data-bestand-weg="' + b.id + '" aria-label="Verwijderen">✕</button>' : "") +
             '</div>';
    }).join("") : '<p class="zacht" style="margin:4px 0">Nog geen foto\'s of documenten.</p>';
  }

  // Foto verkleinen zodat de opslag niet volloopt
  function verklein(bestand) {
    return new Promise(function (klaar) {
      const img = new Image();
      const u = URL.createObjectURL(bestand);
      img.onload = function () {
        const schaal = Math.min(1, MAX_FOTO_PIXELS / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * schaal);
        c.height = Math.round(img.height * schaal);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function (blob) { klaar(blob || bestand); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(u); klaar(bestand); }; // kan niet lezen: origineel bewaren
      img.src = u;
    });
  }

  async function voegToe(lijst, soort) {
    if (!lijst || !lijst.length) return;
    const fouten = [];
    $("wo-bezig").textContent = "Bezig met opslaan…";
    for (const bestand of Array.prototype.slice.call(lijst)) {
      const isFoto = bestand.type.indexOf("image/") === 0;
      let data = bestand, naam = bestand.name || ("foto-" + Date.now() + ".jpg");
      if (isFoto) {
        data = await verklein(bestand);
        if (data.type === "image/jpeg") naam = naam.replace(/\.[^.]+$/, "") + ".jpg";
      } else if (bestand.size > MAX_DOCUMENT) {
        fouten.push(naam + " is groter dan 10 MB en is niet toegevoegd.");
        continue;
      }
      const b = await Opslag.bewaar("bestanden", {
        opdracht: opdrachtId, soort: isFoto ? "foto" : "document",
        naam: naam, type: data.type || bestand.type, grootte: data.size, data: data
      });
      bestanden.push(b);
    }
    $("wo-bezig").textContent = "";
    tekenBestanden();
    if (fouten.length) melding("fout", fouten.map(esc).join("<br>"));
    await werkTellerBij();
  }

  async function verwijderBestand(id) {
    const b = bestanden.find(function (x) { return x.id === id; });
    if (!b || !confirm(b.naam + " verwijderen?")) return;
    await Opslag.verwijder("bestanden", id);
    bestanden = bestanden.filter(function (x) { return x.id !== id; });
    tekenBestanden();
    await werkTellerBij();
  }

  // Bij een bestaande opdracht het aantal bestanden meteen bijwerken (ook voor de medewerker)
  async function werkTellerBij() {
    if (isNieuw && !isOpgeslagen) return;
    const o = await Opslag.haal("klussen", opdrachtId);
    if (!o) return;
    o.aantal_bestanden = bestanden.length;
    await Opslag.bewaar("klussen", o);
    if (huidige) huidige.aantal_bestanden = bestanden.length;
    if (ctx.naOpslaan) await ctx.naOpslaan(null);
  }

  function bekijk(id) {
    const b = bestanden.find(function (x) { return x.id === id; });
    if (!b) return;
    const u = URL.createObjectURL(b.data); urls.push(u);
    if (b.type && b.type.indexOf("image/") === 0) {
      $("wo-kijker-img").src = u;
      $("wo-kijker-naam").textContent = b.naam;
      $("wo-kijker").showModal();
    } else {
      // Documenten openen in een nieuw tabblad (of downloaden als de browser ze niet kan tonen)
      const a = document.createElement("a");
      a.href = u; a.target = "_blank"; a.rel = "noopener";
      if (!/pdf|image|text/.test(b.type || "")) a.download = b.naam;
      document.body.appendChild(a); a.click(); a.remove();
    }
  }

  // ---------- WhatsApp ----------
  async function laadBerichten(id) {
    berichten = (await Opslag.alle("whatsapp")).filter(function (b) { return b.opdracht === id; })
      .sort(function (a, b) { return (b.geopend_op || "").localeCompare(a.geopend_op || ""); });
  }

  function statusTekst(medewerkerId) {
    const laatste = berichten.find(function (b) { return b.medewerker === medewerkerId; });
    if (!laatste) return '<span class="zacht">Nog niet verstuurd</span>';
    const t = new Date(laatste.geopend_op);
    return '<span class="groen-tekst">✓ Geopend in WhatsApp op ' +
      t.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }) + " om " +
      t.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) + '</span>';
  }

  function tekenWaStatus(o) {
    const el = $("wo-wa-status");
    const ids = (o && o.medewerkers) || [];
    if (!ids.length) { el.innerHTML = '<span class="zacht">Kies eerst medewerkers en een datum.</span>'; return; }
    el.innerHTML = ids.map(function (id) {
      const m = medewerker(id);
      return '<div class="wa-regel"><strong>' + esc(m ? naam(m) : "Onbekend") + '</strong> ' + statusTekst(id) + '</div>';
    }).join("");
  }

  async function openWhatsApp(o) {
    await laadBerichten(o.id);
    const tekst = await WhatsApp.sjabloon();
    $("wo-wa-sub").textContent = "Opdracht " + (o.nummer || "") + " · " + o.klant;
    const lijst = $("wo-wa-lijst");
    if (!o.datum || !(o.medewerkers || []).length) {
      lijst.innerHTML = '<div class="melding zichtbaar waarschuwing">Geef de opdracht eerst een datum en minstens één medewerker.</div>';
      $("wo-wa").showModal();
      return;
    }
    lijst.innerHTML = o.medewerkers.map(function (id) {
      const m = medewerker(id);
      if (!m) return "";
      const b = WhatsApp.bericht(tekst, o, m, ctx);
      let probleem = "";
      if (!m.telefoon) probleem = "Er is geen telefoonnummer ingevuld bij " + m.voornaam + ". Vul het in bij Medewerkers.";
      else if (!WhatsApp.isGeldig(m.telefoon)) probleem = "Het telefoonnummer van " + m.voornaam + " (" + m.telefoon + ") klopt niet.";
      else if (WhatsApp.isVoorbeeldnummer(m.telefoon)) probleem = "Dit is een verzonnen voorbeeldnummer. Wil je testen? Vul bij Medewerkers je eigen 06-nummer in bij " + m.voornaam + ".";
      return '<div class="wa-kaart" data-opdracht="' + o.id + '" data-medewerker="' + m.id + '">' +
               '<div class="wa-kop"><strong>' + esc(naam(m)) + '</strong><span class="zacht">' + esc(m.telefoon || "geen nummer") + '</span></div>' +
               '<textarea class="wa-tekst" rows="14">' + esc(b) + '</textarea>' +
               (probleem ? '<div class="melding zichtbaar waarschuwing">' + esc(probleem) + '</div>' : "") +
               '<div class="wa-acties">' +
                 '<a class="knop wa-open' + (probleem ? " uit" : "") + '" ' +
                   (probleem ? 'aria-disabled="true"' : 'href="' + esc(WhatsApp.link(m.telefoon, b)) + '" target="_blank" rel="noopener" data-tel="' + esc(m.telefoon) + '"') +
                   '>💬 Open in WhatsApp</a>' +
                 '<button type="button" class="knop tweede wa-kopieer">Kopieer tekst</button>' +
                 '<span class="wa-kaart-status">' + statusTekst(m.id) + '</span>' +
               '</div>' +
             '</div>';
    }).join("");
    $("wo-wa").showModal();
  }

  function melding(soort, html) {
    const el = $("wo-melding");
    el.className = "melding" + (html ? " zichtbaar " + soort : "");
    el.innerHTML = html || "";
    // Zorg dat de melding in beeld komt (hij staat onderaan een lang formulier)
    if (html && soort !== "info") el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // ---------- Openen ----------
  // opdracht = bestaande opdracht of null; voorinvulling = { datum, medewerker } (optioneel)
  function open(opdracht, voorinvulling) {
    zetKlaar();
    huidige = opdracht || null;
    const v = voorinvulling || {};
    const o = opdracht || {
      klant: "", telefoon_klant: "", email_klant: "", adres: "",
      datum: v.datum !== undefined ? v.datum : "",
      start: ctx.dagdelen.ochtend_van, eind: ctx.dagdelen.ochtend_tot,
      medewerkers: v.medewerker ? [v.medewerker] : [],
      soort_werk: [], soort_glas: "", werkzaamheden: "", bijzonderheden: "",
      voertuig: "", aanhanger: "", gereedschap: [], materialen: [],
      status: v.datum ? "gepland" : "concept"
    };
    gekozen = (o.medewerkers || []).slice();
    gekozenGereedschap = (o.gereedschap || []).slice();
    opdrachtId = opdracht ? opdracht.id : Opslag.nieuwId();
    naWhatsApp = false;
    ophefVerzoek = null;
    berichten = [];
    isNieuw = !opdracht;
    isOpgeslagen = false;
    bestanden = [];
    materialen = JSON.parse(JSON.stringify(o.materialen || []));
    waarschuwingGezien = "";

    $("wo-titel").textContent = opdracht ? (o.klant || "Werkopdracht") : "Nieuwe werkopdracht";
    $("wo-nummer").textContent = opdracht && o.nummer ? "Opdracht " + o.nummer : "Krijgt een nummer bij opslaan";
    $("wo-klant").value = o.klant || "";
    $("wo-status").value = o.status || (o.datum ? "gepland" : "concept");
    $("wo-tel").value = o.telefoon_klant || "";
    $("wo-mail").value = o.email_klant || "";
    $("wo-adres").value = o.adres || "";
    $("wo-datum").value = o.datum || "";
    $("wo-start").value = o.start || ctx.dagdelen.ochtend_van;
    $("wo-eind").value = o.eind || ctx.dagdelen.ochtend_tot;
    $("wo-glas").value = o.soort_glas || "";
    $("wo-omschrijving").value = o.werkzaamheden || "";
    $("wo-bijz").value = o.bijzonderheden || "";
    $("wo-zoek").value = "";
    document.querySelectorAll("#wo-werk input").forEach(function (vakje) {
      vakje.checked = (o.soort_werk || []).indexOf(vakje.value) !== -1;
    });
    $("wo-verwijder").hidden = !opdracht;
    $("wo-voertuig").innerHTML = ""; $("wo-aanhanger").innerHTML = "";
    melding();

    document.querySelectorAll("#werkopdracht input, #werkopdracht select, #werkopdracht textarea").forEach(function (el) {
      if (el.id !== "wo-zoek") el.disabled = !ctx.magBewerken;
    });
    document.querySelector("#werkopdracht .wo-bewerk").hidden = !ctx.magBewerken;
    $("wo-snel").hidden = !ctx.magBewerken;

    markeerDagdeel();
    tekenMedewerkers();
    tekenVoertuigen();
    $("wo-voertuig").value = o.voertuig || "";
    $("wo-aanhanger").value = o.aanhanger || "";
    tekenGereedschap();
    tekenMaterialen();
    tekenBestanden();
    laadBestanden();
    tekenWaStatus(o);
    if (opdracht && o.opheffing) {
      melding("info", "Blokkade eerder opgeheven door de beheerder op " +
        new Date(o.opheffing.op).toLocaleDateString("nl-NL") + ". Reden: " + esc(o.opheffing.reden));
    }
    if (opdracht) laadBerichten(opdracht.id).then(function () { tekenWaStatus(o); });
    $("wo-bestand-knoppen").hidden = !(ctx.magBewerken || ctx.magFotos);
    document.querySelectorAll(".wo-alleen-bewerk").forEach(function (el) { el.hidden = !ctx.magBewerken; });
    $("wo-foto").disabled = false; $("wo-document").disabled = false;
    document.querySelectorAll("#wo-voertuig, #wo-aanhanger").forEach(function (el) { el.disabled = !ctx.magBewerken; });
    $("werkopdracht").showModal();
  }

  // ---------- Opslaan ----------
  async function opslaan(e) {
    e.preventDefault();
    if (!ctx.magBewerken) return;
    const o = Object.assign({}, huidige || {}, {
      klant: $("wo-klant").value.trim(),
      status: $("wo-status").value,
      telefoon_klant: $("wo-tel").value.trim(),
      email_klant: $("wo-mail").value.trim(),
      adres: $("wo-adres").value.trim(),
      datum: $("wo-datum").value,
      start: $("wo-start").value,
      eind: $("wo-eind").value,
      medewerkers: gekozen.slice(),
      soort_werk: Array.prototype.slice.call(document.querySelectorAll("#wo-werk input:checked")).map(function (x) { return x.value; }),
      soort_glas: $("wo-glas").value,
      werkzaamheden: $("wo-omschrijving").value.trim(),
      bijzonderheden: $("wo-bijz").value.trim(),
      voertuig: $("wo-voertuig").value,
      aanhanger: $("wo-aanhanger").value,
      gereedschap: gekozenGereedschap.slice(),
      materialen: (leesMaterialen(), materialen.filter(function (m) { return (m.omschrijving || "").trim(); })
        .map(function (m) { return { omschrijving: m.omschrijving.trim(), aantal: m.aantal, eenheid: (m.eenheid || "").trim() }; }))
    });

    if (!o.klant) { melding("fout", "Vul de naam van de klant in."); return; }
    if (o.datum) {
      if (!o.start || !o.eind) { melding("fout", "Vul een starttijd en eindtijd in."); return; }
      if (o.eind <= o.start) { melding("fout", "De eindtijd moet later zijn dan de starttijd."); return; }
      if (o.status === "concept") o.status = "gepland";
    } else if (o.status === "gepland" || o.status === "bezig") {
      melding("fout", "Een opdracht met status " + statusNaam(o.status) + " heeft een datum nodig.");
      return;
    }

    // Blokkade opgeheven door de beheerder? Dan vastleggen bij de opdracht.
    if (ophefVerzoek) {
      const eerder = (o.opheffing && o.opheffing.redenen) || [];
      o.opheffing = {
        reden: ophefVerzoek.reden, door: "beheerder", op: new Date().toISOString(),
        redenen: eerder.concat(ophefVerzoek.redenen.filter(function (r) { return eerder.indexOf(r) === -1; }))
      };
    }

    const open = openBlokkades(o);
    if (open.length) {
      const alleenBevoegdheid = open.every(function (r) { return r.soort === "bevoegdheid"; });
      const isBeheerder = typeof huidigeRol === "function" && huidigeRol() === "beheerder";
      melding("fout", "<strong>Opslaan kan niet:</strong><br>" + open.map(function (r) { return esc(r.tekst); }).join("<br>") +
        (alleenBevoegdheid
          ? (isBeheerder
              ? '<div class="knoppen"><button type="button" class="knop gevaar" id="wo-ophef">Blokkade opheffen (beheerder)</button></div>'
              : "<br><em>Dit is een wettelijke bevoegdheid. Alleen de beheerder kan deze blokkade opheffen.</em>")
          : ""));
      const knop = $("wo-ophef");
      if (knop) knop.onclick = function () {
        const reden = prompt("Waarom wordt deze blokkade opgeheven?\n(Verplicht. Dit komt in het logboek.)");
        if (!reden || !reden.trim()) return;
        ophefVerzoek = { reden: reden.trim(), redenen: open.map(function (r) { return r.tekst; }) };
        waarschuwingGezien = "";
        $("wo-form").requestSubmit();
      };
      ophefVerzoek = null;
      return;
    }

    const let_op = waarschuwingen(o);
    const sleutel = let_op.join("|");
    if (let_op.length && waarschuwingGezien !== sleutel) {
      waarschuwingGezien = sleutel;
      melding("waarschuwing", "<strong>Let op:</strong><br>" + let_op.map(esc).join("<br>") +
        "<br><em>Tik nog een keer op Opslaan om toch op te slaan.</em>");
      return;
    }

    if (!o.nummer) o.nummer = await nieuwNummer();
    if (!o.id) o.id = opdrachtId;
    o.aantal_bestanden = bestanden.length;
    const bewaard = await Opslag.bewaar("klussen", o);
    isOpgeslagen = true;
    if (ophefVerzoek) {
      await Opslag.bewaar("logboek", {
        wanneer: new Date().toISOString(), rol: "beheerder", actie: "Blokkade opgeheven",
        details: "Opdracht " + o.nummer + " (" + o.klant + "): " + ophefVerzoek.redenen.join(" ") + " Reden: " + ophefVerzoek.reden
      });
      ophefVerzoek = null;
    }
    $("werkopdracht").close();
    if (ctx.toast) {
      if (o.datum && !o.medewerkers.length) ctx.toast("Opdracht " + o.nummer + " opgeslagen. Let op: er is nog niemand ingepland.", "waarschuwing");
      else ctx.toast("Opdracht " + o.nummer + " (" + o.klant + ") opgeslagen.", "goed");
    }
    if (ctx.naOpslaan) await ctx.naOpslaan(bewaard);
    if (naWhatsApp) { naWhatsApp = false; await openWhatsApp(bewaard); }
  }

  async function verwijderen() {
    if (!huidige) return;
    if (!confirm("Opdracht " + (huidige.nummer || "") + " (" + huidige.klant + ") verwijderen, inclusief foto's en documenten?\n\nTip: zet de status liever op Geannuleerd, dan blijft hij bewaard.")) return;
    const oud = huidige;
    const oudeBestanden = bestanden.slice();
    for (const b of oudeBestanden) await Opslag.verwijder("bestanden", b.id);
    bestanden = [];
    await Opslag.verwijder("klussen", oud.id);
    $("werkopdracht").close();
    if (ctx.naOpslaan) await ctx.naOpslaan(null);
    if (ctx.toast) ctx.toast("Opdracht " + (oud.nummer || "") + " verwijderd.", "", async function () {
      await Opslag.bewaar("klussen", oud);
      for (const b of oudeBestanden) await Opslag.bewaar("bestanden", b);
      if (ctx.naOpslaan) await ctx.naOpslaan(oud);
    });
  }

  // ---------- Instellen vanuit de pagina ----------
  function instellen(opties) { Object.assign(ctx, opties); }

  async function laadGegevens() {
    ctx.medewerkers = await Opslag.alle("medewerkers");
    ctx.klussen = await Opslag.alle("klussen");
    ctx.afwezigheid = await Opslag.alle("afwezigheid");
    ctx.voertuigen = await Opslag.alle("voertuigen");
    ctx.gereedschap = await Opslag.alle("gereedschap");
    const d = await Opslag.haal("instellingen", "dagdelen");
    if (d) ctx.dagdelen = d;
    return ctx;
  }

  return {
    instellen: instellen,
    laadGegevens: laadGegevens,
    open: open,
    blokkades: blokkades,
    controleer: controleer,
    openBlokkades: openBlokkades,
    waarschuwingen: waarschuwingen,
    statusVoor: statusVoor,
    zorgVoorNummers: zorgVoorNummers,
    telt: telt,
    gegevens: function () { return ctx; },
    iso: iso
  };
})();

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
  function blokkades(klus) {
    const redenen = [];
    if (!telt(klus)) return redenen;
    (klus.medewerkers || []).forEach(function (id) {
      const m = medewerker(id);
      if (!m) return;
      if (!m.actief) redenen.push(naam(m) + " is niet actief.");
      const af = afwezigOp(id, klus.datum);
      if (af) redenen.push(naam(m) + " is afwezig (" + af.soort.toLowerCase() + ").");
      ctx.klussen.forEach(function (k) {
        if (k.id === klus.id || !telt(k) || k.datum !== klus.datum) return;
        if ((k.medewerkers || []).indexOf(id) === -1) return;
        if (overlapt(klus.start, klus.eind, k.start, k.eind)) {
          redenen.push(naam(m) + " staat al ingepland van " + k.start + " tot " + k.eind + " bij " + k.klant + ".");
        }
      });
    });

    // Voertuig en aanhanger: buiten gebruik of dubbel geboekt
    [klus.voertuig, klus.aanhanger].forEach(function (vid) {
      if (!vid) return;
      const v = voertuig(vid);
      if (!v) return;
      if (v.status === "buiten_gebruik") redenen.push(v.naam + " is tijdelijk niet inzetbaar" + (v.bijzonderheden ? " (" + v.bijzonderheden + ")" : "") + ".");
      ctx.klussen.forEach(function (k) {
        if (k.id === klus.id || !telt(k) || k.datum !== klus.datum) return;
        if (k.voertuig !== vid && k.aanhanger !== vid) return;
        if (overlapt(klus.start, klus.eind, k.start, k.eind)) {
          redenen.push(v.naam + " is al ingepland van " + k.start + " tot " + k.eind + " bij " + k.klant + ".");
        }
      });
    });

    // Gereedschap dat defect of afgekeurd is
    (klus.gereedschap || []).forEach(function (gid) {
      const g = gereedschapItem(gid);
      if (g && (g.status === "defect" || g.status === "afgekeurd")) {
        redenen.push(g.naam + " is " + GEREEDSCHAP_STATUS[g.status].toLowerCase() + " en mag niet gebruikt worden.");
      }
    });
    return redenen;
  }

  // Oranje waarschuwingen: opslaan mag, na bevestiging
  function waarschuwingen(klus) {
    const lijst = [];
    if (!telt(klus)) return lijst;
    if ((klus.medewerkers || []).length && !klus.voertuig) lijst.push("Er is nog geen voertuig gekozen.");
    (klus.gereedschap || []).forEach(function (gid) {
      const g = gereedschapItem(gid);
      if (!g) return;
      const elders = ctx.klussen.find(function (k) {
        return k.id !== klus.id && telt(k) && k.datum === klus.datum && (k.gereedschap || []).indexOf(gid) !== -1 &&
               overlapt(klus.start, klus.eind, k.start, k.eind);
      });
      if (elders) lijst.push(g.naam + " is op dat moment ook ingepland bij " + elders.klant + " (" + elders.start + "–" + elders.eind + ").");
    });
    return lijst;
  }

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
          '<p class="zacht">WhatsApp volgt in stap 3d. Rijbewijs-controles bij voertuig en aanhanger volgen in fase 4.</p>' +
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
      if (v.status === "buiten_gebruik") extra = " – niet inzetbaar";
      else { const b = bezetDoor("voertuig", v.id); if (b) extra = " – bezet " + b.start + "–" + b.eind + " (" + b.klant + ")"; }
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

  function melding(soort, html) {
    const el = $("wo-melding");
    el.className = "melding" + (html ? " zichtbaar " + soort : "");
    el.innerHTML = html || "";
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

    const redenen = blokkades(o);
    if (redenen.length) {
      melding("fout", "<strong>Opslaan kan niet:</strong><br>" + redenen.map(esc).join("<br>"));
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
    $("werkopdracht").close();
    if (ctx.toast) {
      if (o.datum && !o.medewerkers.length) ctx.toast("Opdracht " + o.nummer + " opgeslagen. Let op: er is nog niemand ingepland.", "waarschuwing");
      else ctx.toast("Opdracht " + o.nummer + " (" + o.klant + ") opgeslagen.", "goed");
    }
    if (ctx.naOpslaan) await ctx.naOpslaan(bewaard);
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
    waarschuwingen: waarschuwingen,
    statusVoor: statusVoor,
    zorgVoorNummers: zorgVoorNummers,
    telt: telt,
    gegevens: function () { return ctx; },
    iso: iso
  };
})();

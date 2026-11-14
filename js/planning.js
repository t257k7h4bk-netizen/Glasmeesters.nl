/* =========================================================
   Glasmeesters Planner – planning
   Rijen = medewerkers, kolommen = dagen.
   Een klus kan meerdere medewerkers hebben; in het rooster
   staat de klus in de rij van elke medewerker die meegaat.

   Harde controles (opslaan lukt niet):
   - medewerker staat op hetzelfde moment al op een andere klus
   - medewerker is afwezig (vakantie, ziek, ...)
   - medewerker is niet actief
   ========================================================= */

(function () {
  if (document.body.classList.contains("geen-toegang")) return;

  const rol = huidigeRol();
  const magPlannen = rol === "beheerder" || rol === "planner";
  if (!magPlannen) document.body.classList.add("alleen-kijken");

  // ---------- Gegevens ----------
  let medewerkers = [];
  let klussen = [];
  let afwezigheid = [];
  let dagdelen = { ochtend_van: "07:30", ochtend_tot: "12:00", middag_van: "12:30", middag_tot: "16:30" };

  // ---------- Stand van het scherm ----------
  const stand = {
    weergave: "week",       // "vandaag" | "morgen" | "week" | "volgende" | "dag" (na pijltjes in dagweergave)
    soort: "week",          // "week" of "dag"
    datum: vandaag(),       // de dag (dagweergave) of een dag in de week (weekweergave)
    zaterdag: false,
    groep: "buitendienst",
    zoek: "",
    ikBen: null             // medewerker-id voor de rol Medewerker
  };

  // ---------- Hulpfuncties voor datums ----------
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function lees(s) { return new Date(s + "T00:00:00"); }
  function vandaag() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function plus(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function maandag(d) { const x = new Date(d); const wd = x.getDay() || 7; x.setDate(x.getDate() - (wd - 1)); return x; }
  function weeknummer(d) {
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dag = x.getUTCDay() || 7;
    x.setUTCDate(x.getUTCDate() + 4 - dag);
    const jaarStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
    return Math.ceil(((x - jaarStart) / 864e5 + 1) / 7);
  }
  function kortDatum(d) { return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }); }
  function langDatum(d) { return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function naam(m) { return m ? (m.voornaam + " " + m.achternaam) : "Onbekend"; }
  function medewerker(id) { return medewerkers.find(function (m) { return m.id === id; }); }
  function voertuigNaam(k) {
    const lijst = Werkopdracht.gegevens().voertuigen || [];
    const namen = [k.voertuig, k.aanhanger].filter(Boolean).map(function (id) {
      const v = lijst.find(function (x) { return x.id === id; });
      return v ? v.naam.replace(/ \(.*\)/, "") : null;
    }).filter(Boolean);
    return namen.join(" + ");
  }

  // ---------- Wie staat waar? ----------
  function klussenVan(id, datum) {
    return klussen
      .filter(function (k) { return Werkopdracht.telt(k) && k.datum === datum && (k.medewerkers || []).indexOf(id) !== -1; })
      .sort(function (a, b) { return a.start.localeCompare(b.start); });
  }
  function afwezigOp(id, datum) {
    return afwezigheid.find(function (a) { return a.medewerker === id && a.van <= datum && datum <= a.tot; });
  }
  function overlapt(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }

  // Controles op dubbele boekingen staan in js/werkopdracht.js (gedeeld met Werkopdrachten)
  function blokkades(klus) { return Werkopdracht.blokkades(klus); }

  // ---------- Welke dagen en mensen tonen we? ----------
  function getoondeDagen() {
    if (stand.soort === "dag") return [stand.datum];
    const ma = maandag(stand.datum);
    const aantal = stand.zaterdag ? 6 : 5;
    const dagen = [];
    for (let i = 0; i < aantal; i++) dagen.push(plus(ma, i));
    return dagen;
  }

  function getoondeMedewerkers() {
    if (rol === "medewerker") {
      return medewerkers.filter(function (m) { return m.id === stand.ikBen; });
    }
    const volgorde = { buitendienst: 0, opname: 1, kantoor: 2 };
    return medewerkers
      .filter(function (m) { return m.actief; })
      .filter(function (m) {
        const g = groepVanFunctie(m.functie);
        if (stand.groep === "planbaar") return g !== "kantoor";
        return !stand.groep || g === stand.groep;
      })
      .filter(function (m) { return !stand.zoek || naam(m).toLowerCase().indexOf(stand.zoek) !== -1; })
      .sort(function (a, b) {
        return volgorde[groepVanFunctie(a.functie)] - volgorde[groepVanFunctie(b.functie)] ||
               a.voornaam.localeCompare(b.voornaam, "nl");
      });
  }

  // ---------- Rooster tekenen ----------
  function teken() {
    const dagen = getoondeDagen();
    const mensen = getoondeMedewerkers();
    const vandaagIso = iso(vandaag());

    // Titel en periode
    if (stand.soort === "dag") {
      document.getElementById("periode").textContent = langDatum(stand.datum);
    } else {
      document.getElementById("periode").textContent = "Week " + weeknummer(dagen[0]) + " · " +
        dagen[0].toLocaleDateString("nl-NL", { day: "numeric", month: "long" }) + " t/m " +
        dagen[dagen.length - 1].toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
    }
    document.getElementById("titel").textContent = rol === "medewerker" ? "Mijn planning" : "Planning";
    document.querySelectorAll("[data-weergave]").forEach(function (k) {
      k.classList.toggle("actief", k.dataset.weergave === stand.weergave);
    });

    const rooster = document.getElementById("rooster");
    rooster.style.gridTemplateColumns = "minmax(150px, 190px) repeat(" + dagen.length + ", minmax(" +
      (stand.soort === "dag" ? "320px" : "150px") + ", 1fr))";

    let html = '<div class="kop hoek">Medewerker</div>';
    dagen.forEach(function (d) {
      const di = iso(d);
      const vrij = mensen.filter(function (m) { return !afwezigOp(m.id, di) && klussenVan(m.id, di).length === 0; }).length;
      html += '<div class="kop' + (di === vandaagIso ? " vandaag" : "") + '">' +
                '<strong>' + esc(stand.soort === "dag" ? langDatum(d) : kortDatum(d)) + '</strong>' +
                (rol === "medewerker" ? "" : '<span>' + vrij + " van " + mensen.length + " vrij</span>") +
              '</div>';
    });

    if (mensen.length === 0) {
      html += '<div class="leeg-rij" style="grid-column: 1 / -1">Geen medewerkers gevonden.</div>';
    }

    mensen.forEach(function (m) {
      html += '<div class="naamcel"><strong>' + esc(naam(m)) + '</strong><span>' + esc(m.functie) + '</span></div>';
      dagen.forEach(function (d) {
        const di = iso(d);
        const af = afwezigOp(m.id, di);
        const lijst = klussenVan(m.id, di);
        let inhoud = "";
        if (af) {
          inhoud += '<div class="blok afwezig" data-afwezig="' + af.id + '">' + esc(af.soort) +
                    (af.opmerking ? ' <span>' + esc(af.opmerking) + '</span>' : "") + '</div>';
        }
        lijst.forEach(function (k) {
          const anderen = (k.medewerkers || []).filter(function (id) { return id !== m.id; }).map(medewerker).filter(Boolean);
          inhoud += '<div class="blok klus st-' + (k.status || "gepland") + '" data-klus="' + k.id + '" data-medewerker="' + m.id + '">' +
                      '<b>' + k.start + '–' + k.eind + '</b>' +
                      '<span class="klant">' + esc(k.klant) + '</span>' +
                      (stand.soort === "dag" && k.adres ? '<span class="adres">' + esc(k.adres) + '</span>' : "") +
                      (voertuigNaam(k) ? '<span class="samen">🚐 ' + esc(voertuigNaam(k)) + '</span>' : "") +
                      (anderen.length ? '<span class="samen">met ' + esc(anderen.map(function (x) { return x.voornaam; }).join(", ")) + '</span>' : "") +
                    '</div>';
        });
        const vrij = !af && lijst.length === 0;
        html += '<div class="cel' + (vrij ? " vrij" : "") + (di === vandaagIso ? " vandaag" : "") +
                '" data-cel="1" data-medewerker="' + m.id + '" data-datum="' + di + '">' + inhoud + '</div>';
      });
    });

    rooster.innerHTML = html;
  }

  // ---------- Weergave wisselen ----------
  function zetWeergave(w) {
    stand.weergave = w;
    if (w === "vandaag") { stand.soort = "dag"; stand.datum = vandaag(); }
    if (w === "morgen") { stand.soort = "dag"; stand.datum = plus(vandaag(), 1); }
    if (w === "week") { stand.soort = "week"; stand.datum = vandaag(); }
    if (w === "volgende") { stand.soort = "week"; stand.datum = plus(maandag(vandaag()), 7); }
    teken();
  }
  function schuif(richting) {
    stand.datum = plus(stand.datum, (stand.soort === "dag" ? 1 : 7) * richting);
    const di = iso(stand.datum);
    if (stand.soort === "dag") {
      stand.weergave = di === iso(vandaag()) ? "vandaag" : di === iso(plus(vandaag(), 1)) ? "morgen" : "dag";
    } else {
      const ma = iso(maandag(stand.datum));
      stand.weergave = ma === iso(maandag(vandaag())) ? "week" : ma === iso(plus(maandag(vandaag()), 7)) ? "volgende" : "andere";
    }
    teken();
  }

  document.querySelectorAll("[data-weergave]").forEach(function (k) {
    k.addEventListener("click", function () { zetWeergave(k.dataset.weergave); });
  });
  document.getElementById("vorige").addEventListener("click", function () { schuif(-1); });
  document.getElementById("volgende").addEventListener("click", function () { schuif(1); });
  document.getElementById("zoek").addEventListener("input", function (e) { stand.zoek = e.target.value.trim().toLowerCase(); teken(); });
  document.getElementById("groep").addEventListener("change", function (e) { stand.groep = e.target.value; teken(); });
  document.getElementById("zaterdag").addEventListener("change", function (e) { stand.zaterdag = e.target.checked; teken(); });

  // ---------- Melding onderin met "Ongedaan maken" ----------
  let toastTimer = null;
  function toast(tekst, soort, ongedaan) {
    const el = document.getElementById("toast");
    el.className = "toast zichtbaar " + (soort || "");
    el.innerHTML = '<span>' + esc(tekst) + '</span>' + (ongedaan ? '<button type="button">Ongedaan maken</button>' : "");
    if (ongedaan) {
      el.querySelector("button").onclick = async function () {
        await ongedaan();
        el.className = "toast";
      };
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast"; }, soort === "fout" ? 7000 : 6000);
  }

  // ---------- Vensters ----------
  function sluitVensters() { document.querySelectorAll("dialog[open]").forEach(function (d) { d.close(); }); }
  document.querySelectorAll("[data-sluit]").forEach(function (k) { k.addEventListener("click", sluitVensters); });
  document.querySelectorAll("dialog").forEach(function (d) {
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
  });

  function melding(id, soort, tekst) {
    const el = document.getElementById(id);
    el.className = "melding" + (tekst ? " zichtbaar " + soort : "");
    el.innerHTML = tekst || "";
  }

  // ----- Keuze bij leeg vak -----
  let gekozenCel = null;
  function openKeuze(mid, datum) {
    gekozenCel = { medewerker: mid, datum: datum };
    document.getElementById("keuze-titel").textContent = naam(medewerker(mid)) + " · " + kortDatum(lees(datum));
    document.getElementById("keuze").showModal();
  }
  document.getElementById("keuze-klus").addEventListener("click", function () {
    sluitVensters();
    openKlus(null, gekozenCel);
  });
  document.getElementById("keuze-afwezig").addEventListener("click", function () {
    sluitVensters();
    openAfwezig(null, gekozenCel);
  });

  // ----- Werkopdracht openen (gedeeld venster uit js/werkopdracht.js) -----
  function openKlus(klus, cel) {
    Werkopdracht.open(klus, cel ? { datum: cel.datum, medewerker: cel.medewerker } : { datum: iso(stand.soort === "dag" ? stand.datum : vandaag()) });
  }
  document.getElementById("nieuwe-klus").addEventListener("click", function () { openKlus(null, null); });

  // ----- Afwezigheidsvenster -----
  let huidigeAfwezigheid = null;
  function openAfwezig(a, cel) {
    huidigeAfwezigheid = a;
    const keuzes = medewerkers.filter(function (m) { return m.actief; })
      .sort(function (x, y) { return x.voornaam.localeCompare(y.voornaam, "nl"); });
    document.getElementById("a-medewerker").innerHTML = keuzes.map(function (m) {
      return '<option value="' + m.id + '">' + esc(naam(m)) + '</option>';
    }).join("");
    const g = a || { medewerker: cel.medewerker, soort: "Vakantie", van: cel.datum, tot: cel.datum, opmerking: "" };
    document.getElementById("afwezig-titel").textContent = a ? "Afwezigheid" : "Afwezig melden";
    document.getElementById("a-medewerker").value = g.medewerker;
    document.getElementById("a-soort").value = g.soort;
    document.getElementById("a-van").value = g.van;
    document.getElementById("a-tot").value = g.tot;
    document.getElementById("a-opm").value = g.opmerking || "";
    document.getElementById("a-verwijder").hidden = !a;
    document.querySelectorAll("#afwezig input, #afwezig select").forEach(function (el) { el.disabled = !magPlannen; });
    melding("a-melding");
    document.getElementById("afwezig").showModal();
  }

  document.getElementById("afwezig-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!magPlannen) return;
    const a = Object.assign({}, huidigeAfwezigheid || {}, {
      medewerker: document.getElementById("a-medewerker").value,
      soort: document.getElementById("a-soort").value,
      van: document.getElementById("a-van").value,
      tot: document.getElementById("a-tot").value,
      opmerking: document.getElementById("a-opm").value.trim()
    });
    if (!a.van || !a.tot || a.tot < a.van) {
      melding("a-melding", "fout", "De einddatum mag niet vóór de begindatum liggen.");
      return;
    }
    // Staat deze medewerker in die periode al op een klus?
    const botsend = klussen.filter(function (k) {
      return (k.medewerkers || []).indexOf(a.medewerker) !== -1 && a.van <= k.datum && k.datum <= a.tot;
    }).sort(function (x, y) { return (x.datum + x.start).localeCompare(y.datum + y.start); });
    if (botsend.length) {
      melding("a-melding", "fout", "<strong>" + esc(naam(medewerker(a.medewerker))) + " staat in deze periode nog ingepland:</strong><br>" +
        botsend.map(function (k) { return esc(kortDatum(lees(k.datum)) + " " + k.start + "–" + k.eind + " " + k.klant); }).join("<br>") +
        "<br>Haal hem of haar eerst van deze klus(sen) af.");
      return;
    }
    // Overlapt met een andere afwezigheid?
    const dubbel = afwezigheid.find(function (x) {
      return x.id !== a.id && x.medewerker === a.medewerker && x.van <= a.tot && a.van <= x.tot;
    });
    if (dubbel) {
      melding("a-melding", "fout", "Er staat in deze periode al een afwezigheid (" + esc(dubbel.soort) + ").");
      return;
    }
    await Opslag.bewaar("afwezigheid", a);
    sluitVensters();
    await herlaad();
    toast(naam(medewerker(a.medewerker)) + ": " + a.soort.toLowerCase() + " opgeslagen.", "goed");
  });

  document.getElementById("a-verwijder").addEventListener("click", async function () {
    if (!huidigeAfwezigheid) return;
    await Opslag.verwijder("afwezigheid", huidigeAfwezigheid.id);
    sluitVensters();
    await herlaad();
    toast("Afwezigheid verwijderd.", "");
  });

  // ---------- Klikken in het rooster ----------
  document.getElementById("rooster").addEventListener("click", function (e) {
    if (sleep.bezig || sleep.netGesleept) return;
    const klus = e.target.closest("[data-klus]");
    if (klus) { openKlus(klussen.find(function (k) { return k.id === klus.dataset.klus; })); return; }
    const af = e.target.closest("[data-afwezig]");
    if (af) { openAfwezig(afwezigheid.find(function (a) { return a.id === af.dataset.afwezig; })); return; }
    const cel = e.target.closest("[data-cel]");
    if (cel && magPlannen) openKeuze(cel.dataset.medewerker, cel.dataset.datum);
  });

  // ---------- Verslepen (muis én vinger) ----------
  // Houd een klus kort vast (of beweeg met de muis) en sleep naar een ander vak.
  const sleep = { bezig: false, netGesleept: false, timer: null, bron: null, spook: null, doel: null, startX: 0, startY: 0 };

  function stopSleep() {
    clearTimeout(sleep.timer);
    if (sleep.spook) sleep.spook.remove();
    if (sleep.doel) sleep.doel.classList.remove("sleepdoel");
    if (sleep.bron) sleep.bron.classList.remove("wordt-gesleept");
    document.body.classList.remove("sleept");
    sleep.bezig = false; sleep.spook = null; sleep.doel = null; sleep.bron = null;
  }

  function beginSleep(x, y) {
    sleep.bezig = true;
    sleep.bron.classList.add("wordt-gesleept");
    document.body.classList.add("sleept");
    const spook = sleep.bron.cloneNode(true);
    spook.className = "blok klus spook";
    spook.style.width = sleep.bron.offsetWidth + "px";
    document.body.appendChild(spook);
    sleep.spook = spook;
    beweegSpook(x, y);
    if (navigator.vibrate) navigator.vibrate(15);
  }

  function beweegSpook(x, y) {
    sleep.spook.style.transform = "translate(" + (x + 8) + "px," + (y + 8) + "px)";
    // Kijk door meldingen en het "spook" heen naar het vak eronder
    const lagen = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
    let cel = null;
    for (const el of lagen) {
      if (el && el.closest) { cel = el.closest("[data-cel]"); if (cel) break; }
    }
    // Vanzelf meescrollen bij de rand van het rooster
    const houder = document.querySelector(".rooster-houder");
    const r = houder.getBoundingClientRect();
    const rand = 40;
    if (y > r.bottom - rand) houder.scrollTop += 12;
    else if (y < r.top + rand + 40) houder.scrollTop -= 12;
    if (x > r.right - rand) houder.scrollLeft += 12;
    else if (x < r.left + 190 + rand) houder.scrollLeft -= 12;
    if (sleep.doel !== cel) {
      if (sleep.doel) sleep.doel.classList.remove("sleepdoel");
      sleep.doel = cel;
      if (cel) cel.classList.add("sleepdoel");
    }
  }

  if (magPlannen) {
    const rooster = document.getElementById("rooster");

    rooster.addEventListener("pointerdown", function (e) {
      const blok = e.target.closest(".blok.klus");
      if (!blok || e.button > 0) return;
      sleep.bron = blok;
      sleep.startX = e.clientX; sleep.startY = e.clientY;
      sleep.pointerType = e.pointerType;
      if (e.pointerType !== "mouse") {
        // Vinger: kort vasthouden (0,35 sec) om te slepen, anders gewoon scrollen of tikken
        sleep.timer = setTimeout(function () { beginSleep(sleep.startX, sleep.startY); }, 350);
      }
    });

    window.addEventListener("pointermove", function (e) {
      if (!sleep.bron) return;
      if (!sleep.bezig) {
        const afstand = Math.abs(e.clientX - sleep.startX) + Math.abs(e.clientY - sleep.startY);
        if (sleep.pointerType === "mouse" && afstand > 6) beginSleep(e.clientX, e.clientY);
        else if (sleep.pointerType !== "mouse" && afstand > 10) { clearTimeout(sleep.timer); sleep.bron = null; }
        return;
      }
      e.preventDefault();
      beweegSpook(e.clientX, e.clientY);
    }, { passive: false });

    // Tijdens slepen mag de pagina niet meescrollen op de tablet
    window.addEventListener("touchmove", function (e) { if (sleep.bezig) e.preventDefault(); }, { passive: false });

    window.addEventListener("pointerup", async function () {
      if (!sleep.bron) return;
      if (!sleep.bezig) { clearTimeout(sleep.timer); sleep.bron = null; return; }
      const bron = sleep.bron, doel = sleep.doel;
      stopSleep();
      sleep.netGesleept = true;
      setTimeout(function () { sleep.netGesleept = false; }, 50);
      if (doel) await verplaats(bron.dataset.klus, bron.dataset.medewerker, doel.dataset.medewerker, doel.dataset.datum);
    });

    window.addEventListener("pointercancel", function () { stopSleep(); sleep.bron = null; });
    rooster.addEventListener("contextmenu", function (e) { if (e.target.closest(".blok.klus")) e.preventDefault(); });
  }

  // Een klus verslepen naar een ander vak:
  // - andere dag: de hele klus (met alle collega's) gaat naar die dag
  // - andere medewerker: die medewerker neemt de plaats in van de versleepte medewerker
  async function verplaats(klusId, vanMedewerker, naarMedewerker, naarDatum) {
    const oud = klussen.find(function (k) { return k.id === klusId; });
    if (!oud) return;
    if (vanMedewerker === naarMedewerker && oud.datum === naarDatum) return;

    const nieuw = JSON.parse(JSON.stringify(oud));
    nieuw.datum = naarDatum;
    if (vanMedewerker !== naarMedewerker) {
      nieuw.medewerkers = nieuw.medewerkers.filter(function (id) { return id !== vanMedewerker; });
      if (nieuw.medewerkers.indexOf(naarMedewerker) === -1) nieuw.medewerkers.push(naarMedewerker);
    }

    const redenen = blokkades(nieuw);
    if (redenen.length) {
      toast("Verplaatsen kan niet: " + redenen.join(" "), "fout");
      return;
    }

    await Opslag.bewaar("klussen", nieuw);
    await herlaad();

    let tekst = oud.klant + ": ";
    if (vanMedewerker !== naarMedewerker) tekst += naam(medewerker(vanMedewerker)) + " vervangen door " + naam(medewerker(naarMedewerker));
    if (oud.datum !== naarDatum) tekst += (vanMedewerker !== naarMedewerker ? ", " : "") + "verplaatst naar " + kortDatum(lees(naarDatum));
    toast(tekst + ".", "goed", async function () {
      await Opslag.bewaar("klussen", oud);
      await herlaad();
      toast("Teruggezet.", "");
    });
  }

  // ---------- Medewerker-weergave (testmodus) ----------
  function zetIkBen() {
    if (rol !== "medewerker") return;
    document.getElementById("ik-ben-blok").hidden = false;
    document.getElementById("filters").hidden = true;
    const buitendienst = medewerkers.filter(function (m) { return m.actief && groepVanFunctie(m.functie) !== "kantoor"; })
      .sort(function (a, b) { return a.voornaam.localeCompare(b.voornaam, "nl"); });
    let bewaard = null;
    try { bewaard = localStorage.getItem("gm-ik-ben"); } catch (e) {}
    const standaard = buitendienst.find(function (m) { return m.id === bewaard; }) ||
                      buitendienst.find(function (m) { return naam(m) === "Jan Bakker"; }) || buitendienst[0];
    stand.ikBen = standaard ? standaard.id : null;
    const keuze = document.getElementById("ik-ben");
    keuze.innerHTML = buitendienst.map(function (m) {
      return '<option value="' + m.id + '"' + (m.id === stand.ikBen ? " selected" : "") + '>' + esc(naam(m)) + '</option>';
    }).join("");
    keuze.onchange = function () {
      stand.ikBen = keuze.value;
      try { localStorage.setItem("gm-ik-ben", keuze.value); } catch (e) {}
      teken();
    };
  }

  // ---------- Laden ----------
  async function herlaad() {
    const g = await Werkopdracht.laadGegevens();
    medewerkers = g.medewerkers;
    klussen = g.klussen;
    afwezigheid = g.afwezigheid;
    dagdelen = g.dagdelen;
    teken();
  }

  // Na opslaan in het werkopdrachtvenster: opnieuw tekenen en naar de juiste dag/week springen
  Werkopdracht.instellen({
    magBewerken: magPlannen,
    toast: function (t, s, o) { toast(t, s, o); },
    naOpslaan: async function (opdracht) {
      await herlaad();
      if (opdracht && opdracht.datum && getoondeDagen().map(iso).indexOf(opdracht.datum) === -1) {
        stand.datum = lees(opdracht.datum);
        schuif(0);
      }
    }
  });

  async function start() {
    await Voorbeeld.zorgVoorAlles();
    await Werkopdracht.zorgVoorNummers();
    medewerkers = await Opslag.alle("medewerkers");
    zetIkBen();
    // Op zaterdag of zondag openen we de komende week
    const wd = vandaag().getDay();
    const weekend = wd === 6 || wd === 0;
    if (window.innerWidth < 760) {
      // Op een telefoon past een hele week niet goed: open de dagweergave
      stand.soort = "dag";
      stand.datum = weekend ? plus(maandag(vandaag()), 7) : vandaag();
      stand.weergave = weekend ? "dag" : "vandaag";
    } else if (weekend) {
      stand.weergave = "volgende"; stand.soort = "week"; stand.datum = plus(maandag(vandaag()), 7);
    }
    await herlaad();
  }

  start();
})();

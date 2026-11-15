/* =========================================================
   Glasmeesters Planner – opnames en inmeten
   Een opname (project) heeft projectgegevens, een lijst ramen
   en het benodigde materieel. Elk raam krijgt een nummer
   (01, 02, ...) en een plaats: gevel + verdieping.

   Bewerken: beheerder en opnemer. Planner kijkt mee.
   Alles wordt automatisch bewaard zodra een raam is opgeslagen.
   ========================================================= */

(function () {
  if (document.body.classList.contains("geen-toegang")) return;

  const rol = huidigeRol();
  const magBewerken = rol === "beheerder" || rol === "opnemer";
  if (!magBewerken) document.body.classList.add("alleen-lezen-opname");

  let opnames = [], medewerkers = [];
  let project = null;            // het project dat open staat (kopie)
  let bewaardeVersie = "";       // om te zien of er niet-opgeslagen wijzigingen zijn
  let huidigRaam = null;         // index in project.ramen, of -1 voor nieuw
  let raamKeuzes = {};           // waarden van de keuzeknoppen in het raamformulier
  let indeling = "nummer";

  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function opties(lijst, leeg) {
    return (leeg !== undefined ? '<option value="">' + leeg + '</option>' : "") +
      lijst.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("");
  }
  function m2(x) { return x.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m²"; }
  function naamVan(id) { const m = medewerkers.find(function (x) { return x.id === id; }); return m ? m.voornaam + " " + m.achternaam : ""; }

  // ---------- Melding onderin ----------
  let toastTimer = null;
  function toast(tekst, soort) {
    const el = $("toast");
    el.className = "toast zichtbaar " + (soort || "");
    el.innerHTML = "<span>" + esc(tekst) + "</span>";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast"; }, 4000);
  }
  function melding(id, soort, tekst) {
    const el = $(id);
    el.className = "melding" + (tekst ? " zichtbaar " + soort : "");
    el.textContent = tekst || "";
    if (tekst) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // ---------- Keuzelijsten vullen ----------
  $("status-filter").innerHTML += OPNAME_STATUS.map(function (s) { return '<option value="' + s.code + '">' + s.naam + '</option>'; }).join("");
  $("p-status").innerHTML = OPNAME_STATUS.map(function (s) { return '<option value="' + s.code + '">' + s.naam + '</option>'; }).join("");
  $("p-gebouw").innerHTML = opties(GEBOUWTYPES, "– kies –");
  $("r-glas-huidig").innerHTML = opties(GLASSOORTEN, "– kies –");
  $("r-glas-nieuw").innerHTML = opties(GLASSOORTEN, "– kies –");
  $("r-kozijn").innerHTML = opties(KOZIJNSOORTEN, "– kies –");
  $("r-beglazing").innerHTML = opties(BEGLAZING, "– kies –");
  $("r-kit").innerHTML = opties(KITSOORTEN, "– kies –");
  $("r-glaslat").innerHTML = opties(GLASLAT_SOORTEN, "– kies –");
  $("r-afst").innerHTML = opties(AFSTANDHOUDERS, "– kies –");
  $("r-afst-kleur").innerHTML = opties(KLEUREN_AFSTANDHOUDER, "– kies –");
  $("r-materieel").innerHTML = MATERIEEL_OPNAME.map(function (m) {
    return '<label class="werkvakje"><input type="checkbox" value="' + m.code + '"> ' + esc(m.naam) + '</label>';
  }).join("");

  // Grote keuzeknoppen (fijn op een tablet): gevel, verdieping, vorm, ja/nee
  const KNOPPEN = {
    gevel: GEVELS, verdieping: VERDIEPINGEN, vorm: RAAMVORMEN,
    glaslatten_vervangen: ["Ja", "Nee"], ventilatierooster: ["Ja", "Nee"]
  };
  document.querySelectorAll(".keuzeknoppen").forEach(function (blok) {
    const veld = blok.dataset.veld;
    blok.innerHTML = KNOPPEN[veld].map(function (w) { return '<button type="button" data-waarde="' + esc(w) + '">' + esc(w) + '</button>'; }).join("");
    blok.addEventListener("click", function (e) {
      const k = e.target.closest("button");
      if (!k || !magBewerken) return;
      raamKeuzes[veld] = raamKeuzes[veld] === k.dataset.waarde ? "" : k.dataset.waarde;  // nog eens tikken = leegmaken
      zetKeuzeknoppen();
    });
  });
  function zetKeuzeknoppen() {
    document.querySelectorAll(".keuzeknoppen").forEach(function (blok) {
      const veld = blok.dataset.veld;
      blok.querySelectorAll("button").forEach(function (k) { k.classList.toggle("actief", raamKeuzes[veld] === k.dataset.waarde); });
    });
    $("r-vorm-toel-veld").hidden = !raamKeuzes.vorm || raamKeuzes.vorm === "Rechthoekig" || raamKeuzes.vorm === "Vierkant";
  }

  // ---------- Projectnummer: OP-2026-0001 ----------
  async function nieuwNummer() {
    const jaar = new Date().getFullYear();
    const t = (await Opslag.haal("instellingen", "teller_opname")) || { id: "teller_opname" };
    const laatste = t.jaar === jaar ? t.laatste : 0;
    t.jaar = jaar; t.laatste = laatste + 1;
    await Opslag.bewaar("instellingen", t);
    return "OP-" + jaar + "-" + String(t.laatste).padStart(4, "0");
  }

  // ---------- Lijst ----------
  function toonLijst() {
    const zoek = $("zoek").value.trim().toLowerCase();
    const status = $("status-filter").value;
    const opnemer = $("opnemer-filter").value;
    const lijst = opnames.filter(function (o) {
      if (status && o.status !== status) return false;
      if (opnemer && o.opnemer !== opnemer) return false;
      return !zoek || [o.nummer, o.klant, o.adres].join(" ").toLowerCase().indexOf(zoek) !== -1;
    }).sort(function (a, b) { return (b.datum || "").localeCompare(a.datum || "") || (b.nummer || "").localeCompare(a.nummer || ""); });

    $("lijst").innerHTML = lijst.length ? lijst.map(function (o) {
      const ramen = o.ramen || [];
      const opp = ramen.reduce(function (t, r) { return t + raamOppervlakte(r); }, 0);
      const mat = projectMaterieel(o).filter(function (m) { return m.nodig; }).map(function (m) { return m.naam; });
      return '<button class="opdracht" data-id="' + o.id + '">' +
               '<span class="opdracht-links"><span class="nummer">' + esc(o.nummer) + '</span>' +
                 '<span class="label st-' + opnameStatusKleur(o.status) + '">' + esc(opnameStatusNaam(o.status)) + '</span></span>' +
               '<span class="opdracht-midden"><strong>' + esc(o.klant || "Zonder naam") + '</strong>' +
                 (o.adres ? '<span class="zacht">' + esc(o.adres) + '</span>' : "") +
                 (mat.length ? '<span class="tags">' + mat.map(function (n) { return '<span class="tag">' + esc(n) + '</span>'; }).join("") + '</span>' : "") +
               '</span>' +
               '<span class="opdracht-rechts"><span>' + esc(o.datum ? datumNL(o.datum) : "") + '</span>' +
                 '<span class="zacht">' + ramen.length + (ramen.length === 1 ? " raam" : " ramen") + (opp ? " · " + m2(opp) : "") + '</span>' +
                 (o.opnemer ? '<span class="zacht">' + esc(naamVan(o.opnemer)) + '</span>' : "") +
               '</span>' +
             '</button>';
    }).join("") : '<div class="binnenkort">Nog geen opnames gevonden.</div>';

    const open = opnames.filter(function (o) { return o.status === "nieuw" || o.status === "uitwerken"; }).length;
    $("samenvatting").textContent = opnames.length + " opnames · " + open + " nog uit te werken";
  }

  // Materieel van het project: per soort of het nodig is (project of ramen), hoe vaak bij ramen, en de toelichting
  function projectMaterieel(o) {
    return MATERIEEL_OPNAME.map(function (m) {
      const bijRamen = (o.ramen || []).filter(function (r) { return (r.materieel || []).indexOf(m.code) !== -1; });
      const p = (o.materieel || {})[m.code] || {};
      return { code: m.code, naam: m.naam, bevoegdheid: m.bevoegdheid, project: !!p.nodig, toelichting: p.toelichting || "",
               ramen: bijRamen.map(function (r) { return r.nummer; }), nodig: !!p.nodig || bijRamen.length > 0 };
    });
  }

  // ---------- Project openen ----------
  function toonScherm(welk) {
    $("lijst-scherm").hidden = welk !== "lijst";
    $("project-scherm").hidden = welk !== "project";
    window.scrollTo(0, 0);
  }

  function kiesTab(tab) {
    document.querySelectorAll("[data-tab]").forEach(function (k) { k.classList.toggle("actief", k.dataset.tab === tab); });
    ["project", "ramen", "materieel"].forEach(function (t) { $("tab-" + t).hidden = t !== tab; });
    if (tab === "materieel") tekenMaterieel();
  }

  function openProject(o) {
    project = JSON.parse(JSON.stringify(o || {
      nummer: "", datum: iso(new Date()), status: "nieuw", klant: "", telefoon: "", email: "", adres: "",
      gebouwtype: "", bouwjaar: "", opnemer: "", opmerkingen: "", materieel: {}, personen: "", duur_uren: "",
      bereikbaarheid: "", ramen: []
    }));
    if (!o && rol === "opnemer") {
      // In testmodus: de eerste opnemer als standaard
      const eerste = medewerkers.find(function (m) { return m.actief && m.functie === "Opnemer"; });
      if (eerste) project.opnemer = eerste.id;
    }
    $("p-opnemer").innerHTML = '<option value="">– kies –</option>' + medewerkers
      .filter(function (m) { return m.actief && (groepVanFunctie(m.functie) === "opname" || m.rol === "beheerder"); })
      .map(function (m) { return '<option value="' + m.id + '">' + esc(m.voornaam + " " + m.achternaam) + '</option>'; }).join("");
    vulProjectvelden();
    bewaardeVersie = o ? JSON.stringify(project) : "";
    melding("p-melding");
    kiesTab("project");
    toonScherm("project");
    document.querySelectorAll("#project-scherm input, #project-scherm select, #project-scherm textarea").forEach(function (el) {
      if (el.id !== "p-nummer") el.disabled = !magBewerken;
    });
  }

  function vulProjectvelden() {
    const p = project;
    $("p-titel").textContent = p.klant || (p.nummer ? p.nummer : "Nieuwe opname");
    $("p-sub").textContent = [p.nummer, p.adres].filter(Boolean).join(" · ");
    const zet = function (id, w) { $(id).value = w === undefined || w === null ? "" : w; };
    zet("p-nummer", p.nummer); zet("p-datum", p.datum); zet("p-status", p.status); zet("p-klant", p.klant);
    zet("p-tel", p.telefoon); zet("p-mail", p.email); zet("p-adres", p.adres); zet("p-gebouw", p.gebouwtype);
    zet("p-bouwjaar", p.bouwjaar); zet("p-opnemer", p.opnemer); zet("p-opm", p.opmerkingen);
    zet("p-personen", p.personen); zet("p-duur", p.duur_uren); zet("p-bereik", p.bereikbaarheid);
    tekenRamen();
  }

  function leesProjectvelden() {
    Object.assign(project, {
      datum: $("p-datum").value, status: $("p-status").value, klant: $("p-klant").value.trim(),
      telefoon: $("p-tel").value.trim(), email: $("p-mail").value.trim(), adres: $("p-adres").value.trim(),
      gebouwtype: $("p-gebouw").value, bouwjaar: $("p-bouwjaar").value, opnemer: $("p-opnemer").value,
      opmerkingen: $("p-opm").value.trim(), personen: $("p-personen").value, duur_uren: $("p-duur").value,
      bereikbaarheid: $("p-bereik").value.trim()
    });
    // Materieel op projectniveau
    document.querySelectorAll("#materieel .mat-rij").forEach(function (rij) {
      project.materieel[rij.dataset.code] = {
        nodig: rij.querySelector("input[type=checkbox]").checked,
        toelichting: rij.querySelector("input.mat-toel").value.trim()
      };
    });
  }

  async function bewaarProject(stil) {
    if (!magBewerken) return false;
    leesProjectvelden();
    if (!project.klant) {
      kiesTab("project");
      melding("p-melding", "fout", "Vul eerst de naam van de klant in. Daarna wordt alles automatisch bewaard.");
      $("p-klant").focus();
      return false;
    }
    if (!project.nummer) project.nummer = await nieuwNummer();
    project = await Opslag.bewaar("opnames", project);
    bewaardeVersie = JSON.stringify(project);
    opnames = await Opslag.alle("opnames");
    vulProjectvelden();
    $("p-bewaard").textContent = "Bewaard om " + new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
    if (!stil) toast("Opname " + project.nummer + " opgeslagen.", "goed");
    melding("p-melding");
    return true;
  }

  // ---------- Ramen ----------
  function raamRegel(r, i) {
    const opp = raamOppervlakte(r);
    const plaats = [r.gevel, r.verdieping].filter(Boolean).join(" · ");
    const maat = r.breedte && r.hoogte ? r.breedte + " × " + r.hoogte + " mm" : '<span class="oranje-tekst">maten ontbreken</span>';
    return '<button type="button" class="raam-kaart" data-index="' + i + '">' +
             '<span class="raam-nummer">' + esc(r.nummer) + '</span>' +
             '<span class="raam-tekst">' +
               '<strong>' + esc(r.ruimte || "Raam " + r.nummer) + '</strong>' +
               '<span class="zacht">' + esc(plaats || "plaats niet ingevuld") + '</span>' +
               '<span>' + maat + (r.aantal_ruiten > 1 ? " · " + r.aantal_ruiten + " ruiten" : "") + (opp ? " · " + m2(opp) : "") + '</span>' +
               '<span class="tags">' +
                 (r.glas_nieuw ? '<span class="tag">' + esc(r.glas_nieuw) + '</span>' : "") +
                 (r.glaslatten_vervangen === "Ja" ? '<span class="tag">glaslatten vervangen</span>' : "") +
                 (r.vorm && r.vorm !== "Rechthoekig" ? '<span class="tag">' + esc(r.vorm) + '</span>' : "") +
                 (r.materieel || []).map(function (c) { return '<span class="tag tag-materieel">' + esc(materieelNaam(c)) + '</span>'; }).join("") +
               '</span>' +
             '</span>' +
           '</button>';
  }

  function tekenRamen() {
    const ramen = project.ramen || [];
    $("tab-ramen-aantal").textContent = "(" + ramen.length + ")";
    const opp = ramen.reduce(function (t, r) { return t + raamOppervlakte(r); }, 0);
    const ruiten = ramen.reduce(function (t, r) { return t + (Number(r.aantal_ruiten) || 1); }, 0);
    $("ramen-totaal").textContent = ramen.length ? ramen.length + " ramen · " + ruiten + " ruiten · totaal " + m2(opp) : "";
    if (!ramen.length) {
      $("ramen").innerHTML = '<div class="binnenkort">Nog geen ramen. Tik op <strong>+ Raam toevoegen</strong>.</div>';
      return;
    }
    const metIndex = ramen.map(function (r, i) { return { r: r, i: i }; })
      .sort(function (a, b) { return String(a.r.nummer).localeCompare(String(b.r.nummer), "nl", { numeric: true }); });
    if (indeling === "gevel") {
      let html = "";
      GEVELS.concat([""]).forEach(function (g) {
        const groep = metIndex.filter(function (x) { return (x.r.gevel || "") === g; });
        if (!groep.length) return;
        const gOpp = groep.reduce(function (t, x) { return t + raamOppervlakte(x.r); }, 0);
        html += '<h3 class="gevel-kop">' + esc(g || "Gevel niet ingevuld") + ' <span class="zacht">(' + groep.length + " · " + m2(gOpp) + ')</span></h3>' +
                '<div class="ramen-raster">' + groep.map(function (x) { return raamRegel(x.r, x.i); }).join("") + '</div>';
      });
      $("ramen").innerHTML = html;
    } else {
      $("ramen").innerHTML = '<div class="ramen-raster">' + metIndex.map(function (x) { return raamRegel(x.r, x.i); }).join("") + '</div>';
    }
  }

  function volgendNummer() {
    const nummers = (project.ramen || []).map(function (r) { return parseInt(r.nummer, 10) || 0; });
    return String((nummers.length ? Math.max.apply(null, nummers) : 0) + 1).padStart(2, "0");
  }

  function openRaam(index, voorinvulling) {
    huidigRaam = index;
    const r = index >= 0 ? project.ramen[index] : Object.assign({
      nummer: volgendNummer(), ruimte: "", aantal_ruiten: 1, gevel: "", verdieping: "", breedte: "", hoogte: "",
      glasdikte: "", spouwbreedte: "", vorm: "Rechthoekig", vorm_toelichting: "", glas_huidig: "", glas_nieuw: "",
      kozijn: "", beglazing: "", kitsoort: "", glaslat_soort: "", glaslat_profiel: "", glaslat_maten: "",
      glaslatten_vervangen: "", afstandhouder: "", afstandhouder_kleur: "", ventilatierooster: "", schade: "",
      materieel: [], bereikbaarheid: "", opmerkingen: ""
    }, voorinvulling || {});
    $("r-titel").textContent = index >= 0 ? "Raam " + r.nummer + (r.ruimte ? " – " + r.ruimte : "") : "Nieuw raam";
    const zet = function (id, w) { $(id).value = w === undefined || w === null ? "" : w; };
    zet("r-nummer", r.nummer); zet("r-ruimte", r.ruimte); zet("r-aantal", r.aantal_ruiten || 1);
    zet("r-breedte", r.breedte); zet("r-hoogte", r.hoogte); zet("r-dikte", r.glasdikte); zet("r-spouw", r.spouwbreedte);
    zet("r-vorm-toel", r.vorm_toelichting); zet("r-glas-huidig", r.glas_huidig); zet("r-glas-nieuw", r.glas_nieuw);
    zet("r-kozijn", r.kozijn); zet("r-beglazing", r.beglazing); zet("r-kit", r.kitsoort); zet("r-glaslat", r.glaslat_soort);
    zet("r-profiel", r.glaslat_profiel); zet("r-latmaat", r.glaslat_maten); zet("r-afst", r.afstandhouder);
    zet("r-afst-kleur", r.afstandhouder_kleur); zet("r-schade", r.schade); zet("r-bereik", r.bereikbaarheid); zet("r-opm", r.opmerkingen);
    raamKeuzes = { gevel: r.gevel, verdieping: r.verdieping, vorm: r.vorm, glaslatten_vervangen: r.glaslatten_vervangen, ventilatierooster: r.ventilatierooster };
    zetKeuzeknoppen();
    document.querySelectorAll("#r-materieel input").forEach(function (v) { v.checked = (r.materieel || []).indexOf(v.value) !== -1; });
    toonOpp();
    $("r-verwijder").hidden = index < 0;
    $("r-kopie").hidden = index < 0;
    melding("r-melding");
    document.querySelectorAll("#raam input, #raam select, #raam textarea").forEach(function (el) { el.disabled = !magBewerken; });
    $("raam").showModal();
    if (magBewerken && index < 0) setTimeout(function () { $("r-ruimte").focus(); }, 50);
  }

  function toonOpp() {
    const opp = raamOppervlakte({ breedte: $("r-breedte").value, hoogte: $("r-hoogte").value, aantal_ruiten: $("r-aantal").value });
    $("r-opp").textContent = opp ? m2(opp) : "–";
  }
  ["r-breedte", "r-hoogte", "r-aantal"].forEach(function (id) { $(id).addEventListener("input", toonOpp); });

  function leesRaam() {
    return {
      id: huidigRaam >= 0 ? project.ramen[huidigRaam].id : Opslag.nieuwId(),
      nummer: String($("r-nummer").value.trim() || volgendNummer()).padStart(2, "0"),
      ruimte: $("r-ruimte").value.trim(), aantal_ruiten: Number($("r-aantal").value) || 1,
      gevel: raamKeuzes.gevel || "", verdieping: raamKeuzes.verdieping || "",
      breedte: $("r-breedte").value, hoogte: $("r-hoogte").value, glasdikte: $("r-dikte").value, spouwbreedte: $("r-spouw").value,
      vorm: raamKeuzes.vorm || "", vorm_toelichting: $("r-vorm-toel").value.trim(),
      glas_huidig: $("r-glas-huidig").value, glas_nieuw: $("r-glas-nieuw").value, kozijn: $("r-kozijn").value,
      beglazing: $("r-beglazing").value, kitsoort: $("r-kit").value, glaslat_soort: $("r-glaslat").value,
      glaslat_profiel: $("r-profiel").value.trim(), glaslat_maten: $("r-latmaat").value.trim(),
      glaslatten_vervangen: raamKeuzes.glaslatten_vervangen || "", afstandhouder: $("r-afst").value,
      afstandhouder_kleur: $("r-afst-kleur").value, ventilatierooster: raamKeuzes.ventilatierooster || "",
      schade: $("r-schade").value.trim(),
      materieel: Array.prototype.slice.call(document.querySelectorAll("#r-materieel input:checked")).map(function (x) { return x.value; }),
      bereikbaarheid: $("r-bereik").value.trim(), opmerkingen: $("r-opm").value.trim()
    };
  }

  async function bewaarRaam(daarnaNieuw) {
    if (!magBewerken) return;
    const r = leesRaam();
    const dubbel = project.ramen.find(function (x, i) { return i !== huidigRaam && String(x.nummer) === r.nummer; });
    if (dubbel) { melding("r-melding", "fout", "Raamnummer " + r.nummer + " bestaat al in dit project."); return; }
    if (!r.breedte || !r.hoogte) {
      if ($("r-melding").dataset.gewaarschuwd !== "1") {
        $("r-melding").dataset.gewaarschuwd = "1";
        melding("r-melding", "waarschuwing", "Let op: de breedte of hoogte ontbreekt. Tik nog een keer om toch op te slaan.");
        return;
      }
    }
    $("r-melding").dataset.gewaarschuwd = "";
    if (huidigRaam >= 0) project.ramen[huidigRaam] = r; else project.ramen.push(r);
    // Automatisch bewaren (lukt pas als de klantnaam is ingevuld)
    const ok = await bewaarProject(true);
    $("raam").close();
    tekenRamen();
    if (ok) toast("Raam " + r.nummer + " opgeslagen.", "goed");
    else toast("Raam toegevoegd. Vul de klantnaam in om alles te bewaren.", "waarschuwing");
    if (daarnaNieuw) {
      // Volgend raam: plaats en glas alvast overnemen, dat scheelt typen
      openRaam(-1, { gevel: r.gevel, verdieping: r.verdieping, glas_huidig: r.glas_huidig, glas_nieuw: r.glas_nieuw,
                     kozijn: r.kozijn, beglazing: r.beglazing, kitsoort: r.kitsoort, glaslat_soort: r.glaslat_soort,
                     afstandhouder: r.afstandhouder, afstandhouder_kleur: r.afstandhouder_kleur });
    }
  }

  $("raam-form").addEventListener("submit", function (e) { e.preventDefault(); bewaarRaam(false); });
  $("r-volgend").addEventListener("click", function () { bewaarRaam(true); });
  // Kopiëren: handig bij meerdere gelijke ramen. Alles wordt overgenomen behalve het nummer.
  $("r-kopie").addEventListener("click", function () {
    const van = project.ramen[huidigRaam].nummer;
    const kopie = leesRaam();
    delete kopie.id;
    kopie.nummer = volgendNummer();
    $("raam").close();
    openRaam(-1, kopie);
    $("r-titel").textContent = "Nieuw raam (kopie van raam " + van + ")";
  });
  $("r-verwijder").addEventListener("click", async function () {
    if (huidigRaam < 0) return;
    const r = project.ramen[huidigRaam];
    if (!confirm("Raam " + r.nummer + (r.ruimte ? " (" + r.ruimte + ")" : "") + " verwijderen?")) return;
    project.ramen.splice(huidigRaam, 1);
    $("raam").close();
    await bewaarProject(true);
    tekenRamen();
    toast("Raam " + r.nummer + " verwijderd.", "");
  });
  document.querySelectorAll("[data-raam-sluit]").forEach(function (k) { k.addEventListener("click", function () { $("raam").close(); }); });

  $("ramen").addEventListener("click", function (e) {
    const k = e.target.closest(".raam-kaart");
    if (k) openRaam(Number(k.dataset.index));
  });
  $("raam-nieuw").addEventListener("click", function () {
    const laatste = project.ramen[project.ramen.length - 1];
    openRaam(-1, laatste ? { gevel: laatste.gevel, verdieping: laatste.verdieping, glas_nieuw: laatste.glas_nieuw, kozijn: laatste.kozijn } : {});
  });
  document.querySelectorAll("[data-indeling]").forEach(function (k) {
    k.addEventListener("click", function () {
      indeling = k.dataset.indeling;
      document.querySelectorAll("[data-indeling]").forEach(function (x) { x.classList.toggle("actief", x === k); });
      tekenRamen();
    });
  });

  // ---------- Materieel ----------
  function tekenMaterieel() {
    const lijst = projectMaterieel(project);
    $("materieel").innerHTML = lijst.map(function (m) {
      const uit = magBewerken ? "" : " disabled";
      return '<div class="mat-rij' + (m.nodig ? " aan" : "") + '" data-code="' + m.code + '">' +
               '<label class="vinkje"><input type="checkbox"' + (m.project ? " checked" : "") + uit + '> <strong>' + esc(m.naam) + '</strong></label>' +
               '<span class="zacht mat-ramen">' + (m.ramen.length ? "bij raam " + m.ramen.join(", ") : "") +
                 (m.bevoegdheid && m.nodig ? ' · <span class="oranje-tekst">certificaat "' + esc(bevoegdheidNaam(m.bevoegdheid)) + '" nodig</span>' : "") + '</span>' +
               '<input class="mat-toel" placeholder="Toelichting" value="' + esc(m.toelichting) + '"' + uit + '>' +
             '</div>';
    }).join("");
  }
  $("materieel").addEventListener("change", function () { leesProjectvelden(); tekenMaterieel(); });

  // ---------- Knoppen en navigatie ----------
  document.querySelectorAll("[data-tab]").forEach(function (k) {
    k.addEventListener("click", function () { leesProjectvelden(); kiesTab(k.dataset.tab); });
  });
  $("p-opslaan").addEventListener("click", function () { bewaarProject(false); });
  $("p-klant").addEventListener("input", function () { $("p-titel").textContent = $("p-klant").value || "Nieuwe opname"; });

  $("terug").addEventListener("click", function () {
    if (magBewerken) {
      leesProjectvelden();
      const gewijzigd = JSON.stringify(project) !== bewaardeVersie && (project.klant || project.ramen.length);
      if (gewijzigd && !confirm("Er zijn wijzigingen die nog niet zijn opgeslagen. Toch teruggaan?")) return;
    }
    project = null;
    history.replaceState(null, "", "opnames.html");
    toonLijst();
    toonScherm("lijst");
  });

  $("lijst").addEventListener("click", function (e) {
    const k = e.target.closest(".opdracht");
    if (!k) return;
    const o = opnames.find(function (x) { return x.id === k.dataset.id; });
    history.replaceState(null, "", "opnames.html?id=" + o.id);
    openProject(o);
  });
  $("nieuw").addEventListener("click", function () { openProject(null); });
  ["zoek", "status-filter", "opnemer-filter"].forEach(function (id) {
    $(id).addEventListener(id === "zoek" ? "input" : "change", toonLijst);
  });
  if (!magBewerken) $("nieuw").hidden = true;

  // Waarschuwen bij sluiten van het tabblad met niet-opgeslagen wijzigingen
  window.addEventListener("beforeunload", function (e) {
    if (!project || !magBewerken) return;
    leesProjectvelden();
    if (JSON.stringify(project) !== bewaardeVersie && (project.klant || project.ramen.length)) { e.preventDefault(); e.returnValue = ""; }
  });

  (async function () {
    await Voorbeeld.zorgVoorAlles();
    await Voorbeeld.zorgVoorOpname();
    medewerkers = await Opslag.alle("medewerkers");
    opnames = await Opslag.alle("opnames");
    $("opnemer-filter").innerHTML += medewerkers.filter(function (m) { return groepVanFunctie(m.functie) === "opname"; })
      .map(function (m) { return '<option value="' + m.id + '">' + esc(m.voornaam + " " + m.achternaam) + '</option>'; }).join("");
    toonLijst();
    const id = new URLSearchParams(location.search).get("id");
    if (id) { const o = opnames.find(function (x) { return x.id === id; }); if (o) openProject(o); }
  })();
})();

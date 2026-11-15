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
  let projectBestanden = [];     // foto's van dit project (gevels en ramen)
  let raamId = null;             // id van het raam dat open staat
  let raamOpgeslagen = false;
  let nieuweRaamFotos = [];      // foto's bij een nieuw raam dat nog niet is opgeslagen
  let raamSchets = null;         // { kolommen, rijen, elementen }
  let urls = [];
  let gevelVoorFoto = "";
  const FOTO_GEVELS = ["Voorzijde", "Achterzijde", "Linkerzijde", "Rechterzijde", "Dak", "Overig"];

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
  $("p-nb-regeling").innerHTML = opties(NB_REGELINGEN, "– kies –");
  $("p-nb-status").innerHTML = NB_STATUS.map(function (s) { return '<option value="' + s.code + '">' + s.naam + '</option>'; }).join("");
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
    glaslatten_vervangen: ["Ja", "Nee"], rooster_soort: ROOSTER_SOORTEN
  };
  $("r-rooster-kleur").innerHTML = opties(ROOSTER_KLEUREN, "– kies –");
  $("r-rooster-plaatsing").innerHTML = opties(ROOSTER_PLAATSING, "– kies –");
  document.querySelectorAll(".keuzeknoppen[data-veld]").forEach(function (blok) {
    const veld = blok.dataset.veld;
    blok.innerHTML = KNOPPEN[veld].map(function (w) { return '<button type="button" data-waarde="' + esc(w) + '">' + esc(w) + '</button>'; }).join("");
    blok.addEventListener("click", function (e) {
      const k = e.target.closest("button");
      if (!k || !magBewerken) return;
      raamKeuzes[veld] = raamKeuzes[veld] === k.dataset.waarde ? "" : k.dataset.waarde;  // nog eens tikken = leegmaken
      // Rooster gekozen: lengte alvast gelijk aan de breedte van het raam
      if (veld === "rooster_soort" && raamKeuzes.rooster_soort && raamKeuzes.rooster_soort !== "Geen" && !$("r-rooster-lengte").value) {
        $("r-rooster-lengte").value = $("r-breedte").value;
        if (!$("r-rooster-aantal").value) $("r-rooster-aantal").value = 1;
      }
      zetKeuzeknoppen();
      if (veld === "vorm") tekenSchetsMini();
    });
  });
  function zetKeuzeknoppen() {
    document.querySelectorAll(".keuzeknoppen[data-veld]").forEach(function (blok) {
      const veld = blok.dataset.veld;
      blok.querySelectorAll("button").forEach(function (k) { k.classList.toggle("actief", raamKeuzes[veld] === k.dataset.waarde); });
    });
    $("r-vorm-toel-veld").hidden = !raamKeuzes.vorm || raamKeuzes.vorm === "Rechthoekig" || raamKeuzes.vorm === "Vierkant";
    $("r-rooster-velden").hidden = !raamKeuzes.rooster_soort || raamKeuzes.rooster_soort === "Geen";
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
      const reken = ramen.reduce(function (t, r) { return t + raamRekenOppervlakte(r); }, 0);
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
                 (reken && Math.abs(reken - opp) > 0.004 ? '<span class="zacht">te berekenen ' + m2(reken) + '</span>' : "") +
                 (o.opnemer ? '<span class="zacht">' + esc(naamVan(o.opnemer)) + '</span>' : "") +
               '</span>' +
             '</button>';
    }).join("") : '<div class="binnenkort">Nog geen opnames gevonden.</div>';

    const open = opnames.filter(function (o) { return o.status === "nieuw" || o.status === "uitwerken"; }).length;
    $("samenvatting").textContent = opnames.length + " opnames · " + open + " nog uit te werken";
  }

  // Materieel van het project: per soort of het nodig is (project of ramen), hoe vaak bij ramen, en de toelichting
  function projectMaterieel(o) { return opnameMaterieel(o); }

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
    projectBestanden = [];
    vulProjectvelden();
    laadProjectBestanden();
    bewaardeVersie = o ? JSON.stringify(project) : "";
    melding("p-melding");
    kiesTab("project");
    toonScherm("project");
    document.querySelectorAll("#project-scherm input, #project-scherm select, #project-scherm textarea").forEach(function (el) {
      if (el.id !== "p-nummer") el.disabled = !magBewerken && !(magNbStatus && NB_PLANNER_VELDEN.indexOf(el.id) !== -1);
    });
    document.querySelectorAll("#p-nb button").forEach(function (k) { k.disabled = !magBewerken; });
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
    zet("p-nb-regeling", p.nb_regeling); zet("p-nb-status", p.nb_status || ""); zet("p-nb-plan", p.nb_isolatieplan); zet("p-nb-dossier", p.nb_dossier);
    tekenNijBegun();
    tekenActies();
    tekenRamen();
  }

  function leesProjectvelden() {
    Object.assign(project, {
      datum: $("p-datum").value, status: $("p-status").value, klant: $("p-klant").value.trim(),
      telefoon: $("p-tel").value.trim(), email: $("p-mail").value.trim(), adres: $("p-adres").value.trim(),
      gebouwtype: $("p-gebouw").value, bouwjaar: $("p-bouwjaar").value, opnemer: $("p-opnemer").value,
      opmerkingen: $("p-opm").value.trim(), personen: $("p-personen").value, duur_uren: $("p-duur").value,
      bereikbaarheid: $("p-bereik").value.trim(),
      nb_regeling: $("p-nb-regeling").value, nb_status: $("p-nb-status").value,
      nb_isolatieplan: $("p-nb-plan").value, nb_dossier: $("p-nb-dossier").value.trim()
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

  // ---------- Nij Begun ----------
  // De planner mag de stand van zaken en het dossiernummer bijwerken (ook al mag hij de opname zelf niet wijzigen)
  const magNbStatus = rol === "planner";
  const NB_PLANNER_VELDEN = ["p-nb-status", "p-nb-dossier"];

  function tekenNijBegun() {
    const nb = project.nij_begun || "";
    document.querySelectorAll("#p-nb button").forEach(function (k) { k.classList.toggle("actief", k.dataset.nb === nb && (nb !== "" || project.nij_begun === "")); });
    $("nb-velden").hidden = nb !== "Ja";
    if (nb !== "Ja") return;
    const lijst = nbMaatregelen(project);
    const zonderCode = lijst.some(function (g) { return !g.code; });
    $("nb-maatregelen").innerHTML = lijst.length
      ? '<table class="tabel"><thead><tr><th>Maatregelcode</th><th>Maatregel</th><th>Waarde</th><th>Aantal</th><th>Ramen</th></tr></thead><tbody>' +
        lijst.map(function (g) {
          return '<tr><td>' + (g.code ? '<strong>' + esc(g.code) + '</strong>' : '<span class="rood-tekst">ontbreekt</span>') + '</td><td>' + esc(g.omschrijving) +
                 '</td><td>' + esc(g.waarde || "–") + '</td><td>' + (g.eenheid === "m²" ? m2(g.hoeveel) : g.hoeveel + (g.hoeveel === 1 ? " stuk" : " stuks") + (g.mm ? " (" + (g.mm / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 2 }) + " m)" : "")) +
                 '</td><td>' + esc(g.ramen.join(", ")) + '</td></tr>';
        }).join("") + '</tbody></table>' +
        (zonderCode ? '<p class="uitleg">Niet elke maatregel heeft een code. De beheerder vult de codes uit de maatregelencatalogus in onder <strong>💶 Tarieven → Nij Begun</strong>.</p>' : "")
      : '<p class="zacht">Nog geen ramen met nieuw glas of roosters.</p>';
  }

  document.querySelectorAll("#p-nb button").forEach(function (k) {
    k.addEventListener("click", function () {
      if (!magBewerken) return;
      leesProjectvelden();
      project.nij_begun = k.dataset.nb;
      if (project.nij_begun === "Ja" && !project.nb_regeling) { project.nb_regeling = NB_REGELINGEN[0]; $("p-nb-regeling").value = project.nb_regeling; }
      tekenNijBegun();
    });
  });
  // Planner: stand van zaken meteen bewaren
  NB_PLANNER_VELDEN.forEach(function (id) {
    $(id).addEventListener("change", async function () {
      if (magBewerken || !magNbStatus || !project || !project.id) return;
      const o = await Opslag.haal("opnames", project.id);
      if (!o) return;
      o.nb_status = $("p-nb-status").value; o.nb_dossier = $("p-nb-dossier").value.trim();
      project.nb_status = o.nb_status; project.nb_dossier = o.nb_dossier;
      await Opslag.bewaar("opnames", o);
      bewaardeVersie = JSON.stringify(project);
      toast("Nij Begun bijgewerkt: " + nbStatusNaam(o.nb_status) + ".", "goed");
    });
  });

  // ---------- PDF en omzetten naar werkopdracht ----------
  function tekenActies() {
    const bestaat = !!project.id;
    $("p-pdf").hidden = !bestaat;
    $("p-omzetten").hidden = !bestaat || ["beheerder", "planner", "opnemer"].indexOf(rol) === -1;
    $("p-omzetten").textContent = project.werkopdracht ? "📋 Werkopdracht " + (project.werkopdracht_nummer || "") : "→ Werkopdracht maken";
  }

  async function bewaarAlsNodig() {
    if (!magBewerken) return true;
    leesProjectvelden();
    if (JSON.stringify(project) === bewaardeVersie) return true;
    return bewaarProject(true);
  }

  $("p-pdf").addEventListener("click", async function () {
    if (!(await bewaarAlsNodig())) return;
    location.href = "opname-pdf.html?id=" + encodeURIComponent(project.id);
  });

  $("p-omzetten").addEventListener("click", async function () {
    if (!(await bewaarAlsNodig())) return;
    if (project.werkopdracht) {
      const k = await Opslag.haal("klussen", project.werkopdracht);
      if (k) { location.href = "werkopdrachten.html?id=" + encodeURIComponent(k.id); return; }
      // De werkopdracht is verwijderd: opnieuw maken mag
    }
    if (!(project.ramen || []).length && !confirm("Deze opname heeft nog geen ramen. Toch een werkopdracht maken?")) return;
    if (!confirm("Van opname " + project.nummer + " (" + project.klant + ") een werkopdracht maken?\n\nKlant, adres, werkzaamheden, glas, roosters, materialen en gereedschap worden overgenomen. Daarna kies je in de werkopdracht de datum en de ploeg.")) return;
    const klus = await Omzetten.maakWerkopdracht(project, rol);
    project = await Opslag.haal("opnames", project.id);
    bewaardeVersie = JSON.stringify(project);
    location.href = "werkopdrachten.html?id=" + encodeURIComponent(klus.id) + "&nieuw=1";
  });

  // ---------- Ramen ----------
  function raamRegel(r, i) {
    const opp = raamOppervlakte(r);
    const reken = raamRekenOppervlakte(r);
    const plaats = [r.gevel, r.verdieping].filter(Boolean).join(" · ");
    const maat = r.breedte && r.hoogte ? r.breedte + " × " + r.hoogte + " mm" : '<span class="oranje-tekst">maten ontbreken</span>';
    const fotos = projectBestanden.filter(function (b) { return b.raam === r.id; }).length;
    return '<button type="button" class="raam-kaart" data-index="' + i + '">' +
             '<span class="raam-links"><span class="raam-nummer">' + esc(r.nummer) + '</span>' +
               '<span class="raam-mini">' + Schets.svg(r.schets, r, { titel: false, maten: false }) + '</span>' +
               (fotos ? '<span class="zacht">📷 ' + fotos + '</span>' : "") + '</span>' +
             '<span class="raam-tekst">' +
               '<strong>' + esc(r.ruimte || "Raam " + r.nummer) + '</strong>' +
               '<span class="zacht">' + esc(plaats || "plaats niet ingevuld") + '</span>' +
               '<span>' + maat + (r.aantal_ruiten > 1 ? " · " + r.aantal_ruiten + " ruiten" : "") + (opp ? " · " + m2(opp) : "") + '</span>' +
               (reken && Math.abs(reken - opp) > 0.004 ? '<span class="minimum">berekend als ' + m2(reken) + ' (minimum ' + m2(MINIMUM_M2_PER_RUIT) + ' per ruit)</span>' : "") +
               '<span class="tags">' +
                 (r.glas_nieuw ? '<span class="tag">' + esc(r.glas_nieuw) + '</span>' : "") +
                 (r.glaslatten_vervangen === "Ja" ? '<span class="tag">glaslatten vervangen</span>' : "") +
                 (roosterSoort(r) && roosterSoort(r) !== "Geen" ? '<span class="tag tag-rooster">' + esc(roosterSoort(r).replace(" rooster", "")) + " rooster" +
                   (r.rooster_lengte ? " " + esc(r.rooster_lengte) + " mm" : "") + (r.rooster_aantal > 1 ? " × " + r.rooster_aantal : "") + '</span>' : "") +
                 (r.vorm && r.vorm !== "Rechthoekig" ? '<span class="tag">' + esc(r.vorm) + '</span>' : "") +
                 (r.materieel || []).map(function (c) { return '<span class="tag tag-materieel">' + esc(materieelNaam(c)) + '</span>'; }).join("") +
               '</span>' +
             '</span>' +
           '</button>';
  }

  function tekenRamen() {
    if (project && project.nij_begun === "Ja") tekenNijBegun();
    const ramen = project.ramen || [];
    $("tab-ramen-aantal").textContent = "(" + ramen.length + ")";
    const opp = ramen.reduce(function (t, r) { return t + raamOppervlakte(r); }, 0);
    const ruiten = ramen.reduce(function (t, r) { return t + (Number(r.aantal_ruiten) || 1); }, 0);
    const reken = ramen.reduce(function (t, r) { return t + raamRekenOppervlakte(r); }, 0);
    $("ramen-totaal").innerHTML = ramen.length ? ramen.length + " ramen · " + ruiten + " ruiten · werkelijk " + m2(opp) +
      " · <strong>te berekenen " + m2(reken) + "</strong>" : "";
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
      glaslatten_vervangen: "", afstandhouder: "", afstandhouder_kleur: "", schade: "",
      rooster_soort: "", rooster_lengte: "", rooster_aantal: "", rooster_kleur: "", rooster_plaatsing: "",
      materieel: [], bereikbaarheid: "", opmerkingen: ""
    }, voorinvulling || {});
    raamId = r.id || Opslag.nieuwId();
    raamOpgeslagen = false;
    nieuweRaamFotos = [];
    raamSchets = JSON.parse(JSON.stringify(r.schets || { kolommen: 1, rijen: 1, elementen: [] }));
    $("r-titel").textContent = index >= 0 ? "Raam " + r.nummer + (r.ruimte ? " – " + r.ruimte : "") : "Nieuw raam";
    const zet = function (id, w) { $(id).value = w === undefined || w === null ? "" : w; };
    zet("r-nummer", r.nummer); zet("r-ruimte", r.ruimte); zet("r-aantal", r.aantal_ruiten || 1);
    zet("r-breedte", r.breedte); zet("r-hoogte", r.hoogte); zet("r-dikte", r.glasdikte); zet("r-spouw", r.spouwbreedte);
    zet("r-vorm-toel", r.vorm_toelichting); zet("r-glas-huidig", r.glas_huidig); zet("r-glas-nieuw", r.glas_nieuw);
    zet("r-kozijn", r.kozijn); zet("r-beglazing", r.beglazing); zet("r-kit", r.kitsoort); zet("r-glaslat", r.glaslat_soort);
    zet("r-profiel", r.glaslat_profiel); zet("r-latmaat", r.glaslat_maten); zet("r-afst", r.afstandhouder);
    zet("r-afst-kleur", r.afstandhouder_kleur); zet("r-schade", r.schade);
    zet("r-rooster-lengte", r.rooster_lengte); zet("r-rooster-aantal", r.rooster_aantal);
    zet("r-rooster-kleur", r.rooster_kleur); zet("r-rooster-plaatsing", r.rooster_plaatsing); zet("r-bereik", r.bereikbaarheid); zet("r-opm", r.opmerkingen);
    raamKeuzes = { gevel: r.gevel, verdieping: r.verdieping, vorm: r.vorm, glaslatten_vervangen: r.glaslatten_vervangen, rooster_soort: roosterSoort(r) };
    zetKeuzeknoppen();
    document.querySelectorAll("#r-materieel input").forEach(function (v) { v.checked = (r.materieel || []).indexOf(v.value) !== -1; });
    toonOpp();
    tekenRaamFotos();
    tekenSchetsMini();
    $("r-verwijder").hidden = index < 0;
    $("r-kopie").hidden = index < 0;
    melding("r-melding");
    document.querySelectorAll("#raam input, #raam select, #raam textarea").forEach(function (el) { el.disabled = !magBewerken; });
    $("raam").showModal();
    if (magBewerken && index < 0) setTimeout(function () { $("r-ruimte").focus(); }, 50);
  }

  function toonOpp() {
    const r = { breedte: $("r-breedte").value, hoogte: $("r-hoogte").value, aantal_ruiten: $("r-aantal").value };
    const opp = raamOppervlakte(r), reken = raamRekenOppervlakte(r);
    $("r-opp").innerHTML = opp ? m2(opp) + (Math.abs(reken - opp) > 0.004
      ? '<span class="minimum">berekend als ' + m2(reken) + '<br>(minimum ' + m2(MINIMUM_M2_PER_RUIT) + ' per ruit)</span>' : "") : "–";
  }
  ["r-breedte", "r-hoogte", "r-aantal"].forEach(function (id) { $(id).addEventListener("input", function () { toonOpp(); tekenSchetsMini(); }); });

  function leesRaam() {
    return {
      id: raamId,
      schets: raamSchets,
      nummer: String($("r-nummer").value.trim() || volgendNummer()).padStart(2, "0"),
      ruimte: $("r-ruimte").value.trim(), aantal_ruiten: Number($("r-aantal").value) || 1,
      gevel: raamKeuzes.gevel || "", verdieping: raamKeuzes.verdieping || "",
      breedte: $("r-breedte").value, hoogte: $("r-hoogte").value, glasdikte: $("r-dikte").value, spouwbreedte: $("r-spouw").value,
      vorm: raamKeuzes.vorm || "", vorm_toelichting: $("r-vorm-toel").value.trim(),
      glas_huidig: $("r-glas-huidig").value, glas_nieuw: $("r-glas-nieuw").value, kozijn: $("r-kozijn").value,
      beglazing: $("r-beglazing").value, kitsoort: $("r-kit").value, glaslat_soort: $("r-glaslat").value,
      glaslat_profiel: $("r-profiel").value.trim(), glaslat_maten: $("r-latmaat").value.trim(),
      glaslatten_vervangen: raamKeuzes.glaslatten_vervangen || "", afstandhouder: $("r-afst").value,
      afstandhouder_kleur: $("r-afst-kleur").value,
      rooster_soort: raamKeuzes.rooster_soort || "",
      rooster_lengte: raamKeuzes.rooster_soort && raamKeuzes.rooster_soort !== "Geen" ? $("r-rooster-lengte").value : "",
      rooster_aantal: raamKeuzes.rooster_soort && raamKeuzes.rooster_soort !== "Geen" ? (Number($("r-rooster-aantal").value) || 1) : "",
      rooster_kleur: $("r-rooster-kleur").value, rooster_plaatsing: $("r-rooster-plaatsing").value,
      ventilatierooster: raamKeuzes.rooster_soort ? (raamKeuzes.rooster_soort === "Geen" ? "Nee" : "Ja") : "",
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
    raamOpgeslagen = true;
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
                     afstandhouder: r.afstandhouder, afstandhouder_kleur: r.afstandhouder_kleur,
                     rooster_soort: r.rooster_soort, rooster_kleur: r.rooster_kleur, rooster_plaatsing: r.rooster_plaatsing });
    }
  }

  $("raam-form").addEventListener("submit", function (e) { e.preventDefault(); bewaarRaam(false); });
  $("r-volgend").addEventListener("click", function () { bewaarRaam(true); });
  // Kopiëren: handig bij meerdere gelijke ramen. Alles wordt overgenomen behalve het nummer.
  $("r-kopie").addEventListener("click", function () {
    const van = project.ramen[huidigRaam].nummer;
    const kopie = leesRaam();
    delete kopie.id;
    kopie.schets = JSON.parse(JSON.stringify(raamSchets));
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
    // Foto's van dit raam ook weghalen
    for (const b of projectBestanden.filter(function (x) { return x.raam === r.id; })) await Opslag.verwijder("bestanden", b.id);
    projectBestanden = projectBestanden.filter(function (x) { return x.raam !== r.id; });
    raamOpgeslagen = true;
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

  // ---------- Foto's ----------
  function verkleinFoto(bestand) {
    return new Promise(function (klaar) {
      const img = new Image();
      const u = URL.createObjectURL(bestand);
      img.onload = function () {
        const schaal = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * schaal); c.height = Math.round(img.height * schaal);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function (blob) { klaar(blob || bestand); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(u); klaar(bestand); };
      img.src = u;
    });
  }

  async function laadProjectBestanden() {
    projectBestanden = project && project.id
      ? (await Opslag.alle("bestanden")).filter(function (b) { return b.opname === project.id; })
          .sort(function (a, b) { return (a.aangemaakt_op || "").localeCompare(b.aangemaakt_op || ""); })
      : [];
    tekenGevelfotos();
    tekenRamen();
  }

  function miniatuur(b) {
    const u = URL.createObjectURL(b.data); urls.push(u);
    return '<div class="bestand">' +
             '<button type="button" class="bestand-open" data-foto="' + b.id + '"><img src="' + u + '" alt=""></button>' +
             (magBewerken ? '<button type="button" class="bestand-weg" data-foto-weg="' + b.id + '" aria-label="Foto verwijderen">✕</button>' : "") +
           '</div>';
  }

  // Foto's van het gebouw, per gevel
  function tekenGevelfotos() {
    $("gevelfotos").innerHTML = FOTO_GEVELS.map(function (g) {
      const lijst = projectBestanden.filter(function (b) { return !b.raam && b.gevel === g; });
      if (!lijst.length && !magBewerken) return "";
      return '<div class="gevel-tegel">' +
               '<div class="gevel-tegel-kop"><strong>' + esc(g) + '</strong>' +
                 (magBewerken ? '<button type="button" class="knop tweede klein" data-gevel-foto="' + esc(g) + '">📷 Foto</button>' : "") + '</div>' +
               (lijst.length ? '<div class="bestanden">' + lijst.map(miniatuur).join("") + '</div>' : '<p class="zacht">Nog geen foto.</p>') +
             '</div>';
    }).join("") || '<p class="zacht">Geen foto\'s.</p>';
  }

  function tekenRaamFotos() {
    const lijst = projectBestanden.filter(function (b) { return b.raam === raamId; });
    $("r-fotos").innerHTML = lijst.length ? lijst.map(miniatuur).join("") : '<p class="zacht" style="margin:0 0 8px">Nog geen foto\'s van dit raam.</p>';
  }

  async function zorgDatProjectBewaardIs() {
    if (project.id) return true;
    const ok = await bewaarProject(true);
    if (!ok) toast("Vul eerst de naam van de klant in (tabblad Project).", "waarschuwing");
    return ok;
  }

  async function voegFotosToe(lijst, extra) {
    if (!lijst || !lijst.length || !magBewerken) return [];
    if (!(await zorgDatProjectBewaardIs())) return [];
    const nieuw = [];
    for (const bestand of Array.prototype.slice.call(lijst)) {
      const data = await verkleinFoto(bestand);
      const b = await Opslag.bewaar("bestanden", Object.assign({
        opname: project.id, soort: "foto", naam: (bestand.name || "foto").replace(/\.[^.]+$/, "") + ".jpg",
        type: data.type || "image/jpeg", grootte: data.size, data: data
      }, extra));
      projectBestanden.push(b);
      nieuw.push(b);
    }
    return nieuw;
  }

  $("gevelfotos").addEventListener("click", function (e) {
    const k = e.target.closest("[data-gevel-foto]");
    if (k) { gevelVoorFoto = k.dataset.gevelFoto; $("gevel-bestand").click(); }
  });
  $("gevel-bestand").addEventListener("change", async function (e) {
    const bestanden = Array.from(e.target.files); e.target.value = "";
    const nieuw = await voegFotosToe(bestanden, { gevel: gevelVoorFoto, raam: "" });
    if (nieuw.length) { tekenGevelfotos(); toast(nieuw.length + (nieuw.length === 1 ? " foto" : " foto's") + " toegevoegd bij " + gevelVoorFoto + ".", "goed"); }
  });
  $("r-foto-bestand").addEventListener("change", async function (e) {
    const bestanden = Array.from(e.target.files); e.target.value = "";
    $("r-foto-bezig").textContent = "Bezig met opslaan…";
    const nieuw = await voegFotosToe(bestanden, { raam: raamId, gevel: raamKeuzes.gevel || "" });
    $("r-foto-bezig").textContent = "";
    if (huidigRaam < 0) nieuweRaamFotos = nieuweRaamFotos.concat(nieuw);
    tekenRaamFotos();
  });

  // Foto bekijken of verwijderen (zowel bij gevels als bij ramen)
  document.addEventListener("click", async function (e) {
    const open = e.target.closest("[data-foto]");
    if (open) {
      const b = projectBestanden.find(function (x) { return x.id === open.dataset.foto; });
      if (!b) return;
      const u = URL.createObjectURL(b.data); urls.push(u);
      $("kijker-img").src = u;
      $("kijker-naam").textContent = b.raam ? "Raam" + (function () { const r = project.ramen.find(function (x) { return x.id === b.raam; }); return r ? " " + r.nummer : ""; })() : (b.gevel || "");
      $("kijker").showModal();
      return;
    }
    const weg = e.target.closest("[data-foto-weg]");
    if (weg && confirm("Foto verwijderen?")) {
      await Opslag.verwijder("bestanden", weg.dataset.fotoWeg);
      projectBestanden = projectBestanden.filter(function (x) { return x.id !== weg.dataset.fotoWeg; });
      nieuweRaamFotos = nieuweRaamFotos.filter(function (x) { return x.id !== weg.dataset.fotoWeg; });
      tekenGevelfotos();
      if ($("raam").open) tekenRaamFotos();
      tekenRamen();
    }
  });
  $("kijker").addEventListener("click", function () { $("kijker").close(); });

  // Raamvenster dicht zonder opslaan: foto's van een nieuw raam opruimen
  $("raam").addEventListener("close", async function () {
    if (!raamOpgeslagen && nieuweRaamFotos.length) {
      for (const b of nieuweRaamFotos) await Opslag.verwijder("bestanden", b.id);
      const ids = nieuweRaamFotos.map(function (b) { return b.id; });
      projectBestanden = projectBestanden.filter(function (b) { return ids.indexOf(b.id) === -1; });
    }
    nieuweRaamFotos = [];
    tekenRamen();
  });

  // ---------- Schets ----------
  function raamUitFormulier() {
    return { nummer: $("r-nummer").value, ruimte: $("r-ruimte").value, breedte: $("r-breedte").value,
             hoogte: $("r-hoogte").value, vorm: raamKeuzes.vorm || "Rechthoekig" };
  }
  function tekenSchetsMini() {
    if (!raamSchets) return;
    $("r-schets-mini").innerHTML = Schets.svg(Object.assign({}, raamSchets, { vorm: raamKeuzes.vorm }), raamUitFormulier(), { titel: false });
  }

  let schetsWerk = null, hulp = "kijk", bezig = null;
  function tekenSchets(tijdelijk) {
    const s = JSON.parse(JSON.stringify(schetsWerk));
    if (tijdelijk) s.elementen.push(tijdelijk);
    $("s-doek").innerHTML = Schets.svg(s, raamUitFormulier());
    zetVormknoppen();
  }
  function zetVormknoppen() {
    $("s-vorm").querySelectorAll("button").forEach(function (k) { k.classList.toggle("actief", k.dataset.waarde === schetsWerk.vorm); });
  }
  $("s-vorm").innerHTML = RAAMVORMEN.map(function (v) { return '<button type="button" data-waarde="' + esc(v) + '">' + esc(v) + '</button>'; }).join("");
  $("s-vorm").addEventListener("click", function (e) {
    const k = e.target.closest("button"); if (!k || !magBewerken) return;
    schetsWerk.vorm = k.dataset.waarde; raamKeuzes.vorm = k.dataset.waarde; zetKeuzeknoppen(); tekenSchets();
  });
  ["s-kolommen", "s-rijen"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      schetsWerk.kolommen = Math.min(12, Math.max(1, Number($("s-kolommen").value) || 1));
      schetsWerk.rijen = Math.min(12, Math.max(1, Number($("s-rijen").value) || 1));
      tekenSchets();
    });
  });
  $("s-gereedschap").addEventListener("click", function (e) {
    const k = e.target.closest("[data-hulp]"); if (!k) return;
    hulp = k.dataset.hulp;
    $("s-gereedschap").querySelectorAll("button").forEach(function (x) { x.classList.toggle("actief", x === k); });
    $("s-uitleg").textContent = {
      kijk: "De vorm en de maten komen uit het raamformulier. Kies een hulpmiddel om iets toe te voegen.",
      maat: "Trek met je vinger een lijn van punt naar punt. Daarna vul je de maat in.",
      tekst: "Tik op de plek waar de tekst moet komen.",
      pen: "Teken met je vinger. Bijvoorbeeld een roede, een hor of een beschadiging."
    }[hulp];
    $("s-doek").classList.toggle("tekenen", hulp !== "kijk");
  });

  function puntInSchets(e) {
    const svg = $("s-doek").querySelector("svg");
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return [Math.round(q.x), Math.round(q.y)];
  }
  $("s-doek").addEventListener("pointerdown", function (e) {
    if (hulp === "kijk" || !magBewerken) return;
    e.preventDefault();
    $("s-doek").setPointerCapture(e.pointerId);
    const p = puntInSchets(e);
    if (hulp === "maat") bezig = { soort: "maat", x1: p[0], y1: p[1], x2: p[0], y2: p[1], tekst: "" };
    if (hulp === "pen") bezig = { soort: "pen", punten: [p] };
    if (hulp === "tekst") bezig = { soort: "tekst", x: p[0], y: p[1] };
  });
  $("s-doek").addEventListener("pointermove", function (e) {
    if (!bezig) return;
    const p = puntInSchets(e);
    if (bezig.soort === "maat") { bezig.x2 = p[0]; bezig.y2 = p[1]; tekenSchets(bezig); }
    if (bezig.soort === "pen") { bezig.punten.push(p); tekenSchets(bezig); }
  });
  $("s-doek").addEventListener("pointerup", function () {
    if (!bezig) return;
    const el = bezig; bezig = null;
    if (el.soort === "maat") {
      if (Math.hypot(el.x2 - el.x1, el.y2 - el.y1) < 20) { tekenSchets(); return; }
      const t = prompt("Maat of tekst bij deze lijn (bijv. 450 mm):", "");
      if (t === null) { tekenSchets(); return; }
      el.tekst = t.trim();
      schetsWerk.elementen.push(el);
    } else if (el.soort === "tekst") {
      const t = prompt("Tekst:", "");
      if (t && t.trim()) { el.tekst = t.trim(); schetsWerk.elementen.push(el); }
    } else if (el.soort === "pen" && el.punten.length > 1) {
      schetsWerk.elementen.push(el);
    }
    tekenSchets();
  });
  $("s-terug").addEventListener("click", function () { schetsWerk.elementen.pop(); tekenSchets(); });
  $("s-wis").addEventListener("click", function () {
    if (schetsWerk.elementen.length && confirm("Alle eigen maatlijnen, teksten en tekeningen wissen? De vorm en hoofdmaten blijven staan.")) {
      schetsWerk.elementen = []; tekenSchets();
    }
  });

  function openSchets() {
    schetsWerk = Object.assign({ kolommen: 1, rijen: 1, elementen: [] }, JSON.parse(JSON.stringify(raamSchets)));
    schetsWerk.vorm = raamKeuzes.vorm || "Rechthoekig";
    $("s-titel").textContent = "Schets raam " + ($("r-nummer").value || "") + ($("r-ruimte").value ? " – " + $("r-ruimte").value : "");
    $("s-kolommen").value = schetsWerk.kolommen || 1;
    $("s-rijen").value = schetsWerk.rijen || 1;
    hulp = "kijk";
    $("s-gereedschap").querySelectorAll("button").forEach(function (x) { x.classList.toggle("actief", x.dataset.hulp === "kijk"); });
    $("s-doek").classList.remove("tekenen");
    document.querySelectorAll("#schets-venster input").forEach(function (el) { el.disabled = !magBewerken; });
    ["s-terug", "s-wis"].forEach(function (id) { $(id).hidden = !magBewerken; });
    $("s-gereedschap").hidden = !magBewerken;
    tekenSchets();
    $("schets-venster").showModal();
  }
  $("r-schets-knop").addEventListener("click", openSchets);
  $("r-schets-mini").addEventListener("click", openSchets);
  $("s-opslaan").addEventListener("click", function () {
    raamSchets = { kolommen: schetsWerk.kolommen, rijen: schetsWerk.rijen, elementen: schetsWerk.elementen };
    $("schets-venster").close();
    tekenSchetsMini();
  });
  document.querySelectorAll("[data-schets-sluit]").forEach(function (k) { k.addEventListener("click", function () { $("schets-venster").close(); }); });

  // ---------- Materieel ----------
  function tekenRoosters() {
    const groepen = {};
    (project.ramen || []).forEach(function (r) {
      const soort = roosterSoort(r);
      if (!soort || soort === "Geen") return;
      const sleutel = soort + "|" + (r.rooster_kleur || "") + "|" + (r.rooster_plaatsing || "");
      const g = groepen[sleutel] = groepen[sleutel] || { soort: soort, kleur: r.rooster_kleur, plaatsing: r.rooster_plaatsing, stuks: 0, mm: 0, ramen: [] };
      const n = Number(r.rooster_aantal) || 1;
      g.stuks += n; g.mm += (Number(r.rooster_lengte) || 0) * n; g.ramen.push(r.nummer);
    });
    const lijst = Object.keys(groepen).map(function (k) { return groepen[k]; });
    $("roosters-overzicht").innerHTML = lijst.length
      ? '<table class="tabel"><thead><tr><th>Soort</th><th>Kleur</th><th>Plaatsing</th><th>Stuks</th><th>Totale lengte</th><th>Ramen</th></tr></thead><tbody>' +
        lijst.map(function (g) {
          return '<tr><td><strong>' + esc(g.soort) + '</strong></td><td>' + esc(g.kleur || "–") + '</td><td>' + esc(g.plaatsing || "–") + '</td><td>' + g.stuks +
            '</td><td>' + (g.mm ? (g.mm / 1000).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m" : "–") +
            '</td><td>' + esc(g.ramen.join(", ")) + '</td></tr>';
        }).join("") + '</tbody></table>'
      : '<p class="zacht">Geen ventilatieroosters bij de ramen van dit project.</p>';
  }

  function tekenMaterieel() {
    tekenRoosters();
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

  // ---------- Weergave: Snel of Uitgebreid (onthouden op dit apparaat) ----------
  function zetModus(modus) {
    try { localStorage.setItem("gm-opname-modus", modus); } catch (e) {}
    document.body.classList.toggle("basis-modus", modus !== "uitgebreid");
    document.querySelectorAll("[data-modus]").forEach(function (k) { k.classList.toggle("actief", k.dataset.modus === modus); });
  }
  let bewaardeModus = "basis";
  try { bewaardeModus = localStorage.getItem("gm-opname-modus") || "basis"; } catch (e) {}
  zetModus(bewaardeModus);
  document.querySelectorAll("[data-modus]").forEach(function (k) { k.addEventListener("click", function () { zetModus(k.dataset.modus); }); });

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
    await laadOpnameInstellingen();
    await laadNijBegun();
    medewerkers = await Opslag.alle("medewerkers");
    opnames = await Opslag.alle("opnames");
    $("opnemer-filter").innerHTML += medewerkers.filter(function (m) { return groepVanFunctie(m.functie) === "opname"; })
      .map(function (m) { return '<option value="' + m.id + '">' + esc(m.voornaam + " " + m.achternaam) + '</option>'; }).join("");
    toonLijst();
    const id = new URLSearchParams(location.search).get("id");
    if (id) { const o = opnames.find(function (x) { return x.id === id; }); if (o) openProject(o); }
  })();
})();

/* =========================================================
   Glasmeesters Planner – kaart (fase 6, gratis variant)
   - Kaart: OpenStreetMap via de bibliotheek Leaflet (lib/leaflet)
   - Adressen → plek: OpenStreetMap Nominatim, bewaard op dit apparaat
   - Route en Street View: links naar Google Maps (geen account nodig)
   Een medewerker ziet alleen de opdrachten waarop hij is ingepland.
   ========================================================= */

(async function () {
  if (document.body.classList.contains("geen-toegang")) return;

  const rol = huidigeRol();
  const KLEUR = { grijs: "#8A9099", oranje: "#E08A1E", blauw: "#2A6BAE", goud: "#C99A2E", groen: "#2E8B57", rood: "#C0392B" };
  const OPNAME_KLEUR = "#7B4FA0";
  const GRONINGEN = [53.2194, 6.5665];

  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function plusDagen(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function maandag(d) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function dagTekst(datum) {
    if (!datum) return "Nog niet gepland";
    return new Date(datum + "T12:00").toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  }
  function melding(soort, html) { const el = $("melding"); el.className = "melding" + (html ? " zichtbaar " + soort : ""); el.innerHTML = html || ""; }

  await Voorbeeld.zorgVoorAlles();
  await Voorbeeld.zorgVoorOpname();

  let klussen = await Opslag.alle("klussen");
  const opnames = await Opslag.alle("opnames");
  const medewerkers = await Opslag.alle("medewerkers");

  // Wie ben ik (rol Medewerker, testmodus)
  let ikBen = null;
  if (rol === "medewerker") {
    try { ikBen = localStorage.getItem("gm-ik-ben"); } catch (e) {}
    if (!medewerkers.some(function (m) { return m.id === ikBen; })) {
      const jan = medewerkers.find(function (m) { return m.voornaam === "Jan" && m.achternaam === "Bakker"; });
      ikBen = jan ? jan.id : null;
    }
    klussen = klussen.filter(function (k) { return (k.medewerkers || []).indexOf(ikBen) !== -1; });
    $("titel").textContent = "Mijn kaart";
    $("toon-opnames-label").hidden = true;
    $("toon-klussen-label").hidden = true;
  }
  const magOpnames = ["beheerder", "planner", "opnemer", "administratie"].indexOf(rol) !== -1;
  if (!magOpnames) { $("toon-opnames").checked = false; $("toon-opnames-label").hidden = true; }

  try { const p = localStorage.getItem("gm-kaart-periode"); if (p) $("periode").value = p; } catch (e) {}

  // ---------- Kaart ----------
  const kaart = L.map("kaart", { zoomControl: true, tap: true }).setView(GRONINGEN, 10);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(kaart);
  const laag = L.layerGroup().addTo(kaart);
  const punten = {};          // id → marker
  let plaatsVoor = null;      // adres dat handmatig op de kaart wordt gezet

  function naamLijst(ids) {
    return (ids || []).map(function (id) { const m = medewerkers.find(function (x) { return x.id === id; }); return m ? m.voornaam : ""; }).filter(Boolean).join(", ");
  }

  // Welke items horen bij de gekozen periode
  function items() {
    const p = $("periode").value;
    const nu = new Date(), vandaag = iso(nu);
    const binnen = function (datum) {
      if (p === "vandaag") return datum === vandaag;
      if (p === "morgen") return datum === iso(plusDagen(nu, 1));
      if (p === "week") { const ma = maandag(nu); return datum && datum >= iso(ma) && datum <= iso(plusDagen(ma, 6)); }
      if (p === "volgende") { const ma = plusDagen(maandag(nu), 7); return datum && datum >= iso(ma) && datum <= iso(plusDagen(ma, 6)); }
      return true;
    };
    const lijst = [];
    if ($("toon-klussen").checked || rol === "medewerker") {
      klussen.filter(function (k) {
        if (!k.adres || k.status === "geannuleerd") return false;
        if (p === "open") return k.status !== "klaar" && (!k.datum || k.datum >= vandaag);
        return binnen(k.datum);
      }).forEach(function (k) {
        const s = STATUSSEN.find(function (x) { return x.code === (k.status || "gepland"); }) || {};
        lijst.push({ soort: "klus", id: k.id, adres: k.adres, titel: k.klant, nummer: k.nummer, datum: k.datum || "", tijd: k.datum ? k.start + "–" + k.eind : "",
                     sub: (k.werkzaamheden || "").split("\n")[0], wie: naamLijst(k.medewerkers), kleur: KLEUR[s.kleur] || KLEUR.blauw, status: s.naam || "",
                     link: "werkopdrachten.html?id=" + encodeURIComponent(k.id) });
      });
    }
    if (magOpnames && $("toon-opnames").checked) {
      opnames.filter(function (o) {
        if (!o.adres) return false;
        if (p === "open") return ["nieuw", "uitwerken", "offerte", "akkoord"].indexOf(o.status || "nieuw") !== -1;
        return binnen(o.datum);
      }).forEach(function (o) {
        const m = medewerkers.find(function (x) { return x.id === o.opnemer; });
        lijst.push({ soort: "opname", id: o.id, adres: o.adres, titel: o.klant, nummer: o.nummer, datum: o.datum || "", tijd: "",
                     sub: (o.ramen || []).length + " ramen · " + opnameStatusNaam(o.status), wie: m ? m.voornaam : "", kleur: OPNAME_KLEUR, status: "Opname",
                     link: "opnames.html?id=" + encodeURIComponent(o.id) });
      });
    }
    return lijst.sort(function (a, b) { return (a.datum || "9999").localeCompare(b.datum || "9999") || (a.tijd || "").localeCompare(b.tijd || ""); });
  }

  function pin(item) {
    return L.divIcon({
      className: "kaart-pin-houder",
      html: '<span class="kaart-pin ' + (item.soort === "opname" ? "pin-opname" : "") + '" style="background:' + item.kleur + '">' + (item.soort === "opname" ? "📐" : "") + '</span>',
      iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -12]
    });
  }

  function knoppen(item, plek) {
    return '<div class="kaart-knoppen">' +
      '<a class="knop klein" href="' + routeLink(item.adres) + '" target="_blank" rel="noopener">🧭 Route</a>' +
      '<a class="knop tweede klein" href="' + streetViewLink(item.adres, plek) + '" target="_blank" rel="noopener">👁 Street View</a>' +
      '<a class="knop tweede klein" href="' + item.link + '">' + (item.soort === "opname" ? "📐 Opname" : "📋 Opdracht") + '</a>' +
    '</div>';
  }

  function popup(item, plek) {
    return '<div class="kaart-popup"><strong>' + esc(item.titel) + '</strong>' +
      '<div class="zacht">' + esc([item.nummer, item.datum ? dagTekst(item.datum) : "", item.tijd].filter(Boolean).join(" · ")) + '</div>' +
      '<div>' + esc(item.adres) + '</div>' +
      (item.sub ? '<div class="zacht">' + esc(item.sub) + '</div>' : "") +
      (item.wie ? '<div>👷 ' + esc(item.wie) + '</div>' : "") +
      (plek && plek.benadering ? '<div class="kaart-let-op">Straat niet gevonden: de stip staat in het midden van de plaats.</div>' : "") +
      knoppen(item, plek) + '</div>';
  }

  // ---------- Tekenen ----------
  let bezig = 0;
  async function teken() {
    const ronde = ++bezig;
    const lijst = items();
    laag.clearLayers();
    Object.keys(punten).forEach(function (k) { delete punten[k]; });

    const p = $("periode").value;
    const periodeNaam = $("periode").selectedOptions[0].textContent.toLowerCase();
    $("samenvatting").textContent = lijst.length ? lijst.length + " adres" + (lijst.length === 1 ? "" : "sen") + " – " + periodeNaam : "Niets gepland – " + periodeNaam;

    // Route van de dag (alleen bij één dag)
    const dagAdressen = lijst.filter(function (i) { return i.soort === "klus"; }).map(function (i) { return i.adres; });
    $("dagroute").hidden = !((p === "vandaag" || p === "morgen") && dagAdressen.length);
    $("dagroute").href = routeLangs(dagAdressen);

    // Lijst (eerst, zodat er direct iets te zien is)
    let groep = null;
    $("lijst").innerHTML = lijst.length ? lijst.map(function (i) {
      const kop = i.datum !== groep ? '<h3 class="kaart-dag">' + esc(dagTekst(i.datum)) + '</h3>' : "";
      groep = i.datum;
      return kop + '<div class="kaart-item" data-id="' + i.id + '">' +
        '<span class="kaart-stip" style="background:' + i.kleur + '"></span>' +
        '<div class="kaart-item-tekst">' +
          '<div class="kaart-item-kop"><strong>' + esc(i.titel) + '</strong><span class="zacht">' + esc(i.tijd || i.status) + '</span></div>' +
          '<div>' + esc(i.adres) + '</div>' +
          (i.wie ? '<div class="zacht">👷 ' + esc(i.wie) + '</div>' : "") +
          '<div class="kaart-plek-status zacht" data-plek="' + esc(adresSleutel(i.adres)) + '">Plek opzoeken…</div>' +
          knoppen(i, null) +
        '</div></div>';
    }).join("") : '<p class="zacht kaart-leeg">Geen opdrachten of opnames met een adres in deze periode.</p>';

    // Plekken opzoeken (eerst wat al bekend is, daarna de rest één voor één)
    const grenzen = [];
    const nietGevonden = [];
    let fouten = 0;
    for (const i of lijst) {
      if (ronde !== bezig) return;
      let plek = await zoekLocatie(i.adres, { alleenBekend: true });
      if (!plek) {
        melding("info", "Adressen opzoeken op de kaart… (" + (lijst.indexOf(i) + 1) + " van " + lijst.length + ")");
        plek = await zoekLocatie(i.adres);
      }
      if (ronde !== bezig) return;
      const vak = $("lijst").querySelector('[data-id="' + i.id + '"]');
      const status = vak && vak.querySelector(".kaart-plek-status");
      if (plek && plek.lat) {
        const m = L.marker([plek.lat, plek.lon], { icon: pin(i), title: i.titel }).bindPopup(popup(i, plek), { maxWidth: 280 });
        m.addTo(laag);
        punten[i.id] = m;
        grenzen.push([plek.lat, plek.lon]);
        if (status) status.innerHTML = plek.benadering ? '📍 Ongeveer (straat niet gevonden) · <button type="button" class="link-knop" data-plaats="' + esc(i.adres) + '">zelf plaatsen</button>'
                                                       : '📍 Op de kaart' + (plek.handmatig ? " (zelf geplaatst)" : "") + ' · <button type="button" class="link-knop" data-plaats="' + esc(i.adres) + '">verplaatsen</button>';
        if (vak) vak.querySelector(".kaart-knoppen").outerHTML = knoppen(i, plek);
      } else {
        if (plek && plek.fout) fouten++; else nietGevonden.push(i);
        if (status) status.innerHTML = (plek && plek.fout ? "Niet opgezocht: geen verbinding." : "Adres niet gevonden.") +
          ' <button type="button" class="link-knop" data-plaats="' + esc(i.adres) + '">📍 Zelf op de kaart zetten</button>';
      }
    }
    if (grenzen.length === 1) kaart.setView(grenzen[0], 14);
    else if (grenzen.length > 1) kaart.fitBounds(grenzen, { padding: [30, 30], maxZoom: 15 });
    melding(fouten ? "waarschuwing" : nietGevonden.length ? "info" : "",
      fouten ? "Een paar adressen konden niet worden opgezocht (geen verbinding met OpenStreetMap). Probeer het later opnieuw." :
      nietGevonden.length ? nietGevonden.length + " adres" + (nietGevonden.length === 1 ? " is" : "sen zijn") + " niet gevonden. Tik bij dat adres op <strong>📍 Zelf op de kaart zetten</strong>." : "");
  }

  // Tik in de lijst: kaart naar dat punt
  $("lijst").addEventListener("click", function (e) {
    const plaats = e.target.closest("[data-plaats]");
    if (plaats) { begintPlaatsen(plaats.dataset.plaats); return; }
    if (e.target.closest("a, button")) return;
    const vak = e.target.closest(".kaart-item");
    if (!vak || !punten[vak.dataset.id]) return;
    const m = punten[vak.dataset.id];
    kaart.setView(m.getLatLng(), Math.max(kaart.getZoom(), 15));
    m.openPopup();
    if (window.innerWidth < 900) $("kaart").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- Zelf een plek kiezen ----------
  function begintPlaatsen(adres) {
    plaatsVoor = adres;
    $("plaatsen-tekst").innerHTML = "Tik op de kaart waar <strong>" + esc(adres) + "</strong> ligt.";
    $("plaatsen-balk").hidden = false;
    $("kaart").classList.add("kies-plek");
    $("kaart").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function stopPlaatsen() { plaatsVoor = null; $("plaatsen-balk").hidden = true; $("kaart").classList.remove("kies-plek"); }
  $("plaatsen-stop").addEventListener("click", stopPlaatsen);
  kaart.on("click", async function (e) {
    if (!plaatsVoor) return;
    const adres = plaatsVoor;
    stopPlaatsen();
    await zetLocatieHandmatig(adres, Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6);
    await teken();
    melding("goed", "De plek van " + esc(adres) + " is bewaard.");
  });

  ["periode", "toon-klussen", "toon-opnames"].forEach(function (id) {
    $(id).addEventListener("change", function () {
      if (id === "periode") { try { localStorage.setItem("gm-kaart-periode", $("periode").value); } catch (e) {} }
      teken();
    });
  });

  // De kaart moet zijn maat opnieuw bepalen als het scherm draait
  window.addEventListener("resize", function () { kaart.invalidateSize(); });
  teken();
})();

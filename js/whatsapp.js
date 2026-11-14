/* =========================================================
   Glasmeesters Planner – WhatsApp
   Stap 1 (nu): het programma stelt het bericht samen en opent
   WhatsApp met het bericht al ingevuld. De planner drukt zelf
   op Verzenden. Gratis en zonder extra account.
   Stap 2 (later): automatisch versturen met bezorgstatus via
   het officiële WhatsApp Business Platform.

   Het sjabloon is aan te passen in Beheer. Invulvelden:
   {NAAM} voornaam in hoofdletters   {Naam} voornaam
   {DAG} vandaag / morgen / op maandag 16 november   {DAGKORT} vandaag / morgen / maandag
   {DATUM} {STARTTIJD} {EINDTIJD} {KLANT} {ADRES} {ROUTE}
   {WERKZAAMHEDEN} {MEENEMEN} {VOERTUIG} {SAMEN} {BIJZONDERHEDEN}
   Een regel waarvan het invulveld leeg is, valt vanzelf weg.
   ========================================================= */

const WhatsApp = (function () {

  const STANDAARD_SJABLOON = [
    "GOEDEMORGEN {NAAM},",
    "",
    "Je bent {DAG} ingepland voor de volgende werkzaamheden:",
    "",
    "Datum: {DATUM}",
    "Starttijd: {STARTTIJD} uur",
    "",
    "Klant: {KLANT}",
    "Adres: {ADRES}",
    "{ROUTE}",
    "",
    "{WERKZAAMHEDEN}",
    "",
    "{MEENEMEN}",
    "",
    "{VOERTUIG}",
    "",
    "{SAMEN}",
    "",
    "{BIJZONDERHEDEN}",
    "",
    "Succes {DAGKORT}!"
  ].join("\n");

  async function sjabloon() {
    const s = await Opslag.haal("instellingen", "whatsapp");
    return s && s.sjabloon ? s.sjabloon : STANDAARD_SJABLOON;
  }

  // "06-12345678" → "31612345678" (internationaal, zonder + of spaties)
  function nummer(telefoon) {
    let n = String(telefoon || "").replace(/[^\d+]/g, "");
    if (n.indexOf("+") === 0) n = n.slice(1);
    else if (n.indexOf("00") === 0) n = n.slice(2);
    else if (n.indexOf("0") === 0) n = "31" + n.slice(1);
    return n;
  }

  function isGeldig(telefoon) { return /^\d{10,15}$/.test(nummer(telefoon)); }

  // Verzonnen nummers van de voorbeeldmedewerkers (06-00000…)
  function isVoorbeeldnummer(telefoon) { return /^3160000\d{4}$/.test(nummer(telefoon)); }

  function lijst(titel, regels) {
    const r = regels.filter(function (x) { return x && String(x).trim(); });
    return r.length ? titel + "\n" + r.map(function (x) { return "• " + String(x).trim(); }).join("\n") : "";
  }

  function samenVoegen(namen) {
    if (namen.length <= 1) return namen.join("");
    return namen.slice(0, -1).join(", ") + " en " + namen[namen.length - 1];
  }

  // Stelt het bericht samen voor één medewerker
  function bericht(tekst, opdracht, ontvanger, g, vandaag) {
    const nu = vandaag ? new Date(vandaag) : new Date();
    nu.setHours(0, 0, 0, 0);
    const d = new Date(opdracht.datum + "T00:00:00");
    const verschil = Math.round((d - nu) / 864e5);
    const dag = verschil === 0 ? "vandaag" : verschil === 1 ? "morgen" :
      "op " + d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });

    const zoek = function (lijst, id) { return (lijst || []).find(function (x) { return x.id === id; }); };
    const v = zoek(g.voertuigen, opdracht.voertuig);
    const a = zoek(g.voertuigen, opdracht.aanhanger);

    const werk = (opdracht.werkzaamheden || "").split("\n").filter(function (x) { return x.trim(); });
    const werkRegels = werk.length ? werk : (opdracht.soort_werk || []);

    const meenemen = (opdracht.gereedschap || []).map(function (id) { const x = zoek(g.gereedschap, id); return x ? x.naam : null; })
      .concat((opdracht.materialen || []).map(function (m) {
        return [m.aantal, m.eenheid, m.omschrijving].filter(function (x) { return x !== undefined && x !== null && String(x).trim(); }).join(" ");
      }));

    const collega = (opdracht.medewerkers || []).filter(function (id) { return id !== ontvanger.id; })
      .map(function (id) { const m = zoek(g.medewerkers, id); return m ? m.voornaam : null; }).filter(Boolean);

    let voertuig = "";
    if (v) {
      voertuig = "Voertuig: " + v.merk + " " + v.type + " (" + v.naam + ")\nKenteken: " + v.kenteken;
      if (a) voertuig += "\nAanhanger: " + a.naam + " (" + a.kenteken + ")";
    } else if (a) {
      voertuig = "Aanhanger: " + a.naam + " (" + a.kenteken + ")";
    }

    const velden = {
      "{NAAM}": ontvanger.voornaam.toUpperCase(),
      "{Naam}": ontvanger.voornaam,
      "{DAG}": dag,
      "{DAGKORT}": verschil === 0 ? "vandaag" : verschil === 1 ? "morgen" : d.toLocaleDateString("nl-NL", { weekday: "long" }),
      "{DATUM}": d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }),
      "{STARTTIJD}": opdracht.start || "",
      "{EINDTIJD}": opdracht.eind || "",
      "{KLANT}": opdracht.klant || "",
      "{ADRES}": opdracht.adres || "",
      "{ROUTE}": opdracht.adres ? "Route: https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(opdracht.adres) : "",
      "{WERKZAAMHEDEN}": lijst("Werkzaamheden:", werkRegels),
      "{MEENEMEN}": lijst("Mee te nemen:", meenemen),
      "{VOERTUIG}": voertuig,
      "{SAMEN}": collega.length ? "Samen met: " + samenVoegen(collega) + "." : "",
      "{BIJZONDERHEDEN}": opdracht.bijzonderheden ? "Bijzonderheden:\n" + opdracht.bijzonderheden : ""
    };

    // Regels met alleen een leeg invulveld laten wegvallen
    // (bijv. "{ROUTE}" zonder adres, of "Adres: {ADRES}" zonder adres)
    const regels = tekst.split("\n").filter(function (regel) {
      const stukjes = regel.match(/\{[A-Za-z]+\}/g);
      if (!stukjes) return true;
      const allesLeeg = stukjes.every(function (s) { return velden[s] === ""; });
      const rest = regel.replace(/\{[A-Za-z]+\}/g, "").trim();
      return !(allesLeeg && (rest === "" || /:$/.test(rest)));
    });
    let uit = regels.join("\n");
    Object.keys(velden).forEach(function (k) { uit = uit.split(k).join(velden[k]); });
    return uit.replace(/\n{3,}/g, "\n\n").trim();
  }

  function link(telefoon, tekst) {
    return "https://wa.me/" + nummer(telefoon) + "?text=" + encodeURIComponent(tekst);
  }

  return {
    STANDAARD_SJABLOON: STANDAARD_SJABLOON,
    sjabloon: sjabloon,
    bericht: bericht,
    link: link,
    nummer: nummer,
    isGeldig: isGeldig,
    isVoorbeeldnummer: isVoorbeeldnummer
  };
})();

/* =========================================================
   Glasmeesters Planner – opslag
   ALLE pagina's bewaren en lezen gegevens via dit ene bestand.

   Nu (fase 2 t/m 6): lokaal in de browser van dit apparaat
   (IndexedDB). Later vervangen we alleen de binnenkant van dit
   bestand door Supabase; de pagina's merken daar niets van.

   Gebruik op een pagina, bijvoorbeeld:
     const lijst = await Opslag.alle("medewerkers");
     await Opslag.bewaar("medewerkers", { naam: "Jan" });
     await Opslag.verwijder("medewerkers", id);
   ========================================================= */

const Opslag = (function () {
  const DATABASE = "glasmeesters-planner";
  const VERSIE_DB = 2;
  const TABEL = "gegevens2";
  // Interne veldnamen beginnen met _ zodat ze nooit botsen met eigen velden
  // (een afwezigheid heeft bijvoorbeeld zelf een veld "soort").

  let dbBelofte = null;

  // Opent (of maakt) de lokale database
  function open() {
    if (dbBelofte) return dbBelofte;
    dbBelofte = new Promise(function (klaar, fout) {
      const verzoek = indexedDB.open(DATABASE, VERSIE_DB);
      verzoek.onupgradeneeded = function () {
        const db = verzoek.result;
        const tx = verzoek.transaction;
        if (!db.objectStoreNames.contains(TABEL)) {
          const tabel = db.createObjectStore(TABEL, { keyPath: "_sleutel" });
          tabel.createIndex("_soort", "_soort", { unique: false });
        }
        // Overzetten uit versie 1 (oude tabel "gegevens")
        if (db.objectStoreNames.contains("gegevens")) {
          const oud = tx.objectStore("gegevens");
          const nieuw = tx.objectStore(TABEL);
          oud.openCursor().onsuccess = function (e) {
            const cursor = e.target.result;
            if (cursor) {
              const r = Object.assign({}, cursor.value);
              const categorie = r.soort;
              delete r.sleutel;
              delete r.soort;
              nieuw.put(Object.assign(r, { _sleutel: categorie + ":" + r.id, _soort: categorie }));
              cursor.continue();
            } else {
              db.deleteObjectStore("gegevens");
            }
          };
        }
      };
      verzoek.onsuccess = function () { klaar(verzoek.result); };
      verzoek.onerror = function () { fout(verzoek.error); };
    });
    // Vraag de browser om de gegevens niet zomaar op te ruimen
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(function () {});
    }
    return dbBelofte;
  }

  // Hulpfunctie: voert één handeling uit op de database
  async function handeling(modus, werk) {
    const db = await open();
    return new Promise(function (klaar, fout) {
      const tx = db.transaction(TABEL, modus);
      const tabel = tx.objectStore(TABEL);
      let resultaat;
      Promise.resolve(werk(tabel, function (r) { resultaat = r; })).catch(fout);
      tx.oncomplete = function () { klaar(resultaat); };
      tx.onerror = function () { fout(tx.error); };
      tx.onabort = function () { fout(tx.error); };
    });
  }

  function verzoekNaarBelofte(verzoek) {
    return new Promise(function (klaar, fout) {
      verzoek.onsuccess = function () { klaar(verzoek.result); };
      verzoek.onerror = function () { fout(verzoek.error); };
    });
  }

  function blobNaarTekst(blob) {
    return new Promise(function (klaar, fout) {
      const lezer = new FileReader();
      lezer.onload = function () { klaar(lezer.result); };
      lezer.onerror = function () { fout(lezer.error); };
      lezer.readAsDataURL(blob);
    });
  }

  function nieuwId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function zonderSleutel(rij) {
    const kopie = Object.assign({}, rij);
    delete kopie._sleutel;
    delete kopie._soort;
    return kopie;
  }

  function metSleutel(soort, item) {
    return Object.assign({}, item, { _sleutel: soort + ":" + item.id, _soort: soort });
  }

  return {
    nieuwId: nieuwId,

    // Alle items van één soort, bijvoorbeeld "medewerkers"
    alle: function (soort) {
      return handeling("readonly", async function (tabel, zet) {
        const rijen = await verzoekNaarBelofte(tabel.index("_soort").getAll(soort));
        zet(rijen.map(zonderSleutel));
      });
    },

    // Eén item ophalen
    haal: function (soort, id) {
      return handeling("readonly", async function (tabel, zet) {
        const rij = await verzoekNaarBelofte(tabel.get(soort + ":" + id));
        zet(rij ? zonderSleutel(rij) : null);
      });
    },

    // Item bewaren (nieuw of bestaand). Geeft het bewaarde item terug.
    bewaar: function (soort, item) {
      const nu = new Date().toISOString();
      const opTeSlaan = Object.assign({}, item);
      if (!opTeSlaan.id) opTeSlaan.id = nieuwId();
      if (!opTeSlaan.aangemaakt_op) opTeSlaan.aangemaakt_op = nu;
      opTeSlaan.gewijzigd_op = nu;
      return handeling("readwrite", function (tabel, zet) {
        tabel.put(metSleutel(soort, opTeSlaan));
        zet(opTeSlaan);
      });
    },

    // Item verwijderen
    verwijder: function (soort, id) {
      return handeling("readwrite", function (tabel) {
        tabel.delete(soort + ":" + id);
      });
    },

    // Aantal items per soort, bijvoorbeeld { medewerkers: 30 }
    tellingen: function () {
      return handeling("readonly", async function (tabel, zet) {
        const rijen = await verzoekNaarBelofte(tabel.getAll());
        const telling = {};
        rijen.forEach(function (r) { telling[r._soort] = (telling[r._soort] || 0) + 1; });
        zet(telling);
      });
    },

    // Alles als één back-upobject (foto's en documenten worden als tekst meegenomen)
    exporteer: async function () {
      const rijen = await handeling("readonly", async function (tabel, zet) {
        zet(await verzoekNaarBelofte(tabel.getAll()));
      });
      const gegevens = {};
      for (const r of rijen) {
        const item = zonderSleutel(r);
        for (const veld of Object.keys(item)) {
          if (item[veld] instanceof Blob) item[veld] = { __bestand: await blobNaarTekst(item[veld]) };
        }
        (gegevens[r._soort] = gegevens[r._soort] || []).push(item);
      }
      return {
        programma: "Glasmeesters Planner",
        formaat: 1,
        gemaakt_op: new Date().toISOString(),
        gegevens: gegevens
      };
    },

    // Back-up terugzetten: vervangt ALLE huidige gegevens
    importeer: async function (backup) {
      if (!backup || backup.programma !== "Glasmeesters Planner" || !backup.gegevens) {
        throw new Error("Dit is geen back-up van de Glasmeesters Planner.");
      }
      // Eerst bestanden terug omzetten (dat kan niet binnen de database-handeling)
      const rijen = [];
      for (const soort of Object.keys(backup.gegevens)) {
        for (const origineel of backup.gegevens[soort]) {
          const item = Object.assign({}, origineel);
          for (const veld of Object.keys(item)) {
            if (item[veld] && typeof item[veld] === "object" && item[veld].__bestand) {
              item[veld] = await (await fetch(item[veld].__bestand)).blob();
            }
          }
          rijen.push(metSleutel(soort, item));
        }
      }
      return handeling("readwrite", function (tabel) {
        tabel.clear();
        rijen.forEach(function (r) { tabel.put(r); });
      });
    },

    // Alles wissen
    wisAlles: function () {
      return handeling("readwrite", function (tabel) { tabel.clear(); });
    }
  };
})();

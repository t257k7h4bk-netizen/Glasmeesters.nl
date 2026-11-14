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
  const VERSIE_DB = 1;
  const TABEL = "gegevens";

  let dbBelofte = null;

  // Opent (of maakt) de lokale database
  function open() {
    if (dbBelofte) return dbBelofte;
    dbBelofte = new Promise(function (klaar, fout) {
      const verzoek = indexedDB.open(DATABASE, VERSIE_DB);
      verzoek.onupgradeneeded = function () {
        const db = verzoek.result;
        if (!db.objectStoreNames.contains(TABEL)) {
          const tabel = db.createObjectStore(TABEL, { keyPath: "sleutel" });
          tabel.createIndex("soort", "soort", { unique: false });
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

  function nieuwId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function zonderSleutel(rij) {
    const kopie = Object.assign({}, rij);
    delete kopie.sleutel;
    delete kopie.soort;
    return kopie;
  }

  return {
    // Alle items van één soort, bijvoorbeeld "medewerkers"
    alle: function (soort) {
      return handeling("readonly", async function (tabel, zet) {
        const rijen = await verzoekNaarBelofte(tabel.index("soort").getAll(soort));
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
        tabel.put(Object.assign({ sleutel: soort + ":" + opTeSlaan.id, soort: soort }, opTeSlaan));
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
        rijen.forEach(function (r) { telling[r.soort] = (telling[r.soort] || 0) + 1; });
        zet(telling);
      });
    },

    // Alles als één back-upobject
    exporteer: function () {
      return handeling("readonly", async function (tabel, zet) {
        const rijen = await verzoekNaarBelofte(tabel.getAll());
        const gegevens = {};
        rijen.forEach(function (r) {
          (gegevens[r.soort] = gegevens[r.soort] || []).push(zonderSleutel(r));
        });
        zet({
          programma: "Glasmeesters Planner",
          formaat: 1,
          gemaakt_op: new Date().toISOString(),
          gegevens: gegevens
        });
      });
    },

    // Back-up terugzetten: vervangt ALLE huidige gegevens
    importeer: function (backup) {
      if (!backup || backup.programma !== "Glasmeesters Planner" || !backup.gegevens) {
        return Promise.reject(new Error("Dit is geen back-up van de Glasmeesters Planner."));
      }
      return handeling("readwrite", function (tabel) {
        tabel.clear();
        Object.keys(backup.gegevens).forEach(function (soort) {
          backup.gegevens[soort].forEach(function (item) {
            tabel.put(Object.assign({ sleutel: soort + ":" + item.id, soort: soort }, item));
          });
        });
      });
    },

    // Alles wissen
    wisAlles: function () {
      return handeling("readwrite", function (tabel) { tabel.clear(); });
    }
  };
})();

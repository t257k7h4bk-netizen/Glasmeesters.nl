# Glasmeesters Planner

Bedrijfsplanningssysteem voor Glasmeesters Groningen: personeelsplanning, werkopdrachten,
glasopnames, voertuigen en gereedschap in één programma.

## Hoe het in elkaar zit

| Map / bestand | Wat het is |
| --- | --- |
| `index.html`, `js/dashboard.js` | Startscherm (dashboard) met tellers, actielijst en dagplanning |
| `planning.html`, `medewerkers.html`, … | Eén pagina per tabblad |
| `css/stijl.css` | Huisstijl en opmaak. Kleuren staan bovenaan op één plek |
| `js/layout.js` | Het menu dat op elke pagina verschijnt, plus welke rol wat mag zien |
| `js/opslag.js` | Alle opslag loopt via dit bestand (nu lokaal, later Supabase) |
| `js/keuzelijsten.js` | Vaste lijsten: functies, opleidingen en bevoegdheden |
| `js/voorbeeld.js` | De 30 verzonnen voorbeeldmedewerkers |
| `medewerkers.html` | Medewerkerslijst met zoeken, filteren en detailkaart |
| `planning.html`, `js/planning.js`, `css/planning.css` | Planning: rooster, klussen, afwezigheid, verslepen, controles op dubbele boekingen |
| `werkopdrachten.html`, `js/werkopdracht.js` | Werkopdrachtenlijst en het gedeelde werkopdrachtvenster (ook gebruikt in de planning) |
| `js/whatsapp.js` | WhatsApp-bericht samenstellen uit een werkopdracht (sjabloon aanpasbaar in Beheer) |
| `beheer.html` | Instellingen (dagdelen), back-up downloaden/terugzetten, alles wissen |
| `img/` | Pictogrammen voor het beginscherm van tablet en telefoon |
| `manifest.webmanifest` | Zorgt dat het programma als app op het beginscherm kan |

## Stand van zaken

- [x] Fase 1 – Ontwerp
- [x] Stap 2a – Basis: menu, huisstijl, startscherm
- [x] Stap 2b – Rollen nagespeeld, lokale opslag, back-upknoppen
- [x] Stap 2c – Medewerkers (30 fictieve medewerkers)
- [x] Stap 2d – Planning
- [x] Stap 2e – Dashboard met echte tellers
- [x] Stap 3a – Werkopdrachten: nummer, status, werkzaamheden, glassoort
- [x] Stap 3b – Voertuig, materialen en gereedschap
- [x] Stap 3c – Foto's en documenten
- [x] Stap 3d – WhatsApp (stap 1: vooraf ingevuld bericht)
- [x] Stap 4a – Opleidingen en bevoegdheden bewerken + opleidingenoverzicht
- [ ] Stap 4b – Automatische waarschuwingen en blokkades
- [ ] Stap 4c – Voertuigenbeheer
- [ ] Stap 4d – Gereedschapsbeheer
- [ ] Stap 4e – Meldingen op het dashboard

Tijdens het bouwen worden gegevens alleen lokaal in de browser opgeslagen en gebruiken we
uitsluitend fictieve gegevens.

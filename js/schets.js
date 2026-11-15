/* =========================================================
   Glasmeesters Planner – schets van een raam
   Een schets wordt bewaard als gegevens (geen plaatje):
     { vorm, kolommen, rijen, elementen: [...] }
   elementen: { soort: "maat", x1, y1, x2, y2, tekst }
              { soort: "tekst", x, y, tekst }
              { soort: "pen", punten: [[x,y], ...] }
   Daardoor blijft hij scherp en kan hij overal getekend worden
   (raamkaart, schetsvenster, PDF). Tekengebied: 1000 × 700.
   ========================================================= */

const Schets = (function () {
  const B = 1000, H = 700;
  const KLEUR = "#2A5577", MAATKLEUR = "#C0392B", TEKSTKLEUR = "#1F2933";

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Waar komt de vorm te staan (passend in het tekengebied, in de verhouding breedte : hoogte)
  function kader(raam, vorm) {
    let b = Number(raam.breedte) || 1000, h = Number(raam.hoogte) || 1000;
    if (vorm === "Vierkant" || vorm === "Rond") { const m = Math.max(b, h); b = m; h = m; }
    const maxB = 680, maxH = 480;
    const schaal = Math.min(maxB / b, maxH / h);
    const w = b * schaal, hh = h * schaal;
    const x = 120 + (maxB - w) / 2, y = 70 + (maxH - hh) / 2;
    return { x: x, y: y, w: w, h: hh };
  }

  // De omtrek van het raam als SVG-pad
  function omtrek(vorm, k) {
    const x = k.x, y = k.y, w = k.w, h = k.h;
    switch (vorm) {
      case "Rond": return '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" rx="' + w / 2 + '" ry="' + h / 2 + '"/>';
      case "Driehoekig": return '<path d="M' + x + ' ' + (y + h) + ' L' + (x + w / 2) + ' ' + y + ' L' + (x + w) + ' ' + (y + h) + ' Z"/>';
      case "Schuin": return '<path d="M' + x + ' ' + (y + h) + ' L' + x + ' ' + (y + h * 0.3) + ' L' + (x + w) + ' ' + y + ' L' + (x + w) + ' ' + (y + h) + ' Z"/>';
      case "Gebogen": {
        const boog = Math.min(w / 2, h * 0.45);
        return '<path d="M' + x + ' ' + (y + h) + ' L' + x + ' ' + (y + boog) + ' Q' + x + ' ' + y + ' ' + (x + w / 2) + ' ' + y +
               ' Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + boog) + ' L' + (x + w) + ' ' + (y + h) + ' Z"/>';
      }
      case "Overig": return "";
      default: return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>';
    }
  }

  function pijlMaat(x1, y1, x2, y2, tekst, kleur, buitenkant) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len, px = -uy, py = ux;
    const p = 10; // pijlpunt
    const pijl = function (x, y, r) {
      return '<path d="M' + x + ' ' + y + ' L' + (x + r * ux * p + px * 5) + ' ' + (y + r * uy * p + py * 5) +
             ' L' + (x + r * ux * p - px * 5) + ' ' + (y + r * uy * p - py * 5) + ' Z" fill="' + kleur + '"/>';
    };
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const hoek = Math.atan2(dy, dx) * 180 / Math.PI;
    const draai = hoek > 90 || hoek < -90 ? hoek + 180 : hoek;
    const afstand = buitenkant ? -12 : -10;
    return '<g class="maat">' +
      '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + kleur + '" stroke-width="2"/>' +
      pijl(x1, y1, 1) + pijl(x2, y2, -1) +
      (tekst ? '<text x="' + mx + '" y="' + my + '" transform="rotate(' + draai + ' ' + mx + ' ' + my + ') translate(0 ' + afstand + ')" ' +
        'text-anchor="middle" font-size="26" font-weight="700" fill="' + kleur + '" font-family="Arial, sans-serif" ' +
        'paint-order="stroke" stroke="#fff" stroke-width="6">' + esc(tekst) + '</text>' : "") +
      '</g>';
  }

  // Volledige SVG van een schets voor een raam
  function svg(schets, raam, opties) {
    const s = schets || {};
    const o = opties || {};
    const vorm = s.vorm || raam.vorm || "Rechthoekig";
    const k = kader(raam, vorm);
    let inhoud = "";

    // Verdeling in vakken (alleen bij rechthoekige vormen)
    const kol = Math.max(1, Number(s.kolommen) || 1), rij = Math.max(1, Number(s.rijen) || 1);
    let verdeling = "";
    if (vorm === "Rechthoekig" || vorm === "Vierkant" || vorm === "Gebogen" || vorm === "Schuin") {
      for (let i = 1; i < kol; i++) { const xx = k.x + k.w * i / kol; verdeling += '<line x1="' + xx + '" y1="' + k.y + '" x2="' + xx + '" y2="' + (k.y + k.h) + '"/>'; }
      for (let j = 1; j < rij; j++) { const yy = k.y + k.h * j / rij; verdeling += '<line x1="' + k.x + '" y1="' + yy + '" x2="' + (k.x + k.w) + '" y2="' + yy + '"/>'; }
    }
    const vorms = omtrek(vorm, k);
    if (vorms) {
      inhoud += '<g fill="#EAF3FA" stroke="' + KLEUR + '" stroke-width="5" stroke-linejoin="round">' + vorms + '</g>';
      if (verdeling) inhoud += '<g stroke="' + KLEUR + '" stroke-width="3">' + verdeling + '</g>';
      // Automatische maatlijnen: breedte onder, hoogte rechts
      if (o.maten !== false) {
        const bt = raam.breedte ? raam.breedte + " mm" : "breedte ?";
        const ht = raam.hoogte ? raam.hoogte + " mm" : "hoogte ?";
        if (vorm === "Rond") {
          inhoud += pijlMaat(k.x, k.y + k.h + 40, k.x + k.w, k.y + k.h + 40, "⌀ " + bt, MAATKLEUR, true);
        } else {
          inhoud += pijlMaat(k.x, k.y + k.h + 40, k.x + k.w, k.y + k.h + 40, bt, MAATKLEUR, true);
          inhoud += pijlMaat(k.x + k.w + 40, k.y + k.h, k.x + k.w + 40, k.y, ht, MAATKLEUR, true);
        }
        inhoud += '<g stroke="' + MAATKLEUR + '" stroke-width="1.5" stroke-dasharray="4 4">' +
          '<line x1="' + k.x + '" y1="' + (k.y + k.h + 8) + '" x2="' + k.x + '" y2="' + (k.y + k.h + 52) + '"/>' +
          '<line x1="' + (k.x + k.w) + '" y1="' + (k.y + k.h + 8) + '" x2="' + (k.x + k.w) + '" y2="' + (k.y + k.h + 52) + '"/>' +
          (vorm !== "Rond" ? '<line x1="' + (k.x + k.w + 8) + '" y1="' + k.y + '" x2="' + (k.x + k.w + 52) + '" y2="' + k.y + '"/>' +
                             '<line x1="' + (k.x + k.w + 8) + '" y1="' + (k.y + k.h) + '" x2="' + (k.x + k.w + 52) + '" y2="' + (k.y + k.h) + '"/>' : "") +
          '</g>';
      }
    }

    // Eigen tekening
    (s.elementen || []).forEach(function (el) {
      if (el.soort === "maat") inhoud += pijlMaat(el.x1, el.y1, el.x2, el.y2, el.tekst, MAATKLEUR, false);
      if (el.soort === "tekst") inhoud += '<text x="' + el.x + '" y="' + el.y + '" font-size="26" fill="' + TEKSTKLEUR + '" font-family="Arial, sans-serif" ' +
        'paint-order="stroke" stroke="#fff" stroke-width="6">' + esc(el.tekst) + '</text>';
      if (el.soort === "pen" && el.punten && el.punten.length > 1) {
        inhoud += '<polyline points="' + el.punten.map(function (p) { return p[0] + "," + p[1]; }).join(" ") +
          '" fill="none" stroke="' + TEKSTKLEUR + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
      }
    });

    if (o.titel !== false && raam.nummer) {
      inhoud += '<text x="20" y="40" font-size="28" font-weight="700" fill="' + KLEUR + '" font-family="Arial, sans-serif">Raam ' + esc(raam.nummer) +
        (raam.ruimte ? " – " + esc(raam.ruimte) : "") + '</text>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + B + ' ' + H + '"' + (o.klasse ? ' class="' + o.klasse + '"' : "") +
           ' role="img" aria-label="Schets raam ' + esc(raam.nummer || "") + '"><rect width="' + B + '" height="' + H + '" fill="#fff"/>' + inhoud + '</svg>';
  }

  // Schets als PNG (voor de PDF in stap 5c)
  function png(schets, raam, breedte) {
    return new Promise(function (klaar) {
      const img = new Image();
      const blob = new Blob([svg(schets, raam)], { type: "image/svg+xml" });
      const u = URL.createObjectURL(blob);
      img.onload = function () {
        const c = document.createElement("canvas");
        c.width = breedte || 1000; c.height = Math.round((breedte || 1000) * H / B);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        klaar(c.toDataURL("image/png"));
      };
      img.onerror = function () { URL.revokeObjectURL(u); klaar(null); };
      img.src = u;
    });
  }

  return { svg: svg, png: png, B: B, H: H };
})();

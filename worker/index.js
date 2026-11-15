/* =========================================================
   Glasmeesters Planner – kleine hulp op de server (Cloudflare)
   Alle pagina's en bestanden worden gewoon door Cloudflare geleverd.
   Alleen adressen die met /api/ beginnen komen hier langs.

   /api/zones  haalt de milieuzones en zero-emissiezones op bij het
               Nationaal Dataportaal Wegverkeer (open data) en geeft ze door.
               Nodig omdat de browser ze niet rechtstreeks mag ophalen.
               Het antwoord wordt 12 uur bewaard, zodat het NDW niet
               bij elke kaart opnieuw wordt gevraagd.
   ========================================================= */

const NDW_ZONES = "https://data.ndw.nu/api/rest/static-road-data/emission-zones/v1/map";
const BEWAAR_SECONDEN = 12 * 60 * 60;

function json(data, status, extra) {
  return new Response(typeof data === "string" ? data : JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" }, extra || {})
  });
}

async function zones(request, ctx) {
  const cache = caches.default;
  const sleutel = new Request(new URL("/api/zones", request.url).toString());
  const bewaard = await cache.match(sleutel);
  if (bewaard) return bewaard;
  let antwoord;
  try {
    antwoord = await fetch(NDW_ZONES, { headers: { accept: "application/json", "user-agent": "Glasmeesters-Planner/1.0" } });
  } catch (e) {
    return json({ fout: "Het NDW is niet bereikbaar: " + (e.message || e) }, 502);
  }
  const tekst = await antwoord.text();
  if (!antwoord.ok) return json({ fout: "Het NDW gaf foutcode " + antwoord.status, begin: tekst.slice(0, 300) }, 502);
  const goed = json(tekst, 200, { "cache-control": "public, max-age=" + BEWAAR_SECONDEN });
  ctx.waitUntil(cache.put(sleutel, goed.clone()));
  return goed;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/zones") return zones(request, ctx);
    if (url.pathname.startsWith("/api/")) return json({ fout: "Onbekend adres" }, 404);
    return env.ASSETS.fetch(request);
  }
};

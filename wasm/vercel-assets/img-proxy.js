// Vercel serverless function: proxy remote menu images / flags / anthems /
// player photos so they can be loaded under COEP require-corp (adds CORP) and
// so Wikimedia doesn't 429 us (it requires a descriptive User-Agent).
module.exports = async (req, res) => {
  const u = new URL(req.url, "http://localhost").searchParams.get("u") || "";
  if (!/^https:\/\/(images\.unsplash\.com|upload\.wikimedia\.org|flagcdn\.com)\//.test(u)) {
    res.status(400).send("bad host");
    return;
  }
  try {
    const r = await fetch(u, {
      headers: {
        "User-Agent":
          "GameplayFootballWeb/1.0 (https://github.com/louisxivlg2016/GameplayFootball; wasm port; anthem/flag/photo proxy)",
        Accept: "*/*",
      },
    });
    if (!r.ok) {
      res.status(502).send("upstream " + r.status);
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", r.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).send("proxy failed");
  }
};

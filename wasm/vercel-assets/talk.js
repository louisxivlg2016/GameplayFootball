// Vercel serverless function: the "talk to a player" AI. The referee's message is
// sent here; we relay it to Claude with a system prompt that makes the model
// role-play the football player arguing with the ref, and return its reply.
//
// Needs the env var ANTHROPIC_API_KEY set in the Vercel project. Without it, we
// return { reply: null, nokey: true } so the game falls back to its built-in
// canned/emotional replies. CORP headers let the COEP-isolated page fetch this.
module.exports = async (req, res) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ reply: null, nokey: true }); return; }

  // read the JSON body (Vercel may or may not pre-parse it)
  let data = req.body;
  if (!data || typeof data === "string") {
    let raw = typeof data === "string" ? data : "";
    if (!raw) { await new Promise((r) => { req.on("data", (c) => (raw += c)); req.on("end", r); }); }
    try { data = JSON.parse(raw || "{}"); } catch { data = {}; }
  }

  const name = String(data.name || "Le joueur").slice(0, 40);
  const message = String(data.message || "").slice(0, 300);
  const history = Array.isArray(data.history) ? data.history.slice(-8) : [];

  const system =
    `Tu es ${name}, footballeur professionnel, sur le terrain PENDANT un match. ` +
    `L'ARBITRE vient te parler. Réponds toujours EN FRANÇAIS, en 1 à 2 phrases courtes, ` +
    `comme un vrai joueur qui parle à l'arbitre : tu contestes les fautes et cartons, tu ` +
    `plaides ta cause, tu peux t'énerver franchement si on t'insulte ou te provoque, te ` +
    `calmer si l'arbitre est correct, et obéir aux ordres raisonnables (reculer, te calmer). ` +
    `Reste crédible et dans le personnage. Donne UNIQUEMENT ta réplique parlée, sans narration ni guillemets.`;

  const messages = [];
  for (const h of history) messages.push({ role: h.role === "ref" ? "user" : "assistant", content: String(h.text || "").slice(0, 300) });
  messages.push({ role: "user", content: message });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 120, system, messages }),
    });
    if (!r.ok) { res.status(200).json({ reply: null, error: "upstream " + r.status }); return; }
    const j = await r.json();
    const reply = (j && j.content && j.content[0] && j.content[0].text) ? j.content[0].text.trim() : null;
    res.status(200).json({ reply });
  } catch (e) {
    res.status(200).json({ reply: null, error: String(e) });
  }
};

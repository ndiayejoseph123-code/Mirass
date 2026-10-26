// Fonction Netlify : appelle Groq sans exposer la clé dans le navigateur.
// Clé à mettre dans Netlify > Site configuration > Environment variables : GROQ_API_KEY
// (optionnel) GROQ_MODEL pour forcer un modèle précis.
const MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant"
];

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  const reply = (code, obj) => ({ statusCode: code, headers, body: JSON.stringify(obj) });

  if (event.httpMethod !== "POST") return reply(405, { error: "Méthode non autorisée" });
  if (!process.env.GROQ_API_KEY) return reply(500, { error: "Clé GROQ_API_KEY absente dans Netlify" });

  let prompt = "";
  try {
    prompt = String(JSON.parse(event.body || "{}").prompt || "").slice(0, 20000);
  } catch (e) {
    return reply(400, { error: "Requête invalide" });
  }
  if (!prompt) return reply(400, { error: "Prompt vide" });

  const list = process.env.GROQ_MODEL ? [process.env.GROQ_MODEL, ...MODELS] : MODELS;
  let lastError = "Aucun modèle disponible";

  for (const model of list) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.GROQ_API_KEY
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          max_tokens: 4000
        })
      });
      const data = await res.json();
      if (res.ok) {
        const text = data.choices && data.choices[0] && data.choices[0].message.content;
        if (text) return reply(200, { text, model });
        lastError = "Réponse vide (" + model + ")";
        continue;
      }
      lastError = ((data.error && data.error.message) || "Erreur Groq " + res.status) + " [" + model + "]";
      // Modèle inaccessible / retiré : on essaie le suivant. Autre erreur (clé, quota) : on s'arrête.
      const msg = lastError.toLowerCase();
      if (res.status === 404 || msg.includes("model")) continue;
      return reply(502, { error: lastError });
    } catch (e) {
      lastError = e.message;
    }
  }
  return reply(502, { error: lastError });
};

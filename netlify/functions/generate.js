// Fonction Netlify : appelle Groq sans exposer la clé dans le navigateur.
// Clé à mettre dans Netlify > Site configuration > Environment variables : GROQ_API_KEY
exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }
  if (!process.env.GROQ_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Clé GROQ_API_KEY absente dans Netlify" }) };
  }

  let prompt = "";
  try {
    prompt = String(JSON.parse(event.body || "{}").prompt || "").slice(0, 6000);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Requête invalide" }) };
  }
  if (!prompt) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Prompt vide" }) };
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.GROQ_API_KEY
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2500
      })
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data.error && data.error.message) || "Erreur Groq " + res.status;
      return { statusCode: 502, headers, body: JSON.stringify({ error: msg }) };
    }
    const text = data.choices && data.choices[0] && data.choices[0].message.content;
    return { statusCode: 200, headers, body: JSON.stringify({ text: text || "" }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

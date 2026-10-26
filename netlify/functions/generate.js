exports.handler = async (event) => {
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const GROQ_KEY = process.env.GROQ_API_KEY || process.env.MISTRAL_API_KEY;
    if (!GROQ_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Ajoute GROQ_API_KEY dans Netlify' }) };

    const sys = `Tu es inspecteur CEB Senegal. Fiche RICHE pour "${classe}" ${niveau}. Obligatoire: cb, palier, oa, os, contenu avec exemples, objectif, moyen_materiel avec corpus, moyen_pedagogique, documentation, demarche en 5 etapes avec exemple. JSON valide.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        temperature: 0.4,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Fiche riche CEB pour ${classe} ${niveau}` }
        ]
      })
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    let raw = data.choices[0].message.content.replace(/```json|```/g, '').trim();
    if (!raw.endsWith('}')) raw = raw.slice(0, raw.lastIndexOf('}') + 1);
    const fiche = JSON.parse(raw);
    fiche.classe = classe; fiche.niveau = niveau;
    return { statusCode: 200, body: JSON.stringify({ fiche, source_file: 'Mirass GROQ - Gratuit illimite' }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

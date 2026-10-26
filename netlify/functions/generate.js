exports.handler = async (event) => {
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const KEY = process.env.GROQ_API_KEY || process.env.MISTRAL_API_KEY;
    if (!KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Ajoute GROQ_API_KEY' }) };

    const sys = `Tu es inspecteur CEB Senegal. Fiche RICHE pour "${classe}" ${niveau}. Obligatoire: cb, palier, oa, os, contenu, objectif, moyen_materiel, moyen_pedagogique, documentation, demarche 5 etapes avec exemple. JSON valide.`;

    const modelesActuels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'llama3-70b-8192',
      'llama3-8b-8192',
      'gemma2-9b-it'
    ];

    for (const model of modelesActuels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            temperature: 0.4,
            max_tokens: 2500,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: `Fiche riche CEB pour ${classe} ${niveau}` }
            ]
          })
        });
        if (!res.ok) {
          const txt = await res.text();
          if (txt.includes('decommissioned') || txt.includes('does not exist') || txt.includes('model_not_found')) continue;
          throw new Error(txt);
        }
        const data = await res.json();
        let raw = data.choices[0].message.content.replace(/```json|```/g, '').trim();
        if (!raw.endsWith('}')) raw = raw.slice(0, raw.lastIndexOf('}') + 1);
        const fiche = JSON.parse(raw);
        fiche.classe = classe; fiche.niveau = niveau;
        return { statusCode: 200, body: JSON.stringify({ fiche, source_file: `Mirass GROQ ${model}` }) };
      } catch (e) {
        if (e.message.includes('decommissioned') || e.message.includes('does not exist')) continue;
        throw e;
      }
    }
    throw new Error('Tous les modeles Groq ont echoue - verifie ta cle sur console.groq.com');

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

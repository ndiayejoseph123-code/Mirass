exports.handler = async (event) => {
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const KEY = process.env.GROQ_API_KEY;
    
    if (!KEY) throw new Error('GROQ_API_KEY manquante dans Netlify');
    if (!KEY.startsWith('gsk_')) throw new Error('Ta clé doit commencer par gsk_, pas ' + KEY.slice(0, 5));

    // Test simple avec 1 modèle
    const model = 'llama-3.1-8b-instant';
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: `Dis bonjour, tu es Groq ${model}` }],
        max_tokens: 50
      })
    });

    const txt = await res.text();

    if (!res.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: `GROQ DIT: Status ${res.status} - ${txt}`, key_prefix: KEY.slice(0, 10) + '...' }) };
    }

    // Si Groq marche, on fait la fiche riche
    const promptFiche = `Fiche CEB riche pour ${classe} ${niveau}. JSON uniquement avec titre, cb, palier, oa, os, contenu avec exemple Moussa mange une mangue, objectif, moyen_materiel, moyen_pedagogique, documentation, demarche 5 etapes.`;

    const res2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        temperature: 0.4,
        max_tokens: 3000,
        messages: [{ role: 'user', content: promptFiche }]
      })
    });

    const txt2 = await res2.text();
    if (!res2.ok) return { statusCode: 500, body: JSON.stringify({ error: `GROQ FICHE ERREUR: ${txt2.slice(0, 500)}` }) };

    const data = JSON.parse(txt2);
    let raw = data.choices[0].message.content;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0) raw = raw.slice(start, end + 1);
    const fiche = JSON.parse(raw);
    fiche.classe = classe; fiche.niveau = niveau;

    return { statusCode: 200, body: JSON.stringify({ fiche, source_file: `Mirass GROQ ${model} OK` }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'DEBUG: ' + e.message }) };
  }
};

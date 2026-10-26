exports.handler = async (event) => {
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const GROQ_KEY = process.env.GROQ_API_KEY || process.env.MISTRAL_API_KEY;
    if (!GROQ_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Ajoute GROQ_API_KEY dans Netlify' }) };

    const sys = `Tu es inspecteur CEB Sénégal. Fiche RICHE COMPLÈTE pour "${classe}" ${niveau}. Obligatoire: cb, palier, oa, os, contenu avec 3 exemples sénégalais, objectif, moyen_materiel avec corpus 6 phrases, moyen_pedagogique, documentation, demarche en 5 étapes avec activité maître détaillée, activité élèves, durée, matériel, exemple concret. Titre doit contenir "${classe}". JSON valide.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        max_tokens: 3500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Fiche riche CEB complète pour ${classe} ${niveau} - avec exemples Moussa mange une mangue, marché Sandaga, etc. Tous les champs CB, Palier, OA, OS obligatoires.` }
        ]
      })
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    let raw = data.choices[0].message.content.replace(/```json|```/g, '').trim();
    if (!raw.endsWith('}')) raw = raw.slice(0, raw.lastIndexOf('}') + 1);
    const fiche = JSON.parse(raw);
    fiche.classe = classe; fiche.niveau = niveau;
    return { statusCode: 200, body: JSON.stringify({ fiche, source_file: 'Mirass 100% GROQ Intelligent - Gratuit illimité' }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

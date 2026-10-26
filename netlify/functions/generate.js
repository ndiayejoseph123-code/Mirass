exports.handler = async (event) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const KEY = process.env.MISTRAL_API_KEY;
    if (!KEY) return { statusCode: 500, body: JSON.stringify({ error: 'MISTRAL_API_KEY manquante dans Netlify' }) };

    const gh = await fetch('https://api.github.com/repos/ndiayejoseph123-code/Mirass/contents', { headers: { 'User-Agent': 'Mirass' } });
    const files = await gh.json();
    const target = (classe || '').toLowerCase();
    const picked = files.filter(f => f.name.endsWith('.json')).sort((a, b) => {
      const sa = a.name.toLowerCase().includes(target) ? 1 : 0;
      const sb = b.name.toLowerCase().includes(target) ? 1 : 0;
      return sb - sa;
    }).slice(0, 2);

    const docs = await Promise.all(picked.map(async f => {
      const r = await fetch(f.download_url);
      return { name: f.name, content: (await r.text()).slice(0, 4000) };
    }));
    const corpus = docs.map(d => `${d.name}:${d.content}`).join('\n').slice(0, 8000);

    const prompt = `Tu es Mirass intelligent, expert CEB sénégalais. Tu lis le corpus Mirass et tu appliques sa démarche à la nouvelle leçon. Tu peux créer n'importe quelle fiche même si elle n'existe pas, mais tu restes fidèle à la démarche. Sors uniquement JSON valide: {titre,classe,niveau,objectif,competences,demarche_reference,source_files_utilises,demarche:[{etape,activite_maitre,activite_eleves,duree,materiel}]}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const mistral = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral-tiny-latest',
          temperature: 0.2,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: `Leçon demandée: ${classe} ${niveau} CORPUS MIRASS: ${corpus}` }
          ]
        })
      });

      if (mistral.status === 429) {
        if (attempt < 2) { await sleep(2500 + attempt * 2000); continue; }
        return { statusCode: 429, body: JSON.stringify({ error: 'Mistral saturé, attends 30s et re-clique. Ta clé marche.' }) };
      }
      if (!mistral.ok) throw new Error(await mistral.text());

      const data = await mistral.json();
      let raw = (data.choices[0].message.content || '').trim();
      raw = raw.replace(/```json|```/g, '').trim();
      if (!raw.endsWith('}')) {
        const last = raw.lastIndexOf('}');
        if (last > 0) raw = raw.slice(0, last + 1);
      }
      const fiche = JSON.parse(raw);
      return { statusCode: 200, body: JSON.stringify({ fiche, source_file: docs.map(d => d.name).join(', ') }) };
    }

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

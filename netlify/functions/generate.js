exports.handler = async (event) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const KEY = process.env.MISTRAL_API_KEY;
    if (!KEY) return { statusCode: 500, body: JSON.stringify({ error: 'MISTRAL_API_KEY manquante' }) };

    const gh = await fetch('https://api.github.com/repos/ndiayejoseph123-code/Mirass/contents', { headers: { 'User-Agent': 'Mirass' } });
    const files = await gh.json();
    const jsonFiles = files.filter(f => f.name.endsWith('.json')).slice(0, 5);
    const docs = await Promise.all(jsonFiles.map(async f => {
      const r = await fetch(f.download_url);
      return { name: f.name, content: (await r.text()).slice(0, 3000) };
    }));
    const corpusStructure = docs.map(d => `FICHIER ${d.name}: structure démarche extraite de ${d.content.slice(0,2000)}`).join('\n').slice(0,7000);

    const systemPrompt = `
Tu es Mirass. RÈGLE N°1 ABSOLUE: La discipline demandée par l'utilisateur est SACRÉE.
Si l'utilisateur tape "COD CE2", tu fais une fiche sur COD CE2, PAS sur SIDA.
Si il tape "prehistoire", tu fais préhistoire, PAS autre chose.

Tu utilises le CORPUS uniquement pour COPIER LA FORME du tableau:
- les 5 colonnes: Etape, Activité maître, Activité élèves, Durée, Matériel
- les 5 étapes type: Révision, Motivation, Imprégnation/Analyse, Fixation, Evaluation
- le style sénégalais CEB

Mais le CONTENU de la leçon = ce que l'utilisateur a tapé.

Interdit de changer de sujet. Si tu ne connais pas le sujet, tu inventes le contenu pédagogique cohérent pour ce sujet, mais tu gardes la forme Mirass.

Sors JSON: {titre:"[CLASSE TAPEÉE] - [NIVEAU]", classe:"${classe}", niveau:"${niveau}", objectif, competences, demarche_reference, demarche:[{etape,activite_maitre,activite_eleves,duree,materiel}]}
Le titre DOIT contenir exactement le mot tapé par l'utilisateur.
`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const mistral = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral-tiny-latest',
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `L'utilisateur a tapé exactement: Classe/Discipline="${classe}" Niveau="${niveau}". Tu DOIS faire une fiche sur "${classe}" et pas sur un autre sujet. Corpus pour la forme seulement: ${corpusStructure}` }
          ]
        })
      });
      if (mistral.status === 429) { if (attempt < 2) { await sleep(2500); continue; } return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit, attends 20s' }) }; }
      if (!mistral.ok) throw new Error(await mistral.text());
      const data = await mistral.json();
      let raw = data.choices[0].message.content.replace(/```json|```/g,'').trim();
      if (!raw.endsWith('}')) raw = raw.slice(0, raw.lastIndexOf('}')+1);
      const fiche = JSON.parse(raw);
      fiche.classe = classe; fiche.niveau = niveau; // force le vrai mot
      if(!fiche.titre.toLowerCase().includes(classe.toLowerCase().slice(0,3))) fiche.titre = `${classe} - ${niveau}`;
      return { statusCode: 200, body: JSON.stringify({ fiche, source_file: fiche.demarche_reference || docs[0].name }) };
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

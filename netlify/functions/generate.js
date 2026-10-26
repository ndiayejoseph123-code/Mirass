exports.handler = async (event) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    const body = JSON.parse(event.body || '{}');
    const classe = (body.classe || '').trim();
    const niveau = (body.niveau || '').trim();
    const KEY = process.env.MISTRAL_API_KEY;
    if (!KEY) return { statusCode: 500, body: JSON.stringify({ error: 'MISTRAL_API_KEY manquante' }) };
    if (!classe) return { statusCode: 400, body: JSON.stringify({ error: 'classe vide' }) };

    const gh = await fetch('https://api.github.com/repos/ndiayejoseph123-code/Mirass/contents', { headers: { 'User-Agent': 'Mirass' } });
    const files = await gh.json();
    const one = files.filter(f => f.name.endsWith('.json'))[0];
    let structure = 'Etape, Activite maitre, Activite eleves, Duree, Materiel';
    if (one) {
      try {
        const r = await fetch(one.download_url);
        const txt = (await r.text()).slice(0, 1500);
        structure = txt.slice(0, 800);
      } catch {}
    }

    const sys = `Tu es Mirass. Tu fais une fiche sur la discipline exacte tapée par l'utilisateur: "${classe}". Ne change JAMAIS de sujet. Utilise juste la forme CEB: Revision, Motivation, Impregnation, Fixation, Evaluation. Sors un JSON COURT et VALIDE sans couper. Format: {"titre":"${classe} - ${niveau}","classe":"${classe}","niveau":"${niveau}","objectif":"...","competences":"...","demarche":[{"etape":"Revision","activite_maitre":"...","activite_eleves":"...","duree":"5 min","materiel":"..."},{"etape":"Motivation","activite_maitre":"...","activite_eleves":"...","duree":"5 min","materiel":"..."},{"etape":"Impregnation","activite_maitre":"...","activite_eleves":"...","duree":"15 min","materiel":"..."},{"etape":"Evaluation","activite_maitre":"...","activite_eleves":"...","duree":"10 min","materiel":"..."}]}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral-tiny-latest',
          temperature: 0.2,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: `Fais la fiche demandée: ${classe} ${niveau}. Structure exemple: ${structure}` }
          ]
        })
      });

      if (res.status === 429) {
        if (attempt < 2) { await sleep(3000); continue; }
        return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit Mistral, attends 30s' }) };
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t.slice(0, 500));
      }

      const data = await res.json();
      let raw = data.choices[0].message.content || '';
      raw = raw.replace(/```json|```/g, '').trim();

      // Réparation JSON automatique
      try {
        const fiche = JSON.parse(raw);
        fiche.classe = classe;
        fiche.niveau = niveau;
        if (!fiche.titre) fiche.titre = `${classe} - ${niveau}`;
        return { statusCode: 200, body: JSON.stringify({ fiche, source_file: one ? one.name : 'Mirass' }) };
      } catch (e) {
        // Tente de fermer le JSON tronqué
        const lastBrace = raw.lastIndexOf('}');
        const lastBracket = raw.lastIndexOf(']');
        let cut = lastBrace > lastBracket ? lastBrace : lastBracket;
        if (cut > 50) {
          let attemptFix = raw.slice(0, cut + 1);
          // Ferme les tableaux/objets manquants
          const openBraces = (attemptFix.match(/{/g) || []).length - (attemptFix.match(/}/g) || []).length;
          const openBrackets = (attemptFix.match(/\[/g) || []).length - (attemptFix.match(/\]/g) || []).length;
          attemptFix += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
          try {
            const fiche = JSON.parse(attemptFix);
            fiche.classe = classe;
            fiche.niveau = niveau;
            return { statusCode: 200, body: JSON.stringify({ fiche, source_file: 'Mirass (réparé)' }) };
          } catch {}
        }
        if (attempt < 2) { await sleep(2000); continue; }
        throw new Error('JSON incomplet de Mistral, réessaie: ' + raw.slice(0, 200));
      }
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

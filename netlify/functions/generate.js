exports.handler = async (event) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const KEY = process.env.MISTRAL_API_KEY;
    if (!KEY) return { statusCode: 500, body: JSON.stringify({ error: 'MISTRAL_API_KEY manquante' }) };

    const gh = await fetch('https://api.github.com/repos/ndiayejoseph123-code/Mirass/contents', { headers: { 'User-Agent': 'Mirass' } });
    const files = await gh.json();
    const docs = await Promise.all(files.filter(f => f.name.endsWith('.json')).slice(0,3).map(async f => {
      const r = await fetch(f.download_url); return { name: f.name, txt: (await r.text()).slice(0,4000) };
    }));
    const corpus = docs.map(d=>d.txt).join('\n').slice(0,8000);

    const sys = `Tu es un inspecteur CEB Sénégal. Tu dois produire une fiche PÉDAGOGIQUE COMPLÈTE et RICHE, pas squelettique.

Discipline demandée: "${classe}" Niveau: "${niveau}" - Tu respectes exactement ce sujet.

Structure OBLIGATOIRE à sortir en JSON:
{
 "titre": "${classe} - ${niveau}",
 "cb": "Compétence de Base ex: CB2 Communiquer...",
 "palier": "Palier ex: Palier 2...",
 "oa": "OA ex: OA3...",
 "os": "OS ex: OS3.2 Identifier le COD...",
 "contenu": "Contenu notionnel détaillé",
 "objectif": "Objectif opérationnel: Au terme de la séance, l'élève sera capable de...",
 "moyen_materiel": "Tableau, craie, ardoises, images, texte support, corpus de phrases ex: 'Moussa mange une mangue'...",
 "moyen_pedagogique": "Interrogatif, participatif, travail de groupe, brainstorming...",
 "documentation": "Guide pédagogique CEB CE2 page..., Manuel CIAM, etc.",
 "demarche": [
   {"etape":"Révision","activite_maitre":"Rappelle la leçon précédente sur le sujet... Pose 2 questions précises","activite_eleves":"Répondent, donnent exemples","duree":"5 min","materiel":"Ardoise","exemple":"Ex: Quel est le sujet dans 'Le chien aboie' ?"},
   {"etape":"Motivation","activite_maitre":"Présente situation problème avec un texte court","activite_eleves":"Lis et découvre","duree":"5 min","materiel":"Texte au tableau","exemple":"Texte: 'Aminata achète des beignets...'"},
   {"etape":"Imprégnation / Analyse","activite_maitre":"Fait observer, questionne, guide la découverte du COD...","activite_eleves":"Observent, manipulent, trouvent le COD en posant la question quoi/qui après verbe","duree":"15 min","materiel":"Corpus phrases","exemple":"Mange quoi? -> une mangue = COD"},
   {"etape":"Fixation / Synthèse","activite_maitre":"Fait formuler la règle par les élèves","activite_eleves":"Formulent règle: Le COD complète directement le verbe...","duree":"10 min","materiel":"Tableau","exemple":"Règle: COD = ..."},
   {"etape":"Evaluation","activite_maitre":"Propose exercices gradués","activite_eleves":"Font exercices","duree":"10 min","materiel":"Cahier","exemple":"Souligne le COD: 'Le maître explique la leçon'"}
 ]
}

Règles:
- Donne des VRAIS exemples de phrases pour ${classe}
- Pas squelettique: chaque activité maître = 2-3 phrases détaillées
- Utilise le corpus suivant pour le style: ${corpus.slice(0,2000)}
`;

    for (let a = 0; a < 3; a++) {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          temperature: 0.4,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: sys }, { role: 'user', content: `Fiche complète pour ${classe} ${niveau}` }]
        })
      });
      if (res.status === 429) { await sleep(3000); continue; }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      let raw = data.choices[0].message.content.replace(/```json|```/g, '').trim();
      try {
        const fiche = JSON.parse(raw);
        return { statusCode: 200, body: JSON.stringify({ fiche, source_file: 'Mirass complet' }) };
      } catch {
        const last = raw.lastIndexOf('}');
        if (last > 0) {
          try { const fiche = JSON.parse(raw.slice(0, last + 1)); return { statusCode: 200, body: JSON.stringify({ fiche, source_file: 'Mirass' }) }; } catch {}
        }
        await sleep(1500);
      }
    }
    throw new Error('Mistral a coupé le JSON, réessaie');
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

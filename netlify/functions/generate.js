exports.handler = async (event) => {
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const KEY = process.env.GROQ_API_KEY;
    if (!KEY) throw new Error('GROQ_API_KEY manquante');

    const discipline = classe.trim();
    const model = 'openai/gpt-oss-20b';

    const prompt = `
Tu es un inspecteur de l'éducation sénégalais, expert CEB 100% intelligent.

L'utilisateur demande: "${discipline}" niveau "${niveau}".

TA MISSION:
1. COMPRENDS la discipline demandée: Si c'est "Conjugaison verbes 1er groupe", tu parles de conjugaison, radical, terminaison -e, -es, -e, -ons, -ez, -ent. PAS de COD.
   Si c'est "COD", tu parles de complément d'objet direct. Si c'est "Préhistoire", tu parles de paléolithique, néolithique. Si c'est "EDD SIDA", tu parles de SIDA.
   TU NE MÉLANGES JAMAIS deux disciplines.

2. RAISONNE en expert CEB:
   - Quelle est la CB correspondante? (CB2 Langue, CB4 Découverte monde, etc.)
   - Quel est le palier logique pour ${niveau}?
   - Quel OA/OS correspond à "${discipline}"?
   - Quel contenu notionnel pour ${niveau}?
   - Quels exemples sénégalais pertinents pour "${discipline}"? (pas toujours "Moussa mange une mangue" - si c'est conjugaison, exemple = "Je mange, tu manges, il mange")

3. Sors UNIQUEMENT un JSON valide avec cette structure, sans texte autour:
{
  "titre": "${discipline} - ${niveau}",
  "cb": "...",
  "palier": "...",
  "oa": "...",
  "os": "...",
  "contenu": "...détaillé et spécifique à ${discipline}...",
  "objectif": "...",
  "moyen_materiel": "...spécifique à ${discipline}...",
  "moyen_pedagogique": "...",
  "documentation": "...",
  "demarche": [
    {"etape":"Revision","activite_maitre":"...spécifique à ${discipline}...","activite_eleves":"...","duree":"5 min","materiel":"...","exemple":"...spécifique à ${discipline}..."},
    {"etape":"Motivation","activite_maitre":"...","activite_eleves":"...","duree":"5 min","materiel":"...","exemple":"..."},
    {"etape":"Impregnation/Analyse","activite_maitre":"...","activite_eleves":"...","duree":"15 min","materiel":"...","exemple":"..."},
    {"etape":"Synthese","activite_maitre":"...","activite_eleves":"...","duree":"10 min","materiel":"...","exemple":"..."},
    {"etape":"Evaluation","activite_maitre":"...","activite_eleves":"...","duree":"10 min","materiel":"...","exemple":"..."}
  ]
}

RÈGLE ANTI-ABSURDITÉ: Si discipline = Conjugaison, interdiction de parler de COD, de quoi/qui. Si discipline = COD, interdiction de parler de terminaisons -e -es. Reste cohérent de A à Z avec "${discipline}".
`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        temperature: 0.7,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const txt = await res.text();
    if (!res.ok) throw new Error(txt.slice(0, 500));

    const data = JSON.parse(txt);
    let raw = data.choices[0].message.content;
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s >= 0 && e > s) raw = raw.slice(s, e + 1);
    raw = raw.replace(/```json|```/g, '').trim();

    const fiche = JSON.parse(raw);
    fiche.classe = discipline;
    fiche.niveau = niveau;

    return { statusCode: 200, body: JSON.stringify({ fiche, source_file: `Mirass Intelligent 100% - ${discipline}` }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

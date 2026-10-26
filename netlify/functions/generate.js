exports.handler = async (event) => {
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const KEY = process.env.MISTRAL_API_KEY;
    if (!KEY) return { statusCode: 500, body: JSON.stringify({ error: 'MISTRAL_API_KEY manquante' }) };

    const sys = `Tu es inspecteur CEB. Discipline="${classe}" Niveau="${niveau}". Sors JSON VALIDE COURT.
Format exact:
{"titre":"${classe} - ${niveau}","cb":"CB2...","palier":"Palier 2","oa":"OA...","os":"OS... identifier...","contenu":"Le ${classe}","objectif":"Au terme, l'élève sera capable de...","moyen_materiel":"Tableau, ardoises, corpus phrases","moyen_pedagogique":"Interrogatif, participatif","documentation":"Guide CEB ${niveau}","demarche":[{"etape":"Revision","activite_maitre":"Rappel","activite_eleves":"Repondent","duree":"5 min","materiel":"Ardoise","exemple":"Ex: sujet dans phrase"},{"etape":"Motivation","activite_maitre":"Sit. probleme","activite_eleves":"Lis","duree":"5 min","materiel":"Texte","exemple":"Texte support"},{"etape":"Impregnation","activite_maitre":"Fait decouvrir ${classe} avec question quoi/qui","activite_eleves":"Trouvent","duree":"15 min","materiel":"Corpus","exemple":"Mange quoi? mangue=COD"},{"etape":"Evaluation","activite_maitre":"Exercices","activite_eleves":"Font","duree":"10 min","materiel":"Cahier","exemple":"Souligne COD"}]}

Règle: JSON court, pas de phrases de 100 mots, 4 étapes max, exemples courts.`;

    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Fiche ${classe} ${niveau} - JSON court` }
        ]
      })
    });

    if (res.status === 429) return { statusCode: 429, body: JSON.stringify({ error: 'Attends 15s puis re-clique (rate limit gratuit)' }) };
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    let raw = data.choices[0].message.content || '';
    raw = raw.replace(/```json|```/g, '').trim();

    let fiche;
    try {
      fiche = JSON.parse(raw);
    } catch {
      // Dernier recours: fiche par défaut enrichie avec la demande
      fiche = {
        titre: `${classe} - ${niveau}`,
        cb: `CB2 Communiquer en français`,
        palier: `Palier 2 - ${niveau}`,
        oa: `OA - Maitriser ${classe}`,
        os: `OS - Identifier et utiliser ${classe}`,
        contenu: `Le ${classe} : définition, identification, emploi`,
        objectif: `Au terme de la séance, l'élève sera capable d'identifier et d'employer le ${classe} dans une phrase`,
        moyen_materiel: `Tableau, craie, ardoises, corpus: "Moussa mange une mangue", "Aminata achète des beignets"`,
        moyen_pedagogique: `Démarche interrogative, participative, travail de groupe`,
        documentation: `Guide pédagogique CEB ${niveau}, Manuel de français`,
        demarche: [
          { etape: 'Révision', activite_maitre: `Rappelle la leçon sur le sujet/verbe. Pose: Qu'est-ce que le ${classe}?`, activite_eleves: 'Répondent avec exemples', duree: '5 min', materiel: 'Ardoise', exemple: `Ex: "Le chien aboie" - sujet?` },
          { etape: 'Motivation', activite_maitre: `Présente texte: "Moussa mange une mangue"`, activite_eleves: 'Lis et observe', duree: '5 min', materiel: 'Texte', exemple: 'Texte support au tableau' },
          { etape: 'Imprégnation', activite_maitre: `Fait poser la question quoi/qui après le verbe pour trouver ${classe}. Guide`, activite_eleves: `Mange quoi? une mangue = ${classe}`, duree: '15 min', materiel: 'Corpus', exemple: 'Mange quoi? → COD = une mangue' },
          { etape: 'Evaluation', activite_maitre: 'Donne 3 phrases à analyser', activite_eleves: 'Soulignent le COD', duree: '10 min', materiel: 'Cahier', exemple: 'Le maître explique la leçon → la leçon' }
        ]
      };
    }

    fiche.classe = classe;
    fiche.niveau = niveau;
    if (!fiche.titre.toLowerCase().includes(classe.toLowerCase().slice(0, 3))) fiche.titre = `${classe} - ${niveau}`;

    return { statusCode: 200, body: JSON.stringify({ fiche, source_file: 'Mirass CEB complet' }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

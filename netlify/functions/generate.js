exports.handler = async (event) => {
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const KEY = process.env.GROQ_API_KEY;
    if (!KEY) throw new Error('GROQ_API_KEY manquante');

    const model = 'openai/gpt-oss-20b'; // Ton modèle qui marche

    const prompt = `Tu es inspecteur CEB Sénégal expert. Crée une fiche pédagogique RICHE et COMPLÈTE pour "${classe}" niveau "${niveau}".
    
    Réponds UNIQUEMENT avec ce JSON valide (pas de texte avant/après):
    {
      "titre": "${classe} - ${niveau} - Fiche CEB complète",
      "cb": "CB2: Communiquer en français - Domaine Langue et Communication",
      "palier": "Palier 2: Au ${niveau}, intégrer les acquis linguistiques",
      "oa": "OA3: Maitriser les outils de la langue - Identifier ${classe}",
      "os": "OS: Identifier et manipuler ${classe} en posant quoi/qui",
      "contenu": "Définition détaillée de ${classe} avec 3 exemples sénégalais: Moussa mange une mangue sucrée, Aminata achète des beignets au marché Sandaga, Le maître explique la leçon",
      "objectif": "Au terme de 45min, l'élève de ${niveau} identifiera ${classe} dans 3 phrases sur 4",
      "moyen_materiel": "Tableau, craie, ardoises, corpus 6 phrases: Moussa mange une mangue, Le chien poursuit le chat, Aminata prépare le thieb, etc.",
      "moyen_pedagogique": "Méthode active, interrogative, inductive, travail individuel et groupe",
      "documentation": "Guide CEB ${niveau} page 78-82, Manuel Français",
      "demarche": [
        {"etape":"Revision (5 min)","activite_maitre":"Rappel sujet verbe: Le chien aboie -> sujet? verbe?","activite_eleves":"Repondent: Le chien sujet, aboie verbe","duree":"5 min","materiel":"Ardoise","exemple":"Le chien aboie - sujet/verbe"},
        {"etape":"Motivation (5 min)","activite_maitre":"Ecrit Moussa mange au tableau, demande si phrase complète","activite_eleves":"Disent incomplet, manque quoi il mange","duree":"5 min","materiel":"Tableau","exemple":"Moussa mange -> incomplet"},
        {"etape":"Analyse (15 min)","activite_maitre":"Corpus 4 phrases, fait poser question quoi/qui apres verbe pour trouver ${classe}","activite_eleves":"Posent quoi? qui? et trouvent ${classe}","duree":"15 min","materiel":"Corpus","exemple":"Mange quoi? une mangue = COD"},
        {"etape":"Synthese (10 min)","activite_maitre":"Fait formuler regle: Le ${classe} complete le verbe sans preposition","activite_eleves":"Formulent et recopient regle + 2 exemples","duree":"10 min","materiel":"Cahier","exemple":"Regle: repond a quoi/qui"},
        {"etape":"Evaluation (10 min)","activite_maitre":"3 exos: souligner COD, completer phrase, produire 2 phrases","activite_eleves":"Font exos et correction collective","duree":"10 min","materiel":"Cahier","exemple":"Les eleves ecoutent le maitre -> le maitre = COD"}
      ]
    }`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        temperature: 0.5,
        max_tokens: 3500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const txt = await res.text();
    if (!res.ok) throw new Error(`Groq ${model} erreur ${res.status}: ${txt.slice(0, 400)}`);

    const data = JSON.parse(txt);
    let raw = data.choices[0].message.content;
    raw = raw.replace(/```json|```/g, '').trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
    
    const fiche = JSON.parse(raw);
    fiche.classe = classe;
    fiche.niveau = niveau;

    return { statusCode: 200, body: JSON.stringify({ fiche, source_file: `Mirass ${model} - 100% IA Riche` }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

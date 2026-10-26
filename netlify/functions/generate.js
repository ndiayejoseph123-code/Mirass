exports.handler = async (event) => {
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const KEY = process.env.GROQ_API_KEY;
    if (!KEY) return { statusCode: 500, body: JSON.stringify({ error: 'GROQ_API_KEY manquante - ta clé doit commencer par gsk_' }) };

    const prompt = `Tu es inspecteur CEB Sénégal. Tu dois créer une fiche RICHE COMPLÈTE pour "${classe}" niveau "${niveau}".
OBLIGATOIRE JSON VALIDE SEULEMENT, pas de texte avant/après:
{"titre":"${classe} - ${niveau}","cb":"CB2 Communiquer","palier":"Palier ${niveau}","oa":"OA Maitriser ${classe}","os":"OS Identifier ${classe}","contenu":"${classe}: definition avec exemples Moussa mange une mangue, Aminata achete des beignets","objectif":"Eleve capable d'identifier ${classe}","moyen_materiel":"Tableau, ardoises, corpus 6 phrases","moyen_pedagogique":"Interrogatif, participatif, groupe","documentation":"Guide CEB ${niveau}","demarche":[{"etape":"Revision","activite_maitre":"Rappel sujet verbe","activite_eleves":"Repondent","duree":"5 min","materiel":"Ardoise","exemple":"Le chien aboie"},{"etape":"Motivation","activite_maitre":"Texte support","activite_eleves":"Lis","duree":"5 min","materiel":"Texte","exemple":"Moussa mange une mangue"},{"etape":"Impregnation","activite_maitre":"Question quoi/qui apres verbe pour ${classe}","activite_eleves":"Trouvent ${classe}","duree":"15 min","materiel":"Corpus","exemple":"Mange quoi? mangue=COD"},{"etape":"Evaluation","activite_maitre":"3 phrases a souligner","activite_eleves":"Font","duree":"10 min","materiel":"Cahier","exemple":"Le maitre explique la lecon"}]}`;

    const modeles = ['llama-3.1-8b-instant', 'gemma2-9b-it', 'llama-3.1-70b-versatile'];

    for (const model of modeles) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          temperature: 0.4,
          max_tokens: 2500,
          messages: [
            { role: 'system', content: 'Tu es un générateur de fiches CEB. Tu réponds UNIQUEMENT en JSON valide, sans texte autour.' },
            { role: 'user', content: prompt }
          ]
        })
      });

      const txt = await res.text();
      if (!res.ok) {
        if (txt.includes('decommissioned') || txt.includes('does not exist')) continue;
        // Si erreur d'auth, on arrête et on dit la vraie erreur
        throw new Error(`Groq erreur avec ${model}: ${txt.slice(0, 300)}`);
      }

      const data = JSON.parse(txt);
      let raw = data.choices[0].message.content.replace(/```json|```/g, '').trim();
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
      const fiche = JSON.parse(raw);
      fiche.classe = classe; fiche.niveau = niveau;
      return { statusCode: 200, body: JSON.stringify({ fiche, source_file: `Mirass GROQ ${model} - Gratuit` }) };
    }

    throw new Error('Aucun modèle Groq dispo');

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) throw new Error("GROQ_API_KEY manquante dans Netlify > Environment variables");

    const disc = (body.lecon || body.discipline || body.sujet || body.classe || '').trim() || 'Le COD';
    const niv = (body.niveau || body.niveau_etude || 'CE2').trim();

    // Corpus Mirass intégré pour éviter erreur GitHub quand tu es fatiguée
    const corpus = `
    SOURCE CEB Mirass: 
    - CB EDD CE2: Intégrer des démarches et techniques de recherche [1], des outils d'investigation [2]
    - CB Langue: Intégrer le lexique de base, règles syntaxiques pour produire textes [1]
    - Palier EDD: Décrire milieu, évolution techniques pêche, outils [4,5]
    - Palier Langue CE2: Employer pronoms, Identifier COD/COI, Conjuguer 1er groupe [4]
    - OA: Maîtriser notion précise, Décrire évolution
    - Démarche Mirass Assane: Révision/Rappel, Imprégnation texte support, Analyse 5 questions Au tableau Sur ardoise, Synthèse résumé, Évaluation exercices corrigés
    `;

    const prompt = `Tu es Mirass CEB Sénégal. Crée fiche COMPLÈTE pour "${disc}" niveau "${niv}".

    Corpus Mirass: ${corpus}

    RÈGLES: 
    - CB, Palier, OA, OS viennent de ce corpus, pas inventés
    - Démarche Mirass: Révision 3 questions réelles + réponses, Imprégnation texte support intégral sur "${disc}", Analyse 5 questions précises, Synthèse résumé intégral, Évaluation 2 exos avec corrigés
    - Discipline sacrée: tout sur "${disc}"
    - JSON obligatoire sans undefined avec clés: titre, cb, palier, oa, os, contenu, objectif, moyen_materiel, moyen_pedagogique, documentation, demarche[etape, activite_maitre, activite_eleves, duree, materiel, exemple]
    `;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0.2,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const txt = await res.text();
    if (!res.ok) throw new Error(`Groq ${res.status}: ${txt.slice(0, 400)}`);

    const data = JSON.parse(txt);
    let raw = data.choices[0].message.content.replace(/```json|```/g, '').trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s >= 0 && e > s) raw = raw.slice(s, e + 1);
    let fiche = JSON.parse(raw);

    fiche = {
      titre: fiche.titre || `${disc} (${niv})`,
      cb: fiche.cb || 'CB extrait Mirass',
      palier: fiche.palier || `Palier ${niv}`,
      oa: fiche.oa || `OA ${disc}`,
      os: fiche.os || `Au terme, capable sur ${disc}`,
      contenu: fiche.contenu || `Contenu ${disc}`,
      objectif: fiche.objectif || `Objectif 45min ${disc}`,
      moyen_materiel: fiche.moyen_materiel || 'Tableau, ardoises, manuel',
      moyen_pedagogique: fiche.moyen_pedagogique || 'Observation, interrogation',
      documentation: fiche.documentation || `Guide CEB ${niv}`,
      demarche: fiche.demarche || [],
      classe: disc, niveau: niv
    };

    fiche.demarche = fiche.demarche.map(d => ({
      etape: d.etape || 'Étape', activite_maitre: d.activite_maitre || d.maitre || '-', activite_eleves: d.activite_eleves || d.eleves || '-', duree: d.duree || '5 min', materiel: d.materiel || 'Tableau', exemple: d.exemple || '-'
    }));

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fiche, source_file: 'Mirass Document-Based' }) };

  } catch (e) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message, fiche: null }) };
  }
};

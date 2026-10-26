
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const GROQ_KEY = process.env.GROQ_API_KEY;

    // 1. Correction de l'extraction des variables (Leçon vs Niveau)
    const disc = (body.lecon || body.discipline || body.sujet || body.classe || '').trim() || 'Le COD';
    const niv = (body.niveau || body.niveau_etude || body.classe_niveau || 'CM2').trim();

    // 2. Lecture du repo GitHub Mirass
    let corpus = '';
    let sources = [];
    try {
      const repoRes = await fetch('https://api.github.com/repos/ndiayejoseph123-code/Mirass/contents', { 
        headers: { 'User-Agent': 'Mirass' } 
      });
      const files = await repoRes.json();
      const jsonFiles = files.filter(f => f.name.endsWith('.json')).slice(0, 3);
      for (const file of jsonFiles) {
        const r = await fetch(file.download_url);
        const txt = await r.text();
        corpus += `\n--- SOURCE: ${file.name} ---\n${txt.slice(0, 3000)}\n`;
        sources.push(file.name);
      }
    } catch (e) {
      console.error("Erreur lors de la récupération des fichiers GitHub:", e);
    }

    if (!corpus) {
      corpus = 'Guide CEB Sénégal (APC / Pédagogie de l intégration) - Langue & Communication, ESVS, Maths, EDD.';
    }

    // 3. Prompt optimisé avec consignes de rédaction intégrale
    const prompt = `Tu es un expert reconnu de la pédagogie CEB (Curriculum de l'Éducation de Base) au Sénégal et de la méthode Mirass (Assane Ndiaye).
Ta mission est de rédiger une FICHE PÉDAGOGIQUE COMPLÈTE, CONCRÈTE ET PRÊTE À L'EMPLOI pour la leçon suivante :
- Sujet / Discipline / Leçon : "${disc}"
- Niveau / Classe : "${niv}"

S'appuyer prioritairement sur ces documents CEB du Sénégal :
${corpus.slice(0, 8000)}

DIRECTIVES IMPÉRATIVES :
1. Rédige du contenu RÉEL ET CONCRET. Ne mets AUCUNE consigne abstraite (ne dis pas "Poser 3 questions", mais écris explicitement les questions réelles avec leurs réponses attendues).
2. Pour la phase d'imprégnation : écris le TEXTE SUPPORT INTÉGRAL ou la situation concrète à transcrire au tableau.
3. Pour l'analyse : pose 4 à 5 questions d'analyse précises sur le texte support avec les réponses et manipulations des élèves.
4. Pour la synthèse : rédige le RÉSUMÉ / LA RÈGLE INTÉGRALE à retenir.
5. Pour l'évaluation : propose au moins 2 exercices concrets avec leurs corrigés détaillés.
6. Tous les champs du JSON doivent être renseignés de manière professionnelle, sans "undefined".

Format de réponse : Tu DOIS répondre EXCLUSIVEMENT par un objet JSON valide respectant cette structure exacte :

{
  "titre": "${disc} (${niv})",
  "cb": "Texte exact de la Compétence de Base adaptée au sujet et au niveau ${niv}",
  "palier": "Texte du Palier visé pour ${niv}",
  "oa": "Objectif d'Apprentissage (OA)",
  "os": "Au terme de la leçon, l'élève devra être capable de...",
  "contenu": "Contenu notionnel détaillé et points clés de la leçon",
  "objectif": "Objectif spécifique mesurable de la séance (30 à 45 min)",
  "moyen_materiel": "Tableau noir, craie, ardoises, manuel, corpus de texte support",
  "moyen_pedagogique": "Observation, interrogation, manipulation, travail individuel et de groupe",
  "documentation": "IO Décret 79-1165, Guide pédagogique CEB ${niv}, Manuel ${niv}",
  "demarche": [
    {
      "etape": "Révision / Rappel (5 min)",
      "activite_maitre": "Écris ici les 2 à 3 questions précises de rappel posées par le maître",
      "activite_eleves": "Écris ici les réponses exactes attendues des élèves sur leurs ardoises",
      "duree": "5 min",
      "materiel": "Ardoises",
      "exemple": "Détail concret du rappel"
    },
    {
      "etape": "Imprégnation (5 min)",
      "activite_maitre": "Présente le texte support intégral au tableau : « ... »",
      "activite_eleves": "Lisent silencieusement puis à haute voix le texte",
      "duree": "5 min",
      "materiel": "Texte au tableau",
      "exemple": "Texte support complet sur ${disc}"
    },
    {
      "etape": "Analyse / Découverte (15 min)",
      "activite_maitre": "1. Poser la question X... 2. Demander de manipuler/souligner... 3. Poser la question Y...",
      "activite_eleves": "1. Répondent... 2. Manipulent sur l'ardoise... 3. Constatent...",
      "duree": "15 min",
      "materiel": "Tableau, ardoises",
      "exemple": "Questions et manipulations guidées"
    },
    {
      "etape": "Synthèse / Règle (10 min)",
      "activite_maitre": "Pose les questions de récapitulation et fait élaborer le résumé au tableau",
      "activite_eleves": "Répondent aux questions et recopient le résumé complet dans leurs cahiers",
      "duree": "10 min",
      "materiel": "Cahier de leçons",
      "exemple": "Texte intégral du résumé / de la règle à retenir"
    },
    {
      "etape": "Évaluation (10 min)",
      "activite_maitre": "Propose les exercices d'évaluation suivants : 1... 2...",
      "activite_eleves": "Travaillent individuellement dans les cahiers. Corrigé : 1... 2...",
      "duree": "10 min",
      "materiel": "Cahier d'évaluation",
      "exemple": "Exercices et leurs corrigés"
    }
  ]
}`;

    // 4. Appel API Groq avec response_format json_object
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + GROQ_KEY, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Modèle très performant sur Groq
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' }, // Garantie un JSON valide sans balises Markdown
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const txt = await res.text();
    if (!res.ok) throw new Error(`Erreur API Groq (${res.status}): ${txt.slice(0, 500)}`);

    const data = JSON.parse(txt);
    let rawContent = data.choices[0].message.content;
    let fiche = JSON.parse(rawContent);

    // 5. Sécurisation et nettoyage de l'objet fiche
    fiche = {
      titre: fiche.titre || `${disc} - ${niv}`,
      cb: fiche.cb || `Compétence de base ${niv}`,
      palier: fiche.palier || `Palier ${niv}`,
      oa: fiche.oa || `OA ${disc}`,
      os: fiche.os || `Au terme de la séance, l'élève sera capable de maîtriser ${disc}`,
      contenu: fiche.contenu || `Contenu sur ${disc}`,
      objectif: fiche.objectif || `Objectif de séance sur ${disc}`,
      moyen_materiel: fiche.moyen_materiel || 'Tableau, ardoises, manuel',
      moyen_pedagogique: fiche.moyen_pedagogique || 'Interrogatif, observation',
      documentation: fiche.documentation || `Guide CEB ${niv}`,
      demarche: Array.isArray(fiche.demarche) ? fiche.demarche : [],
      discipline: disc,
      niveau: niv
    };

    fiche.demarche = fiche.demarche.map(d => ({
      etape: d.etape || 'Étape',
      activite_maitre: d.activite_maitre || d.maitre || 'Activité maître',
      activite_eleves: d.activite_eleves || d.eleves || 'Activité élèves',
      duree: d.duree || '5 min',
      materiel: d.materiel || 'Tableau',
      exemple: d.exemple || `Exemple sur ${disc}`
    }));

    return { 
      statusCode: 200, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fiche, source_file: sources.join(', ') || 'Mirass' }) 
    };

  } catch (e) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: e.message }) 
    };
  }
};
```

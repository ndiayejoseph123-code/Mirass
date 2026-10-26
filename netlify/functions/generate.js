exports.handler = async (event) => {
  try {
    const KEY = process.env.GROQ_API_KEY;
    if (!KEY) throw new Error('GROQ_API_KEY manquante');

    // Demande à Groq quels modèles existent vraiment
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': 'Bearer ' + KEY }
    });

    const txt = await res.text();
    if (!res.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: `GROQ LISTE ERREUR ${res.status}: ${txt}` }) };
    }

    const data = JSON.parse(txt);
    const modeles = data.data.map(m => m.id).join(', ');

    // Teste le premier modèle de la liste
    const premierModele = data.data[0]?.id || 'llama-3.3-70b-versatile';
    
    const testRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: premierModele,
        messages: [{ role: 'user', content: 'Dis bonjour en 5 mots' }],
        max_tokens: 20
      })
    });

    const testTxt = await testRes.text();

    return {
      statusCode: 200,
      body: JSON.stringify({
        fiche: {
          titre: `MODELES DISPONIBLES CHEZ TOI`,
          cb: modeles,
          palier: `Premier modele testé: ${premierModele}`,
          oa: `Test Groq: ${testTxt.slice(0, 500)}`,
          os: 'Copie cette liste et envoie la moi',
          contenu: `Ta clé gsk_qRkH... marche. Voici tous les modeles Groq dispo aujourd'hui`,
          objectif: 'On va utiliser le premier modele qui marche',
          moyen_materiel: modeles,
          moyen_pedagogique: 'Test auto',
          documentation: 'console.groq.com/docs',
          demarche: []
        },
        source_file: `Liste modeles Groq`
      })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ERREUR: ' + e.message }) };
  }
};

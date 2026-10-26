```javascript
const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "llama3-70b-8192",
  "llama3-8b-8192"
];

const SYSTEM_PROMPT = `Tu es un assistant pédagogique expert du Curriculum de l'Éducation de Base (CEB) du Sénégal (niveau CE2).

Ta tâche est de générer des fiches pédagogiques complètes, rigoureuses et conformes au canevas officiel du CEB.

CONSIGNES STRICTES DE FORMATAGE :
Tu dois IMPÉRATIVEMENT structurer l'intégralité de ta réponse en utilisant exactement les balises suivantes (sans aucun texte d'introduction ni de conclusion) :

#CLASSE: <Classe>
#DUREE: <Durée>
#DISCIPLINE: <Discipline>
#CB: <Compétence de base>
#PALIER: <Palier>
#SOUS_DOMAINE: <Sous-domaine>
#OA: <Objectif d'Apprentissage>
#OS: <Objectif Spécifique>
#CONTENUS: <Contenus de la leçon>
#MOYENS_MATERIELS: <Moyens matériels>
#MOYENS_PEDAGOGIQUES: <Moyens pédagogiques>
#DOCUMENTATION: <Documentation de référence>
#ETAPE1_TITRE: <Titre Étape 1>
#ETAPE1_MAITRE: <Activités du maître>
#ETAPE1_ELEVES: <Activités des élèves>
#ETAPE2_TITRE: <Titre Étape 2>
#ETAPE2_MAITRE: <Activités du maître>
#ETAPE2_ELEVES: <Activités des élèves>
#ETAPE3_TITRE: <Titre Étape 3>
#ETAPE3_MAITRE: <Activités du maître>
#ETAPE3_ELEVES: <Activités des élèves>
#ETAPE4_TITRE: <Titre Étape 4>
#ETAPE4_MAITRE: <Activités du maître>
#ETAPE4_ELEVES: <Activités des élèves>
#ETAPE5_TITRE: <Titre Étape 5>
#ETAPE5_MAITRE: <Activités du maître>
#ETAPE5_ELEVES: <Activités des élèves>`;

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  const reply = (code, obj) => ({ statusCode: code, headers, body: JSON.stringify(obj) });

  if (event.httpMethod !== "POST") return reply(405, { error: "Méthode non autorisée" });
  if (!process.env.GROQ_API_KEY) return reply(500, { error: "Clé GROQ_API_KEY absente dans Netlify" });

  let userPrompt = "";
  try {
    userPrompt = String(JSON.parse(event.body || "{}").prompt || "").slice(0, 20000);
  } catch (e) {
    return reply(400, { error: "Requête invalide" });
  }
  if (!userPrompt) return reply(400, { error: "Prompt vide" });

  const list = process.env.GROQ_MODEL ? [process.env.GROQ_MODEL, ...MODELS] : MODELS;
  let lastError = "Aucun modèle n'a pu répondre";

  for (const model of list) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.GROQ_API_KEY
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 4000
        })
      });

      const data = await res.json();

      if (res.ok) {
        const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (text) return reply(200, { text, model });
        lastError = "Réponse vide [" + model + "]";
        continue;
      }

      lastError = ((data.error && data.error.message) || "Erreur HTTP " + res.status) + " [" + model + "]";
      // On continue systématiquement vers le modèle suivant en cas d'erreur
      continue;
    } catch (e) {
      lastError = e.message + " [" + model + "]";
      continue;
    }
  }

  return reply(502, { error: "Échec sur tous les modèles Groq. Dernière erreur : " + lastError });
};
```

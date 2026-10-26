exports.handler = async (event) => {
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const GROQ_KEY = process.env.GROQ_API_KEY;
    const discipline = classe.trim();
    const niveauLower = niveau.toLowerCase();
    
    // 1. FETCH TON REPO MIRASS GITHUB
    const repoRes = await fetch('https://api.github.com/repos/ndiayejoseph123-code/Mirass/contents', {
      headers: { 'User-Agent': 'Mirass-CEB' }
    });
    if (!repoRes.ok) throw new Error('Impossible de lire ton repo Mirass 【entity-GitHub¦canonical_name=GitHub】');
    const files = await repoRes.json();
    
    const jsonFiles = files.filter(f => f.name.endsWith('.json') && f.type === 'file');
    
    // Filtre intelligent: si tu tapes COD CE2, on prend les fichiers CE2 + Langue en priorité
    const prioritaires = jsonFiles.filter(f => {
      const n = f.name.toLowerCase();
      return n.includes(niveauLower) || n.includes(discipline.toLowerCase().slice(0, 3)) || n.includes('ceb') || n.includes('langue');
    });
    const aCharger = (prioritaires.length > 0 ? prioritaires : jsonFiles).slice(0, 3);
    
    let corpus = '';
    for (const file of aCharger) {
      try {
        const rawRes = await fetch(file.download_url);
        const content = await rawRes.text();
        corpus += `\n--- FICHIER: ${file.name} ---\n${content.slice(0, 3000)}\n`;
      } catch {}
    }
    
    if (!corpus) throw new Error('Aucun JSON Mirass trouvé');
    corpus = corpus.slice(0, 12000); // Limite pour Groq

    const model = 'openai/gpt-oss-120b';

    const prompt = `
Tu es Mirass, générateur de fiches CEB sénégalais. Tu DOIS t'appuyer sur les DOCUMENTS fournis, pas inventer.

DOCUMENTS MIRASS (source unique obligatoire):
${corpus}

MISSION:
L'utilisateur demande: "${discipline}" niveau "${niveau}"

REGLES STRICTES ANTI-INVENTION:
1. CB, PALIER, OA, OS: Tu dois EXTRAIRE ou COPIER des documents ci-dessus. Si tu trouves CB2 dans CEB_etape3_langue.json, utilise CB2. Si tu trouves Palier 2 dans CE2, utilise Palier 2. N'INVENTE PAS de CB, Palier, OA, OS. Si non trouvé pour "${discipline}", prends le plus proche du même domaine (ex: Langue et Communication) et adapte le libellé mais garde la structure CEB de tes documents.
2. CONTENU, MOYEN MATERIEL, DOCUMENTATION: Inspire-toi de la structure de tes JSON, pas d'invention hors CEB.
3. DEMARCHE: Tu dois RESPECTER LA DEMARCHE MIRASS de tes fichiers: Révision, Motivation/Situation, Imprégnation/Analyse, Fixation/Synthèse, Evaluation. Comme dans CB_EDD_ce2.json et CEB_etape3_langue.json. 2 colonnes Part du Maître / Part des Élèves, avec consignes "Au tableau, Sur ardoise", texte support entre guillemets.
4. DISCIPLINE SACRÉE: Si l'utilisateur tape "${discipline}", toute la fiche parle de "${discipline}". Ne mélange pas avec COD ou Empire du Mali si ce n'est pas demandé.
5. INTELLIGENCE: Si "${discipline}" = "La pêche hier et aujourd'hui", tu crées une fiche sur l'évolution de la pêche en t'appuyant sur la démarche EDD de tes documents, mais avec contenu pêche.

Sors UNIQUEMENT ce JSON:
{
  "titre": "${discipline} - ${niveau}",
  "cb": "Extrait de tes documents...",
  "palier": "Extrait de tes documents...",
  "oa": "Extrait de tes documents...",
  "os": "Au terme... capable de... (extrait/adapté de tes documents)",
  "contenu": "Contenu détaillé sur ${discipline} inspiré de la structure de tes JSON",
  "moyen_materiel": "Matériel extrait de tes documents + adapté à ${discipline}",
  "moyen_pedagogique": "Méthodes de tes documents",
  "documentation": "IO Décret 79-1165, Guide CEB ${niveau}, Manuel... (comme dans tes JSON)",
  "source_fichiers": "${aCharger.map(f=>f.name).join(', ')}",
  "demarche": [
    {"etape":"Révision (5min)","maitre":"...","eleves":"...","exemple":"..."},
    {"etape":"Motivation (5min)","maitre":"...","eleves":"...","exemple":"..."},
    {"etape":"Imprégnation/Analyse (15min)","maitre":"Texte support: « ... » + questions","eleves":"...","exemple":"Texte + questions"},
    {"etape":"Synthèse (10min)","maitre":"...","eleves":"...","exemple":"..."},
    {"etape":"Evaluation (10min)","maitre":"...3 exercices...","eleves":"...","exemple":"...avec corrigé"}
  ]
}
`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        temperature: 0.3,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const txt = await res.text();
    if (!res.ok) throw new Error(txt.slice(0, 600));

    const data = JSON.parse(txt);
    let raw = data.choices[0].message.content;
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s >= 0 && e > s) raw = raw.slice(s, e + 1);
    raw = raw.replace(/```json|```/g, '').trim();

    const fiche = JSON.parse(raw);
    fiche.classe = discipline;
    fiche.niveau = niveau;

    return { statusCode: 200, body: JSON.stringify({ fiche, source_file: `Mirass Docs: ${fiche.source_fichiers || aCharger.map(f=>f.name).join(', ')}` }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

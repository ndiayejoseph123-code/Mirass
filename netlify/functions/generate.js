exports.handler = async (event) => {
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const KEY = process.env.MISTRAL_API_KEY;
    if(!KEY) return {statusCode:500, body:JSON.stringify({error:'Ajoute MISTRAL_API_KEY dans Netlify > Environment variables'})};

    const gh = await fetch('https://api.github.com/repos/ndiayejoseph123-code/Mirass/contents',{headers:{'User-Agent':'Mirass-RAG'}});
    const files = await gh.json();
    const jsonFiles = files.filter(f=>f.name.endsWith('.json'));
    const allDocs = await Promise.all(jsonFiles.map(async f=>{
      try{ const r=await fetch(f.download_url); return {name:f.name, content:await r.text()}; }catch{return null}
    }));
    const docs = allDocs.filter(Boolean);
    let corpus = docs.map(d=>`--- ${d.name} ---\n${d.content.slice(0,6000)}`).join('\n');
    if(corpus.length>25000) corpus=corpus.slice(0,25000);

    const systemPrompt = `Tu es Mirass intelligent, expert CEB sénégalais. Tu lis TOUS les JSON fournis, tu extrais la démarche type, et tu l'appliques à la nouvelle leçon demandée. Tu peux créer n'importe quelle fiche (même si elle n'existe pas) en restant fidèle à la démarche Mirass. Ne hallucine pas la forme. Sors JSON: {titre,classe,niveau,source_files_utilises:[],demarche_reference,objectif,competences,demarche:[{etape,activite_maitre,activite_eleves,duree,materiel}]}`;

    const mistral = await fetch('https://api.mistral.ai/v1/chat/completions',{
      method:'POST',
      headers:{'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'mistral-small-latest', temperature:0.2,
        response_format:{type:'json_object'},
        messages:[
          {role:'system',content:systemPrompt},
          {role:'user',content:`Demande: Classe=${classe} Niveau=${niveau} CORPUS MIRASS: ${corpus}`}
        ]
      })
    });
    if(mistral.status===429) return {statusCode:429, body:JSON.stringify({error:'Rate limit Mistral, réessaie 20s'})};
    if(!mistral.ok) throw new Error(await mistral.text());
    const data=await mistral.json();
    const fiche=JSON.parse(data.choices[0].message.content);
    return {statusCode:200, body:JSON.stringify({fiche, source_file: fiche.demarche_reference||'Mirass'})};
  } catch(e){
    return {statusCode:500, body:JSON.stringify({error:e.message})};
  }
};

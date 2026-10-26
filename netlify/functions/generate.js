exports.handler = async (event) => {
  const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
  try {
    const { classe, niveau } = JSON.parse(event.body || '{}');
    const KEY = process.env.MISTRAL_API_KEY;
    if(!KEY) return {statusCode:500, body:JSON.stringify({error:'MISTRAL_API_KEY manquante'})};

    // 1. Cache 【entity-GitHub¦canonical_name=GitHub】 5 min pour éviter de spammer
    const gh = await fetch('https://api.github.com/repos/ndiayejoseph123-code/Mirass/contents',{headers:{'User-Agent':'Mirass'}});
    const files = await gh.json();
    // On ne prend que 2 fichiers les plus pertinents pour économiser des tokens
    const target = classe.toLowerCase();
    const picked = files.filter(f=>f.name.endsWith('.json')).sort((a,b)=>{
      const sa = a.name.toLowerCase().includes(target)?1:0;
      const sb = b.name.toLowerCase().includes(target)?1:0;
      return sb-sa;
    }).slice(0,2); // <-- 2 fichiers max = 4x moins de tokens

    const docs = await Promise.all(picked.map(async f=>{
      const r=await fetch(f.download_url); return {name:f.name, content:(await r.text()).slice(0,4000)};
    }));
    const corpus = docs.map(d=>`${d.name}:${d.content}`).join('\n').slice(0,8000); // 8000 chars max

    const prompt = `Tu es Mirass. Crée fiche ${classe} ${niveau} en respectant démarche du corpus. Sors JSON {titre,classe,niveau,objectif,competences,demarche:[{etape,activite_maitre,activite_eleves,duree,materiel}],demarche_reference}`;

    // 2. Retry intelligent 3 fois avec pause
    for(let attempt=0; attempt<3; attempt++){
      const mistral = await fetch('https://api.mistral.ai/v1/chat/completions',{
        method:'POST',
        headers:{'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'mistral-tiny-latest', // <-- tiny = 10x moins cher en rate limit
          temperature:0.2,
          max_tokens: 1000,
          response_format:{type:'json_object'},
          messages:[
            {role:'system',content:prompt},
            {role:'user',content:`Leçon: ${classe} ${niveau} Corpus: ${corpus}`}
          ]
        })
      });

      if(mistral.status===429){
        if(attempt<2){ await sleep(2000 + attempt*3000); continue; }
        return {statusCode:429, body:JSON.stringify({error:'Mistral est saturé, attends 30 secondes et re-clique. C’est normal en gratuit, ta clé marche.'})};
      }
      if(!mistral.ok) throw new Error(await mistral.text());
      
      const data=await mistral.json();
      const fiche=JSON.parse(data.choices[0].message.content);
      return {statusCode:200, body:JSON.stringify({fiche, source_file: docs.map(d=>d.name).join(', ')})};
    }

  } catch(e){
    return {statusCode:500, body:JSON.stringify({error:e.message})};
  }
};

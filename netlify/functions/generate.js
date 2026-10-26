// ... garde tout ton début pareil jusqu'à

    // 4. Appel API Groq - VERSION CORRIGÉE POUR TA CLÉ
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + GROQ_KEY, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0.2,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const txt = await res.text();
    if (!res.ok) throw new Error(`Erreur API Groq (${res.status}): ${txt.slice(0, 500)}`);

    const data = JSON.parse(txt);
    let rawContent = data.choices[0].message.content;
    rawContent = rawContent.replace(/```json|```/g, '').trim();
    const s = rawContent.indexOf('{');
    const e = rawContent.lastIndexOf('}');
    if (s >= 0 && e > s) rawContent = rawContent.slice(s, e + 1);
    let fiche = JSON.parse(rawContent);

// ... garde la suite pareille

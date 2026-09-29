// Opt-in integration test; credentials stay in memory and are never logged.
const fs=require('node:fs');
const path=require('node:path');
const v=require('../web/js/vision-core.js');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const lines=fs.readFileSync(path.join(root,'api-key.txt'),'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const endpoint=lines.find(x=>/^https:\/\//.test(x));
 const key=lines.find(x=>/^sk-/.test(x));
 const model=lines.find(x=>/^deepseek-/.test(x));
 if(!endpoint||!key||!model)throw Error('Test configuration fields missing');
 const image='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'artifacts/vision-apple.jpg')).toString('base64');
 const response=await fetch(v.endpoint(endpoint),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(v.request(model,image)),signal:AbortSignal.timeout(120000),redirect:'error'});
 if(!response.ok)throw Error('HTTP '+response.status);
 const parsed=v.parse(await response.text());
 const report={date:new Date().toISOString(),status:response.status,...parsed};
 fs.writeFileSync(path.join(root,'artifacts/vision-smoke-result.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
})().catch(e=>{console.error('Vision smoke failed: '+e.message);process.exitCode=1});

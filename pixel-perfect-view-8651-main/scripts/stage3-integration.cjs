const assert = require('node:assert/strict');
const { createApiClient, ApiError } = require('../.stage3-test-build/http-client.js');
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('PASS '+name); }
(async () => {
 const client=createApiClient(process.env.APPLYPILOT_API_URL || 'http://127.0.0.1:18083');
 const ids=[];
 try {
  await check('404 becomes missing record', async()=>assert.equal(await client.getApplication('stage3-missing'),null));
  let app;
  await check('create and normalize nullable fields',async()=>{ app=await client.createApplication({company:'Stage 3 QA '+Date.now(),role:'Engineer',status:'Applied',appliedOn:'2026-10-12',notes:''}); ids.push(app.id); assert.equal(app.jobUrl,undefined); assert.equal(app.timeline[0].status,'Applied'); });
  await check('new client sees saved record',async()=>assert.equal((await createApiClient('http://127.0.0.1:18083').getApplication(app.id)).company,app.company));
  await check('edit and timeline persist',async()=>{ const a=await client.updateApplication(app.id,{status:'Interview',notes:'Persistent QA note',interviewDate:'2026-10-20'}); assert.equal(a.notes,'Persistent QA note'); assert.ok(a.timeline.some(t=>t.type==='status')); });
  await check('clear optional date',async()=>assert.equal((await client.updateApplication(app.id,{interviewDate:''})).interviewDate,undefined));
  await check('validation errors reach client',async()=>assert.rejects(client.updateApplication(app.id,{company:''}),e=>e.status===422 && /company/.test(e.message)));
  const input={email:{subject:'Stage 3 QA '+Date.now(),body:'Application received for the Engineer role.'},fields:{company:app.company,role:'Engineer',status:'Applied'},targetApplicationId:app.id};
  await check('reviewed import saves to existing record',async()=>assert.equal((await client.saveImport(input)).sourceEmails.length,1));
  await check('duplicate save returns 409',async()=>assert.rejects(client.saveImport(input),e=>e.status===409));
  await check('delete handles empty 204',async()=>{await client.deleteApplication(app.id); assert.equal(await client.getApplication(app.id),null); ids.splice(ids.indexOf(app.id),1);});
  await check('unreachable server produces useful message',async()=>assert.rejects(createApiClient('',async()=>{throw new TypeError('network');}).listApplications(), /Cannot reach the backend/));
  await check('503 remains an error, not missing record',async()=>assert.rejects(createApiClient('',async()=>new Response(JSON.stringify({error:{message:'Database unavailable'}}),{status:503})).getApplication('x'),e=>e.status===503));
  await check('malformed response gives readable error',async()=>assert.rejects(createApiClient('',async()=>new Response('not json',{status:200})).listApplications(), /unreadable response/));
  console.log(`${passed} Stage 3 integration/client checks passed.`);
 } finally { for (const id of ids) await client.deleteApplication(id); }
})().catch(e=>{console.error(e);process.exitCode=1;});

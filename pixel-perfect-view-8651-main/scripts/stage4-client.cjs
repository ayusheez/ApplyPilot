const assert=require('node:assert/strict');
const {createApiClient}=require('../.stage3-test-build/http-client.js');
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
(async()=>{
 await test('requests include session credentials',async()=>{let init;const c=createApiClient('http://localhost:18083',async(_,i)=>{init=i;return json([]);});await c.listApplications();assert.equal(init.credentials,'include');});
 await test('missing optional fields normalized',async()=>{const c=createApiClient('',async()=>json({id:'1',jobUrl:null,timeline:[],sourceEmails:[]}));assert.equal((await c.getApplication('1')).jobUrl,undefined);});
 await test('401 does not become a missing record',async()=>assert.rejects(createApiClient('',async()=>json({error:{message:'Sign in'}},401)).getApplication('x'),e=>e.status===401));
 await test('404 becomes missing record',async()=>assert.equal(await createApiClient('',async()=>json({},404)).getApplication('x'),null));
 await test('network failure has useful message',async()=>assert.rejects(createApiClient('',async()=>{throw new TypeError('offline');}).listApplications(),/Cannot reach/));
 await test('validation message surfaced',async()=>assert.rejects(createApiClient('',async()=>json({error:{fields:[{field:'body.company',message:'required'}]}},422)).createApplication({}),/company: required/));
 await test('204 delete handled without JSON',async()=>assert.equal(await createApiClient('',async()=>new Response(null,{status:204})).deleteApplication('x'),undefined));
 await test('patch uses PATCH and JSON',async()=>{let init;const c=createApiClient('',async(_,i)=>{init=i;return json({id:'x'});});await c.updateApplication('x',{notes:'test'});assert.equal(init.method,'PATCH');assert.equal(JSON.parse(init.body).notes,'test');});
 console.log(`${passed} Stage 4 client checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});

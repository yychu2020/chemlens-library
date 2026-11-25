import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {get} from 'node:http';
import {startLocalServer} from './server.mjs';
const dataDir=await mkdtemp(join(tmpdir(),'chemlens-portable-test-'));
const nativeFetch=globalThis.fetch;let sentHTML='',draftCalls=0;
globalThis.fetch=async(u,o)=>{
 const url=new URL(u instanceof Request?u.url:u);
 if(url.hostname!=='api.weixin.qq.com')return nativeFetch(u,o);
 if(url.pathname.endsWith('stable_token'))return Response.json({access_token:'qa-token'});
 if(url.pathname.endsWith('draft/count'))return Response.json({total_count:0});
 if(url.pathname.endsWith('uploadimg'))return Response.json({url:'https://mmbiz.qpic.cn/qa-image'});
 if(url.pathname.endsWith('add_material'))return Response.json({media_id:'qa-cover'});
 if(url.pathname.endsWith('draft/add')){draftCalls++;sentHTML=JSON.parse(o.body).articles[0].content;return Response.json({media_id:'qa-draft'});}
 throw Error('Unexpected mocked WeChat request');
};
test('portable service protects identity, persists settings, restores scoped data and sends styled WeChat HTML',async()=>{
 let app=await startLocalServer({port:0,dataDir}),cookie='';
 const call=(p,{method='GET',body,headers={}}={})=>nativeFetch(app.origin+p,{method,headers:{Cookie:cookie,...(method!=='GET'?{Origin:app.origin,'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await call('/api/status')).status,401);
  const home=await call('/');assert.equal(home.status,200);cookie=home.headers.get('set-cookie').split(';')[0];assert.match(home.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const info=await(await call('/api/status')).json();assert.equal(info.authenticated,true);assert.equal(info.isCatalogAdmin,true);assert.equal(info.aiEnabled,false);
  const wrongHost=await new Promise((ok,no)=>get(app.origin+'/api/status',{headers:{Host:'evil.invalid',Cookie:cookie}},r=>{r.resume();ok(r.statusCode);}).on('error',no));assert.equal(wrongHost,403);
  assert.equal((await call('/api/status',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await call('/api/wechat/account',{method:'PUT',headers:{Origin:'https://evil.invalid'},body:{}})).status,403);
  assert.equal((await call('/local/server.mjs')).status,404);assert.equal((await call('/local/config.json')).status,404);
  const forged=await(await call('/api/status',{headers:{'x-chemlens-local-scope':'a'.repeat(40),'oai-authenticated-user-id':'forged'}})).json();assert.equal(forged.userStorageKey,info.userStorageKey);
  const initialMetadata=join(dataDir,'objects/private',info.userStorageKey,'bibliography');await mkdir(initialMetadata,{recursive:true});await writeFile(join(initialMetadata,'seed.json'),JSON.stringify({paperId:'example',isOA:true}));
  const scope='b'.repeat(40),bind=await call('/local/config',{method:'POST',body:{scope}});assert.equal(bind.status,200);assert.equal((await(await call('/api/status')).json()).userStorageKey,scope);assert.equal(JSON.parse(await readFile(join(dataDir,'objects/private',scope,'bibliography/seed.json'),'utf8')).isOA,true);
  await call('/local/config',{method:'POST',body:{provider:'zhipu',model:'glm-4.6v',key:'fake-qa-model-key'}});assert.equal((await(await call('/local/config')).json()).hasAIKey,true);
  await call('/local/config',{method:'POST',body:{provider:'openai',model:'',key:''}});assert.equal((await(await call('/local/config')).json()).hasAIKey,false,'switching provider must not reuse a different provider key');
  const account=await call('/api/wechat/account',{method:'PUT',body:{name:'QA公众号',appid:'wx1234567890abcdef',secret:'test-secret-not-real',author:'QA'}});assert.equal(account.status,200,await account.clone().text());const savedAccount=await account.json();assert.equal(savedAccount.configured,true);assert.equal(JSON.stringify(savedAccount).includes('test-secret-not-real'),false);
  assert.equal((await call('/api/wechat/test',{method:'POST',body:{}})).status,200);
  assert.equal((await call('/local/config',{method:'POST',body:{scope:'c'.repeat(40)}})).status,409);
  const stored=await readFile(join(dataDir,'objects/private',scope,'wechat/account.json'),'utf8');assert.equal(stored.includes('test-secret-not-real'),false);
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhL0AAAAASUVORK5CYII=';
  const payload={requestId:crypto.randomUUID(),title:'Nat. Chem. | 测试',digest:'测试摘要',author:'QA',cover:png,images:[{id:'figure1',dataURL:png}],blocks:[{type:'heading',level:1,text:'测试文章'},{type:'heading',level:2,text:'科学问题'},{type:'paragraph',text:'说明和化学式 H₂O。'},{type:'image',url:'figure1',text:'中文图注'}]};
  let result;for(let i=0;i<8;i++){const r=await call('/api/wechat/draft-step',{method:'POST',body:payload});assert.ok(r.ok,await r.clone().text());result=await r.json();if(result.mediaId||result.media_id||result.imported||result.status==='completed')break;}
  assert.equal(draftCalls,1);assert.match(sentHTML,/<h2 style=/);assert.match(sentHTML,/color:#174b7e/);assert.ok(!sentHTML.includes('data:image'));
  await call('/api/wechat/draft-step',{method:'POST',body:payload});assert.equal(draftCalls,1,'idempotency prevents duplicate draft');
  const snapshot={id:crypto.randomUUID(),createdAt:new Date().toISOString(),state:{version:5,papers:[],figures:[],methods:[],notes:[]}},raw=JSON.stringify(snapshot),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)),sha=Buffer.from(hash).toString('hex');
  const restored=await call('/api/workspace-backup/file?key=workspace-state/snapshot.json',{method:'PUT',body:raw,headers:{'X-Backup-Scope':scope,'X-Backup-SHA256':sha,'X-Backup-Overwrite':'false'}});assert.equal(restored.status,200,await restored.clone().text());
  assert.equal((await(await call('/api/workspace-snapshot')).json()).snapshot.id,snapshot.id);
  await app.close();app=await startLocalServer({port:0,dataDir});
  const reopened=await(await call('/api/wechat/account')).json();assert.equal(reopened.account.appid,'wx1234567890abcdef');assert.equal((await(await call('/api/status')).json()).userStorageKey,scope);
  console.log('Verified loopback/Host/Origin/session guards, scope isolation, encrypted account persistence, backup restoration, styled draft payload and duplicate protection.');
 }finally{await app.close();globalThis.fetch=nativeFetch;assert.ok(dataDir.startsWith(join(tmpdir(),'chemlens-portable-test-')));await rm(dataDir,{recursive:true,force:true});}
});
test('two local services keep request scopes separate and ignore forged caller identity headers',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'chemlens-local-isolation-'));
 const a=await startLocalServer({port:0,dataDir:join(directory,'a')}),b=await startLocalServer({port:0,dataDir:join(directory,'b')});
 try{
  const ah=await nativeFetch(a.origin+'/'),bh=await nativeFetch(b.origin+'/'),ac=ah.headers.get('set-cookie').split(';')[0],bc=bh.headers.get('set-cookie').split(';')[0];
  const get=(app,cookie,path='/api/status')=>nativeFetch(app.origin+path,{headers:{Cookie:cookie,'x-chemlens-local-scope':'f'.repeat(40),'oai-authenticated-user-id':'forged'}}).then(r=>r.json());
  const ai=await get(a,ac),bi=await get(b,bc);assert.notEqual(ai.userStorageKey,bi.userStorageKey);assert.notEqual(ai.userStorageKey,'f'.repeat(40));
  const rows=await Promise.all(Array.from({length:12},(_,i)=>i%2?get(a,ac):get(b,bc)));for(let i=0;i<rows.length;i++)assert.equal(rows[i].userStorageKey,i%2?ai.userStorageKey:bi.userStorageKey);
  const value={id:'isolation-qa',state:{papers:[],figures:[],methods:[],notes:[{id:'one',text:'Local test only'}]}},raw=JSON.stringify(value),sha=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))).toString('hex');
  const written=await nativeFetch(a.origin+'/api/workspace-backup/file?key=workspace-state/snapshot.json',{method:'PUT',headers:{Cookie:ac,Origin:a.origin,'X-Backup-Scope':ai.userStorageKey,'X-Backup-SHA256':sha},body:raw});assert.equal(written.status,200);
  assert.equal((await get(a,ac,'/api/workspace-snapshot')).snapshot.id,value.id);assert.equal((await get(b,bc,'/api/workspace-snapshot')).snapshot,null);
 }finally{await a.close();await b.close();assert.ok(directory.startsWith(join(tmpdir(),'chemlens-local-isolation-')));await rm(directory,{recursive:true,force:true});}
});

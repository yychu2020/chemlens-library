import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat,readdir,rename} from 'node:fs/promises';
import {resolve,join,dirname,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createBucket} from './storage.mjs';
import {handleApi,handleCatalog,runInLocalScope} from './api.mjs';
import {seed} from '../workbench/data.js';
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),workbench=join(root,'workbench');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.pdf':'application/pdf','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.bcmap':'application/octet-stream','.ttf':'font/ttf'};
const token=()=>randomBytes(32).toString('hex');
const equal=(a,b)=>typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const cookies=h=>Object.fromEntries((h||'').split(';').map(x=>x.trim().split('=')));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function startLocalServer({port=4188,dataDir=process.env.CHEMLENS_LOCAL_DATA||join(process.env.LOCALAPPDATA||process.env.HOME||root,'ChemLens'),openBrowser=false}={}){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('请安装 Node.js 22 或更新的 LTS 版本。');
 dataDir=resolve(dataDir);await mkdir(dataDir,{recursive:true,mode:0o700});
 const configPath=join(dataDir,'config.json'),objects=join(dataDir,'objects');let config;
 try{config=JSON.parse(await readFile(configPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('本机设置文件损坏，请从硬盘备份恢复。');config={version:1,scope:token().slice(0,40),encryptionKey:token(),sessionKey:token(),ai:{}};await writeFile(configPath,JSON.stringify(config),{mode:0o600});}
 if(!/^[a-f0-9]{40}$/.test(config.scope)||!config.encryptionKey||!config.sessionKey)throw Error('本机设置文件无效。');
 const save=async()=>{const temp=configPath+'.tmp';await writeFile(temp,JSON.stringify(config),{mode:0o600});await rename(temp,configPath);};
 const bucket=createBucket(objects),pending=new Set();let origin;
 const server=createServer(async(req,res)=>{
  const finish=async response=>{res.writeHead(response.status,{'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY',...Object.fromEntries(response.headers)});res.end(Buffer.from(await response.arrayBuffer()));};
  const json=(v,status=200)=>finish(Response.json(v,{status,headers:{'Cache-Control':'no-store'}}));
  try{
   // Bind only loopback, and reject DNS rebinding, cross-origin forms and forged identity.
   if(req.headers.host!==new URL(origin).host)return json({error:{message:'本机服务不接受这个主机地址。'}},403);
   const url=new URL(req.url,origin),requestOrigin=req.headers.origin;
   if(requestOrigin&&requestOrigin!==origin||req.headers['sec-fetch-site']==='cross-site'&&url.pathname!=='/')return json({error:{message:'本机服务仅接受本机工作台的请求。'}},403);
   const authenticated=equal(cookies(req.headers.cookie).chemlens_local,config.sessionKey);
   const homepage=url.pathname==='/'&&req.method==='GET';
   if(homepage&&!authenticated)res.setHeader('Set-Cookie',`chemlens_local=${config.sessionKey}; HttpOnly; SameSite=Strict; Path=/`);
   if(!authenticated&&!homepage)return json({error:{message:'请从本机工作台首页打开。'}},401);
   if(!['GET','HEAD'].includes(req.method)&&requestOrigin!==origin)return json({error:{message:'修改请求必须从本机工作台发起。'}},403);
   const chunks=[];let size=0;
   if(!['GET','HEAD'].includes(req.method))for await(const chunk of req){size+=chunk.length;if(size>40*1024*1024)return json({error:{message:'上传超过40MiB。'}},413);chunks.push(chunk);}
   const body=Buffer.concat(chunks);
   if(url.pathname==='/local/config'&&req.method==='GET')return json({scope:config.scope,dataDir,provider:config.ai?.provider||'zhipu',model:config.ai?.model||'',hasAIKey:!!config.ai?.key});
   if(url.pathname==='/local/config'&&req.method==='POST'){
    if(size>10000)return json({error:{message:'设置过长。'}},400);const v=JSON.parse(body);
    if(v.scope&&v.scope!==config.scope){
     if(!/^[a-f0-9]{40}$/.test(v.scope))return json({error:{message:'备份账号标识无效。'}},400);
     const entries=(await bucket.list({limit:30000})).objects,prefix=`private/${config.scope}/bibliography/`;
     if(config.scopeBound||entries.some(x=>!x.key.startsWith(prefix)))return json({error:{message:'本机已保存资料，不能再切换账号标识。请使用一个新的本机资料目录。'}},409);
     // Initial reading may populate OA/date metadata. Retain those records when adopting the backup scope.
     for(const item of entries){const object=await bucket.get(item.key);await bucket.put(`private/${v.scope}/bibliography/`+item.key.slice(prefix.length),await object.text());}
     config.scope=v.scope;config.scopeBound=true;
    }
    if(v.provider!==undefined){if(!['zhipu','openai'].includes(v.provider)||typeof v.model!=='string'||v.model.length>100||typeof v.key!=='string'||v.key.length>1000)return json({error:{message:'模型设置无效。'}},400);config.ai={provider:v.provider,model:v.model.trim(),key:v.key.trim()||(config.ai?.provider===v.provider?config.ai?.key||'':'')};}
    await save();return json({saved:true,scope:config.scope});
   }
   if(url.pathname==='/local/setup'||homepage&&url.searchParams.get('setup')==='1')return finish(new Response(await readFile(join(root,'local/setup.html')),{headers:{'Content-Type':mime['.html'],'Cache-Control':'no-store'}}));
   if(url.pathname.startsWith('/api/')){
    const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v!==undefined&&!/^(?:oai-|x-chemlens-local-)/i.test(k))headers.set(k,Array.isArray(v)?v.join(','):v);
    headers.set('oai-authenticated-user-id','local-private-owner');headers.set('oai-authenticated-user-email','owner@localhost.invalid');
    const request=new Request(url,{method:req.method,headers,...(body.length?{body}: {})});
    const env={BUCKET:bucket,CHEMLENS_OWNER_EMAIL:'owner@localhost.invalid',CHEMLENS_PRIVATE_LIBRARY:'1',WECHAT_SETTINGS_KEY:config.encryptionKey,LIBRARY_IDENTITIES:seed.papers,PUBLIC_FIGURES:Object.fromEntries(seed.figures.map(f=>[f.id,f.paperId])),OWNER_LIBRARY_DATA:{papers:[],notes:[],events:[]},AI_PROVIDER:config.ai?.provider||'zhipu',ZHIPU_MODEL:config.ai?.model||'glm-4.6v',OPENAI_MODEL:config.ai?.model||'',...(config.ai?.key?{[config.ai.provider==='openai'?'OPENAI_API_KEY':'ZHIPU_API_KEY']:config.ai.key}:{})};
    const ctx={waitUntil(p){pending.add(p);p.catch(()=>console.error('后台任务未完成，请在任务记录中查看原因。')).finally(()=>pending.delete(p));}};
    const response=await runInLocalScope(config.scope,async()=>await handleCatalog(request,env)||await handleApi(request,env,ctx));return finish(response||new Response('Not found',{status:404}));
   }
   let path=decodeURIComponent(url.pathname);if(path==='/')path='/index.html';
   if(path.split('/').some(p=>p.startsWith('.')||['local','node_modules','server','scripts','tests'].includes(p)))return json({error:{message:'文件不存在。'}},404);
   // Asset paths remain the same as the portable workbench; no remote PDF proxy is used.
   const base=/^\/(?:assets|vendor)\//.test(path)?root:workbench,target=resolve(base,'.'+path);
   if(!target.startsWith(base+sep)||!(await stat(target)).isFile())return json({error:{message:'文件不存在。'}},404);
   return finish(new Response(await readFile(target),{headers:{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-cache'}}));
  }catch(e){return json({error:{message:e.code==='ENOENT'?'文件不存在。':'本机请求未完成，请检查输入或重试。'}},e.code==='ENOENT'?404:500);}
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});origin='http://127.0.0.1:'+server.address().port;
 let dailyRunning=false,closed=false;
 const dailyTick=async()=>{
  if(closed||dailyRunning||!config.ai?.key)return;
  const now=new Date(),day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(now));
  if(hour<9)return;const settings=await bucket.get(`private/${config.scope}/daily-discovery/settings.json`);if(!settings||(await settings.json()).enabled!==true)return;
  const old=await bucket.get(`private/${config.scope}/daily-discovery/auto.json`),job=old?await old.json():null;
  if(job?.date===day&&['completed','paused'].includes(job.status))return;
  dailyRunning=true;
  try{for(let i=0;i<500&&!closed;i++){
   const response=await fetch(origin+'/api/discovery/daily/step',{method:'POST',headers:{Origin:origin,Cookie:'chemlens_local='+config.sessionKey,'Content-Type':'application/json'},body:JSON.stringify({mode:'auto'}),signal:AbortSignal.timeout(120000)}),d=await response.json();
   if(!response.ok||d.busy||d.disabled||!d.job||['completed','paused'].includes(d.job.status))break;
   await new Promise(ok=>{const t=setTimeout(ok,3000);t.unref();});
  }}catch{console.error('每日任务暂未接续，可在高分文献发现中查看进度。');}finally{dailyRunning=false;}
 };
 const schedule=setInterval(()=>void dailyTick().catch(()=>{}),60000);schedule.unref();server.once('close',()=>{closed=true;clearInterval(schedule);});
 if(openBrowser){const target=origin+'/?setup=1',command=process.platform==='win32'?'rundll32':process.platform==='darwin'?'open':'xdg-open',args=process.platform==='win32'?['url.dll,FileProtocolHandler',target]:[target];spawn(command,args,{detached:true,stdio:'ignore',windowsHide:true}).unref();}
 return {server,origin,dataDir,close:()=>new Promise(ok=>server.close(ok))};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const running=await startLocalServer({openBrowser:process.argv.includes('--open')});console.log('ChemLens 本机工作台：'+running.origin+'\n资料目录：'+running.dataDir+'\n关闭本程序后，本机工作台会停止。');}

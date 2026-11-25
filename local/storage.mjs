import {readFile,writeFile,mkdir,readdir,stat,rename} from 'node:fs/promises';
import {resolve,sep,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export function createBucket(dataRoot){
const contentEtag=bytes=>createHash('sha256').update(bytes).digest('hex');
const pendingWrites=new Map();
async function writeLocked(key,run){
 const previous=pendingWrites.get(key)||Promise.resolve();
 const current=previous.catch(()=>{}).then(run);
 pendingWrites.set(key,current);
 try{return await current;}finally{if(pendingWrites.get(key)===current)pendingWrites.delete(key);}
}
function localPath(key){const out=resolve(dataRoot,key);if(!out.startsWith(dataRoot+sep))throw new Error('Invalid local storage key');return out;}
const BUCKET={
 async get(key){try{const bytes=await readFile(localPath(key));const etag=contentEtag(bytes);return {key,etag,httpEtag:'\"'+etag+'\"',body:new Response(bytes).body,size:bytes.length,httpMetadata:{contentType:key.endsWith('.pdf')?'application/pdf':'application/json'},arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),text:async()=>bytes.toString('utf8'),json:async()=>JSON.parse(bytes.toString('utf8')),writeHttpMetadata(headers){headers.set('Content-Type',this.httpMetadata.contentType)}};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
 async put(key,value,options={}){
  const file=localPath(key),bytes=typeof value==='string'?Buffer.from(value):Buffer.from(await new Response(value).arrayBuffer());
  const condition=options.onlyIf;
  return writeLocked(key,async()=>{
   const match=condition instanceof Headers?condition.get('If-Match'):condition?.etagMatches;
   const noneMatch=condition instanceof Headers?condition.get('If-None-Match'):condition?.etagDoesNotMatch;
   if(match||noneMatch){
    const current=await BUCKET.get(key);
    if(match&&(!current||!(match==='*'||match===current.etag||match===current.httpEtag)))return null;
    if(noneMatch&&current&&(noneMatch==='*'||noneMatch===current.etag||noneMatch===current.httpEtag))return null;
   }
   await mkdir(dirname(file),{recursive:true});
   const pending=file+'.'+randomUUID()+'.tmp';
   await writeFile(pending,bytes);
   await rename(pending,file);
   const etag=contentEtag(bytes);
   return {key,etag,httpEtag:'"'+etag+'"'};
  });
 },
 async delete(key){const {unlink}=await import('node:fs/promises');try{await unlink(localPath(key))}catch(e){if(e.code!=='ENOENT')throw e;}},
 async list({prefix='',cursor,limit=1000}={}){const objects=[];async function scan(dir){let entries;try{entries=await readdir(dir,{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return;throw e;}for(const entry of entries){const full=resolve(dir,entry.name);if(entry.isDirectory())await scan(full);else{const key=full.slice(dataRoot.length+1).replaceAll('\\','/');if(key.startsWith(prefix))objects.push({key,size:(await stat(full)).size,etag:contentEtag(await readFile(full))})}}}await scan(dataRoot);objects.sort((a,b)=>a.key.localeCompare(b.key));const start=Number(cursor)||0;return {objects:objects.slice(start,start+limit),truncated:start+limit<objects.length,cursor:String(start+limit)};}
};

return BUCKET;}

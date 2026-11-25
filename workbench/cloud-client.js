/** Same-origin cloud API client. Secrets are configured only on the server. */
export class CloudError extends Error {
  constructor(message,code='NETWORK_ERROR',status=0){super(message);this.code=code;this.status=status;}
}
async function request(path,options={}) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),60000);
  try {
    const response=await fetch(path,{credentials:'same-origin',...options,signal:options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal});
    const contentType=response.headers.get('content-type')||'';
    if(!contentType.includes('application/json'))throw new CloudError(response.status===401?'请先登录网站再使用在线文献库。':'在线服务暂不可用，仍可使用本地工作区。','SERVICE_UNAVAILABLE',response.status);
    const data=await response.json();
    if(!response.ok){const error=new CloudError(data.error?.message||'在线请求未完成。',data.error?.code||'REQUEST_FAILED',response.status);error.details=data.error?.details;throw error;}
    return data;
  } catch(error) {
    if(error instanceof CloudError)throw error;
    throw new CloudError(error.name==='AbortError'?'请求超时。若任务已提交，可在文献详情刷新进度。':'网络连接暂时不可用，请稍后重试。');
  } finally {clearTimeout(timer);}
}
export const cloudOwnerLibrary=()=>request('/api/owner-library');
export const cloudStatus=()=>request('/api/status');
export async function cloudPapers(){const papers=[];let cursor='',seen=new Set();do{const data=await request('/api/papers'+(cursor?'?'+new URLSearchParams({cursor}):''));papers.push(...(data.papers||[]));cursor=data.nextCursor||'';if(cursor&&seen.has(cursor))throw new CloudError('云端分页暂不可用，请稍后刷新。');if(cursor)seen.add(cursor);}while(cursor);return {papers};}
export const cloudPaper=id=>request('/api/papers/'+encodeURIComponent(id));
export function uploadCloudPaper(file,{title='',tags=[],pageCount,requestId,analysisPacket,analyze=true,metadata}) {
  const form=new FormData();form.append('file',file,file.name||'paper.pdf');form.append('title',title);form.append('tags',Array.isArray(tags)?tags.join(', '):tags);form.append('pageCount',String(pageCount));form.append('requestId',requestId);
  form.append('analyze',String(analyze));if(metadata)form.append('metadata',JSON.stringify(metadata));
  if(analysisPacket)form.append('analysisPacket',JSON.stringify(analysisPacket));
  return request('/api/papers',{method:'POST',body:form});
}

export const translateCloudCaptions=(id,requestId)=>request('/api/papers/'+encodeURIComponent(id)+'/caption-translations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId})});
export const startCloudFigureRepair=(id,input)=>request('/api/papers/'+encodeURIComponent(id)+'/figure-repairs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
export const pollCloudFigureRepair=(id,task)=>request('/api/papers/'+encodeURIComponent(id)+'/figure-repairs/'+encodeURIComponent(task));

export const saveCloudManualCrop=(id,input)=>request('/api/papers/'+encodeURIComponent(id)+'/manual-crop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});

export const cloudFigureRatings=()=>request('/api/figure-ratings');
export const saveFigureRating=input=>request('/api/figure-ratings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});

export const startCloudPaperAnalysis=(id,analysisPacket=null,{restartUnconfirmed=false}={})=>request('/api/papers/'+encodeURIComponent(id)+'/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({analysisPacket,restartUnconfirmed})});

export async function askCloudFigure(input,{signal}={}){try{return await request('/api/figure-qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal});}catch(error){if(error.code==='NETWORK_ERROR')throw new CloudError('本次问答未返回，请稍后重新提问。',error.code,error.status);throw error;}}

export const checkCloudDuplicate=identity=>request('/api/papers/check-duplicate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(identity)});

export const restoreCloudPaperPDF=(id,file)=>request('/api/papers/'+encodeURIComponent(id)+'/pdf',{method:'PUT',headers:{'Content-Type':'application/pdf'},body:file});

export const cloudDeletedTasks=()=>request('/api/paper-tasks/deleted');
export const deleteCloudPaperTask=id=>request('/api/papers/'+encodeURIComponent(id)+'/task',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:true})});
export const restoreCloudPaperTask=id=>request('/api/papers/'+encodeURIComponent(id)+'/task',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({restore:true})});

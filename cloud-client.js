// Static reading edition: AI processing stays in the separate workspace.
const unavailable=async()=>{throw new Error('请前往 AI 工作台上传或编辑文献。')};
export const cloudStatus=async()=>({online:true,authenticated:false,privateLibrary:false,storageEnabled:false,aiEnabled:false,staticReader:true});
export const cloudPapers=unavailable,cloudPaper=unavailable,uploadCloudPaper=unavailable,cloudOwnerLibrary=unavailable,startCloudFigureRepair=unavailable,pollCloudFigureRepair=unavailable,saveCloudManualCrop=unavailable,saveFigureRating=unavailable,startCloudPaperAnalysis=unavailable;
export const cloudFigureRatings=async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);try{const response=await fetch('https://chemlens-yychu2020.chuyuyi1998.chatgpt.site/api/figure-ratings',{credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('评分暂未同步');return await response.json();}finally{clearTimeout(timer);}};

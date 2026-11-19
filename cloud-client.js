// Static reading edition: AI processing stays in the separate workspace.
const unavailable=async()=>{throw new Error('请前往 AI 工作台上传或编辑文献。')};
export const cloudStatus=async()=>({online:true,authenticated:false,privateLibrary:false,storageEnabled:false,aiEnabled:false,staticReader:true});
export const cloudPapers=unavailable,cloudPaper=unavailable,uploadCloudPaper=unavailable,cloudOwnerLibrary=unavailable,startCloudFigureRepair=unavailable,pollCloudFigureRepair=unavailable;

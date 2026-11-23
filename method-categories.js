export const METHOD_CATEGORIES=['DFT','分子动力学','机器学习','大模型','机器学习势','多物理场模拟','动力学建模','实验与表征','其他方法'];
const aliases={'密度泛函理论':'DFT','MD':'分子动力学','AIMD':'分子动力学','ML':'机器学习','LLM':'大模型','机器学习力场':'机器学习势','神经网络势':'机器学习势','有限元':'多物理场模拟','微观动力学':'动力学建模','实验':'实验与表征'};
export function normalizeMethodCategories(value){return [...new Set((Array.isArray(value)?value:typeof value==='string'?value.split(/[,，;；/]/):[]).map(x=>aliases[String(x).trim()]||String(x).trim()).filter(x=>METHOD_CATEGORIES.includes(x)))];}
export function getMethodCategories(m={}){
 const selected=normalizeMethodCategories(m.categories);if(selected.length)return selected;if(m.categoriesEdited)return ['其他方法'];
 const source=[m.title,m.software,m.description,m.parameters].filter(Boolean).join('\n').replace(/(?:不进行|不执行|未开展|无需进行|does not perform)\s*(?:DFT|密度泛函)[^。；;\n]*/gi,''),out=[];
 const potential=/机器学习势|神经网络势|原子间势|势能面模型|MLIP|\bNNP\b|SSW-NN|G-NN|MACE|NequIP|GemNet|Equiformer|SevenNet|CHGNet|DeepMD|DP-GEN/i.test(source)||/\bMLP\b/i.test(source)&&/势能|原子|力场|interatomic|potential/i.test(source);
 if(/\bDFT\b|\bVASP\b|Quantum\s*ESPRESSO|\bCP2K\b|\bGPAW\b|密度泛函|交换关联泛函|赝势|平面波截断/i.test(source))out.push('DFT');
 if(/分子动力学|\b(?:MD|AIMD|LAMMPS|GROMACS)\b|molecular dynamics|(?:从头算|第一性原理)动力学/i.test(source))out.push('分子动力学');
 if(/大语言模型|大模型|\bLLM\b|GPT[-\s]?\d|Llama|Gemini|GLM[-\s]?\d|长上下文|语言模型智能体/i.test(source))out.push('大模型');
 if(potential||/机器学习|深度学习|神经网络|随机森林|梯度提升|支持向量|高斯过程|回归模型|强化学习|machine learning|random forest|\b(?:ML|MLP|CNN|VAE|GRPO|XGBoost|LightGBM|CatBoost|TorchMD)\b/i.test(source))out.push('机器学习');
 if(potential)out.push('机器学习势');
 if(/多物理场|有限元|\bCOMSOL\b|multiphysics|finite[- ]element|流体力学|\bCFD\b|Fluent/i.test(source))out.push('多物理场模拟');
 if(/微观动力学|microkinetic|动力学建模|反应动力学模型|稳态速率|速率方程|kinetic model/i.test(source))out.push('动力学建模');
 if(/实验|原位光谱|显微|衍射|电化学测试|极化曲线|阻抗谱|电极制备|合成|\b(?:TEM|STEM|XRD|XPS|XAS|XANES|EXAFS|EIS|SEM)\b/i.test(source))out.push('实验与表征');
 return out.length?METHOD_CATEGORIES.filter(x=>out.includes(x)):['其他方法'];
}
export function methodCategoryCounts(methods){return METHOD_CATEGORIES.map(category=>({category,count:methods.filter(m=>getMethodCategories(m).includes(category)).length}));}

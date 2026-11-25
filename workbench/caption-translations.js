// Checked against the user-supplied original PDF, DOI and main-figure numbers.
const captions={
 '10.1021/jacs.3c11246':{
  '1':'图1｜对已报道的100余种M–N–C催化剂进行氧还原反应（ORR）活性分析。图中汇总了用于ORR的典型M–N–C催化剂，详细数据来源见表S1和S2。数据按以下条件从原始文献提取：半波电位定义为电流达到扩散极限电流一半时的电位；法拉第效率（FE）在0.6 V（相对于可逆氢电极，RHE）下计算。对于基于共价有机框架（COF）和卟啉（POR）的催化剂，由于未观察到扩散极限电流，采用电流密度为0.5 mA cm⁻²时的电位作为半波电位。COF和POR类催化剂的FE分别在0.30和0.48 V（vs RHE）下计算。既往实验数据的更多细节见补充信息。',
  '2':'图2｜不同原子环境的M–N–C催化剂中的线性标度关系。（a）分别含1–4个吡啶型氮（M-pyridine-N₄–₁）或吡咯型氮（M-pyrrole-N₄–₁）的结构。（b）基于共轭卟啉的M-COF-366单原子催化剂。（c）M-phthalocyanine-R（金属酞菁-R）。（d）Co-porphyrins-R（钴卟啉-R），其中R表示不同的周围官能团。（e）上述M–N–C催化剂中E_{HO*}与E_{O*}的标度关系。（f）E_{HO*}与E_{HOO*}的普适标度关系。（g）M–N–C催化剂金属位点上E_{HO*}与E_{O₂*}的标度关系。插图展示所识别的化学吸附态和物理吸附态。',
  '3':'图3｜决定ORR活性的电场效应及其他关键因素。（a–c）电场对ORR吸附物吸附自由能的影响，以及拟合得到的μ（偶极矩，单位eÅ）和α（极化率，单位e² V⁻¹），分别对应（a）Pt(111)、（b）Fe-pyridine-N₄和（c）ZrO₂(100)。插图为原子氧吸附引起的电荷密度差分；等值面中的黄色和蓝绿色分别表示电子积累和电子损失。红色、灰色和绿色小球分别代表O、C和Zr。其他关键因素包括通过（d）隐式模型和（e）显式模型计算的零电荷电位（PZC），以及（f）存在显式水分子时，溶剂化对HO*和HOO*结合能变化的影响。（e）中的正态分布来自超过1000步的催化剂–水从头算分子动力学（AIMD）模拟；（f）中的箱线图来自至少20种不同的表面–吸附物组合。',
  '4':'图4｜M–N–C单原子催化剂的ORR微观动力学火山模型及决速分析。（a、b）M–pyrrole–N催化剂的活性火山图，分别为（a）0.8 V（vs RHE）下的总体ORR周转频率（TOF）和（b）0.6 V（vs RHE）下的双电子ORR周转频率。更强的电场对应更低的pH。（c–e）决速分析分别针对（c）碱性介质中的四电子ORR、（d）酸性介质中的四电子ORR和（e）碱性介质中的双电子ORR。虚线为按决速步骤分析得到的ORR活性，分别受O₂质子化（蓝色）、HOO*质子化与断裂（红色）以及HO*覆盖度（青色）限制。（f）对不同电场响应和特定标度关系所得的二维pH依赖火山图进行比较。相较M–pyrrole–N₃，M–pyridine–N₄对电场更敏感，因此出现明显的“酸陷阱”（红色虚线箭头）。此外，M–N₃/₂/₁的标度关系截距更低（E_{O*}=1.5E_{HO*}+0.7），而M–N₄对应E_{O*}=1.5E_{HO*}+1.26，这会降低双电子反应选择性。',
  '5':'图5｜实验表征、性能测试与理论预测。（a–d）MPc/CNT、FePc/CNT-R、M-COF366/CNT催化剂及其参比样品的金属K边X射线吸收近边结构（XANES），分别对应（a）Fe、（b）Co、（c）Ni和（d）Cu体系。对应的k³加权傅里叶变换扩展X射线吸收精细结构（FT-EXAFS）拟合谱见图S12。（e）典型M-COF366催化剂在pH 1.3（虚线）和12.6（实线）下的计算动力学电流j_{K}；（f）相应的计算Tafel图。（g）典型M-COF366催化剂在pH 1.3（虚线）和12.6（实线）下的实验动力学电流j_{K}；（h）相应的实验Tafel图。（i）实验与计算Tafel图的相关性。（j）通过实验测量与理论预测得到的分子型M–N–C催化剂TOF。原图注首句标作（a–e），但后文将（e）说明为计算动力学电流；此处按其后续分图说明排列。'
 }
};
export function isChineseCaption(value){const s=String(value||'').trim(),han=(s.match(/[\u3400-\u9fff]/gu)||[]).length,latin=(s.match(/[A-Za-z]/g)||[]).length;return han>=2&&(latin===0||han>=4&&han/(han+latin)>.08);}
const figureKey=value=>String(value||'').replace(/^(?:Fig(?:ure)?\.?|图)\s*/i,'').trim().replace(/[.:：]$/,'');
const doiKey=p=>String(p?.doi||p?.analysis?.metadata?.doi||'').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').toLowerCase();
export function figureCaptionZh(f,p={}){const existing=String(f?.captionZh||'').trim();if(isChineseCaption(existing))return existing;if(f?.captionEdited)return '';return captions[doiKey(p)]?.[figureKey(f?.number)]||'';}
export function applyCaptionTranslations(analysis){if(!analysis?.metadata||!Array.isArray(analysis.figures))return false;let changed=false;for(const f of analysis.figures){const translated=figureCaptionZh(f,analysis.metadata);if(translated&&translated!==f.captionZh){f.captionZh=translated;changed=true;}}return changed;}

export function figureCaptionOriginal(f,p={}){const remote=p.analysis?.figures?.find(x=>figureKey(x.number)===figureKey(f?.number));for(const value of [f?.captionOriginal,f?.caption,remote?.captionOriginal,remote?.caption,f?.captionZh]){const s=String(value||'').trim();if(s&&!isChineseCaption(s)&&/[A-Za-z]{3}/.test(s))return s;}return '';}

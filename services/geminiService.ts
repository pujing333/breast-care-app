
import { GoogleGenAI, Type } from "@google/genai";
import { ClinicalMarkers, Patient, TreatmentOption, DetailedRegimenPlan } from '../types';
import { AI_MODEL_NAME } from '../constants';

const getClient = () => {
    // 获取 API Key
    // 兼容 Vercel 环境变量 (process.env) 和 Vite 环境变量 (import.meta.env)
    let apiKey = '';
    
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            // @ts-ignore
            apiKey = process.env.API_KEY;
        } else if (import.meta && (import.meta as any).env && (import.meta as any).env.VITE_API_KEY) {
            apiKey = (import.meta as any).env.VITE_API_KEY;
        }
    } catch (e) {
        console.warn("Error reading environment variables", e);
    }

    // 如果您是在 StackBlitz 预览或本地运行且没配置环境变量，请在此处填入您的 Key
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        apiKey = ''; // 在此处填入您的 Key，如 'AIzaSy...'
    }

    if (!apiKey) {
         throw new Error("API Key 未配置。请在 Vercel 环境变量中添加 API_KEY，或在 services/geminiService.ts 中填入。");
    }

    // 关键修改：使用 baseUrl 指向 Vercel 的代理路径 '/google-api'
    // 这样请求会发给 Vercel 服务器，由 Vercel 转发给 Google，从而绕过客户端的网络限制。
    return new GoogleGenAI({ 
        apiKey,
        baseUrl: '/google-api' 
    } as any);
};

export const generateTreatmentOptions = async (patient: Patient, markers: ClinicalMarkers): Promise<TreatmentOption[]> => {
    try {
        const ai = getClient();
        const prompt = `
        作为一名乳腺外科专家，请根据患者数据制定 **2-3种** 不同的总体治疗路径选项（例如：标准方案、强化方案、或降阶梯方案）。
        
        患者信息：
        - 年龄: ${patient.age}, 绝经: ${markers.menopause ? '是' : '否'}
        - 诊断: ${patient.diagnosis}
        - 病理: ER:${markers.erStatus}, PR:${markers.prStatus}, HER2:${markers.her2Status}, Ki67:${markers.ki67}, T:${markers.tumorSize}, N:${markers.nodeStatus}
        
        请返回JSON格式。每个方案需包含：标题、图标类型(surgery/chemo/drug/observation)、详细描述、预估时长、优缺点。
        
        重要：请严格依据 NCCN 或 CSCO 乳腺癌诊疗指南，综合评估复发风险，将**最标准、最推荐**的一个方案的 'recommended' 字段设为 true。通常情况下只有一个方案被标记为推荐。
        `;

        const response = await ai.models.generateContent({
            model: AI_MODEL_NAME,
            contents: prompt,
            config: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "Unique ID like plan_1" },
                            title: { type: Type.STRING, description: "Short title of the plan, e.g. 'AC-T Chemo + Surgery'" },
                            iconType: { 
                                type: Type.STRING, 
                                enum: ["surgery", "chemo", "drug", "observation"],
                                description: "Type of icon to display" 
                            },
                            description: { type: Type.STRING, description: "Detailed clinical description" },
                            duration: { type: Type.STRING, description: "Estimated duration, e.g. '6 months'" },
                            pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                            cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                            recommended: { type: Type.BOOLEAN, description: "Is this the most standard recommendation?" }
                        },
                        required: ["id", "title", "iconType", "description", "recommended"]
                    }
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("AI 返回内容为空");
        
        return JSON.parse(jsonText) as TreatmentOption[];

    } catch (error: any) {
        console.error("Gemini API Error:", error);
        // 友好的错误提示
        let msg = error.message || "连接 AI 服务失败";
        if (msg.includes("404") || msg.includes("not found")) {
             msg = "网络请求失败 (404)。请确保 vercel.json 已上传且 API 路径配置正确。";
        } else if (msg.includes("403")) {
             msg = "权限拒绝 (403)。请检查 API Key 是否正确以及 Google Cloud 权限。";
        } else if (msg.includes("Failed to fetch")) {
             msg = "网络连接中断。请检查网络或 Vercel 代理配置。";
        }
        throw new Error(msg);
    }
};

export const generateDetailedRegimens = async (patient: Patient, markers: ClinicalMarkers, highLevelPlan: TreatmentOption): Promise<DetailedRegimenPlan | null> => {
    try {
        const ai = getClient();
        const prompt = `
        基于已选定的总体治疗路径："${highLevelPlan.title}" (${highLevelPlan.description})，
        请为该乳腺癌患者提供具体的药物/治疗方案选项。
        
        患者数据：
        - 年龄: ${patient.age}, 绝经: ${markers.menopause ? '是' : '否'}
        - 分型: ${patient.subtype}
        - 病理: ER:${markers.erStatus}, HER2:${markers.her2Status}, T:${markers.tumorSize}, N:${markers.nodeStatus}
        
        请分别为 化疗(chemo)、内分泌(endocrine)、靶向(target)、免疫(immune) 四个类别提供 1-3 个具体方案选项。
        
        重要：对于化疗、靶向和免疫方案，请务必在 'drugs' 字段中详细列出该方案包含的药物明细。
        - 对于化疗，通常使用体表面积 (mg/m2)。
        - 对于靶向药（如曲妥珠单抗），请注明是负荷剂量还是维持剂量，或使用标准参考值 (如 mg/kg 或 mg 固定剂量)。
        - 单位请统一使用：'mg/m2', 'mg/kg', 或 'mg'。
        - 请提供总周期数 (totalCycles) 和 单周期天数 (frequencyDays) 以便生成日程表。
        `;

        const drugSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    standardDose: { type: Type.NUMBER, description: "Standard dose value" },
                    unit: { type: Type.STRING, description: "Unit: mg/m2, mg/kg, or mg" }
                },
                required: ["name", "standardDose", "unit"]
            }
        };

        const response = await ai.models.generateContent({
            model: AI_MODEL_NAME,
            contents: prompt,
            config: {
                temperature: 0.2, 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        chemoOptions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING, description: "Regimen name e.g. 'AC-T'" },
                                    description: { type: Type.STRING, description: "Drugs involved" },
                                    cycle: { type: Type.STRING, description: "Cycle info e.g. 'q2w x 4'" },
                                    type: { type: Type.STRING, enum: ["chemo"] },
                                    recommended: { type: Type.BOOLEAN },
                                    drugs: drugSchema,
                                    totalCycles: { type: Type.INTEGER, description: "Total number of cycles" },
                                    frequencyDays: { type: Type.INTEGER, description: "Days per cycle, e.g. 14 or 21" }
                                },
                                required: ["id", "name", "description", "type", "recommended"]
                            }
                        },
                        endocrineOptions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    cycle: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ["endocrine"] },
                                    recommended: { type: Type.BOOLEAN },
                                    totalCycles: { type: Type.INTEGER, description: "Total count (1 for continuous)" },
                                    frequencyDays: { type: Type.INTEGER, description: "Days between (0 for continuous)" }
                                },
                                required: ["id", "name", "description", "type", "recommended"]
                            }
                        },
                        targetOptions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    cycle: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ["target"] },
                                    recommended: { type: Type.BOOLEAN },
                                    drugs: drugSchema,
                                    totalCycles: { type: Type.INTEGER, description: "Total number of cycles" },
                                    frequencyDays: { type: Type.INTEGER, description: "Days per cycle" }
                                },
                                required: ["id", "name", "description", "type", "recommended"]
                            }
                        },
                        immuneOptions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    cycle: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ["immune"] },
                                    recommended: { type: Type.BOOLEAN },
                                    drugs: drugSchema,
                                    totalCycles: { type: Type.INTEGER, description: "Total number of cycles" },
                                    frequencyDays: { type: Type.INTEGER, description: "Days per cycle" }
                                },
                                required: ["id", "name", "description", "type", "recommended"]
                            }
                        }
                    },
                    required: ["chemoOptions", "endocrineOptions", "targetOptions", "immuneOptions"]
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("AI 返回内容为空");
        
        return JSON.parse(jsonText) as DetailedRegimenPlan;

    } catch (error: any) {
        console.error("Gemini API Error (Detailed Regimens):", error);
        throw new Error(error.message || "生成详细方案失败");
    }
};

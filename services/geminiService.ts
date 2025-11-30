
import { ClinicalMarkers, Patient, TreatmentOption, DetailedRegimenPlan } from '../types';
import { AI_MODEL_NAME } from '../constants';

// 获取 API Key
const getApiKey = () => {
    // Vite 标准环境变量读取方式
    // @ts-ignore
    let apiKey = import.meta.env.VITE_API_KEY;

    // 自动去除空格容错
    if (apiKey) {
        apiKey = apiKey.trim();
    }

    // 调试日志
    if (apiKey) {
        console.log(`[GeminiService] API Key Loaded: ${apiKey.substring(0, 4)}****`);
    } else {
        console.error("[GeminiService] API Key MISSING");
    }
    
    if (!apiKey) {
        throw new Error("API Key 未配置。请在 Vercel 后台检查环境变量 VITE_API_KEY。");
    }
    return apiKey;
};

// 核心通用请求函数
const callGeminiApi = async (prompt: string, schema?: any) => {
    const apiKey = getApiKey();
    // 强制使用相对路径 /google-api，通过 Vercel 转发
    const baseUrl = '/google-api/v1/models';
    
    // 【关键修改】将 Key 放在 URL 参数中，确保穿透代理
    const url = `${baseUrl}/${AI_MODEL_NAME}:generateContent?key=${apiKey}`;

    const body: any = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json"
        }
    };

    if (schema) {
        body.generationConfig.responseSchema = schema;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        // 获取响应文本
        const responseText = await response.text();
        let jsonErr: any = null;
        try {
            jsonErr = JSON.parse(responseText);
        } catch (e) {
            jsonErr = null;
        }

        if (!response.ok) {
            if (response.status === 404) {
                // 如果是 HTML 404，说明 Vercel 代理配置（vercel.json）没生效
                if (!jsonErr || (typeof jsonErr === 'string' && jsonErr.includes('DOCTYPE'))) {
                    throw new Error("网络配置错误 (404): Vercel 代理通道丢失。请检查 GitHub 根目录 vercel.json 是否上传成功。");
                } 
                // 如果是 JSON 404，说明 Google 真的找不到模型
                else {
                    const googleMsg = jsonErr?.error?.message || '未知原因';
                    throw new Error(`Google 模型错误 (404): 找不到模型 '${AI_MODEL_NAME}'。详细信息: ${googleMsg}`);
                }
            }
            
            if (response.status === 403) {
                 const googleMsg = jsonErr?.error?.message || '';
                 throw new Error(`权限拒绝 (403): ${googleMsg || 'Key 无效'}。请检查 Vercel 后台 VITE_API_KEY。`);
            }

            throw new Error(`API 请求失败 (${response.status}): ${response.statusText}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("AI 返回数据为空");

        return JSON.parse(text);
    } catch (error: any) {
        console.error("Gemini Error:", error);
        throw error;
    }
};

export const generateTreatmentOptions = async (patient: Patient, markers: ClinicalMarkers): Promise<TreatmentOption[]> => {
    const prompt = `
    作为乳腺外科专家，制定2-3种总体治疗路径。
    患者: ${patient.age}岁, ${patient.diagnosis}, 分子分型:${patient.subtype}
    病理: ER:${markers.erStatus}, PR:${markers.prStatus}, HER2:${markers.her2Status}, Ki67:${markers.ki67}, T:${markers.tumorSize}, N:${markers.nodeStatus}, 绝经:${markers.menopause ? '是' : '否'}
    
    返回JSON数组，每个包含: id, title, iconType(surgery/chemo/drug/observation), description, duration, pros[], cons[], recommended(boolean).
    依据NCCN/CSCO指南标记最推荐方案。
    `;

    const schema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                id: { type: "STRING" },
                title: { type: "STRING" },
                iconType: { type: "STRING", enum: ["surgery", "chemo", "drug", "observation"] },
                description: { type: "STRING" },
                duration: { type: "STRING" },
                pros: { type: "ARRAY", items: { type: "STRING" } },
                cons: { type: "ARRAY", items: { type: "STRING" } },
                recommended: { type: "BOOLEAN" }
            },
            required: ["id", "title", "iconType", "description", "recommended"]
        }
    };

    return await callGeminiApi(prompt, schema) as TreatmentOption[];
};

export const generateDetailedRegimens = async (patient: Patient, markers: ClinicalMarkers, highLevelPlan: TreatmentOption): Promise<DetailedRegimenPlan | null> => {
    const prompt = `
    基于路径 "${highLevelPlan.title}"，提供详细药物方案。
    患者: ${patient.age}岁, 分型:${patient.subtype}
    返回JSON对象包含: chemoOptions, endocrineOptions, targetOptions, immuneOptions.
    每项需包含: drugs(name, standardDose, unit), totalCycles, frequencyDays.
    单位使用: mg/m2, mg/kg, 或 mg.
    `;

    const drugSchema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                name: { type: "STRING" },
                standardDose: { type: "NUMBER" },
                unit: { type: "STRING" }
            },
            required: ["name", "standardDose", "unit"]
        }
    };

    const regimenSchema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                id: { type: "STRING" },
                name: { type: "STRING" },
                description: { type: "STRING" },
                cycle: { type: "STRING" },
                type: { type: "STRING" },
                recommended: { type: "BOOLEAN" },
                drugs: drugSchema,
                totalCycles: { type: "INTEGER" },
                frequencyDays: { type: "INTEGER" }
            },
            required: ["id", "name", "description", "type", "recommended"]
        }
    };

    const schema = {
        type: "OBJECT",
        properties: {
            chemoOptions: regimenSchema,
            endocrineOptions: regimenSchema,
            targetOptions: regimenSchema,
            immuneOptions: regimenSchema
        },
        required: ["chemoOptions", "endocrineOptions", "targetOptions", "immuneOptions"]
    };

    return await callGeminiApi(prompt, schema) as DetailedRegimenPlan;
};

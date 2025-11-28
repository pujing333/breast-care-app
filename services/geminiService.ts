
import { ClinicalMarkers, Patient, TreatmentOption, DetailedRegimenPlan } from '../types';
import { AI_MODEL_NAME } from '../constants';

// 获取 API Key
const getApiKey = () => {
    let apiKey = '';
    try {
        // 1. 优先尝试 VITE_API_KEY (标准 Vite 方式)
        // @ts-ignore
        if (import.meta && import.meta.env && import.meta.env.VITE_API_KEY) {
            // @ts-ignore
            apiKey = import.meta.env.VITE_API_KEY;
        } 
        // 2. 尝试 process.env.API_KEY (通过 vite.config.ts 的 define 注入)
        // @ts-ignore
        else if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            // @ts-ignore
            apiKey = process.env.API_KEY;
        }
    } catch (e) {}

    // 最后的后备（如果环境变量未生效，仅供测试）
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        apiKey = ''; 
    }
    
    // 调试日志
    if (apiKey) {
        // 只显示前4位，避免泄露
        console.log(`[GeminiService] API Key loaded: ${apiKey.substring(0, 4)}****`);
    } else {
        console.error("[GeminiService] API Key NOT found!");
    }
    
    if (!apiKey) {
        throw new Error("API Key 未配置。请在 Vercel 后台 Environment Variables 中添加 API_KEY 或 VITE_API_KEY，并重新部署(Redeploy)。");
    }
    return apiKey;
};

// 核心通用请求函数 (使用原生 fetch 替代 SDK)
const callGeminiApi = async (prompt: string, schema?: any) => {
    const apiKey = getApiKey();
    // 强制使用相对路径 /google-api，这会被 vercel.json 拦截并转发到 Google
    const baseUrl = '/google-api/v1beta/models';
    const url = `${baseUrl}/${AI_MODEL_NAME}:generateContent`;

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
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey // 使用 Header 传递 Key
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            let errorMsg = `API 请求失败: ${response.status} ${response.statusText}`;
            if (response.status === 404) {
                errorMsg = "网络路径错误 (404)。请检查 vercel.json 是否已上传至 GitHub 根目录。";
            } else if (response.status === 403) {
                errorMsg = "权限拒绝 (403)。Key 无效或未开通 Google Cloud 权限。";
            } else if (response.status === 504) {
                errorMsg = "请求超时。请重试。";
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            console.error("Gemini Raw Response:", data);
            throw new Error("AI 返回了空数据，请稍后重试");
        }

        return JSON.parse(text);
    } catch (error: any) {
        console.error("Gemini Fetch Error:", error);
        if (error.message && (error.message.includes("Failed to fetch") || error.message.includes("NetworkError"))) {
             throw new Error("网络连接失败。请检查：vercel.json 是否存在于 GitHub 根目录？");
        }
        throw error;
    }
};

export const generateTreatmentOptions = async (patient: Patient, markers: ClinicalMarkers): Promise<TreatmentOption[]> => {
    const prompt = `
    作为一名乳腺外科专家，请根据患者数据制定 **2-3种** 不同的总体治疗路径选项（例如：标准方案、强化方案、或降阶梯方案）。
    
    患者信息：
    - 年龄: ${patient.age}, 绝经: ${markers.menopause ? '是' : '否'}
    - 诊断: ${patient.diagnosis}
    - 病理: ER:${markers.erStatus}, PR:${markers.prStatus}, HER2:${markers.her2Status}, Ki67:${markers.ki67}, T:${markers.tumorSize}, N:${markers.nodeStatus}
    
    请返回JSON格式。每个方案需包含：标题、图标类型(surgery/chemo/drug/observation)、详细描述、预估时长、优缺点。
    
    重要：请严格依据 NCCN 或 CSCO 乳腺癌诊疗指南，综合评估复发风险，将**最标准、最推荐**的一个方案的 'recommended' 字段设为 true。通常情况下只有一个方案被标记为推荐。
    `;

    const schema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                id: { type: "STRING", description: "Unique ID like plan_1" },
                title: { type: "STRING", description: "Short title of the plan" },
                iconType: { 
                    type: "STRING", 
                    enum: ["surgery", "chemo", "drug", "observation"]
                },
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
    基于已选定的总体治疗路径："${highLevelPlan.title}" (${highLevelPlan.description})，
    请为该乳腺癌患者提供具体的药物/治疗方案选项。
    
    患者数据：
    - 年龄: ${patient.age}, 绝经: ${markers.menopause ? '是' : '否'}
    - 分型: ${patient.subtype}
    - 病理: ER:${markers.erStatus}, HER2:${markers.her2Status}, T:${markers.tumorSize}, N:${markers.nodeStatus}
    
    请分别为 化疗(chemo)、内分泌(endocrine)、靶向(target)、免疫(immune) 四个类别提供 1-3 个具体方案选项。
    
    重要：对于化疗、靶向和免疫方案，请务必在 'drugs' 字段中详细列出该方案包含的药物明细。
    - 单位请统一使用：'mg/m2', 'mg/kg', 或 'mg'。
    - 请提供总周期数 (totalCycles) 和 单周期天数 (frequencyDays)。
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
                type: { type: "STRING", enum: ["chemo", "endocrine", "target", "immune"] },
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


import React, { useState } from 'react';
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, RegimenOption, SelectedRegimens, TreatmentEvent } from '../types';
import { generateTreatmentOptions, generateDetailedRegimens } from '../services/geminiService';
import { DosageCalculator } from './DosageCalculator';
import { ScheduleGenerator } from './ScheduleGenerator';

interface AITreatmentAssistantProps {
  patient: Patient;
  onUpdateMarkers: (markers: ClinicalMarkers) => void;
  onSaveOptions: (options: TreatmentOption[], selectedId: string | undefined) => void;
  onSaveDetailedPlan: (plan: DetailedRegimenPlan, selectedRegimens: SelectedRegimens) => void;
  onUpdatePatientStats?: (height: number, weight: number) => void;
  onBatchAddEvents?: (events: Omit<TreatmentEvent, 'id'>[]) => void;
}

const InputField = ({ 
    label, 
    value, 
    onChange, 
    placeholder 
}: { 
    label: string, 
    value: string, 
    onChange: (val: string) => void, 
    placeholder?: string 
}) => (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input 
        type="text" 
        className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
);

export const AITreatmentAssistant: React.FC<AITreatmentAssistantProps> = ({ 
    patient, 
    onUpdateMarkers, 
    onSaveOptions, 
    onSaveDetailedPlan,
    onUpdatePatientStats,
    onBatchAddEvents
}) => {
  const [loading, setLoading] = useState(false);
  const [generatingDetail, setGeneratingDetail] = useState(false);
  const [localMarkers, setLocalMarkers] = useState<ClinicalMarkers>(patient.markers);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(patient.selectedPlanId);
  const [options, setOptions] = useState<TreatmentOption[]>(patient.treatmentOptions || []);
  const [detailedPlan, setDetailedPlan] = useState<DetailedRegimenPlan | undefined>(patient.detailedPlan);
  const [selectedRegimens, setSelectedRegimens] = useState<SelectedRegimens>(patient.selectedRegimens || {});

  const handleGenerateHighLevel = async () => {
    setLoading(true);
    setError(null);
    setDetailedPlan(undefined);
    try {
      onUpdateMarkers(localMarkers);
      const generatedOptions = await generateTreatmentOptions(patient, localMarkers);
      
      if (generatedOptions.length > 0) {
          setOptions(generatedOptions);
          const recommended = generatedOptions.find(o => o.recommended);
          const newSelectedId = recommended ? recommended.id : generatedOptions[0].id;
          setSelectedPlanId(newSelectedId);
          onSaveOptions(generatedOptions, newSelectedId);
      } else {
          setError("AI 未生成有效内容，请稍后再试。");
      }
    } catch (e: any) {
        console.error("Treatment Gen Error:", e);
        // 直接显示错误信息，不再做包装，以便看清是 404 还是 403
        setError(e.message || "生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (id: string) => {
    setSelectedPlanId(id);
    onSaveOptions(options, id);
  };

  const handleGenerateDetailed = async () => {
    if (!selectedPlanId) return;
    const selectedOpt = options.find(o => o.id === selectedPlanId);
    if (!selectedOpt) return;

    setGeneratingDetail(true);
    setError(null);
    try {
        const plan = await generateDetailedRegimens(patient, localMarkers, selectedOpt);
        if (plan) {
            setDetailedPlan(plan);
            const initialSelection: SelectedRegimens = {};
            if (plan.chemoOptions.length > 0) initialSelection.chemoId = plan.chemoOptions.find(o => o.recommended)?.id || plan.chemoOptions[0].id;
            if (plan.endocrineOptions.length > 0) initialSelection.endocrineId = plan.endocrineOptions.find(o => o.recommended)?.id || plan.endocrineOptions[0].id;
            if (plan.targetOptions.length > 0) initialSelection.targetId = plan.targetOptions.find(o => o.recommended)?.id || plan.targetOptions[0].id;
            if (plan.immuneOptions.length > 0) initialSelection.immuneId = plan.immuneOptions.find(o => o.recommended)?.id || plan.immuneOptions[0].id;
            
            setSelectedRegimens(initialSelection);
            onSaveDetailedPlan(plan, initialSelection);
        }
    } catch (e: any) {
        setError(e.message || "生成详细方案失败，请重试");
    } finally {
        setGeneratingDetail(false);
    }
  };

  const handleSelectRegimen = (type: keyof SelectedRegimens, id: string) => {
      const newSelection = { ...selectedRegimens, [type]: id };
      setSelectedRegimens(newSelection);
      if (detailedPlan) {
          onSaveDetailedPlan(detailedPlan, newSelection);
      }
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'surgery': 
            return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758L4.879 4.879" />;
          case 'chemo':
            return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />;
          case 'drug':
            return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />;
          default:
            return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />;
      }
  };

  const RegimenSection = ({ title, options, typeKey }: { title: string, options: RegimenOption[], typeKey: keyof SelectedRegimens }) => {
      if (!options || options.length === 0) return null;
      return (
          <div className="mb-6 animate-fade-in">
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-medical-400 mr-2"></span>
                  {title}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {options.map(opt => {
                      const isSelected = selectedRegimens[typeKey] === opt.id;
                      return (
                          <div 
                            key={opt.id}
                            onClick={() => handleSelectRegimen(typeKey, opt.id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all relative ${
                                isSelected 
                                ? 'border-medical-500 bg-medical-50 ring-1 ring-medical-500' 
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                              <div className="flex justify-between items-start">
                                  <span className={`font-bold text-sm ${isSelected ? 'text-medical-900' : 'text-gray-800'}`}>{opt.name}</span>
                                  {opt.recommended && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">推荐</span>}
                              </div>
                              <p className="text-xs text-gray-500 mt-1 pr-6">{opt.description}</p>
                              <div className="flex items-center mt-2 gap-2">
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{opt.cycle}</span>
                                {(opt.totalCycles || 0) > 0 && (
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">共{opt.totalCycles}周期</span>
                                )}
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      );
  };

  const selectedChemo = detailedPlan?.chemoOptions.find(c => c.id === selectedRegimens.chemoId);
  const selectedTarget = detailedPlan?.targetOptions.find(c => c.id === selectedRegimens.targetId);
  const selectedImmune = detailedPlan?.immuneOptions.find(c => c.id === selectedRegimens.immuneId);

  const optionsToCalculate = [selectedChemo, selectedTarget, selectedImmune].filter(Boolean) as RegimenOption[];

  return (
    <div className="space-y-8 pb-10 relative">
      
      {/* Input Section */}
      <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-medical-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            临床病理指标输入
        </h3>
        <div className="grid grid-cols-2 gap-4">
            <InputField 
                label="ER (雌激素受体)" 
                value={localMarkers.erStatus} 
                onChange={(v) => setLocalMarkers(prev => ({...prev, erStatus: v}))}
                placeholder="如: 强阳性 90%" 
            />
            <InputField 
                label="PR (孕激素受体)" 
                value={localMarkers.prStatus} 
                onChange={(v) => setLocalMarkers(prev => ({...prev, prStatus: v}))}
                placeholder="如: 阳性 20%" 
            />
            <InputField 
                label="HER2" 
                value={localMarkers.her2Status} 
                onChange={(v) => setLocalMarkers(prev => ({...prev, her2Status: v}))}
                placeholder="如: 阴性 (1+)" 
            />
            <InputField 
                label="Ki-67" 
                value={localMarkers.ki67} 
                onChange={(v) => setLocalMarkers(prev => ({...prev, ki67: v}))}
                placeholder="如: 30%" 
            />
            <InputField 
                label="肿瘤大小 (T)" 
                value={localMarkers.tumorSize} 
                onChange={(v) => setLocalMarkers(prev => ({...prev, tumorSize: v}))}
                placeholder="如: 2.5cm" 
            />
            <InputField 
                label="淋巴结 (N)" 
                value={localMarkers.nodeStatus} 
                onChange={(v) => setLocalMarkers(prev => ({...prev, nodeStatus: v}))}
                placeholder="如: N1 (1/12)" 
            />
        </div>
        <div className="mt-3 flex items-center">
            <input 
                type="checkbox" 
                id="meno"
                checked={localMarkers.menopause}
                onChange={(e) => setLocalMarkers({...localMarkers, menopause: e.target.checked})}
                className="h-4 w-4 text-medical-600 focus:ring-medical-500 border-gray-300 rounded"
            />
            <label htmlFor="meno" className="ml-2 block text-sm text-gray-900">
                患者已绝经
            </label>
        </div>
        
        <div className="mt-6">
            <button 
                onClick={handleGenerateHighLevel}
                disabled={loading}
                className={`w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${loading ? 'bg-gray-400' : 'bg-gradient-to-r from-medical-600 to-accent-500 hover:from-medical-700 hover:to-accent-600'} focus:outline-none transition-all`}
            >
                {loading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        AI 正在分析路径...
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {options.length > 0 ? '重新生成总体路径' : '生成治疗路径'}
                    </>
                )}
            </button>
        </div>
      </section>

      {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100 flex items-start animate-fade-in">
              <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
          </div>
      )}

      {/* Step 1: High Level Path */}
      {options.length > 0 && (
        <section className="animate-fade-in">
           <div className="flex items-center mb-4">
               <div className="w-8 h-8 rounded-full bg-medical-600 text-white flex items-center justify-center font-bold mr-3">1</div>
               <h3 className="text-lg font-bold text-gray-800">选择总体治疗路径</h3>
           </div>
           
           <div className="grid grid-cols-1 gap-4 mb-6">
             {options.map((option) => {
               const isSelected = selectedPlanId === option.id;
               const isRecommended = option.recommended;

               return (
                 <div 
                   key={option.id}
                   onClick={() => handleSelectPlan(option.id)}
                   className={`relative rounded-xl p-5 border-2 cursor-pointer transition-all duration-200 group ${
                     isSelected 
                        ? 'border-medical-600 bg-medical-50 shadow-md ring-1 ring-medical-600' 
                        : isRecommended
                            ? 'border-accent-300 bg-accent-50/40 hover:border-accent-400 hover:shadow-sm' 
                            : 'border-gray-100 bg-white hover:border-medical-200 hover:bg-gray-50'
                   }`}
                 >
                    {isRecommended && (
                        <div className="absolute -top-3 left-4 bg-accent-600 text-white text-xs px-3 py-1 rounded-full font-bold shadow-sm flex items-center z-10 border-2 border-white">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                            指南推荐方案
                        </div>
                    )}
                    <div className="flex items-start gap-4 pt-1">
                        <div className={`p-3 rounded-full flex-shrink-0 ${isSelected ? 'bg-medical-200 text-medical-700' : isRecommended ? 'bg-accent-100 text-accent-700' : 'bg-gray-100 text-gray-500'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {getIcon(option.iconType)}
                            </svg>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center pr-16">
                                <h4 className={`font-bold text-lg ${isSelected ? 'text-medical-900' : 'text-gray-800'}`}>
                                    {option.title}
                                </h4>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                            
                            <div className="mt-3 space-y-2 text-xs">
                                {option.pros && option.pros.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {option.pros.map((pro, i) => (
                                            <span key={`pro-${i}`} className="px-2 py-1 rounded bg-green-50 text-green-700 border border-green-100 flex items-center">
                                                <span className="font-bold mr-1">+</span> {pro}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {option.cons && option.cons.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {option.cons.map((con, i) => (
                                            <span key={`con-${i}`} className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-100 flex items-center">
                                                <span className="font-bold mr-1">-</span> {con}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${isSelected ? 'border-medical-500 bg-medical-500' : 'border-gray-300'}`}>
                             {isSelected && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                    </div>
                 </div>
               );
             })}
           </div>

           {/* Step 1 to Step 2 Trigger */}
           {selectedPlanId && (
               <div className="flex justify-end">
                    {!detailedPlan && (
                        <button 
                            onClick={handleGenerateDetailed}
                            disabled={generatingDetail}
                            className="bg-medical-600 text-white px-6 py-2 rounded-full shadow-lg font-medium hover:bg-medical-700 disabled:bg-gray-300 transition-colors flex items-center"
                        >
                            {generatingDetail ? 'AI 正在细化方案...' : '下一步：制定详细用药'}
                            {!generatingDetail && <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>}
                        </button>
                    )}
               </div>
           )}
        </section>
      )}

      {/* Step 2: Detailed Regimens */}
      {detailedPlan && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-fade-in">
              <div className="flex items-center mb-6 border-b border-gray-100 pb-4">
                <div className="w-8 h-8 rounded-full bg-medical-600 text-white flex items-center justify-center font-bold mr-3">2</div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">详细药物/治疗方案</h3>
                    <p className="text-xs text-gray-500">请在以下类别中勾选具体的执行方案</p>
                </div>
                <button onClick={handleGenerateDetailed} className="ml-auto text-xs text-medical-600 underline">
                    {generatingDetail ? '更新中...' : '重新生成'}
                </button>
              </div>

              <RegimenSection title="化疗方案 (Chemotherapy)" options={detailedPlan.chemoOptions} typeKey="chemoId" />
              <RegimenSection title="内分泌治疗 (Endocrine Therapy)" options={detailedPlan.endocrineOptions} typeKey="endocrineId" />
              <RegimenSection title="靶向治疗 (Targeted Therapy)" options={detailedPlan.targetOptions} typeKey="targetId" />
              <RegimenSection title="免疫治疗 (Immunotherapy)" options={detailedPlan.immuneOptions} typeKey="immuneId" />

              {/* Dosage Calculator (Calculates for Chemo, Target & Immune) */}
              {optionsToCalculate.length > 0 && (
                 <>
                    <DosageCalculator 
                        options={optionsToCalculate}
                        initialHeight={patient.height}
                        initialWeight={patient.weight}
                        onUpdateStats={(h, w) => onUpdatePatientStats && onUpdatePatientStats(h, w)}
                    />
                    
                    {/* Step 3: Schedule Generator */}
                    {onBatchAddEvents && (
                        <ScheduleGenerator 
                            selectedOptions={optionsToCalculate}
                            onSaveEvents={onBatchAddEvents}
                        />
                    )}
                 </>
              )}
          </section>
      )}
    </div>
  );
};

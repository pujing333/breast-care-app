
export enum MolecularSubtype {
  LuminalA = 'Luminal A',
  LuminalB = 'Luminal B',
  HER2Positive = 'HER2 Positive',
  TripleNegative = 'Triple Negative',
  Unknown = '待定'
}

export enum TreatmentStage {
  Diagnosis = '初步诊断',
  Neoadjuvant = '新辅助治疗',
  Surgery = '手术',
  Adjuvant = '辅助治疗',
  FollowUp = '随访'
}

export interface ClinicalMarkers {
  erStatus: string; // Estrogen Receptor
  prStatus: string; // Progesterone Receptor
  her2Status: string; // HER2
  ki67: string; // Proliferation index
  tumorSize: string; // cT
  nodeStatus: string; // cN
  menopause: boolean; // Menopause status
}

export interface TreatmentEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  completed: boolean;
  type: 'medication' | 'surgery' | 'exam' | 'other';
  sideEffects?: string[]; // List of side effects keys e.g. ['Nausea']
}

export interface TreatmentOption {
  id: string;
  title: string;
  iconType: 'surgery' | 'chemo' | 'drug' | 'observation';
  description: string;
  duration: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
}

export interface DrugDetail {
  name: string;
  standardDose: number; // mg/m2 or AUC
  unit: string; // 'mg/m²' or 'AUC' or 'mg'
}

export interface RegimenOption {
  id: string;
  name: string; // e.g. "AC-T"
  description: string; // e.g. "Doxorubicin + Cyclophosphamide..."
  cycle: string; // e.g. "q2w x 4"
  type: 'chemo' | 'endocrine' | 'target' | 'immune';
  recommended: boolean;
  drugs?: DrugDetail[]; // Specific drugs in this regimen
  totalCycles?: number; // e.g. 4 or 6 or 8
  frequencyDays?: number; // e.g. 14 or 21
}

export interface DetailedRegimenPlan {
  chemoOptions: RegimenOption[];
  endocrineOptions: RegimenOption[];
  targetOptions: RegimenOption[];
  immuneOptions: RegimenOption[];
}

export interface SelectedRegimens {
  chemoId?: string;
  endocrineId?: string;
  targetId?: string;
  immuneId?: string;
}

export interface SideEffectDetail {
  strategies: string[]; // Nursing/Lifestyle advice
  medications: string[]; // Recommended drugs
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  mrn: string; // Medical Record Number
  admissionDate: string;
  diagnosis: string;
  subtype: MolecularSubtype;
  stage: TreatmentStage;
  markers: ClinicalMarkers;
  
  height?: number; // cm
  weight?: number; // kg

  treatmentOptions?: TreatmentOption[]; // AI generated high-level options
  selectedPlanId?: string; // The option the doctor selected
  
  detailedPlan?: DetailedRegimenPlan; // AI generated specific drug options
  selectedRegimens?: SelectedRegimens; // The specific drugs the doctor selected

  aiSuggestion?: string; // Legacy text (optional)
  timeline: TreatmentEvent[];
}

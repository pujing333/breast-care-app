
import React, { useState } from 'react';
import { Patient, ClinicalMarkers, TreatmentEvent, TreatmentOption, DetailedRegimenPlan, SelectedRegimens } from '../types';
import { Header } from './Header';
import { Timeline } from './Timeline';
import { AITreatmentAssistant } from './AITreatmentAssistant';

interface PatientDetailProps {
  patient: Patient;
  onBack: () => void;
  onUpdatePatient: (updatedPatient: Patient) => void;
}

type Tab = 'overview' | 'treatment' | 'timeline';

export const PatientDetail: React.FC<PatientDetailProps> = ({ patient, onBack, onUpdatePatient }) => {
  const [activeTab, setActiveTab] = useState<Tab>('treatment');

  const handleAddEvent = (event: Omit<TreatmentEvent, 'id'>) => {
    const newEvent: TreatmentEvent = {
      ...event,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };
    const updatedPatient = {
      ...patient,
      timeline: [...patient.timeline, newEvent]
    };
    onUpdatePatient(updatedPatient);
  };

  const handleUpdateEvent = (updatedEvent: TreatmentEvent) => {
      const updatedTimeline = patient.timeline.map(evt => 
        evt.id === updatedEvent.id ? updatedEvent : evt
      );
      onUpdatePatient({
          ...patient,
          timeline: updatedTimeline
      });
  };

  const handleBatchAddEvents = (events: Omit<TreatmentEvent, 'id'>[]) => {
      const newEvents = events.map(evt => ({
          ...evt,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      }));
      const updatedPatient = {
          ...patient,
          timeline: [...patient.timeline, ...newEvents]
      };
      onUpdatePatient(updatedPatient);
      setActiveTab('timeline'); // Switch to timeline tab to show results
  };

  const handleUpdateMarkers = (markers: ClinicalMarkers) => {
    onUpdatePatient({ ...patient, markers });
  };

  const handleUpdateStats = (height: number, weight: number) => {
      if (patient.height !== height || patient.weight !== weight) {
          onUpdatePatient({ ...patient, height, weight });
      }
  };

  const handleSaveOptions = (options: TreatmentOption[], selectedId: string | undefined) => {
    onUpdatePatient({ 
        ...patient, 
        treatmentOptions: options,
        selectedPlanId: selectedId 
    });
  };

  const handleSaveDetailedPlan = (plan: DetailedRegimenPlan, selectedRegimens: SelectedRegimens) => {
      onUpdatePatient({
          ...patient,
          detailedPlan: plan,
          selectedRegimens: selectedRegimens
      });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Header 
        title={`${patient.name} (${patient.age}岁)`} 
        onBack={onBack} 
        rightAction={
            <div className="text-xs bg-medical-100 text-medical-700 px-2 py-1 rounded">{patient.diagnosis}</div>
        }
      />

      {/* Tab Nav */}
      <div className="bg-white shadow-sm flex justify-around border-b border-gray-200 sticky top-14 z-30 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: '基本信息' },
          { id: 'treatment', label: '方案决策' },
          { id: 'timeline', label: '日程管理' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex-none px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? 'border-medical-600 text-medical-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
            <h3 className="font-bold text-gray-800 border-b pb-2">基本资料</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span className="text-gray-500 block">住院号</span>
                    <span className="text-gray-900">{patient.mrn}</span>
                </div>
                <div>
                    <span className="text-gray-500 block">入院日期</span>
                    <span className="text-gray-900">{patient.admissionDate}</span>
                </div>
                <div>
                    <span className="text-gray-500 block">当前阶段</span>
                    <span className="text-gray-900">{patient.stage}</span>
                </div>
                <div>
                    <span className="text-gray-500 block">分子分型</span>
                    <span className="text-gray-900">{patient.subtype}</span>
                </div>
                <div>
                    <span className="text-gray-500 block">身高</span>
                    <span className="text-gray-900">{patient.height ? `${patient.height} cm` : '--'}</span>
                </div>
                <div>
                    <span className="text-gray-500 block">体重</span>
                    <span className="text-gray-900">{patient.weight ? `${patient.weight} kg` : '--'}</span>
                </div>
            </div>
            
            {patient.selectedPlanId && patient.treatmentOptions && (
                <div className="mt-6 bg-medical-50 border border-medical-100 rounded-lg p-3">
                    <h4 className="text-medical-800 font-bold text-sm mb-1">已选总体路径</h4>
                    <p className="text-medical-700 text-sm mb-3">
                        {patient.treatmentOptions.find(o => o.id === patient.selectedPlanId)?.title}
                    </p>
                </div>
            )}
          </div>
        )}

        {activeTab === 'treatment' && (
          <AITreatmentAssistant 
            patient={patient}
            onUpdateMarkers={handleUpdateMarkers}
            onSaveOptions={handleSaveOptions}
            onSaveDetailedPlan={handleSaveDetailedPlan}
            onUpdatePatientStats={handleUpdateStats}
            onBatchAddEvents={handleBatchAddEvents}
          />
        )}

        {activeTab === 'timeline' && (
          <Timeline 
            patient={patient}
            onAddEvent={handleAddEvent}
            onUpdateEvent={handleUpdateEvent}
          />
        )}
      </div>
    </div>
  );
};

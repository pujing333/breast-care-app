import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PatientList } from './components/PatientList';
import { PatientDetail } from './components/PatientDetail';
import { AddPatientForm } from './components/AddPatientForm';
import { Patient } from './types';
import { INITIAL_PATIENTS } from './constants';

function App() {
  const [patients, setPatients] = useState<Patient[]>(() => {
      const saved = localStorage.getItem('patients');
      return saved ? JSON.parse(saved) : INITIAL_PATIENTS;
  });
  
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isAddingPatient, setIsAddingPatient] = useState(false);

  // Persist data
  useEffect(() => {
    localStorage.setItem('patients', JSON.stringify(patients));
  }, [patients]);

  const activePatient = patients.find(p => p.id === selectedPatientId);

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setIsAddingPatient(false);
  };

  const handleBack = () => {
    setSelectedPatientId(null);
  };

  const handleUpdatePatient = (updated: Patient) => {
    setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleAddPatientClick = () => {
    setIsAddingPatient(true);
    setSelectedPatientId(null);
  };

  const handleSaveNewPatient = (patientData: Omit<Patient, 'id'>) => {
    const newId = Date.now().toString();
    const newPatient: Patient = {
      ...patientData,
      id: newId
    };
    setPatients([newPatient, ...patients]);
    setIsAddingPatient(false);
    setSelectedPatientId(newId);
  };

  return (
    // 使用 h-[100dvh] 代替 min-h-screen，完美适配手机浏览器动态地址栏
    <div className="h-[100dvh] w-screen overflow-hidden bg-gray-50 font-sans text-gray-900 flex flex-col">
      {isAddingPatient ? (
        <AddPatientForm 
          onSave={handleSaveNewPatient} 
          onCancel={() => setIsAddingPatient(false)} 
        />
      ) : selectedPatientId && activePatient ? (
        <PatientDetail 
          patient={activePatient}
          onBack={handleBack}
          onUpdatePatient={handleUpdatePatient}
        />
      ) : (
        <>
          <Header title="乳腺外科患者管理" />
          <PatientList 
            patients={patients} 
            onSelectPatient={handleSelectPatient} 
            onAddPatient={handleAddPatientClick}
          />
        </>
      )}
    </div>
  );
}

export default App;

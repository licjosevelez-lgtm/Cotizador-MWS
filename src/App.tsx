import React, { useState, useEffect } from 'react';
import { Machine, VolumeParameters, GeneralParameters, PartNumber } from './types';
import { INITIAL_MACHINES, INITIAL_VOLUME_PARAMETERS, INITIAL_GENERAL_PARAMETERS, INITIAL_PART_NUMBERS } from './data/defaultData';
import { MainDashboard } from './components/MainDashboard';
import { MachineCostModule } from './components/MachineCostModule';
import { ParametersModule } from './components/ParametersModule';
import { PartNumbersModule } from './components/PartNumbersModule';
import { QuotationGenerator } from './components/QuotationGenerator';
import { ProjectionView } from './components/ProjectionView';
import { QuotationHistory } from './components/QuotationHistory';
import { MachineRental } from './components/MachineRental';
import { MarginalAnalysis } from './components/MarginalAnalysis';
import { LayoutDashboard, Wrench, Settings, ClipboardList, RefreshCw, FileText, BarChart3, History, Layers, TrendingUp } from 'lucide-react';
import { PartNumbersProvider, usePartNumbers } from './contexts/PartNumbersContext';
import Swal from 'sweetalert2';

function AppContent() {
  // Persistence state
  const [isLoaded, setIsLoaded] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [volParams, setVolParams] = useState<VolumeParameters>({
    altoPercentage: 200,
    medioPercentage: 250,
    bajoPercentage: 300,
    factoryPercentage: 400
  });
  const [genParams, setGenParams] = useState<GeneralParameters>({
    operatorHourlyCost: 15.0,
    manufacturingBurdenPercentage: 3.5,
    generalAdminPercentage: 3.0,
    salesPercentage: 3.0,
    profitPercentage: 15.0
  });

  const { partNumbers, setPartNumbers } = usePartNumbers();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'machines' | 'params' | 'parts' | 'quotation' | 'projection' | 'marginal' | 'rental' | 'history'>('dashboard');
  const [selectedQuotationPartId, setSelectedQuotationPartId] = useState<string | undefined>(undefined);
  const [selectedQuotationPartIds, setSelectedQuotationPartIds] = useState<string[] | undefined>(undefined);

  // Load other settings from local storage
  useEffect(() => {
    try {
      const storedMachines = localStorage.getItem('industrial_machines');
      const storedVolParams = localStorage.getItem('industrial_vol_params');
      const storedGenParams = localStorage.getItem('industrial_gen_params');

      if (storedMachines) {
        setMachines(JSON.parse(storedMachines));
      } else {
        setMachines(INITIAL_MACHINES);
      }

      if (storedVolParams) {
        setVolParams(JSON.parse(storedVolParams));
      } else {
        setVolParams(INITIAL_VOLUME_PARAMETERS);
      }

      if (storedGenParams) {
        setGenParams(JSON.parse(storedGenParams));
      } else {
        setGenParams(INITIAL_GENERAL_PARAMETERS);
      }
    } catch (e) {
      console.error('Failed to load initial storage:', e);
      // Fallback
      setMachines(INITIAL_MACHINES);
      setVolParams(INITIAL_VOLUME_PARAMETERS);
      setGenParams(INITIAL_GENERAL_PARAMETERS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save changes automatically
  const handleUpdateMachines = (newMachines: Machine[]) => {
    setMachines(newMachines);
    localStorage.setItem('industrial_machines', JSON.stringify(newMachines));
  };

  const handleUpdateVolParams = (newVol: VolumeParameters) => {
    setVolParams(newVol);
    localStorage.setItem('industrial_vol_params', JSON.stringify(newVol));
  };

  const handleUpdateGenParams = (newGen: GeneralParameters) => {
    setGenParams(newGen);
    localStorage.setItem('industrial_gen_params', JSON.stringify(newGen));
  };

  const handleUpdatePartNumbers = (newParts: PartNumber[]) => {
    setPartNumbers(newParts);
  };

  const handleSelectPartAndEdit = (part: PartNumber) => {
    // Navigate directly to editing form of part numbers
    setActiveTab('parts');
  };

  const handleNavigateToQuote = (partId: string) => {
    setSelectedQuotationPartId(partId);
    setActiveTab('quotation');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800" id="app-root-container">
      {/* Top Professional Executive Header */}
      <header className="bg-slate-900 text-white shadow-md border-b border-slate-700 print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="bg-slate-950 px-4 py-2 rounded border border-slate-700 flex flex-col justify-center items-center shadow-inner select-none">
              <span className="text-sm font-black tracking-wider text-white">METALWORK</span>
              <span className="text-[9px] font-bold tracking-[0.25em] text-indigo-400 -mt-0.5 leading-none uppercase">& STAMPING</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Sistema Automático de Cotizaciones Industriales</h1>
              </div>
              <p className="text-xs text-slate-400">Automatización de Costos ExWorks de Estampado Basado en Tarifas Variables por Volumen</p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation and Actions */}
      <nav className="bg-white border-b border-gray-100 flex overflow-x-auto gap-1 px-4 py-1.5 max-w-7xl w-full mx-auto print:hidden">
        <button
          id="tab-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-indigo-50 text-indigo-700 font-extrabold'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/50'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Panel de Control
        </button>

        <button
          id="tab-machines"
          onClick={() => setActiveTab('machines')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'machines'
              ? 'bg-indigo-50 text-indigo-700 font-extrabold'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/50'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Prensas y Tarifas
        </button>

        <button
          id="tab-params"
          onClick={() => setActiveTab('params')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'params'
              ? 'bg-indigo-50 text-indigo-700 font-extrabold'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/50'
          }`}
        >
          <Settings className="w-4 h-4" />
          Ecuación / Márgenes
        </button>

        <button
          id="tab-parts"
          onClick={() => setActiveTab('parts')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'parts'
              ? 'bg-indigo-50 text-indigo-700 font-extrabold'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/50'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Modelar Números de Parte
        </button>

        <button
          id="tab-quotation"
          onClick={() => {
            setSelectedQuotationPartId(undefined);
            setSelectedQuotationPartIds(undefined);
            setActiveTab('quotation');
          }}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'quotation'
              ? 'bg-indigo-50 text-indigo-700 font-extrabold'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          Formatos de Cotización
        </button>

        <button
          id="tab-projection"
          onClick={() => {
            setActiveTab('projection');
          }}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'projection'
              ? 'bg-indigo-50 text-indigo-700 font-extrabold'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Matriz de Precios
        </button>

        <button
          id="tab-marginal"
          onClick={() => {
            setActiveTab('marginal');
          }}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'marginal'
              ? 'bg-indigo-50 text-indigo-700 font-extrabold'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Análisis Marginal
        </button>

        <button
          id="tab-rental"
          onClick={() => {
            setActiveTab('rental');
          }}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'rental'
              ? 'bg-indigo-50 text-indigo-700 font-extrabold'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/50'
          }`}
        >
          <Layers className="w-4 h-4" />
          Renta de Máquina
        </button>

        <button
          id="tab-history"
          onClick={() => {
            setActiveTab('history');
          }}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'bg-indigo-50 text-indigo-700 font-extrabold'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/50'
          }`}
        >
          <History className="w-4 h-4" />
          Histórico de Cotizaciones
        </button>
      </nav>

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6" id="workspace-viewport">
        {/* Render active module */}
        {activeTab === 'dashboard' && (
          <MainDashboard
            partNumbers={partNumbers}
            machines={machines}
            volParams={volParams}
            genParams={genParams}
            onUpdatePartNumbers={handleUpdatePartNumbers}
            onSelectPart={handleSelectPartAndEdit}
            onNavigateToQuote={handleNavigateToQuote}
          />
        )}

        {activeTab === 'machines' && (
          <MachineCostModule
            machines={machines}
            volParams={volParams}
            onUpdateMachines={handleUpdateMachines}
          />
        )}

        {activeTab === 'params' && (
          <ParametersModule
            volParams={volParams}
            genParams={genParams}
            onVolParamsChange={handleUpdateVolParams}
            onGenParamsChange={handleUpdateGenParams}
          />
        )}

        {activeTab === 'parts' && (
          <PartNumbersModule
            machines={machines}
            volParams={volParams}
            genParams={genParams}
            onSelectPart={handleSelectPartAndEdit}
            onNavigateToMultipleQuotes={(ids) => {
              setSelectedQuotationPartIds(ids);
              setSelectedQuotationPartId(undefined);
              setActiveTab('quotation');
            }}
            activeTab={activeTab}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'quotation' && (
          <QuotationGenerator
            partNumbers={partNumbers}
            machines={machines}
            volParams={volParams}
            genParams={genParams}
            selectedPartId={selectedQuotationPartId}
            selectedPartIds={selectedQuotationPartIds}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'projection' && (
          <ProjectionView
            partNumbers={partNumbers}
            machines={machines}
            volParams={volParams}
            genParams={genParams}
            onUpdatePartNumbers={handleUpdatePartNumbers}
          />
        )}

        {activeTab === 'marginal' && (
          <MarginalAnalysis
            machines={machines}
            volParams={volParams}
            genParams={genParams}
          />
        )}

        {activeTab === 'rental' && (
          <MachineRental
            machines={machines}
            genParams={genParams}
          />
        )}

        {activeTab === 'history' && (
          <QuotationHistory
            machines={machines}
            volParams={volParams}
            genParams={genParams}
            partNumbers={partNumbers}
          />
        )}
      </main>

      {/* Mini footer */}
      <footer className="bg-white border-t border-gray-100 py-3.5 px-4 text-center text-[10px] font-bold text-slate-400 print:hidden mt-auto">
        Metalwork & Stamping S.A de C.V • Departamento de Estimaciones de Precios y Costeo Industrial
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <PartNumbersProvider>
      <AppContent />
    </PartNumbersProvider>
  );
}

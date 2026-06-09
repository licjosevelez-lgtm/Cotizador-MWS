import React, { useState, useEffect } from 'react';
import { 
  getHistory, 
  saveToHistory, 
  getLatestRevision, 
  downloadQuotationPDF, 
  QuotationHistoryEntry, 
  QuotationHistoryItem 
} from '../services/quotationHistoryService';
import { 
  FileText, 
  Search, 
  Printer, 
  Edit2, 
  X, 
  Calendar, 
  User, 
  Plus, 
  Check, 
  AlertCircle,
  Hash,
  ChevronRight,
  TrendingUp,
  LayoutGrid
} from 'lucide-react';
import { PartNumber, Machine, VolumeParameters, GeneralParameters } from '../types';
import Swal from 'sweetalert2';

interface QuotationHistoryProps {
  machines: Machine[];
  volParams: VolumeParameters;
  genParams: GeneralParameters;
  partNumbers: PartNumber[];
}

export const QuotationHistory: React.FC<QuotationHistoryProps> = ({
  machines,
  volParams,
  genParams,
  partNumbers,
}) => {
  const [historyList, setHistoryList] = useState<QuotationHistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('Todos');

  // Modals state
  const [selectedEntry, setSelectedEntry] = useState<QuotationHistoryEntry | null>(null);
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 = closed, 1 = confirm revision, 2 = edit revision

  // Step 2 Form States
  const [revisedClient, setRevisedClient] = useState('');
  const [revisedDate, setRevisedDate] = useState('');
  const [nextRevisionNumber, setNextRevisionNumber] = useState('02');
  const [editItems, setEditItems] = useState<Array<{
    partNumber: string;
    description: string;
    unitPrice: number;
    volumeCategory: 'Alto' | 'Medio' | 'Bajo' | 'Factory';
    weeklyVolume?: number;
    originalPartId?: string; // fallback matching UUID
  }>>([]);

  // Load history on mount
  useEffect(() => {
    setHistoryList(getHistory());
  }, []);

  const refreshHistory = () => {
    setHistoryList(getHistory());
  };

  // Clients list computed from history entries for dropdown selection
  const clients = React.useMemo(() => {
    const set = new Set<string>();
    historyList.forEach((entry) => {
      if (entry.clientName?.trim()) {
        set.add(entry.clientName.trim());
      }
    });
    return ['Todos', ...Array.from(set)];
  }, [historyList]);

  // Filtered entries
  const filteredEntries = historyList.filter((entry) => {
    const matchesNum = entry.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase().trim());
    const matchesClient = clientFilter === 'Todos' || entry.clientName.toLowerCase().trim() === clientFilter.toLowerCase().trim();
    return matchesNum && matchesClient;
  });

  // Action: Reprint (PDF directly from historical snapshot)
  const handleReprint = async (entry: QuotationHistoryEntry) => {
    try {
      await downloadQuotationPDF(entry.fullDataSnapshot, entry.quotationNumber, entry.revision);
      Swal.fire({
        title: 'Reimpresión generada',
        text: `La cotización ${entry.quotationNumber} Rev. ${entry.revision} se ha descargado de nuevo sin modificar el histórico.`,
        icon: 'success',
        confirmButtonColor: '#4f46e5',
      });
    } catch (e) {
      console.error(e);
      Swal.fire({
        title: 'Error de impresión',
        text: 'Ocurrió un detalle al intentar reimprimir la cotización.',
        icon: 'error',
        confirmButtonColor: '#4f46e5',
      });
    }
  };

  // Action: Revise (Start Modal Flow)
  const handleOpenReviseFlow = (entry: QuotationHistoryEntry) => {
    // 1. Calculate next revision number
    const latest = getLatestRevision(entry.quotationNumber);
    let nextRev = 2;
    if (latest) {
      const parsedRev = parseInt(latest.revision, 10);
      nextRev = isNaN(parsedRev) ? 2 : parsedRev + 1;
    } else {
      const parsedRev = parseInt(entry.revision, 10);
      nextRev = isNaN(parsedRev) ? 2 : parsedRev + 1;
    }
    const nextRevString = String(nextRev).padStart(2, '0');

    setSelectedEntry(entry);
    setNextRevisionNumber(nextRevString);
    setStep(1); // Open step 1 modal
  };

  // Move from Step 1 to Step 2
  const handleContinueToEdit = () => {
    if (!selectedEntry) return;

    // Load original snapshot values to editable form state
    setRevisedClient(selectedEntry.clientName);
    
    // Default emission date to today's date formatted nicely
    const today = new Date();
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const formattedToday = `${today.getDate()}/${months[today.getMonth()]}/${today.getFullYear()}`;
    setRevisedDate(formattedToday);

    // Load items to modify
    const snapshotParts = selectedEntry.fullDataSnapshot.partNumbers || [];
    const selectedIds = selectedEntry.fullDataSnapshot.selectedPartIds || [];
    const selectedId = selectedEntry.fullDataSnapshot.selectedPartId;

    // Filter parts that were actually in the quotation print
    const displayedSnapshotParts = selectedIds.length > 0
      ? snapshotParts.filter((p: any) => selectedIds.includes(p.id))
      : selectedId
      ? snapshotParts.filter((p: any) => p.id === selectedId)
      : snapshotParts;

    const initialEditableItems = displayedSnapshotParts.map((part: any) => {
      // Find matching item record inside quotation history's `items` array to get the previous unit price & volume category
      const histItem = selectedEntry.items.find((item) => item.partNumber === part.partNumber);
      
      return {
        partNumber: part.partNumber,
        description: part.description,
        unitPrice: histItem ? histItem.unitPrice : 0,
        volumeCategory: (histItem?.volumeCategory || part.volumeCategory || 'Alto') as 'Alto' | 'Medio' | 'Bajo' | 'Factory',
        weeklyVolume: histItem ? histItem.weeklyVolume : part.weeklyVolume,
        originalPartId: part.id,
      };
    });

    setEditItems(initialEditableItems);
    setStep(2); // Open Step 2 Modal
  };

  // Modify individual item unit target price
  const handleItemPriceChange = (index: number, val: string) => {
    const updated = [...editItems];
    const parsed = parseFloat(val);
    updated[index].unitPrice = isNaN(parsed) ? 0 : parsed;
    setEditItems(updated);
  };

  // Modify individual item volume category
  const handleItemCategoryChange = (index: number, cat: 'Alto' | 'Medio' | 'Bajo' | 'Factory') => {
    const updated = [...editItems];
    updated[index].volumeCategory = cat;
    
    // Automatically set default weekly volume matching category standard if not set
    if (cat === 'Alto') updated[index].weeklyVolume = 16000;
    else if (cat === 'Medio') updated[index].weeklyVolume = 8000;
    else if (cat === 'Bajo') updated[index].weeklyVolume = 1500;
    else updated[index].weeklyVolume = 1000;

    setEditItems(updated);
  };

  // Modify individual item weekly volume
  const handleItemVolumeChange = (index: number, val: string) => {
    const updated = [...editItems];
    const parsed = parseInt(val, 10);
    updated[index].weeklyVolume = isNaN(parsed) ? undefined : parsed;
    setEditItems(updated);
  };

  // Finish Step 2: Generar y guardar la nueva revisión
  const handleSaveAndGenerateRevision = async () => {
    if (!selectedEntry) return;

    if (!revisedClient.trim()) {
      Swal.fire({
        title: 'Cliente requerido',
        text: 'Por favor, introduce el nombre del cliente para la revisión.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5',
      });
      return;
    }

    try {
      // 1. Clone original snapshot partNumbers and update their targets and volume categories
      const originalSnapshot = selectedEntry.fullDataSnapshot;
      const updatedSnapshotParts = (originalSnapshot.partNumbers || []).map((part: any) => {
        // Find if this part was modified in our edit list
        const edited = editItems.find((e) => e.partNumber === part.partNumber);
        if (edited) {
          return {
            ...part,
            client: revisedClient, // sync client name
            targetPrice: edited.unitPrice,
            volumeCategory: edited.volumeCategory,
            weeklyVolume: edited.weeklyVolume,
          };
        }
        return part;
      });

      // 2. Build the updated fullDataSnapshot
      const newSnapshot = {
        ...originalSnapshot,
        customerName: revisedClient,
        quoteDate: revisedDate,
        quoteNoMW: nextRevisionNumber, // Store revision level as quoteNoMW
        partNumbers: updatedSnapshotParts,
      };

      // 3. Prepare the history entry items array
      const newHistoryItems: QuotationHistoryItem[] = editItems.map((item) => ({
        partNumber: item.partNumber,
        description: item.description,
        unitPrice: item.unitPrice,
        volumeCategory: item.volumeCategory,
        weeklyVolume: item.weeklyVolume,
      }));

      // 4. Save to history (triggers automatic deactivation of previous latest revision flags)
      const saved = saveToHistory({
        quotationNumber: selectedEntry.quotationNumber,
        revision: nextRevisionNumber,
        clientName: revisedClient,
        emissionDate: revisedDate,
        items: newHistoryItems,
        fullDataSnapshot: newSnapshot,
      });

      // Close modal state
      setStep(0);
      setSelectedEntry(null);
      refreshHistory();

      // 5. Trigger download
      await downloadQuotationPDF(newSnapshot, selectedEntry.quotationNumber, nextRevisionNumber);

      Swal.fire({
        title: '¡Revisión Generada!',
        text: `Se generó exitosamente la revisión ${nextRevisionNumber} para la cotización ${selectedEntry.quotationNumber}.`,
        icon: 'success',
        confirmButtonColor: '#4f46e5',
      });

    } catch (err) {
      console.error(err);
      Swal.fire({
        title: 'Error al generar revisión',
        text: 'No se pudo guardar ni compilar la nueva revisión de cotización.',
        icon: 'error',
        confirmButtonColor: '#4f46e5',
      });
    }
  };

  return (
    <div className="space-y-6" id="quotation-history-module">
      {/* Header and statistics */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Histórico de Cotizaciones</h2>
          <p className="text-xs text-gray-500">Historial completo de propuestas comerciales generadas y control secuencial de revisiones.</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 font-sans flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span className="text-xs text-indigo-900 font-bold">
            Total cotizadas: <span className="text-indigo-700 font-extrabold">{historyList.length}</span>
          </span>
        </div>
      </div>

      {/* Filters search */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-sm font-bold text-gray-800">Búsqueda y Filtros de Historial</h3>
          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto flex items-center">
              <input
                id="search-history"
                type="text"
                placeholder="Buscar por folio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-gray-200 focus:ring-1 focus:ring-indigo-400 pl-3 pr-8 py-1.5 rounded-lg text-xs focus:outline-none transition-colors w-full sm:w-48 placeholder:text-gray-400 font-medium"
              />
              <span className="absolute right-2.5 text-gray-400 pointer-events-none">
                <Search className="w-3.5 h-3.5" />
              </span>
            </div>
            
            <select
              id="filter-client"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100/70 border border-gray-200 p-1.5 rounded-lg text-xs focus:outline-none cursor-pointer text-gray-700 w-full sm:w-44 font-medium"
            >
              {clients.map((c) => (
                <option key={c} value={c}>{c === 'Todos' ? 'Todos los Clientes' : c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-sm font-bold text-gray-700">Sin historial de cotizaciones</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Las cotizaciones oficiales se registrarán automáticamente aquí una vez que generes tu primera descarga de PDF desde la sección "Formatos de Cotización".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-slate-50/40">
                  <th className="py-3 px-4">Folio Cotización</th>
                  <th className="py-3 px-4 text-center">Revisión</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Piezas Cotizadas</th>
                  <th className="py-3 px-4 text-center">Estado de Rev.</th>
                  <th className="py-3 px-4">Fecha Emisión</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEntries.map((entry) => {
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors text-xs text-gray-700">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">{entry.quotationNumber}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                          Rev {entry.revision}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-800">{entry.clientName}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {entry.items.map((item, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-1.5 leading-none">
                              <span className="font-bold text-slate-800 text-[11px]">{item.partNumber}</span>
                              <span className="text-[10px] text-gray-400">({item.volumeCategory || 'N/A'})</span>
                              <span className="font-mono text-indigo-600 font-semibold text-[11px]">$ {item.unitPrice.toFixed(2)} USD</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {entry.isLatestRevision ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Última versión
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-400">
                            Previa
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono">{entry.emissionDate}</td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            id={`reprint-${entry.id}`}
                            title="Reimprimir PDF Idéntico"
                            onClick={() => handleReprint(entry)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-200"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500" />
                            Reimprimir
                          </button>
                          
                          <button
                            id={`revise-${entry.id}`}
                            title="Generar Nueva Revisión Modificable"
                            onClick={() => handleOpenReviseFlow(entry)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/70 rounded-lg transition-colors cursor-pointer border border-indigo-100"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                            Revizar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Paso 1: Confirmar Número de Cotización y Revisión */}
      {step === 1 && selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-gray-100 overflow-hidden animate-scale-up">
            <div className="bg-slate-900 px-5 py-4 text-white flex justify-between items-center">
              <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <Hash className="w-4 h-4 text-indigo-400" />
                Paso 1: Confirmación de Revisión
              </h3>
              <button 
                onClick={() => setStep(0)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3text-amber-800">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-amber-900">Control de Estructura de Folio</span>
                  <p className="text-[11px] text-amber-800 leading-normal">
                    Se va a abrir un flujo regulado de revisión técnica. Se mantendrá el mismo folio de cotización correlacionado de manera oficial.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Folio Original</span>
                  <span className="text-sm font-extrabold text-slate-800 font-mono block mt-1">{selectedEntry.quotationNumber}</span>
                </div>
                <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 text-center">
                  <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">Nueva Revisión</span>
                  <span className="text-sm font-extrabold text-indigo-700 font-mono block mt-1">Rev {nextRevisionNumber}</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-normal">
                Al continuar, podrás ajustar los targets de precios de venta (Unit Prices) y categorías de volumen para cada número de parte individual, además de actualizar el cliente o fecha de emisión si cambian las condiciones.
              </p>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setStep(0)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleContinueToEdit}
                className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Continuar a Edición
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Paso 2: Ventana de Edición de la propuesta */}
      {step === 2 && selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-gray-100 overflow-hidden my-8 animate-scale-up">
            <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-indigo-400" />
                  Paso 2: Edición de Nueva Revisión
                </h3>
                <p className="text-[10px] text-slate-400 block font-bold font-mono mt-0.5">
                  Foliado: {selectedEntry.quotationNumber} • Nueva Rev: {nextRevisionNumber}
                </p>
              </div>
              <button 
                onClick={() => setStep(0)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Header metadata form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="rev-client" className="text-[11px] font-bold text-gray-600 uppercase flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    Cliente (Firma Comercial)
                  </label>
                  <input
                    id="rev-client"
                    type="text"
                    value={revisedClient}
                    onChange={(e) => setRevisedClient(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-400 p-2.5 rounded-lg text-xs font-semibold focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="rev-date" className="text-[11px] font-bold text-gray-600 uppercase flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    Fecha de Emisión
                  </label>
                  <input
                    id="rev-date"
                    type="text"
                    value={revisedDate}
                    onChange={(e) => setRevisedDate(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-400 p-2.5 rounded-lg text-xs font-semibold focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Items editing table */}
              <div className="space-y-3">
                <span className="text-[11px] font-black text-slate-800 uppercase block leading-none tracking-wider">
                  Listado de Números de Parte / Propuesta Comercial
                </span>
                <p className="text-[10px] text-slate-400 block leading-tight">
                  Modifica los targets finales (USD) y las categorías que asocian el escalonamiento de volumen para los multiplicadores.
                </p>

                <div className="border border-slate-150 rounded-lg overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-150">
                        <th className="py-2.5 px-3">N. Parte</th>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3 text-center">Categoría Volumen</th>
                        <th className="py-2.5 px-3 text-center">Volumen Semanal</th>
                        <th className="py-2.5 px-3 text-right">Target Price Unit. (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {editItems.map((item, idx) => {
                        return (
                          <tr key={idx} className="hover:bg-slate-50/40">
                            <td className="py-3 px-3 font-bold text-slate-800">{item.partNumber}</td>
                            <td className="py-3 px-3 text-slate-500 truncate max-w-[150px]">{item.description}</td>
                            <td className="py-3 px-3 text-center">
                              <select
                                value={item.volumeCategory}
                                onChange={(e) => handleItemCategoryChange(idx, e.target.value as any)}
                                className="bg-slate-50 border border-slate-200 rounded p-1 text-[11px] font-semibold text-gray-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                              >
                                <option value="Alto">Alto</option>
                                <option value="Medio">Medio</option>
                                <option value="Bajo">Bajo</option>
                                <option value="Factory">Factory</option>
                              </select>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="number"
                                value={item.weeklyVolume || ''}
                                onChange={(e) => handleItemVolumeChange(idx, e.target.value)}
                                className="w-20 bg-slate-50 hover:bg-slate-100 border border-slate-200 focus:bg-white outline-none rounded p-1 text-center font-mono text-[11px]"
                                placeholder="Auto"
                              />
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1 font-mono">
                                <span className="text-gray-400 font-bold">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.unitPrice || '0'}
                                  onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                                  className="w-24 bg-slate-50 hover:bg-slate-100 border border-slate-200 focus:bg-white outline-none rounded p-1 text-right font-extrabold text-indigo-600 font-mono text-[11px]"
                                />
                                <span className="text-gray-400">USD</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-colors cursor-pointer"
              >
                ← Regresar a confirmación
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar Edición
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndGenerateRevision}
                  className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Generar Nueva Revisión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

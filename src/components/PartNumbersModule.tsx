import React, { useState, useRef } from 'react';
import { PartNumber, PartNumberStep, Machine, VolumeCategory, VolumeParameters, GeneralParameters, calculatePartQuotation } from '../types';
import { Plus, Trash2, Edit3, Save, X, Eye, Settings, Copy, Info, CheckCircle, HelpCircle, Download, Upload, FileSpreadsheet, AlertTriangle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePartNumbers } from '../contexts/PartNumbersContext';
import Swal from 'sweetalert2';

interface PartNumbersModuleProps {
  machines: Machine[];
  volParams: VolumeParameters;
  genParams: GeneralParameters;
  onSelectPart: (part: PartNumber) => void;
  onNavigateToMultipleQuotes?: (partIds: string[]) => void;
  activeTab?: string;
  onNavigateTab?: (tab: 'dashboard' | 'machines' | 'params' | 'parts' | 'quotation' | 'projection' | 'history') => void;
}

export const PartNumbersModule: React.FC<PartNumbersModuleProps> = ({
  machines,
  volParams,
  genParams,
  onSelectPart,
  onNavigateToMultipleQuotes,
  activeTab,
  onNavigateTab,
}) => {
  // Mode: 'list' | 'add' | 'edit'
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  
  // Selection and Details Modals from Context API
  const {
    partNumbers,
    setPartNumbers,
    selectedIds,
    toggleSelectId,
    toggleSelectAll,
    deleteSelected,
  } = usePartNumbers();

  const [detailPartId, setDetailPartId] = useState<string | null>(null);

  // Form State
  const [partNumberInput, setPartNumberInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [clientInput, setClientInput] = useState('');
  const [engLevelInput, setEngLevelInput] = useState('AA');
  const [toolingInput, setToolingInput] = useState('N/A');
  const [volumeInput, setVolumeInput] = useState<VolumeCategory>('Alto');
  const [weeklyVolumeInput, setWeeklyVolumeInput] = useState<string>('');
  const [rawMaterialInput, setRawMaterialInput] = useState<string>('0');
  const [purchasedInput, setPurchasedInput] = useState<string>('0');
  const [isFeasibleInput, setIsFeasibleInput] = useState<boolean>(true);

  // Form steps state
  const [steps, setSteps] = useState<PartNumberStep[]>([]);
  // Individual step addition state
  const [newStepName, setNewStepName] = useState('');
  const [newStepSeq, setNewStepSeq] = useState<string>('');
  const [newStepMachine, setNewStepMachine] = useState<string>('none');
  const [newStepOutput, setNewStepOutput] = useState<string>('400');
  const [newStepOperators, setNewStepOperators] = useState<string>('1');

  // Excel Carga Masiva (Bulk Loading) States and Refs
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    added: number;
    updated: number;
    omitted: number;
    errors: number;
    warnings: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download Plantilla de Excel Tool
  const handleDownloadTemplate = () => {
    const headers = [
      "Número de Parte",
      "Descripción / Proceso",
      "Cliente",
      "Viabilidad Comercial",
      "Nivel Ingeniería",
      "Tooling USD",
      "Volumen Estimado",
      "Cantidad Semanal",
      "Costo MP",
      "Costo Componentes",
      "Secuencia",
      "Nombre Operación",
      "Prensa / Máquina",
      "Rendimiento (PZS/HR)",
      "Personal Requerido",
      "Target"
    ];

    const data = [
      {
        "Número de Parte": "181299",
        "Descripción / Proceso": "Formado",
        "Cliente": "FMX",
        "Viabilidad Comercial": "Factible",
        "Nivel Ingeniería": "AA",
        "Tooling USD": 0,
        "Volumen Estimado": "Alto Volumen (más de 8,000 pza)",
        "Cantidad Semanal": 16000,
        "Costo MP": 0.25,
        "Costo Componentes": 0.05,
        "Secuencia": 10,
        "Nombre Operación": "OP10 - Formado",
        "Prensa / Máquina": "Prensa 200T",
        "Rendimiento (PZS/HR)": 400,
        "Personal Requerido": 1,
        "Target": 1.45
      },
      {
        "Número de Parte": "181299",
        "Descripción / Proceso": "Formado",
        "Cliente": "FMX",
        "Viabilidad Comercial": "Factible",
        "Nivel Ingeniería": "AA",
        "Tooling USD": 0,
        "Volumen Estimado": "Alto Volumen (más de 8,000 pza)",
        "Cantidad Semanal": 16000,
        "Costo MP": 0.25,
        "Costo Componentes": 0.05,
        "Secuencia": 20,
        "Nombre Operación": "OP20 - Recorte",
        "Prensa / Máquina": "Prensa 160T",
        "Rendimiento (PZS/HR)": 600,
        "Personal Requerido": 1,
        "Target": 1.45
      },
      {
        "Número de Parte": "181300",
        "Descripción / Proceso": "Corte láser",
        "Cliente": "FMX",
        "Viabilidad Comercial": "No Factible",
        "Nivel Ingeniería": "A",
        "Tooling USD": 1500,
        "Volumen Estimado": "Medio Volumen (4,000 - 8,000 pza)",
        "Cantidad Semanal": 5000,
        "Costo MP": 0.10,
        "Costo Componentes": 0.00,
        "Secuencia": 10,
        "Nombre Operación": "Corte",
        "Prensa / Máquina": "Ninguna (Manual)",
        "Rendimiento (PZS/HR)": 200,
        "Personal Requerido": 2,
        "Target": 2.10
      }
    ];

    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Catálogo de Partes");
    XLSX.writeFile(wb, "plantilla_carga_masiva.xlsx");
  };

  // Trigger file browser
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handles reading the spreadsheet file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);

        // Run CPU-heavy file decoding in a setTimeout to avoid halting UI renderings
        setTimeout(() => {
          try {
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            if (!worksheet) {
              Swal.fire({
                title: 'Archivo inválido',
                text: 'El archivo Excel o CSV cargado no contiene pestañas válidas.',
                icon: 'error',
                confirmButtonColor: '#4f46e5'
              });
              setIsProcessing(false);
              return;
            }

            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            if (jsonData.length === 0) {
              Swal.fire({
                title: 'Sin registros',
                text: 'La planilla de cálculo importada no tiene registros.',
                icon: 'warning',
                confirmButtonColor: '#4f46e5'
              });
              setIsProcessing(false);
              return;
            }

            const importedPartsMap: { [key: string]: PartNumber } = {};
            let errorsCount = 0;
            const warningsList: string[] = [];

            // Case-insensitive/fuzzy value extractor
            const getValue = (row: any, keys: string[]) => {
              for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null) return row[k];
                const normalizedK = k.toLowerCase().trim();
                for (const rk of Object.keys(row)) {
                  if (rk.toLowerCase().trim() === normalizedK) {
                    return row[rk];
                  }
                }
              }
              return undefined;
            };

            for (const row of jsonData as any[]) {
              const partNumRaw = getValue(row, ["Número de Parte", "Numero de Parte", "Part Number", "Parte"]);
              const clientRaw = getValue(row, ["Cliente", "Client"]);

              if (partNumRaw === undefined || String(partNumRaw).trim() === "") {
                const isRowEmpty = Object.values(row).every(v => v === null || v === undefined || String(v).trim() === "");
                if (!isRowEmpty) {
                  errorsCount++;
                }
                continue;
              }

              if (clientRaw === undefined || String(clientRaw).trim() === "") {
                errorsCount++;
                continue;
              }

              const partNumberStr = String(partNumRaw).trim();

              if (!importedPartsMap[partNumberStr]) {
                const volRaw = String(getValue(row, ["Volumen Estimado", "Volumen"]) || "").toLowerCase();
                let volumeCategory: VolumeCategory = "Alto";
                
                if (volRaw.includes("alto") || volRaw.includes("high") || volRaw.includes("8,000") || volRaw.includes("8000")) {
                  volumeCategory = "Alto";
                } else if (volRaw.includes("medio") || volRaw.includes("medium") || volRaw.includes("4,000") || volRaw.includes("4000") || volRaw.includes("2,500") || volRaw.includes("2500")) {
                  volumeCategory = "Medio";
                } else if (volRaw.includes("bajo") || volRaw.includes("low") || volRaw.includes("menos de")) {
                  volumeCategory = "Bajo";
                } else if (volRaw.includes("factory") || volRaw.includes("fac")) {
                  volumeCategory = "Factory";
                }

                const feasibilityRaw = String(getValue(row, ["Viabilidad Comercial", "Viabilidad", "Feasibility", "Estatus"]) || "").toLowerCase();
                let isFeasible = true;
                if (feasibilityRaw.includes("no") || feasibilityRaw.includes("false") || feasibilityRaw.includes("inv") || feasibilityRaw.includes("no factible")) {
                  isFeasible = false;
                }

                const toolingRaw = getValue(row, ["Herramienta (Tooling USD)", "Herramienta (Tooling USD)", "Tooling USD", "Herramienta", "Tooling"]);
                const toolingUsd = toolingRaw !== undefined && toolingRaw !== null ? String(toolingRaw).trim() : "N/A";

                const weeklyVolRaw = getValue(row, ["Cantidad Semanal (Pzas)", "Cantidad Semanal", "Weekly Volume", "Semanal"]);
                const weeklyVolume = weeklyVolRaw !== undefined && weeklyVolRaw !== null ? Number(weeklyVolRaw) : undefined;

                const rawMaterialRaw = getValue(row, ["Costo de Materia Prima por Pieza (USD)", "Costo MP", "Materia Prima", "Raw Material", "MP", "Costo de Materia Prima"]);
                const rawMaterial = rawMaterialRaw !== undefined && rawMaterialRaw !== null ? parseFloat(String(rawMaterialRaw)) || 0 : 0;

                const purchasedRaw = getValue(row, ["Costo de Componentes Adquiridos / Insertos (USD)", "Costo Componentes", "Componentes", "Purchased Components", "Insertos", "Costo Componentes Adquiridos"]);
                const purchasedComponents = purchasedRaw !== undefined && purchasedRaw !== null ? parseFloat(String(purchasedRaw)) || 0 : 0;

                const targetPriceRaw = getValue(row, ["Target", "Precio Target", "Precio Deseado", "Target Price"]);
                const targetPrice = targetPriceRaw !== undefined && targetPriceRaw !== null && String(targetPriceRaw).trim() !== "" ? parseFloat(String(targetPriceRaw)) || 0 : undefined;

                importedPartsMap[partNumberStr] = {
                  id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  partNumber: partNumberStr,
                  description: String(getValue(row, ["Descripción / Proceso", "Descripcion", "Description"]) || "").trim(),
                  client: String(clientRaw).trim(),
                  engineeringLevel: String(getValue(row, ["Nivel de Ingeniería", "Nivel Ingeniería", "Engineering Level"]) || "AA").trim(),
                  toolingUsd: toolingUsd,
                  volumeCategory: volumeCategory,
                  weeklyVolume: weeklyVolume,
                  rawMaterial: rawMaterial,
                  purchasedComponents: purchasedComponents,
                  isFeasible: isFeasible,
                  targetPrice: targetPrice,
                  steps: []
                };
              }

              // Optional step attributes
              const seqRaw = getValue(row, ["Secuencia", "Sequence"]);
              const stepNameRaw = getValue(row, ["Nombre Operación", "Nombre Operacion", "Step Name", "Operacion", "Operación"]);

              if (seqRaw !== undefined || stepNameRaw !== undefined) {
                const sequence = parseInt(String(seqRaw)) || 10;
                const stepName = String(stepNameRaw || `OP${sequence}`).trim();

                const machineRaw = String(getValue(row, ["Prensa / Máquina", "Prensa / Maquina", "Prensa", "Machine", "Maquina"]) || "").trim();
                let machineId = "none";

                if (machineRaw && machineRaw.toLowerCase() !== "ninguna (manual)" && machineRaw.toLowerCase() !== "manual" && machineRaw.toLowerCase() !== "none" && machineRaw.toLowerCase() !== "ninguna") {
                  const matchedMachine = machines.find(m => m.name.toLowerCase().trim() === machineRaw.toLowerCase().trim());
                  if (matchedMachine) {
                    machineId = matchedMachine.id;
                  } else {
                    machineId = "none";
                    const warningMsg = `Prensa "${machineRaw}" no encontrada. Asociado a "${partNumberStr}", paso "${stepName}". Se asignó como Manual.`;
                    if (!warningsList.includes(warningMsg)) {
                      warningsList.push(warningMsg);
                    }
                  }
                }

                const outputRaw = getValue(row, ["Rendimiento (PZS/HR)", "Rendimiento", "Output/Hr", "Output"]);
                const outputPerHour = parseInt(String(outputRaw)) || 400;

                const operatorsRaw = getValue(row, ["Personal Requerido", "Personal", "Operators", "Personal requerido"]);
                const operatorsCount = parseInt(String(operatorsRaw)) || 1;

                const stepObj: PartNumberStep = {
                  id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  stepName: stepName,
                  sequence: sequence,
                  machineId: machineId,
                  outputPerHour: outputPerHour,
                  operatorsCount: operatorsCount
                };

                importedPartsMap[partNumberStr].steps.push(stepObj);
              }
            }

            const importedParts = Object.values(importedPartsMap);
            importedParts.forEach(part => {
              part.steps.sort((a, b) => a.sequence - b.sequence);
            });

            if (importedParts.length === 0) {
              Swal.fire({
                title: 'No se detectaron partes',
                text: 'Ningún número de parte válido fue detectado para importar.',
                icon: 'warning',
                confirmButtonColor: '#4f46e5'
              });
              setIsProcessing(false);
              return;
            }

            // Loop to merge automatically without blocking confirm dialogs
            let addedCount = 0;
            let updatedCount = 0;
            let omittedCount = 0;

            let currentParts = [...partNumbers];

            for (const impPart of importedParts) {
              const existingIndex = currentParts.findIndex(p => p.partNumber === impPart.partNumber);
              if (existingIndex !== -1) {
                // Auto-update matching part numbers for premium seamless UX
                currentParts[existingIndex] = {
                  ...impPart,
                  id: currentParts[existingIndex].id // keep existing unique internal id
                };
                updatedCount++;
              } else {
                currentParts.push(impPart);
                addedCount++;
              }
            }

            setPartNumbers(currentParts);

            setImportSummary({
              added: addedCount,
              updated: updatedCount,
              omitted: omittedCount,
              errors: errorsCount,
              warnings: warningsList
            });

            setIsProcessing(false);

          } catch (innerErr) {
            console.error("Error evaluating CSV/Excel workbook: ", innerErr);
            Swal.fire({
              title: 'Error de lectura',
              text: 'Falla al interpretar los contenidos del libro de Excel o CSV.',
              icon: 'error',
              confirmButtonColor: '#4f46e5'
            });
            setIsProcessing(false);
          }
        }, 50);

      } catch (err) {
        console.error("Error reading browser file stream: ", err);
        Swal.fire({
          title: 'Error de archivo',
          text: 'Ocurrió un error al leer el archivo.',
          icon: 'error',
          confirmButtonColor: '#4f46e5'
        });
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Load a part into the editing form
  const handleEditClick = (part: PartNumber) => {
    setSelectedPartId(part.id);
    setPartNumberInput(part.partNumber);
    setDescriptionInput(part.description);
    setClientInput(part.client);
    setEngLevelInput(part.engineeringLevel || 'AA');
    setToolingInput(part.toolingUsd || 'N/A');
    setVolumeInput(part.volumeCategory);
    setWeeklyVolumeInput(part.weeklyVolume ? part.weeklyVolume.toString() : '');
    setRawMaterialInput(part.rawMaterial ? part.rawMaterial.toString() : '0');
    setPurchasedInput(part.purchasedComponents ? part.purchasedComponents.toString() : '0');
    setIsFeasibleInput(part.isFeasible !== false);
    setSteps(part.steps || []);
    
    // Clear step form
    setNewStepName('');
    setNewStepSeq((part.steps && part.steps.length > 0 ? (part.steps[part.steps.length - 1].sequence + 10) : 10).toString());
    setNewStepMachine('none');
    setNewStepOutput('100');
    setNewStepOperators('1');

    setMode('edit');
  };

  const handleAddNewClick = () => {
    setSelectedPartId(null);
    setPartNumberInput('');
    setDescriptionInput('');
    setClientInput('');
    setEngLevelInput('AA');
    setToolingInput('N/A');
    setVolumeInput('Alto');
    setWeeklyVolumeInput('');
    setRawMaterialInput('0');
    setPurchasedInput('0');
    setIsFeasibleInput(true);
    setSteps([]);
    
    // Step inputs
    setNewStepName('');
    setNewStepSeq('10');
    setNewStepMachine('none');
    setNewStepOutput('400');
    setNewStepOperators('1');

    setMode('add');
  };

  const handleAddStepToForm = () => {
    if (!newStepName.trim() || isNaN(parseInt(newStepOutput)) || isNaN(parseInt(newStepOperators))) {
      Swal.fire({
        title: 'Datos inválidos',
        text: 'Por favor, ingresa los datos válidos del paso de proceso antes de añadirlo.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const seqVal = parseInt(newStepSeq) || (steps.length > 0 ? steps[steps.length - 1].sequence + 10 : 10);
    const addedStep: PartNumberStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      stepName: newStepName.trim(),
      sequence: seqVal,
      machineId: newStepMachine,
      outputPerHour: parseInt(newStepOutput),
      operatorsCount: parseInt(newStepOperators),
    };

    const sortedSteps = [...steps, addedStep].sort((a, b) => a.sequence - b.sequence);
    setSteps(sortedSteps);

    // Prepare next step fields
    setNewStepName('');
    setNewStepSeq((seqVal + 10).toString());
    setNewStepMachine('none');
    setNewStepOutput('400');
    setNewStepOperators('1');
  };

  const handleRemoveStepFromForm = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
  };

  const handleDuplicatePart = (part: PartNumber, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicated: PartNumber = {
      ...part,
      id: `part-dup-${Date.now()}`,
      partNumber: `${part.partNumber} - Copia`,
      steps: part.steps.map(s => ({
        ...s,
        id: `step-dup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      }))
    };
    setPartNumbers([...partNumbers, duplicated]);
    Swal.fire({
      title: 'Duplicado exitoso',
      text: `Se duplicó el número de parte ${part.partNumber} correctamente.`,
      icon: 'success',
      confirmButtonColor: '#4f46e5'
    });
  };

  const handleDeletePart = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Swal.fire({
      title: '¿Eliminar número de parte?',
      text: `¿Está seguro de que desea eliminar el número de parte ${name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        setPartNumbers(partNumbers.filter((p) => p.id !== id));
        Swal.fire({
          title: 'Eliminado',
          text: `El número de parte ${name} fue eliminado.`,
          icon: 'success',
          confirmButtonColor: '#4f46e5'
        });
      }
    });
  };

  const handleSavePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partNumberInput.trim() || !clientInput.trim()) {
      Swal.fire({
        title: 'Campos requeridos',
        text: 'El Número de Parte y el Cliente son campos requeridos.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const existingPart = selectedPartId ? partNumbers.find(p => p.id === selectedPartId) : null;

    const partObj: PartNumber = {
      id: selectedPartId || `part-${Date.now()}`,
      partNumber: partNumberInput.trim(),
      description: descriptionInput.trim(),
      client: clientInput.trim(),
      engineeringLevel: engLevelInput.trim(),
      toolingUsd: toolingInput.trim(),
      volumeCategory: volumeInput,
      weeklyVolume: weeklyVolumeInput ? parseInt(weeklyVolumeInput) : undefined,
      rawMaterial: parseFloat(rawMaterialInput) || 0,
      purchasedComponents: parseFloat(purchasedInput) || 0,
      isFeasible: isFeasibleInput,
      steps: steps,
      targetPrice: existingPart ? existingPart.targetPrice : undefined,
    };

    if (mode === 'add') {
      setPartNumbers([...partNumbers, partObj]);
    } else {
      setPartNumbers(partNumbers.map((p) => (p.id === selectedPartId ? partObj : p)));
    }

    setMode('list');
  };

  return (
    <div className="space-y-6" id="part-numbers-module">
      {mode === 'list' ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Números de Parte de Clientes</h2>
                <p className="text-sm text-gray-500">Configura la secuencia de operaciones, prensas asignadas, y rendimiento por pieza.</p>
              </div>
            </div>
          </div>

            {/* Structured action bar - only containing core actions & import/export options */}
            <div className="flex flex-wrap items-center gap-2.5 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <button
                id="add-part-btn"
                onClick={handleAddNewClick}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nuevo Número de Parte
              </button>

              <button
                id="quote-selected-btn"
                type="button"
                onClick={() => {
                  if (selectedIds.length === 0) {
                    Swal.fire({
                      title: 'Selección vacía',
                      text: 'Por favor, selecciona al menos un número de parte para generar una cotización.',
                      icon: 'warning',
                      confirmButtonColor: '#4f46e5'
                    });
                    return;
                  }
                  
                  // Check if all selected parts belong to the same client
                  const selectedParts = partNumbers.filter(p => selectedIds.includes(p.id));
                  const uniqueClients = Array.from(new Set(selectedParts.map(p => p.client?.trim().toUpperCase()).filter(Boolean)));
                  
                  if (uniqueClients.length > 1) {
                    Swal.fire({
                      title: 'Múltiples clientes seleccionados',
                      text: 'No se pueden cotizar partes de diferentes clientes. Selecciona solo partes del mismo cliente.',
                      icon: 'error',
                      confirmButtonColor: '#4f46e5'
                    });
                    return;
                  }

                  if (onNavigateToMultipleQuotes) {
                    onNavigateToMultipleQuotes(selectedIds);
                  }
                }}
                className={`inline-flex items-center gap-2 text-xs font-bold py-2.5 px-4 rounded-lg border shadow-xs transition-all cursor-pointer ${
                  selectedIds.length > 0
                    ? 'bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white hover:shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-100 hover:bg-emerald-200/50'
                }`}
                title="Generar cotizaciones combinadas para los elementos seleccionados"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Cotizar selección {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </button>

              <button
                id="delete-selected-btn"
                type="button"
                onClick={deleteSelected}
                className={`inline-flex items-center gap-2 text-xs font-bold py-2.5 px-4 rounded-lg border shadow-xs transition-all cursor-pointer ${
                  selectedIds.length > 0
                    ? 'bg-rose-600 border-rose-600 hover:bg-rose-700 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-200/50'
                }`}
                title="Eliminar del sistema los elementos seleccionados"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar seleccionados {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </button>

              {/* Vertical Divider */}
              <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1 self-center" />

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />

              <button
                id="import-excel-btn"
                type="button"
                onClick={handleImportClick}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold py-2.5 px-4 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                title="Carga masiva desde archivo Excel"
              >
                <Upload className="w-4 h-4" />
                {isProcessing ? 'Procesando...' : 'Importar Excel'}
              </button>

              <button
                id="download-template-btn"
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-lg border border-slate-200 shadow-xs transition-colors cursor-pointer"
                title="Descargar plantilla de Excel modelo"
              >
                <Download className="w-4 h-4" />
                Descargar Plantilla
              </button>
            </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" id="parts-list-table">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider bg-slate-50/50">
                    <th 
                      className="py-3 px-4 w-12 text-center cursor-pointer select-none"
                      onClick={toggleSelectAll}
                    >
                      <input
                        type="checkbox"
                        checked={partNumbers.length > 0 && selectedIds.length === partNumbers.length}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelectAll();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        title="Seleccionar / deseleccionar todos"
                      />
                    </th>
                    <th className="py-3 px-4">Número de Parte</th>
                    <th className="py-3 px-4">Descripción</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Nivel Ing.</th>
                    <th className="py-3 px-4">Estatus Viabilidad</th>
                    <th className="py-3 px-4 text-center">Pasos</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-medium">
                  {partNumbers.map((part) => (
                    <tr
                      key={part.id}
                      onClick={() => onSelectPart(part)}
                      className="hover:bg-slate-50/50 cursor-pointer group transition-colors"
                    >
                      <td
                        className="py-3 px-4 text-center cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectId(part.id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(part.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectId(part.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900">{part.partNumber}</td>
                      <td className="py-3 px-4 text-gray-600">{part.description || '-'}</td>
                      <td className="py-3 px-4">{part.client}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                          {part.engineeringLevel || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {part.isFeasible !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                            ● Factible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full font-semibold">
                            ● No Factible
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full text-[10px] font-bold">
                          {part.isFeasible !== false ? `${part.steps?.length || 0} pasos` : 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1.5 opacity-85 group-hover:opacity-100 transition-opacity">
                          <button
                            id={`view-details-${part.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailPartId(part.id);
                            }}
                            className="p-1 px-2 text-indigo-600 hover:bg-indigo-50 rounded flex items-center gap-1 text-[10px] font-bold"
                            title="Ver desglose detallado"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detalles
                          </button>
                          <button
                            id={`duplicate-part-${part.id}`}
                            onClick={(e) => handleDuplicatePart(part, e)}
                            className="p-1 text-teal-600 hover:bg-teal-50 rounded"
                            title="Duplicar"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`edit-part-${part.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(part);
                            }}
                            className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-part-${part.id}`}
                            onClick={(e) => handleDeletePart(part.id, part.partNumber, e)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Edit or Add Layout */
        <form onSubmit={handleSavePart} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-gray-50 pb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {mode === 'add' ? 'Registrar Nuevo Número de Parte' : `Modificar Número de Parte: ${partNumberInput}`}
              </h3>
              <p className="text-xs text-gray-500">Campos marcados con * son mandatorios.</p>
            </div>
            <button
              id="back-to-list"
              type="button"
              onClick={() => setMode('list')}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Core Properties */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label htmlFor="form-part-number" className="text-xs font-semibold text-gray-600">Número de Parte *</label>
              <input
                id="form-part-number"
                type="text"
                placeholder="Ej. 182310"
                value={partNumberInput}
                onChange={(e) => setPartNumberInput(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="form-description" className="text-xs font-semibold text-gray-600">Descripción / Proceso</label>
              <input
                id="form-description"
                type="text"
                placeholder="Ej. Formado Principal"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="form-client" className="text-xs font-semibold text-gray-600">Cliente *</label>
              <input
                id="form-client"
                type="text"
                placeholder="Ej. FMX"
                value={clientInput}
                onChange={(e) => setClientInput(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="form-is-feasible" className="text-xs font-semibold text-gray-600 block">Viabilidad Comercial</label>
              <div className="flex items-center gap-4 mt-2">
                <label className="inline-flex items-center cursor-pointer select-none text-xs font-medium text-gray-700">
                  <input
                    id="feasible-checkbox-yes"
                    type="radio"
                    name="feasibility"
                    checked={isFeasibleInput === true}
                    onChange={() => setIsFeasibleInput(true)}
                    className="mr-1.5 accent-indigo-600 h-4 w-4"
                  />
                  Factible (Cotizar)
                </label>
                <label className="inline-flex items-center cursor-pointer select-none text-xs font-medium text-gray-700">
                  <input
                    id="feasible-checkbox-no"
                    type="radio"
                    name="feasibility"
                    checked={isFeasibleInput === false}
                    onChange={() => setIsFeasibleInput(false)}
                    className="mr-1.5 accent-red-600 h-4 w-4"
                  />
                  No Factible
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <div className="space-y-1">
              <label htmlFor="form-eng-level" className="text-xs font-semibold text-slate-700">Nivel de Ingeniería</label>
              <input
                id="form-eng-level"
                type="text"
                value={engLevelInput}
                onChange={(e) => setEngLevelInput(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="form-tooling" className="text-xs font-semibold text-slate-700">Herramental (Tooling USD)</label>
              <input
                id="form-tooling"
                type="text"
                value={toolingInput}
                onChange={(e) => setToolingInput(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="form-volume-cat" className="text-xs font-semibold text-slate-700 font-medium">Volumen Estimado</label>
              <select
                id="form-volume-cat"
                value={volumeInput}
                onChange={(e) => setVolumeInput(e.target.value as VolumeCategory)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              >
                <option value="Alto">Alto Volumen (más de 8,000 pza)</option>
                <option value="Medio">Medio Volumen (2,500 y 7,999 pza)</option>
                <option value="Bajo">Bajo Volumen (menos de 2,500 pza)</option>
                <option value="Factory">Factory Assistance (proyectos especiales)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="form-weekly-vol" className="text-xs font-semibold text-slate-700">Cantidad Semanal (Pzas)</label>
              <input
                id="form-weekly-vol"
                type="number"
                placeholder="Opcional. Ej. 16000"
                value={weeklyVolumeInput}
                onChange={(e) => setWeeklyVolumeInput(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Materials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 bg-amber-50/20 border border-amber-100 p-4 rounded-xl">
              <label htmlFor="form-raw-material" className="text-xs font-bold text-amber-900 block mb-1">Costo de Materia Prima por Pieza (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-amber-600 text-xs">$</span>
                <input
                   id="form-raw-material"
                  type="number"
                  step="0.0001"
                  value={rawMaterialInput}
                  onChange={(e) => setRawMaterialInput(e.target.value)}
                  className="w-full bg-white border border-amber-200 rounded-lg py-2 pl-6 pr-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
            </div>

            <div className="space-y-1 bg-sky-50/20 border border-sky-100 p-4 rounded-xl">
              <label htmlFor="form-purchased-comp" className="text-xs font-bold text-sky-900 block mb-1">Costo de Componentes Adquiridos / Insertos (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sky-600 text-xs">$</span>
                <input
                  id="form-purchased-comp"
                  type="number"
                  step="0.0001"
                  value={purchasedInput}
                  onChange={(e) => setPurchasedInput(e.target.value)}
                  className="w-full bg-white border border-sky-200 rounded-lg py-2 pl-6 pr-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Process sequence manager (only available when isFeasibleInput is true) */}
          {isFeasibleInput && (
            <div className="space-y-4 border border-slate-100 rounded-xl p-5">
              <div className="flex border-b border-gray-100 pb-2 justify-between items-center">
                <span className="text-sm font-bold text-slate-800">Secuencia de Procesamiento o Ruteo de Celda</span>
                <span className="text-xs font-medium text-slate-500">{steps.length} operaciones registradas</span>
              </div>

              {steps.length === 0 ? (
                <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 space-y-1">
                  <p className="text-xs font-semibold">No se han ingresado pasos de manufactura.</p>
                  <p className="text-[10px]">Añade operaciones como OP10, OP20 o Inspección utilizando el formulario inferior.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {steps.map((step) => {
                    const matchedMachine = machines.find((m) => m.id === step.machineId);
                    return (
                      <div
                        key={step.id}
                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border border-slate-100 bg-white rounded-lg gap-2 text-xs font-medium"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded">
                            {step.sequence}
                          </span>
                          <div>
                            <span className="text-gray-900 font-semibold">{step.stepName}</span>
                            <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 mt-0.5">
                              <span>Prensa: <strong className="text-slate-700">{matchedMachine ? matchedMachine.name : 'Celda Manual (Ninguno)'}</strong></span>
                              <span>•</span>
                              <span>Pzas/Hora: <strong className="text-slate-700">{step.outputPerHour} (Ciclo: {(60 / step.outputPerHour).toFixed(3)}m)</strong></span>
                              <span>•</span>
                              <span>Operadores: <strong className="text-slate-700">{step.operatorsCount}</strong></span>
                            </div>
                          </div>
                        </div>

                        <button
                          id={`remove-step-${step.id}`}
                          type="button"
                          onClick={() => handleRemoveStepFromForm(step.id)}
                          className="text-red-500 hover:text-red-700 p-1 bg-red-50 hover:bg-red-100 rounded self-end sm:self-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Step quick form */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="space-y-1">
                  <label htmlFor="new-step-seq" className="text-[10px] font-bold text-gray-500 uppercase">Secuencia</label>
                  <input
                    id="new-step-seq"
                    type="number"
                    placeholder="10"
                    value={newStepSeq}
                    onChange={(e) => setNewStepSeq(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label htmlFor="new-step-name" className="text-[10px] font-bold text-gray-500 uppercase">Nombre Operación *</label>
                  <input
                    id="new-step-name"
                    type="text"
                    placeholder="Ej. OP10 - Formado"
                    value={newStepName}
                    onChange={(e) => setNewStepName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-step-machine" className="text-[10px] font-bold text-gray-500 uppercase">Prensa / Máquina</label>
                  <select
                    id="new-step-machine"
                    value={newStepMachine}
                    onChange={(e) => setNewStepMachine(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    <option value="none">Ninguna (Manual)</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (${m.baseCost.toFixed(2)}/hr)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-step-output" className="text-[10px] font-bold text-gray-500 uppercase">Rendimiento (Pzs/Hr) *</label>
                  <input
                    id="new-step-output"
                    type="number"
                    value={newStepOutput}
                    onChange={(e) => setNewStepOutput(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-step-operators" className="text-[10px] font-bold text-gray-500 uppercase">Personal Requerido *</label>
                  <input
                    id="new-step-operators"
                    type="number"
                    value={newStepOperators}
                    onChange={(e) => setNewStepOperators(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>

                <div className="md:col-span-5 flex justify-end">
                  <button
                    id="add-step-btn"
                    type="button"
                    onClick={handleAddStepToForm}
                    className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold px-3 py-1.5 rounded transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Añadir Operación a la Celda
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-end gap-3 border-t border-gray-50 pt-4">
            <button
              id="cancel-part-saving"
              type="button"
              onClick={() => setMode('list')}
              className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="submit-part"
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Guardar Número de Parte
            </button>
          </div>
        </form>
      )}

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 shadow-lg flex flex-col items-center justify-center space-y-3 border border-slate-100">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-gray-700">Interpretando y Validando Archivo...</p>
            <p className="text-[10px] text-gray-400">Agrupando secuencias y comprobando viabilidades</p>
          </div>
        </div>
      )}

      {/* Import Summary Overlay */}
      {importSummary && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-100">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Resultado de la Importación</h3>
                <p className="text-[11px] text-gray-550 font-medium font-sans">Resumen y diagnóstico de la carga masiva</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl">
                <span className="text-[10px] text-indigo-700 font-extrabold uppercase block">Nuevos</span>
                <span className="text-sm font-extrabold text-indigo-900 font-mono">{importSummary.added}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                <span className="text-[10px] text-emerald-700 font-extrabold uppercase block font-sans">Actualizados</span>
                <span className="text-sm font-extrabold text-emerald-900 font-mono">{importSummary.updated}</span>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-xl">
                <span className="text-[10px] text-amber-700 font-extrabold uppercase block font-sans">Omitidos</span>
                <span className="text-sm font-extrabold text-amber-900 font-mono">{importSummary.omitted}</span>
              </div>
              <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                <span className="text-[10px] text-rose-700 font-extrabold uppercase block font-sans">Filas Err</span>
                <span className="text-sm font-extrabold text-rose-900 font-mono">{importSummary.errors}</span>
              </div>
            </div>

            {importSummary.warnings.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-amber-850 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                  Alerta de prensas no encontradas ({importSummary.warnings.length})
                </span>
                <div className="max-h-32 overflow-y-auto border border-amber-100 bg-amber-50/50 rounded-lg p-2.5 space-y-1 text-[10px] font-semibold text-amber-900 text-left">
                  {importSummary.warnings.map((warn, idx) => (
                    <div key={idx} className="flex gap-1">
                      <span>•</span>
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importSummary.errors > 0 && (
              <div className="p-2.5 bg-red-50 border border-red-100 text-[10px] font-semibold text-red-850 rounded-lg text-left">
                Nota: {importSummary.errors} registros vacíos o sin campos mandatorios (número de parte / cliente) fueron omitidos de la carga masiva.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setImportSummary(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-5 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Cerrar Resumen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cost Breakdown Details Modal (Drawer style) */}
      {detailPartId && (() => {
        const detailPart = partNumbers.find((p) => p.id === detailPartId);
        if (!detailPart) return null;
        const detailResults = calculatePartQuotation(detailPart, machines, volParams, genParams);

        const hasTargetPrice = detailPart.targetPrice !== undefined && detailPart.targetPrice !== null;
        const originalPrice = detailResults.exWorksCost;
        const negotiatedPrice = hasTargetPrice ? detailPart.targetPrice! : originalPrice;
        const diffVal = originalPrice - negotiatedPrice;
        const isDiscount = diffVal >= 0;
        const actualPercent = originalPrice > 0 ? (diffVal / originalPrice) * 100 : 0;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-end font-sans">
            {/* Backdrop click target */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => setDetailPartId(null)} />
            
            <div className="relative bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 z-10">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                <div className="space-y-1 text-left animate-fade-in">
                  <span className="bg-indigo-600 text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wide uppercase">COST BREAKDOWN REPORT</span>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                    Parte: <span className="font-mono text-indigo-300 font-extrabold">{detailPart.partNumber}</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailPartId(null)}
                  className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded transition-colors cursor-pointer"
                  title="Cerrar Reporte"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content box */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Properties block */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-gray-500 font-semibold block uppercase">Cliente</span>
                    <span className="text-xs font-bold text-gray-900">{detailPart.client}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-gray-500 font-semibold block uppercase">Nivel Ingeniería</span>
                    <span className="text-xs font-bold text-gray-900 font-mono">{detailPart.engineeringLevel || 'N/A'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-gray-500 font-semibold block uppercase">Tooling (USD)</span>
                    <span className="text-xs font-bold text-gray-900 font-mono">{detailPart.toolingUsd || 'N/A'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-gray-500 font-semibold block uppercase">Categoría Volumen</span>
                    <span className="text-xs font-bold text-indigo-700">{detailPart.volumeCategory}</span>
                  </div>
                </div>

                {detailPart.isFeasible === false ? (
                  <div className="p-8 bg-red-50 rounded-xl border border-red-100 text-center space-y-3">
                    <AlertCircle className="w-10 h-10 text-red-500 mx-auto animate-bounce" />
                    <h4 className="text-sm font-bold text-red-900">Estatus: NO FACTIBLE</h4>
                    <p className="text-xs text-red-600 max-w-md mx-auto">
                      Este número de parte ha sido marcado como no factible de cotizar por el equipo comercial/técnico. No existen tarifas aplicadas ni desglose detallado para este elemento.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Step by Step grid */}
                    <div className="space-y-2 text-left">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5 text-indigo-600" />
                        Procesamiento de Operaciones (Paso a Paso)
                      </h4>
                      
                      {detailPart.steps && detailPart.steps.length > 0 ? (
                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white text-[10px]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-gray-600 border-b border-slate-100 font-bold text-center">
                                <th className="py-2.5 px-3 text-left">Op (Seq)</th>
                                <th className="py-2.5 px-2 text-left">Máquina</th>
                                <th className="py-2.5 px-2 text-right">Rend. (p/h)</th>
                                <th className="py-2.5 px-2 text-right">M.O. Cost (pza)</th>
                                <th className="py-2.5 px-3 text-right">Maq. Cost (pza)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {detailResults?.steps.map((stepResult, sIdx) => {
                                const mach = machines.find((m) => m.id === stepResult.step.machineId);
                                return (
                                  <tr key={sIdx} className="hover:bg-slate-50/50">
                                    <td className="py-2.5 px-3 font-semibold text-slate-950">
                                      {stepResult.step.stepName} ({stepResult.step.sequence})
                                    </td>
                                    <td className="py-2.5 px-2 text-gray-500">
                                      {mach ? mach.name : 'Ninguna (Manual)'}
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-mono font-bold text-gray-700">
                                      {stepResult.step.outputPerHour} pzs
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-mono text-gray-900">
                                      ${stepResult.laborCostPerPiece.toFixed(2)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono text-gray-900">
                                      ${stepResult.machineCostPerPiece.toFixed(2)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-4 bg-amber-50 text-[11px] text-amber-800 rounded-lg border border-amber-100">
                          No hay operaciones definidas para este número de parte. Por favor ingresa a editarlo para añadir secuencias.
                        </div>
                      )}
                    </div>

                    {/* Pricing algebra formula report */}
                    {detailResults && (
                      <div className="space-y-3 text-left">
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Estructura Analítica de Costos (USD por Pieza)
                        </h4>

                        <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs space-y-2 shadow-inner">
                          <div className="flex justify-between pb-1.5 border-b border-slate-800">
                            <span className="text-slate-400">Direct Labor Total (M.O.)</span>
                            <span className="font-bold text-slate-100">${detailResults.directLaborTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pb-1.5 border-b border-slate-800">
                            <span className="text-slate-400">Machine Cost Total (Prensas)</span>
                            <span className="font-bold text-slate-100">${detailResults.machineCostTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pb-1.5 border-b border-slate-800">
                            <span className="text-slate-400">Materia Prima (MP)</span>
                            <span className="font-bold text-slate-100">${detailResults.rawMaterial.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pb-1.5 border-b border-slate-800">
                            <span className="text-slate-400">Componentes Adquiridos</span>
                            <span className="font-bold text-slate-100">${detailResults.purchasedComponents.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pb-1.5 border-b border-slate-800 text-indigo-400">
                            <span>Suma M.O. + Prensas</span>
                            <span className="font-bold">${detailResults.sumLaborMachine.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pb-1.5 border-b border-slate-800 text-slate-400">
                            <span>Manufacturing Burden ({genParams.manufacturingBurdenPercentage}%)</span>
                            <span>${detailResults.manufacturingBurden.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pb-1.5 border-b border-slate-800 font-bold text-teal-400">
                            <span>Subtotal de Manufactura</span>
                            <span>${detailResults.manufacturingSubtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pb-1.5 border-b border-slate-800">
                            <span className="text-slate-400">Gastos G&A ({genParams.generalAdminPercentage}%)</span>
                            <span>${detailResults.generalAdmin.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pb-1.5 border-b border-slate-800">
                            <span className="text-slate-400">Ventas / Gastos Comerciales ({genParams.salesPercentage}%)</span>
                            <span>${detailResults.sales.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pb-1.5 border-b border-slate-800">
                            <span className="text-slate-400">Margen de Utilidad ({genParams.profitPercentage}%)</span>
                            <span>${detailResults.profit.toFixed(2)}</span>
                          </div>
                          
                          <div className="flex justify-between pt-2 border-t border-indigo-500/30 text-emerald-400 text-sm font-extrabold font-sans">
                            <span className="tracking-wide text-xs uppercase self-center text-slate-300">
                              {hasTargetPrice ? 'PRECIO TÉCNICO EXWORKS' : 'PRECIO TOTAL EXWORKS'}
                            </span>
                            <span className={`${hasTargetPrice ? 'text-xs' : 'text-base'} font-mono bg-emerald-950 px-2.5 py-1 rounded-md border border-emerald-500/20`}>
                              ${detailResults.exWorksCost.toFixed(2)} USD
                            </span>
                          </div>

                          {hasTargetPrice && (
                            <>
                              <div className="flex justify-between pb-1.5 border-b border-slate-800 text-slate-400 text-xs pt-1">
                                <span>Descuento por negociación</span>
                                <span className={isDiscount ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                  {isDiscount ? '-' : '+'}${Math.abs(diffVal).toFixed(2)} ({isDiscount ? '' : '+'}{(-actualPercent).toFixed(1)}%)
                                </span>
                              </div>
                              
                              <div className="flex justify-between pt-2 border-t border-indigo-500/30 text-emerald-400 text-sm font-extrabold font-sans">
                                <span className="tracking-wide text-xs uppercase self-center text-slate-100">PRECIO FINAL EXWORKS</span>
                                <span className="text-base bg-emerald-950 px-2.5 py-1 rounded-md border border-emerald-500/40 font-mono text-emerald-400 font-extrabold">
                                  ${negotiatedPrice.toFixed(2)} USD
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDetailPartId(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-5 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Cerrar Detalle
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

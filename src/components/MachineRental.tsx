import React, { useState, useEffect, useMemo } from 'react';
import { Machine, GeneralParameters } from '../types';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Download, 
  Calculator, 
  Users, 
  Clock, 
  Layers, 
  ClipboardList,
  Printer,
  Eye
} from 'lucide-react';
import { RentalQuoteDetailModal } from './RentalQuoteDetailModal';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getProspectiveQuoteNumber, generateQuotationNumber } from '../utils/quotationNumber';
import { generateSafePDF as runGenerateSafePDF } from '../utils/pdfGenerator';

export interface RentalMachineItem {
  machineId: string;
  machineName: string;
  baseCost: number;
  factor: number;
  personalCount: number;
}

export interface MachineRentalQuote {
  id: string;
  fecha: string; // DD/MM/YYYY HH:MM
  client: string;
  machines: RentalMachineItem[];
  quotationNumber?: string; // Newly added
  
  // Legacy fields preserved for backward compatibility
  machineId?: string;
  machineName?: string;
  factor?: number;
  operatorsCount?: number;

  operatorHourlyCost: number;
  profitPercentage: number;
  hoursToRent: number;
  notes: string;
  pricePerHour: number;
  total: number;
  tipo: 'renta_maquina';
  manufacturingBurdenPercentage: number;
  generalAdminPercentage: number;
  salesPercentage: number;
}

interface MachineRentalProps {
  machines: Machine[];
  genParams: GeneralParameters;
}

interface FormMachineEntry {
  key: string;
  machineId: string;
  factor: number;
  personalCount: number;
}

export function calculateRentalBreakdown(
  machinesList: { machineId: string; machineName: string; baseCost: number; factor: number; personalCount: number }[],
  operatorHourlyCost: number,
  profitPercentage: number,
  hoursToRent: number,
  genParams: GeneralParameters,
  machinesCatalog: Machine[]
) {
  const burdenDec = (genParams.manufacturingBurdenPercentage !== undefined ? genParams.manufacturingBurdenPercentage : 3.5) / 100;
  const gaDec = (genParams.generalAdminPercentage !== undefined ? genParams.generalAdminPercentage : 3.0) / 100;
  const salesDec = (genParams.salesPercentage !== undefined ? genParams.salesPercentage : 3.0) / 100;
  const profitDec = (profitPercentage !== undefined ? profitPercentage : 15) / 100;

  const machineBreakdowns = machinesList.map(entry => {
    // Resolve baseCost from catalog if it is missing or 0
    let baseCost = entry.baseCost;
    if ((!baseCost || baseCost === 0) && entry.machineId) {
      const match = machinesCatalog.find(m => m.id === entry.machineId);
      if (match) baseCost = match.baseCost;
    }
    const baseCostHourly = baseCost * 60; // Convert baseCost (per minute) to per hour

    const machinePart = baseCostHourly * entry.factor;
    const personal = entry.personalCount !== undefined ? entry.personalCount : 1;
    
    // Console log for debugging as requested by user
    console.log(`[Rental Calculation] Machine: ${entry.machineName || entry.machineId}, Personal Count: ${personal}, Operator Hourly Cost: ${operatorHourlyCost}`);

    const laborPart = personal * operatorHourlyCost;
    const subtotalRaw = machinePart + laborPart; // Costo Base por Hora

    // Parameters calculated directly over Costo Base por Hora (subtotalRaw), rounded to 2 decimals
    const burdenAmount = Number((subtotalRaw * burdenDec).toFixed(2));
    const gaAmount = Number((subtotalRaw * gaDec).toFixed(2));
    const salesAmount = Number((subtotalRaw * salesDec).toFixed(2));
    const profitAmount = Number((subtotalRaw * profitDec).toFixed(2));

    const sgaProfitPerHour = burdenAmount + gaAmount + salesAmount + profitAmount;
    const pricePerHour = subtotalRaw + sgaProfitPerHour;
    const totalForHours = pricePerHour * hoursToRent;

    return {
      machineId: entry.machineId,
      machineName: entry.machineName,
      baseCost,
      baseCostHourly,
      factor: entry.factor,
      personalCount: personal,
      machinePart,
      laborPart,
      subtotalRaw,
      burdenAmount,
      gaAmount,
      salesAmount,
      profitAmount,
      sgaProfitPerHour,
      pricePerHour: Number(pricePerHour.toFixed(2)),
      totalForHours: Number(totalForHours.toFixed(2))
    };
  });

  const pricePerHourSum = machineBreakdowns.reduce((acc, current) => acc + current.pricePerHour, 0);
  const pricePerHourTotal = Number(pricePerHourSum.toFixed(2));
  const total = Number((pricePerHourTotal * hoursToRent).toFixed(2));

  const totalPersonal = machineBreakdowns.reduce((acc, current) => acc + current.personalCount, 0);

  const sumBaseCostHourly = machineBreakdowns.reduce((acc, m) => acc + m.baseCostHourly, 0);
  const sumMachinePart = machineBreakdowns.reduce((acc, m) => acc + m.machinePart, 0);
  const sumLaborPart = machineBreakdowns.reduce((acc, m) => acc + m.laborPart, 0);
  const sumSubtotalRaw = machineBreakdowns.reduce((acc, m) => acc + m.subtotalRaw, 0);
  const sumBurdenAmount = machineBreakdowns.reduce((acc, m) => acc + m.burdenAmount, 0);
  const sumGaAmount = machineBreakdowns.reduce((acc, m) => acc + m.gaAmount, 0);
  const sumSalesAmount = machineBreakdowns.reduce((acc, m) => acc + m.salesAmount, 0);
  const sumProfitAmount = machineBreakdowns.reduce((acc, m) => acc + m.profitAmount, 0);
  const sumSgaProfitPerHour = machineBreakdowns.reduce((acc, m) => acc + m.sgaProfitPerHour, 0);

  return {
    machineBreakdowns,
    pricePerHourTotal,
    total,
    burdenDec,
    gaDec,
    salesDec,
    profitDec,
    totalPersonal,
    sumBaseCostHourly,
    sumMachinePart,
    sumLaborPart,
    sumSubtotalRaw,
    sumBurdenAmount,
    sumGaAmount,
    sumSalesAmount,
    sumProfitAmount,
    sumSgaProfitPerHour
  };
}

export const MachineRental: React.FC<MachineRentalProps> = ({ machines, genParams }) => {
  // Local state for savings
  const [quotes, setQuotes] = useState<MachineRentalQuote[]>([]);
  
  // PDF state
  const [activePdfQuote, setActivePdfQuote] = useState<MachineRentalQuote | null>(null);

  // Modal state for showing rental quote breakdown details
  const [selectedRentalQuote, setSelectedRentalQuote] = useState<MachineRentalQuote | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleOpenDetailModal = (quote: MachineRentalQuote) => {
    setSelectedRentalQuote(quote);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setSelectedRentalQuote(null);
    setIsDetailModalOpen(false);
  };

  const triggerPdfGeneration = (quote: MachineRentalQuote) => {
    setActivePdfQuote(quote);
  };

  // Form fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [client, setClient] = useState('');
  const [operatorHourlyCost, setOperatorHourlyCost] = useState(genParams.operatorHourlyCost);
  const [profitPercentage, setProfitPercentage] = useState(genParams.profitPercentage);
  const [hoursToRent, setHoursToRent] = useState(1);
  const [notes, setNotes] = useState('');

  // Sucesión dinámica de máquinas seleccionadas en el formulario
  const [selectedMachinesList, setSelectedMachinesList] = useState<FormMachineEntry[]>([]);

  useEffect(() => {
    if (!activePdfQuote) return;

    const runGeneration = async () => {
      // Small timeout for browser to render
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const quoteNum = activePdfQuote.quotationNumber || getProspectiveQuoteNumber();
      await runGenerateSafePDF('rental-quotation-canvas', quoteNum, activePdfQuote.client, 'Cotizacion_Renta');
      
      setActivePdfQuote(null);
    };

    runGeneration();
  }, [activePdfQuote]);

  // LocalStorage loader incorporating backwards compatibility
  const loadQuotes = () => {
    try {
      const stored = localStorage.getItem('machine_rental_quotes');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Migrate old single machine format list to multiple machines format
          const migrated: MachineRentalQuote[] = parsed.map((q: any) => {
            let updated = { ...q };
            if (!updated.machines && updated.machineId) {
              const matchedMachine = machines.find((m) => m.id === updated.machineId);
              const bCost = matchedMachine ? matchedMachine.baseCost : 0;
              updated.machines = [{
                machineId: updated.machineId,
                machineName: updated.machineName || 'N/A',
                baseCost: bCost,
                factor: updated.factor || 2.0,
                personalCount: updated.operatorsCount !== undefined ? updated.operatorsCount : 1
              }];
            } else if (updated.machines && Array.isArray(updated.machines)) {
              // Ensure every machine has a valid personalCount and baseCost
              updated.machines = updated.machines.map((m: any) => {
                const matchedMachine = machines.find((mac) => mac.id === m.machineId);
                const bCost = (m.baseCost !== undefined && m.baseCost > 0) ? m.baseCost : (matchedMachine ? matchedMachine.baseCost : 0);
                return {
                  ...m,
                  baseCost: bCost,
                  personalCount: m.personalCount !== undefined ? m.personalCount : (updated.operatorsCount !== undefined ? updated.operatorsCount : 1)
                };
              });
            }
            return updated;
          });
          setQuotes(migrated);
        } else {
          setQuotes([]);
        }
      } else {
        setQuotes([]);
      }
    } catch (e) {
      console.error('Error loading machine rental quotes:', e);
      setQuotes([]);
    }
  };

  // Sync quotes when machines loaded or mounted
  useEffect(() => {
    loadQuotes();
  }, [machines]);

  // Keep dynamic values synced with global params initially
  useEffect(() => {
    if (!editingId) {
      setOperatorHourlyCost(genParams.operatorHourlyCost);
      setProfitPercentage(genParams.profitPercentage);
    }
  }, [genParams, editingId]);

  // Initialize selected machines with one entry when machines list loads and form is empty
  useEffect(() => {
    if (selectedMachinesList.length === 0 && machines.length > 0 && !editingId) {
      setSelectedMachinesList([
        {
          key: `init-${Date.now()}`,
          machineId: machines[0].id,
          factor: 2.0,
          personalCount: 1
        }
      ]);
    }
  }, [machines, selectedMachinesList, editingId]);

  // Save quotes helper
  const saveQuotesList = (list: MachineRentalQuote[]) => {
    setQuotes(list);
    localStorage.setItem('machine_rental_quotes', JSON.stringify(list));
  };

  // Add Machine Row
  const addMachineRow = () => {
    if (machines.length === 0) return;
    setSelectedMachinesList(prev => [
      ...prev,
      {
        key: `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        machineId: machines[0].id,
        factor: 2.0,
        personalCount: 1
      }
    ]);
  };

  // Remove Machine Row
  const removeMachineRow = (key: string) => {
    if (selectedMachinesList.length <= 1) {
      Swal.fire({
        title: 'Acción no permitida',
        text: 'La cotización de renta debe contener al menos un elemento de máquina o prensa.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }
    setSelectedMachinesList(prev => prev.filter(item => item.key !== key));
  };

  // Update specific field of a machine row
  const updateMachineRow = (key: string, updates: Partial<Omit<FormMachineEntry, 'key'>>) => {
    setSelectedMachinesList(prev => prev.map(item => {
      if (item.key === key) {
        return { ...item, ...updates };
      }
      return item;
    }));
  };

  // Multi-machine Calculations in real time
  const calculations = useMemo(() => {
    // Map selectedMachinesList to the format needed by the calculation function
    const formattedList = selectedMachinesList.map(entry => {
      const match = machines.find(m => m.id === entry.machineId);
      return {
        machineId: entry.machineId,
        machineName: match ? match.name : 'N/A',
        baseCost: match ? match.baseCost : 0,
        factor: entry.factor,
        personalCount: entry.personalCount
      };
    });

    const result = calculateRentalBreakdown(
      formattedList,
      operatorHourlyCost,
      profitPercentage,
      hoursToRent,
      genParams,
      machines
    );

    // Append keys for React rendering cycle stability
    const breakdownsWithKeys = result.machineBreakdowns.map((b, idx) => ({
      ...b,
      key: selectedMachinesList[idx]?.key || `key-${idx}`
    }));

    return {
      ...result,
      machineBreakdowns: breakdownsWithKeys
    };
  }, [
    selectedMachinesList,
    machines,
    operatorHourlyCost,
    profitPercentage,
    hoursToRent,
    genParams
  ]);

  // Reset Form
  const resetForm = () => {
    setEditingId(null);
    setClient('');
    if (machines.length > 0) {
      setSelectedMachinesList([
        {
          key: `init-${Date.now()}`,
          machineId: machines[0].id,
          factor: 2.0,
          personalCount: 1
        }
      ]);
    } else {
      setSelectedMachinesList([]);
    }
    setOperatorHourlyCost(genParams.operatorHourlyCost);
    setProfitPercentage(genParams.profitPercentage);
    setHoursToRent(1);
    setNotes('');
  };

  // Form Save / Update Submission
  const handleSaveQuote = (e: React.FormEvent) => {
    e.preventDefault();

    if (!client.trim()) {
      Swal.fire({
        title: 'Error de validación',
        text: 'Por favor, introduce el nombre del cliente.',
        icon: 'error',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    if (selectedMachinesList.length === 0) {
      Swal.fire({
        title: 'Error de validación',
        text: 'Debes agregar al menos una máquina en la cotización.',
        icon: 'error',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    // Validate entries
    for (let i = 0; i < selectedMachinesList.length; i++) {
      const mEntry = selectedMachinesList[i];
      if (!mEntry.machineId) {
        Swal.fire({
          title: 'Error de validación',
          text: `La máquina de la fila ${i + 1} no es válida.`,
          icon: 'error',
          confirmButtonColor: '#4f46e5'
        });
        return;
      }
      if (mEntry.personalCount < 0) {
        Swal.fire({
          title: 'Error de validación',
          text: `La cantidad de personal en la fila ${i + 1} debe ser mayor o igual a 0.`,
          icon: 'error',
          confirmButtonColor: '#4f46e5'
        });
        return;
      }
    }

    if (operatorHourlyCost <= 0) {
      Swal.fire({
        title: 'Error de validación',
        text: 'El costo por hora de mano de obra (MO) debe ser mayor a 0 USD.',
        icon: 'error',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    if (hoursToRent < 1) {
      Swal.fire({
        title: 'Error de validación',
        text: 'La cantidad de horas a rentar debe ser por lo menos 1 hora.',
        icon: 'error',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    // Map machines list to saveable state
    const mappedMachines: RentalMachineItem[] = calculations.machineBreakdowns.map(b => ({
      machineId: b.machineId,
      machineName: b.machineName,
      baseCost: b.baseCost,
      factor: b.factor,
      personalCount: b.personalCount
    }));

    const firstMachine = mappedMachines[0];
    const totalPersonalCount = calculations.totalPersonal;

    // Format Fecha
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const fechaStr = `${day}/${month}/${year} ${hour}:${minute}`;

    const existingQuote = editingId ? quotes.find(q => q.id === editingId) : null;
    const finalQuotationNumber = existingQuote?.quotationNumber || generateQuotationNumber();

    const newQuote: MachineRentalQuote = {
      id: editingId || `rental-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      fecha: editingId ? (existingQuote?.fecha || fechaStr) : fechaStr,
      client: client.trim(),
      machines: mappedMachines,
      quotationNumber: finalQuotationNumber,
      
      // Legacy support values
      machineId: firstMachine?.machineId || '',
      machineName: firstMachine?.machineName || '',
      factor: firstMachine?.factor || 2.0,
      operatorsCount: totalPersonalCount,

      operatorHourlyCost,
      profitPercentage,
      hoursToRent,
      notes: notes.trim(),
      pricePerHour: calculations.pricePerHourTotal,
      total: calculations.total,
      tipo: 'renta_maquina',
      manufacturingBurdenPercentage: genParams.manufacturingBurdenPercentage,
      generalAdminPercentage: genParams.generalAdminPercentage,
      salesPercentage: genParams.salesPercentage
    };

    if (editingId) {
      const updatedList = quotes.map(q => q.id === editingId ? newQuote : q);
      saveQuotesList(updatedList);
      Swal.fire({
        title: '¡Cotización actualizada!',
        text: `La cotización de renta ${finalQuotationNumber} ha sido guardada exitosamente. Se generará el PDF automáticamente.`,
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });
      resetForm();
    } else {
      saveQuotesList([newQuote, ...quotes]);
      Swal.fire({
        title: '¡Cotización guardada!',
        text: `La cotización de renta ${finalQuotationNumber} ha sido guardada en el historial. Se generará el PDF automáticamente.`,
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });
      resetForm();
    }

    // Trigger dynamic PDF generation and automatic download
    triggerPdfGeneration(newQuote);
  };

  // Delete Quote
  const handleDeleteQuote = (id: string, clientName: string) => {
    Swal.fire({
      title: '¿Eliminar cotización?',
      text: `¿Estás seguro de que deseas eliminar permanentemente la cotización para "${clientName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const remaining = quotes.filter(q => q.id !== id);
        saveQuotesList(remaining);
        Swal.fire({
          title: 'Eliminada',
          text: 'La cotización de renta fue quitada del historial.',
          icon: 'success',
          confirmButtonColor: '#4f46e5'
        });
        if (editingId === id) resetForm();
      }
    });
  };

  // Edit Quote
  const handleEditQuote = (quote: MachineRentalQuote) => {
    setEditingId(quote.id);
    setClient(quote.client);
    setOperatorHourlyCost(quote.operatorHourlyCost);
    setProfitPercentage(quote.profitPercentage);
    setHoursToRent(quote.hoursToRent);
    setNotes(quote.notes || '');

    // Reconstruct list of machine rows with fresh React keys
    if (quote.machines && quote.machines.length > 0) {
      setSelectedMachinesList(quote.machines.map((m, idx) => ({
        key: `m-edit-${idx}-${Date.now()}-${idx}`,
        machineId: m.machineId,
        factor: m.factor,
        personalCount: m.personalCount
      })));
    } else {
      // Compatibility with old quotes having single machine keys
      setSelectedMachinesList([
        {
          key: `m-compat-${Date.now()}`,
          machineId: quote.machineId || '',
          factor: quote.factor || 2.0,
          personalCount: quote.operatorsCount || 1
        }
      ]);
    }

    const formElement = document.getElementById('rental-form-container');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // CSV Exporter supporting multiple machines summary per row
  const handleExportCSV = () => {
    if (quotes.length === 0) {
      Swal.fire({
        title: 'Historial vacío',
        text: 'No hay cotizaciones para exportar.',
        icon: 'info',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const headers = [
      'ID',
      'Fecha',
      'Cliente',
      'Maquinas/Prensas',
      'Factores (%)',
      'Personal Total',
      'Costo MO USD/h',
      'Profit %',
      'Precio por Hora USD',
      'Horas Rentadas',
      'Total USD',
      'Notas'
    ];

    const rows = quotes.map(q => {
      const machineNamesJoined = q.machines 
        ? q.machines.map(m => m.machineName).join(' + ') 
        : q.machineName || 'N/A';
      
      const factorsJoined = q.machines 
        ? q.machines.map(m => `${m.factor * 100}%`).join(' + ') 
        : `${(q.factor || 2.0) * 100}%`;
      
      const personalCountTotal = q.machines 
        ? q.machines.reduce((acc, m) => acc + m.personalCount, 0) 
        : (q.operatorsCount || 0);

      return [
        q.id,
        q.fecha,
        `"${q.client.replace(/"/g, '""')}"`,
        `"${machineNamesJoined.replace(/"/g, '""')}"`,
        `"${factorsJoined}"`,
        personalCountTotal,
        q.operatorHourlyCost.toFixed(2),
        `${q.profitPercentage}%`,
        q.pricePerHour.toFixed(2),
        q.hoursToRent,
        q.total.toFixed(2),
        `"${(q.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `historial_rentas_consolidadas_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="machine-rental-container">
      {/* Module Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Renta de Prensas / Máquinas (Múltiples)</h2>
        <p className="text-sm text-slate-500">
          Combina múltiples prensas de estampado e infraestructura industrial en una misma cotización con costo por hora integrado.
        </p>
      </div>

      {/* Grid: Left: Form, Right: Live calculation preview card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="rental-form-container">
        
        {/* Form Container */}
        <form onSubmit={handleSaveQuote} className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-indigo-600" />
            {editingId ? 'Editar Cotización Multimáquina' : 'Nueva Cotización de Máquinas Combinadas'}
          </h3>

          {/* Form Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Client input */}
            <div className="space-y-1">
              <label htmlFor="rental-client" className="text-xs font-semibold text-slate-600">Cliente *</label>
              <input
                id="rental-client"
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Nombre de cliente o razón social..."
                className="w-full bg-slate-50/50 hover:bg-slate-50/90 focus:bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors font-medium text-slate-800"
                required
              />
            </div>

            {/* MO Hourly cost */}
            <div className="space-y-1">
              <label htmlFor="rental-mo-cost" className="text-xs font-semibold text-slate-600">Costo MO (USD / Hora / Operador) *</label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-400 text-xs font-semibold">$</span>
                <input
                  id="rental-mo-cost"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={operatorHourlyCost}
                  onChange={(e) => setOperatorHourlyCost(Math.max(0.01, parseFloat(e.target.value) || 0))}
                  className="w-full pl-7 pr-12 bg-slate-50/50 hover:bg-slate-50/90 focus:bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors font-bold text-slate-700"
                  required
                />
                <span className="absolute right-3 text-slate-400 text-[10px] font-bold">USD/h</span>
              </div>
            </div>

            {/* Profit Margin */}
            <div className="space-y-1">
              <label htmlFor="rental-profit" className="text-xs font-semibold text-slate-600">Márgen Comercial / Utilidad (Profit %)</label>
              <div className="relative flex items-center">
                <input
                  id="rental-profit"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={profitPercentage}
                  onChange={(e) => setProfitPercentage(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  className="w-full pr-8 bg-slate-50/50 hover:bg-slate-50/90 focus:bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors font-bold text-slate-700"
                  required
                />
                <span className="absolute right-3 text-slate-400 text-xs font-bold">%</span>
              </div>
            </div>

            {/* Hours to Rent */}
            <div className="space-y-1">
              <label htmlFor="rental-hours" className="text-xs font-semibold text-slate-600">Total de Horas a Rentar *</label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                </span>
                <input
                  id="rental-hours"
                  type="number"
                  min="1"
                  step="1"
                  value={hoursToRent}
                  onChange={(e) => setHoursToRent(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full pl-9 pr-12 bg-slate-50/50 hover:bg-slate-50/90 focus:bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors font-bold text-slate-700"
                  required
                />
                <span className="absolute right-3 text-slate-400 text-[10px] font-semibold">Horas</span>
              </div>
            </div>
          </div>

          {/* Dynamic list of machines */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-500" />
                Configuración de Máquinas / Prensas ({selectedMachinesList.length})
              </span>
              <button
                id="add-machine-row-btn"
                type="button"
                onClick={addMachineRow}
                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold text-xs bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors border border-indigo-100"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Máquina
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {machines.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Cargando base de máquinas...</p>
              ) : (
                selectedMachinesList.map((entry, index) => {
                  return (
                    <div 
                      key={entry.key} 
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 rounded-lg bg-slate-50/70 border border-slate-200/60 transition-all hover:border-slate-350"
                    >
                      {/* Machine Selector */}
                      <div className="md:col-span-5 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Máquina / Prensa #{index + 1}</label>
                        <select
                          value={entry.machineId}
                          onChange={(e) => updateMachineRow(entry.key, { machineId: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none cursor-pointer text-slate-700 font-medium"
                          required
                        >
                          {machines.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} (${(m.baseCost * 60).toFixed(2)} USD/h)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Factor Multiplier */}
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase font-sans">Factor</label>
                        <select
                          value={entry.factor}
                          onChange={(e) => updateMachineRow(entry.key, { factor: parseFloat(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none cursor-pointer text-slate-700 font-medium"
                        >
                          <option value="2">Alto (200% / 2.0x)</option>
                          <option value="2.5">Medio (250% / 2.5x)</option>
                          <option value="3">Bajo (300% / 3.0x)</option>
                          <option value="4">Extremo (400% / 4.0x)</option>
                        </select>
                      </div>

                      {/* Operators assigned */}
                      <div className="md:col-span-3 space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Personal MO</label>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={entry.personalCount}
                          onChange={(e) => updateMachineRow(entry.key, { personalCount: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 font-semibold text-slate-800"
                          placeholder="0"
                          required
                        />
                      </div>

                      {/* Remove Row Action */}
                      <div className="md:col-span-1 pb-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeMachineRow(entry.key)}
                          className="p-2 text-slate-400 hover:text-rose-650 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center border border-transparent hover:border-rose-100"
                          title="Remover renglón de máquina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Notes Input */}
          <div className="space-y-1">
            <label htmlFor="rental-notes" className="text-xs font-semibold text-slate-600">Notas / Comentarios de Renta</label>
            <textarea
              id="rental-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Instrucciones adicionales, turnos requeridos o logística de herramental..."
              className="w-full bg-slate-50/40 hover:bg-slate-50/90 focus:bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors resize-none placeholder:text-slate-350 text-slate-700"
            />
          </div>

          {/* Action footer */}
          <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
            {editingId && (
              <button
                id="cancel-edit-rental-btn"
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 px-4 rounded-lg border border-slate-200 shadow-xs transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Cancelar Edición
              </button>
            )}
            <button
              id="submit-rental-btn"
              type="submit"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-5 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {editingId ? 'Actualizar Cotización' : 'Guardar Cotización Renta'}
            </button>
          </div>
        </form>

        {/* Dynamic calculation live preview card */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-xl shadow-md p-5 flex flex-col justify-between border border-slate-800">
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-indigo-400 tracking-wider uppercase flex items-center gap-2 border-b border-slate-800/80 pb-2">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Ecuación y Desglose Consolidado
            </h3>
            
            {/* Primary displays */}
            <div className="space-y-1 py-3 bg-slate-800/40 rounded-xl p-3 border border-slate-800/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Tarifa por Hora Integrada</span>
              <div className="flex items-baseline gap-1 text-2xl font-black text-white font-mono">
                <span>${calculations.pricePerHourTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-xs font-medium text-slate-400">USD / h</span>
              </div>
              <div className="text-[10px] text-slate-400 leading-normal font-medium">
                Prensas cotizadas simultáneamente: {selectedMachinesList.length}. Personal total: {calculations.totalPersonal} Op(s).
              </div>
            </div>

            {/* Formula step by step breakdown of EACH selected machine */}
            <div className="space-y-3 text-xs max-h-[300px] overflow-y-auto pr-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pb-0.5">Subtotales por Prensa</span>
              {calculations.machineBreakdowns.map((b, idx) => (
                <div key={b.key} className="bg-slate-800/20 p-2.5 rounded-lg border border-slate-800/60 space-y-1">
                  <div className="flex justify-between items-center text-slate-200 font-bold border-b border-slate-800/40 pb-1">
                    <span>{idx + 1}. {b.machineName}</span>
                    <span className="font-mono text-indigo-300">${b.pricePerHour.toFixed(2)} USD/h</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Costo base por hora (${b.baseCostHourly.toFixed(2)}):</span>
                    <span className="font-mono text-slate-300">${b.baseCostHourly.toFixed(2)} USD/h</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Factor aplicado sobre costo por hora ({b.factor * 100}%):</span>
                    <span className="font-mono text-indigo-200">${b.machinePart.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>MO asignada ({b.personalCount} Op × ${operatorHourlyCost.toFixed(2)}):</span>
                    <span className="font-mono text-emerald-200">${b.laborPart.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Costo Directo Base:</span>
                    <span className="font-mono font-bold">${b.subtotalRaw.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-slate-500 italic">
                    <span>Overhead (+{genParams.manufacturingBurdenPercentage + genParams.generalAdminPercentage + genParams.salesPercentage}%) & Profit (+{profitPercentage}%):</span>
                    <span className="font-mono font-semibold">+${(b.burdenAmount + b.gaAmount + b.salesAmount + b.profitAmount).toFixed(2)}</span>
                  </div>
                </div>
              ))}

              {/* General details list */}
              <div className="border-t border-slate-800/80 my-1 pt-2 space-y-1 text-slate-400 text-[10px]">
                <div className="flex justify-between">
                  <span>Margen Comercial Estimado:</span>
                  <span className="font-mono font-semibold text-sky-400">+{profitPercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Manufacturing Burden + G&A + Sales:</span>
                  <span className="font-mono">+{genParams.manufacturingBurdenPercentage + genParams.generalAdminPercentage + genParams.salesPercentage}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3 mt-3 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-400 uppercase">TOTAL ({hoursToRent} {hoursToRent === 1 ? 'hora' : 'horas'}):</span>
              <span className="text-xl font-extrabold text-emerald-400 font-mono">
                ${calculations.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>
            <div className="text-[9px] text-slate-500 font-bold tracking-tight text-right pt-0.5">
              * Tasas fijas por hora estimadas con rentabilidad calculada por elemento
            </div>
          </div>
        </div>
      </div>

      {/* History table card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div className="flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Historial de Registro de Rentas</h3>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
              {quotes.length} registros
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="export-rental-csv-btn"
              onClick={handleExportCSV}
              disabled={quotes.length === 0}
              className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-50 border border-slate-200 text-xs font-bold py-2 px-3.5 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Descargar historial de cotizaciones de renta como CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* History table list */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="rental-quotes-table">
            <thead>
              <tr className="border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 pb-2">Tipo</th>
                <th className="py-2.5 pb-2">Fecha</th>
                <th className="py-2.5 pb-2">Cliente</th>
                <th className="py-2.5 pb-2">Prensas de Estampado</th>
                <th className="py-2.5 pb-2">Factores</th>
                <th className="py-2.5 pb-2">Personal por Prensa</th>
                <th className="py-2.5 pb-2">Costo MO</th>
                <th className="py-2.5 pb-2">Profit %</th>
                <th className="py-2.5 pb-2">Precio/h</th>
                <th className="py-2.5 pb-2">Horas</th>
                <th className="py-2.5 pb-2">Total General</th>
                <th className="py-2.5 pb-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[11px] font-medium text-slate-700">
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400 font-bold">
                    No se han registrado cotizaciones de renta con desglose de múltiples máquinas.
                  </td>
                </tr>
              ) : (
                quotes.map((q) => {
                  const machineNamesList = q.machines ? q.machines.map(m => m.machineName).join(', ') : q.machineName || 'N/A';
                  const totalOps = q.machines 
                    ? q.machines.reduce((acc, m) => acc + m.personalCount, 0)
                    : (q.operatorsCount || 0);

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/50 group transition-colors">
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                          Consolidado
                        </span>
                      </td>
                      <td className="py-3 text-slate-500 whitespace-nowrap">{q.fecha}</td>
                      <td className="py-3 font-semibold text-slate-900">{q.client}</td>
                      <td className="py-3 font-semibold text-slate-800 max-w-[200px]" title={machineNamesList}>
                        {q.machines && q.machines.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {q.machines.map((m, idx) => (
                              <span key={idx} className="bg-slate-100/70 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                                {m.machineName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">{q.machineName || 'N/A'}</span>
                        )}
                      </td>
                      <td className="py-3 font-mono text-indigo-700 font-bold">
                        {q.machines && q.machines.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {q.machines.map((m, idx) => (
                              <span key={idx} className="bg-indigo-50/40 border border-indigo-100 text-indigo-800 px-1 py-0.2 rounded text-[10px]">
                                {m.factor * 100}%
                              </span>
                            ))}
                          </div>
                        ) : (
                          `${(q.factor || 2.0) * 100}%`
                        )}
                      </td>
                      <td className="py-3 text-slate-600">
                        <div className="font-bold text-slate-800">
                          {totalOps} Ops
                          {q.machines && q.machines.length > 0 && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              ({q.machines.map(m => m.personalCount).join(' + ')})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 font-mono text-slate-500">${q.operatorHourlyCost.toFixed(2)}</td>
                      <td className="py-3 font-mono font-bold text-sky-700">{q.profitPercentage}%</td>
                      <td className="py-3 font-mono text-slate-900 font-extrabold whitespace-nowrap">${q.pricePerHour.toFixed(2)}</td>
                      <td className="py-3 font-mono text-slate-600 font-bold">{q.hoursToRent} h</td>
                      <td className="py-3 font-mono text-emerald-700 font-extrabold whitespace-nowrap bg-emerald-50/20 px-2 rounded-md">
                        ${q.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            id={`view-details-${q.id}`}
                            onClick={() => handleOpenDetailModal(q)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded cursor-pointer"
                            title="Visualizar detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`pdf-rental-${q.id}`}
                            onClick={() => triggerPdfGeneration(q)}
                            className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-55 rounded cursor-pointer"
                            title="Descargar PDF de cotización de renta"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`edit-rental-${q.id}`}
                            onClick={() => handleEditQuote(q)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Editar cotización de renta"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-rental-${q.id}`}
                            onClick={() => handleDeleteQuote(q.id, q.client)}
                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed view Modal */}
      <RentalQuoteDetailModal
        quote={selectedRentalQuote}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        machinesCatalog={machines}
      />

      {/* Hidden PDF/Print Template for Renta de Máquina */}
      {activePdfQuote && (() => {
        const pdfGenParams = {
          ...genParams,
          manufacturingBurdenPercentage: activePdfQuote.manufacturingBurdenPercentage !== undefined ? activePdfQuote.manufacturingBurdenPercentage : 3.5,
          generalAdminPercentage: activePdfQuote.generalAdminPercentage !== undefined ? activePdfQuote.generalAdminPercentage : 3.0,
          salesPercentage: activePdfQuote.salesPercentage !== undefined ? activePdfQuote.salesPercentage : 3.0
        };

        const result = calculateRentalBreakdown(
          activePdfQuote.machines || [],
          activePdfQuote.operatorHourlyCost,
          activePdfQuote.profitPercentage,
          activePdfQuote.hoursToRent,
          pdfGenParams,
          machines
        );

        const breakdownList = result.machineBreakdowns;
        const totalDirectCostPerHour = result.sumSubtotalRaw;
        const pricePerHourTotal = result.pricePerHourTotal;
        const totalGeneral = result.total;

        const sumBurdenPerHour = result.sumBurdenAmount;
        const sumGaPerHour = result.sumGaAmount;
        const sumSalesPerHour = result.sumSalesAmount;
        const sumProfitPerHour = result.sumProfitAmount;
        const sumSgaProfitPerHour = result.sumSgaProfitPerHour;

        const pdfBurdenDec = result.burdenDec;
        const pdfGaDec = result.gaDec;
        const pdfSalesDec = result.salesDec;
        const pdfProfitDec = result.profitDec;

        const quoteNum = activePdfQuote.quotationNumber || getProspectiveQuoteNumber();

        return (
          <div 
            id="rental-quotation-canvas" 
            className="bg-white border border-slate-200 p-6 max-w-[850px] mx-auto font-sans text-slate-800 shadow-lg absolute -left-[9999px] -top-[9999px]" 
            style={{ width: '850px' }}
          >
            {/* Banner header from sheet 2 with logo */}
            <div className="flex items-center justify-between bg-[#5B9BD5] text-white p-3 border-2 border-black gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-900 text-white px-3 py-1.5 rounded border border-black flex flex-col justify-center items-center shadow-sm select-none">
                  <span className="text-[10px] font-black tracking-wider text-white leading-none">METALWORK</span>
                  <span className="text-[7px] font-bold tracking-[0.2em] text-blue-300 mt-0.5 leading-none uppercase">& STAMPING</span>
                </div>
                <div className="text-left space-y-0.5">
                  <h1 className="text-lg font-extrabold tracking-wider leading-none">METALWORK & STAMPING, S.A. de C.V.</h1>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-sm font-black tracking-widest uppercase text-white leading-none">QUOTATION – MACHINE RENTAL</h2>
              </div>
            </div>

            {/* Commercial details block */}
            <div className="grid grid-cols-12 border-x-2 border-b-2 border-black bg-white">
              <div className="col-span-8 p-3 border-r-2 border-black space-y-1 text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">CUSTOMER</span>
                <span className="text-sm font-extrabold text-slate-900 tracking-wide uppercase">{activePdfQuote.client}</span>
              </div>

              <div className="col-span-4 grid grid-rows-2 text-xs">
                <div className="grid grid-cols-2 border-b border-black">
                  <span className="bg-slate-50/50 p-1.5 font-bold border-r border-black flex items-center justify-center text-[10px]">NUMERO</span>
                  <span className="p-1.5 text-center font-mono font-bold tracking-wide flex items-center justify-center">{quoteNum}</span>
                </div>
                <div className="grid grid-cols-2">
                  <span className="bg-slate-50/50 p-1.5 font-bold border-r border-black flex items-center justify-center text-[9px] uppercase font-sans">DÍA/MES/AÑO</span>
                  <span className="p-1.5 text-center font-mono flex items-center justify-center">{activePdfQuote.fecha.split(' ')[0]}</span>
                </div>
              </div>
            </div>

            {/* Secondary intro line CC */}
            <div className="bg-[#BDD7EE] border-x-2 border-b-2 border-black p-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-800">
              COTIZACIÓN DE RENTA DE MÁQUINAS / PRENSAS:
            </div>

            {/* Sheet Table Grid */}
            <div className="border-x-2 border-b-2 border-black overflow-hidden bg-white">
              <table className="w-full text-left border-collapse text-[10px] font-medium text-slate-800">
                <thead>
                  <tr className="bg-[#BDD7EE] border-b-2 border-black font-extrabold text-center uppercase tracking-normal">
                    <th className="py-2.5 px-2 border-r border-black w-[16%] text-[8px] text-left uppercase">MÁQUINA / PRENSA</th>
                    <th className="py-2.5 px-1 bg-blue-50/20 border-r border-black w-[10%] text-[8px] uppercase">COSTO MÁQ/H</th>
                    <th className="py-2.5 px-1 border-r border-black w-[10%] text-[8px] uppercase">COSTO MO/H (Op)</th>
                    <th className="py-2.5 px-1 border-r border-black w-[7%] text-[8px] uppercase">PERSONAL</th>
                    <th className="py-2.5 px-1 border-r border-black w-[6%] text-[8px] uppercase">HORAS</th>
                    <th className="py-2.5 px-1.5 border-r border-black w-[12%] text-[8px] uppercase">SUBTOTAL MÁQ</th>
                    <th className="py-2.5 px-1.5 border-r border-black w-[11%] text-[8px] uppercase">SUBTOTAL MO</th>
                    <th className="py-2.5 px-1.5 border-r border-black w-[14%] text-[8px] uppercase">COSTO TOTAL BASE</th>
                    <th className="py-2.5 px-1.5 w-[14%] text-[8.5px] bg-blue-100/30 text-indigo-950 font-black uppercase">COSTO BASE / HORA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-semibold text-center text-[10px]">
                  {breakdownList.map((m, idx) => {
                    const subtotalMaq = m.machinePart * activePdfQuote.hoursToRent;
                    const subtotalMO = (activePdfQuote.operatorHourlyCost * m.personalCount) * activePdfQuote.hoursToRent;
                    const costoTotalBase = subtotalMaq + subtotalMO;
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-2 border-r border-black text-left font-sans font-extrabold text-slate-800">{m.machineName}</td>
                        <td className="py-2 px-1 border-r border-black font-mono text-slate-700">${m.machinePart.toFixed(2)}</td>
                        <td className="py-2 px-1 border-r border-black font-mono text-slate-700">${activePdfQuote.operatorHourlyCost.toFixed(2)}</td>
                        <td className="py-2 px-1 border-r border-black font-sans text-slate-700">{m.personalCount} Op{m.personalCount !== 1 ? 's' : ''}</td>
                        <td className="py-2 px-1 border-r border-black font-mono text-slate-700">{activePdfQuote.hoursToRent} h</td>
                        <td className="py-2 px-1 border-r border-black font-mono text-slate-700">${subtotalMaq.toFixed(2)}</td>
                        <td className="py-2 px-1 border-r border-black font-mono text-slate-700">${subtotalMO.toFixed(2)}</td>
                        <td className="py-2 px-1 border-r border-black font-mono font-bold text-slate-800">${costoTotalBase.toFixed(2)}</td>
                        <td className="py-2 px-1 font-mono font-black text-indigo-900 bg-indigo-50/20">${m.subtotalRaw.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  {breakdownList.length > 1 && (() => {
                    const sumSubtotalMaq = result.sumMachinePart * activePdfQuote.hoursToRent;
                    const sumSubtotalMO = result.sumLaborPart * activePdfQuote.hoursToRent;
                    const sumCostoTotalBase = sumSubtotalMaq + sumSubtotalMO;
                    return (
                      <tr className="bg-slate-100 font-bold border-t-2 border-black text-center text-[10px]">
                        <td className="py-2 px-2 border-r border-black text-left font-extrabold uppercase text-slate-900">Totales Consolidados</td>
                        <td className="py-2 px-1 border-r border-black font-mono text-slate-800">${result.sumMachinePart.toFixed(2)}</td>
                        <td className="py-2 px-1 border-r border-black font-mono text-slate-800">${activePdfQuote.operatorHourlyCost.toFixed(2)}</td>
                        <td className="py-2 px-1 border-r border-black font-sans text-slate-800">{result.totalPersonal} Ops</td>
                        <td className="py-2 px-1 border-r border-black font-mono text-slate-800">-</td>
                        <td className="py-2 px-1 border-r border-black font-mono text-slate-800">${sumSubtotalMaq.toFixed(2)}</td>
                        <td className="py-2 px-1 border-r border-black font-mono text-slate-800">${sumSubtotalMO.toFixed(2)}</td>
                        <td className="py-2 px-1 border-r border-black font-mono font-extrabold text-slate-900">${sumCostoTotalBase.toFixed(2)}</td>
                        <td className="py-2 px-1 font-mono font-black text-indigo-950 bg-indigo-100/30">${result.sumSubtotalRaw.toFixed(2)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* Calculations breakdown block styled closely to Sheet parameters */}
            <div className="mt-8 border-2 border-black bg-white rounded overflow-hidden">
              <div className="bg-[#BDD7EE] p-2 border-b-2 border-black text-center text-[10.5px] font-bold uppercase tracking-wider text-slate-800">
                SGA & PROFIT CALCULATIONS (DESGLOSE DE PARÁMETROS RENTA)
              </div>
              
              <div className="p-3.5 grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] text-left border-b border-black">
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold block uppercase leading-snug">BURDEN ({(pdfBurdenDec * 100).toFixed(1)}%)</span>
                  <span className="font-mono text-slate-800 font-extrabold block text-xs">
                    ${sumBurdenPerHour.toFixed(2)} USD/h
                  </span>
                </div>
                
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold block uppercase leading-snug">G&A ({(pdfGaDec * 100).toFixed(1)}%)</span>
                  <span className="font-mono text-slate-800 font-extrabold block text-xs">
                    ${sumGaPerHour.toFixed(2)} USD/h
                  </span>
                </div>
                
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold block uppercase leading-snug">SALES COMM ({(pdfSalesDec * 100).toFixed(1)}%)</span>
                  <span className="font-mono text-slate-800 font-extrabold block text-xs">
                    ${sumSalesPerHour.toFixed(2)} USD/h
                  </span>
                </div>
                
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold block uppercase leading-snug">PROFIT ({(pdfProfitDec * 100).toFixed(1)}%)</span>
                  <span className="font-mono text-slate-800 font-extrabold block text-xs">
                    ${sumProfitPerHour.toFixed(2)} USD/h
                  </span>
                </div>
              </div>

              <div className="bg-white p-2.5 px-4 flex justify-between items-center text-xs font-bold font-sans">
                <span className="text-slate-700 uppercase tracking-wide">SUBTOTAL SGA & PROFIT POR HORA:</span>
                <span className="font-mono text-[13px] text-slate-900 font-extrabold">${sumSgaProfitPerHour.toFixed(2)} USD/h</span>
              </div>

              <div className="bg-[#BDD7EE]/50 border-t border-black p-2.5 px-4 flex justify-between items-center text-xs font-extrabold font-sans">
                <span className="text-indigo-950 uppercase tracking-wide">TOTAL RENTA (POR HORA):</span>
                <span className="font-mono text-[14px] text-indigo-900 font-black">${pricePerHourTotal.toFixed(2)} USD/h</span>
              </div>
              
              <div className="bg-slate-100 border-t-2 border-black p-2.5 px-4 flex justify-between items-center text-xs font-extrabold font-sans">
                <span className="text-indigo-950 uppercase tracking-wider text-[11px]">TOTAL GENERAL IMPORTE POR {activePdfQuote.hoursToRent} HORA(S):</span>
                <span className="font-mono text-[17px] text-indigo-700 font-black">${totalGeneral.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
              </div>
            </div>

            {/* Quote Conditions Notes Block */}
            {activePdfQuote.notes && (
              <div className="mt-8 border border-slate-300 p-4 bg-slate-50/50 rounded text-left">
                <div className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 border-b border-slate-200/60 pb-1">Notas / Comentarios Especiales de Renta</div>
                <p className="text-[10px] font-semibold text-slate-700 whitespace-pre-wrap leading-relaxed">{activePdfQuote.notes}</p>
              </div>
            )}

            {/* Commercial terms identical to parts quote */}
            <div className="mt-8 border-2 border-black p-4 bg-slate-50/50 space-y-3 rounded text-left">
              <div className="flex items-center gap-2 border-b border-black/10 pb-1 pb-1.5">
                <span className="text-xs font-extrabold text-slate-950 uppercase tracking-widest">Condiciones Comerciales</span>
              </div>

              <ul className="list-disc pl-5 text-[10px] font-bold text-slate-700 space-y-2 leading-relaxed">
                <li>THIS PRICE IS USD DOLLARS</li>
                <li>PRICE DO NOT INCLUDED VALUE ADDED TAX (IVA)</li>
                <li>FOB MW SALTILLO</li>
                <li>QUOTATION BASED ON TECHNICAL INFORMATION PROVIDED BY {activePdfQuote.client || 'FMX'}.</li>
                <li>DO NOT INCLUDED OIL CLEAN</li>
                <li>Metalwork's general terms and conditions of sales apply.</li>
              </ul>
            </div>

            {/* Signature lines print support */}
            <div className="mt-16 grid grid-cols-2 gap-12 text-center text-[10px] uppercase tracking-wider">
              <div className="flex flex-col justify-end min-h-[52px]">
                <span className="font-sans text-xs text-slate-900 font-bold mb-1 normal-case tracking-normal">Ing. Ulises Sanchez</span>
                <div className="border-b-2 border-black mx-auto w-[80%] mb-2"></div>
                <span className="font-bold text-slate-500">FIRMA AUTORIZADA MW</span>
              </div>
              <div className="flex flex-col justify-end min-h-[52px]">
                <div className="border-b-2 border-black mx-auto w-[80%] mb-2"></div>
                <span className="font-bold text-slate-500">Aceptación y Firma de Cliente - {activePdfQuote.client}</span>
              </div>
            </div>

            {/* PDF Page Footer */}
            <div className="mt-14 pt-3 border-t border-slate-200 grid grid-cols-2 items-center text-[9px] font-bold text-slate-400 w-full uppercase">
              <span className="text-left font-mono">F-7.2-03  REV.01</span>
              <span className="text-right whitespace-nowrap">Metalwork & Stamping S.A. de C.V.</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

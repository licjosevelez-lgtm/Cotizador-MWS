import React, { useState, useMemo } from 'react';
import { calculatePartQuotation, PartNumber, Machine, GeneralParameters, VolumeParameters, VolumeCategory } from '../types';
import { usePartNumbers } from '../contexts/PartNumbersContext';
import { Search, FileSpreadsheet, Percent, HelpCircle, TrendingUp, DollarSign, Layers, ArrowUpDown, ShieldAlert, Sparkles, Eye } from 'lucide-react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { StandardCostBreakdownModal } from './StandardCostBreakdownModal';

interface MarginalAnalysisProps {
  machines: Machine[];
  volParams: VolumeParameters;
  genParams: GeneralParameters;
}

// Auxiliary function to calculate Costo Base (forcing volumeMultiplier = 1.0)
export function calculateBaseCost(
  part: PartNumber,
  machines: Machine[],
  genParams: GeneralParameters
): ReturnType<typeof calculatePartQuotation> {
  const baseVolParams: VolumeParameters = {
    altoPercentage: 100,
    medioPercentage: 100,
    bajoPercentage: 100,
    factoryPercentage: 100,
  };
  return calculatePartQuotation(part, machines, baseVolParams, genParams);
}

export const MarginalAnalysis: React.FC<MarginalAnalysisProps> = ({
  machines,
  volParams,
  genParams,
}) => {
  const { partNumbers } = usePartNumbers();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('ALL');
  
  // Selection state
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  // Standard Cost Breakdown State
  const [selectedPartForStandardCost, setSelectedPartForStandardCost] = useState<PartNumber | null>(null);
  const [isStandardCostModalOpen, setIsStandardCostModalOpen] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<string>('partNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Master calculated list
  const calculatedParts = useMemo(() => {
    return partNumbers.map((part) => {
      const isFeasible = part.isFeasible !== false;
      const weeklyVolume = part.weeklyVolume || 0;

      // Final quoted calculation
      const finalQuotation = calculatePartQuotation(part, machines, volParams, genParams);
      
      // Costo base calculation (volumeMultiplier = 1.0)
      const baseQuotation = calculateBaseCost(part, machines, genParams);

      const priceVentaFinal = finalQuotation.exWorksCost;
      const costoBase = baseQuotation.exWorksCost;

      const margenBrutoUSD = priceVentaFinal - costoBase;
      const margenBrutoPercent = priceVentaFinal > 0 ? (margenBrutoUSD / priceVentaFinal) * 100 : 0;

      // Direct labor remains untouched by multiplier
      const costoMO = finalQuotation.directLaborTotal;
      // SGA costs sum (burden + generalAdmin + sales)
      const costoSGA = finalQuotation.manufacturingBurden + finalQuotation.generalAdmin + finalQuotation.sales;
      const profit = finalQuotation.profit;

      return {
        id: part.id,
        partNumber: part.partNumber,
        client: part.client || 'N/A',
        description: part.description || 'Sin descripción',
        weeklyVolume,
        isFeasible,
        volumeCategory: part.volumeCategory,
        priceVentaFinal,
        costoBase,
        margenBrutoUSD,
        margenBrutoPercent,
        costoMO,
        costoSGA,
        profit,
      };
    });
  }, [partNumbers, machines, volParams, genParams]);

  // Find selected part details if selected
  const selectedPart = useMemo(() => {
    if (!selectedPartId) return null;
    return calculatedParts.find((p) => p.id === selectedPartId) || null;
  }, [calculatedParts, selectedPartId]);

  // Clients list for the dropdown filter
  const clientsList = useMemo(() => {
    const clients = partNumbers.map((p) => p.client?.trim()).filter(Boolean);
    return ['ALL', ...Array.from(new Set(clients))];
  }, [partNumbers]);

  // Filter list matching search and select tools
  const filteredParts = useMemo(() => {
    return calculatedParts.filter((item) => {
      const matchSearch =
        item.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchClient =
        filterClient === 'ALL' ||
        item.client.trim().toUpperCase() === filterClient.trim().toUpperCase();

      return matchSearch && matchClient;
    });
  }, [calculatedParts, searchTerm, filterClient]);

  // Sort list
  const sortedParts = useMemo(() => {
    const sorted = [...filteredParts];
    sorted.sort((a, b) => {
      // Put non-feasible parts always at the very bottom
      if (!a.isFeasible && b.isFeasible) return 1;
      if (a.isFeasible && !b.isFeasible) return -1;
      if (!a.isFeasible && !b.isFeasible) return 0;

      let valA = a[sortField as keyof typeof a];
      let valB = b[sortField as keyof typeof b];

      if (typeof valA === 'string' && typeof valB === 'string') {
        const comp = valA.localeCompare(valB);
        return sortDirection === 'asc' ? comp : -comp;
      } else {
        const numA = (valA as number) || 0;
        const numB = (valB as number) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
    });
    return sorted;
  }, [filteredParts, sortField, sortDirection]);

  // Financial Summary Cards statistics (using all active/feasible parts to be as accurate as possible, or single selected part)
  const stats = useMemo(() => {
    if (selectedPart) {
      if (!selectedPart.isFeasible) {
        return {
          totalVolume: selectedPart.weeklyVolume,
          totalRevenue: 0,
          totalBaseCost: 0,
          globalMarginPercent: 0,
          volumeImpact: 0,
          isSingle: true,
          partNumber: selectedPart.partNumber,
        };
      }
      const totalVolume = selectedPart.weeklyVolume;
      const totalRevenue = selectedPart.weeklyVolume * selectedPart.priceVentaFinal;
      const totalBaseCost = selectedPart.weeklyVolume * selectedPart.costoBase;
      const globalMarginPercent = selectedPart.margenBrutoPercent;
      const volumeImpact = totalRevenue - totalBaseCost;

      return {
        totalVolume,
        totalRevenue,
        totalBaseCost,
        globalMarginPercent,
        volumeImpact,
        isSingle: true,
        partNumber: selectedPart.partNumber,
      };
    }

    const activeFeasibleParts = calculatedParts.filter((p) => p.isFeasible && p.weeklyVolume > 0);

    const totalVolume = activeFeasibleParts.reduce((acc, curr) => acc + curr.weeklyVolume, 0);
    const totalRevenue = activeFeasibleParts.reduce((acc, curr) => acc + (curr.weeklyVolume * curr.priceVentaFinal), 0);
    const totalBaseCost = activeFeasibleParts.reduce((acc, curr) => acc + (curr.weeklyVolume * curr.costoBase), 0);
    const globalMarginPercent = totalRevenue > 0 ? ((totalRevenue - totalBaseCost) / totalRevenue) * 100 : 0;
    const volumeImpact = totalRevenue - totalBaseCost;

    return {
      totalVolume,
      totalRevenue,
      totalBaseCost,
      globalMarginPercent,
      volumeImpact,
      isSingle: false,
      partNumber: '',
    };
  }, [calculatedParts, selectedPart]);

  // Column Sort Handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Excel spreadsheet exporter
  const handleExportExcel = () => {
    if (sortedParts.length === 0) {
      Swal.fire({
        title: 'Sin datos',
        text: 'No hay registros en la tabla para exportar.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5',
      });
      return;
    }

    const rows = sortedParts.map((item) => {
      if (!item.isFeasible) {
        return {
          "Número de Parte": item.partNumber,
          "Cliente": item.client,
          "Descripción": item.description,
          "Volumen Semanal": item.weeklyVolume,
          "Factor Aplicado (%)": "No factible",
          "Precio Venta Final (USD/pza)": "No factible",
          "Costo Base (USD/pza)": "No factible",
          "Margen Bruto (USD/pza)": "No factible",
          "Margen Bruto (%)": "No factible",
          "Costo MO (USD/pza)": "No factible",
          "Costo SGA (USD/pza)": "No factible",
          "Profit (USD/pza)": "No factible",
        };
      }

      const factorMultiplier = getVolumeMultiplier(item.volumeCategory);

      return {
        "Número de Parte": item.partNumber,
        "Cliente": item.client,
        "Descripción": item.description,
        "Volumen Semanal": item.weeklyVolume,
        "Factor Aplicado (%)": `${factorMultiplier * 100}%`,
        "Precio Venta Final (USD/pza)": Number(item.priceVentaFinal.toFixed(4)),
        "Costo Base (USD/pza)": Number(item.costoBase.toFixed(4)),
        "Margen Bruto (USD/pza)": Number(item.margenBrutoUSD.toFixed(4)),
        "Margen Bruto (%)": `${item.margenBrutoPercent.toFixed(2)}%`,
        "Costo MO (USD/pza)": Number(item.costoMO.toFixed(4)),
        "Costo SGA (USD/pza)": Number(item.costoSGA.toFixed(4)),
        "Profit (USD/pza)": Number(item.profit.toFixed(4)),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Análisis Marginal');

    // Make widths look amazing
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 12 },
      { wch: 25 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];

    XLSX.writeFile(workbook, 'Analisis_Marginal_Metalwork.xlsx');

    Swal.fire({
      title: 'Excel Exportado',
      text: 'Se ha descargado el archivo Analisis_Marginal_Metalwork.xlsx con éxito.',
      icon: 'success',
      toast: true,
      position: 'top-end',
      timer: 3000,
      showConfirmButton: false,
    });
  };

  // Helper retrieve Category Factor visually representable label
  const getVolumeMultiplier = (category: VolumeCategory) => {
    switch (category) {
      case 'Alto': return volParams.altoPercentage / 100;
      case 'Medio': return volParams.medioPercentage / 100;
      case 'Bajo': return volParams.bajoPercentage / 100;
      case 'Factory': return volParams.factoryPercentage / 100;
      default: return 1.0;
    }
  };

  return (
    <div className="space-y-6" id="marginal-analysis-container">
      {/* Module Title Section */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600/35 p-2 rounded-lg border border-indigo-500/20">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Análisis Marginal de Precios y Costeo</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
            Evaluación comparativa de rentabilidad: Precio de Venta Final (con multiplicador por volumen) vs. Costo Base de producción (Costo Std). Desglose directo de MO, SGA y el impacto proyectado en las finanzas.
          </p>
        </div>
        <div>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 transition-colors text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer border border-emerald-500/30"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Financial KPIs Bento Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-3xs flex items-center justify-between">
          <div className="text-left space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              {stats.isSingle ? `Volumen: ${stats.partNumber}` : 'Volumen Semanal'}
            </span>
            <span className="font-mono text-xl font-extrabold text-slate-800 block">
              {stats.totalVolume.toLocaleString('en-US')} <span className="text-[11px] font-medium text-slate-400">pzas</span>
            </span>
            <span className="text-[9.5px] text-slate-400 block leading-tight">
              {stats.isSingle ? 'Volumen específico de pieza seleccionada' : 'Consolidado sobre cotizaciones factibles'}
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <Layers className="w-5 h-5 text-slate-500" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-3xs flex items-center justify-between">
          <div className="text-left space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              {stats.isSingle ? `Ingreso: ${stats.partNumber}` : 'Ingreso Semanal'}
            </span>
            <span className="font-mono text-xl font-extrabold text-indigo-950 block">
              ${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-medium text-slate-400">USD</span>
            </span>
            <span className="text-[9.5px] text-indigo-600 font-semibold block leading-tight">
              {stats.isSingle ? 'Venta de la pieza seleccionada' : 'Precio Venta Final'}
            </span>
          </div>
          <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
            <DollarSign className="w-5 h-5 text-indigo-600" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-3xs flex items-center justify-between">
          <div className="text-left space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              {stats.isSingle ? `Costo Base: ${stats.partNumber}` : 'Costo Base Semanal'}
            </span>
            <span className="font-mono text-xl font-extrabold text-slate-700 block">
              ${stats.totalBaseCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-medium text-slate-400">USD</span>
            </span>
            <span className="text-[9.5px] text-slate-400 block leading-tight">Costo estandar hora maquina</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <Layers className="w-5 h-5 text-slate-500" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-indigo-950 p-5 rounded-2xl shadow-3xs border border-indigo-900 flex items-center justify-between text-white">
          <div className="text-left space-y-1">
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-wider block">
              {stats.isSingle ? `Margen: ${stats.partNumber}` : 'Margen Bruto Global'}
            </span>
            <span className="font-mono text-xl font-extrabold text-emerald-400 block flex items-center gap-1.5 animate-pulse">
              {stats.globalMarginPercent.toFixed(2)}%
            </span>
            <span className="text-[9.5px] text-slate-300 block leading-tight">
              {stats.isSingle ? 'Margen bruto de pieza seleccionada' : 'Margen generado por volumen'}
            </span>
          </div>
          <div className="bg-indigo-900/55 p-3 rounded-xl border border-indigo-800">
            <Percent className="w-5 h-5 text-indigo-300" />
          </div>
        </div>
      </div>

      {/* Table search, client dropdowns, and records management */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-3xs overflow-hidden">
        {/* Top filter Controls bar */}
        <div className="p-4 border-b border-slate-150 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="w-4 h-4 text-slate-400" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar No. Parte o Descripción..."
                className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-4 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Client select filter */}
            <div className="w-full sm:w-48 text-left">
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              >
                {clientsList.map((client) => (
                  <option key={client} value={client}>
                    {client === 'ALL' ? 'Todos los Clientes' : `Cliente: ${client}`}
                  </option>
                ))}
              </select>
            </div>

            {selectedPartId && (
              <button
                onClick={() => setSelectedPartId(null)}
                className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all font-bold px-3 py-2 border border-indigo-200 rounded-xl flex items-center gap-1 cursor-pointer shrink-0 animate-pulse"
              >
                Limpiar Selección ({stats.partNumber}) ✕
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 font-bold shrink-0 flex items-center gap-2">
            Mostrando <span className="text-slate-700">{sortedParts.length}</span> registros
            <span className="text-[10px] text-slate-400 font-normal hidden lg:inline">
              (Haz clic en una fila para filtrar tarjetas superiores)
            </span>
          </div>
        </div>

        {/* Marginal Analysis Interactive Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-slate-700">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 select-none">
                {/* Column Headers with click-to-sort controls */}
                <th
                  onClick={() => handleSort('partNumber')}
                  className="py-3 px-4 uppercase tracking-wider font-extrabold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    No. Parte
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('client')}
                  className="py-3 px-3 uppercase tracking-wider font-extrabold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Cliente
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('weeklyVolume')}
                  className="py-3 px-3 text-center uppercase tracking-wider font-extrabold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    Vol. Semanal
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('factorApplied')}
                  className="py-3 px-3 text-center uppercase tracking-wider font-extrabold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    Factor (%)
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('priceVentaFinal')}
                  className="py-3 px-3 text-right uppercase tracking-wider font-extrabold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors bg-indigo-50/20 text-indigo-950"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    Precio Venta Final
                    <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('costoBase')}
                  className="py-3 px-3 text-right uppercase tracking-wider font-extrabold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    Costo Estandar
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('margenBrutoUSD')}
                  className="py-3 px-3 text-right uppercase tracking-wider font-extrabold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors bg-slate-50/50"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    Margen USD
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('margenBrutoPercent')}
                  className="py-3 px-3 text-center uppercase tracking-wider font-extrabold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors bg-slate-100/50"
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    Margen %
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('costoMO')}
                  className="py-3 px-3 text-right uppercase tracking-wider font-extrabold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors text-slate-500"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    Costo MO
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('costoSGA')}
                  className="py-3 px-3 text-right uppercase tracking-wider font-extrabold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors text-slate-500"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    Costo SGA
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('profit')}
                  className="py-3 px-4 text-right uppercase tracking-wider font-extrabold cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors text-slate-500"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    Profit Incl.
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center uppercase tracking-wider font-extrabold text-slate-500">
                  Detalle
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sortedParts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400 font-medium font-sans">
                    No se encontraron números de parte para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                sortedParts.map((item) => {
                  const factorMultiplier = getVolumeMultiplier(item.volumeCategory);
                  const isRedMargin = item.isFeasible && item.margenBrutoPercent < 15;
                  
                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        setSelectedPartId(prevId => prevId === item.id ? null : item.id);
                      }}
                      className={`cursor-pointer transition-all border-l-4 ${
                        selectedPartId === item.id
                          ? 'bg-indigo-50/90 font-semibold border-l-indigo-600 hover:bg-indigo-100/50'
                          : 'odd:bg-white even:bg-slate-50/30 hover:bg-indigo-50/20 border-l-transparent'
                      }`}
                    >
                      {/* Part Number */}
                      <td className="py-2.5 px-4 text-left font-bold text-slate-900">
                        {item.partNumber}
                        <span className="block text-[10px] font-medium text-slate-400 leading-snug font-sans">
                          {item.description}
                        </span>
                      </td>

                      {/* Client */}
                      <td className="py-2.5 px-3 font-semibold text-slate-600">
                        <span className="bg-slate-100 border border-slate-200/55 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-slate-600">
                          {item.client}
                        </span>
                      </td>

                      {/* Weekly Volume */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                        {item.isFeasible ? (
                          item.weeklyVolume.toLocaleString('en-US')
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Applied Factor */}
                      <td className="py-2.5 px-3 text-center font-bold">
                        {item.isFeasible ? (
                          <div className="inline-flex flex-col items-center leading-none">
                            <span className="text-indigo-600 text-xs font-extrabold">
                              {(factorMultiplier * 100).toFixed(0)}%
                            </span>
                            <span className="text-[8px] text-slate-400 uppercase tracking-widest mt-0.5 font-bold">
                              {item.volumeCategory}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Final Selling Price */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-950 bg-indigo-50/5">
                        {item.isFeasible ? (
                          `$${item.priceVentaFinal.toFixed(4)}`
                        ) : (
                          <span className="px-2 py-1 text-[9px] bg-red-50 text-red-700 border border-red-100 rounded-sm font-black uppercase inline-block">
                            No Factible
                          </span>
                        )}
                      </td>

                      {/* Base Cost */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {item.isFeasible ? (
                          `$${item.costoBase.toFixed(4)}`
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Margin USD */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 bg-slate-50/30">
                        {item.isFeasible ? (
                          <span className={item.margenBrutoUSD < 0 ? 'text-red-700' : 'text-slate-900'}>
                            ${item.margenBrutoUSD.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Margin % */}
                      <td className="py-2.5 px-3 text-center bg-slate-100/10">
                        {item.isFeasible ? (
                          <span
                            className={`px-2.5 py-1 text-xs font-black rounded-lg ${
                              item.margenBrutoPercent <= 0
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : isRedMargin
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {item.margenBrutoPercent.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Costo MO */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500 text-[11px]">
                        {item.isFeasible ? (
                          `$${item.costoMO.toFixed(4)}`
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Costo SGA */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500 text-[11px]">
                        {item.isFeasible ? (
                          `$${item.costoSGA.toFixed(4)}`
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Profit */}
                      <td className="py-2.5 px-4 text-right font-mono text-slate-500 text-[11px]">
                        {item.isFeasible ? (
                          `$${item.profit.toFixed(4)}`
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Detail Action Column */}
                      <td className="py-2.5 px-4 text-center">
                        {item.isFeasible ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              // Prevent triggering row selection
                              e.stopPropagation();
                              const originalPart = partNumbers.find((p) => p.id === item.id) || null;
                              setSelectedPartForStandardCost(originalPart);
                              setIsStandardCostModalOpen(true);
                            }}
                            className="bg-indigo-50 hover:bg-slate-100 active:bg-indigo-150 text-indigo-600 hover:text-indigo-800 p-1.5 rounded-lg border border-indigo-150 transition-all cursor-pointer inline-flex items-center justify-center"
                            title="Ver desglose del Costo Estándar"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info explaining equations */}
        <div className="bg-slate-50 p-4 border-t border-slate-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="leading-tight">
              <strong>Costo Estandar:</strong> precio por pieza sin multiplicador de volumen.
            </span>
          </div>

          <div className="text-[10px] text-slate-400 font-bold shrink-0 bg-white border border-slate-200 rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-3xs">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Consumo Alerta: Margen &lt; 15%</span>
          </div>
        </div>
      </div>

      {/* Standard Cost Detailed Breakdown Modal */}
      <StandardCostBreakdownModal
        part={selectedPartForStandardCost}
        isOpen={isStandardCostModalOpen}
        onClose={() => {
          setIsStandardCostModalOpen(false);
          setSelectedPartForStandardCost(null);
        }}
        machines={machines}
        genParams={genParams}
        volParams={volParams}
      />
    </div>
  );
};

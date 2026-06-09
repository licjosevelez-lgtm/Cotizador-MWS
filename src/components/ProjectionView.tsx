import React, { useState, useMemo } from 'react';
import { PartNumber, Machine, VolumeParameters, GeneralParameters, calculatePartQuotation } from '../types';
import { Search, RotateCw, FileSpreadsheet, Percent, AlertCircle, TrendingDown, TrendingUp, HelpCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

interface ProjectionViewProps {
  partNumbers: PartNumber[];
  machines: Machine[];
  volParams: VolumeParameters;
  genParams: GeneralParameters;
  onUpdatePartNumbers: (newParts: PartNumber[]) => void;
}

export const ProjectionView: React.FC<ProjectionViewProps> = ({
  partNumbers,
  machines,
  volParams,
  genParams,
  onUpdatePartNumbers,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('ALL');
  const [forceTrigger, setForceTrigger] = useState(0);

  // Get list of clients for the filter dropdown
  const clientsList = useMemo(() => {
    const clients = partNumbers.map((p) => p.client?.trim()).filter(Boolean);
    return ['ALL', ...Array.from(new Set(clients))];
  }, [partNumbers]);

  // Handle target price modifications instantly
  const handleTargetChange = (partId: string, value: string) => {
    const numericValue = value === '' ? undefined : parseFloat(value);
    
    const updatedParts = partNumbers.map((part) => {
      if (part.id === partId) {
        return {
          ...part,
          targetPrice: numericValue !== undefined && !isNaN(numericValue) ? numericValue : undefined,
        };
      }
      return part;
    });

    onUpdatePartNumbers(updatedParts);
  };

  // Perform full calculations for each part and scenario reactively
  const tableData = useMemo(() => {
    return partNumbers.map((part) => {
      // Clones with custom volume category to run the exact system algebra
      const partBajo = { ...part, volumeCategory: 'Bajo' as const };
      const partMedio = { ...part, volumeCategory: 'Medio' as const };
      const partAlto = { ...part, volumeCategory: 'Alto' as const };
      const partFactory = { ...part, volumeCategory: 'Factory' as const };

      const resBajo = calculatePartQuotation(partBajo, machines, volParams, genParams);
      const resMedio = calculatePartQuotation(partMedio, machines, volParams, genParams);
      const resAlto = calculatePartQuotation(partAlto, machines, volParams, genParams);
      const resFactory = calculatePartQuotation(partFactory, machines, volParams, genParams);

      return {
        part,
        priceBajo: part.isFeasible !== false ? resBajo.exWorksCost : null,
        priceMedio: part.isFeasible !== false ? resMedio.exWorksCost : null,
        priceAlto: part.isFeasible !== false ? resAlto.exWorksCost : null,
        priceFactory: part.isFeasible !== false ? resFactory.exWorksCost : null,
      };
    });
  }, [partNumbers, machines, volParams, genParams, forceTrigger]);

  // Filtered rows matching user search and select controls
  const filteredData = useMemo(() => {
    return tableData.filter(({ part }) => {
      const matchSearch =
        part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchClient =
        filterClient === 'ALL' ||
        part.client?.trim().toUpperCase() === filterClient.trim().toUpperCase();

      return matchSearch && matchClient;
    });
  }, [tableData, searchTerm, filterClient]);

  // Manual recalculation force feedback to user
  const handleManualRefresh = () => {
    setForceTrigger((prev) => prev + 1);
    Swal.fire({
      title: 'Precios actualizados',
      text: 'Se han recalculado en tiempo real todos los escenarios con los coeficientes globales activos.',
      icon: 'success',
      toast: true,
      position: 'top-end',
      timer: 2000,
      showConfirmButton: false,
    });
  };

  // Export full table matrix into Excel XLSX format
  const handleExportMatrixExcel = () => {
    if (filteredData.length === 0) {
      Swal.fire({
        title: 'Sin datos',
        text: 'No hay filas en la matriz para exportar.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const rows = filteredData.map(({ part, priceBajo, priceMedio, priceAlto, priceFactory }) => {
      const deltaText = part.targetPrice && priceAlto
        ? `${(((priceAlto - part.targetPrice) / part.targetPrice) * 100).toFixed(1)}%`
        : 'N/A';

      return {
        "Número de Parte": part.partNumber,
        "Cliente": part.client,
        "Descripción": part.description,
        "Precio Bajo Vol (Bajo)": priceBajo ? Number(priceBajo.toFixed(2)) : "N/A",
        "Precio Medio Vol (Medio)": priceMedio ? Number(priceMedio.toFixed(2)) : "N/A",
        "Precio Alto Vol (Alto)": priceAlto ? Number(priceAlto.toFixed(2)) : "N/A",
        "Precio Assist (Factory)": priceFactory ? Number(priceFactory.toFixed(2)) : "N/A",
        "Target Real": part.targetPrice ? Number(part.targetPrice.toFixed(2)) : "",
        "Delta vs Target (Alto Vol)": deltaText
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Matriz de Proyección");

    // Adjust column widths beautifully
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 12 },
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 24 }
    ];

    XLSX.writeFile(workbook, "Matriz_Precios_y_Target.xlsx");

    Swal.fire({
      title: 'Exportación completada',
      text: 'Se ha descargado la matriz de precios y target como archivo excel.',
      icon: 'success',
      confirmButtonColor: '#4f46e5'
    });
  };

  return (
    <div className="space-y-6" id="projection-matrix-module">
      {/* Upper header action bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Proyección de Escenarios (Matriz de Precios)</h2>
          <p className="text-xs text-gray-500">
            Compara simultáneamente los 4 precios ExWorks por pieza para cada volumen (Bajo, Medio, Alto, Factory) y contrástalos con el target.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <button
            id="refresh-matrix-btn"
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-2 px-4 rounded-lg border border-slate-200 shadow-xs transition-colors cursor-pointer"
            title="Sincronizar y recalcular algebra de precios"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Refrescar Precios
          </button>
          <button
            id="export-matrix-btn"
            onClick={handleExportMatrixExcel}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4.5 rounded-lg shadow-sm transition-colors cursor-pointer"
            title="Exportar matriz completa como documento Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Dynamic Search & Client Filtering control block */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            id="matrix-search"
            type="text"
            placeholder="Anotar No. Parte / Descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-400 rounded-lg text-xs leading-5 focus:outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        <div>
          <select
            id="matrix-client-filter"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-400 p-1.5 rounded-lg text-xs outline-none transition-all cursor-pointer text-slate-700 font-medium"
          >
            <option value="ALL">Todos los Clientes (Filtrar)</option>
            {clientsList.filter(c => c !== 'ALL').map((client) => (
              <option key={client} value={client}>
                Cliente: {client}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-slate-50 flex items-center px-3.5 py-1.5 rounded-lg border border-slate-100/50 text-[11px] text-slate-500 font-medium gap-1.5">
          <AlertCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span>Fórmulas y recargos globales aplicados en tiempo real.</span>
        </div>
      </div>

      {/* High precision table rendering section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-medium text-xs space-y-2">
            <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <p>No se encontraron números de parte cargados o coincidentes.</p>
            <p className="text-[10px] text-slate-400">Prueba importando un Excel o añadiendo elementos desde la pestaña "Modelar Números de Parte".</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table id="matrix-table" className="w-full border-collapse text-left text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50/70 border-b border-gray-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 font-extrabold w-[14%]">No. Parte</th>
                  <th className="py-3 px-3 font-extrabold w-[10%]">Cliente</th>
                  <th className="py-3 px-3 font-extrabold w-[20%]">Descripción</th>
                  <th className="py-3 px-2 font-extrabold text-center bg-red-50/20 text-red-700 w-[11%]">Bajo Vol (Bajo)</th>
                  <th className="py-3 px-2 font-extrabold text-center bg-amber-50/20 text-amber-700 w-[11%]">Medio Vol (Medio)</th>
                  <th className="py-3 px-2 font-extrabold text-center bg-green-50/20 text-green-700 w-[11%]">Alto Vol (Alto)</th>
                  <th className="py-3 px-2 font-extrabold text-center bg-indigo-50/20 text-indigo-700 w-[11%]">Assist (Factory)</th>
                  <th className="py-3 px-4 font-extrabold text-center bg-slate-100/50 text-slate-800 w-[12%]">Target ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredData.map(({ part, priceBajo, priceMedio, priceAlto, priceFactory }) => {
                  // Business delta comparison matching
                  const target = part.targetPrice;
                  let deltaNode = null;
                  
                  if (target && priceAlto !== null) {
                    const diffPercent = ((priceAlto - target) / target) * 100;
                    const isExceeding = diffPercent > 0;
                    
                    deltaNode = (
                      <div className={`flex items-center justify-center gap-1 font-mono text-[9px] mt-1.5 px-1.5 py-0.5 rounded-full font-bold ${
                        isExceeding
                          ? 'bg-red-50 text-red-600 border border-red-100'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>
                        {isExceeding ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{isExceeding ? '+' : ''}{diffPercent.toFixed(1)}%</span>
                      </div>
                    );
                  }

                  return (
                    <tr key={part.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-sans tracking-tight">{part.partNumber}</td>
                      <td className="py-3.5 px-3">
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide border border-slate-200/40">
                          {part.client}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 truncate max-w-[180px] text-slate-500" title={part.description}>
                        {part.description || 'N/A'}
                      </td>
                      
                      {/* Bajo Volume Price Row */}
                      <td className="py-3.5 px-2 text-center bg-red-50/10 font-mono font-bold text-slate-800">
                        {priceBajo !== null ? `$${priceBajo.toFixed(2)}` : <span className="text-red-500 font-sans text-[10px] uppercase font-bold">No Fac.</span>}
                      </td>

                      {/* Medio Volume Price Row */}
                      <td className="py-3.5 px-2 text-center bg-amber-50/10 font-mono font-bold text-slate-800">
                        {priceMedio !== null ? `$${priceMedio.toFixed(2)}` : <span className="text-red-500 font-sans text-[10px] uppercase font-bold">No Fac.</span>}
                      </td>

                      {/* Alto Volume Price Row */}
                      <td className="py-3.5 px-2 text-center bg-green-50/10 font-mono font-bold text-indigo-900 text-xs shadow-inner">
                        {priceAlto !== null ? `$${priceAlto.toFixed(2)}` : <span className="text-red-500 font-sans text-[10px] uppercase font-bold">No Fac.</span>}
                      </td>

                      {/* Factory Volume Price Row */}
                      <td className="py-3.5 px-2 text-center bg-indigo-50/10 font-mono font-bold text-slate-800">
                        {priceFactory !== null ? `$${priceFactory.toFixed(2)}` : <span className="text-red-500 font-sans text-[10px] uppercase font-bold">No Fac.</span>}
                      </td>

                      {/* Manual target price entry field with realtime delta comparison */}
                      <td className="py-2 px-4 bg-slate-50/55 align-middle">
                        <div className="flex flex-col items-center">
                          <div className="relative w-full min-w-[70px]">
                            <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-400 font-mono text-[11px] pointer-events-none">$</span>
                            <input
                              id={`target-input-${part.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={part.targetPrice !== undefined ? part.targetPrice : ''}
                              onChange={(e) => handleTargetChange(part.id, e.target.value)}
                              className="w-full pl-5 pr-1.5 py-1 text-center bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 rounded font-mono font-bold text-xs outline-none transition-all text-slate-800 placeholder:text-slate-300"
                            />
                          </div>
                          {deltaNode}
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

      {/* Analytical Footnote Legend Block */}
      {filteredData.length > 0 && (
        <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 text-[10.5px] text-slate-500 font-medium leading-relaxed flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-slate-700 font-bold block">Leyenda de la Matriz de Precios:</span>
            <ul className="list-disc pl-4 space-y-1">
              <li>Los precios de los cuatro escenarios representan el <span className="text-indigo-800 font-bold">Costo Unitario ExWorks calculado</span> con base a las tarifas de máquinas actuales y multiplicadores globales correspondientes para cada uno de los volúmenes.</li>
              <li>La columna <span className="font-bold text-slate-700">Target ($)</span> permite ingresar manualmente el precio objetivo real o deseado para cada producto.</li>
              <li>Los deltas de color con flechas muestran el <span className="text-slate-700 font-semibold">desvío (%) entre el "Precio Alto" (la tarifa de referencia más competitiva) y el Target</span>. Un valor verde indica que el precio cotizado es inferior o igual al target (óptimo). Un valor rojo indica que supera el target.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

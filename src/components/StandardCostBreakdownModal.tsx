import React from 'react';
import { X, Cpu, Calculator, Info, ShieldCheck, DollarSign, Settings, Layers, Calendar, User } from 'lucide-react';
import { PartNumber, Machine, GeneralParameters, VolumeParameters, calculatePartQuotation, StepCalculationResult } from '../types';

interface StandardCostBreakdownModalProps {
  part: PartNumber | null;
  isOpen: boolean;
  onClose: () => void;
  machines: Machine[];
  genParams: GeneralParameters;
  volParams: VolumeParameters;
}

// Auxiliary function to calculate Standard Cost (forcing volumeMultiplier = 1.0)
export function calculateStandardCost(
  part: PartNumber,
  machines: Machine[],
  genParams: GeneralParameters
) {
  const baseVolParams: VolumeParameters = {
    altoPercentage: 100,
    medioPercentage: 100,
    bajoPercentage: 100,
    factoryPercentage: 100,
  };
  return calculatePartQuotation(part, machines, baseVolParams, genParams);
}

export const StandardCostBreakdownModal: React.FC<StandardCostBreakdownModalProps> = ({
  part,
  isOpen,
  onClose,
  machines,
  genParams,
  volParams,
}) => {
  if (!isOpen || !part) return null;

  // Run the standard cost calculation (factor = 1.0)
  const result = calculateStandardCost(part, machines, genParams);

  // Helper to obtain a machine name from catalog
  const getMachineName = (machineId: string) => {
    if (machineId === 'none' || machineId === 'manual') return 'Operación Manual';
    const m = machines.find((item) => item.id === machineId);
    return m ? m.name : 'Desconocida';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans overflow-y-auto" id="standard-cost-modal">
      {/* Backdrop click listener */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-xl flex flex-col border border-slate-100 z-10 overflow-hidden my-8 animate-fade-in text-slate-800">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="space-y-1 text-left">
            <span className="bg-indigo-600 text-[10px] font-black px-2.5 py-0.5 rounded tracking-wider uppercase">
              DESGLOSE DE COSTO ESTÁNDAR (F=1.0x)
            </span>
            <div className="flex items-center gap-2 mt-1">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold tracking-tight">
                Parte: <span className="font-mono text-indigo-300 font-extrabold">{part.partNumber}</span>
                {part.client && <span className="text-slate-400 font-medium text-xs ml-2">({part.client})</span>}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors cursor-pointer"
            title="Cerrar Desglose"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Box */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-16rem)]">
          
          {/* General Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80 flex items-start gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 mt-0.5">
                <User className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Cliente / Descripción</span>
                <span className="text-xs font-extrabold text-slate-800 block truncate max-w-[180px]">{part.client || 'N/A'}</span>
                <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">{part.description || 'Sin descripción'}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80 flex items-start gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 mt-0.5">
                <Layers className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Volumen Semanal</span>
                <span className="text-xs font-black text-indigo-700 font-mono block">
                  {part.weeklyVolume ? `${part.weeklyVolume.toLocaleString('en-US')} pzas` : 'N/A'}
                </span>
                <span className="text-[9px] text-slate-400 block">Categoría: {part.volumeCategory}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80 flex items-start gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 mt-0.5">
                <Calculator className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Tarifa base MO</span>
                <span className="text-xs font-bold text-emerald-800 font-mono block">
                  ${genParams.operatorHourlyCost.toFixed(2)} USD/h
                </span>
                <span className="text-[9px] text-slate-400 block">Por operador directo</span>
              </div>
            </div>
          </div>

          {/* Steps Breakdown Table */}
          <div className="space-y-2.5 text-left">
            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              Detalle de Ruta de Procesamiento y Costeo Unitario Estándar
            </h4>
            
            <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white shadow-3xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 text-center">
                    <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-left">Paso</th>
                    <th className="py-2.5 px-2 font-bold uppercase tracking-wider">Máquina</th>
                    <th className="py-2.5 px-2 font-bold uppercase tracking-wider">Tarifa Máq/h</th>
                    <th className="py-2.5 px-2 font-semibold uppercase tracking-wider">Rendimiento (pza/h)</th>
                    <th className="py-2.5 px-2 font-semibold uppercase tracking-wider">Ciclo (min/pza)</th>
                    <th className="py-2.5 px-2 font-semibold uppercase tracking-wider">Operadores</th>
                    <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider bg-slate-100/30 text-slate-700">Máquina (pza)</th>
                    <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider bg-indigo-50/50 text-indigo-950">Mano de Obra (pza)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150/70 font-semibold text-center text-xs">
                  {result.steps.map((s, idx) => {
                    return (
                      <tr key={s.step.id || idx} className="hover:bg-slate-50/70">
                        {/* Step Name & sequence */}
                        <td className="py-2.5 px-3 font-bold text-slate-800 text-left">
                          <span className="text-[11px] text-slate-400 font-mono mr-1">#{s.step.sequence}</span>
                          {s.step.stepName}
                        </td>
                        {/* Machine name */}
                        <td className="py-2.5 px-2 font-medium text-slate-600 text-left max-w-[120px] truncate" title={getMachineName(s.step.machineId)}>
                          {getMachineName(s.step.machineId)}
                        </td>
                        {/* Rate */}
                        <td className="py-2.5 px-2 font-mono text-slate-600">
                          {s.machineBaseCost > 0 ? `$${s.machineBaseCost.toFixed(2)}` : '-'}
                        </td>
                        {/* Output */}
                        <td className="py-2.5 px-2 font-mono text-slate-600">
                          {s.step.outputPerHour.toLocaleString('en-US')}
                        </td>
                        {/* Cycle time */}
                        <td className="py-2.5 px-2 font-mono text-slate-600">
                          {s.cycleTimeMin.toFixed(4)} min
                        </td>
                        {/* Operators */}
                        <td className="py-2.5 px-2 font-sans text-slate-600">
                          {s.step.operatorsCount} Op{s.step.operatorsCount !== 1 ? 's' : ''}
                        </td>
                        {/* Machine cost per piece */}
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 bg-slate-50/20">
                          ${s.machineCostPerPiece.toFixed(4)}
                        </td>
                        {/* Labor cost per piece */}
                        <td className="py-2.5 px-3 font-mono font-extrabold bg-indigo-50/20 text-indigo-900">
                          ${s.laborCostPerPiece.toFixed(4)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Consolidates */}
                  <tr className="bg-slate-100/50 font-bold border-t border-slate-200">
                    <td colSpan={6} className="py-2.5 px-3 text-slate-700 font-extrabold text-left uppercase text-[10px] tracking-wider">
                      Subtotales directos de manufactura
                    </td>
                    <td className="py-2.5 px-3 font-mono font-extrabold text-slate-900 bg-slate-50">
                      ${result.machineCostTotal.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-black text-indigo-950 bg-indigo-50/40">
                      ${result.directLaborTotal.toFixed(4)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Math Equations & Exact Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-left">
            
            {/* Equation Explanatory Panel */}
            <div className="md:col-span-5 space-y-3">
              <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-[11px] text-slate-600 space-y-3 leading-relaxed">
                <p className="font-extrabold text-[#111827] uppercase tracking-wider text-[10px]">
                  Fórmulas de Costeo Unitario:
                </p>
                <div className="space-y-1.5 font-mono text-[9px] leading-snug">
                  <div>
                    <span className="text-slate-800 font-bold">1. Subtotal Directo</span>
                    <p className="pl-2 text-slate-400">Sumatoria(Máquina + Mano de Obra)</p>
                  </div>
                  <div>
                    <span className="text-slate-800 font-bold">2. Mfg Burden</span>
                    <p className="pl-2 text-slate-400">Subtotal Directo × {genParams.manufacturingBurdenPercentage}%</p>
                  </div>
                  <div>
                    <span className="text-slate-800 font-bold">3. Mfg Subtotal</span>
                    <p className="pl-2 text-slate-400">Sumatoria(Subtotal Directo + Burden + Materia Prima + Componentes)</p>
                  </div>
                  <div>
                    <span className="text-slate-800 font-bold">4. Gastos SGA</span>
                    <p className="pl-2 text-slate-400">G&amp;A ({genParams.generalAdminPercentage}%) y Ventas ({genParams.salesPercentage}%) aplicados sobre el Mfg Subtotal.</p>
                  </div>
                  <div>
                    <span className="text-slate-800 font-bold">5. Utilidad (Profit)</span>
                    <p className="pl-2 text-slate-400">(Mfg Subtotal + Gastos G&amp;A) × Profit ({genParams.profitPercentage}%)</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-400">
                  * Este desglose es el costo estándar de la pieza utilizando un factor libre de cargo (volumen multiplicador = 1.0).
                </div>
              </div>
            </div>

            {/* Exact Cost Build-up Panel */}
            <div className="md:col-span-7 space-y-3">
              <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                Desglose Financiero del Costo Estándar
              </h5>

              <div className="space-y-2 text-xs divide-y divide-slate-100 bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs p-4">
                
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500 font-medium">Suma Directa Máquina (unitario):</span>
                  <span className="font-mono text-slate-800 font-semibold">${result.machineCostTotal.toFixed(4)}</span>
                </div>

                <div className="flex justify-between items-center py-1.5 col-span-2">
                  <span className="text-slate-500 font-medium">Suma Mano de Obra Directa (unitario):</span>
                  <span className="font-mono text-slate-800 font-semibold">${result.directLaborTotal.toFixed(4)}</span>
                </div>

                <div className="flex justify-between items-center py-1.5 font-bold text-slate-700">
                  <span>Costo Raw Consolidado (Directo):</span>
                  <span className="font-mono">${result.sumLaborMachine.toFixed(4)}</span>
                </div>

                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500">
                    Manufacturing Burden ({genParams.manufacturingBurdenPercentage}%):
                  </span>
                  <span className="font-mono text-indigo-600 font-semibold">+${result.manufacturingBurden.toFixed(4)}</span>
                </div>

                {part.rawMaterial > 0 && (
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500">Materia Prima Directa:</span>
                    <span className="font-mono text-slate-600">+${part.rawMaterial.toFixed(4)}</span>
                  </div>
                )}

                {part.purchasedComponents > 0 && (
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500">Componentes Comprados:</span>
                    <span className="font-mono text-slate-600">+${part.purchasedComponents.toFixed(4)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1.5 font-bold text-slate-800 bg-slate-50/50 -mx-4 px-4">
                  <span>Subtotal Puro Manufactura (Mfg Subtotal):</span>
                  <span className="font-mono">${result.manufacturingSubtotal.toFixed(4)}</span>
                </div>

                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500">
                    Gastos de Administración G&amp;A ({genParams.generalAdminPercentage}%):
                  </span>
                  <span className="font-mono text-indigo-600 font-semibold">+${result.generalAdmin.toFixed(4)}</span>
                </div>

                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500">
                    Comisión de Ventas ({genParams.salesPercentage}%):
                  </span>
                  <span className="font-mono text-indigo-600 font-semibold">+${result.sales.toFixed(4)}</span>
                </div>

                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500">
                    Margen de Utilidad corporativa ({genParams.profitPercentage}%):
                  </span>
                  <span className="font-mono text-indigo-600 font-semibold">+${result.profit.toFixed(4)}</span>
                </div>

                <div className="flex justify-between items-center py-2.5 font-black text-indigo-950 text-xs bg-indigo-50/40 -mx-4 px-4 rounded-b-xl border-t border-indigo-100">
                  <span className="uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Costo Estándar final (USD/pza):
                  </span>
                  <span className="font-mono text-base font-extrabold">${result.exWorksCost.toFixed(4)}</span>
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-all outline-none cursor-pointer"
          >
            Cerrar Desglose
          </button>
        </div>
      </div>
    </div>
  );
};

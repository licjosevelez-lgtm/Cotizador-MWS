import React from 'react';
import { X, Calendar, User, FileText, Cpu, Calculator, Info, Clock, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { Machine } from '../types';
import { MachineRentalQuote, calculateRentalBreakdown } from './MachineRental';

interface RentalQuoteDetailModalProps {
  quote: MachineRentalQuote | null;
  isOpen: boolean;
  onClose: () => void;
  machinesCatalog: Machine[];
}

export const RentalQuoteDetailModal: React.FC<RentalQuoteDetailModalProps> = ({
  quote,
  isOpen,
  onClose,
  machinesCatalog
}) => {
  if (!isOpen || !quote) return null;

  // Re-map or fallback machines
  const quoteMachines = quote.machines && quote.machines.length > 0 
    ? quote.machines 
    : [
        {
          machineId: quote.machineId || '',
          machineName: quote.machineName || 'N/A',
          baseCost: 0,
          factor: quote.factor || 2.0,
          personalCount: quote.operatorsCount !== undefined ? quote.operatorsCount : 1
        }
      ];

  const genParamsMock = {
    manufacturingBurdenPercentage: quote.manufacturingBurdenPercentage !== undefined ? quote.manufacturingBurdenPercentage : 3.5,
    generalAdminPercentage: quote.generalAdminPercentage !== undefined ? quote.generalAdminPercentage : 3.0,
    salesPercentage: quote.salesPercentage !== undefined ? quote.salesPercentage : 3.0
  } as any;

  const result = calculateRentalBreakdown(
    quoteMachines,
    quote.operatorHourlyCost,
    quote.profitPercentage,
    quote.hoursToRent,
    genParamsMock,
    machinesCatalog
  );

  const breakdownList = result.machineBreakdowns;
  const sumBaseCostHourly = result.sumBaseCostHourly;
  const sumMachinePart = result.sumMachinePart;
  const sumLaborPart = result.sumLaborPart;
  const sumSubtotalRaw = result.sumSubtotalRaw;
  const sumBurdenAmount = result.sumBurdenAmount;
  const sumGaAmount = result.sumGaAmount;
  const sumSalesAmount = result.sumSalesAmount;
  const sumProfitAmount = result.sumProfitAmount;
  const sumSgaProfitPerHour = result.sumSgaProfitPerHour;
  const sumPricePerHour = result.pricePerHourTotal;
  const sumTotalForHours = result.total;

  const burdenDec = result.burdenDec;
  const gaDec = result.gaDec;
  const salesDec = result.salesDec;
  const profitDec = result.profitDec;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans overflow-y-auto">
      {/* Backdrop click listener */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col border border-slate-100 z-10 overflow-hidden my-8 animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="space-y-1 text-left">
            <span className="bg-indigo-600 text-[10px] font-extrabold px-2.5 py-0.5 rounded tracking-wider uppercase">
              REPORTE DETALLADO DE RENTA
            </span>
            <div className="flex items-center gap-2 mt-1">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold tracking-tight">
                Cotización: <span className="font-mono text-indigo-300 font-extrabold">{quote.quotationNumber || 'SIN NÚMERO'}</span>
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors cursor-pointer"
            title="Cerrar Detalle"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Box */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-16rem)]">
          {/* Properties summary card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80 flex items-start gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 mt-0.5">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Cliente</span>
                <span className="text-sm font-extrabold text-slate-800">{quote.client}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80 flex items-start gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 mt-0.5">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Fecha de Creación</span>
                <span className="text-sm font-semibold text-slate-800">{quote.fecha}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80 flex items-start gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Tiempo de Renta contratado</span>
                <span className="text-sm font-black text-indigo-700 font-mono">{quote.hoursToRent} Horas</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80 flex items-start gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 mt-0.5">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Mano de Obra por Operador</span>
                <span className="text-sm font-bold text-emerald-800 font-mono">${quote.operatorHourlyCost.toFixed(2)} USD/h</span>
              </div>
            </div>
          </div>

          {/* Table Breakdown of rental machines */}
          <div className="space-y-2.5 text-left">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              Desglose Detallado de Renta y Tarifas por Hora (Base y Subtotales)
            </h4>
            <div className="overflow-x-auto border border-slate-150 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 font-bold border-b border-slate-150 text-center">
                    <th className="py-2.5 px-4 font-bold uppercase tracking-wider text-left">Máquina / Prensa</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Costo Máq/h</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Costo MO/h (Op)</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Personal</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Horas</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Subtotal Máq</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Subtotal MO</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Costo Total Base</th>
                    <th className="py-2.5 px-4 font-bold uppercase tracking-wider bg-indigo-50/80 text-indigo-900 font-black">Costo Base / Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-center text-xs">
                  {breakdownList.map((m, index) => {
                    const subtotalMaq = m.machinePart * quote.hoursToRent;
                    const subtotalMO = (quote.operatorHourlyCost * m.personalCount) * quote.hoursToRent;
                    const costoTotalBase = subtotalMaq + subtotalMO;
                    return (
                      <tr key={index} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-bold text-slate-800 text-left">{m.machineName}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">${m.machinePart.toFixed(2)}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">${quote.operatorHourlyCost.toFixed(2)}</td>
                        <td className="py-3 px-3 font-sans text-slate-600">{m.personalCount} Op{m.personalCount !== 1 ? 's' : ''}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{quote.hoursToRent} h</td>
                        <td className="py-3 px-3 font-mono text-slate-600">${subtotalMaq.toFixed(2)}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">${subtotalMO.toFixed(2)}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">${costoTotalBase.toFixed(2)}</td>
                        <td className="py-3 px-4 font-mono font-black bg-indigo-50/40 text-indigo-900">${m.subtotalRaw.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  {breakdownList.length > 1 && (() => {
                    const sumSubtotalMaq = sumMachinePart * quote.hoursToRent;
                    const sumSubtotalMO = sumLaborPart * quote.hoursToRent;
                    const sumCostoTotalBase = sumSubtotalMaq + sumSubtotalMO;
                    return (
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                        <td className="py-3 px-4 text-slate-700 font-black text-left uppercase">Totales consolidados</td>
                        <td className="py-3 px-3 font-mono text-slate-600">${sumMachinePart.toFixed(2)}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">${quote.operatorHourlyCost.toFixed(2)}</td>
                        <td className="py-3 px-3 font-sans text-slate-600">{result.totalPersonal} Ops</td>
                        <td className="py-3 px-3 font-mono text-slate-600">-</td>
                        <td className="py-3 px-3 font-mono text-slate-600">${sumSubtotalMaq.toFixed(2)}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">${sumSubtotalMO.toFixed(2)}</td>
                        <td className="py-3 px-3 font-mono font-extrabold text-slate-900">${sumCostoTotalBase.toFixed(2)}</td>
                        <td className="py-3 px-4 font-mono font-black text-indigo-950 bg-indigo-100/30">${sumSubtotalRaw.toFixed(2)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overheads and Parameters Breakdown Card */}
          <div className="space-y-3.5 text-left">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Porcentajes de SGA, Finanzas y Profit Margin Aplicados (Desglose Adicional)
            </h4>
            
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Formula explanation */}
              <div className="space-y-3 text-xs text-slate-600">
                <p className="font-extrabold text-[#111827] uppercase tracking-wider text-[10px]">
                  Fórmula Matemática para la facturación de renta por hora:
                </p>
                <div className="bg-white p-3 rounded-xl border border-slate-100 font-mono text-[10px] space-y-1.5 leading-relaxed shadow-3xs">
                  <p className="text-indigo-950 font-extrabold">
                    Precio Final por Hora = Costo Base/h + Subtotal SGA & Profit por Hora
                  </p>
                  <p className="text-slate-500">
                    Costo Base/h (Raw) = Costo Máquina Factorizada + (Personal × Costo MO)
                  </p>
                  <p className="text-slate-500">
                    Subtotal SGA & Profit = Burden ({quote.manufacturingBurdenPercentage}%) + G&A ({quote.generalAdminPercentage}%) + Sales ({quote.salesPercentage}%) + Profit ({quote.profitPercentage}%)
                  </p>
                  <p className="text-slate-400 text-[9px]">
                    * Cada factor se aplica directamente sobre el Costo Base por Hora y se suma de forma directa (sin compounding).
                  </p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 text-[10px] text-indigo-800 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                  <p>
                    Nota: En el PDF impreso del cliente, la columna de <strong>&quot;Factor&quot;</strong> aplicada a cada máquina se encuentra oculta de manera confidencial, mostrando únicamente el precio final ya calculado por hora.
                  </p>
                </div>
              </div>

              {/* Exact Amounts Breakdown */}
              <div className="space-y-2 text-xs">
                <span className="font-extrabold text-[#111827] uppercase tracking-wider text-[10px] block">
                  Desglose de montos por conceptos integrados:
                </span>
                <div className="space-y-1.5 divide-y divide-slate-100 bg-white border border-slate-100 shadow-3xs p-4 rounded-2xl">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 font-bold block">
                      Costo Raw Consolidado (Costo Base por Hora):
                    </span>
                    <span className="font-mono text-slate-900 font-bold">${sumSubtotalRaw.toFixed(2)} USD/h</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 block">
                      Manufacturing Burden ({(burdenDec*100).toFixed(1)}%):
                    </span>
                    <span className="font-mono text-indigo-600 font-semibold">+${sumBurdenAmount.toFixed(2)} USD/h</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 block">
                      General & Admin G&A ({(gaDec*100).toFixed(1)}%):
                    </span>
                    <span className="font-mono text-indigo-600 font-semibold">+${sumGaAmount.toFixed(2)} USD/h</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 block">
                      Sales Commission ({(salesDec*100).toFixed(1)}%):
                    </span>
                    <span className="font-mono text-indigo-600 font-semibold">+${sumSalesAmount.toFixed(2)} USD/h</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 block">
                      Profit Margin ({quote.profitPercentage}%):
                    </span>
                    <span className="font-mono text-indigo-600 font-semibold">+${sumProfitAmount.toFixed(2)} USD/h</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-700 font-bold block">
                      Subtotal SGA & Profit por Hora:
                    </span>
                    <span className="font-mono text-slate-900 font-extrabold">${sumSgaProfitPerHour.toFixed(2)} USD/h</span>
                  </div>
                  <div className="flex justify-between items-center py-2 font-black text-indigo-900 text-[13px] bg-slate-50/60 -mx-4 px-4 rounded-b-xl border-t border-slate-200">
                    <span className="uppercase tracking-wider">Costo por Renta Hora Final:</span>
                    <span className="font-mono text-base font-extrabold">${sumPricePerHour.toFixed(2)} USD/h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes description block */}
          {quote.notes && (
            <div className="space-y-1 px-4 py-3 bg-amber-50/40 border border-amber-100 rounded-xl text-left">
              <span className="text-[10px] text-amber-800 font-black uppercase tracking-wider block">Notas y Comentarios Especiales</span>
              <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Footer actions block */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold rounded-lg shadow-sm transition-all focus:outline-hidden cursor-pointer"
          >
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  );
};

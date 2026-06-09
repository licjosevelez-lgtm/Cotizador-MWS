import React from 'react';
import { VolumeParameters, GeneralParameters } from '../types';
import { ToggleLeft, ToggleRight, DollarSign, Percent, User, Wrench, BarChart } from 'lucide-react';

interface ParametersModuleProps {
  volParams: VolumeParameters;
  genParams: GeneralParameters;
  onVolParamsChange: (params: VolumeParameters) => void;
  onGenParamsChange: (params: GeneralParameters) => void;
}

export const ParametersModule: React.FC<ParametersModuleProps> = ({
  volParams,
  genParams,
  onVolParamsChange,
  onGenParamsChange,
}) => {
  const handleVolChange = (field: keyof VolumeParameters, value: string) => {
    const numValue = parseFloat(value) || 0;
    onVolParamsChange({
      ...volParams,
      [field]: numValue,
    });
  };

  const handleGenChange = (field: keyof GeneralParameters, value: string) => {
    const numValue = parseFloat(value) || 0;
    onGenParamsChange({
      ...genParams,
      [field]: numValue,
    });
  };

  return (
    <div className="space-y-6" id="parameters-module">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-6 flex items-center gap-2">
          <BarChart className="w-5 h-5 text-indigo-600" />
          Multiplicadores de Costo por Volumen de Producción
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 space-y-2">
            <span className="text-xs font-semibold text-green-700 tracking-wide uppercase">Alto Volumen</span>
            <p className="text-xs text-gray-500 leading-tight">Más de 8,000 pza por semana</p>
            <div className="relative mt-2">
              <input
                id="vol-alto"
                type="number"
                step="5"
                value={volParams.altoPercentage}
                onChange={(e) => handleVolChange('altoPercentage', e.target.value)}
                className="w-full bg-white border border-green-200 rounded-lg py-1.5 pl-3 pr-8 font-mono text-sm text-green-950 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-2 text-green-600 font-medium text-xs">%</span>
            </div>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-2">
            <span className="text-xs font-semibold text-blue-700 tracking-wide uppercase">Medio Volumen</span>
            <p className="text-xs text-gray-500 leading-tight">Entre 2,500 y 7,999 pza por semana</p>
            <div className="relative mt-2">
              <input
                id="vol-medio"
                type="number"
                step="5"
                value={volParams.medioPercentage}
                onChange={(e) => handleVolChange('medioPercentage', e.target.value)}
                className="w-full bg-white border border-blue-200 rounded-lg py-1.5 pl-3 pr-8 font-mono text-sm text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-2 text-blue-600 font-medium text-xs">%</span>
            </div>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 space-y-2">
            <span className="text-xs font-semibold text-amber-700 tracking-wide uppercase">Bajo Volumen</span>
            <p className="text-xs text-gray-500 leading-tight">Menos de 2,500 pza por semana</p>
            <div className="relative mt-2">
              <input
                id="vol-bajo"
                type="number"
                step="5"
                value={volParams.bajoPercentage}
                onChange={(e) => handleVolChange('bajoPercentage', e.target.value)}
                className="w-full bg-white border border-amber-200 rounded-lg py-1.5 pl-3 pr-8 font-mono text-sm text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-2 text-amber-600 font-medium text-xs">%</span>
            </div>
          </div>

          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 space-y-2">
            <span className="text-xs font-semibold text-purple-700 tracking-wide uppercase">Factory Assistance</span>
            <p className="text-xs text-gray-500 leading-tight">Proyectos especiales y de volumen irregular</p>
            <div className="relative mt-2">
              <input
                id="vol-factory"
                type="number"
                step="5"
                value={volParams.factoryPercentage}
                onChange={(e) => handleVolChange('factoryPercentage', e.target.value)}
                className="w-full bg-white border border-purple-200 rounded-lg py-1.5 pl-3 pr-8 font-mono text-sm text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-2 text-purple-600 font-medium text-xs">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-6 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-indigo-600" />
          Tasas de Costo de Operación y Márgenes Administrativos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="border border-gray-100 bg-gray-50/30 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-gray-700 font-medium text-xs">
              <User className="w-4 h-4 text-indigo-500" />
              <span>Mano de Obra / Hr</span>
            </div>
            <p className="text-[11px] text-gray-400">Costo promedio de un operador</p>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1.5 text-gray-400 text-sm">$</span>
              <input
                id="param-operator"
                type="number"
                step="0.5"
                value={genParams.operatorHourlyCost}
                onChange={(e) => handleGenChange('operatorHourlyCost', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg py-1.5 pl-7 pr-3 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          <div className="border border-gray-100 bg-gray-50/30 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-gray-700 font-medium text-xs">
              <Percent className="w-4 h-4 text-indigo-500" />
              <span>Cargo de Manufactura</span>
            </div>
            <p className="text-[11px] text-gray-400">Manufacturing Burden (%)</p>
            <div className="relative mt-2">
              <input
                id="param-burden"
                type="number"
                step="0.1"
                value={genParams.manufacturingBurdenPercentage}
                onChange={(e) => handleGenChange('manufacturingBurdenPercentage', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg py-1.5 pl-3 pr-8 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-2 text-gray-500 font-medium text-xs">%</span>
            </div>
          </div>

          <div className="border border-gray-100 bg-gray-50/30 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-gray-700 font-medium text-xs">
              <Percent className="w-4 h-4 text-indigo-500" />
              <span>Gastos Grales. (G&A)</span>
            </div>
            <p className="text-[11px] text-gray-400">Administración General (%)</p>
            <div className="relative mt-2">
              <input
                id="param-ga"
                type="number"
                step="0.1"
                value={genParams.generalAdminPercentage}
                onChange={(e) => handleGenChange('generalAdminPercentage', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg py-1.5 pl-3 pr-8 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-2 text-gray-500 font-medium text-xs">%</span>
            </div>
          </div>

          <div className="border border-gray-100 bg-gray-50/30 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-gray-700 font-medium text-xs">
              <Percent className="w-4 h-4 text-indigo-500" />
              <span>Costo de Ventas</span>
            </div>
            <p className="text-[11px] text-gray-400">Sales Expense (%)</p>
            <div className="relative mt-2">
              <input
                id="param-sales"
                type="number"
                step="0.1"
                value={genParams.salesPercentage}
                onChange={(e) => handleGenChange('salesPercentage', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg py-1.5 pl-3 pr-8 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-2 text-gray-500 font-medium text-xs">%</span>
            </div>
          </div>

          <div className="border border-gray-100 bg-gray-50/30 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-gray-700 font-medium text-xs">
              <Percent className="w-4 h-4 text-emerald-500" />
              <span>Margen de Utilidad</span>
            </div>
            <p className="text-[11px] text-gray-400">Target Profit (%)</p>
            <div className="relative mt-2">
              <input
                id="param-profit"
                type="number"
                step="0.5"
                value={genParams.profitPercentage}
                onChange={(e) => handleGenChange('profitPercentage', e.target.value)}
                className="w-full bg-white border border-emerald-100 rounded-lg py-1.5 pl-3 pr-8 font-mono text-sm text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-2 text-emerald-600 font-medium text-xs">%</span>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50/50 rounded-xl p-4 mt-6 border border-indigo-100 flex items-start gap-3">
          <div className="bg-indigo-600 rounded-lg p-2 text-white text-xs font-bold leading-none mt-0.5">ℹ</div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-indigo-900 block">Ecuación Algebraica de Cotización Industrial</span>
            <p className="text-[11px] text-indigo-700 leading-relaxed">
              El costo por máquina se incrementa basándose en la tarifa por volumen activa (por ejemplo, <strong className="font-semibold">Factory = 400% el costo base de la máquina</strong>). 
              Adicionalmente, se aplica un <strong className="font-semibold">Cargo de Manufactura ({genParams.manufacturingBurdenPercentage}%)</strong> sobre el costo de Mano de Obra + Máquina. El G&A ({genParams.generalAdminPercentage}%) y Ventas ({genParams.salesPercentage}%) se aplican sobre el Subtotal de Manufactura. La <strong className="font-semibold">Utilidad ({genParams.profitPercentage}%)</strong> se calcula directamente sobre la suma del <strong className="font-semibold">(Subtotal de Manufactura + G&A)</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { PartNumber, Machine, VolumeParameters, GeneralParameters, calculatePartQuotation } from '../types';
import { saveToHistory } from '../services/quotationHistoryService';
import { Printer, Calendar, FileText, User, ArrowLeft, RefreshCw, Send, HelpCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getProspectiveQuoteNumber, generateQuotationNumber } from '../utils/quotationNumber';
import { generateSafePDF as runGenerateSafePDF } from '../utils/pdfGenerator';

interface QuotationGeneratorProps {
  partNumbers: PartNumber[];
  machines: Machine[];
  volParams: VolumeParameters;
  genParams: GeneralParameters;
  selectedPartId?: string;
  selectedPartIds?: string[];
  onBackToDashboard?: () => void;
}

export const QuotationGenerator: React.FC<QuotationGeneratorProps> = ({
  partNumbers,
  machines,
  volParams,
  genParams,
  selectedPartId,
  selectedPartIds,
  onBackToDashboard,
}) => {
  // Quote Customizer State
  const [customerName, setCustomerName] = useState('FMX');
  const [quoteNumber, setQuoteNumber] = useState(() => getProspectiveQuoteNumber());
  const [quoteNoMW, setQuoteNoMW] = useState('--');
  const [quoteDate, setQuoteDate] = useState(() => {
    const today = new Date();
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${today.getDate()}/${months[today.getMonth()]}/${today.getFullYear()}`;
  });

  // Synchronize customer/client automatically based on selected parts
  useEffect(() => {
    let activeClient = 'FMX';
    if (selectedPartId) {
      const part = partNumbers.find(p => p.id === selectedPartId);
      if (part && part.client) {
        activeClient = part.client;
      }
    } else if (selectedPartIds && selectedPartIds.length > 0) {
      const firstId = selectedPartIds[0];
      const part = partNumbers.find(p => p.id === firstId);
      if (part && part.client) {
        activeClient = part.client;
      }
    } else if (partNumbers.length > 0) {
      activeClient = partNumbers[0].client || 'FMX';
    }
    setCustomerName(activeClient);
  }, [selectedPartId, selectedPartIds, partNumbers]);

  // Synchronize prospective quote number whenever list updates or tab changes
  useEffect(() => {
    setQuoteNumber(getProspectiveQuoteNumber());
  }, [selectedPartId, selectedPartIds]);

  // Safe PDF generator that clones the canvas node, adds .pdf-export, and converts OKLCH color styles to standard HEX
  const generateSafePDF = async (finalQuoteNumber: string) => {
    await runGenerateSafePDF('quotation-canvas', finalQuoteNumber, customerName);
  };

  // Printing with confirmation and sequence generation
  const handlePrint = () => {
    Swal.fire({
      title: '¿Generar cotización e imprimir?',
      text: 'Se asignará un nuevo número consecutivo oficial de cotización, se descargará un archivo PDF y se abrirá el asistente de impresión.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, generar e imprimir',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const nextQuoteNum = generateQuotationNumber();
        setQuoteNumber(nextQuoteNum);
        setQuoteNoMW('01');
        
        // Capture items being generated to log in persistent history
        const displayedParts = selectedPartIds && selectedPartIds.length > 0
          ? partNumbers.filter((p) => selectedPartIds.includes(p.id))
          : selectedPartId
          ? partNumbers.filter((p) => p.id === selectedPartId)
          : partNumbers;

        const historyItems = displayedParts.map((part) => {
          const results = calculatePartQuotation(part, machines, volParams, genParams);
          const finalPrice = part.isFeasible !== false
            ? (part.targetPrice !== undefined && part.targetPrice !== null ? part.targetPrice : results.exWorksCost)
            : 0;

          return {
            partNumber: part.partNumber,
            description: part.description || 'Procesado',
            unitPrice: finalPrice,
            volumeCategory: part.volumeCategory || 'Alto',
            weeklyVolume: part.weeklyVolume
          };
        });

        // Save to persistent storage history
        try {
          saveToHistory({
            quotationNumber: nextQuoteNum,
            revision: '01',
            clientName: customerName,
            emissionDate: quoteDate,
            items: historyItems,
            fullDataSnapshot: {
              partNumbers,
              machines,
              volParams,
              genParams,
              selectedPartId,
              selectedPartIds,
              customerName,
              quoteNumber: nextQuoteNum,
              quoteDate,
              quoteNoMW: '01'
            }
          });
        } catch (error) {
          console.error("No se pudo registrar la cotización en el histórico:", error);
        }

        // Ensure Swal box fully closes and React updates DOM state before capturing canvas
        setTimeout(() => {
          generateSafePDF(nextQuoteNum);
        }, 300);
      }
    });
  };

  return (
    <div className="space-y-6" id="quotation-generator">
      {/* Editor Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {onBackToDashboard && (
              <button
                id="back-btn"
                onClick={onBackToDashboard}
                className="p-1 text-slate-500 hover:text-slate-800 rounded bg-slate-50 hover:bg-slate-100"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Formato Oficial de Cotización</h2>
          </div>
          <p className="text-xs text-gray-500">Visualiza y edita los encabezados comerciales de la propuesta para el cliente.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            id="print-quote-btn"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-4 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Quote customizer fields */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="space-y-1">
          <label htmlFor="quote-customer" className="text-xs font-semibold text-gray-600">Nombre de Cliente (Firma)</label>
          <input
            id="quote-customer"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-400 p-2 rounded text-xs focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="quote-num" className="text-xs font-semibold text-gray-600">Número de Cotización</label>
          <input
            id="quote-num"
            type="text"
            value={quoteNumber}
            onChange={(e) => setQuoteNumber(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-400 p-2 rounded text-xs focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="quote-mw" className="text-xs font-semibold text-gray-600">No. de Revision</label>
          <input
            id="quote-mw"
            type="text"
            value={quoteNoMW}
            onChange={(e) => setQuoteNoMW(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-400 p-2 rounded text-xs focus:outline-none transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="quote-date" className="text-xs font-semibold text-gray-600">Fecha de Emisión</label>
          <input
            id="quote-date"
            type="text"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-400 p-2 rounded text-xs focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* The Printable Page Canvas matching slide 2 */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-[850px] mx-auto font-sans text-slate-800 shadow-lg print:border-none print:shadow-none print:p-0" id="quotation-canvas">
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
            <h2 className="text-lg font-black tracking-widest uppercase text-white leading-none">QUOTATION</h2>
          </div>
        </div>

        {/* Commercial details block */}
        <div className="grid grid-cols-12 border-x-2 border-b-2 border-black bg-white">
          <div className="col-span-8 p-3 border-r-2 border-black space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">CUSTOMER</span>
            <span className="text-sm font-extrabold text-slate-900 tracking-wide uppercase">{customerName}</span>
          </div>

          <div className="col-span-4 grid grid-rows-3 text-xs">
            <div className="grid grid-cols-2 border-b border-black">
              <span className="bg-slate-50/50 p-1.5 font-bold border-r border-black flex items-center justify-center text-[10px]">NUMERO</span>
              <span className="p-1.5 text-center font-mono font-bold tracking-wide flex items-center justify-center">{quoteNumber}</span>
            </div>
            <div className="grid grid-cols-2 border-b border-black">
              <span className="bg-slate-50/50 p-1.5 font-bold border-r border-black flex items-center justify-center text-[9px] uppercase">Dia Mes Año</span>
              <span className="p-1.5 text-center font-mono flex items-center justify-center">{quoteDate}</span>
            </div>
            <div className="grid grid-cols-12">
              <span className="col-span-3 bg-slate-50/50 p-1.5 font-bold border-r border-black flex items-center justify-center text-[9px]">REV</span>
              <span className="col-span-9 p-1.5 text-center font-mono text-[10px] font-bold flex items-center justify-center">{quoteNoMW}</span>
            </div>
          </div>
        </div>

        {/* Secondary intro line from Excel */}
        <div className="bg-[#BDD7EE] border-x-2 border-b-2 border-black p-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-800">
          NOS PERMITIMOS COTIZAR LO SIGUIENTE:
        </div>

        {/* Sheet Table Grid */}
        <div className="border-x-2 border-b-2 border-black overflow-hidden">
          <table className="w-full text-left border-collapse text-[11px] font-medium text-slate-800">
            <thead>
              <tr className="bg-[#BDD7EE] border-b-2 border-black font-extrabold text-center uppercase tracking-normal"><th className="py-2 px-3 border-r border-black w-[15%] text-[10px]">Volumen</th><th className="py-2 px-3 border-r border-black w-[15%] text-[10px]">PART NUMBER</th><th className="py-2 px-3 border-r border-black w-[1%] p-0"></th><th className="py-2 px-3 border-r border-black w-[35%] text-[10px]">DESCRIPTION</th><th className="py-2 px-3 border-r border-black w-[10%] text-[9px] leading-tight">Nivel de Ing.</th><th className="py-2 px-3 border-r border-black w-[12%] text-[9px] leading-tight">TOOLING Usd</th><th className="py-2 px-3 border-r border-black w-[18%] text-[10px]">UNIT PRICE</th><th className="py-2 px-3 w-[10%] text-[10px]">Unit.</th></tr>
            </thead>
            <tbody className="divide-y divide-black font-semibold">
              {(() => {
                const displayedParts = selectedPartIds && selectedPartIds.length > 0
                  ? partNumbers.filter((p) => selectedPartIds.includes(p.id))
                  : partNumbers;

                return displayedParts.map((part) => {
                  const isTarget = selectedPartId ? part.id === selectedPartId : true;
                  
                  // Perform calculations for precise quotation display
                  const results = calculatePartQuotation(part, machines, volParams, genParams);

                  // Show target one highlighted print mode or general items matching the sheet
                  const displayVol = part.weeklyVolume
                    ? part.weeklyVolume.toLocaleString()
                    : part.volumeCategory === 'Alto' ? '16,000'
                    : part.volumeCategory === 'Medio' ? '8,000'
                    : '1,500';

                  return (
                    <tr key={part.id} className={`hover:bg-slate-50 text-center ${!isTarget && selectedPartId ? 'opacity-30' : ''}`}><td className="py-2.5 px-2 border-r border-black font-mono">{displayVol}</td><td className="py-2.5 px-2 border-r border-black font-bold font-sans">{part.partNumber}</td><td className="py-2.5 p-0 border-r border-black bg-slate-50"></td><td className="py-2.5 px-3 border-r border-black text-left">{part.description || 'Procesado'}</td><td className="py-2.5 px-1 border-r border-black font-mono text-[10px]">{part.engineeringLevel || 'AA'}</td><td className="py-2.5 px-2 border-r border-black font-mono text-[10px]">{part.toolingUsd || 'N/A'}</td><td className="py-2.5 px-2 border-r border-black text-center font-bold">{part.isFeasible !== false ? (<span className="font-mono text-xs">${(part.targetPrice !== undefined && part.targetPrice !== null ? part.targetPrice : results.exWorksCost).toFixed(2)}</span>) : (<span className="text-red-700 text-[10px] font-extrabold tracking-wide uppercase bg-red-50 p-1 rounded-sm border border-red-100">No factible</span>)}</td><td className="py-2.5 px-2 font-bold font-mono text-center text-[10px] text-slate-500">{part.isFeasible !== false ? 'USD' : '-'}</td></tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        {/* Quote Conditions Notes Block from screen 2 template */}
        <div className="mt-8 border-2 border-black p-4 bg-slate-50/50 space-y-4 rounded">
          <div className="flex items-center gap-2 border-b border-black/10 pb-1.5">
            <span className="text-xs font-extrabold text-slate-950 uppercase tracking-widest">Condiciones Comerciales</span>
          </div>

          <ul className="list-disc pl-5 text-[10px] font-bold text-slate-700 space-y-2 leading-relaxed">
            <li>THIS PRICE IS USD DOLLARS</li>
            <li>PRICE DO NOT INCLUDED VALUE ADDED TAX (IVA)</li>
            <li>FOB MW SALTILLO</li>
            <li>QUOTATION BASED ON TECHNICAL INFORMATION PROVIDED BY {customerName || 'FMX'}.</li>
            <li>DO NOT INCLUDED OIL CLEAN</li>
            <li>Metalwork's general terms and conditions of sales apply.</li>
          </ul>
        </div>

        {/* Signature lines print support */}
        <div className="mt-14 grid grid-cols-2 gap-12 text-center text-[10px] uppercase tracking-wider print:mt-16">
          <div className="flex flex-col justify-end min-h-[52px]">
            <span className="font-sans text-xs text-slate-900 font-bold mb-1 normal-case tracking-normal">Ing. Ulises Sanchez</span>
            <div className="border-b-2 border-black mx-auto w-[80%] mb-2"></div>
            <span className="font-bold text-slate-500">FIRMA AUTORIZADA MW</span>
          </div>
          <div className="flex flex-col justify-end min-h-[52px]">
            <div className="border-b-2 border-black mx-auto w-[80%] mb-2"></div>
            <span className="font-bold text-slate-500">Aceptación y Firma de Cliente - {customerName}</span>
          </div>
        </div>

        {/* PDF Page Footer */}
        <div className="mt-16 pt-3 border-t border-slate-200 grid grid-cols-3 items-center text-[9px] font-bold text-slate-400 w-full uppercase">
          <span className="text-left font-mono">F-7.2-03  REV.01</span>
          <span className="text-center whitespace-nowrap">Metalwork & Stamping S.A. de C.V.</span>
          <span></span>
        </div>
      </div>
    </div>
  );
};

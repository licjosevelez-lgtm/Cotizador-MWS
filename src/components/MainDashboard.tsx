import React, { useState, useMemo } from 'react';
import { PartNumber, Machine, VolumeParameters, GeneralParameters, VolumeCategory, calculatePartQuotation, CalculationResult } from '../types';
import { Layers, Coins, TrendingUp, Settings, HelpCircle, FileText, CheckCircle2, AlertTriangle, ChevronRight, Calculator, Edit2, Play, X } from 'lucide-react';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { usePartNumbers } from '../contexts/PartNumbersContext';
import { sanitizeOklchString } from '../utils/pdfGenerator';

interface MainDashboardProps {
  partNumbers: PartNumber[];
  machines: Machine[];
  volParams: VolumeParameters;
  genParams: GeneralParameters;
  onUpdatePartNumbers: (parts: PartNumber[]) => void;
  onSelectPart: (part: PartNumber) => void;
  onNavigateToQuote: (partId: string) => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  partNumbers,
  machines,
  volParams,
  genParams,
  onUpdatePartNumbers,
  onSelectPart,
  onNavigateToQuote,
}) => {
  const { selectedIds, setSelectedIds, toggleSelectId } = usePartNumbers();

  // Selected Part for breakdown view, defaults to first part
  const [activePartId, setActivePartId] = useState<string>(() => {
    return partNumbers.length > 0 ? partNumbers[0].id : '';
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('Todos');

  // Change volume for a part-number in real-time
  const handleVolumeChange = (partId: string, newVolume: VolumeCategory) => {
    const updated = partNumbers.map((p) =>
      p.id === partId ? { ...p, volumeCategory: newVolume } : p
    );
    onUpdatePartNumbers(updated);
  };

  // Change feasibility for a part number in real-time
  const handleFeasibleToggle = (partId: string, currentVal: boolean) => {
    const updated = partNumbers.map((p) =>
      p.id === partId ? { ...p, isFeasible: !currentVal } : p
    );
    onUpdatePartNumbers(updated);
  };

  // Update target price for a part number in real-time
  const handleTargetUpdate = (partId: string, val: number | undefined) => {
    if (val !== undefined && (val < 0 || isNaN(val))) {
      Swal.fire({
        title: 'Valor inválido',
        text: 'Por favor, ingrese un precio positivo válido para el Target.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const updated = partNumbers.map((p) =>
      p.id === partId ? { ...p, targetPrice: val } : p
    );
    onUpdatePartNumbers(updated);
  };

  // Calculate stats
  const stats = useMemo(() => {
    let totalFeasible = 0;
    let totalNonFeasible = 0;
    let sumExWorks = 0;

    partNumbers.forEach((p) => {
      if (p.isFeasible !== false) {
        totalFeasible++;
        const res = calculatePartQuotation(p, machines, volParams, genParams);
        sumExWorks += res.exWorksCost;
      } else {
        totalNonFeasible++;
      }
    });

    const averagePrice = totalFeasible > 0 ? sumExWorks / totalFeasible : 0;

    return {
      totalParts: partNumbers.length,
      feasibleCount: totalFeasible,
      nonFeasibleCount: totalNonFeasible,
      averageSellingPrice: averagePrice,
    };
  }, [partNumbers, machines, volParams, genParams]);

  // Clients list for filter dropdown
  const clients = useMemo(() => {
    const set = new Set<string>();
    partNumbers.forEach((p) => {
      if (p.client) set.add(p.client);
    });
    return ['Todos', ...Array.from(set)];
  }, [partNumbers]);

  // Filtered part numbers
  const filteredParts = useMemo(() => {
    return partNumbers.filter((p) => {
      const matchSearch = p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchClient = clientFilter === 'Todos' || p.client === clientFilter;
      return matchSearch && matchClient;
    });
  }, [partNumbers, searchTerm, clientFilter]);

  // Selected Part Breakdown Calculations
  const selectedPart = useMemo(() => {
    return partNumbers.find((p) => p.id === activePartId) || partNumbers[0] || null;
  }, [partNumbers, activePartId]);

  const selectedPartCalc = useMemo(() => {
    if (!selectedPart) return null;
    return calculatePartQuotation(selectedPart, machines, volParams, genParams);
  }, [selectedPart, machines, volParams, genParams]);

  const generateCostBreakdownPDF = async () => {
    if (selectedIds.length === 0) {
      Swal.fire({
        title: 'Selección vacía',
        text: 'Por favor, selecciona al menos un número de parte para generar el Cost break down.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    Swal.fire({
      title: 'Generando Cost breakdown...',
      text: `Compilando análisis técnico para ${selectedIds.length} número(s) de parte.`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const stylesToRestore: { element: HTMLStyleElement; originalText: string }[] = [];
    const linksToRestore: { element: HTMLLinkElement; originalDisabled: boolean }[] = [];
    const tempStylesAdded: HTMLStyleElement[] = [];

    const originalGetComputedStyle = window.getComputedStyle;

    try {
      // Intercept computed style queries from html2canvas to dynamically rewrite any residual oklch/oklab values to safe RGB colors
      window.getComputedStyle = function (elt, pseudoElt) {
        const style = originalGetComputedStyle(elt, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            if (prop === 'getPropertyValue') {
              return function (propertyName: string) {
                const originalVal = target.getPropertyValue(propertyName);
                if (typeof originalVal === 'string' && (originalVal.toLowerCase().includes('oklch') || originalVal.toLowerCase().includes('oklab'))) {
                  return sanitizeOklchString(originalVal);
                }
                return originalVal;
              };
            }
            const val = Reflect.get(target, prop);
            if (typeof val === 'function') {
              return val.bind(target);
            }
            if (typeof val === 'string' && (val.toLowerCase().includes('oklch') || val.toLowerCase().includes('oklab'))) {
              return sanitizeOklchString(val);
            }
            return val;
          }
        });
      };

      // 1. Temporarily sanitize document style tag contents and external link stylesheets to prevent html2canvas color parsing crashes on raw "oklch" or "oklab"
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        if (!sheet) continue;
        try {
          if (sheet.ownerNode && sheet.ownerNode.nodeName === 'STYLE') {
            const styleTag = sheet.ownerNode as HTMLStyleElement;
            const text = styleTag.textContent || styleTag.innerHTML;
            if (text && (text.toLowerCase().includes('oklch') || text.toLowerCase().includes('oklab'))) {
              stylesToRestore.push({ element: styleTag, originalText: text });
              const sanitized = text
                .replace(/oklch\([^)]+\)/gi, 'rgb(120, 120, 120)')
                .replace(/oklab\([^)]+\)/gi, 'rgb(120, 120, 120)');
              styleTag.textContent = sanitized;
              try {
                styleTag.innerHTML = sanitized;
              } catch (e) {
                console.warn('Could not assign styleTag innerHTML:', e);
              }
            }
          } else if (sheet.href && sheet.ownerNode && sheet.ownerNode.nodeName === 'LINK') {
            const linkTag = sheet.ownerNode as HTMLLinkElement;
            const sheetUrl = new URL(sheet.href, window.location.href);
            if (sheetUrl.origin === window.location.origin) {
              const res = await fetch(sheet.href);
              if (res.ok) {
                const text = await res.text();
                const sanitized = text
                  .replace(/oklch\([^)]+\)/gi, 'rgb(120, 120, 120)')
                  .replace(/oklab\([^)]+\)/gi, 'rgb(120, 120, 120)');
                
                const newStyle = document.createElement('style');
                newStyle.textContent = sanitized;
                document.body.appendChild(newStyle);
                tempStylesAdded.push(newStyle);

                linksToRestore.push({ element: linkTag, originalDisabled: linkTag.disabled });
                linkTag.disabled = true;
              }
            }
          }
        } catch (err) {
          console.warn('Skipping style sheet item due to error:', err);
        }
      }

      // Apply safe-colors class to document root
      document.documentElement.classList.add('safe-colors');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);

      const currentDateString = new Date().toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      // Process each selected part number sequentially to keep memory low and prevent rendering overlap
      for (let i = 0; i < selectedIds.length; i++) {
        const partId = selectedIds[i];
        const part = partNumbers.find((p) => p.id === partId);
        if (!part) continue;

        const res = calculatePartQuotation(part, machines, volParams, genParams);

        // Build HTML string for steps rows
        const stepsRowsHTML = res.steps.map((stepRes) => {
          const machineName = machines.find((m) => m.id === stepRes.step.machineId)?.name || 'Manual';
          return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 8px; font-weight: 600; color: #1e293b; border-right: 1px solid #e2e8f0;">${stepRes.step.stepName}</td>
              <td style="padding: 6px 8px; text-align: center; font-family: monospace; color: #64748b; border-right: 1px solid #e2e8f0;">${stepRes.step.sequence}</td>
              <td style="padding: 6px 8px; color: #334155; font-weight: 500; border-right: 1px solid #e2e8f0;">${machineName}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0;">${stepRes.step.outputPerHour}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #4338ca; font-weight: bold; border-right: 1px solid #e2e8f0;">${stepRes.cycleTimeMin.toFixed(2)}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0;">$${stepRes.laborHourlyCost.toFixed(2)}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #0f172a; font-weight: bold; border-right: 1px solid #e2e8f0;">$${stepRes.laborCostPerPiece.toFixed(2)}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0;">${stepRes.machineAppliedRate > 0 ? `$${stepRes.machineAppliedRate.toFixed(2)}` : '$0.00'}</td>
              <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #4338ca; font-weight: bold;">$${stepRes.machineCostPerPiece.toFixed(2)}</td>
            </tr>
          `;
        }).join('');

        // Negotiation details
        let negotiationRowHTML = '';
        if (part.targetPrice !== undefined && part.targetPrice !== null) {
          const originalPrice = res.exWorksCost;
          const negotiatedPrice = part.targetPrice;
          const diffVal = originalPrice - negotiatedPrice;
          const actualPercent = (diffVal / originalPrice) * 100;
          const isDiscount = diffVal >= 0;

          negotiationRowHTML = `
            <tr style="background-color: ${isDiscount ? '#ecfdf5' : '#fef2f2'}; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; color: #1e293b;">
                <span style="font-size: 10px; display: block;">${isDiscount ? 'Descuento por negociación' : 'Ajuste por negociación'}</span>
                <span style="font-size: 8px; font-weight: 500; color: #64748b; font-family: sans-serif;">${isDiscount ? 'Descuento real sobre costo base' : 'Incremento por negociación'}</span>
              </td>
              <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: bold; font-size: 10px; color: ${isDiscount ? '#047857' : '#b91c1c'};">
                ${isDiscount ? '-' : '+'}$${Math.abs(diffVal).toFixed(2)} <span style="font-size: 8px; font-weight: 600; color: #64748b; font-family: sans-serif;">(${isDiscount ? '' : '+'}${(-actualPercent).toFixed(1)}%)</span>
              </td>
            </tr>
          `;
        }

        // Create temporary container for this page's HTML
        const clonedElement = document.createElement('div');
        clonedElement.classList.add('pdf-export');
        clonedElement.style.position = 'absolute';
        clonedElement.style.left = '-9999px';
        clonedElement.style.top = '-9999px';
        clonedElement.style.width = '800px';
        clonedElement.style.backgroundColor = '#ffffff';
        clonedElement.style.padding = '24px';
        clonedElement.style.fontFamily = '"Inter", system-ui, sans-serif';
        clonedElement.style.color = '#1e293b';

        clonedElement.innerHTML = `
          <!-- Header of the Sheet -->
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; background-color: #ffffff;">
            <div>
              <div style="font-size: 9px; font-weight: 800; tracking: 0.1em; color: #4f46e5; text-transform: uppercase;">METAL STAMPING ANALYSIS REPORT</div>
              <h1 style="font-size: 20px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin: 2px 0 0 0; letter-spacing: -0.025em;">EXWORKS COST BREAK DOWN</h1>
              <p style="font-size: 9px; color: #64748b; font-weight: 600; margin: 2px 0 0 0;">Reporte Analítico Oficial de Estructura de Costeo Técnico</p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; font-weight: 800; background-color: #e0e7ff; color: #4f46e5; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace;">
                No. de parte: ${part.partNumber}
              </span>
              <p style="font-size: 9px; color: #64748b; margin: 6px 0 0 0; font-weight: bold;">Cliente: ${part.client || 'N/A'}</p>
            </div>
          </div>

          <!-- Specs section -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 11px; font-weight: 600; margin-bottom: 16px;">
            <div>
              <span style="font-size: 8px; font-weight: 700; color: #64748b; display: block; text-transform: uppercase; margin-bottom: 2px;">NÚMERO DE PARTE</span>
              <span style="font-weight: 800; color: #0f172a;">${part.partNumber}</span>
            </div>
            <div>
              <span style="font-size: 8px; font-weight: 700; color: #64748b; display: block; text-transform: uppercase; margin-bottom: 2px;">DESCRIPCIÓN / PROCESO</span>
              <span style="color: #0f172a;">${part.description || 'Procesado'}</span>
            </div>
            <div>
              <span style="font-size: 8px; font-weight: 700; color: #64748b; display: block; text-transform: uppercase; margin-bottom: 2px;">NIVEL DE INGENIERÍA</span>
              <span style="font-family: monospace; color: #0f172a;">${part.engineeringLevel || 'AA'}</span>
            </div>
            <div>
              <span style="font-size: 8px; font-weight: 700; color: #64748b; display: block; text-transform: uppercase; margin-bottom: 2px;">VOLUMEN CATEGORÍA</span>
              <span style="font-weight: bold; color: #4f46e5;">${part.volumeCategory}</span>
            </div>
          </div>

          <!-- Panel 1: Processing (Direct Labor and Machine) -->
          <div style="margin-bottom: 16px;">
            <span style="font-size: 11px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; display: block; background-color: #f1f5f9; padding: 6px 12px; border-radius: 4px; border-left: 4px solid #4f46e5; margin-bottom: 8px;">
              1. Processing (Direct Labor and Machine)
            </span>
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 10px;">
                <thead>
                  <tr style="background-color: #0f172a; color: #ffffff; font-size: 9px; font-weight: bold; text-transform: uppercase;">
                    <th style="padding: 8px; border-right: 1px solid #334155;">Paso / Operación</th>
                    <th style="padding: 8px; border-right: 1px solid #334155; text-align: center; width: 45px;">Sec.</th>
                    <th style="padding: 8px; border-right: 1px solid #334155;">Prensa / Tonelaje</th>
                    <th style="padding: 8px; border-right: 1px solid #334155; text-align: right; width: 75px;">PZS / HR</th>
                    <th style="padding: 8px; border-right: 1px solid #334155; text-align: right; width: 75px;">Ciclo (min)</th>
                    <th style="padding: 8px; border-right: 1px solid #334155; text-align: right; width: 95px;">Mano Obra ($/hr)</th>
                    <th style="padding: 8px; border-right: 1px solid #334155; text-align: right; width: 90px;">M.O. / pieza ($)</th>
                    <th style="padding: 8px; border-right: 1px solid #334155; text-align: right; width: 95px;">Tarifa Máq ($/hr)</th>
                    <th style="padding: 8px; text-align: right; width: 90px;">Máq / pieza ($)</th>
                  </tr>
                </thead>
                <tbody style="background-color: #ffffff;">
                  ${stepsRowsHTML}
                  <tr style="background-color: #f8fafc; font-weight: bold; border-top: 1.5px solid #cbd5e1;">
                    <td style="padding: 8px; border-right: 1px solid #e2e8f0;" colSpan="3">Total de Procesamiento (Processing Total)</td>
                    <td style="padding: 8px; text-align: right; border-right: 1px solid #e2e8f0;">-</td>
                    <td style="padding: 8px; text-align: right; border-right: 1px solid #e2e8f0;">-</td>
                    <td style="padding: 8px; text-align: right; border-right: 1px solid #e2e8f0;">-</td>
                    <td style="padding: 8px; text-align: right; font-family: monospace; color: #0f172a; font-weight: 800; border-right: 1px solid #e2e8f0;">
                      $${res.directLaborTotal.toFixed(2)}
                    </td>
                    <td style="padding: 8px; text-align: right; border-right: 1px solid #e2e8f0;">-</td>
                    <td style="padding: 8px; text-align: right; font-family: monospace; color: #4f46e5; font-weight: 800;">
                      $${res.machineCostTotal.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Double columns layout for Panels 2 & 3 -->
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            <!-- Panel 2: Overhead Burden Subtotal -->
            <div>
              <span style="font-size: 11px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; display: block; background-color: #f1f5f9; padding: 6px 12px; border-radius: 4px; border-left: 4px solid #4f46e5; margin-bottom: 8px;">
                2. Overhead / Burden / Subtotal
              </span>
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 10px;">
                  <tbody style="background-color: #ffffff;">
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px; color: #475569; font-weight: 600;">Purchased Components</td>
                      <td style="padding: 8px; text-align: right; font-family: monospace; color: #0f172a; font-weight: bold;">$${res.purchasedComponents.toFixed(2)}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px; color: #475569; font-weight: 600;">Raw Material</td>
                      <td style="padding: 8px; text-align: right; font-family: monospace; color: #0f172a; font-weight: bold;">$${res.rawMaterial.toFixed(2)}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px; color: #94a3b8; font-weight: normal;">Material Burden</td>
                      <td style="padding: 8px; text-align: right; font-family: monospace; color: #94a3b8;">0.00%</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px; color: #475569; font-weight: 600;">Labor Cost (Sum)</td>
                      <td style="padding: 8px; text-align: right; font-family: monospace; color: #0f172a; font-weight: bold;">$${res.directLaborTotal.toFixed(2)}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px; color: #475569; font-weight: 600;">Machine Cost (Sum)</td>
                      <td style="padding: 8px; text-align: right; font-family: monospace; color: #0f172a; font-weight: bold;">$${res.machineCostTotal.toFixed(2)}</td>
                    </tr>
                    <tr style="background-color: #fffbeb; border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px; color: #78350f; font-weight: bold;">Manufacturing Burden</td>
                      <td style="padding: 8px; text-align: right; font-family: monospace; color: #78350f; font-weight: bold;">
                        $${res.manufacturingBurden.toFixed(2)} <span style="font-size: 8px; font-weight: normal; color: #b45309;">(${genParams.manufacturingBurdenPercentage.toFixed(1)}%)</span>
                      </td>
                    </tr>
                    <tr style="background-color: #0f172a; color: #ffffff;">
                      <td style="padding: 10px 8px; font-weight: 800; text-transform: uppercase; font-size: 10px;">Manufacturing Subtotal</td>
                      <td style="padding: 10px 8px; text-align: right; font-family: monospace; color: #34d399; font-weight: 900; font-size: 11px;">$${res.manufacturingSubtotal.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Panel 3: SGA and Profit Calculations -->
            <div>
              <span style="font-size: 11px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; display: block; background-color: #f1f5f9; padding: 6px 12px; border-radius: 4px; border-left: 4px solid #4f46e5; margin-bottom: 8px;">
                3. SGA and Profit Calculations
              </span>
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 10px;">
                  <tbody style="background-color: #ffffff;">
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 8px; color: #475569; font-weight: 600;">Manufacturing Subtotal</td>
                      <td style="padding: 8px; text-align: right; font-family: monospace; color: #0f172a;">$${res.manufacturingSubtotal.toFixed(2)}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
                      <td style="padding: 8px; color: #475569; font-weight: 600;">General, Administration (G&A)</td>
                      <td style="padding: 8px; text-align: right; font-family: monospace; color: #4f46e5; font-weight: bold;">
                        $${res.generalAdmin.toFixed(2)} <span style="font-size: 8px; font-weight: normal; color: #6366f1;">(${genParams.generalAdminPercentage.toFixed(1)}%)</span>
                      </td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
                      <td style="padding: 8px; color: #475569; font-weight: 600;">Sales Expense</td>
                      <td style="padding: 8px; text-align: right; font-family: monospace; color: #4f46e5; font-weight: bold;">
                        $${res.sales.toFixed(2)} <span style="font-size: 8px; font-weight: normal; color: #6366f1;">(${genParams.salesPercentage.toFixed(1)}%)</span>
                      </td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9; background-color: #ecfdf5;">
                      <td style="padding: 8px; color: #065f46; font-weight: bold;">Target Profit Margin</td>
                      <td style="padding: 8px; text-align: right; font-family: monospace; color: #047857; font-weight: bold;">
                        $${res.profit.toFixed(2)} <span style="font-size: 8px; font-weight: normal; color: #059669;">(${genParams.profitPercentage.toFixed(1)}%)</span>
                      </td>
                    </tr>
                    ${negotiationRowHTML}
                    <tr style="background-color: #fef9c3; border: 2px solid #facc15;">
                      <td style="padding: 10px 8px; font-weight: 900; text-transform: uppercase; font-size: 10px; color: #1e293b;">
                        Metal Stamping ExWorks Cost
                      </td>
                      <td style="padding: 10px 8px; text-align: right; font-family: monospace; color: #000000; font-weight: 900; font-size: 12px;">
                        $${(part.targetPrice !== undefined && part.targetPrice !== null ? part.targetPrice : res.exWorksCost).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Report Footer -->
          <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; font-weight: 700; color: #94a3b8;">
            <span>Metalwork & Stamping S.A de C.V • Reporte Computado de Costo Unitario</span>
            <span style="font-family: monospace;">Generado: ${currentDateString} • Página ${i + 1} de ${selectedIds.length}</span>
          </div>
        `;

        document.body.appendChild(clonedElement);

        await new Promise((resolve) => setTimeout(resolve, 150));

        let canvas;
        try {
          canvas = await html2canvas(clonedElement, {
            scale: 2.2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          });
        } finally {
          if (clonedElement.parentNode) {
            clonedElement.parentNode.removeChild(clonedElement);
          }
        }

        const imgData = canvas.toDataURL('image/png');
        
        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, (canvas.height * contentWidth) / canvas.width, undefined, 'FAST');
      }

      // Restore original computed style implementation
      window.getComputedStyle = originalGetComputedStyle;

      // Cleanup of temporary styles and link variables
      tempStylesAdded.forEach((style) => {
        if (style.parentNode) {
          style.parentNode.removeChild(style);
        }
      });
      linksToRestore.forEach(({ element, originalDisabled }) => {
        try {
          element.disabled = originalDisabled;
        } catch (e) {}
      });
      document.documentElement.classList.remove('safe-colors');
      stylesToRestore.forEach(({ element, originalText }) => {
        try {
          element.textContent = originalText;
          element.innerHTML = originalText;
        } catch (e) {
          console.error('Error restoring original stylesheet:', e);
        }
      });

      pdf.save(`Desglose_De_Costos_Estampados_${new Date().toISOString().slice(0,10).replace(/-/g, '')}.pdf`);

      Swal.fire({
        title: '¡Análisis PDF Generado!',
        text: `El desglose de costos detallado ("Cost break down") para ${selectedIds.length} número(s) de parte se descargó exitosamente.`,
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });

    } catch (err) {
      console.error('Error compiling cost breakdown PDF:', err);
      // Restore original computed style implementation
      window.getComputedStyle = originalGetComputedStyle;

      // Cleanup on catch
      tempStylesAdded.forEach((style) => {
        if (style.parentNode) {
          style.parentNode.removeChild(style);
        }
      });
      linksToRestore.forEach(({ element, originalDisabled }) => {
        try {
          element.disabled = originalDisabled;
        } catch (e) {}
      });
      document.documentElement.classList.remove('safe-colors');
      stylesToRestore.forEach(({ element, originalText }) => {
        try {
          element.textContent = originalText;
          element.innerHTML = originalText;
        } catch (e) {}
      });

      Swal.fire({
        title: 'Error de generación',
        text: 'Ocurrió un error al compilar el PDF de desglose de costo técnico.',
        icon: 'error',
        confirmButtonColor: '#4f46e5'
      });
    }
  };

  return (
    <div className="space-y-6" id="main-dashboard">
      {/* Top Cards Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
          <div className="bg-indigo-50 text-indigo-600 rounded-lg p-3">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 block">Total Números de Parte</span>
            <span className="text-2xl font-extrabold text-gray-900 font-mono leading-none">{stats.totalParts}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 rounded-lg p-3">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 block">Proyectos Factibles</span>
            <span className="text-2xl font-extrabold text-emerald-700 font-mono leading-none">{stats.feasibleCount}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
          <div className="bg-rose-50 text-rose-600 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 block">No Factibles</span>
            <span className="text-2xl font-extrabold text-rose-700 font-mono leading-none">{stats.nonFeasibleCount}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
          <div className="bg-amber-50 text-amber-600 rounded-lg p-3">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 block font-sans">Precio Promedio de Venta</span>
            <span className="text-xl font-extrabold text-amber-700 font-mono leading-none">
              ${stats.averageSellingPrice.toFixed(2)} USD
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Parts List and Calculator Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: General Overview Table of Part Numbers */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
            <h3 className="text-base font-bold text-gray-900">Listado General y Cotizador Reactivo</h3>
            
            {/* Search, Filters and PDF */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-grow sm:flex-grow-0">
                <input
                  id="search-part"
                  type="text"
                  placeholder="Buscar No. de Parte o Proceso..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-gray-200 focus:ring-1 focus:ring-indigo-400 pl-3 pr-8 py-2 rounded-lg text-xs focus:outline-none transition-colors w-full sm:w-44 placeholder:text-gray-400 font-medium"
                />
              </div>

              <select
                id="filter-client"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100/70 border border-gray-200 py-2 px-3 rounded-lg text-xs focus:outline-none cursor-pointer text-gray-700 w-full sm:w-36 font-medium"
              >
                {clients.map((c) => (
                  <option key={c} value={c}>{c === 'Todos' ? 'Todos los Clientes' : c}</option>
                ))}
              </select>

              <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1" />

              <button
                id="btn-pdf-cost-break-down"
                onClick={generateCostBreakdownPDF}
                disabled={selectedIds.length === 0}
                className={`inline-flex items-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-bold transition-all w-full sm:w-auto justify-center cursor-pointer ${
                  selectedIds.length > 0
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-400 border border-rose-100/70 opacity-60 cursor-not-allowed'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                PDF Cost breakdown {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="parts-quotation-table">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-slate-50/40">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      id="toggle-select-all"
                      checked={filteredParts.length > 0 && filteredParts.every(p => selectedIds.includes(p.id))}
                      onChange={() => {
                        const allFilteredSelected = filteredParts.every(p => selectedIds.includes(p.id));
                        if (allFilteredSelected) {
                          const filteredIds = filteredParts.map(p => p.id);
                          setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
                        } else {
                          setSelectedIds(prev => {
                            const union = new Set([...prev, ...filteredParts.map(p => p.id)]);
                            return Array.from(union);
                          });
                        }
                      }}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">N. Parte</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Volumen Estimado</th>
                  <th className="py-2.5 px-3 text-center">Estatus</th>
                  <th className="py-2.5 px-3 text-right">Precio Venta</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-[11px] font-semibold">
                {filteredParts.map((part) => {
                  const res = calculatePartQuotation(part, machines, volParams, genParams);
                  const isCalculatedActive = part.id === activePartId;

                  return (
                    <tr
                      key={part.id}
                      onClick={() => setActivePartId(part.id)}
                      className={`hover:bg-slate-50/70 cursor-pointer transition-colors ${
                        isCalculatedActive ? 'bg-indigo-50/20 border-l-2 border-indigo-600' : ''
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          id={`select-part-${part.id}`}
                          checked={selectedIds.includes(part.id)}
                          onChange={() => toggleSelectId(part.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-gray-900 block">{part.partNumber}</span>
                        <span className="text-[10px] text-gray-400 font-medium block truncate max-w-[120px]">{part.description}</span>
                      </td>
                      <td className="py-3.5 px-3 text-gray-600">{part.client}</td>
                      <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                        {/* THE REACTIVE VOLUMEN SELECTION DROPDOWN */}
                        <select
                          id={`volume-select-${part.id}`}
                          value={part.volumeCategory}
                          onChange={(e) => handleVolumeChange(part.id, e.target.value as VolumeCategory)}
                          className="bg-white border border-gray-200 text-[11px] font-bold py-1 px-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800"
                        >
                          <option value="Alto">Alto Volumen (200%)</option>
                          <option value="Medio">Medio (250%)</option>
                          <option value="Bajo">Bajo (300%)</option>
                          <option value="Factory">Factory (400%)</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          id={`feasible-toggle-${part.id}`}
                          onClick={() => handleFeasibleToggle(part.id, part.isFeasible !== false)}
                          className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                            part.isFeasible !== false
                              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              : 'text-red-700 bg-red-50 hover:bg-red-100'
                          }`}
                        >
                          {part.isFeasible !== false ? '● Factible' : '● No factible'}
                        </button>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-gray-900 font-bold">
                        {part.isFeasible !== false ? (
                          part.targetPrice !== undefined && part.targetPrice !== null ? (
                            <span className="text-emerald-700" title={`Precio negociado (Calculado original: $${res.exWorksCost.toFixed(2)})`}>
                              ${part.targetPrice.toFixed(2)} USD
                            </span>
                          ) : (
                            `$${res.exWorksCost.toFixed(2)} USD`
                          )
                        ) : (
                          <span className="text-red-700 uppercase font-extrabold text-[9px] px-1.5 py-0.5 rounded bg-red-50 border border-red-100">
                            No factible
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          id={`go-to-template-${part.id}`}
                          onClick={() => onNavigateToQuote(part.id)}
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 font-bold px-2 py-1 rounded text-[10px]"
                        >
                          <FileText className="w-3 h-3" />
                          Cotización
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Quick Specs / Calculator Information */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-slate-300 font-extrabold tracking-wider uppercase">Parte Seleccionada</span>
                <p className="text-xl font-bold tracking-tight mt-0.5">No. {selectedPart ? selectedPart.partNumber : 'Ninguno'}</p>
              </div>
              <span className="bg-slate-700 text-slate-100 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {selectedPart ? selectedPart.volumeCategory : 'Alto'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-semibold border-t border-slate-700/60 pt-4">
              <div>
                <span className="text-[10px] text-slate-400 block">Cliente</span>
                <span className="text-slate-100">{selectedPart ? selectedPart.client : '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Estructura / Descripción</span>
                <span className="text-slate-100 truncate block">{selectedPart ? (selectedPart.description || 'Prensa') : '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Nivel de Ing.</span>
                <span className="text-slate-100 font-mono">{selectedPart ? (selectedPart.engineeringLevel || 'AA') : 'AA'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Herramental (Tooling)</span>
                <span className="text-slate-100 font-mono">{selectedPart ? (selectedPart.toolingUsd || 'N/A') : 'N/A'}</span>
              </div>
            </div>

            <div className="border-t border-slate-700/60 pt-4 flex justify-between items-center bg-slate-950/20 p-3 rounded-lg">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold text-amber-400">Precio Venta Final</span>
                <span className="text-2xl font-black font-mono tracking-tight text-white">
                  {selectedPart && selectedPart.isFeasible !== false && selectedPartCalc ? (
                    selectedPart.targetPrice !== undefined && selectedPart.targetPrice !== null ? (
                      `$${selectedPart.targetPrice.toFixed(2)} USD`
                    ) : (
                      `$${selectedPartCalc.exWorksCost.toFixed(2)} USD`
                    )
                  ) : (
                    'No Factible'
                  )}
                </span>
                {selectedPart && selectedPart.isFeasible !== false && selectedPart.targetPrice !== undefined && selectedPart.targetPrice !== null && selectedPartCalc && (
                  <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5 animate-pulse">
                    Precio Negociado (Pre.-técnico: ${selectedPartCalc.exWorksCost.toFixed(2)})
                  </span>
                )}
              </div>
              {selectedPart && (
                <button
                  id="view-breakdown-btn"
                  onClick={() => onSelectPart(selectedPart)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg transition-colors inline-flex items-center gap-1"
                >
                  Modificar Pasos
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Target price interactive inputs section */}
            {selectedPart && selectedPart.isFeasible !== false && (
              <div className="border-t border-slate-700/40 pt-3.5 flex flex-col gap-1.5 bg-slate-950/10 p-3 rounded-lg">
                <label htmlFor="target-price-input" className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>Target (Precio Negociado)</span>
                  {selectedPart.targetPrice !== undefined && selectedPart.targetPrice !== null && (
                    <button
                      id="reset-target-btn"
                      onClick={() => handleTargetUpdate(selectedPart.id, undefined)}
                      className="text-slate-400 hover:text-rose-400 text-[10px] font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <X className="w-3 h-3" /> Restablecer
                    </button>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 font-mono text-xs">$</span>
                  <input
                    id="target-price-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Escriba precio negociado de cotización..."
                    value={selectedPart.targetPrice !== undefined && selectedPart.targetPrice !== null ? selectedPart.targetPrice : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        handleTargetUpdate(selectedPart.id, undefined);
                      } else {
                        const num = parseFloat(val);
                        if (!isNaN(num)) {
                          handleTargetUpdate(selectedPart.id, num);
                        }
                      }
                    }}
                    className="w-full pl-6 pr-3 py-1.5 bg-slate-950/40 border border-slate-700/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-505 rounded-lg font-mono font-bold text-xs outline-none text-slate-100 placeholder:text-slate-500 transition-all font-sans"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-indigo-600" />
              Previa Estructura Quoting Algebra ($ / pza)
            </h4>

            {selectedPart && selectedPart.isFeasible !== false && selectedPartCalc ? (
              <div className="space-y-2 text-xs font-medium">
                <div className="flex justify-between border-b border-gray-50 pb-1.5">
                  <span className="text-gray-500">Mano de Obra Directa</span>
                  <span className="font-mono text-gray-800">${selectedPartCalc.directLaborTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1.5">
                  <span className="text-gray-500">Costo Hora Máquina (Escalado)</span>
                  <span className="font-mono text-gray-800">${selectedPartCalc.machineCostTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1.5">
                  <span className="text-gray-500">Cargo de Manufactura ({genParams.manufacturingBurdenPercentage}%)</span>
                  <span className="font-mono text-gray-800">${selectedPartCalc.manufacturingBurden.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1.5 font-semibold text-slate-900">
                  <span>Subtotal Manufactura</span>
                  <span className="font-mono">${selectedPartCalc.manufacturingSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1.5">
                  <span className="text-gray-500 font-normal">G&A Cost ({genParams.generalAdminPercentage}%)</span>
                  <span className="font-mono text-gray-800">${selectedPartCalc.generalAdmin.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1.5">
                  <span className="text-gray-500 font-normal">Ventas Cost ({genParams.salesPercentage}%)</span>
                  <span className="font-mono text-gray-800">${selectedPartCalc.sales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1.5">
                  <span className="text-emerald-600 font-normal font-sans">Margen de Utilidad ({genParams.profitPercentage}%)</span>
                  <span className="font-mono text-emerald-700">${selectedPartCalc.profit.toFixed(2)}</span>
                </div>
                {selectedPart.targetPrice !== undefined && selectedPart.targetPrice !== null && (
                  (() => {
                    const originalPrice = selectedPartCalc.exWorksCost;
                    const negotiatedPrice = selectedPart.targetPrice;
                    const diffVal = originalPrice - negotiatedPrice;
                    const isDiscount = diffVal >= 0;

                    return (
                      <div className="flex justify-between border-b border-gray-50 pb-1.5 text-[11px] font-semibold">
                        <span className={isDiscount ? "text-emerald-600 font-sans" : "text-rose-600 font-sans"}>
                          {isDiscount ? "Descuento negociado" : "Ajuste negociado"}
                        </span>
                        <span className={`font-mono ${isDiscount ? "text-emerald-700" : "text-rose-700"}`}>
                          {isDiscount ? '-' : '+'}${Math.abs(diffVal).toFixed(2)}
                        </span>
                      </div>
                    );
                  })()
                )}
                <div className="flex justify-between pt-2 border-t-2 border-dashed border-gray-100 font-extrabold text-sm text-indigo-700">
                  <span>Costo ExWorks de Venta</span>
                  <span className="font-mono">
                    ${(selectedPart.targetPrice !== undefined && selectedPart.targetPrice !== null ? selectedPart.targetPrice : selectedPartCalc.exWorksCost).toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 text-slate-400 text-xs">
                {selectedPart ? 'Este número de parte está marcado como "No Factible" comercial.' : 'Selecciona un número de parte para previsualizar.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* The Heavy analytical step sequence breakdown representational module matching slide 3 */}
      {selectedPart && selectedPart.isFeasible !== false && selectedPartCalc && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6" id="analytical-quote-breakdown">
          <div className="border-b border-gray-100 pb-3 flex justify-between items-center flex-wrap gap-2">
            <div className="space-y-1">
              <span className="text-xs font-extrabold text-indigo-600 tracking-wider uppercase block">Simulación Industrial Avanzada</span>
              <h3 className="text-base font-bold text-gray-900">Estructura de Costeo de Procesamiento (Paso a Paso)</h3>
            </div>
            <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-wider">
              No. de parte: {selectedPart.partNumber}
            </span>
          </div>

          {/* Table from slide 3: Processing (Direct Labor and Machine) */}
          <div className="space-y-3">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-widest block bg-slate-100/70 p-1.5 px-3 rounded">
              Processing (Direct Labor and Machine)
            </span>
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="w-full text-left border-collapse text-xs font-medium" id="breakdown-process-table">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider border-b border-slate-900">
                    <th className="py-2.5 px-3 border-r border-slate-700">Part Number</th>
                    <th className="py-2.5 px-3 border-r border-slate-700">Process Steps</th>
                    <th className="py-2.5 px-3 border-r border-slate-700 text-center">Sequence</th>
                    <th className="py-2.5 px-3 border-r border-slate-700">Press / Tonnage</th>
                    <th className="py-2.5 px-3 border-r border-slate-700 text-center leading-tight">Total Stokes<br/>(No. Tools)</th>
                    <th className="py-2.5 px-3 border-r border-slate-700 text-right">Output/Hr</th>
                    <th className="py-2.5 px-3 border-r border-slate-700 text-right">Cycle Time (min)</th>
                    <th className="py-2.5 px-3 border-r border-slate-700 text-right">Labor $/Hour</th>
                    <th className="py-2.5 px-3 border-r border-slate-700 text-right">Total Cost ($)</th>
                    <th className="py-2.5 px-3 border-r border-slate-700 text-right leading-tight">Machine Rate<br/>(usd/hr)</th>
                    <th className="py-2.5 px-3 text-right">Machine Cost ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedPartCalc.steps.map((stepRes, idx) => {
                    const machineName = machines.find(m => m.id === stepRes.step.machineId)?.name || 'Manual';
                    return (
                      <tr key={stepRes.step.id} className="hover:bg-slate-50/70">
                        {idx === 0 ? (
                          <td className="py-3 px-3 border-r border-gray-100 font-bold bg-slate-50/50 text-gray-900" rowSpan={selectedPartCalc.steps.length}>
                            {selectedPart.partNumber}
                          </td>
                        ) : null}
                        <td className="py-3 px-3 border-r border-gray-100 text-slate-800">{stepRes.step.stepName}</td>
                        <td className="py-3 px-3 border-r border-gray-100 text-center font-mono text-gray-500 font-semibold">{stepRes.step.sequence}</td>
                        <td className="py-3 px-3 border-r border-gray-100 font-semibold text-slate-700">{machineName}</td>
                        <td className="py-3 px-3 border-r border-gray-100 text-center font-mono">1</td>
                        <td className="py-3 px-3 border-r border-gray-100 text-right font-mono text-slate-600">{stepRes.step.outputPerHour}</td>
                        <td className="py-3 px-3 border-r border-gray-100 text-right font-mono text-indigo-700 font-bold">{stepRes.cycleTimeMin.toFixed(2)}</td>
                        <td className="py-3 px-3 border-r border-gray-100 text-right font-mono text-gray-600">${stepRes.laborHourlyCost.toFixed(2)}</td>
                        <td className="py-3 px-3 border-r border-gray-100 text-right font-mono text-gray-900 font-bold">${stepRes.laborCostPerPiece.toFixed(2)}</td>
                        <td className="py-3 px-3 border-r border-gray-100 text-right font-mono text-slate-600">
                          {stepRes.machineAppliedRate > 0 ? `$${stepRes.machineAppliedRate.toFixed(2)}` : '$0.00'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-indigo-700 font-bold">
                          ${stepRes.machineCostPerPiece.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals summation line from slide 3 */}
                  <tr className="bg-slate-50 font-bold border-t border-gray-200">
                    <td className="py-2.5 px-3" colSpan={2}>Processing Total</td>
                    <td className="py-2.5 px-3 text-center">-</td>
                    <td className="py-2.5 px-3" colSpan={5}>Sum of processing steps</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-black">
                      ${selectedPartCalc.directLaborTotal.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right">-</td>
                    <td className="py-2.5 px-3 text-right font-mono text-indigo-700 font-black">
                      ${selectedPartCalc.machineCostTotal.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid of Calculations matching bottom half of Slide 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3">
            {/* Table: Overhead Burden Subtotal */}
            <div className="space-y-3">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-widest block bg-slate-100/70 p-1.5 px-3 rounded">
                Overhead / Burden / Subtotal
              </span>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs font-semibold">
                  <tbody className="divide-y divide-gray-100 text-slate-700 font-medium">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Purchased Components</td>
                      <td className="py-2.5 px-3 text-right font-mono">${selectedPartCalc.purchasedComponents.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Raw Material</td>
                      <td className="py-2.5 px-3 text-right font-mono">${selectedPartCalc.rawMaterial.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-gray-500 font-normal">Material Burden</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">0.00%</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Labor Cost (Sum)</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">${selectedPartCalc.directLaborTotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Machine Cost (Sum)</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">${selectedPartCalc.machineCostTotal.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-amber-50/20">
                      <td className="py-2.5 px-3 font-semibold text-amber-950">Manufacturing Burden</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-900 font-bold">
                        ${selectedPartCalc.manufacturingBurden.toFixed(2)} <span className="font-normal text-[10px] text-amber-600">({genParams.manufacturingBurdenPercentage.toFixed(1)}%)</span>
                      </td>
                    </tr>
                    <tr className="bg-slate-900 text-white font-extrabold">
                      <td className="py-2.5 px-3 uppercase tracking-wider">Manufacturing Subtotal</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400">${selectedPartCalc.manufacturingSubtotal.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table: SGA and Profit: Labor Only / Administrative parameters */}
            <div className="space-y-3">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-widest block bg-slate-100/70 p-1.5 px-3 rounded">
                SGA and Profit Calculations
              </span>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs font-semibold">
                  <tbody className="divide-y divide-gray-100 text-slate-700 font-medium">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Manufacturing Subtotal</td>
                      <td className="py-2.5 px-3 text-right font-mono">${selectedPartCalc.manufacturingSubtotal.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-indigo-50/20">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">General, Administration (G&A)</td>
                      <td className="py-2.5 px-3 text-right font-mono text-indigo-700 font-bold">
                        ${selectedPartCalc.generalAdmin.toFixed(2)} <span className="font-normal text-[10px] text-indigo-500">({genParams.generalAdminPercentage.toFixed(1)}%)</span>
                      </td>
                    </tr>
                    <tr className="bg-indigo-50/20">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Sales Expense</td>
                      <td className="py-2.5 px-3 text-right font-mono text-indigo-700 font-bold">
                        ${selectedPartCalc.sales.toFixed(2)} <span className="font-normal text-[10px] text-indigo-500">({genParams.salesPercentage.toFixed(1)}%)</span>
                      </td>
                    </tr>
                    <tr className="bg-emerald-50/30">
                      <td className="py-2.5 px-3 font-semibold text-emerald-950">Target Profit Margin</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800 font-bold">
                        ${selectedPartCalc.profit.toFixed(2)} <span className="font-normal text-[10px] text-emerald-600">({genParams.profitPercentage.toFixed(1)}% on Sub+G&A)</span>
                      </td>
                    </tr>
                    {selectedPart && selectedPart.targetPrice !== undefined && selectedPart.targetPrice !== null && (
                      (() => {
                        const originalPrice = selectedPartCalc.exWorksCost;
                        const negotiatedPrice = selectedPart.targetPrice;
                        const diffVal = originalPrice - negotiatedPrice;
                        const diffPercent = (diffVal / originalPrice) * 105; // Wait, actually standard percentage: (diffVal / originalPrice) * 100
                        const actualPercent = (diffVal / originalPrice) * 100;
                        const isDiscount = diffVal >= 0;

                        return (
                          <tr className={isDiscount ? "bg-emerald-100/50" : "bg-rose-100/50"}>
                            <td className="py-2.5 px-3 font-bold text-slate-800 flex flex-col">
                              <span>{isDiscount ? "Descuento por negociación" : "Ajuste por negociación"}</span>
                              <span className="text-[10px] font-medium text-slate-500 font-sans">
                                {isDiscount ? "Descuento real sobre costo base" : "Incremento por negociación"}
                              </span>
                            </td>
                            <td className={`py-2.5 px-3 text-right font-mono font-black ${isDiscount ? "text-emerald-700" : "text-rose-700"}`} style={{ fontSize: '11px' }}>
                              {isDiscount ? '-' : '+'}${Math.abs(diffVal).toFixed(2)} <span className="text-[10px] font-semibold tracking-normal font-sans">({isDiscount ? '' : '+'}{(-actualPercent).toFixed(1)}%)</span>
                            </td>
                          </tr>
                        );
                      })()
                    )}
                    {/* ExWorks highlighting matching YELLOW cell 63 inside third screenshot */}
                    <tr className="bg-yellow-100 font-black border-2 border-yellow-400 text-slate-900 text-sm">
                      <td className="py-3.5 px-3 uppercase text-[11px] tracking-wider font-extrabold flex items-center gap-1">
                        <Coins className="w-4 h-4 text-amber-500" />
                        Metal Stamping ExWorks Cost
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-slate-950 text-base font-black">
                        ${(selectedPart && selectedPart.targetPrice !== undefined && selectedPart.targetPrice !== null ? selectedPart.targetPrice : selectedPartCalc.exWorksCost).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

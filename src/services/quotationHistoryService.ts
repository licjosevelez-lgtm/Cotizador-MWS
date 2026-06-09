import { PartNumber, Machine, VolumeParameters, GeneralParameters, calculatePartQuotation } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';

export interface QuotationHistoryItem {
  partNumber: string;
  description: string;
  unitPrice: number;
  volumeCategory?: string;     // "Alto", "Medio", "Bajo", "Factory"
  weeklyVolume?: number;
}

export interface QuotationHistoryEntry {
  id: string;                    // único autogenerado (ej. "qt-1234567890")
  quotationNumber: string;       // ej. "C-040626-0001"
  revision: string;              // "01", "02", etc.
  clientName: string;
  emissionDate: string;          // formato "dd/mmm/yyyy" o ISO
  items: QuotationHistoryItem[];
  fullDataSnapshot: {
    partNumbers: PartNumber[];
    machines: Machine[];
    volParams: VolumeParameters;
    genParams: GeneralParameters;
    selectedPartId?: string;
    selectedPartIds?: string[];
    customerName: string;
    quoteNumber: string;
    quoteDate: string;
    quoteNoMW?: string;          // No. de revisión (antes "PX No. MW")
  };
  createdAt: string;             // ISO timestamp
  isLatestRevision: boolean;     // true solo para la última revisión de cada quotationNumber
}

/**
 * Devuelve todos los registros del histórico ordenados por createdAt descendente.
 */
export function getHistory(): QuotationHistoryEntry[] {
  try {
    const saved = localStorage.getItem('quotations_history');
    if (saved) {
      const history: QuotationHistoryEntry[] = JSON.parse(saved);
      // Ordenar por createdAt descendente
      return history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (e) {
    console.error('Error al leer el histórico de cotizaciones:', e);
  }
  return [];
}

/**
 * Guarda un nuevo registro, actualiza isLatestRevision de revisiones anteriores del mismo número.
 */
export function saveToHistory(
  entryData: Omit<QuotationHistoryEntry, 'id' | 'createdAt' | 'isLatestRevision'>
): QuotationHistoryEntry {
  const history = getHistory();

  // Desactivar bandera isLatestRevision de versiones anteriores con el mismo quotationNumber
  const cleanedHistory = history.map((item) => {
    if (item.quotationNumber === entryData.quotationNumber) {
      return { ...item, isLatestRevision: false };
    }
    return item;
  });

  const newEntry: QuotationHistoryEntry = {
    ...entryData,
    id: `qt-${Math.random().toString(36).substring(2, 11)}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    isLatestRevision: true,
  };

  cleanedHistory.unshift(newEntry);
  localStorage.setItem('quotations_history', JSON.stringify(cleanedHistory));
  return newEntry;
}

/**
 * Devuelve todas las revisiones de un quotationNumber.
 */
export function getQuotationHistory(quotationNumber: string): QuotationHistoryEntry[] {
  const history = getHistory();
  return history.filter((item) => item.quotationNumber === quotationNumber);
}

/**
 * Devuelve el objeto de la última revisión de un quotationNumber.
 */
export function getLatestRevision(quotationNumber: string): QuotationHistoryEntry | undefined {
  const history = getHistory();
  return history.find((item) => item.quotationNumber === quotationNumber && item.isLatestRevision);
}

/**
 * Marca una revisión específica como la última y las demás del mismo número como falsas.
 */
export function updateLatestRevisionFlag(quotationNumber: string, newRevisionId: string): void {
  const history = getHistory();
  const updated = history.map((item) => {
    if (item.quotationNumber === quotationNumber) {
      return { ...item, isLatestRevision: item.id === newRevisionId };
    }
    return item;
  });
  localStorage.setItem('quotations_history', JSON.stringify(updated));
}

/**
 * Compila y genera el archivo PDF para una cotización dada usando un contenedor temporal offline
 * para evitar cualquier colisión con el estado activo de la interfaz o fallas con los colores OKLCH.
 */
export async function downloadQuotationPDF(
  snapshot: QuotationHistoryEntry['fullDataSnapshot'],
  targetQuotationNumber: string,
  targetRevision: string
): Promise<void> {
  const {
    customerName,
    quoteDate,
    partNumbers,
    machines,
    volParams,
    genParams,
    selectedPartId,
    selectedPartIds,
  } = snapshot;

  Swal.fire({
    title: 'Generando PDF...',
    text: 'Compilando formato oficial de cotización de manera segura.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  try {
    const displayedParts = selectedPartIds && selectedPartIds.length > 0
      ? partNumbers.filter((p) => selectedPartIds.includes(p.id))
      : partNumbers;

    // Generar las filas de la tabla con los precios precalculados y estilos inline
    const tableRowsHTML = displayedParts.map((part) => {
      const isTarget = selectedPartId ? part.id === selectedPartId : true;
      const results = calculatePartQuotation(part, machines, volParams, genParams);

      const displayVol = part.weeklyVolume
        ? part.weeklyVolume.toLocaleString()
        : part.volumeCategory === 'Alto' ? '16,000'
        : part.volumeCategory === 'Medio' ? '8,000'
        : '1,500';

      const priceValue = part.targetPrice !== undefined && part.targetPrice !== null
        ? part.targetPrice
        : results.exWorksCost;

      const priceText = part.isFeasible !== false
        ? `$${priceValue.toFixed(2)}`
        : 'No factible';

      const priceCell = part.isFeasible !== false
        ? `<span style="font-family: monospace; font-size: 11px; font-weight: bold;">${priceText}</span>`
        : `<span style="color: #b91c1c; font-size: 10px; font-weight: bold; text-transform: uppercase;">No factible</span>`;

      const unitText = part.isFeasible !== false ? 'USD' : '-';

      return `
        <tr style="border-bottom: 2px solid #000000; text-align: center; ${!isTarget && selectedPartId ? 'opacity: 0.3;' : ''}">
          <td style="padding: 10px 8px; border-right: 2px solid #000000; font-family: monospace; font-size: 10px;">${displayVol}</td>
          <td style="padding: 10px 8px; border-right: 2px solid #000000; font-weight: bold; font-family: sans-serif; font-size: 11px;">${part.partNumber}</td>
          <td style="padding: 0; border-right: 2px solid #000000; background-color: #f8fafc; width: 4px;"></td>
          <td style="padding: 10px 8px; border-right: 2px solid #000000; text-align: left; font-size: 10px;">${part.description || 'Procesado'}</td>
          <td style="padding: 10px 8px; border-right: 2px solid #000000; font-family: monospace; font-size: 9px;">${part.engineeringLevel || 'AA'}</td>
          <td style="padding: 10px 8px; border-right: 2px solid #000000; font-family: monospace; font-size: 9px;">${part.toolingUsd || 'N/A'}</td>
          <td style="padding: 10px 8px; border-right: 2px solid #000000; text-align: center;">${priceCell}</td>
          <td style="padding: 10px 8px; font-weight: bold; font-family: monospace; font-size: 9px; color: #475569;">${unitText}</td>
        </tr>
      `;
    }).join('');

    // Crear elemento contenedor invisible en el DOM
    const clonedElement = document.createElement('div');
    clonedElement.style.position = 'absolute';
    clonedElement.style.left = '-9999px';
    clonedElement.style.top = '-9999px';
    clonedElement.style.width = '800px';
    clonedElement.style.backgroundColor = '#ffffff';
    clonedElement.style.padding = '24px';
    clonedElement.style.fontFamily = '"Inter", system-ui, sans-serif';
    clonedElement.style.color = '#1e293b';

    clonedElement.innerHTML = `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 20px;">
        <!-- Banner header with logo -->
        <div style="display: flex; align-items: center; justify-content: space-between; background-color: #5B9BD5; color: #ffffff; padding: 12px; border: 2px solid #000000; margin-bottom: 0; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background-color: #0f172a; color: #ffffff; padding: 6px 12px; border-radius: 4px; border: 1px solid #334155; display: flex; flex-direction: column; justify-content: center; align-items: center; user-select: none;">
              <span style="font-size: 10px; font-weight: 900; letter-spacing: 0.05em; line-height: 1; font-family: sans-serif;">METALWORK</span>
              <span style="font-size: 6px; font-weight: bold; letter-spacing: 0.2em; color: #93c5fd; line-height: 1; margin-top: 2px; text-transform: uppercase;">& STAMPING</span>
            </div>
            <div style="text-align: left;">
              <h1 style="font-size: 16px; font-weight: 800; margin: 0; letter-spacing: 0.05em; font-family: sans-serif; line-height: 1.2;">METALWORK & STAMPING, S.A. de C.V.</h1>
            </div>
          </div>
          <div style="text-align: right;">
            <h2 style="font-size: 16px; font-weight: 900; margin: 0; letter-spacing: 0.1em; text-transform: uppercase; color: #ffffff; line-height: 1.2;">QUOTATION</h2>
          </div>
        </div>

        <!-- Commercial details block -->
        <div style="display: grid; grid-template-columns: repeat(12, 1fr); border-left: 2px solid #000000; border-right: 2px solid #000000; border-bottom: 2px solid #000000; background-color: #ffffff; margin-bottom: 0;">
          <div style="grid-column: span 8; padding: 12px; border-right: 2px solid #000000; display: flex; flex-direction: column; justify-content: center;">
            <span style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; display: block; tracking: 0.05em; margin-bottom: 2px;">CUSTOMER</span>
            <span style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${customerName}</span>
          </div>

          <div style="grid-column: span 4; display: grid; grid-template-rows: repeat(3, 1fr); font-size: 11px;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); border-bottom: 1px solid #000000; align-items: center; justify-items: center;">
              <span style="background-color: #f8fafc; padding: 4px; font-weight: bold; border-right: 1px solid #000000; width: 100%; text-align: center; font-size: 9px;">NUMERO</span>
              <span style="padding: 4px; text-align: center; font-family: monospace; font-weight: bold; width: 100%;">${targetQuotationNumber}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); border-bottom: 1px solid #000000; align-items: center; justify-items: center;">
              <span style="background-color: #f8fafc; padding: 4px; font-weight: bold; border-right: 1px solid #000000; width: 100%; text-align: center; font-size: 8px; text-transform: uppercase;">Dia Mes Año</span>
              <span style="padding: 4px; text-align: center; font-family: monospace; width: 100%;">${quoteDate}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(12, 1fr); align-items: center; justify-items: center;">
              <span style="grid-column: span 3; background-color: #f8fafc; padding: 4px; font-weight: bold; border-right: 1px solid #000000; width: 100%; text-align: center; font-size: 8px;">REV</span>
              <span style="grid-column: span 9; padding: 4px; text-align: center; font-family: monospace; font-size: 10px; font-weight: bold; width: 100%;">${targetRevision}</span>
            </div>
          </div>
        </div>

        <!-- Secondary intro line -->
        <div style="background-color: #BDD7EE; border-left: 2px solid #000000; border-right: 2px solid #000000; border-bottom: 2px solid #000000; padding: 6px; text-align: center; font-size: 9px; font-weight: bold; text-transform: uppercase; color: #1e293b;">
          NOS PERMITIMOS COTIZAR LO SIGUIENTE:
        </div>

        <!-- Sheet Table Grid -->
        <div style="border-left: 2px solid #000000; border-right: 2px solid #000000; border-bottom: 2px solid #000000; background-color: #ffffff;">
          <table style="width: 100%; text-align: left; border-collapse: collapse; font-family: sans-serif;">
            <thead>
              <tr style="background-color: #BDD7EE; border-bottom: 2px solid #000000; font-weight: bold; text-align: center; font-size: 9px;">
                <th style="padding: 6px; border-right: 2px solid #000000; width: 15%;">Volumen</th>
                <th style="padding: 6px; border-right: 2px solid #000000; width: 15%;">PART NUMBER</th>
                <th style="padding: 0; border-right: 2px solid #000000; width: 4px;"></th>
                <th style="padding: 6px; border-right: 2px solid #000000; width: 35%;">DESCRIPTION</th>
                <th style="padding: 6px; border-right: 2px solid #000000; width: 10%;">Nivel de Ing.</th>
                <th style="padding: 6px; border-right: 2px solid #000000; width: 12%;">TOOLING Usd</th>
                <th style="padding: 6px; border-right: 2px solid #000000; width: 18%;">UNIT PRICE</th>
                <th style="padding: 6px; width: 10%;">Unit.</th>
              </tr>
            </thead>
            <tbody style="font-weight: 500;">
              ${tableRowsHTML}
            </tbody>
          </table>
        </div>

        <!-- Conditions Notes Block -->
        <div style="margin-top: 24px; border: 2px solid #000000; padding: 12px; background-color: #f8fafc; border-radius: 2px;">
          <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #000000;">Condiciones Comerciales</span>
          </div>
          <ul style="list-style-type: disc; padding-left: 16px; margin: 0; font-size: 9px; font-weight: bold; color: #334155; line-height: 1.4;">
            <li style="margin-bottom: 4px;">THIS PRICE IS USD DOLLARS</li>
            <li style="margin-bottom: 4px;">PRICE DO NOT INCLUDED VALUE ADDED TAX (IVA)</li>
            <li style="margin-bottom: 4px;">FOB MW SALTILLO</li>
            <li style="margin-bottom: 4px;">QUOTATION BASED ON TECHNICAL INFORMATION PROVIDED BY ${customerName || 'FMX'}.</li>
            <li style="margin-bottom: 4px;">DO NOT INCLUDED OIL CLEAN</li>
            <li>Metalwork's general terms and conditions of sales apply.</li>
          </ul>
        </div>

        <!-- Signatures -->
        <div style="margin-top: 48px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px; text-align: center; font-size: 8px; font-weight: bold; color: #64748b; text-transform: uppercase;">
          <div style="display: flex; flex-direction: column; justify-content: flex-end; min-height: 52px;">
            <div style="font-family: sans-serif; font-size: 11px; font-weight: bold; color: #000000; margin-bottom: 4px; text-transform: none;">Ing. Ulises Sanchez</div>
            <div style="border-bottom: 2px solid #000000; width: 80%; margin: 0 auto 6px auto;"></div>
            <div>FIRMA AUTORIZADA MW</div>
          </div>
          <div style="display: flex; flex-direction: column; justify-content: flex-end; min-height: 52px;">
            <div style="border-bottom: 2px solid #000000; width: 80%; margin: 0 auto 6px auto;"></div>
            <div>Aceptación y Firma de Cliente - ${customerName}</div>
          </div>
        </div>

        <!-- PDF Page Footer -->
        <div style="margin-top: 64px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: grid; grid-template-columns: repeat(3, 1fr); align-items: center; font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase; width: 100%;">
          <span style="text-align: left; font-family: monospace;">F-7.2-03  REV.01</span>
          <span style="text-align: center; white-space: nowrap;">Metalwork & Stamping S.A. de C.V.</span>
          <span></span>
        </div>
      </div>
    </div>
    `;

    document.body.appendChild(clonedElement);

    // Permitir ciclo de pintura del navegador
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
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const margin = 10;
    const contentWidth = pdfWidth - (margin * 2);
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight, undefined, 'FAST');
    heightLeft -= (pdfHeight - margin * 2);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pdfHeight - margin * 2);
    }

    const safeClientName = customerName.trim().replace(/[^a-zA-Z0-9]/g, '_') || 'Cliente';
    pdf.save(`Cotizacion_${safeClientName}_${targetQuotationNumber}_Rev${targetRevision}.pdf`);

    Swal.fire({
      title: '¡Cotización generada exitosamente!',
      text: `PDF de la cotización ${targetQuotationNumber} Rev ${targetRevision} descargado con éxito.`,
      icon: 'success',
      confirmButtonColor: '#4f46e5',
    });
  } catch (err) {
    console.error('Error compiling quotation PDF:', err);
    Swal.fire({
      title: 'Error de generación',
      text: 'Ocurrió un error al compilar la cotización PDF.',
      icon: 'error',
      confirmButtonColor: '#4f46e5',
    });
  }
}

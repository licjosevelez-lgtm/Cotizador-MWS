import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';

// Robust OKLCH to standard RGB/RGBA converter
export function parseOklch(str: string): string {
  const match = str.match(/oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/i);
  if (!match) return 'rgb(120, 120, 120)';
  
  let L_val = match[1];
  let C_val = parseFloat(match[2]);
  let H_val = parseFloat(match[3]);
  let A_val = match[4];
  
  let L = L_val.endsWith('%') ? parseFloat(L_val) / 100 : parseFloat(L_val);
  let C = C_val;
  let H = (H_val * Math.PI) / 180; // convert to radians
  
  let alpha = 1;
  if (A_val) {
    alpha = A_val.endsWith('%') ? parseFloat(A_val) / 100 : parseFloat(A_val);
  }
  
  // OKLCH to OKLAB
  let lab_a = C * Math.cos(H);
  let lab_b = C * Math.sin(H);
  
  // OKLAB to LMS
  let l_ = L + 0.3963377774 * lab_a + 0.2158037573 * lab_b;
  let m_ = L - 0.1055613458 * lab_a - 0.0638541728 * lab_b;
  let s_ = L - 0.0894841775 * lab_a - 1.2914855480 * lab_b;
  
  let l = l_ * l_ * l_;
  let m = m_ * m_ * m_;
  let s = s_ * s_ * s_;
  
  // LMS to Linear RGB
  let r_lin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  
  // Helper for linear to sRGB
  const toSRGB = (c: number) => {
    return c >= 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
  };
  
  let r = Math.max(0, Math.min(255, Math.round(toSRGB(r_lin) * 255)));
  let g = Math.max(0, Math.min(255, Math.round(toSRGB(g_lin) * 255)));
  let b = Math.max(0, Math.min(255, Math.round(toSRGB(b_lin) * 255)));
  
  if (alpha < 1) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

// Robust OKLAB to standard RGB/RGBA converter
export function parseOklab(str: string): string {
  const match = str.match(/oklab\(\s*([0-9.]+%?)\s+([-0-9.]+)\s+([-0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/i);
  if (!match) return 'rgb(120, 120, 120)';
  
  let L_val = match[1];
  let parsed_a = parseFloat(match[2]);
  let parsed_b = parseFloat(match[3]);
  let A_val = match[4];
  
  let L = L_val.endsWith('%') ? parseFloat(L_val) / 100 : parseFloat(L_val);
  
  let alpha = 1;
  if (A_val) {
    alpha = A_val.endsWith('%') ? parseFloat(A_val) / 100 : parseFloat(A_val);
  }
  
  // OKLAB to LMS
  let l_ = L + 0.3963377774 * parsed_a + 0.2158037573 * parsed_b;
  let m_ = L - 0.1055613458 * parsed_a - 0.0638541728 * parsed_b;
  let s_ = L - 0.0894841775 * parsed_a - 1.2914855480 * parsed_b;
  
  let l = l_ * l_ * l_;
  let m = m_ * m_ * m_;
  let s = s_ * s_ * s_;
  
  // LMS to Linear RGB
  let r_lin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  
  const toSRGB = (c: number) => {
    return c >= 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
  };
  
  let r = Math.max(0, Math.min(255, Math.round(toSRGB(r_lin) * 255)));
  let g = Math.max(0, Math.min(255, Math.round(toSRGB(g_lin) * 255)));
  let b = Math.max(0, Math.min(255, Math.round(toSRGB(b_lin) * 255)));
  
  if (alpha < 1) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

// Replaces any occurence of oklch(...) or oklab(...) in a styles text string with fallback RGB
export function sanitizeOklchString(str: string): string {
  if (typeof str !== 'string') return str;
  let res = str;
  res = res.replace(/oklch\([^)]+\)/gi, (match) => {
    try {
      return parseOklch(match);
    } catch (e) {
      return 'rgb(120, 120, 120)';
    }
  });
  res = res.replace(/oklab\([^)]+\)/gi, (match) => {
    try {
      return parseOklab(match);
    } catch (e) {
      return 'rgb(120, 120, 120)';
    }
  });
  return res;
}

export const generateSafePDF = async (
  elementId: string,
  finalQuoteNumber: string,
  customerName: string,
  fileNamePrefix: string = 'Cotizacion'
) => {
  const originalElement = document.getElementById(elementId);
  if (!originalElement) {
    Swal.fire({
      title: 'Error',
      text: 'No se encontró el lienzo para generar el PDF.',
      icon: 'error',
      confirmButtonColor: '#4f46e5'
    });
    return;
  }

  // 1. Validate physical dimensions to prevent generation errors if the canvas is collapsed/hidden
  const rect = originalElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    Swal.fire({
      title: 'Error de visualización',
      text: 'El lienzo está oculto o tiene dimensiones cero.',
      icon: 'warning',
      confirmButtonColor: '#4f46e5'
    });
    return;
  }

  Swal.fire({
    title: 'Generando PDF Oficial...',
    text: 'Se está compilando el archivo de impresión en alta definición. Por favor, espere un momento.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  // Helper structure to restore modified styles afterwards
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

    // 2. Temporarily sanitize document style tag contents and external link stylesheets to prevent html2canvas color parsing crashes on raw "oklch" or "oklab"
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

    // Apply safe-colors class to document root to ensure all oklch variables resolve to robust HEX format
    document.documentElement.classList.add('safe-colors');

    // 3. Clone the quotation canvas element to apply temporary isolated classes
    const clonedElement = originalElement.cloneNode(true) as HTMLElement;
    
    // Apply the pdf-export class to force HEX colors instead of OKLCH values in Tailwind v4
    clonedElement.classList.add('pdf-export');
    
    // Position offscreen so the user does not experience rendering jumping, but guarantee explicit visible dimensions
    clonedElement.style.display = 'block';
    clonedElement.style.visibility = 'visible';
    clonedElement.style.opacity = '1';
    clonedElement.style.transform = 'none';
    clonedElement.style.position = 'absolute';
    clonedElement.style.left = '-9999px';
    clonedElement.style.top = '-9999px';
    clonedElement.style.width = '800px';
    clonedElement.style.minHeight = '1100px';
    clonedElement.style.height = 'auto';
    clonedElement.style.margin = '0px';
    clonedElement.style.padding = '20px';
    clonedElement.style.backgroundColor = '#ffffff';

    // Clear oklch / oklab functions from any inline style attributes on cloned element and descendants
    const allClonedDescendants = clonedElement.querySelectorAll('*');
    allClonedDescendants.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.style && htmlEl.style.cssText) {
        const css = htmlEl.style.cssText;
        if (css.toLowerCase().includes('oklch') || css.toLowerCase().includes('oklab')) {
          htmlEl.style.cssText = css
            .replace(/oklch\([^)]+\)/gi, 'rgb(120, 120, 120)')
            .replace(/oklab\([^)]+\)/gi, 'rgb(120, 120, 120)');
        }
      }
    });
    
    // 4. Inject a highly specific style tag inside the clone to guarantee exact local HEX colors are applied
    const inlineStyle = document.createElement('style');
    inlineStyle.innerHTML = `
      /* Forced high specificity local colors in hex for PDF renderer */
      .pdf-export {
        background-color: #ffffff !important;
        color: #1e293b !important;
      }
      .pdf-export .bg-white {
        background-color: #ffffff !important;
        background: #ffffff !important;
      }
      .pdf-export .bg-\\[\\#5B9BD5\\] {
        background-color: #5b9bd5 !important;
        background: #5b9bd5 !important;
        color: #ffffff !important;
      }
      .pdf-export .bg-\\[\\#BDD7EE\\] {
        background-color: #bdd7ee !important;
        background: #bdd7ee !important;
        color: #000000 !important;
      }
      .pdf-export .bg-slate-50\\/50,
      .pdf-export .bg-slate-50 {
        background-color: #f8fafc !important;
        background: #f8fafc !important;
      }
      .pdf-export .bg-slate-100 {
        background-color: #f1f5f9 !important;
      }
      .pdf-export .bg-emerald-50\\/20 {
        background-color: #f0fdf4 !important;
      }
      .pdf-export .border,
      .pdf-export .border-2,
      .pdf-export .border-x-2,
      .pdf-export .border-b-2,
      .pdf-export .border-r-2,
      .pdf-export .border-b,
      .pdf-export .border-r {
        border-color: #000000 !important;
      }
      .pdf-export .border-slate-200 {
        border-color: #cbd5e1 !important;
      }
      .pdf-export .border-slate-300 {
        border-color: #94a3b8 !important;
      }
      .pdf-export .border-slate-100 {
        border-color: #f1f5f9 !important;
      }
      .pdf-export .divide-black > * + * {
        border-color: #000000 !important;
      }
      /* Map classes to hex colors directly to avoid oklch computed color failures */
      .pdf-export .text-slate-800, .pdf-export .text-slate-900 { color: #1e293b !important; }
      .pdf-export .text-slate-700 { color: #334155 !important; }
      .pdf-export .text-slate-500 { color: #64748b !important; }
      .pdf-export .text-slate-400 { color: #94a3b8 !important; }
      .pdf-export .text-indigo-800 { color: #3730a3 !important; }
      .pdf-export .text-indigo-700 { color: #4338ca !important; }
      .pdf-export .text-indigo-950 { color: #1e1b4b !important; }
      .pdf-export .text-sky-700 { color: #0369a1 !important; }
      .pdf-export .text-emerald-700 { color: #047857 !important; }
    `;
    clonedElement.appendChild(inlineStyle);

    // Append cloned element to DOM body to allow html2canvas to fetch rules and compute style variables correctly
    document.body.appendChild(clonedElement);

    // 5. Wait for the browser block paint cycle to fully apply rules on the clone before rasterization
    await new Promise((resolve) => setTimeout(resolve, 350));

    let canvas;
    try {
      // Check physical dimensions of the cloned element in DOM
      const cloneRect = clonedElement.getBoundingClientRect();
      console.log('PDF Cloned Element Dimensions:', {
        width: cloneRect.width,
        height: cloneRect.height,
        left: clonedElement.style.left,
        top: clonedElement.style.top
      });

      if (cloneRect.height === 0) {
        console.warn('Warning: Cloned element height is 0. Attempting to force height style.');
        clonedElement.style.minHeight = '1100px';
      }

      // Capture cloned canvas element at high quality density
      canvas = await html2canvas(clonedElement, {
        scale: 2.2,
        useCORS: true,
        logging: true, // Turn on logging to find exact element problems
        backgroundColor: '#ffffff'
      });
    } catch (err) {
      console.error('html2canvas capture error:', err);
    } finally {
      // Restore original computed style implementation
      window.getComputedStyle = originalGetComputedStyle;

      // Remove temporary styles
      tempStylesAdded.forEach((style) => {
        if (style.parentNode) {
          style.parentNode.removeChild(style);
        }
      });

      // Restore links state
      linksToRestore.forEach(({ element, originalDisabled }) => {
        try {
          element.disabled = originalDisabled;
        } catch (e) {
          console.error('Error re-enabling link element:', e);
        }
      });

      // Restore original text for inline style tags
      stylesToRestore.forEach(({ element, originalText }) => {
        try {
          element.textContent = originalText;
          element.innerHTML = originalText;
        } catch (e) {
          console.error('Error restoring original stylesheet:', e);
        }
      });

      // Remove the cloned element immediately after rasterization to keep DOM clean
      if (clonedElement.parentNode) {
        clonedElement.parentNode.removeChild(clonedElement);
      }
      // Remove the safe-colors class to restore normal Tailwind active styles
      document.documentElement.classList.remove('safe-colors');
    }

    if (!canvas) {
      throw new Error('No se pudo generar el lienzo de imagen.');
    }

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Layout inside A4 grid matching margins
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

    // Safe filename configuration
    const safeClientName = customerName.trim().replace(/[^a-zA-Z0-9]/g, '_') || 'Cliente';
    pdf.save(`${fileNamePrefix}_${safeClientName}_${finalQuoteNumber}.pdf`);

    // Keep user notified
    Swal.fire({
      title: '¡PDF Generado con éxito!',
      text: `Se descargó la cotización oficial ${finalQuoteNumber}.`,
      icon: 'success',
      confirmButtonColor: '#4f46e5'
    });
    
  } catch (error) {
    console.error('Error compiling secure PDF file:', error);
    Swal.fire({
      title: 'Error de generación',
      text: 'Ocurrió un error al compilar el PDF de descarga directa: ' + (error instanceof Error ? error.message : String(error)),
      icon: 'error',
      confirmButtonColor: '#4f46e5'
    });
  }
};

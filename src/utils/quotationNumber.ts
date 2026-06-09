// Helper functions to manage the shared quotation number sequence sequence

export const getProspectiveQuoteNumber = (): string => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = String(today.getFullYear()).slice(-2);
  const dateKey = `${day}${month}${year}`;
  
  let sequenceMap: Record<string, number> = {};
  try {
    const saved = localStorage.getItem('quotation_sequence');
    if (saved) {
      sequenceMap = JSON.parse(saved);
    }
  } catch (e) {
    // Ignore error
  }
  const currentCount = sequenceMap[dateKey] || 0;
  const prospectiveCount = currentCount + 1;
  const padded = String(prospectiveCount).padStart(4, '0');
  return `C-${dateKey}-${padded}`;
};

export const generateQuotationNumber = (): string => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = String(today.getFullYear()).slice(-2);
  const dateKey = `${day}${month}${year}`;
  
  let sequenceMap: Record<string, number> = {};
  try {
    const saved = localStorage.getItem('quotation_sequence');
    if (saved) {
      sequenceMap = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse quotation_sequence:', e);
  }
  
  const currentCount = sequenceMap[dateKey] || 0;
  const nextCount = currentCount + 1;
  
  sequenceMap[dateKey] = nextCount;
  localStorage.setItem('quotation_sequence', JSON.stringify(sequenceMap));
  
  const paddedCount = String(nextCount).padStart(4, '0');
  return `C-${dateKey}-${paddedCount}`;
};

/**
 * Types and Calculations for the Industrial Quotation System
 */

export interface Machine {
  id: string;
  name: string;
  baseCost: number; // Base rate per hour in USD
}

export interface VolumeParameters {
  altoPercentage: number;     // e.g. 200%
  medioPercentage: number;    // e.g. 250%
  bajoPercentage: number;     // e.g. 300%
  factoryPercentage: number;  // e.g. 400%
}

export interface GeneralParameters {
  operatorHourlyCost: number;           // e.g. 15.00 USD
  manufacturingBurdenPercentage: number; // e.g. 3.5%
  generalAdminPercentage: number;       // e.g. 3.0%
  salesPercentage: number;              // e.g. 3.0%
  profitPercentage: number;             // e.g. 15.0%
}

export type VolumeCategory = 'Alto' | 'Medio' | 'Bajo' | 'Factory';

export interface PartNumberStep {
  id: string;
  stepName: string;      // e.g. "OP10", "OP20", "Inspección Final"
  sequence: number;      // e.g. 10, 20, 30
  machineId: string;     // Refers to Machine.id, or "none" / "manual"
  outputPerHour: number; // e.g. 400
  operatorsCount: number; // e.g. 6, 1
}

export interface PartNumber {
  id: string;
  partNumber: string;    // e.g. "181299"
  description: string;   // e.g. "Formado"
  client: string;        // e.g. "FMX"
  engineeringLevel: string; // e.g. "AA"
  toolingUsd: string;    // e.g. "N/A" or value
  volumeCategory: VolumeCategory;
  weeklyVolume?: number;  // e.g. 16000
  steps: PartNumberStep[];
  purchasedComponents: number; // USD per piece
  rawMaterial: number;         // USD per piece
  isFeasible?: boolean;        // Whether the part is feasible to quote (default simple true, if false displays 'No factible')
  targetPrice?: number;        // Target price captured or imported via Excel
}

export interface StepCalculationResult {
  step: PartNumberStep;
  cycleTimeMin: number;      // 60 / outputPerHour
  laborHourlyCost: number;   // operatorHourlyCost * operatorsCount
  laborCostPerPiece: number; // laborHourlyCost / outputPerHour
  machineBaseCost: number;   // machine hourly base rate if set
  machineAppliedRate: number; // machineBaseCost * multiplier
  machineCostPerPiece: number; // cycleTimeMin * machineAppliedRate
}

export interface CalculationResult {
  partId: string;
  partNumber: string;
  description: string;
  client: string;
  volumeCategory: VolumeCategory;
  
  steps: StepCalculationResult[];
  
  directLaborTotal: number;       // Sum of laborCostPerPiece
  machineCostTotal: number;       // Sum of machineCostPerPiece
  rawMaterial: number;
  purchasedComponents: number;
  
  sumLaborMachine: number;        // directLaborTotal + machineCostTotal
  manufacturingBurden: number;    // sumLaborMachine * burden%
  manufacturingSubtotal: number;  // directLaborTotal + machineCostTotal + burden + rawMaterial + purchasedComponents
  
  generalAdmin: number;           // manufacturingSubtotal * GA%
  sales: number;                  // manufacturingSubtotal * sales%
  profit: number;                 // (manufacturingSubtotal + generalAdmin) * profit%
  
  exWorksCost: number;            // manufacturingSubtotal + generalAdmin + sales + profit
}

/**
 * Gets the machine multiplier representation based on the selected volume category
 */
export function getVolumeMultiplier(category: VolumeCategory, params: VolumeParameters): number {
  switch (category) {
    case 'Alto':
      return params.altoPercentage / 100;
    case 'Medio':
      return params.medioPercentage / 100;
    case 'Bajo':
      return params.bajoPercentage / 100;
    case 'Factory':
      return params.factoryPercentage / 100;
    default:
      return 1.0;
  }
}

/**
 * Perform all industrial quoting algebra calculations for a PartNumber
 */
export function calculatePartQuotation(
  part: PartNumber,
  machines: Machine[],
  volParams: VolumeParameters,
  genParams: GeneralParameters
): CalculationResult {
  const multiplier = getVolumeMultiplier(part.volumeCategory, volParams);
  
  const stepsResults: StepCalculationResult[] = part.steps.map(step => {
    const cycleTimeMin = step.outputPerHour > 0 ? 60 / step.outputPerHour : 0;
    const laborHourlyCost = step.operatorsCount * genParams.operatorHourlyCost;
    const laborCostPerPiece = step.outputPerHour > 0 ? laborHourlyCost / step.outputPerHour : 0;
    
    let machineBaseCost = 0;
    let machineAppliedRate = 0;
    let machineCostPerPiece = 0;
    
    if (step.machineId && step.machineId !== 'none' && step.machineId !== 'manual') {
      const machine = machines.find(m => m.id === step.machineId);
      if (machine) {
        machineBaseCost = machine.baseCost;
        machineAppliedRate = machineBaseCost * multiplier;
        // Calculation matching actual Excel formula behavior:
        // MachineCostPerPiece = Cycle Time (minutes) * Hourly Rate
        machineCostPerPiece = cycleTimeMin * machineAppliedRate;
      }
    }
    
    return {
      step,
      cycleTimeMin,
      laborHourlyCost,
      laborCostPerPiece,
      machineBaseCost,
      machineAppliedRate,
      machineCostPerPiece
    };
  });
  
  const directLaborTotal = stepsResults.reduce((acc, curr) => acc + curr.laborCostPerPiece, 0);
  const machineCostTotal = stepsResults.reduce((acc, curr) => acc + curr.machineCostPerPiece, 0);
  
  const rawMaterial = part.rawMaterial || 0;
  const purchasedComponents = part.purchasedComponents || 0;
  
  const sumLaborMachine = directLaborTotal + machineCostTotal;
  const manufacturingBurden = sumLaborMachine * (genParams.manufacturingBurdenPercentage / 100);
  const manufacturingSubtotal = sumLaborMachine + manufacturingBurden + rawMaterial + purchasedComponents;
  
  const generalAdmin = manufacturingSubtotal * (genParams.generalAdminPercentage / 100);
  const sales = manufacturingSubtotal * (genParams.salesPercentage / 100);
  const profit = (manufacturingSubtotal + generalAdmin) * (genParams.profitPercentage / 100);
  
  const exWorksCost = manufacturingSubtotal + generalAdmin + sales + profit;
  
  return {
    partId: part.id,
    partNumber: part.partNumber,
    description: part.description,
    client: part.client,
    volumeCategory: part.volumeCategory,
    steps: stepsResults,
    directLaborTotal,
    machineCostTotal,
    rawMaterial,
    purchasedComponents,
    sumLaborMachine,
    manufacturingBurden,
    manufacturingSubtotal,
    generalAdmin,
    sales,
    profit,
    exWorksCost
  };
}


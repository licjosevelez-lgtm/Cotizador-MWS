import { Machine, VolumeParameters, GeneralParameters, PartNumber } from '../types';

export const INITIAL_MACHINES: Machine[] = [];

export const INITIAL_VOLUME_PARAMETERS: VolumeParameters = {
  altoPercentage: 200,
  medioPercentage: 250,
  bajoPercentage: 300,
  factoryPercentage: 400
};

export const INITIAL_GENERAL_PARAMETERS: GeneralParameters = {
  operatorHourlyCost: 15.00,
  manufacturingBurdenPercentage: 3.5,
  generalAdminPercentage: 3.0,
  salesPercentage: 3.0,
  profitPercentage: 15.0
};

export const INITIAL_PART_NUMBERS: PartNumber[] = [];

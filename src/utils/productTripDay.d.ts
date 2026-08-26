import type { PublicVariant } from '../types/publicCatalog';

export interface TripDayResolutionInput {
  variants?: PublicVariant[];
  day?: number;
  selectedVariant?: PublicVariant | null;
  selectedDataLimit?: string | null;
  selectedDataPolicy?: PublicVariant['dataPolicy'];
}

export declare const resolveVariantForTripDay: (
  input?: TripDayResolutionInput,
) => PublicVariant | null;

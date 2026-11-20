/** Client-side counterpart to the shared expense RPC's travel-date guard. */
export function travelDateValidationMessage(startDate?: string, endDate?: string): string | null {
  if (!startDate?.trim()) return "Choose a travel start date.";
  if (!endDate?.trim()) return "Choose a travel end date.";

  const validIsoDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parts = value.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  };

  if (!validIsoDate(startDate)) return "Choose a valid travel start date.";
  if (!validIsoDate(endDate)) return "Choose a valid travel end date.";
  if (endDate < startDate) return "Travel end date must be on or after the start date.";
  return null;
}

export type TravelAllowanceBand = {
  id: string;
  hotelMetro: number;
  hotelOther: number;
  mealsPerDay: number;
  localPerDay: number;
};

export type TravelEstimateInput = {
  band: TravelAllowanceBand;
  cityTier: "metro" | "other";
  advancePercent: number;
  amount: number;
  transportEstimate: number;
  hotelRate: number;
  hotelNights: number;
  mealRate: number;
  mealDays: number;
  localRate: number;
  localDays: number;
  tripDays: number;
};

export type TravelEstimate = {
  estimate: number;
  advanceCap: number;
  overHotelCap: boolean;
  overMealCap: boolean;
  overLocalCap: boolean;
  overAdvanceCap: boolean;
  requiresException: boolean;
};

/** Client preview for the server-authoritative active travel-policy calculation. */
export function evaluateTravelEstimate(input: TravelEstimateInput): TravelEstimate | null {
  const nonNegative = [input.amount, input.transportEstimate, input.hotelRate, input.hotelNights,
    input.mealRate, input.mealDays, input.localRate, input.localDays];
  if (nonNegative.some(value => !Number.isFinite(value) || value < 0) ||
      !Number.isInteger(input.hotelNights) || !Number.isInteger(input.mealDays) ||
      !Number.isInteger(input.localDays) || !Number.isInteger(input.tripDays) || input.tripDays < 1 ||
      input.hotelNights > input.tripDays || input.mealDays > input.tripDays || input.localDays > input.tripDays ||
      !Number.isFinite(input.advancePercent) || input.advancePercent < 0 || input.advancePercent > 100) return null;

  const hotelCap = input.cityTier === "metro" ? input.band.hotelMetro : input.band.hotelOther;
  const estimate = input.transportEstimate + input.hotelRate * input.hotelNights +
    input.mealRate * input.mealDays + input.localRate * input.localDays;
  const advanceCap = Math.floor(estimate * input.advancePercent / 100);
  const overHotelCap = input.hotelNights > 0 && input.hotelRate > hotelCap;
  const overMealCap = input.mealDays > 0 && input.mealRate > input.band.mealsPerDay;
  const overLocalCap = input.localDays > 0 && input.localRate > input.band.localPerDay;
  const overAdvanceCap = input.amount > advanceCap;
  return {
    estimate,
    advanceCap,
    overHotelCap,
    overMealCap,
    overLocalCap,
    overAdvanceCap,
    requiresException: overHotelCap || overMealCap || overLocalCap || overAdvanceCap,
  };
}

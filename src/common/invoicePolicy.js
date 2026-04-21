export const GLOBAL_INVOICE_SPLIT = Object.freeze({
  internetPercent: 25,
  platformPercent: 75
});

export function splitPlanTaxableAmount(planTaxableAmount) {
  const safeAmount = Number(planTaxableAmount || 0);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    return {
      internetAmount: 0,
      platformAmount: 0
    };
  }
  const internetAmount = Number((safeAmount * (GLOBAL_INVOICE_SPLIT.internetPercent / 100)).toFixed(2));
  const platformAmount = Number((safeAmount - internetAmount).toFixed(2));
  return {
    internetAmount,
    platformAmount
  };
}

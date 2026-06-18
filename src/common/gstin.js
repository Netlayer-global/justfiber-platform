/**
 * GSTIN utilities.
 *
 * GSTIN format (15 chars): SS PPPPPPPPPP E Z C
 *  - SS  : 2-digit numeric state code
 *  - PPP : 10-char PAN (5 letters + 4 digits + 1 letter)
 *  - E   : 1 alphanumeric entity/registration count code
 *  - Z   : fixed letter "Z" (default; rare exceptions exist but Z is standard)
 *  - C   : 1 alphanumeric checksum
 */

// Numeric GST state code -> 2-letter internal state code used by the billing engine.
export const GST_NUMERIC_STATE_CODE = {
  "01": "JK", // Jammu & Kashmir
  "02": "HP", // Himachal Pradesh
  "03": "PB", // Punjab
  "04": "CH", // Chandigarh
  "05": "UK", // Uttarakhand
  "06": "HR", // Haryana
  "07": "DL", // Delhi
  "08": "RJ", // Rajasthan
  "09": "UP", // Uttar Pradesh
  "10": "BR", // Bihar
  "11": "", // Sikkim (not in engine map)
  "12": "AR", // Arunachal Pradesh
  "13": "", // Nagaland
  "14": "", // Manipur
  "15": "", // Mizoram
  "16": "", // Tripura
  "17": "", // Meghalaya
  "18": "AS", // Assam
  "19": "WB", // West Bengal
  "20": "JH", // Jharkhand
  "21": "OD", // Odisha
  "22": "CG", // Chhattisgarh
  "23": "MP", // Madhya Pradesh
  "24": "GJ", // Gujarat
  "25": "DD", // Daman & Diu
  "26": "DD", // Dadra & Nagar Haveli and Daman & Diu (merged)
  "27": "MH", // Maharashtra
  "29": "KA", // Karnataka
  "30": "", // Goa
  "32": "KL", // Kerala
  "33": "TN", // Tamil Nadu
  "36": "TS", // Telangana
  "37": "AP" // Andhra Pradesh
};

// 2-letter internal state code -> numeric GST state code (reverse map, first match wins).
export const INTERNAL_TO_GST_NUMERIC = Object.entries(GST_NUMERIC_STATE_CODE).reduce(
  (acc, [numeric, internal]) => {
    if (internal && !acc[internal]) acc[internal] = numeric;
    return acc;
  },
  {}
);

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Validates a GSTIN string against the standard 15-character format.
 * Returns { valid: boolean, error?: string, stateCode?: string }.
 */
export function validateGstin(value) {
  const gstin = String(value || "").trim().toUpperCase();
  if (!gstin) {
    return { valid: false, error: "GSTIN is required" };
  }
  if (gstin.length !== 15) {
    return { valid: false, error: "GSTIN must be exactly 15 characters" };
  }
  if (!GSTIN_REGEX.test(gstin)) {
    return { valid: false, error: "GSTIN format is invalid" };
  }
  const numericState = gstin.slice(0, 2);
  const internalStateCode = GST_NUMERIC_STATE_CODE[numericState];
  if (internalStateCode === undefined) {
    return { valid: false, error: `Unknown GST state code: ${numericState}` };
  }
  return { valid: true, stateCode: internalStateCode, numericStateCode: numericState };
}

/**
 * Returns the internal 2-letter state code embedded in a GSTIN's first 2 digits,
 * or "" if it cannot be resolved.
 */
export function stateCodeFromGstin(value) {
  const result = validateGstin(value);
  return result.valid ? result.stateCode : "";
}

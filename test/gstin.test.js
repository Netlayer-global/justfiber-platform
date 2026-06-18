import test from "node:test";
import assert from "node:assert/strict";

const { validateGstin, stateCodeFromGstin, GST_NUMERIC_STATE_CODE } = await import(
  "../src/common/gstin.js"
);

test("validateGstin accepts a well-formed UP GSTIN and resolves state", () => {
  // 09 = Uttar Pradesh
  const result = validateGstin("09AAACH7409R1ZZ");
  assert.equal(result.valid, true);
  assert.equal(result.stateCode, "UP");
  assert.equal(result.numericStateCode, "09");
});

test("validateGstin accepts a Maharashtra GSTIN (27 -> MH)", () => {
  const result = validateGstin("27AAPFU0939F1ZV");
  assert.equal(result.valid, true);
  assert.equal(result.stateCode, "MH");
});

test("validateGstin rejects wrong length", () => {
  const result = validateGstin("09AAACH7409R1Z");
  assert.equal(result.valid, false);
  assert.match(result.error, /15 characters/);
});

test("validateGstin rejects malformed pattern", () => {
  const result = validateGstin("0000000000000ZZ");
  assert.equal(result.valid, false);
  assert.match(result.error, /format is invalid/);
});

test("validateGstin rejects empty input", () => {
  const result = validateGstin("");
  assert.equal(result.valid, false);
  assert.match(result.error, /required/);
});

test("stateCodeFromGstin returns internal code or empty", () => {
  assert.equal(stateCodeFromGstin("09AAACH7409R1ZZ"), "UP");
  assert.equal(stateCodeFromGstin("invalid"), "");
});

test("GST_NUMERIC_STATE_CODE maps known numeric codes correctly", () => {
  assert.equal(GST_NUMERIC_STATE_CODE["07"], "DL");
  assert.equal(GST_NUMERIC_STATE_CODE["27"], "MH");
  assert.equal(GST_NUMERIC_STATE_CODE["33"], "TN");
});

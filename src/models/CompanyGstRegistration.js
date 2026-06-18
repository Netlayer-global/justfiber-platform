import mongoose from "mongoose";

/**
 * CompanyGstRegistration
 *
 * Models TRUE multi-GSTIN: a company legally registered for GST in multiple
 * states, each with its own GSTIN, legal trade name and registered address.
 * The billing engine selects the registration matching the *service-providing
 * state* (the zone's state) when generating an invoice.
 *
 * This is an ADDITIVE feature. When no matching registration exists for the
 * service state, the engine falls back to the single-GSTIN behaviour on
 * BillingProfile (gstNumber / companyStateCode / companyLegalName).
 */
const companyGstRegistrationSchema = new mongoose.Schema(
  {
    // 2-letter internal state code (e.g. "UP", "MH") — matches STATE_CODE_MAP.
    stateCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    stateName: { type: String, required: true, trim: true },
    // 15-character GSTIN.
    gstin: { type: String, required: true, uppercase: true, trim: true, unique: true, index: true },
    legalTradeName: { type: String, required: true, trim: true },
    registeredAddress: { type: String, required: true, trim: true },
    // Exactly one registration should be primary (used as the default fallback).
    isPrimary: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

companyGstRegistrationSchema.index({ stateCode: 1, active: 1 });

export const CompanyGstRegistration = mongoose.model(
  "CompanyGstRegistration",
  companyGstRegistrationSchema
);

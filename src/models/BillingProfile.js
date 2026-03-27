import mongoose from "mongoose";

const billingProfileSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    billMode: { type: String, enum: ["prepaid", "postpaid"], default: "prepaid" },
    defaultHomeBillMode: { type: String, enum: ["prepaid", "postpaid"], default: "prepaid" },
    defaultBusinessBillMode: { type: String, enum: ["prepaid", "postpaid"], default: "postpaid" },
    cycle: { type: String, enum: ["monthly", "quarterly", "annual"], default: "monthly" },
    invoiceDay: { type: Number, min: 1, max: 31, default: 1 },
    dueDays: { type: Number, min: 0, default: 0 },
    graceDays: { type: Number, min: 0, default: 0 },
    autoSuspend: { type: Boolean, default: true },
    currency: { type: String, default: "INR" },
    companyLegalName: String,
    companyAddress: String,
    supportPhone: String,
    supportEmail: String,
    invoicePrefix: { type: String, default: "JF" },
    invoiceSeriesCode: { type: String, default: "MAIN" },
    invoiceSequencePadding: { type: Number, default: 4 },
    activationInvoiceTiming: { type: String, enum: ["before_payment", "after_payment"], default: "before_payment" },
    taxPercent: { type: Number, default: 18 },
    companyStateCode: { type: String, default: "UP" },
    companyStateName: { type: String, default: "Uttar Pradesh" },
    gstNumber: String,
    taxMode: { type: String, enum: ["india_gst", "flat_tax"], default: "india_gst" },
    interstateIgstPercent: { type: Number, default: 18 },
    intrastateCgstPercent: { type: Number, default: 9 },
    intrastateSgstPercent: { type: Number, default: 9 },
    stateOverrides: {
      type: [
        new mongoose.Schema(
          {
            stateCode: String,
            stateName: String,
            igstPercent: Number,
            cgstPercent: Number,
            sgstPercent: Number,
            unionTerritory: Boolean
          },
          { _id: false }
        )
      ],
      default: []
    },
    zoneMappings: {
      type: [
        new mongoose.Schema(
          {
            zoneCode: String,
            zoneName: String,
            stateCode: String,
            stateName: String,
            invoicePrefix: String,
            invoiceSeriesCode: String,
            templateKey: String,
            defaultBillMode: { type: String, enum: ["prepaid", "postpaid"] }
          },
          { _id: false }
        )
      ],
      default: []
    },
    razorpayEnabled: { type: Boolean, default: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

billingProfileSchema.index({ active: 1, code: 1 });

export const BillingProfile = mongoose.model("BillingProfile", billingProfileSchema);

import mongoose from "mongoose";

const billingInvoiceSchema = new mongoose.Schema(
  {
    invoiceId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    serviceId: { type: String, index: true },
    invoiceNumber: { type: String, required: true, index: true },
    billCycle: String,
    generatedAt: Date,
    dueDate: Date,
    amount: Number,
    taxAmount: Number,
    totalAmount: Number,
    taxMode: { type: String, default: "india_gst" },
    billingStateCode: String,
    billingStateName: String,
    placeOfSupply: String,
    gstNumber: String,
    taxBreakdown: {
      type: [
        new mongoose.Schema(
          {
            label: String,
            rate: Number,
            amount: Number
          },
          { _id: false }
        )
      ],
      default: []
    },
    lineItems: {
      type: [
        new mongoose.Schema(
          {
            code: String,
            category: String,
            description: String,
            quantity: { type: Number, default: 1 },
            unitAmount: Number,
            amount: Number
          },
          { _id: false }
        )
      ],
      default: []
    },
    currency: { type: String, default: "INR" },
    status: { type: String, default: "generated", index: true },
    paymentStatus: { type: String, default: "pending", index: true },
    source: { type: String, default: "internal_platform" },
    billingZoneCode: { type: String, index: true },
    billingZoneName: String,
    appliedTemplateKey: String,
    appliedTemplateName: String,
    companyLegalName: String,
    companyAddress: String,
    invoicePrefix: String,
    invoiceSeriesCode: String,
    invoiceSequenceNumber: Number,
    pdfUrl: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

billingInvoiceSchema.index({ customerId: 1, generatedAt: -1 });
billingInvoiceSchema.index({ paymentStatus: 1, dueDate: 1 });

export const BillingInvoice = mongoose.model("BillingInvoice", billingInvoiceSchema);

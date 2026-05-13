import mongoose from "mongoose";

const generatedInvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  jazeRenewalId: { type: String, required: true, index: true },
  jazeUserId: { type: String, required: true },
  customerId: { type: String, required: true },
  amount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const GeneratedInvoice = mongoose.model("GeneratedInvoice", generatedInvoiceSchema);

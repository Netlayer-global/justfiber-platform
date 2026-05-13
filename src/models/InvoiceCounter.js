import mongoose from "mongoose";

const invoiceCounterSchema = new mongoose.Schema({
  fiscalYear: { type: String, required: true, unique: true },
  lastNumber: { type: Number, default: 0 },
}, { timestamps: true });

// Atomic increment — returns next invoice number
invoiceCounterSchema.statics.getNextInvoiceNumber = async function() {
  const now = new Date();
  // Financial year: Apr-Mar (e.g., "25-26" for Apr 2025 - Mar 2026)
  const fy = now.getMonth() >= 3
    ? `${String(now.getFullYear()).slice(2)}-${String(now.getFullYear() + 1).slice(2)}`
    : `${String(now.getFullYear() - 1).slice(2)}-${String(now.getFullYear()).slice(2)}`;
  
  const counter = await this.findOneAndUpdate(
    { fiscalYear: fy },
    { $inc: { lastNumber: 1 } },
    { upsert: true, new: true }
  );
  
  const padded = String(counter.lastNumber).padStart(4, '0');
  return `JF-${fy}-${padded}`;
};

export const InvoiceCounter = mongoose.model("InvoiceCounter", invoiceCounterSchema);

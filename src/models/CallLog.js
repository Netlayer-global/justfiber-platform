import mongoose from "mongoose";

const callLogSchema = new mongoose.Schema(
  {
    callId: { type: String, index: true },
    callerNumber: { type: String, required: true, index: true },
    calledNumber: { type: String, required: true },
    direction: { type: String, enum: ["inbound", "outbound"], default: "inbound" },
    callType: { type: String, enum: ["sales", "complaint", "unknown"], default: "unknown" },
    status: { type: String, enum: ["ringing", "answered", "missed", "voicemail", "busy", "failed"], default: "ringing" },
    duration: { type: Number, default: 0 },
    ivrInput: { type: String, default: "" },
    agentNumber: { type: String, default: "" },
    agentName: { type: String, default: "" },
    recordingUrl: { type: String, default: "" },
    disposition: { type: String, default: "" },
    customerId: { type: String, default: null },
    customerName: { type: String, default: "" },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "SupportTicket", default: null },
    notes: { type: String, default: "" },
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export const CallLog = mongoose.model("CallLog", callLogSchema);

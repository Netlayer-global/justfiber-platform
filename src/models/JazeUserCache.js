import mongoose from "mongoose";

const jazeUserCacheSchema = new mongoose.Schema({
  jazeUserId: { type: String, required: true, unique: true, index: true },
  username: { type: String, default: "" },
  phone: { type: String, default: "", index: true },
  name: { type: String, default: "" },
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  email: { type: String, default: "" },
  groupId: { type: String, default: "" },
  groupName: { type: String, default: "" },
  status: { type: String, default: "" },
  activationTime: { type: String, default: "" },
  expirationTime: { type: String, default: "" },
  address: { type: String, default: "" },
  city: { type: String, default: "" },
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const JazeUserCache = mongoose.model("JazeUserCache", jazeUserCacheSchema);

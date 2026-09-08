const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema({
  donorName: { type: String, required: true },
  donorEmail: { type: String },
  donorPhone: { type: String },
  amount: { type: Number, required: true }, // in ETH
  amountINR: { type: Number, required: true },
  message: { type: String, default: "" },
  transactionHash: { type: String, required: true, unique: true },
  blockNumber: { type: Number },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ["pending", "confirmed", "failed"], default: "confirmed" },
  donorAddress: { type: String }, // blockchain address that sent funds
});

module.exports = mongoose.model("Donation", donationSchema);
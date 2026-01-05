const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  originalText: String,     
  translatedText: String,   
  aiResponse: String,      
  translatedResponse: String, 
  languageUsed: String      
}, { timestamps: true });

module.exports = mongoose.model("Chat", chatSchema);
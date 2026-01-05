const mongoose = require("mongoose");

const tutorialSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true,
    enum: ["Smartphone", "Social Media", "Cyber Safety", "Govt Services"] 
  },
  description: { 
    type: String, 
    required: true 
  },
  steps: [
    {
      stepNumber: Number,
      instruction: String,
      visualHintUrl: String 
    }
  ],
  language: { 
    type: String, 
    default: "English" 
  },
  videoUrl: { 
    type: String 
  }
}, { timestamps: true });

module.exports = mongoose.model("Tutorial", tutorialSchema);
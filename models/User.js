const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true
    },
    email: {
      type: String,
      unique: true,
      sparse: true, 
      trim: true
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      trim: true
    },
    language: {
      type: String,
      enum: ["Malayalam", "English", "Hindi", "Tamil", "Kannada"],
      default: "English",
    },
    password: { type: String, required: true },
    literacyLevel: {
      type: String,
      enum: ["Beginner", "Intermediate", "Senior Citizen Mode"],
      default: "Beginner",
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
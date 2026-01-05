const User = require("../models/User");
const Tutorial = require("../models/Tutorial");
const registerUser = async (req, res) => {
  try {
    const { 
      fullName, 
      email, 
      mobile, 
      password, 
      confirmPassword, 
      language, 
      literacyLevel 
    } = req.body;

    if (!fullName || !mobile || !password || !confirmPassword) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const userExists = await User.findOne({ mobile });
    if (userExists) {
      return res.status(400).json({ message: "Mobile number already exists" });
    }

    const user = await User.create({
      fullName,
      email,
      mobile,
      password, 
      language,
      literacyLevel
    });

    res.status(201).json({
      message: "Registration successful",
      user: {
        _id: user._id,
        fullName: user.fullName,
        mobile: user.mobile,
        language: user.language,
        literacyLevel: user.literacyLevel

      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Invalid ID or Server Error" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const { password, confirmPassword, email, mobile, ...otherDetails } = req.body;
    if (email) {
      const emailExists = await User.findOne({ email, _id: { $ne: userId } });
      if (emailExists) {
        return res.status(400).json({ message: "Email is already in use by another account" });
      }
    }
    if (mobile) {
      const mobileExists = await User.findOne({ mobile, _id: { $ne: userId } });
      if (mobileExists) {
        return res.status(400).json({ message: "Mobile number is already in use by another account" });
      }
    }

    const updateData = { 
        ...otherDetails,
        email, 
        mobile 
    };
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData, 
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: {
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        language: updatedUser.language,
        literacyLevel: updatedUser.literacyLevel
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch users" });
    }
};
const getSystemStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalTutorials = await Tutorial.countDocuments();
        const totalChats = await Chat.countDocuments(); // REAL count of AI queries

        const languageStats = await User.aggregate([
            { $group: { _id: "$language", value: { $sum: 1 } } },
            { $project: { name: "$_id", value: 1, _id: 0 } }
        ]);

        const growthStats = await User.aggregate([
            { $group: { _id: { month: { $month: "$createdAt" } }, users: { $sum: 1 } } },
            { $sort: { "_id.month": 1 } }
        ]);

        const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const formattedGrowth = growthStats.map(item => ({
            month: monthNames[item._id.month],
            users: item.users
        }));

        res.status(200).json({
            success: true,
            totalUsers,
            totalTutorials,
            totalChats,
            languageData: languageStats,
            growthData: formattedGrowth
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
module.exports = { registerUser, getUserProfile, updateProfile ,getAllUsers, getSystemStats };
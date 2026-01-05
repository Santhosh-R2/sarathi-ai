const User = require("../models/User");

const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  const LOCAL_ADMIN_EMAIL = "admin@sarathi.com";
  const LOCAL_ADMIN_PASSWORD = "admin123";

  if (email === LOCAL_ADMIN_EMAIL && password === LOCAL_ADMIN_PASSWORD) {
    return res.status(200).json({
      message: "Admin Login Successful",
      isAdmin: true,
      user: { fullName: "System Admin", email: LOCAL_ADMIN_EMAIL }
    });
  } else {
    return res.status(401).json({ message: "Invalid Admin Credentials" });
  }
};

const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body; 

    if (!identifier || !password) {
      return res.status(400).json({ message: "Please provide Email/Mobile and Password" });
    }
    const cleanIdentifier = identifier.toString().trim();
    const cleanPassword = password.toString().trim();
    const user = await User.findOne({
      $or: [
        { email: cleanIdentifier },
        { mobile: cleanIdentifier }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: "Account not found with this Email or Mobile" });
    }

    if (user.password === cleanPassword) {
      return res.status(200).json({
        message: "Login Successful",
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          mobile: user.mobile,
          language: user.language,
          literacyLevel: user.literacyLevel
        }
      });
    } else {
      return res.status(401).json({ message: "Incorrect Password" });
    }

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { loginUser, adminLogin };
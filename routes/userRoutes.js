const express = require("express");
const router = express.Router();
const { 
    registerUser, 
    getUserProfile, 
    updateProfile ,
    getAllUsers,
    getSystemStats
} = require("../controllers/userController");
const { loginUser, adminLogin } = require("../controllers/authController");
const { processVoiceChat ,getUserChatHistory ,clearUserChatHistory }  = require("../controllers/aiController");
router.post("/register", registerUser);
router.get("/profile/:id", getUserProfile);
router.put("/update/:id", updateProfile);
router.post("/login", loginUser);
router.post("/admin-login", adminLogin);
router.get("/", getAllUsers);

router.post("/voice-chat", processVoiceChat);
router.get("/history/:userId", getUserChatHistory);
router.delete("/history/:userId", clearUserChatHistory);
router.get("/stats", getSystemStats);
module.exports = router;
const axios = require('axios');
const FormData = require('form-data');
const pythonTranslatorWrapper = require('../services/pythonTranslatorWrapper');
const Chat = require("../models/Chat");
const User = require("../models/User");
const Tutorial = require("../models/Tutorial");

const nlpService = require('../services/nlpService');
const pythonNlpWrapper = require('../services/pythonNlpWrapper');
const pythonTranscriberWrapper = require('../services/pythonTranscriberWrapper');

const freeTranslate = async (text, to) => {
    try {
        if (!text) return "";
        return await pythonTranslatorWrapper.translate(text, to, process.env.GROQ_API_KEY);
    } catch (e) {
        console.error("Translation Error:", e.message);
        return text;
    }
};

const BASIC_FAQS = [
    { q: "pay money to shop", steps: ["Open the Google Pay (GPay) app.", "Tap the 'Scan any QR code' button at the top.", "Point your phone camera at the shop's QR code sticker.", "Enter the payment amount and tap 'Pay'.", "Type your secret 4 or 6-digit UPI PIN to finish."] },
    { q: "send money to friend", steps: ["Open your GPay app.", "Tap 'Pay contacts' or search for your friend's name/number.", "Select the correct person from the list.", "Tap 'Pay', enter the amount, and click the blue tick.", "Enter your secret UPI PIN to send."] },
    { q: "check bank balance", steps: ["Open GPay and scroll to the very bottom.", "Tap 'Check bank balance'.", "Select the bank account you want to check.", "Enter your secret UPI PIN to see your current balance."] },
    { q: "mobile recharge", steps: ["Open GPay and tap 'Mobile recharge'.", "Enter the mobile number you want to recharge.", "Select your operator (like Jio, Airtel, VI).", "Choose a recharge plan/amount.", "Tap 'Pay' and enter your UPI PIN."] },
    { q: "electricity bill payment", steps: ["Open GPay and tap 'Bills'.", "Select 'Electricity'.", "Choose your electricity board (e.g., KSEB, TNEB).", "Enter your Consumer Number found on your bill.", "Tap 'Pay' and enter your UPI PIN."] },
    { q: "gas cylinder booking", steps: ["Open GPay and tap 'Bills'.", "Select 'Gas Cylinder Booking'.", "Choose your provider (HP, Indane, Bharat).", "Enter your registered mobile number or LPG ID.", "Tap 'Pay' to book and pay."] },
    { q: "what is digilocker", steps: ["DigiLocker is a secure government app for your smartphone.", "It stores digital copies of your Aadhaar, Driving License, and Marksheets.", "These digital documents are legally valid just like original paper ones.", "You don't need to carry physical papers if you have them in DigiLocker."] },
    { q: "internet not working", steps: ["Swipe down from the top of your screen to see the settings.", "Check if 'Mobile Data' icon is blue (turned ON).", "If it's on but not working, turn 'Airplane Mode' ON for 5 seconds.", "Turn 'Airplane Mode' OFF and wait for the network to return."] },
    { q: "phone is hanging", steps: ["Press and hold the Power button on the side for 10 seconds to restart.", "Go to Gallery and delete old WhatsApp videos to free up space.", "Clear 'Background Apps' by clicking the square or three-line button at the bottom and tapping 'Clear All'."] },
    { q: "how to use whatsapp", steps: ["Open WhatsApp and tap the green message icon at the bottom.", "Select the friend you want to message.", "Type your message in the box at the bottom.", "Click the green arrow button to send the message."] },
    { q: "send location on whatsapp", steps: ["Open the chat of the person you want to send location to.", "Tap the paperclip (attachment) icon near the message box.", "Select 'Location'.", "Tap 'Send your current location' to share where you are."] },
    { q: "is otp safe", steps: ["OTP is a secret one-time code sent to you for security.", "Never share your OTP with anyone over the phone, even if they claim to be from a bank.", "Banks or Government officers will NEVER ask you for an OTP."] },
    { q: "how to block scam calls", steps: ["Open your 'Phone' or 'Dialer' app.", "Go to 'Recents' and tap and hold the unknown number.", "Select 'Block' or 'Report as Spam'.", "Tap 'Block' again to confirm."] },
    { q: "how to update apps", steps: ["Open the 'Play Store' app.", "Tap your profile picture/circle at the top right.", "Tap 'Manage apps & device'.", "Tap 'Updates available' and then tap 'Update all'."] },
    { q: "battery dying fast", steps: ["Lower your screen brightness from the top swipe-down menu.", "Turn OFF WiFi, Bluetooth, and GPS when not in use.", "Enable 'Battery Saver' or 'Power Saving Mode' in Settings."] },
    { q: "how to take photo", steps: ["Open the 'Camera' app.", "Hold the phone steady with both hands.", "Point it at the person or object you want to capture.", "Tap the large white circle button at the bottom."] },
    { q: "what is upi", steps: ["UPI (Unified Payments Interface) connects your bank to your mobile.", "It allows instant money transfers 24/7 using just a mobile number or QR code.", "You need a 'UPI PIN' which is like an ATM PIN to authorize payments."] },
    { q: "forgot password", steps: ["On the login screen, tap 'Forgot Password?'.", "Enter your mobile number to get a security code (OTP).", "Enter the OTP you received.", "Create a new password and save it."] },
    { q: "how to search news", steps: ["Open the 'YouTube' app.", "Tap the magnifying glass icon at the top right.", "Type or speak 'Latest News'.", "Click on the latest video with a red 'LIVE' badge."] },
    { q: "connect to wifi", steps: ["Open 'Settings' and tap on 'WiFi'.", "Turn the WiFi switch to ON.", "Tap the name of your home network.", "Type the password carefully and click 'Connect'."] },
    { q: "how to use flashlight", steps: ["Swipe down from the very top of your screen.", "Find the icon that looks like a torch or flashlight.", "Tap it once to turn it ON, and tap again to turn it OFF."] },
    { q: "how to voice type", steps: ["Open any app where you want to type (like WhatsApp).", "Tap inside the message box to open the keyboard.", "Tap the 'Microphone' icon on the keyboard (not the WhatsApp record button).", "Wait for 'Speak now' and say your message clearly."] },
    { q: "set an alarm", steps: ["Open the 'Clock' app on your phone.", "Tap the 'Alarm' tab at the bottom.", "Tap the '+' plus button to add a new alarm.", "Set the time and tap 'Save'."] },
    { q: "check aadhaar status", steps: ["Open Google/Chrome and search 'UIDAI MyAadhaar'.", "Click on 'Check Enrollment & Update Status'.", "Enter your Enrollment ID from the slip you received.", "The website will show if your Aadhaar is ready or not."] }
];

const getPythonMatch = async (userQuery, nativeQuery, availableTitles, language) => {
    try {
        const allOptions = [...BASIC_FAQS.map(f => f.q), ...availableTitles];
        return await pythonNlpWrapper.getMatch(userQuery, nativeQuery, allOptions, process.env.GROQ_API_KEY, language);
    } catch (err) {
        console.error("Python NLP Wrapper Error:", err);
        return { match: "NONE" };
    }
};
const GREETINGS = ["hi", "hello", "hey", "namaste", "namaskaram", "vanakkam", "good morning", "good evening", "hi sarathi", "hello sarathi", "hey sarathi"];
exports.processVoiceChat = async (req, res) => {
    try {
        let { userId, audioBase64, textInput } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const langISO = user.language === "Malayalam" ? "ml" :
            user.language === "Tamil" ? "ta" :
                user.language === "Hindi" ? "hi" : "en";

        let transcription = textInput || "";
        let rawTranscription = ""; // To store the exact words from voice

        // 1. Transcription Logic (Audio to Text - NO GROQ)
        if (audioBase64) {
            console.log("Using Non-Groq Python Transcriber...");
            const base64Data = audioBase64.split(',').pop();
            const transResult = await pythonTranscriberWrapper.transcribe(base64Data, user.language);
            transcription = transResult.text || "";
            rawTranscription = transcription;
        }

        if (!transcription) return res.status(400).json({ message: "No input received." });
        if (!rawTranscription) rawTranscription = transcription; // Fallback for text input

        // 2. Translation & Cleaning
        const engText = await freeTranslate(transcription, 'en');
        const cleanEngText = engText.toLowerCase().trim().replace(/[?.!]/g, "");

        let responseHeader = "";
        let responseSteps = [];
        let isTutorial = false;
        let matchedTopic = "NONE";
        let correctedTranscription = transcription;

        // --- NEW: GREETING INTERCEPTOR ---
        const isGreeting = GREETINGS.includes(cleanEngText);
        if (isGreeting) {
            responseHeader = `Hello! I am Digital Sarathi. I can help you with WhatsApp, GPay, DigiLocker, and more. How can I help you today?`;
            isTutorial = false;
        } else {
            // 3. NLP Matching
            const dbTutorials = await Tutorial.find({}, "title");
            const allTopicOptions = [...BASIC_FAQS.map(f => f.q), ...dbTutorials.map(t => t.title)];

            try {
                const result = await getPythonMatch(cleanEngText, transcription, allTopicOptions, user.language);
                if (result && typeof result === 'object') {
                    matchedTopic = result.match || "NONE";
                    if (matchedTopic !== "NONE" && result.correctedNative) {
                        correctedTranscription = result.correctedNative;
                    }
                } else {
                    matchedTopic = result;
                }
            } catch (err) {
                console.error("Python NLP Service Failed:", err.message);
            }

            if (matchedTopic === "NONE") {
                matchedTopic = await nlpService.getMatch(cleanEngText, transcription, allTopicOptions);
            }

            // 4. Response Mapping
            const faqMatch = BASIC_FAQS.find(f => f.q.toLowerCase() === matchedTopic.toLowerCase());
            const dbMatch = await Tutorial.findOne({ title: { $regex: new RegExp(`^${matchedTopic}$`, 'i') } });

            if (faqMatch) {
                responseHeader = "Steps:";
                responseSteps = faqMatch.steps.map((s, i) => `Step ${i + 1}: ${s}`);
                isTutorial = true;
            } else if (dbMatch) {
                responseHeader = dbMatch.title; // Just show the title as header
                responseSteps = dbMatch.steps.map(s => `Step ${s.stepNumber}: ${s.instruction}`);
                isTutorial = true;
            } else {
                responseHeader = "I'm sorry, I couldn't find a specific tutorial for that request. Use exact words like 'WhatsApp' or 'GPay' for better results.";
                responseSteps = [];
                isTutorial = false;
            }
        }

        // 5. Final Localization & Database Save
        const responseTextToTranslate = [responseHeader, ...responseSteps].join(" [SPLIT] ");
        const translatedBlock = await freeTranslate(responseTextToTranslate, langISO);
        const translatedParts = translatedBlock.split(" [SPLIT] ");

        const localizedAiHeader = translatedParts[0] || "";
        const localizedSteps = translatedParts.slice(1);

        await Chat.create({
            userId,
            originalText: rawTranscription, // Use exact words here
            translatedText: engText,
            aiResponse: responseHeader + " " + responseSteps.join(" "),
            translatedResponse: localizedAiHeader + " " + localizedSteps.join(" "),
            languageUsed: user.language
        });

        res.json({
            success: true,
            userSaid: rawTranscription, // Show exact words in UI
            aiSaid: localizedAiHeader,
            steps: localizedSteps,
            isTutorial
        });

    } catch (e) {
        console.error("AI Error:", e.message);
        res.status(500).json({ error: "Server Error" });
    }
};


exports.getUserChatHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const history = await Chat.find({ userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, history });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
};

exports.clearUserChatHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        await Chat.deleteMany({ userId });
        res.status(200).json({ success: true, message: "History cleared." });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete history" });
    }
};
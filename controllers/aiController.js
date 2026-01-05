const axios = require('axios');
const FormData = require('form-data');
const translate = require('translate-google-api');
const Chat = require("../models/Chat");
const User = require("../models/User");
const Tutorial = require("../models/Tutorial");

const freeTranslate = async (text, to) => {
    try {
        if (!text) return "";
        const res = await translate(text, { tld: "com", to });
        return res[0];
    } catch (e) { 
        console.error("Translation Error:", e.message);
        return text; 
    }
};

const BASIC_FAQS = [
    { q: "pay money to shop", steps: ["Open the Google Pay (GPay) app.", "Tap the 'Scan any QR code' button at the top.", "Point your phone camera at the shop's QR code sticker.", "Enter the payment amount and type your secret UPI PIN."] },
    { q: "send money to friend", steps: ["Open your GPay app.", "Tap on 'Pay contact' or 'Search' for your friend's name.", "Select the person you want to send money to.", "Tap 'Pay', enter the amount and your UPI PIN."] },
    { q: "check bank balance", steps: ["Open GPay and scroll to the very bottom.", "Tap on 'Check bank balance'.", "Select your bank and enter your secret UPI PIN to see your balance."] },
    { q: "what is digilocker", steps: ["DigiLocker is a secure government app for your phone.", "It allows you to store digital copies of Aadhaar, Driving License, and Marksheets.", "These digital documents are legally valid just like original paper ones."] },
    { q: "internet not working", steps: ["Swipe down from the top of your screen to see the settings panel.", "Ensure the 'Mobile Data' icon is blue or turned ON.", "If it's on but not working, turn 'Airplane Mode' ON for 5 seconds and then turn it OFF."] },
    { q: "phone is hanging", steps: ["Press and hold the Power button on the side for 10 seconds to restart.", "Go to your Gallery and delete old WhatsApp videos to free up space.", "Clear 'Background Apps' by clicking the square or three-line button at the bottom."] },
    { q: "how to use whatsapp", steps: ["Open WhatsApp and tap the green message icon at the bottom right.", "Select the contact person you want to talk to.", "Type your message in the bottom box and click the green arrow button to send."] },
    { q: "is otp safe", steps: ["OTP is a secret code sent only to you for security.", "Never share your OTP with anyone over the phone or message.", "Remember: Banks or Government officers will NEVER ask you for an OTP."] },
    { q: "how to block scam calls", steps: ["Open your Phone/Dialer app.", "Tap and hold the unknown number that called you.", "Select 'Block' or 'Report as Spam' from the menu."] },
    { q: "how to update apps", steps: ["Open the 'Play Store' app.", "Tap your profile circle at the top right corner.", "Go to 'Manage apps & device' and then tap 'Update all'."] },
    { q: "battery dying fast", steps: ["Lower your screen brightness from the top settings panel.", "Turn OFF WiFi, Bluetooth, and GPS when you are not using them.", "Enable 'Battery Saver' mode in your phone settings."] },
    { q: "how to take photo", steps: ["Open the 'Camera' app.", "Hold the phone steady and point it at what you want to capture.", "Tap the large white circle button at the bottom to take the picture."] },
    { q: "what is upi", steps: ["UPI is a system that connects your bank account to your mobile phone.", "It allows you to send and receive money instantly, 24 hours a day.", "You only need the receiver's mobile number or QR code to pay."] },
    { q: "forgot password", steps: ["On the login page, tap the link that says 'Forgot Password?'.", "Enter your registered mobile number to receive a security code.", "Enter that code and then create a new password that you can remember."] },
    { q: "how to search news", steps: ["Open the 'YouTube' app.", "Tap the magnifying glass icon at the top right.", "Type or speak 'Latest News'.", "Tap on the latest video with a red 'LIVE' badge to watch."] },
    { q: "connect to wifi", steps: ["Go to Settings and select 'WiFi'.", "Turn the switch to ON.", "Tap on the name of your home network.", "Type the password and click 'Connect'."] },
    { q: "how to use flashlight", steps: ["Swipe down from the top edge of your screen.", "Find the icon that looks like a flashlight or torch.", "Tap it once to turn it ON, and tap again to turn it OFF."] },
    { q: "install new app", steps: ["Open the 'Play Store' app.", "Type the name of the app you want (e.g., Facebook) in the top search bar.", "Tap the green 'Install' button and wait for it to finish."] },
    { q: "volume is low", steps: ["Press the long button on the side of your phone (Top part) to increase volume.", "If that doesn't work, check the sound settings in the top notification panel.", "Ensure 'Do Not Disturb' or 'Mute' mode is turned OFF."] },
    { q: "safe online shopping", steps: ["Only use well-known apps like Amazon or Flipkart.", "Check the 'Customer Reviews' and ratings before buying a product.", "Select 'Cash on Delivery' if you don't want to pay online immediately."] }
];

const getAdminDirectMatch = async (userInput, translatedInput) => {
    const tutorials = await Tutorial.find({}, 'title category');
    const userText = userInput.toLowerCase();
    const engText = translatedInput.toLowerCase();

    for (let tut of tutorials) {
        const title = tut.title.toLowerCase();
        const category = tut.category.toLowerCase();

        if (userText.includes(title) || engText.includes(title) || 
            userText.includes(category) || engText.includes(category)) {
            return tut.title;
        }
    }
    return null;
};

const getSmartMatch = async (userQuery, nativeQuery, availableTitles) => {
    try {
        const allOptions = [...BASIC_FAQS.map(f => f.q), ...availableTitles].join(", ");
        const prompt = `User input (English): "${userQuery}". User input (Native): "${nativeQuery}".
        Knowledge Base Topics: [${allOptions}]. 
        Task: Which topic best matches the user's intent? 
        Return ONLY the title string. If no match, return "NONE".`;

        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1
        }, {
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
        });
        return response.data.choices[0].message.content.trim().replace(/[".]+/g, '');
    } catch (e) { return "NONE"; }
};

exports.processVoiceChat = async (req, res) => {
    try {
        let { userId, audioBase64, textInput } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const langISO = user.language === "Malayalam" ? "ml" : 
                        user.language === "Tamil" ? "ta" : 
                        user.language === "Hindi" ? "hi" : "en";
        
        let transcription = textInput || "";

        if (audioBase64) {
            const base64Data = audioBase64.split(',').pop();
            const form = new FormData();
            form.append('file', Buffer.from(base64Data, 'base64'), { filename: 'audio.wav', contentType: 'audio/wav' });
            form.append('model', 'whisper-large-v3');
            form.append('language', langISO);
            form.append('prompt', 'GPay, WhatsApp, DigiLocker, Aadhaar, UPI, व्हाट्सएप, गूगल पे, വാട്സാപ്പ്, ഡിജിലോക്കർ');

            const groqRes = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
                headers: { ...form.getHeaders(), 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
            });
            transcription = groqRes.data.text;
        }

        if (!transcription) return res.status(400).json({ message: "No input received." });

        const engText = await freeTranslate(transcription, 'en');
        const cleanEngText = engText.toLowerCase().replace("google play", "google pay");

        let matchedTopic = await getAdminDirectMatch(transcription, cleanEngText);
        
        if (!matchedTopic) {
            const input = cleanEngText.toLowerCase();
            if (input.match(/whatsapp|व्हाट्सएप|വാട്സാപ്പ്|வாட்ஸ்அப்|chat/)) matchedTopic = "how to use whatsapp";
            if (input.match(/digilocker|डिजी लॉकर|ഡിജിലോക്കർ|aadhaar|आधार|ആധാർ/)) matchedTopic = "what is digilocker";
            if (input.match(/gpay|pay|money|पैसे|പണം|qr|scan/)) matchedTopic = "pay money to shop";
        }

        if (!matchedTopic) {
            const dbTutorials = await Tutorial.find({}, "title");
            const allDbTitles = dbTutorials.map(t => t.title);
            matchedTopic = await getSmartMatch(cleanEngText, transcription, allDbTitles);
        }
        
        let responseHeader = ""; 
        let responseSteps = [];  
        let isTutorial = false;

        const faqMatch = BASIC_FAQS.find(f => f.q === matchedTopic);
        const dbMatch = await Tutorial.findOne({ title: matchedTopic });

        if (faqMatch) {
            responseHeader = "Here are the steps to help you:";
            responseSteps = faqMatch.steps.map((s, i) => `Step ${i + 1}: ${s}`);
            isTutorial = true;
        } else if (dbMatch) {
            responseHeader = dbMatch.description;
            responseSteps = dbMatch.steps.map(s => `Step ${s.stepNumber}: ${s.instruction}`);
            isTutorial = true;
        } else {
            responseHeader = `I understood you said: "${engText}". I don't have a specific tutorial for this yet. Try asking about WhatsApp, DigiLocker, or GPay!`;
        }

        const localizedAiHeader = await freeTranslate(responseHeader, langISO);
        const localizedSteps = await Promise.all(
            responseSteps.map(async (step) => await freeTranslate(step, langISO))
        );

        await Chat.create({ 
            userId, 
            originalText: transcription, 
            translatedText: engText, 
            aiResponse: responseHeader + " " + responseSteps.join(" "), 
            translatedResponse: localizedAiHeader + " " + localizedSteps.join(" "), 
            languageUsed: user.language 
        });

        res.json({ 
            success: true, 
            userSaid: transcription, 
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
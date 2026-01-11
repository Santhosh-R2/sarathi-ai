const axios = require('axios');
const FormData = require('form-data');
const Chat = require("../models/Chat");
const User = require("../models/User");
const Tutorial = require("../models/Tutorial");
const nlpService = require('../services/nlpService');
const pythonNlpWrapper = require('../services/pythonNlpWrapper');

// --- HELPER: GREETINGS LIST ---
const GREETINGS = ["hi", "hello", "hey", "namaste", "namaskaram", "vanakkam", "good morning", "good evening", "hi sarathi", "hello sarathi"];

// --- HELPER: BASIC FAQS ---
const BASIC_FAQS = [
    { q: "pay money to shop", steps: ["Open the Google Pay (GPay) app.", "Tap the 'Scan any QR code' button at the top.", "Point your phone camera at the shop's QR code sticker.", "Enter the payment amount and type your secret UPI PIN."] },
    { q: "send money to friend", steps: ["Open your GPay app.", "Tap on 'Pay contact' or 'Search' for your friend's name.", "Select the person you want to send money to.", "Tap 'Pay', enter the amount and your UPI PIN."] },
    { q: "check bank balance", steps: ["Open GPay and scroll to the very bottom.", "Tap on 'Check bank balance'.", "Select your bank and enter your secret UPI PIN to see your balance."] },
    { q: "what is digilocker", steps: ["DigiLocker is a secure government app for your phone.", "It allows you to store digital copies of Aadhaar, Driving License, and Marksheets.", "These digital documents are legally valid just like original paper ones."] },
    { q: "internet not working", steps: ["Swipe down from the top of your screen to see the settings panel.", "Ensure the 'Mobile Data' icon is blue or turned ON.", "If it's on but not working, turn 'Airplane Mode' ON for 5 seconds and then turn it OFF."] },
    { q: "phone is hanging", steps: ["Press and hold the Power button on the side for 10 seconds to restart.", "Go to your Gallery and delete old WhatsApp videos to free up space.", "Clear 'Background Apps' by clicking the square or three-line button at the bottom."] },
    { q: "how to use whatsapp", steps: ["Open WhatsApp and tap the green message icon at the bottom right.", "Select the contact person you want to talk to.", "Type your message in the bottom box and click the green arrow button to send."] }
];

// --- HELPER: GROQ AI TRANSLATION (Avoids 429 Errors) ---
const groqTranslate = async (text, targetLang) => {
    try {
        if (!text) return "";
        const prompt = `Translate this text into simple ${targetLang}: "${text}". Return ONLY the translation.`;
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1
        }, {
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
        });
        return res.data.choices[0].message.content.trim();
    } catch (e) {
        console.error("Groq Translate Error:", e.message);
        return text;
    }
};

// --- MAIN PROCESSOR ---
exports.processVoiceChat = async (req, res) => {
    try {
        let { userId, audioBase64, textInput } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const langISO = user.language === "Malayalam" ? "ml" :
            user.language === "Tamil" ? "ta" :
                user.language === "Hindi" ? "hi" : "en";

        let transcription = textInput || "";

        // 1. Audio Transcription (Using Groq Whisper)
        if (audioBase64) {
            const base64Data = audioBase64.split(',').pop();
            const form = new FormData();
            form.append('file', Buffer.from(base64Data, 'base64'), { filename: 'audio.wav', contentType: 'audio/wav' });
            form.append('model', 'whisper-large-v3');
            form.append('language', langISO);

            const groqRes = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
                headers: { ...form.getHeaders(), 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
            });
            transcription = groqRes.data.text;
        }

        if (!transcription) return res.status(400).json({ message: "No input received." });

        // 2. Translate User Input to English for Logic
        const engText = await groqTranslate(transcription, "English");
        const cleanEngText = engText.toLowerCase().trim().replace(/[?.!]/g, "");

        let responseHeader = "";
        let responseSteps = [];
        let isTutorial = false;
        let matchedTopic = "NONE";
        let correctedTranscription = transcription;

        // 3. Greeting Interceptor
        if (GREETINGS.includes(cleanEngText)) {
            responseHeader = `Hello ${user.fullName || 'there'}! I am Digital Sarathi. I can help you with WhatsApp, GPay, DigiLocker, or Phone Safety. How can I guide you?`;
        } else {
            // 4. NLP Matching (Python + Node Fallback)
            const dbTutorials = await Tutorial.find({}, "title");
            const allTopicOptions = [...BASIC_FAQS.map(f => f.q), ...dbTutorials.map(t => t.title)];

            try {
                const result = await pythonNlpWrapper.getMatch(cleanEngText, transcription, allTopicOptions, process.env.GROQ_API_KEY, user.language);
                if (result && result.match) {
                    matchedTopic = result.match;
                    if (result.correctedNative) correctedTranscription = result.correctedNative;
                }
            } catch (err) {
                matchedTopic = await nlpService.getMatch(cleanEngText, transcription, allTopicOptions);
            }

            const faqMatch = BASIC_FAQS.find(f => f.q === matchedTopic);
            const dbMatch = await Tutorial.findOne({ title: matchedTopic });

            if (faqMatch) {
                responseHeader = "Here is how you can do that:";
                responseSteps = faqMatch.steps;
                isTutorial = true;
            } else if (dbMatch) {
                responseHeader = dbMatch.description;
                responseSteps = dbMatch.steps.map(s => s.instruction);
                isTutorial = true;
            } else {
                responseHeader = `I understood: "${engText}". I don't have a specific guide for this yet. Try asking about WhatsApp or GPay!`;
            }
        }

        // 5. BATCH TRANSLATION (The 429 Fix)
        let localizedAiHeader = responseHeader;
        let localizedSteps = responseSteps;

        if (user.language !== 'English') {
            try {
                const batchText = `[H] ${responseHeader} \n` + responseSteps.map(s => `[S] ${s}`).join("\n");
                const translationPrompt = `Translate to ${user.language}. Keep [H] and [S] markers. Return ONLY translated text with markers. \n\n ${batchText}`;

                const translationRes = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                    model: "llama-3.1-8b-instant",
                    messages: [{ role: "user", content: translationPrompt }],
                    temperature: 0.1
                }, {
                    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
                });

                const lines = translationRes.data.choices[0].message.content.split("\n");
                localizedAiHeader = lines.find(l => l.includes("[H]"))?.replace("[H]", "").trim() || responseHeader;
                localizedSteps = lines.filter(l => l.includes("[S]")).map(l => l.replace("[S]", "").trim());
                if (localizedSteps.length === 0) localizedSteps = responseSteps;
            } catch (err) {
                console.error("Batch Translation Failed");
            }
        }

        // 6. Save and Respond
        await Chat.create({
            userId,
            originalText: correctedTranscription,
            translatedText: engText,
            aiResponse: responseHeader + " " + responseSteps.join(" "),
            translatedResponse: localizedAiHeader + " " + localizedSteps.join(" "),
            languageUsed: user.language
        });

        res.json({
            success: true,
            userSaid: correctedTranscription,
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
        const history = await Chat.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
};

exports.clearUserChatHistory = async (req, res) => {
    try {
        await Chat.deleteMany({ userId: req.params.userId });
        res.json({ success: true, message: "History cleared." });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete history" });
    }
};
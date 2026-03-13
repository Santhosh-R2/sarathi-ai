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

const getPythonMatch = async (userQuery, nativeQuery, availableTitles, language) => {
    try {
        return await pythonNlpWrapper.getMatch(userQuery, nativeQuery, availableTitles, process.env.GROQ_API_KEY, language);
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
            // 3. NLP Matching — all topics come from the database
            const dbTutorials = await Tutorial.find({}, "title");
            const allTopicOptions = dbTutorials.map(t => t.title);

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

            // 4. Response Mapping — only from database
            const dbMatch = await Tutorial.findOne({ title: { $regex: new RegExp(`^${matchedTopic}$`, 'i') } });

            if (dbMatch) {
                responseHeader = dbMatch.title;
                responseSteps = dbMatch.steps.map(s => `Step ${s.stepNumber}: ${s.instruction}`);
                isTutorial = true;
            } else {
                responseHeader = "I'm sorry, I couldn't find a specific tutorial for that request. Please ask your admin to add it.";
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
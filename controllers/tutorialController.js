const Tutorial = require("../models/Tutorial");
const axios = require('axios');

// --- HELPER: GROQ AI BATCH TRANSLATION ---
const groqBatchTranslate = async (titlesArray, toISO) => {
    try {
        if (!titlesArray.length || toISO === 'en') return titlesArray;

        const langMap = { "ml": "Malayalam", "hi": "Hindi", "ta": "Tamil" };
        const targetLang = langMap[toISO] || "English";

        // Create a numbered list for the AI to translate
        const textToTranslate = titlesArray.map((t, i) => `${i + 1}. ${t}`).join("\n");

        const prompt = `Translate the following list of tutorial titles into ${targetLang}. 
        Keep the numbers and formatting exactly as they are.
        Return ONLY the translated list.

        List:
        ${textToTranslate}`;

        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1
        }, {
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
        });

        const translatedText = res.data.choices[0].message.content.trim();
        
        // Convert the AI's numbered list back into an array
        return translatedText.split("\n").map(line => line.replace(/^\d+\.\s*/, "").trim());
    } catch (e) {
        console.error("Groq Batch Translation Error:", e.message);
        return titlesArray; // Fallback to original English
    }
};

const addTutorial = async (req, res) => {
  try {
    const { title, category, description, steps, language } = req.body;
    const tutorial = await Tutorial.create({ title, category, description, steps, language });
    res.status(201).json({ message: "Tutorial added successfully", tutorial });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTutorials = async (req, res) => {
    try {
        const { lang } = req.query; 
        const tutorials = await Tutorial.find({}, 'title category description'); 

        // If English or no specific language requested, return immediately
        if (!lang || lang === 'en') {
            return res.json(tutorials);
        }

        // 1. Extract just the titles
        const titles = tutorials.map(t => t.title);

        // 2. Translate all titles in ONE batch call
        const translatedTitles = await groqBatchTranslate(titles, lang);

        // 3. Re-map the translated titles back to the tutorial objects
        const responseData = tutorials.map((tut, index) => ({
            _id: tut._id,
            category: tut.category,
            description: tut.description,
            title: translatedTitles[index] || tut.title, // Fallback if index mismatch
            originalTitle: tut.title 
        }));

        res.json(responseData);
    } catch (e) { 
        res.status(500).json({ message: e.message }); 
    }
};

const getTutorialById = async (req, res) => {
  try {
    const tutorial = await Tutorial.findById(req.params.id);
    if (!tutorial) return res.status(404).json({ message: "Tutorial not found" });
    res.status(200).json(tutorial);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTutorial = async (req, res) => {
  try {
    const tutorial = await Tutorial.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!tutorial) return res.status(404).json({ message: "Tutorial not found" });
    res.status(200).json({ message: "Tutorial updated successfully", tutorial });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTutorial = async (req, res) => {
  try {
    const tutorial = await Tutorial.findByIdAndDelete(req.params.id);
    if (!tutorial) return res.status(404).json({ message: "Tutorial not found" });
    res.status(200).json({ message: "Tutorial deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
    addTutorial, 
    getTutorials, 
    getTutorialById, 
    updateTutorial, 
    deleteTutorial 
};
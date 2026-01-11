const Tutorial = require("../models/Tutorial");
const pythonTranslatorWrapper = require('../services/pythonTranslatorWrapper');

const freeTranslate = async (text, to) => {
  try {
    if (!text || to === 'en') return text;
    // Use Python-based translator with Groq API key
    return await pythonTranslatorWrapper.translate(text, to, process.env.GROQ_API_KEY);
  } catch (e) {
    console.error("Translation Error:", e.message);
    return text;
  }
};


const addTutorial = async (req, res) => {
  try {
    const { title, category, description, steps, language } = req.body;

    const tutorial = await Tutorial.create({
      title,
      category,
      description,
      steps,
      language,
    });

    res.status(201).json({ message: "Tutorial added successfully", tutorial });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTutorials = async (req, res) => {
  try {
    // 1. Get the language from the query params (e.g., /api/tutorials?lang=ml)
    const { lang } = req.query;

    // 2. Fetch tutorials from DB
    const tutorials = await Tutorial.find({}, 'title category description');

    // 3. If no language or English, return original
    if (!lang || lang === 'en') {
      return res.json(tutorials);
    }

    // 4. Translate the titles for suggestions
    const translatedTutorials = await Promise.all(
      tutorials.map(async (tut) => {
        const nativeTitle = await freeTranslate(tut.title, lang);
        return {
          _id: tut._id,
          category: tut.category,
          // We send the translated title for display
          title: nativeTitle,
          // Optional: keep original title for logic if needed
          originalTitle: tut.title
        };
      })
    );

    res.json(translatedTutorials);
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
      { new: true, runValidators: true } // Returns updated doc and runs schema checks
    );

    if (!tutorial) {
      return res.status(404).json({ message: "Tutorial not found" });
    }

    res.status(200).json({ message: "Tutorial updated successfully", tutorial });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a tutorial
// @route   DELETE /api/tutorials/:id
const deleteTutorial = async (req, res) => {
  try {
    const tutorial = await Tutorial.findByIdAndDelete(req.params.id);

    if (!tutorial) {
      return res.status(404).json({ message: "Tutorial not found" });
    }

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
const Tutorial = require("../models/Tutorial");
const User = require("../models/User");
const mongoose = require("mongoose");
const pythonTranslatorWrapper = require('../services/pythonTranslatorWrapper');

const freeTranslate = async (text, to) => {
  try {
    if (!text || to === 'en') return text;
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
    let { lang, userId } = req.query;

    if (!lang && userId && mongoose.Types.ObjectId.isValid(userId)) {
        const user = await User.findById(userId);
        if (user && user.language) {
            lang = user.language === "Malayalam" ? "ml" :
                   user.language === "Tamil" ? "ta" :
                   user.language === "Hindi" ? "hi" : "en";
        }
    }

    const tutorials = await Tutorial.find({}, 'title category description');

    if (!lang || lang === 'en') {
      return res.json(tutorials);
    }

    const translatedTutorials = await Promise.all(
      tutorials.map(async (tut) => {
        const nativeTitle = await freeTranslate(tut.title, lang);
        const nativeDesc = await freeTranslate(tut.description, lang);
        return {
          _id: tut._id,
          category: tut.category,
          title: nativeTitle.split('\n')[0].trim(),
          description: nativeDesc,
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

    let { lang, userId } = req.query;
    if (!lang && userId && mongoose.Types.ObjectId.isValid(userId)) {
        const user = await User.findById(userId);
        if (user && user.language) {
            lang = user.language === "Malayalam" ? "ml" :
                   user.language === "Tamil" ? "ta" :
                   user.language === "Hindi" ? "hi" : "en";
        }
    }

    if (!lang || lang === 'en') {
        return res.status(200).json(tutorial);
    }

    const translatedTutorial = JSON.parse(JSON.stringify(tutorial));
    translatedTutorial.title = (await freeTranslate(tutorial.title, lang)).split('\n')[0].trim();
    translatedTutorial.description = await freeTranslate(tutorial.description, lang);

    if (translatedTutorial.steps && translatedTutorial.steps.length > 0) {
        for (let i = 0; i < translatedTutorial.steps.length; i++) {
            translatedTutorial.steps[i].instruction = await freeTranslate(translatedTutorial.steps[i].instruction, lang);
        }
    }

    res.status(200).json(translatedTutorial);
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

    if (!tutorial) {
      return res.status(404).json({ message: "Tutorial not found" });
    }

    res.status(200).json({ message: "Tutorial updated successfully", tutorial });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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
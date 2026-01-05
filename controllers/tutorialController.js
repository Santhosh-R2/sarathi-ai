const Tutorial = require("../models/Tutorial");

// @desc    Add a new tutorial
// @route   POST /api/tutorials/add
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
        const tutorials = await Tutorial.find({}, 'title category description'); 
        res.json(tutorials);
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
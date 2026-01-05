const express = require("express");
const router = express.Router();
const { 
    addTutorial, 
    getTutorials, 
    getTutorialById, 
    updateTutorial, 
    deleteTutorial 
} = require("../controllers/tutorialController");

router.post("/add", addTutorial);
router.get("/", getTutorials);
router.get("/:id", getTutorialById);
router.put("/:id", updateTutorial);   
router.delete("/:id", deleteTutorial); 

module.exports = router;
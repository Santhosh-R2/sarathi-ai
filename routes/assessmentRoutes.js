const express = require('express');
const router = express.Router();
const assessCtrl = require('../controllers/assessmentController');
const { Quiz , QuizResult} = require('../models/AssessmentModels');

router.post('/admin/add-quiz', async (req, res) => {
    try {
        const newQuiz = new Quiz(req.body);
        await newQuiz.save();
        res.status(201).json({ message: "Quiz added successfully" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/quiz/:lessonId', assessCtrl.getQuiz);

router.post('/quiz/submit', assessCtrl.submitQuiz);
router.get('/report/:userId', assessCtrl.getWeeklyReport);
router.get('/results/:lessonId', async (req, res) => {
    try {
        const results = await QuizResult.find({ lessonId: req.params.lessonId })
            .populate('userId', 'fullName')
            .sort({ createdAt: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;
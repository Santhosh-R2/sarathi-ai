const { Quiz, QuizResult, UserProgress } = require('../models/AssessmentModels');
const Tutorial = require('../models/Tutorial'); 
const mongoose = require('mongoose');
const User = require('../models/User');
const pythonTranslatorWrapper = require('../services/pythonTranslatorWrapper');

const freeTranslate = async (text, to) => {
    try {
        if (!text) return "";
        return await pythonTranslatorWrapper.translate(text, to, process.env.GROQ_API_KEY);
    } catch (e) {
        console.error("Translation Error:", e.message);
        return text;
    }
};

exports.getQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ lessonId: req.params.lessonId });
        if (!quiz) return res.status(404).json({ message: "No quiz found for this lesson" });

        const userId = req.query.userId || req.body.userId;
        let langISO = 'en';
        
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            const user = await User.findById(userId);
            if (user && user.language) {
                langISO = user.language === "Malayalam" ? "ml" :
                    user.language === "Tamil" ? "ta" :
                        user.language === "Hindi" ? "hi" : "en";
            }
        }

        if (langISO === 'en') {
            return res.json(quiz);
        }
        
        const translatedQuiz = JSON.parse(JSON.stringify(quiz));
        
        for (let q of translatedQuiz.questions) {
            q.questionText = await freeTranslate(q.questionText, langISO);
            
            for (let i = 0; i < q.options.length; i++) {
                q.options[i] = await freeTranslate(q.options[i], langISO);
            }
            
            if (q.correctAnswer) {
                q.correctAnswer = await freeTranslate(q.correctAnswer, langISO);
            }
        }

        res.json(translatedQuiz);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

exports.submitQuiz = async (req, res) => {
  const { userId, lessonId, answers } = req.body; 

  try {
    const quiz = await Quiz.findOne({ lessonId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    let langISO = 'en';
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const user = await User.findById(userId);
        if (user && user.language) {
            langISO = user.language === "Malayalam" ? "ml" :
                user.language === "Tamil" ? "ta" :
                    user.language === "Hindi" ? "hi" : "en";
        }
    }

    let score = 0;
    let mistakes = [];

    for (let q of quiz.questions) {
        let expectedAnswer = q.correctAnswer;
        let expectedQuestionText = q.questionText;

        if (langISO !== 'en') {
            expectedAnswer = await freeTranslate(q.correctAnswer, langISO);
            expectedQuestionText = await freeTranslate(q.questionText, langISO);
        }

        if (answers[q._id] === expectedAnswer) {
            score++;
        } else {
            mistakes.push(expectedQuestionText);
        }
    }

    let recommendations = [];
    if (mistakes.length > 0) {
      const currentTutorial = await Tutorial.findById(lessonId);
      const suggested = await Tutorial.find({ 
        category: currentTutorial.category, 
        _id: { $ne: lessonId } 
      }).limit(2);
      recommendations = suggested.map(t => `Review: ${t.title}`);
    } else {
      recommendations.push("Excellent work! You are ready for the next level.");
    }

    const result = new QuizResult({
      userId,
      lessonId,
      score,
      totalQuestions: quiz.questions.length,
      mistakes,
      recommendations
    });

    await result.save();

    const existingProgress = await UserProgress.findOne({ 
      userId, 
      "completedLessons.lessonId": lessonId 
    });

    const isNewLesson = !existingProgress;

    await UserProgress.findOneAndUpdate(
      { userId },
      { 
        $addToSet: { completedLessons: { lessonId } },
        $inc: { "weeklyStats.lessonsThisWeek": isNewLesson ? 1 : 0 }
      },
      { upsert: true }
    );

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getWeeklyReport = async (req, res) => {
  const { userId } = req.params;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const progress = await UserProgress.findOne({ userId }).populate('completedLessons.lessonId');
    
    if (!progress) {
      return res.status(200).json({
        lessonsCompleted: 0,
        lessonTitles: [],
        averageQuizScore: 0,
        status: "No data yet"
      });
    }

    const weeklyLessons = progress.completedLessons.filter(l => l.completedAt >= sevenDaysAgo);
    
    const uniqueLessonsMap = new Map();
    weeklyLessons.forEach(l => {
      const id = l.lessonId._id.toString();
      if (!uniqueLessonsMap.has(id) || l.completedAt > uniqueLessonsMap.get(id).completedAt) {
        uniqueLessonsMap.set(id, l);
      }
    });
    const uniqueWeeklyLessons = Array.from(uniqueLessonsMap.values());

    const averageScoreResult = await QuizResult.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId), 
          createdAt: { $gte: sevenDaysAgo } 
        } 
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: "$lessonId",
          latestScore: { $first: "$score" }
        }
      },
      { 
        $group: { 
          _id: null, 
          avg: { $avg: "$latestScore" } 
        } 
      }
    ]);

    res.json({
      lessonsCompleted: uniqueWeeklyLessons.length,
      lessonTitles: uniqueWeeklyLessons.map(l => l.lessonId ? l.lessonId.title : "Deleted Lesson"),
      averageQuizScore: averageScoreResult.length > 0 ? averageScoreResult[0].avg : 0,
      status: uniqueWeeklyLessons.length >= 3 ? "On Track" : "Needs Improvement"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const { Quiz, QuizResult, UserProgress } = require('../models/AssessmentModels');
const Tutorial = require('../models/Tutorial'); 
const mongoose = require('mongoose');

exports.submitQuiz = async (req, res) => {
  const { userId, lessonId, answers } = req.body; 

  try {
    const quiz = await Quiz.findOne({ lessonId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    let score = 0;
    let mistakes = [];

    quiz.questions.forEach((q) => {
      if (answers[q._id] === q.correctAnswer) {
        score++;
      } else {
        mistakes.push(q.questionText);
      }
    });

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

    await UserProgress.findOneAndUpdate(
      { userId },
      { 
        $addToSet: { completedLessons: { lessonId } },
        $inc: { "weeklyStats.lessonsThisWeek": 1 }
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
        const averageScore = await QuizResult.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId), 
          createdAt: { $gte: sevenDaysAgo } 
        } 
      },
      { 
        $group: { 
          _id: null, 
          avg: { $avg: "$score" } 
        } 
      }
    ]);

    res.json({
      lessonsCompleted: weeklyLessons.length,
      lessonTitles: weeklyLessons.map(l => l.lessonId ? l.lessonId.title : "Deleted Lesson"),
      averageQuizScore: averageScore.length > 0 ? averageScore[0].avg : 0,
      status: weeklyLessons.length >= 3 ? "On Track" : "Needs Improvement"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
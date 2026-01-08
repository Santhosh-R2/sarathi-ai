const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutorial', required: true },
  questions: [{
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: String, required: true }, 
    type: { type: String, enum: ['radio', 'checkbox'], default: 'radio' }
  }]
});

const userProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completedLessons: [{
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutorial' },
    completedAt: { type: Date, default: Date.now }
  }],
  weeklyStats: {
    lessonsThisWeek: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  }
});

const quizResultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutorial', required: true },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  mistakes: [String], 
  recommendations: [String], 
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  Quiz: mongoose.model('Quiz', quizSchema),
  UserProgress: mongoose.model('UserProgress', userProgressSchema),
  QuizResult: mongoose.model('QuizResult', quizResultSchema)
};
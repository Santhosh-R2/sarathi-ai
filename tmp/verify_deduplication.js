const mongoose = require('mongoose');
const { UserProgress, QuizResult } = require('./models/AssessmentModels');
const Tutorial = require('./models/Tutorial');
const dotenv = require('dotenv');

dotenv.config();

async function runVerification() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ai-saradhi';
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const userId = new mongoose.Types.ObjectId();
    const lessonId1 = new mongoose.Types.ObjectId();
    const lessonId2 = new mongoose.Types.ObjectId();

    // Mock Tutorials
    await Tutorial.create([
      { _id: lessonId1, title: "Lesson 1", description: "Desc 1", category: "Smartphone" },
      { _id: lessonId2, title: "Lesson 2", description: "Desc 2", category: "Smartphone" }
    ]);

    console.log("Created mock tutorials");

    // Simulate submitQuiz logic for Lesson 1 (Attempt 1)
    const mockSubmit = async (lId, score) => {
      const existingProgress = await UserProgress.findOne({ 
        userId, 
        "completedLessons.lessonId": lId 
      });
      const isNewLesson = !existingProgress;

      await UserProgress.findOneAndUpdate(
        { userId },
        { 
          $addToSet: { completedLessons: { lessonId: lId, completedAt: new Date() } },
          $inc: { "weeklyStats.lessonsThisWeek": isNewLesson ? 1 : 0 }
        },
        { upsert: true }
      );

      await QuizResult.create({
        userId,
        lessonId: lId,
        score,
        totalQuestions: 5,
        mistakes: [],
        recommendations: []
      });
    };

    console.log("Submitting Lesson 1 Attempt 1...");
    await mockSubmit(lessonId1, 4);
    
    console.log("Submitting Lesson 1 Attempt 2...");
    await mockSubmit(lessonId1, 5); // Retrying the same lesson

    console.log("Submitting Lesson 2 Attempt 1...");
    await mockSubmit(lessonId2, 3);

    const progress = await UserProgress.findOne({ userId });
    console.log("UserProgress lessonsThisWeek (expected 2):", progress.weeklyStats.lessonsThisWeek);

    // Verify Weekly Report Logic (Manual Implementation from getWeeklyReport)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const fullProgress = await UserProgress.findOne({ userId }).populate('completedLessons.lessonId');
    const weeklyLessons = fullProgress.completedLessons.filter(l => l.completedAt >= sevenDaysAgo);

    const uniqueLessonsMap = new Map();
    weeklyLessons.forEach(l => {
      const id = l.lessonId._id.toString();
      if (!uniqueLessonsMap.has(id) || l.completedAt > uniqueLessonsMap.get(id).completedAt) {
        uniqueLessonsMap.set(id, l);
      }
    });
    const uniqueWeeklyLessons = Array.from(uniqueLessonsMap.values());

    console.log("Reported Lessons Count (expected 2):", uniqueWeeklyLessons.length);
    console.log("Reported Lesson Titles:", uniqueWeeklyLessons.map(l => l.lessonId.title));

    const averageScoreResult = await QuizResult.aggregate([
      { 
        $match: { 
          userId: userId, 
          createdAt: { $gte: sevenDaysAgo } 
        } 
      },
      { $sort: { createdAt: -1 } },
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

    const finalAvg = averageScoreResult.length > 0 ? averageScoreResult[0].avg : 0;
    console.log("Average Quiz Score (expected average of 5 and 3 = 4):", finalAvg);

    // Cleanup
    await UserProgress.deleteOne({ userId });
    await QuizResult.deleteMany({ userId });
    await Tutorial.deleteOne({ _id: lessonId1 });
    await Tutorial.deleteOne({ _id: lessonId2 });
    
    await mongoose.disconnect();
    console.log("Verification complete and cleaned up.");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  }
}

runVerification();

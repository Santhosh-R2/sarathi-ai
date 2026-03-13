const mongoose = require('mongoose');
require('dotenv').config();

const Tutorial = require('./models/Tutorial');

async function runTest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB.");

        const tutorials = await Tutorial.find({}, 'title category');
        console.log("Tutorials:");
        tutorials.forEach(t => console.log(`- ${t.title} (${t.category})`));

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();

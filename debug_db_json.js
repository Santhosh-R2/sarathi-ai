const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const Tutorial = require('./models/Tutorial');

async function runTest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tutorials = await Tutorial.find({}, 'title category');
        fs.writeFileSync('db_out.json', JSON.stringify(tutorials, null, 2));
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();

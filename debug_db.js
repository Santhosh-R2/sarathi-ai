const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Tutorial = require('./models/Tutorial');

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log("Connected to MongoDB");
        const count = await Tutorial.countDocuments();
        console.log(`Total Tutorials: ${count}`);
        const tutorials = await Tutorial.find({}, "title");
        console.log("Tutorial Titles:", tutorials.map(t => t.title));
        process.exit(0);
    })
    .catch(err => {
        console.error("MongoDB Error:", err);
        process.exit(1);
    });

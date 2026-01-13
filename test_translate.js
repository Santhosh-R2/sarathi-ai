const pythonTranslatorWrapper = require('./services/pythonTranslatorWrapper');
const dotenv = require('dotenv');
dotenv.config();

async function test() {
    console.log("Testing translation strictness...");
    const text = "How to post a photo on Instagram";
    const result = await pythonTranslatorWrapper.translate(text, 'ml', process.env.GROQ_API_KEY);
    console.log("Original:", text);
    console.log("Translated:", result);

    if (result.includes('\n') || result.length > 100) {
        console.error("FAIL: Translation is too long or includes steps!");
    } else {
        console.log("PASS: Translation is concise.");
    }
    process.exit(0);
}

test();

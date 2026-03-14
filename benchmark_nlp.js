const mongoose = require('mongoose');
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const Tutorial = require('./models/Tutorial');

const BASIC_FAQS = [
    { q: "pay money to shop" }, { q: "send money to friend" }, { q: "check bank balance" },
    { q: "mobile recharge" }, { q: "electricity bill payment" }, { q: "gas cylinder booking" },
    { q: "what is digilocker" }, { q: "internet not working" }, { q: "phone is hanging" },
    { q: "how to use whatsapp" }, { q: "send location on whatsapp" }, { q: "is otp safe" },
    { q: "how to block scam calls" }, { q: "how to update apps" }, { q: "battery dying fast" },
    { q: "how to take photo" }, { q: "what is upi" }, { q: "forgot password" },
    { q: "how to search news" }, { q: "connect to wifi" }, { q: "how to use flashlight" },
    { q: "how to voice type" }, { q: "set an alarm" }, { q: "check aadhaar status" }
];

async function runBenchmark() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tutorials = await Tutorial.find({}, 'title');
        const dbTitles = tutorials.map(t => t.title);
        const faqTitles = BASIC_FAQS.map(f => f.q);
        const allOptions = [...faqTitles, ...dbTitles];

        const scriptPath = path.join(process.cwd(), 'python_services', 'nlp_matcher.py');
        const pythonProcess = spawn('python', [scriptPath]);
        const rl = readline.createInterface({ input: pythonProcess.stdout, terminal: false });

        const testCases = [];
        dbTitles.forEach(t => testCases.push({ q: t, expected: t, type: "Exact DB" }));
        dbTitles.forEach(t => testCases.push({ q: "How to " + t.toLowerCase(), expected: t, type: "Phrasing DB" }));
        faqTitles.slice(0, 5).forEach(t => testCases.push({ q: t, expected: t, type: "Exact FAQ" }));

        console.log(`Running benchmark on ${testCases.length} test cases...`);

        let passed = 0;
        for (const tc of testCases) {
            pythonProcess.stdin.write(JSON.stringify({
                userQuery: tc.q,
                nativeQuery: tc.q,
                options: allOptions,
                apiKey: "dummy",
                language: "English"
            }) + "\n");

            const result = await new Promise(resolve => rl.once('line', line => resolve(JSON.parse(line))));
            
            const isCorrect = result.match && result.match.toLowerCase() === tc.expected.toLowerCase();
            if (isCorrect) passed++;
            else {
                console.log(`FAILED [${tc.type}]: Query "${tc.q}" | Expected "${tc.expected}" | Got "${result.match}"`);
            }
        }

        console.log(`Result: ${passed}/${testCases.length} passed. Accuracy: ${((passed/testCases.length)*100).toFixed(2)}%`);

        pythonProcess.kill();
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

runBenchmark();

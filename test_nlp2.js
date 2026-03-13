const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const scriptPath = path.join(process.cwd(), 'python_services', 'nlp_matcher.py');
const pythonProcess = spawn('python', [scriptPath]);

const rl = readline.createInterface({
    input: pythonProcess.stdout,
    terminal: false
});

rl.on('line', (line) => {
    console.log("Python NLP Result:", line);
    process.exit(0);
});

pythonProcess.stderr.on('data', (data) => {
    console.error(`Python NLP Stderr: ${data.toString()}`);
});

const payload = JSON.stringify({
    userQuery: "how to acces mobile data in smartphone",
    nativeQuery: "How to acces mobile data in smartphone?",
    options: ["internet not working", "access mobile data", "take photo", "connect to wifi", "how to change whatsapp dp"],
    apiKey: "dummy",
    language: "English"
});

pythonProcess.stdin.write(payload + "\n");

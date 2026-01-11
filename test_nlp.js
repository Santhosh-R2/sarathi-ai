const fs = require('fs');
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'python_services', 'nlp_matcher.py');
const templatePath = path.join(__dirname, 'test_input_template.json');

const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
template.apiKey = process.env.GROQ_API_KEY;

const input = JSON.stringify(template);

const pythonProcess = spawn('python', [scriptPath]);

const stdoutStream = fs.createWriteStream('test_stdout.txt');
const stderrStream = fs.createWriteStream('test_stderr.txt');

pythonProcess.stdout.pipe(stdoutStream);
pythonProcess.stderr.pipe(stderrStream);

pythonProcess.on('close', (code) => {
    console.log(`Child process exited with code ${code}`);
});

pythonProcess.stdin.write(input + "\n");
pythonProcess.stdin.end();

const fs = require('fs');
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'python_services', 'nlp_matcher.py');
const templatePath = path.join(__dirname, 'test_input_template.json');

const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
template.apiKey = process.env.GROQ_API_KEY;

const input = JSON.stringify(template);

const readline = require('readline');

const pythonProcess = spawn('python', [scriptPath]);
const rl = readline.createInterface({ input: pythonProcess.stdout });

const stdoutStream = fs.createWriteStream('test_stdout.txt');
const stderrStream = fs.createWriteStream('test_stderr.txt');
pythonProcess.stderr.pipe(stderrStream);

rl.on('line', (line) => {
    console.log("Recieved Output:", line);
    stdoutStream.write(line + "\n");
    pythonProcess.kill(); // Close it after we get our test result
});

pythonProcess.on('close', (code) => {
    console.log(`Child process exited with code ${code}`);
    process.exit(0);
});

pythonProcess.stdin.write(input + "\n");

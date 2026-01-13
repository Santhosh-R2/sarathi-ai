const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

class PythonTranscriberWrapper {
    constructor() {
        this.pythonProcess = null;
        this.rl = null;
        this.pendingRequests = [];
        this.init();
    }

    init() {
        const scriptPath = path.join(process.cwd(), 'python_services', 'transcriber.py');
        const pythonCommand = process.platform === "win32" ? "python" : "python3";

        console.log(`Initializing Non-Groq Python Transcriber: ${pythonCommand} ${scriptPath}`);
        this.pythonProcess = spawn(pythonCommand, [scriptPath]);

        this.rl = readline.createInterface({
            input: this.pythonProcess.stdout,
            terminal: false
        });

        this.rl.on('line', (line) => {
            try {
                const result = JSON.parse(line.trim());
                const currentRequest = this.pendingRequests.shift();
                if (currentRequest) {
                    currentRequest.resolve(result);
                }
            } catch (e) {
                console.error("Error parsing Transcriber output:", e.message);
                const currentRequest = this.pendingRequests.shift();
                if (currentRequest) currentRequest.resolve({ text: "" });
            }
        });

        this.pythonProcess.on('close', (code) => {
            console.warn(`Transcriber Process exited with code ${code}. Restarting...`);
            setTimeout(() => this.init(), 1000);
        });
    }

    async transcribe(audioBase64, language) {
        return new Promise((resolve, reject) => {
            // Map Malayalam to Google's code
            const langCode = language === "Malayalam" ? "ml-IN" :
                language === "Tamil" ? "ta-IN" :
                    language === "Hindi" ? "hi-IN" : "en-US";

            const payload = JSON.stringify({ audio: audioBase64, language: langCode });
            this.pendingRequests.push({ resolve, reject });
            this.pythonProcess.stdin.write(payload + "\n");
        });
    }
}

module.exports = new PythonTranscriberWrapper();

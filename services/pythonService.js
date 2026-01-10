const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

class PythonService {
    constructor() {
        this.pythonProcess = null;
        this.requestQueue = [];
        this.isInitialized = false;
        this.scriptPath = path.join(__dirname, '..', 'python_services', 'nlp_matcher.py');
    }

    initialize() {
        if (this.isInitialized) return;

        console.log("Initializing Python NLP Service...");
        this.pythonProcess = spawn('python', [this.scriptPath]);

        // Create an interface to read line-by-line from stdout
        const rl = readline.createInterface({
            input: this.pythonProcess.stdout,
            terminal: false
        });

        rl.on('line', (line) => {
            this._handleResponse(line);
        });

        this.pythonProcess.stderr.on('data', (data) => {
            console.error('Python NLP Stderr:', data.toString());
        });

        this.pythonProcess.on('close', (code) => {
            console.warn(`Python NLP service exited with code ${code}. Restarting...`);
            this.isInitialized = false;
            this.pythonProcess = null;
            // Retry pending requests or reject them? 
            // For simplicity, we just reject current pending and let next call restart
            this._rejectAllPending("Service crashed");
        });

        this.isInitialized = true;
    }

    _handleResponse(line) {
        if (this.requestQueue.length === 0) return;

        const { resolve, reject } = this.requestQueue.shift();
        try {
            const result = JSON.parse(line);
            resolve(result.match);
        } catch (e) {
            console.error("Failed to parse Python response:", line);
            resolve("NONE"); // Fallback safety
        }
    }

    _rejectAllPending(reason) {
        while (this.requestQueue.length > 0) {
            const { reject } = this.requestQueue.shift();
            reject(new Error(reason));
        }
    }

    getMatch(userQuery, nativeQuery, availableTitles) {
        if (!this.isInitialized || !this.pythonProcess) {
            this.initialize();
        }

        return new Promise((resolve, reject) => {
            const requestPayload = {
                userQuery,
                nativeQuery,
                options: availableTitles,
                apiKey: process.env.GROQ_API_KEY
            };

            // Add to queue BEFORE writing to ensure order
            this.requestQueue.push({ resolve, reject });

            try {
                this.pythonProcess.stdin.write(JSON.stringify(requestPayload) + "\n");
            } catch (err) {
                // If write fails, remove from queue and reject
                this.requestQueue.pop();
                reject(err);
            }
        });
    }
}

// Singleton instance
module.exports = new PythonService();

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

class PythonTranslatorWrapper {
    constructor() {
        this.pythonProcess = null;
        this.rl = null;
        this.pendingRequests = [];
        this.cache = new Map(); // Simple in-memory cache
        this.MAX_CACHE_SIZE = 200;
        this.isCoolingDown = false;
        this.COOL_DOWN_MS = 60000; // Stop calling Groq for 1 min if rate limited
        this.init();
    }

    init() {
        const scriptPath = path.join(process.cwd(), 'python_services', 'translator.py');
        const pythonCommand = process.platform === "win32" ? "python" : "python3";

        console.log(`Initializing Persistent Python Translator Service: ${pythonCommand} ${scriptPath}`);
        this.pythonProcess = spawn(pythonCommand, [scriptPath]);

        this.rl = readline.createInterface({
            input: this.pythonProcess.stdout,
            terminal: false
        });

        this.rl.on('line', (line) => {
            try {
                const trimmedLine = line.trim();
                const result = JSON.parse(trimmedLine);
                const currentRequest = this.pendingRequests.shift();

                if (currentRequest) {
                    if (result.error) {
                        console.error("Python Translator Script Error:", result.error);
                        if (result.error.includes("429")) {
                            this.triggerCoolDown();
                        }
                        currentRequest.resolve(currentRequest.originalText);
                    } else {
                        // Store in cache
                        const cacheKey = `${currentRequest.text}_${currentRequest.targetLang}`;
                        this.addToCache(cacheKey, result.translated);
                        currentRequest.resolve(result.translated);
                    }
                }
            } catch (e) {
                console.error("Error parsing Python Translator output:", e.message, line);
                const currentRequest = this.pendingRequests.shift();
                if (currentRequest) {
                    currentRequest.resolve(currentRequest.originalText);
                }
            }
        });

        this.pythonProcess.stderr.on('data', (data) => {
            const stderrStr = data.toString();
            console.error(`Python Translator Stderr: ${stderrStr}`);
            if (stderrStr.includes("429")) {
                // Internal retry failed, trigger cool down early
                this.triggerCoolDown();
            }
        });

        this.pythonProcess.on('close', (code) => {
            console.warn(`Python Translator Process exited with code ${code}. Restarting...`);
            setTimeout(() => this.init(), 1000);
        });
    }

    triggerCoolDown() {
        if (!this.isCoolingDown) {
            console.warn(`Translation Rate limit hit. Cooling down translator for ${this.COOL_DOWN_MS / 1000}s...`);
            this.isCoolingDown = true;
            setTimeout(() => {
                this.isCoolingDown = false;
                console.log("Translator cool down ended.");
            }, this.COOL_DOWN_MS);
        }
    }

    addToCache(key, value) {
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    async translate(text, targetLang, apiKey) {
        if (!text) return "";

        // Check cache first
        const cacheKey = `${text}_${targetLang}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Check cool down
        if (this.isCoolingDown) {
            return text; // Fallback to original text immediately
        }

        return new Promise((resolve, reject) => {
            const payload = JSON.stringify({
                text,
                target_lang: targetLang,
                apiKey
            });

            this.pendingRequests.push({ resolve, reject, originalText: text, text, targetLang });
            this.pythonProcess.stdin.write(payload + "\n");
        });
    }
}

module.exports = new PythonTranslatorWrapper();

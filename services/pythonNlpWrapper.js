const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

class PythonNlpWrapper {
    constructor() {
        this.pythonProcess = null;
        this.rl = null;
        this.pendingRequests = [];
        this.cache = new Map();
        this.MAX_CACHE_SIZE = 100;
        this.isCoolingDown = false;
        this.COOL_DOWN_MS = 60000;
        this.init();
    }

    init() {
        const scriptPath = path.join(process.cwd(), 'python_services', 'nlp_matcher.py');
        const pythonCommand = process.platform === "win32" ? "python" : "python3";

        console.log(`Initializing Persistent Python NLP Service: ${pythonCommand} ${scriptPath}`);
        this.pythonProcess = spawn(pythonCommand, [scriptPath]);

        this.rl = readline.createInterface({
            input: this.pythonProcess.stdout,
            terminal: false
        });

        this.rl.on('line', (line) => {
            try {
                const trimmedLine = line.trim();
                console.log("Python NLP Result:", trimmedLine);
                const result = JSON.parse(trimmedLine);
                const currentRequest = this.pendingRequests.shift();

                if (currentRequest) {
                    if (result.error && result.error.includes("429")) {
                        this.triggerCoolDown();
                    }
                    if (!result.error) {
                        this.addToCache(currentRequest.cacheKey, result);
                    }
                    currentRequest.resolve(result);
                }
            } catch (e) {
                console.error("Error parsing Python output:", e.message, line);
                const currentRequest = this.pendingRequests.shift();
                if (currentRequest) {
                    currentRequest.resolve({ match: "NONE", error: "JSON Parse Error" });
                }
            }
        });

        this.pythonProcess.stderr.on('data', (data) => {
            const stderrStr = data.toString();
            console.error(`Python NLP Stderr: ${stderrStr}`);
            if (stderrStr.includes("429")) {
                this.triggerCoolDown();
            }
        });

        this.pythonProcess.on('close', (code) => {
            console.warn(`Python NLP Process exited with code ${code}. Restarting...`);
            setTimeout(() => this.init(), 1000);
        });
    }

    triggerCoolDown() {
        if (!this.isCoolingDown) {
            console.warn(`NLP Rate limit hit. Cooling down for ${this.COOL_DOWN_MS / 1000}s...`);
            this.isCoolingDown = true;
            setTimeout(() => {
                this.isCoolingDown = false;
                console.log("NLP cool down ended.");
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

    async getMatch(userQuery, nativeQuery, options, apiKey, language) {
        const cacheKey = `${userQuery}_${nativeQuery}_${language}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        if (this.isCoolingDown) {
            return { match: "NONE", source: "cooldown_fallback" };
        }

        return new Promise((resolve, reject) => {
            const payload = JSON.stringify({
                userQuery,
                nativeQuery,
                options,
                apiKey,
                language: language || "English"
            });

            this.pendingRequests.push({ resolve, reject, cacheKey });
            this.pythonProcess.stdin.write(payload + "\n");
        });
    }
}

module.exports = new PythonNlpWrapper();
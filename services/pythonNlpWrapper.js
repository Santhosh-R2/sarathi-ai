const { spawn } = require('child_process');
const path = require('path');

class PythonNlpWrapper {
    async getMatch(userQuery, nativeQuery, options, apiKey, language) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(process.cwd(), 'python_services', 'nlp_matcher.py');

            // DYNAMIC COMMAND: Use 'python' for Windows, 'python3' for Vercel/Linux
            const pythonCommand = process.platform === "win32" ? "python" : "python3";

            console.log(`Spawning ${pythonCommand} for NLP...`);
            const pythonProcess = spawn(pythonCommand, [scriptPath]);

            let output = "";
            let error = "";

            const payload = JSON.stringify({
                userQuery,
                nativeQuery,
                options,
                apiKey,
                language: language || "English"
            });

            pythonProcess.stdin.write(payload + "\n");
            pythonProcess.stdin.end();

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                error += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Python process failed with code ${code}. Error: ${error}`);
                    return reject(new Error("NLP Process Failed"));
                }
                try {
                    const trimmedOutput = output.trim();
                    console.log("Python NLP Raw Output:", trimmedOutput);
                    const result = JSON.parse(trimmedOutput);
                    if (result.error) {
                        console.error("Python NLP Script Error:", result.error);
                    }
                    resolve(result);
                } catch (e) {
                    console.error("JSON Parse Error for Python output:", e.message, "Raw:", output);
                    reject(new Error("Invalid JSON from NLP service"));
                }
            });
        });
    }
}

module.exports = new PythonNlpWrapper();
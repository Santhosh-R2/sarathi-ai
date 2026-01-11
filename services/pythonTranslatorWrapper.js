const { spawn } = require('child_process');
const path = require('path');

class PythonTranslatorWrapper {
    async translate(text, targetLang, apiKey) {
        if (!text) return "";

        return new Promise((resolve, reject) => {
            const scriptPath = path.join(process.cwd(), 'python_services', 'translator.py');

            // DYNAMIC COMMAND: Use 'python' for Windows, 'python3' for Vercel/Linux
            const pythonCommand = process.platform === "win32" ? "python" : "python3";

            const pythonProcess = spawn(pythonCommand, [scriptPath]);

            let output = "";
            let error = "";

            const payload = JSON.stringify({
                text,
                target_lang: targetLang,
                apiKey
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
                    console.error(`Python Translation process failed with code ${code}. Error: ${error}`);
                    // Fallback to original text if process fails
                    return resolve(text);
                }
                try {
                    const result = JSON.parse(output.trim());
                    if (result.error) {
                        console.error("Python Translation Script Error:", result.error);
                        return resolve(text);
                    }
                    resolve(result.translated);
                } catch (e) {
                    console.error("JSON Parse Error for Python Translation output:", e.message, "Raw:", output);
                    resolve(text);
                }
            });
        });
    }
}

module.exports = new PythonTranslatorWrapper();

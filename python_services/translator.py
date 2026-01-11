import sys
import json
import os
import urllib.request
import urllib.error
import io

# --- ENCODING FIX ---
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def call_groq_translate(text, target_lang_iso, api_key):
    """
    Calls Groq API for high-quality translation.
    """
    url = "https://api.groq.com/openai/v1/chat/completions"
    
    # Map ISO to full name for better LLM understanding if needed, 
    # but Llama 3 is usually good with ISO if prompted well.
    lang_map = {
        "en": "English",
        "ml": "Malayalam",
        "ta": "Tamil",
        "hi": "Hindi",
        "kn": "Kannada",
        "te": "Telugu"
    }
    target_lang = lang_map.get(target_lang_iso, target_lang_iso)

    prompt = f"""
    You are a professional translator. 
    Translate the following text to {target_lang}.
    
    Rules:
    1. Maintain the original meaning and tone.
    2. If the text is already in the target language, return it as is.
    3. Return ONLY the translated text, no explanations or extra characters.
    4. For technical terms like "WhatsApp", "GPay", "UPI", keep them or use their standard local script equivalent.
    
    Text to translate:
    "{text}"
    """

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "SarathiTranslator/1.0")
    
    sys.stderr.write(f"Translating: '{text}' to '{target_lang_iso}'\n")
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read()
            res_json = json.loads(res_body)
            content = res_json['choices'][0]['message']['content'].strip()
            sys.stderr.write(f"LLM Response: '{content}'\n")
            # Clean up potential quotes added by LLM
            if content.startswith('"') and content.endswith('"'):
                content = content[1:-1]
            return content
    except Exception as e:
        sys.stderr.write(f"Translation API Error: {str(e)}\n")
        return text

def main():
    for line in sys.stdin:
        try:
            line = line.strip()
            if not line:
                continue
                
            request = json.loads(line)
            text = request.get("text", "")
            target_lang = request.get("target_lang", "en")
            api_key = request.get("apiKey", "")

            if not text:
                print(json.dumps({"translated": ""}, ensure_ascii=False))
                sys.stdout.flush()
                break

            if api_key:
                translated = call_groq_translate(text, target_lang, api_key)
                print(json.dumps({"translated": translated}, ensure_ascii=False))
                sys.stdout.flush()
                break
            else:
                # Fallback if no API key
                print(json.dumps({"translated": text, "error": "No API key provided"}, ensure_ascii=False))
                sys.stdout.flush()
                break

        except Exception as e:
            print(json.dumps({"translated": "", "error": str(e)}, ensure_ascii=False))
            sys.stdout.flush()
            break

if __name__ == "__main__":
    main()

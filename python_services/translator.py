import sys
import json
import os
import urllib.request
import urllib.error
import io
import time
import random

# --- ENCODING FIX ---
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from deep_translator import GoogleTranslator

def translate_text(text, target_lang_iso):
    """
    Uses deep-translator (Google Translate) for robust, model-based translation.
    This replaces Groq to avoid 429 rate limits and provide more consistent results.
    """
    try:
        # deep-translator handles the ISO codes directly
        # Some mappings if needed
        lang_fixes = {
            "en": "en",
            "ml": "ml",
            "hi": "hi",
            "ta": "ta",
            "kn": "kn",
            "te": "te"
        }
        target = lang_fixes.get(target_lang_iso, target_lang_iso)
        
        translator = GoogleTranslator(source='auto', target=target)
        result = translator.translate(text)
        
        # --- CUSTOM REPLACEMENTS FOR MALAYALAM ---
        if target == 'ml' and result:
            # User wants "സ്റ്റെപ്പ്" instead of generic "ഘട്ടം"
            result = result.replace("ഘട്ടം", "സ്റ്റെപ്പ്")
            result = result.replace("Step", "സ്റ്റെപ്പ്")
        
        if result and result.startswith('"') and result.endswith('"'):
            result = result[1:-1]
            
        return result if result else text
    except Exception as e:
        sys.stderr.write(f"Translation Library Error: {str(e)}\n")
        return text

def main():
    # Persistent loop: read line-by-line from stdin
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
                continue

            if text:
                translated = translate_text(text, target_lang)
                print(json.dumps({"translated": translated}, ensure_ascii=False))
                sys.stdout.flush()
            else:
                print(json.dumps({"translated": text}, ensure_ascii=False))
                sys.stdout.flush()

        except Exception as e:
            print(json.dumps({"translated": "", "error": str(e)}, ensure_ascii=False))
            sys.stdout.flush()

if __name__ == "__main__":
    main()

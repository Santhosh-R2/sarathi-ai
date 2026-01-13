import sys
import json
import io
import speech_recognition as sr
import base64
import os

# --- ENCODING FIX ---
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def transcribe_audio(audio_base64, language_code):
    """
    Transcribes audio using SpeechRecognition (Google Free API).
    Avoids Groq completely.
    """
    try:
        # 1. Decode base64 to temporary wav
        audio_data = base64.b64decode(audio_base64)
        tmp_filename = "tmp_audio.wav"
        with open(tmp_filename, "wb") as f:
            f.write(audio_data)
        
        # 2. Recognize
        r = sr.Recognizer()
        with sr.AudioFile(tmp_filename) as source:
            audio = r.record(source)
            # Use google search's free API
            text = r.recognize_google(audio, language=language_code)
            
        # 3. Cleanup
        if os.path.exists(tmp_filename):
            os.remove(tmp_filename)
            
        return text
    except Exception as e:
        sys.stderr.write(f"Transcription Error: {str(e)}\n")
        return ""

def main():
    for line in sys.stdin:
        try:
            line = line.strip()
            if not line: continue
            
            req = json.loads(line)
            audio_b64 = req.get("audio")
            lang = req.get("language", "ml-IN") # Default to Malayalam (India)
            
            if audio_b64:
                text = transcribe_audio(audio_b64, lang)
                print(json.dumps({"text": text}, ensure_ascii=False))
                sys.stdout.flush()
            else:
                print(json.dumps({"text": ""}, ensure_ascii=False))
                sys.stdout.flush()
        except Exception as e:
            print(json.dumps({"error": str(e)}, ensure_ascii=False))
            sys.stdout.flush()

if __name__ == "__main__":
    main()

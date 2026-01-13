import sys
import json
import difflib
import os
import urllib.request
import urllib.error
import urllib.parse
import unicodedata
import io
import time
import random

# --- ENCODING FIX ---
# Forces the script to use UTF-8 regardless of the environment's default.
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def normalize_text(text):
    """Normalize unicode characters"""
    if not text:
        return ""
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')

def fuzzy_match(query, options, threshold=0.6):
    """
    Finds the best match from options using fuzzy logic.
    Returns (best_match, score).
    """
    if not query or not options:
        return None, 0
    
    # Normalize query
    query = query.lower().strip()
    
    # Quick direct partial check: Is the topic name IN the user's query?
    for opt in options:
        if opt.lower() in query:
            return opt, 1.0

    matches = difflib.get_close_matches(query, options, n=1, cutoff=threshold)
    if matches:
        return matches[0], difflib.SequenceMatcher(None, query, matches[0]).ratio()
    return None, 0


from deep_translator import GoogleTranslator

def match_intent_locally(user_query, native_query, available_topics, language="Malayalam"):
    """
    Finds the BEST match using local fuzzy logic and Google Translate for alignment.
    Strictly avoids Groq API to prevent 429 errors.
    """
    try:
        u_query = (user_query or "").lower().strip()
        n_query = (native_query or "").lower().strip()
        
        # 1. Direct Keyword Check (No translation needed for exact tech names)
        # Check both original English and the Native text for exact model names
        for t in available_topics:
            t_low = t.lower()
            if t_low in u_query or t_low in n_query:
                return t, n_query # High confidence direct hit
        
        # 2. Alignment via English Translation
        translator_to_en = GoogleTranslator(source='auto', target='en')
        # We translate the native query to English to match against English topics
        translated_en = translator_to_en.translate(n_query) if n_query else u_query
        
        # 3. Fuzzy Match against English Topic List
        topic, score = fuzzy_match(translated_en, available_topics, threshold=0.7)
        
        # 4. Keyword Boost
        # If specific keywords are present in the translated text, favor those
        for t in available_topics:
            if t.lower() in translated_en.lower() or t.lower() in u_query:
                topic = t
                score = 1.0
                break
        
        # 5. Native Correction
        # Minimalist correction via translation (ML/TA)
        target_iso = "ml" if language == "Malayalam" else "ta"
        translator_to_native = GoogleTranslator(source='auto', target=target_iso)
        corrected_native = translator_to_native.translate(n_query) if n_query else n_query
        
        if score > 0.6:
            return topic, corrected_native
        return "NONE", corrected_native

    except Exception as e:
        sys.stderr.write(f"Local Matcher Error: {str(e)}\n")
        # Fallback to pure fuzzy without translation if library fails
        topic, _ = fuzzy_match(u_query, available_topics, threshold=0.6)
        return topic or "NONE", native_query

def main():
    # Persistent loop: read line-by-line from stdin
    for line in sys.stdin:
        try:
            line = line.strip()
            if not line:
                continue
                
            request = json.loads(line)
            
            user_query = request.get("userQuery", "")
            native_query = request.get("nativeQuery", "")
            options = request.get("options", [])
            api_key = request.get("apiKey", "")
            language = request.get("language", "Malayalam")

            ai_match, corrected_native = match_intent_locally(user_query, native_query, options, language)
            
            print(json.dumps({
                "match": ai_match, 
                "source": "local_model", 
                "correctedNative": corrected_native
            }, ensure_ascii=False))
            sys.stdout.flush()
            continue

            # Fallback if no API key
            best_match, score = fuzzy_match(user_query, options)
            final_res = best_match if (best_match and score > 0.6) else "NONE"
            print(json.dumps({
                "match": final_res, 
                "source": "fuzzy_fallback", 
                "correctedNative": native_query
            }, ensure_ascii=False))
            sys.stdout.flush()

        except Exception as e:
            print(json.dumps({"match": "NONE", "error": str(e)}, ensure_ascii=False))
            sys.stdout.flush()

if __name__ == "__main__":
    main()
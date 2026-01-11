import sys
import json
import difflib
import os
import urllib.request
import urllib.error
import urllib.parse
import unicodedata
import io

# --- VERCEL ENCODING FIX ---
# Forces the script to use UTF-8 regardless of the environment's default.
# This is critical for handling Malayalam, Tamil, and Hindi characters.
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
    
    # Quick direct partial check
    for opt in options:
        if query in opt.lower():
            return opt, 1.0

    matches = difflib.get_close_matches(query, options, n=1, cutoff=threshold)
    if matches:
        return matches[0], difflib.SequenceMatcher(None, query, matches[0]).ratio()
    return None, 0


def call_groq_api(user_query, native_query, available_topics, api_key, language="Native Language"):
    """
    Calls Groq API for semantic matching and spelling correction.
    Returns (match_string, corrected_native_string).
    """
    url = "https://api.groq.com/openai/v1/chat/completions"
    topics_str = ", ".join(available_topics)
    
    # Prompt optimized for Llama 3.1
    prompt = f"""
    You are an intelligent intent classification engine for a Help App.
    
    Context:
    - The user is speaking in: {language}
    - "Native Input" is the raw transcription.
    - "English Input" is the machine translation.
    
    Inputs:
    1. English Input: "{user_query}"
    2. Native Input: "{native_query}"
    
    Available Topics:
    [{topics_str}]

    Glossary of Correct Spellings (Use these exactly):
    - WhatsApp / വാട്‌സാപ്പ് / व्हाट्सएप
    - GPay / Google Pay / ഗൂഗിൾ പേ / गूगल पे
    - DigiLocker / ഡിജിലോക്കർ / डिजिलॉकर
    - Aadhaar / ആധാർ / आधार
    - UPI / യുപിഐ / यूपीआई
    
    Task:
    1. Identify the best matching Topic from the list. If no match, use "NONE".
    2. Correct the spelling/grammar of the Native Input into standard colloquial {language}.
    
    Output Format:
    Return ONLY a JSON object with this exact structure:
    {{
      "match": "Exact Topic Name or NONE",
      "correctedNative": "The corrected native sentence string"
    }}
    """

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "SarathiNLP/1.0")
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read()
            res_json = json.loads(res_body)
            content = res_json['choices'][0]['message']['content'].strip()
            parsed = json.loads(content)
            return parsed.get("match", "NONE"), parsed.get("correctedNative", native_query)
    except Exception as e:
        # Fallback to original input on API failure
        return "NONE", native_query

def main():
    # Read the JSON payload from Node.js stdin
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
            language = request.get("language", "Native Language")

            if api_key:
                ai_match, corrected_native = call_groq_api(user_query, native_query, options, api_key, language)
                
                # Verify match against available options
                final_match = "NONE"
                if ai_match in options:
                    final_match = ai_match
                else:
                    # Double check via fuzzy for slight variations in AI response
                    fuzzy_m, score = fuzzy_match(ai_match, options, threshold=0.8)
                    if fuzzy_m:
                        final_match = fuzzy_m

                # ensure_ascii=False is MANDATORY for Malayalam/Hindi output
                print(json.dumps({
                    "match": final_match, 
                    "source": "ai", 
                    "correctedNative": corrected_native
                }, ensure_ascii=False))
                sys.stdout.flush()
                # Break after processing for serverless efficiency
                break

            # Fallback if no API key
            best_match, score = fuzzy_match(user_query, options)
            final_res = best_match if (best_match and score > 0.6) else "NONE"
            print(json.dumps({
                "match": final_res, 
                "source": "fuzzy_fallback", 
                "correctedNative": native_query
            }, ensure_ascii=False))
            sys.stdout.flush()
            break

        except Exception as e:
            # Send error back as JSON so Node.js can parse it
            print(json.dumps({"match": "NONE", "error": str(e)}, ensure_ascii=False))
            sys.stdout.flush()
            break

if __name__ == "__main__":
    main()
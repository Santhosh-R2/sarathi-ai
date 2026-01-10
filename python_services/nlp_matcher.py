import sys
import json
import difflib
import os
import urllib.request
import urllib.parse

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

def call_groq_api(user_query, native_query, available_topics, api_key):
    """
    Calls Groq API for semantic matching when fuzzy matching fails.
    """
    url = "https://api.groq.com/openai/v1/chat/completions"
    topics_str = ", ".join(available_topics)
    
    prompt = f"""
    You are an intent classification engine.
    User input (English): "{user_query}"
    User input (Native/Original): "{native_query}"
    
    Available Knowledge Base Topics:
    [{topics_str}]
    
    Task: Identify which Topic best matches the user's intent.
    - If the user is asking about something covered in the Topics, return ONLY the exact Topic string.
    - If there is no matching topic, return "NONE".
    - Do not output any explanation, markdown, or punctuation. Just the topic name.
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
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read()
            res_json = json.loads(res_body)
            content = res_json['choices'][0]['message']['content'].strip()
            # Cleanup any potential quotes or periods
            content = content.replace('"', '').replace('.', '')
            return content
    except Exception as e:
        # Fallback or log error to stderr if needed
        sys.stderr.write(f"Groq API Error: {str(e)}\n")
        return "NONE"

def main():
    # Read input from stdin
    try:
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"match": "NONE", "source": "error_no_input"}))
            return

        request = json.loads(input_data)
    except json.JSONDecodeError:
        print(json.dumps({"match": "NONE", "source": "error_json"}))
        return

    user_query = request.get("userQuery", "")
    native_query = request.get("nativeQuery", "")
    options = request.get("options", [])
    api_key = request.get("apiKey", "")

    # 1. Try Fuzzy Match
    best_match, score = fuzzy_match(user_query, options)
    
    if best_match and score > 0.6:
        print(json.dumps({"match": best_match, "source": "fuzzy", "score": score}))
        return

    # 2. Try Semantic Match (Groq)
    if api_key:
        ai_match = call_groq_api(user_query, native_query, options, api_key)
        # Verify the AI match is actually in the valid options or is NONE
        if ai_match in options:
             print(json.dumps({"match": ai_match, "source": "ai"}))
             return
    
    print(json.dumps({"match": "NONE", "source": "fallback"}))

if __name__ == "__main__":
    main()

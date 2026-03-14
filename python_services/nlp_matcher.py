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

sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def normalize_text(text):
    """Normalize unicode characters"""
    if not text:
        return ""
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')

def get_stop_words():
    """Simple list of common stop words to ignore during matching."""
    return {"how", "to", "the", "a", "is", "in", "on", "my", "for", "with", "an", "this", "that", "of", "and"}

def fuzzy_match(query, options, threshold=0.45):
    """
    Finds the best match from options using a combination of string similarity,
    keyword overlap, and bigram matches.
    """
    if not query or not options:
        return None, 0
    
    query = query.lower().strip()
    stop_words = get_stop_words()
    
    q_clean = "".join(c for c in query if c.isalnum() or c.isspace())
    q_tokens = [w for w in q_clean.split() if w not in stop_words]
    
    best_match = None
    best_score = 0
    
    q_bigrams = set()
    if len(q_tokens) > 1:
        for i in range(len(q_tokens)-1):
            q_bigrams.add(f"{q_tokens[i]} {q_tokens[i+1]}")

    for opt in options:
        opt_low = opt.lower().strip()
        
        if opt_low == query: return opt, 1.0
        if opt_low in query or query in opt_low:
            sub_score = min(len(opt_low), len(query)) / max(len(opt_low), len(query))
            score = 0.85 + (sub_score * 0.1)
            if score > best_score:
                best_score, best_match = score, opt
        
        o_clean = "".join(c for c in opt_low if c.isalnum() or c.isspace())
        o_tokens = [w for w in o_clean.split() if w not in stop_words]
        
        if not o_tokens: continue
        
        token_matches = 0
        for ot in o_tokens:
            cut = 0.85 if len(ot) < 5 else 0.75
            if any(difflib.SequenceMatcher(None, ot, qt).ratio() >= cut for qt in q_tokens):
                token_matches += 1
        
        token_score = token_matches / max(len(o_tokens), len(q_tokens))
        
        o_bigrams = set()
        if len(o_tokens) > 1:
            for i in range(len(o_tokens)-1):
                o_bigrams.add(f"{o_tokens[i]} {o_tokens[i+1]}")
        
        bigram_score = 0
        if o_bigrams and q_bigrams:
            matches = len(o_bigrams.intersection(q_bigrams))
            bigram_score = matches / len(o_bigrams)

        combined_sim = (token_score * 0.6) + (bigram_score * 0.4)
        
        char_sim = difflib.SequenceMatcher(None, query, opt_low).ratio()
        
        final_score = max(combined_sim, char_sim)

        if final_score > best_score:
            best_score = final_score
            best_match = opt
            
    if best_score >= threshold:
        return best_match, best_score
    return None, 0

from deep_translator import GoogleTranslator

def match_intent_locally(user_query, native_query, available_topics, language="Malayalam"):
    """
    Finds the BEST match using local fuzzy logic and Google Translate for alignment.
    """
    try:
        u_query = (user_query or "").lower().strip()
        n_query = (native_query or "").lower().strip()
        
        topic, score = fuzzy_match(n_query, available_topics, threshold=0.85)
        if topic and score > 0.9:
            return topic, n_query

        translator_to_en = GoogleTranslator(source='auto', target='en')
        translated_en = translator_to_en.translate(n_query) if n_query else u_query
        
        topic, score = fuzzy_match(translated_en, available_topics, threshold=0.5)
        
        if score < 0.8:
            topic_boost, boost_score = fuzzy_match(translated_en, available_topics, threshold=0.7)
            if boost_score > score:
                topic = topic_boost
                score = boost_score
        
        iso_map = {
            "Malayalam": "ml",
            "Tamil": "ta",
            "Hindi": "hi",
            "English": "en"
        }
        target_iso = iso_map.get(language, "en")
        
        if target_iso != 'en':
            translator_to_native = GoogleTranslator(source='auto', target=target_iso)
            corrected_native = translator_to_native.translate(n_query) if n_query else n_query
        else:
            corrected_native = n_query
        
        if score > 0.5:
            return topic, corrected_native
        return "NONE", corrected_native

    except Exception as e:
        sys.stderr.write(f"Local Matcher Error: {str(e)}\n")
        topic, _ = fuzzy_match(u_query, available_topics, threshold=0.5)
        return topic or "NONE", native_query

def main():
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
const stringSimilarity = require('string-similarity');
const axios = require('axios');

class NLPService {

    constructor() {
        console.log("Native NLP Service initialized.");
    }

    async getMatch(userQuery, nativeQuery, availableTitles) {
        if (!userQuery || !availableTitles || availableTitles.length === 0) {
            return "NONE";
        }

        const query = userQuery.toLowerCase().trim();

        // 1. Direct Partial Match
        // We verify if any option is contained within the query or vice-versa
        for (const opt of availableTitles) {
            if (query.includes(opt.toLowerCase())) {
                return opt; // High confidence match
            }
        }

        // 2. Fuzzy Match (String Similarity)
        const matches = stringSimilarity.findBestMatch(query, availableTitles);
        const best = matches.bestMatch;

        // Threshold can be adjusted, 0.5 is reasonable
        if (best.rating > 0.5) {
            return best.target;
        }

        // 3. Semantic Match (AI Fallback via Groq)
        if (process.env.GROQ_API_KEY) {
            try {
                const topicStr = availableTitles.join(", ");
                const prompt = `
                You are an intent classification engine.
                User input (English): "${userQuery}"
                User input (Native/Original): "${nativeQuery}"
                
                Available Knowledge Base Topics:
                [${topicStr}]
                
                Task: Identify which Topic best matches the user's intent.
                - If the user is asking about something covered in the Topics, return ONLY the exact Topic string.
                - If there is no matching topic, return "NONE".
                - Do not output any explanation, markdown, or punctuation. Just the topic name.
                `;

                const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                    model: "llama-3.1-8b-instant",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.1
                }, {
                    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
                });

                const aiContent = response.data.choices[0].message.content.trim().replace(/["\.]+/g, '');

                // Validate if AI's response is actually in our topics
                if (availableTitles.includes(aiContent)) {
                    return aiContent;
                }
            } catch (error) {
                console.error("Groq API Error in NLP Service:", error.message);
                // Fallthrough to NONE
            }
        }

        return "NONE";
    }
}

module.exports = new NLPService();

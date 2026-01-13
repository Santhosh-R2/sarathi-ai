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

        // 3. Fuzzy Match (String Similarity)
        const matches = stringSimilarity.findBestMatch(query, availableTitles);
        const best = matches.bestMatch;

        // Threshold can be adjusted, 0.5 is reasonable
        if (best.rating > 0.5) {
            return best.target;
        }

        return "NONE";
    }
}

module.exports = new NLPService();

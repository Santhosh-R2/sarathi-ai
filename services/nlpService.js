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

        for (const opt of availableTitles) {
            if (query.includes(opt.toLowerCase())) {
                return opt; 
            }
        }

        const matches = stringSimilarity.findBestMatch(query, availableTitles);
        const best = matches.bestMatch;

        if (best.rating > 0.5) {
            return best.target;
        }

        return "NONE";
    }
}

module.exports = new NLPService();

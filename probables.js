const xray = require('x-ray');

exports.mlbpitchers = {

    // Convert long form name to 3-letter abbreviation
    teamShortCode: function(longName) {
        const teams = {
            Angels : "LAA",
            Astros : "HOU",
            Athletics : "OAK",
            Braves : "ATL",
            Brewers : "MIL",
            Cardinals : "STL",
            Cubs : "CHC",
            Detroit : "DET",
            Diamondbacks : "ARI",
            Dodgers : "LAD",
            Giants : "SF",
            Indians : "CLE",
            Jays : "TOR",
            Mariners : "SEA",
            Marlins : "MIA",
            Milwaukee : "MIL",
            Mets : "NYM",
            Nationals : "WSH",
            Orioles : "BAL",
            Padres : "SD",
            Phillies : "PHI",
            Pirates : "PIT",
            Rangers : "TEX",
            Rays : "TB",
            "Red Sox": "BOS",
            Reds : "CIN",
            Rockies : "COL",
            Royals : "KC",
            Tigers : "DET",
            Twins : "MIN",
            "White Sox": "CWS",
            Yankees : "NYY"
        };
        return teams[longName];
    },

    // Format the raw data scraped via x-ray
    formatResults: function (rawData, callback) {
        const totalGames = rawData.teamAway.length;
        const matchups = new Array(totalGames);
        const teamPitchers = {};
        for (let i = 0; i < totalGames; i++) {
            let j = i*2;
            matchups[i] = {
                teamAway: rawData.teamAway[i].trim(),
                teamHome: rawData.teamHome[i].trim(),
                time: rawData.time[i].trim(),
                pitcherAway: rawData.pitchers[j].trim(),
                pitcherHome: rawData.pitchers[j+1].trim()
            };
            teamPitchers[this.teamShortCode(rawData.teamAway[i].trim())] = rawData.pitchers[j].trim();
            teamPitchers[this.teamShortCode(rawData.teamHome[i].trim())] = rawData.pitchers[j+1].trim();
        }
        callback({"matchups" : matchups, "teamPitchers" : teamPitchers});
    },

    // Scrape probable pitchers
    getPitchers: function (day, callback) {
        const url = `https://www.mlb.com/probable-pitchers/${day}`;
        const selector = {
            teamAway: ['.probable-pitchers__team-name--away'],
            teamHome: ['.probable-pitchers__team-name--home'],
            time: ['time'],
            pitchers: ['.probable-pitchers__pitcher-name']

        };

        const x = xray();
        x(url, selector)((err, result) => {

            if (err) {
                return `Error in getPitchers: ${err}`;
            } else {
                this.formatResults(result, callback);
            }
        });
    }
};
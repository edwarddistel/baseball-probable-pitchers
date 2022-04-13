# Baseball Probable Pitchers

This app pulls in a day's probable pitchers from the MLB.com website and returns the data as a JSON object.

## Usage

1. Clone this repo
2. In the repo directory, `npm install`
3. Specify an output file in `index.js`, or leave it at the default `probable-pitchers.json`
4. Specify a day, or leave it as-is for today
5. Run `npm start`

## Returned JSON example

The app will return probable pitchers in the following format:

```json
{"matchups":[
    {"teamAway":"Nationals",
    "teamHome":"Mets",
    "time":"Sun, Mar 24 • 12:10 PM EDT",
    "pitcherAway":"Joe Ross",
    "pitcherHome":"TBD"},

    {"teamAway":"Yankees",
    "teamHome":"Twins",
    "time":"Sun, Mar 24 • 1:05 PM EDT",
    "pitcherAway":"James Paxton",
    "pitcherHome":"Martin Perez"},],
    
"teamPitchers":{
    "WSH":"Patrick Corbin",
    "NYM":"TBD",
    "NYY":"James Paxton",
    "MIN":"Martin Perez",
    "MIA":"Zac Gallen",
    "STL":"Jack Flaherty",
    "BAL":"Andrew Cashner"}
```

You can traverse the `matchups` object to see individual game info or the `teamPitchers` object if you just want to look up a pitcher by team 3-letter abbreviation.

By default this app writes this data to an output file but you can consume how you wish.
# Baseball Probable Pitchers

A small, dependency-free Node.js app for retrieving **MLB's scheduled games and probable starting pitchers** on a given day. It writes clean JSON to disk, prints JSON to stdout, or can be consumed as a Node.js library.

Instead of scraping MLB.com HTML, this version fetches MLB's structured schedule data using the [MLB Stats API](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-07-04&hydrate=probablePitcher,team). It does not need an API key, password, browser, scraper, or third-party runtime packages.

## What changed in v2

- **Replaced fragile HTML scraping** (`x-ray`) with the MLB schedule endpoint and native `fetch`.
- **Zero npm dependencies**, including development dependencies; no lockfile bloat.
- **Testable modules** with input validation, request timeouts, retry/backoff, and actionable errors.
- **Calendar-day correctness**: today's date is calculated in `America/New_York` instead of using the server's local timezone.
- **Explicit game-time timezone** with automatic EST/EDT handling.
- **Thirty MLB teams mapped by stable ID**, rather than matching scraped team-name fragments. The Athletics now use `ATH` rather than their old Oakland `OAK` code.
- **Doubleheader-safe lookups** via `teamPitchersByGame`, while retaining the original `matchups` and `teamPitchers` properties.
- **CLI options**, a documented library API, Node's built-in test runner, and automated GitHub Actions checks.
- **Safe packaging**: no `.git` history, no local credentials, no macOS resource forks, and `.DS_Store` is explicitly ignored.

## Requirements

- **Node.js 22 or later** (Node.js 26 LTS recommended)
- npm (ships with Node.js)
- Network access to `https://statsapi.mlb.com`

No API credentials are needed. The app uses only Node.js built-ins and the publicly accessible MLB schedule endpoint. MLB may change this endpoint or its terms in the future; it is not a promised stable contract.

## Quick start

Download/extract this repository (or clone it), then from its root:

```bash
node --version
npm ci
npm start
```

The default command fetches **today's MLB schedule in US Eastern time** and creates `./probable-pitchers.json`. The file is deliberately listed in `.gitignore`. An offseason day or an empty schedule produces valid JSON with empty objects and arrays.

### Common commands

```bash
# Choose a date; use ISO YYYY-MM-DD (including leading zeros)
npm start -- --date 2026-07-04

# Choose an output path
npm start -- --date 2026-07-04 --output ./july-4-pitchers.json

# Pipe directly to jq, another script, or an API instead of writing a file
npm start -- --date 2026-07-04 --stdout | jq '.teamPitchers'

# Show game times in Los Angeles time
npm start -- --date 2026-07-04 --timezone America/Los_Angeles

# List all supported options
npm start -- --help
```

**Note:** `npm start --` is how arguments are forwarded through npm. You can also call `node index.js --date 2026-07-04 --stdout` directly. With a global/package bin installation, the command is `baseball-probable-pitchers`.

### Command-line options

| Option | Description | Default |
| --- | --- | --- |
| `-d`, `--date YYYY-MM-DD` | MLB schedule date, validated as a real calendar date | Today's date in US Eastern time |
| `-o`, `--output FILE` | Filename where the JSON is saved | `probable-pitchers.json` |
| `--stdout` | Print machine-readable JSON; no file is created | Off |
| `--timezone IANA_ZONE` | Format game times in an IANA time zone | `America/New_York` |
| `-h`, `--help` | Show help and exit | — |

`--stdout` and `--output` cannot be used together. Failures print an error to stderr and exit with a nonzero code. Success status messages for file output also go to stderr, leaving stdout clean for pipelines.

## JSON output

The original two primary properties remain intact, with the same legacy matchup fields. Version 2 adds `gamePk`, `gameNumber`, `status`, and `teamPitchersByGame`.

This is a **synthetic example**, not actual July 4, 2026 starting-pitcher announcements:

```json
{
  "matchups": [
    {
      "teamAway": "Yankees",
      "teamHome": "Red Sox",
      "time": "Sat, Jul 4 • 1:05 PM EDT",
      "pitcherAway": "Game One Starter",
      "pitcherHome": "Game One Opponent",
      "gamePk": 888009,
      "gameNumber": 1,
      "status": "Scheduled"
    },
    {
      "teamAway": "Yankees",
      "teamHome": "Red Sox",
      "time": "Sat, Jul 4 • 7:05 PM EDT",
      "pitcherAway": "Game Two Starter",
      "pitcherHome": "Game Two Opponent",
      "gamePk": 888010,
      "gameNumber": 2,
      "status": "Scheduled"
    }
  ],
  "teamPitchers": {
    "NYY": "Game Two Starter",
    "BOS": "Game Two Opponent"
  },
  "teamPitchersByGame": {
    "888009": {
      "NYY": "Game One Starter",
      "BOS": "Game One Opponent"
    },
    "888010": {
      "NYY": "Game Two Starter",
      "BOS": "Game Two Opponent"
    }
  }
}
```

**Fields and rules:**

- `matchups`: scheduled games sorted by kickoff time (UTC). Every matchup retains `teamAway`, `teamHome`, `time`, `pitcherAway`, and `pitcherHome`. It also records MLB's `gamePk`, its `gameNumber` for doubleheaders, and `status`.
- `teamPitchers`: easy single-string lookup by abbreviation, e.g. `data.teamPitchers.NYM`. If a team plays **twice** on the same day, the *later scheduled game* wins, to maintain backward compatibility. Use `matchups` or `teamPitchersByGame` when you need both starters.
- `teamPitchersByGame`: each `gamePk` maps team abbreviations to the two announced starters for that specific game.
- If MLB has not identified a starter, the pitcher is the literal string `"TBD"` (not `null`, `undefined`, or a fabricated name).
- A game can be moved, postponed, or cancelled; `status` reflects MLB's schedule at retrieval time. **Probable does not mean confirmed.**
- The Athletics franchise uses `ATH` (modern abbreviation), not `OAK`; codes such as `NYM`, `NYY`, `WSH`, `LAA`, `SF`, `SD`, `TB`, `CWS`, etc. are preserved.

## Use from another Node.js script

Recommended Promise-based API:

```js
const { getProbablePitchers } = require('./src');

async function main() {
  const result = await getProbablePitchers('2026-07-04');
  for (const game of result.matchups) {
    console.log(`${game.teamAway} (${game.pitcherAway}) @ ${game.teamHome} (${game.pitcherHome})`);
  }
}

main().catch(console.error);
```

Omit the date to use today's **Eastern** calendar day. You may also pass an options object:

```js
const { getProbablePitchers } = require('./src');

const data = await getProbablePitchers('2026-07-04', {
  timeZone: 'America/Chicago',
  timeoutMs: 15000,
  retries: 2,
});
```

In a CommonJS module, wrap top-level `await` in an async function or use `.then(...)`.

Lower-level exports `fetchSchedule`, `formatSchedule`, `todayInEastern`, and `validateDate` are available for composing and unit testing your own data flows. `fetchSchedule` accepts an injectable `fetchImpl` and `sleep` function.

### Backward compatibility

Existing integrations that call the old `probables.js` interface can continue using it:

```js
const { mlbpitchers } = require('./probables');

// Legacy callback: callback receives the data as its only argument.
// Always handle Promise rejections, which the old implementation swallowed.
mlbpitchers.getPitchers('2026-07-04', (data) => {
  console.log(data.teamPitchers);
}).catch(console.error);

// New callers should prefer Promise-based use directly:
const result = await mlbpitchers.getPitchers('2026-07-04');
```

The legacy `teamShortCode(name)` helper is retained for known team nicknames. The old internal HTML `formatResults(rawScrapedData, callback)` function is intentionally removed because HTML scraping no longer exists.

## Tests and reliability

Run the complete offline suite:

```bash
npm test
npm run test:coverage
npm run check
npm run ci
```

Tests use Node's built-in `node:test` and `node:assert/strict`. Synthetic MLB schedule fixtures and injected `fetch` responses cover date validation, timezone/DST behavior, abbreviations, missing starters, doubleheaders, empty schedule days, retries, network errors, invalid responses, output writing, CLI flags, and backward compatibility.

GitHub Actions runs `npm ci --ignore-scripts` and `npm run ci` on Node 24 and 26. Dependabot monitors GitHub Actions. The previous automatic PR-merge workflow was removed: dependency upgrades should be reviewed and tested rather than auto-merged without review.

### Optional live smoke test

An end-to-end check against MLB's actual service requires internet access and is **not** run by the offline test suite:

```bash
node index.js --date 2026-07-04 --stdout
```

A historical game's probable pitchers may not be populated or may change retrospectively. For current starters, choose a date when games are scheduled. A successful network fetch does not guarantee every team has announced a probable starter.

## Project layout

```text
baseball-probable-pitchers/
├── index.js                    # CLI entry point
├── probables.js                # Backward-compatible callback API
├── src/
│   ├── index.js                # Promise-based library facade
│   ├── cli.js                  # Argument parsing, JSON output, and errors
│   ├── date.js                 # Eastern date defaults and strict validation
│   ├── format.js               # MLB team mapping and response normalization
│   └── mlb-api.js              # Native fetch + timeout + retries
├── test/
│   ├── fixtures/schedule.json # Synthetic MLB API payload
│   ├── cli.test.js
│   ├── compat.test.js
│   ├── date.test.js
│   ├── format.test.js
│   └── mlb-api.test.js
├── .github/workflows/ci.yml
├── .github/dependabot.yml
├── .gitignore
├── .node-version
├── package.json
└── package-lock.json
```

## Security and maintenance

- No personal credentials, environment variables, browser cookies, or private tokens are required or included.
- `.gitignore` explicitly includes **`.DS_Store`** at the project root and for nested directories, plus generated output, `node_modules`, editor files, and `.env` files.
- The release ZIP intentionally excludes `.git/` and macOS `__MACOSX/`/`._*` files. Extract it, inspect it, and commit only the new source to your own repository.
- The API's schema and availability are outside this project's control. If the response structure changes, the app errors instead of silently saving corrupt data.

## License

ISC (same license designation as the original repository).

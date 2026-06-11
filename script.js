/* =============================================
  CONFIGURATION
  BASE_URL is the balldontlie API root.
  SEASON is the current NBA season year.
  All API calls use the free tier — no key needed
  for basic data, but you can sign up at
  balldontlie.io for an API key to get more
  requests per minute.
============================================= */
const BASE_URL = "https://api.balldontlie.io/v1";
const SEASON   = 2025;

/* =============================================
  DATE HELPERS
  We format today's date as YYYY-MM-DD for the
  API, and as a human-readable string for display.
============================================= */
const today     = new Date();
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

function fmtAPIDate(d) {
  return d.toISOString().split("T")[0];
}

function fmtDisplayDate(d) {
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });
}

/* =============================================
  API FETCH HELPER
  All API calls go through this one function.
  It builds the full URL with query parameters,
  sends the request, and returns parsed JSON.
  On failure it throws an error — the calling
  function's try/catch will handle it.
============================================= */
async function apiFetch(endpoint, params = {}) {
  const url    = new URL(`${BASE_URL}/${endpoint}`);

  // URLSearchParams handles encoding special characters in the URL
  Object.entries(params).forEach(([key, val]) => {
    if (Array.isArray(val)) {
      val.forEach(v => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, val);
    }
  });

  const res = await fetch(url.toString(), {
  headers: {
    "Authorization": "faa94368-1879-4ff6-b99e-22f16f51a0fb"
  }
});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* =============================================
  ELEMENT REFERENCES
  Grabbed once at the start and reused.
  Prefixed by which tab they belong to
  so they're easy to find.
============================================= */
// Tabs
const tabBtns      = document.querySelectorAll(".tab-btn");
const tabPanels    = document.querySelectorAll(".tab-panel");

// Scores tab
const scoresDate   = document.getElementById("scores-date");
const gameGrid     = document.getElementById("game-grid");
const scoresLoad   = document.getElementById("scores-loading");
const scoresEmpty  = document.getElementById("scores-empty");
const scoresError  = document.getElementById("scores-error");
const scoresRefresh = document.getElementById("scores-refresh");

// Standings tab
const standLoad    = document.getElementById("standings-loading");
const standError   = document.getElementById("standings-error");
const standTable   = document.getElementById("standings-table");
const confBtns     = document.querySelectorAll(".conf-btn");

// Team tab
const teamSearch   = document.getElementById("team-search");
const searchBtn    = document.getElementById("search-btn");
const quickBtns    = document.querySelectorAll(".quick-btn");
const teamLoad     = document.getElementById("team-loading");
const teamError    = document.getElementById("team-error");
const teamErrMsg   = document.getElementById("team-error-msg");
const teamResult   = document.getElementById("team-result");

/* =============================================
  STATE
  Tracks loaded data so we don't re-fetch when
  switching tabs. standingsData holds both
  conferences after the first fetch.
============================================= */
let standingsData   = null;
let activeConf      = "East";

/* =============================================
  TAB SWITCHER
  Shows the clicked tab's panel, hides others.
  Loads data for the tab if not yet loaded.
============================================= */
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;

    tabBtns.forEach(b => b.classList.toggle("active", b === btn));
    tabPanels.forEach(p => {
      p.classList.toggle("hidden", p.id !== `tab-${target}`);
      p.classList.toggle("active", p.id === `tab-${target}`);
    });

    // Lazy-load standings when that tab is first opened
    if (target === "standings" && !standingsData) {
      loadStandings();
    }
  });
});

/* =============================================
  SHOW / HIDE STATE HELPERS
  Each tab has loading, error, and empty states.
  These helpers make toggling them one-liners.
============================================= */
function setState(loading, error, empty, gridOrTable, loadEl, errEl, emptyEl) {
  loadEl.classList.toggle("hidden", !loading);
  errEl.classList.toggle("hidden",  !error);
  if (emptyEl) emptyEl.classList.toggle("hidden", !empty);
  if (gridOrTable) gridOrTable.innerHTML = "";
}

/* =============================================
  TAB 1 — SCORES
  Fetches games for today. If none, tries yesterday.
  Builds a card for each game and injects into gameGrid.
============================================= */
async function loadScores(date = fmtAPIDate(today)) {
  scoresDate.textContent = fmtDisplayDate(today);
  setState(true, false, false, gameGrid, scoresLoad, scoresError, scoresEmpty);

  // Spin the refresh icon
  scoresRefresh.classList.add("spinning");

  try {
    const data  = await apiFetch("games", {
      "dates[]":   date,
      per_page:    15
    });
    const games = data.data || [];

    if (games.length === 0) {
      // Try yesterday automatically
      if (date === fmtAPIDate(today)) {
        scoresDate.textContent = fmtDisplayDate(yesterday) + " (most recent)";
        return loadScores(fmtAPIDate(yesterday));
      }
      setState(false, false, true, gameGrid, scoresLoad, scoresError, scoresEmpty);
      return;
    }

    setState(false, false, false, null, scoresLoad, scoresError, scoresEmpty);
    games.forEach(game => gameGrid.appendChild(buildGameCard(game)));

  } catch (e) {
    setState(false, true, false, gameGrid, scoresLoad, scoresError, scoresEmpty);
  } finally {
    scoresRefresh.classList.remove("spinning");
  }
}

/* ─── Build a single game card ─────────────── */
function buildGameCard(game) {
  const home    = game.home_team;
  const visitor = game.visitor_team;
  const hScore  = game.home_team_score || 0;
  const vScore  = game.visitor_team_score || 0;
  const status  = game.status || "";

  const isFinal    = status === "Final";
  const isLive     = !isFinal && (status.includes("Qtr") || status.includes("Half") || status.includes("OT"));
  const isUpcoming = !isFinal && !isLive;

  const hWin = isFinal && hScore > vScore;
  const vWin = isFinal && vScore > hScore;

  // Build status badge HTML
  let statusHTML = "";
  if (isLive) {
    statusHTML = `<div class="game-status status-live">
      <span class="live-dot"></span> LIVE &nbsp;·&nbsp; ${status}
    </div>`;
  } else if (isFinal) {
    statusHTML = `<div class="game-status status-final">Final</div>`;
  } else {
    statusHTML = `<div class="game-status status-upcoming">${status}</div>`;
  }

  const scoreDisplay = isUpcoming ? "" : `${hScore}`;
  const vScoreDisplay = isUpcoming ? "" : `${vScore}`;

  const card = document.createElement("div");
  card.className = "game-card";
  card.innerHTML = `
    ${statusHTML}
    <div class="game-teams">
      <div class="team-row">
        <span class="team-name ${vWin ? "winner" : ""}">${visitor.city} ${visitor.name}</span>
        <span class="team-score ${vWin ? "winner" : ""}">${vScoreDisplay}</span>
      </div>
      <div class="team-row">
        <span class="team-name ${hWin ? "winner" : ""}">${home.city} ${home.name}</span>
        <span class="team-score ${hWin ? "winner" : ""}">${scoreDisplay}</span>
      </div>
    </div>
  `;
  return card;
}

/* Refresh button */
scoresRefresh.addEventListener("click", () => loadScores());

/* =============================================
  TAB 2 — STANDINGS
  Calculates standings from game results —
  same approach as nba_tracker.py since the
  /standings endpoint requires a paid plan.
  We fetch up to 3 pages (300 games), tally
  wins/losses per team, then cache the result
  so switching East/West doesn't re-fetch.
============================================= */
let standingsCache = null; // { east: [], west: [] }

async function loadStandings() {
  setState(true, false, false, standTable, standLoad, standError, null);

  // Use cache if already loaded this session
  if (standingsCache) {
    standLoad.classList.add("hidden");
    renderStandings(activeConf);
    return;
  }

  try {
    // Fetch up to 3 pages of completed games (300 games max)
    let allGames = [];
    for (let page = 1; page <= 3; page++) {
      const data  = await apiFetch("games", {
        "seasons[]": SEASON,
        per_page:    100,
        page:        page
      });
      const games = data.data || [];
      allGames    = allGames.concat(games);
      if (games.length < 100) break; // last page reached
    }

    // Keep only finished games
    const finished = allGames.filter(g => g.status === "Final");

    if (finished.length === 0) {
      setState(false, false, false, standTable, standLoad, standError, null);
      standTable.innerHTML = `<p class="state-msg">No completed games yet this season.</p>`;
      return;
    }

    // Tally wins and losses per team
    const records = {};
    finished.forEach(game => {
      const home    = game.home_team;
      const visitor = game.visitor_team;
      const hScore  = game.home_team_score || 0;
      const vScore  = game.visitor_team_score || 0;
      if (hScore === 0 && vScore === 0) return;

      [home, visitor].forEach(team => {
        if (!records[team.id]) {
          records[team.id] = {
            name:       `${team.city} ${team.name}`,
            conference: team.conference || "",
            wins:       0,
            losses:     0
          };
        }
      });

      if (hScore > vScore) {
        records[home.id].wins++;
        records[visitor.id].losses++;
      } else {
        records[visitor.id].wins++;
        records[home.id].losses++;
      }
    });

    // Split and sort by win percentage
    const winPct = r => r.wins / Math.max(r.wins + r.losses, 1);
    const all    = Object.values(records);

    standingsCache = {
      east: all.filter(r => r.conference === "East").sort((a,b) => winPct(b) - winPct(a)),
      west: all.filter(r => r.conference === "West").sort((a,b) => winPct(b) - winPct(a))
    };

    // Show note about data source
    standingsData = true; // mark as loaded
    standLoad.classList.add("hidden");
    renderStandings(activeConf);

  } catch (e) {
    setState(false, true, false, standTable, standLoad, standError, null);
  }
}

function renderStandings(conf) {
  standLoad.classList.add("hidden");
  if (!standingsCache) return;

  const teams = standingsCache[conf.toLowerCase()] || [];
  standTable.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "standings-wrap";

  wrap.innerHTML = `
    <div class="standings-header">
      <span>#</span>
      <span>Team</span>
      <span style="text-align:center">W</span>
      <span style="text-align:center">L</span>
      <span style="text-align:right">Win%</span>
    </div>
  `;

  teams.forEach((team, i) => {
    const rank  = i + 1;
    const total = team.wins + team.losses;
    const pct   = total > 0 ? (team.wins / total).toFixed(3) : ".000";

    const row = document.createElement("div");
    row.className = `standing-row${rank === 6 ? " playoff-cut" : ""}`;
    row.innerHTML = `
      <span class="standing-rank">${rank}</span>
      <span class="standing-team">${team.name}</span>
      <span class="standing-w">${team.wins}</span>
      <span class="standing-l">${team.losses}</span>
      <span class="standing-pct">${pct}</span>
    `;
    wrap.appendChild(row);
  });

  standTable.appendChild(wrap);
}

/* Conference toggle buttons */
confBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    activeConf = btn.dataset.conf;
    confBtns.forEach(b => b.classList.toggle("active", b === btn));
    if (standingsData) renderStandings(activeConf);
  });
});

/* =============================================
  TAB 3 — TEAM SEARCH
  Two-step fetch: first find the team by name,
  then fetch their recent completed games.
  Quick-pick buttons trigger the same flow.
============================================= */
async function searchTeam(query) {
  if (!query.trim()) return;

  teamResult.innerHTML    = "";
  teamError.classList.add("hidden");
  teamLoad.classList.remove("hidden");

  try {
    // Step 1: find the team
    const teamData = await apiFetch("teams", {
      search:    query,
      per_page:  5
    });

    const teams = teamData.data || [];

    // Filter manually — API search unreliable on free tier
    const q       = query.toLowerCase();
    const matched = teams.filter(t =>
      q.includes(t.name.toLowerCase()) ||
      q.includes(t.city.toLowerCase()) ||
      t.name.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q) ||
      t.abbreviation.toLowerCase() === q
    );

    if (matched.length === 0) {
      teamErrMsg.textContent = `No team found for "${query}". Try: Lakers, Celtics, OKC, Heat`;
      teamLoad.classList.add("hidden");
      teamError.classList.remove("hidden");
      return;
    }

    const team = matched[0];

    // Step 2: fetch recent games — get enough pages to cover the full season
    // then sort newest-first so we always show the most recent games
    let allGames = [];
    for (let page = 1; page <= 6; page++) {
      const gamesData = await apiFetch("games", {
        "team_ids[]": [team.id],
        "seasons[]":  [SEASON],
        per_page:     100,
        page:         page
      });
      const batch = gamesData.data || [];
      allGames = allGames.concat(batch);
      if (batch.length < 100) break; // last page
    }

    // Filter to finished games only, sort newest first
    const finished = allGames
      .filter(g => g.status === "Final")
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);

    teamLoad.classList.add("hidden");
    teamResult.appendChild(buildTeamCard(team, finished));

  } catch (e) {
    teamLoad.classList.add("hidden");
    teamErrMsg.textContent = "Could not load team data. Check your connection.";
    teamError.classList.remove("hidden");
  }
}

/* ─── Build team info + recent games card ─── */
function buildTeamCard(team, games) {
  const card = document.createElement("div");
  card.className = "team-info-card";

  // Team header
  card.innerHTML = `
    <div class="team-info-header">
      <div>
        <div class="team-full-name">${team.city} ${team.name}</div>
        <div class="team-meta">${team.conference} Conference &nbsp;·&nbsp; ${team.division} Division</div>
      </div>
      <div class="team-abbr">${team.abbreviation}</div>
    </div>
    <div class="recent-games" id="recent-games-list"></div>
  `;

  const list = card.querySelector("#recent-games-list");

  if (games.length === 0) {
    list.innerHTML = `<div class="state-msg">No completed games found this season yet.</div>`;
    return card;
  }

  games.forEach(game => {
    const isHome   = game.home_team.id === team.id;
    const opp      = isHome ? game.visitor_team : game.home_team;
    const ourScore = isHome ? game.home_team_score : game.visitor_team_score;
    const oppScore = isHome ? game.visitor_team_score : game.home_team_score;
    const won      = ourScore > oppScore;
    const venue    = isHome ? "vs" : "@";
    const dateStr  = game.date ? game.date.slice(0, 10) : "";

    // Format date as "Dec 25"
    const displayDate = dateStr
      ? new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";

    const row = document.createElement("div");
    row.className = "recent-game-row";
    row.innerHTML = `
      <span class="result-badge ${won ? "win" : "loss"}">${won ? "W" : "L"}</span>
      <span class="recent-score">${ourScore} – ${oppScore}</span>
      <span class="recent-opp">${venue} ${opp.city} ${opp.name}</span>
      <span class="recent-date">${displayDate}</span>
    `;
    list.appendChild(row);
  });

  return card;
}

/* Search button + Enter key */
searchBtn.addEventListener("click", () => searchTeam(teamSearch.value));
teamSearch.addEventListener("keydown", e => {
  if (e.key === "Enter") searchTeam(teamSearch.value);
});

/* Quick-pick team buttons */
quickBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    teamSearch.value = btn.dataset.team;
    searchTeam(btn.dataset.team);
  });
});

/* =============================================
  INIT
  Load scores immediately when the page opens.
  Standings load lazily when that tab is clicked.
============================================= */
loadScores();

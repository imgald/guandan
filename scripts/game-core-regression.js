const path = require("path");

const core = require(path.join(__dirname, "..", "game-core.js"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createCard(rank, id) {
  return {
    id: id || `card-${rank}`,
    rank,
    rankLabel: String(rank),
    suit: "spades",
    suitSymbol: "S",
  };
}

function createState() {
  return {
    players: [],
    currentPlayer: 0,
    levelRank: 3,
    latestTrickToken: 0,
    roundNumber: 1,
    pendingTribute: null,
    currentTributeInfo: null,
    pendingRoundSetup: null,
    matchScores: {},
    roundResult: null,
    currentCombo: null,
    lastPlayPlayer: null,
    consecutivePasses: 0,
    logs: [],
    finishedOrder: [],
    winnerTeam: null,
    trickHistory: [],
    playHistory: [],
    passHistory: [],
    selectedIds: new Set(),
    onlineMode: false,
    localPlayerOwnerId: null,
    localSeatId: 0,
  };
}

function buildDeps(logs) {
  return {
    shuffle(deck) {
      return deck.slice();
    },
    buildDeck() {
      return Array.from({ length: 108 }, (_, index) => createCard((index % 13) + 3, `deck-${index}`));
    },
    sortCards(cards) {
      return cards.slice().sort((a, b) => a.rank - b.rank || String(a.id).localeCompare(String(b.id)));
    },
    log(message) {
      logs.push(message);
    },
    getLevelLabel(rank) {
      return String(rank);
    },
    initializeScores() {
      logs.push("init-scores");
    },
    applyTribute(plan) {
      logs.push(`tribute:${plan ? "yes" : "no"}`);
    },
  };
}

function main() {
  const state = createState();
  const logs = [];
  const deps = buildDeps(logs);
  const setup = {
    seats: [
      { seatId: 0, name: "甲", team: 0, playerId: "p1", isHuman: true },
      { seatId: 1, name: "乙", team: 1, playerId: "p2", isHuman: true },
      { seatId: 2, name: "甲AI", team: 0, playerId: null, isHuman: false },
      { seatId: 3, name: "乙AI", team: 1, playerId: null, isHuman: false },
    ],
  };

  const originalRandom = Math.random;
  Math.random = () => 0.51;
  try {
    core.startOnlineRoundFromSetup(state, setup, "p1", deps);
  } finally {
    Math.random = originalRandom;
  }

  assert(state.onlineMode === true, "online mode should be enabled");
  assert(state.players.length === 4, "online setup should create four seats");
  assert(state.players[0].isHuman === true, "local player seat should be marked human");
  assert(state.players[2].controlledByAi === true, "AI seat should be controlled by AI");
  assert(state.players.every((player) => player.hand.length === 27), "each player should receive 27 cards");
  assert(state.currentPlayer === 2, "random start player should be derived from Math.random");
  assert(logs.some((line) => line.includes("先手开始第 1 局")), "start log should be written");

  state.selectedIds = new Set([state.players[0].hand[0].id, "gone-card"]);
  state.currentCombo = { type: "single", cards: [createCard(10, "combo-10")] };
  state.trickHistory = [{ combo: { type: "single", cards: [createCard(11, "combo-11")] } }];
  state.playHistory = [{ seatId: 1, ranks: [10, 11] }];
  state.passHistory = [{ seatId: 2 }];
  const snapshot = core.buildOnlineSnapshot(state);
  const signature = core.buildOnlineSnapshotSignature(snapshot, "p1");
  assert(typeof signature === "string" && signature.includes("\"localPlayerOwnerId\":\"p1\""), "snapshot signature should include player owner id");

  const imported = createState();
  imported.selectedIds = new Set([state.players[0].hand[0].id, "missing"]);
  core.importOnlineSnapshot(imported, snapshot, "p1");
  assert(imported.players.length === 4, "import should restore players");
  assert(imported.localSeatId === 0, "import should restore local seat");
  assert(imported.selectedIds.size === 1, "import should keep only still-available selections");
  assert(imported.currentCombo.cards[0].id === "combo-10", "import should restore combo cards");
  assert(imported.trickHistory[0].combo.cards[0].id === "combo-11", "import should restore trick history");

  state.pendingRoundSetup = {
    levelRank: 5,
    roundNumber: 2,
    tributePlan: { type: "single" },
    startingPlayerId: 1,
  };
  state.roundResult = { matchEnded: false };
  state.players.forEach((player) => {
    player.finished = true;
    player.rank = 1;
    player.hand = [];
  });

  core.startNextOnlineRound(state, deps);
  assert(state.roundNumber === 2, "next round should use pending round number");
  assert(state.levelRank === 5, "next round should use pending level rank");
  assert(state.currentPlayer === 1, "next round should use pending starting player");
  assert(state.pendingRoundSetup === null, "pending setup should be consumed");
  assert(state.pendingTribute === null, "tribute plan should be cleared after application");
  assert(state.players.every((player) => player.finished === false && player.rank === null), "players should reset for next round");
  assert(state.players.every((player) => player.hand.length === 27), "next round should redeal hands");
  assert(logs.includes("tribute:yes"), "next round should apply tribute when present");

  state.roundResult = { matchEnded: true };
  core.startNextOnlineRound(state, deps);
  assert(state.roundNumber === 1, "match-ended next round should restart at round 1");
  assert(state.levelRank === 3, "match-ended next round should restart level");
  assert(logs.includes("init-scores"), "restart should initialize scores");

  console.log("game-core-regression: ok");
}

main();

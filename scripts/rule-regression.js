const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createElementStub() {
  return {
    innerHTML: "",
    textContent: "",
    value: "",
    disabled: false,
    className: "",
    style: {},
    children: [],
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    insertAdjacentElement() {},
    setAttribute() {},
    addEventListener() {},
    remove() {},
  };
}

function loadDebugApi() {
  const ids = new Map();
  const document = {
    getElementById(id) {
      if (!ids.has(id)) {
        ids.set(id, createElementStub());
      }
      return ids.get(id);
    },
    createElement() {
      return createElementStub();
    },
    querySelector() {
      return createElementStub();
    },
  };

  const sandbox = {
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    document,
    window: {
      setTimeout: () => 0,
      clearTimeout: () => {},
      alert() {},
      GuandanOnlineBridge: null,
    },
    navigator: {
      clipboard: {
        writeText: async () => {},
      },
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.window.document = document;

  const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  vm.runInNewContext(source, sandbox, { filename: "app.js" });
  return sandbox.GuandanDebug;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const debug = loadDebugApi();
  const c = debug.createCard;

  const singleResult = debug.finalizeRoundResultForTest({
    levelRank: 3,
    players: [
      { id: 0, name: "A", team: 0, hand: [], finished: true, rank: 1 },
      { id: 1, name: "B", team: 1, hand: [c(3)], finished: false, rank: null },
      { id: 2, name: "C", team: 0, hand: [c(4)], finished: false, rank: null },
      { id: 3, name: "D", team: 1, hand: [c(5)], finished: false, rank: null },
    ],
    finishedOrder: [0, 1, 2, 3],
  });
  assert(singleResult.roundResult.outcomeType === "single", "single-down outcome mismatch");
  assert(singleResult.roundResult.levelAdvance === 1, "single-down level advance mismatch");
  assert(singleResult.pendingRoundSetup.levelRank === 4, "single-down next level should be 4");

  const doubleResult = debug.finalizeRoundResultForTest({
    levelRank: 3,
    players: [
      { id: 0, name: "A", team: 0, hand: [], finished: true, rank: 1 },
      { id: 1, name: "B", team: 1, hand: [c(3)], finished: false, rank: null },
      { id: 2, name: "C", team: 0, hand: [], finished: true, rank: 2 },
      { id: 3, name: "D", team: 1, hand: [c(5)], finished: false, rank: null },
    ],
    finishedOrder: [0, 2, 1, 3],
  });
  assert(doubleResult.roundResult.outcomeType === "double", "double-down outcome mismatch");
  assert(doubleResult.roundResult.levelAdvance === 2, "double-down level advance mismatch");
  assert(doubleResult.pendingRoundSetup.levelRank === 5, "double-down next level should be 5");

  const reachAResult = debug.finalizeRoundResultForTest({
    levelRank: 14,
    players: [
      { id: 0, name: "A", team: 0, hand: [], finished: true, rank: 1 },
      { id: 1, name: "B", team: 1, hand: [c(3)], finished: false, rank: null },
      { id: 2, name: "C", team: 0, hand: [], finished: true, rank: 2 },
      { id: 3, name: "D", team: 1, hand: [c(5)], finished: false, rank: null },
    ],
    finishedOrder: [0, 2, 1, 3],
  });
  assert(reachAResult.roundResult.matchEnded === false, "reaching A should not end the match");
  assert(reachAResult.pendingRoundSetup.levelRank === 15, "double-down from K should reach A");

  const endAtAResult = debug.finalizeRoundResultForTest({
    levelRank: 15,
    players: [
      { id: 0, name: "A", team: 0, hand: [], finished: true, rank: 1 },
      { id: 1, name: "B", team: 1, hand: [c(3)], finished: false, rank: null },
      { id: 2, name: "C", team: 0, hand: [c(4)], finished: false, rank: null },
      { id: 3, name: "D", team: 1, hand: [c(5)], finished: false, rank: null },
    ],
    finishedOrder: [0, 1, 2, 3],
  });
  assert(endAtAResult.roundResult.matchEnded === true, "winning at A should end the match");
  assert(endAtAResult.pendingRoundSetup === null, "match-ended round should not create a next-round setup");

  const tributeResult = debug.applyTributeForTest({
    levelRank: 7,
    plan: { type: "single", transfers: [{ from: 3, to: 0 }] },
    players: [
      { id: 0, name: "Winner", team: 0, hand: [c(3), c(4)] },
      { id: 1, name: "X", team: 1, hand: [c(6)] },
      { id: 2, name: "Y", team: 0, hand: [c(9)] },
      { id: 3, name: "Loser", team: 1, hand: [c(15), c(5)] },
    ],
  });
  assert(tributeResult.currentTributeInfo && tributeResult.currentTributeInfo.resisted === false, "tribute should execute");
  assert(tributeResult.players[0].hand.some((card) => card.rank === 15), "winner should receive the highest tribute card");
  assert(tributeResult.players[3].hand.some((card) => card.rank === 3), "loser should receive the smallest return card");

  const antiTributeResult = debug.applyTributeForTest({
    levelRank: 7,
    plan: { type: "single", transfers: [{ from: 3, to: 0 }] },
    players: [
      { id: 0, name: "Winner", team: 0, hand: [c(3), c(4)] },
      { id: 1, name: "X", team: 1, hand: [c(6)] },
      { id: 2, name: "Y", team: 0, hand: [c(9)] },
      { id: 3, name: "Loser", team: 1, hand: [c(17, "joker", { id: "bj-1" }), c(17, "joker", { id: "bj-2" })] },
    ],
  });
  assert(antiTributeResult.currentTributeInfo && antiTributeResult.currentTributeInfo.resisted === true, "double big jokers should resist tribute");

  const wildcardPair = debug.analyzeComboForLevel([c(7, "hearts", { id: "wild" }), c(9, "spades", { id: "natural" })], 7);
  assert(wildcardPair && wildcardPair.type === "pair" && wildcardPair.compareRank === 9, "wildcard pair recognition failed");

  const wildcardStraight = debug.analyzeComboForLevel([
    c(4, "spades", { id: "s4" }),
    c(5, "clubs", { id: "c5" }),
    c(6, "diamonds", { id: "d6" }),
    c(8, "spades", { id: "s8" }),
    c(7, "hearts", { id: "wild-7" }),
  ], 7);
  assert(wildcardStraight && wildcardStraight.type === "straight" && wildcardStraight.compareRank === 8, "wildcard straight recognition failed");

  const defensiveBeat = debug.chooseRecommendedMoveForTest({
    levelRank: 3,
    currentPlayer: 0,
    lastPlayPlayer: 3,
    currentCombo: {
      type: "single",
      length: 1,
      compareRank: 8,
      cards: [c(8, "spades", { id: "table-8" })],
    },
    players: [
      {
        id: 0,
        name: "AI",
        team: 0,
        hand: [
          c(9, "spades", { id: "ai-9" }),
          c(14, "spades", { id: "ai-a" }),
          c(3, "clubs", { id: "ai-3c" }),
          c(3, "diamonds", { id: "ai-3d" }),
          c(4, "clubs", { id: "ai-4c" }),
          c(4, "diamonds", { id: "ai-4d" }),
          c(5, "clubs", { id: "ai-5c" }),
          c(5, "diamonds", { id: "ai-5d" }),
          c(6, "clubs", { id: "ai-6c" }),
        ],
        finished: false,
      },
      {
        id: 1,
        name: "Danger",
        team: 1,
        hand: [
          c(10, "clubs", { id: "danger-10" }),
          c(11, "clubs", { id: "danger-j" }),
          c(12, "clubs", { id: "danger-q" }),
          c(13, "clubs", { id: "danger-k" }),
          c(14, "clubs", { id: "danger-a" }),
        ],
        finished: false,
      },
      {
        id: 2,
        name: "Mate",
        team: 0,
        hand: [c(7, "clubs", { id: "mate-7" }), c(7, "diamonds", { id: "mate-7d" })],
        finished: false,
      },
      {
        id: 3,
        name: "Other",
        team: 1,
        hand: [c(8, "hearts", { id: "other-8h" }), c(13, "hearts", { id: "other-kh" })],
        finished: false,
      },
    ],
  });
  assert(defensiveBeat && defensiveBeat.type === "single" && defensiveBeat.compareRank === 14, "defensive search should pick the stronger single against a near-empty opponent");

  const memoryLead = debug.chooseRecommendedMoveForTest({
    levelRank: 3,
    currentPlayer: 0,
    players: [
      {
        id: 0,
        name: "AI",
        team: 0,
        hand: [
          c(3, "clubs", { id: "lead-3c" }),
          c(7, "clubs", { id: "lead-7c" }),
          c(7, "diamonds", { id: "lead-7d" }),
          c(11, "clubs", { id: "lead-jc" }),
          c(11, "diamonds", { id: "lead-jd" }),
          c(13, "spades", { id: "lead-ks" }),
        ],
        finished: false,
      },
      {
        id: 1,
        name: "Danger",
        team: 1,
        hand: [
          c(12, "clubs", { id: "danger-qc" }),
          c(12, "diamonds", { id: "danger-qd" }),
          c(14, "clubs", { id: "danger-ac" }),
          c(14, "diamonds", { id: "danger-ad" }),
        ],
        finished: false,
      },
      {
        id: 2,
        name: "Mate",
        team: 0,
        hand: [c(9, "clubs", { id: "mate-9" })],
        finished: false,
      },
      {
        id: 3,
        name: "Other",
        team: 1,
        hand: [c(10, "clubs", { id: "other-10" }), c(10, "diamonds", { id: "other-10d" })],
        finished: false,
      },
    ],
    passHistory: [
      {
        playerId: 1,
        type: "pair",
        length: 2,
        compareRank: 10,
        token: 12,
      },
    ],
  });
  assert(memoryLead && memoryLead.type === "pair" && memoryLead.compareRank === 11, "memory inference should prefer a pair the opponent previously failed to answer");

  const visibleCapBeat = debug.chooseRecommendedMoveForTest({
    levelRank: 3,
    currentPlayer: 0,
    lastPlayPlayer: 3,
    currentCombo: {
      type: "single",
      length: 1,
      compareRank: 12,
      cards: [c(12, "spades", { id: "table-q" })],
    },
    players: [
      {
        id: 0,
        name: "AI",
        team: 0,
        hand: [
          c(13, "clubs", { id: "cap-k" }),
          c(14, "clubs", { id: "cap-a" }),
          c(7, "clubs", { id: "cap-7" }),
        ],
        finished: false,
      },
      {
        id: 1,
        name: "Danger",
        team: 1,
        hand: [c(9, "clubs", { id: "danger-9" })],
        finished: false,
      },
      {
        id: 2,
        name: "Mate",
        team: 0,
        hand: [c(6, "clubs", { id: "mate-6" }), c(7, "diamonds", { id: "mate-7" }), c(8, "hearts", { id: "mate-8" }), c(9, "spades", { id: "mate-9" })],
        finished: false,
      },
      {
        id: 3,
        name: "Other",
        team: 1,
        hand: [c(8, "clubs", { id: "other-8" })],
        finished: false,
      },
    ],
    playHistory: [
      { playerId: 3, type: "single", length: 1, compareRank: 15, ranks: [15], token: 1 },
      { playerId: 3, type: "single", length: 1, compareRank: 15, ranks: [15], token: 2 },
      { playerId: 3, type: "single", length: 1, compareRank: 15, ranks: [15], token: 3 },
      { playerId: 3, type: "single", length: 1, compareRank: 15, ranks: [15], token: 4 },
      { playerId: 3, type: "single", length: 1, compareRank: 15, ranks: [15], token: 5 },
      { playerId: 3, type: "single", length: 1, compareRank: 15, ranks: [15], token: 6 },
      { playerId: 3, type: "single", length: 1, compareRank: 15, ranks: [15], token: 7 },
      { playerId: 3, type: "single", length: 1, compareRank: 15, ranks: [15], token: 8 },
      { playerId: 3, type: "single", length: 1, compareRank: 17, ranks: [17], token: 9 },
      { playerId: 3, type: "single", length: 1, compareRank: 17, ranks: [17], token: 10 },
      { playerId: 3, type: "single", length: 1, compareRank: 16, ranks: [16], token: 11 },
      { playerId: 3, type: "single", length: 1, compareRank: 16, ranks: [16], token: 12 },
      { playerId: 3, type: "single", length: 1, compareRank: 14, ranks: [14], token: 13 },
      { playerId: 3, type: "single", length: 1, compareRank: 14, ranks: [14], token: 14 },
      { playerId: 3, type: "single", length: 1, compareRank: 14, ranks: [14], token: 15 },
      { playerId: 3, type: "single", length: 1, compareRank: 14, ranks: [14], token: 16 },
      { playerId: 3, type: "single", length: 1, compareRank: 14, ranks: [14], token: 17 },
      { playerId: 3, type: "single", length: 1, compareRank: 14, ranks: [14], token: 18 },
      { playerId: 3, type: "single", length: 1, compareRank: 14, ranks: [14], token: 19 },
    ],
  });
  assert(visibleCapBeat && visibleCapBeat.type === "single" && visibleCapBeat.compareRank === 14, "visible-count inference should treat the ace as a capped winning single");

  console.log("rule-regression: ok");
}

try {
  main();
} catch (error) {
  console.error(`rule-regression: failed - ${error.message}`);
  process.exitCode = 1;
}

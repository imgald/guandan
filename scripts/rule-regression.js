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

  console.log("rule-regression: ok");
}

try {
  main();
} catch (error) {
  console.error(`rule-regression: failed - ${error.message}`);
  process.exitCode = 1;
}

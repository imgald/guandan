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
  const gameCore = require(path.join(__dirname, '..', 'game-core.js'));
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
      GuandanGameCore: gameCore,
    },
    navigator: {
      clipboard: {
        writeText: async () => {},
      },
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.window.document = document;
  sandbox.GuandanGameCore = gameCore;

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
  const singleTributePlan = debug.buildTributePlanForTest(singleResult.roundResult);
  assert(singleTributePlan && singleTributePlan.type === "single", "single-down should create a single tribute plan");
  assert(singleTributePlan.transfers.length === 1 && singleTributePlan.transfers[0].from === 3 && singleTributePlan.transfers[0].to === 0, "single tribute should send fourth place to first place");

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
  const doubleTributePlan = debug.buildTributePlanForTest(doubleResult.roundResult);
  assert(doubleTributePlan && doubleTributePlan.type === "double", "double-down should create a double tribute plan");
  assert(doubleTributePlan.transfers.length === 2, "double tribute should contain two transfers");
  assert(doubleTributePlan.transfers[0].from === 3 && doubleTributePlan.transfers[0].to === 0, "double tribute should send fourth place to first place");
  assert(doubleTributePlan.transfers[1].from === 1 && doubleTributePlan.transfers[1].to === 2, "double tribute should send third place to second place");

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

  const doubleAntiTributeResult = debug.applyTributeForTest({
    levelRank: 7,
    plan: {
      type: "double",
      transfers: [
        { from: 1, to: 0 },
        { from: 3, to: 2 },
      ],
    },
    players: [
      { id: 0, name: "First", team: 0, hand: [c(4), c(5)] },
      { id: 1, name: "Third", team: 1, hand: [c(17, "joker", { id: "dbj-1" }), c(17, "joker", { id: "dbj-2" }), c(6)] },
      { id: 2, name: "Second", team: 0, hand: [c(7), c(8)] },
      { id: 3, name: "Fourth", team: 1, hand: [c(15), c(14)] },
    ],
  });
  assert(doubleAntiTributeResult.currentTributeInfo && doubleAntiTributeResult.currentTributeInfo.resisted === true, "any double-tribute giver with double big jokers should resist the whole tribute");
  assert(doubleAntiTributeResult.currentTributeInfo.transfers.length === 0, "anti-tribute should cancel all double-tribute transfers");

  const tributeChoice = debug.chooseTributeCardForTest({
    levelRank: 7,
    hand: [
      c(7, "hearts", { id: "tribute-wild" }),
      c(15, "spades", { id: "tribute-2" }),
      c(12, "spades", { id: "bomb-a" }),
      c(12, "hearts", { id: "bomb-b" }),
      c(12, "clubs", { id: "bomb-c" }),
      c(12, "diamonds", { id: "bomb-d" }),
      c(9, "spades", { id: "safe-9" }),
    ],
  });
  assert(tributeChoice && tributeChoice.id === "tribute-2", "tribute choice should avoid wildcard and bombs before sacrificing a strong singleton");

  const returnChoice = debug.chooseReturnCardForTest({
    levelRank: 7,
    hand: [
      c(3, "spades", { id: "ret-3" }),
      c(4, "spades", { id: "ret-4" }),
      c(9, "clubs", { id: "ret-9" }),
      c(10, "clubs", { id: "ret-10" }),
    ],
  });
  assert(returnChoice && returnChoice.id === "ret-3", "return tribute should prefer the least connective low card");

  const wildcardPair = debug.analyzeComboForLevel([c(7, "hearts", { id: "wild" }), c(9, "spades", { id: "natural" })], 7);
  assert(wildcardPair && wildcardPair.type === "pair" && wildcardPair.compareRank === 9, "wildcard pair recognition failed");

  const wildcardCannotPairJoker = debug.analyzeComboForLevel([c(7, "hearts", { id: "wild-joker" }), c(16, "joker", { id: "small-joker" })], 7);
  assert(wildcardCannotPairJoker === null, "wildcard should not combine with jokers as a pair");

  const wildcardStraight = debug.analyzeComboForLevel([
    c(4, "spades", { id: "s4" }),
    c(5, "clubs", { id: "c5" }),
    c(6, "diamonds", { id: "d6" }),
    c(8, "spades", { id: "s8" }),
    c(7, "hearts", { id: "wild-7" }),
  ], 7);
  assert(wildcardStraight && wildcardStraight.type === "straight" && wildcardStraight.compareRank === 8, "wildcard straight recognition failed");

  const naturalLevelStraight = debug.analyzeComboForLevel([
    c(5, "spades", { id: "l5" }),
    c(6, "clubs", { id: "l6" }),
    c(7, "spades", { id: "l7-natural" }),
    c(8, "diamonds", { id: "l8" }),
    c(9, "clubs", { id: "l9" }),
  ], 7);
  assert(naturalLevelStraight === null, "natural level cards should not form a straight body");

  const straightWithTwo = debug.analyzeComboForLevel([
    c(10, "spades", { id: "t10" }),
    c(11, "clubs", { id: "tj" }),
    c(12, "diamonds", { id: "tq" }),
    c(13, "hearts", { id: "tk" }),
    c(15, "spades", { id: "t2" }),
  ], 7);
  assert(straightWithTwo === null, "2 should not be allowed in straights");

  const straightWithJoker = debug.analyzeComboForLevel([
    c(8, "spades", { id: "j8" }),
    c(9, "clubs", { id: "j9" }),
    c(10, "diamonds", { id: "j10" }),
    c(11, "hearts", { id: "jj" }),
    c(16, "joker", { id: "joker-in-straight" }),
  ], 7);
  assert(straightWithJoker === null, "jokers should not be allowed in straights");

  const wildcardDoubleStraight = debug.analyzeComboForLevel([
    c(4, "spades", { id: "d4a" }),
    c(4, "clubs", { id: "d4b" }),
    c(5, "spades", { id: "d5a" }),
    c(5, "clubs", { id: "d5b" }),
    c(6, "spades", { id: "d6a" }),
    c(7, "hearts", { id: "d6wild" }),
  ], 7);
  assert(wildcardDoubleStraight && wildcardDoubleStraight.type === "doubleStraight" && wildcardDoubleStraight.compareRank === 6, "wildcard should complete a double straight without using the natural level card");

  const wildcardGapCombos = debug.allPossibleCombosForTest({
    levelRank: 9,
    hand: [
      c(3, "spades", { id: "g3" }),
      c(4, "clubs", { id: "g4" }),
      c(6, "diamonds", { id: "g6" }),
      c(7, "spades", { id: "g7" }),
      c(9, "hearts", { id: "gw" }),
      c(12, "spades", { id: "high-q" }),
    ],
  });
  assert(
    wildcardGapCombos.some((combo) => combo.type === "straight" && combo.length === 5 && combo.cards.some((card) => card.id === "gw")),
    "wildcard gap fill should be enumerated for sequence combos"
  );

  const sameSizeBombBeat = debug.canBeatForLevel({
    levelRank: 7,
    nextCards: [c(9, "spades"), c(9, "hearts"), c(9, "clubs"), c(9, "diamonds")],
    currentCards: [c(8, "spades"), c(8, "hearts"), c(8, "clubs"), c(8, "diamonds")],
  });
  assert(sameSizeBombBeat.result === true, "higher same-size bomb should beat lower bomb");

  const longerBombBeat = debug.canBeatForLevel({
    levelRank: 7,
    nextCards: [c(3, "spades"), c(3, "hearts"), c(3, "clubs"), c(3, "diamonds"), c(7, "hearts", { id: "bomb-wild" })],
    currentCards: [c(14, "spades"), c(14, "hearts"), c(14, "clubs"), c(14, "diamonds")],
  });
  assert(longerBombBeat.result === true && longerBombBeat.nextCombo.type === "bomb" && longerBombBeat.nextCombo.length === 5, "longer bomb should beat any shorter bomb");

  const jokerBombBeat = debug.canBeatForLevel({
    levelRank: 7,
    nextCards: [
      c(16, "joker", { id: "jb-s1" }),
      c(16, "joker", { id: "jb-s2" }),
      c(17, "joker", { id: "jb-b1" }),
      c(17, "joker", { id: "jb-b2" }),
    ],
    currentCards: [c(15, "spades"), c(15, "hearts"), c(15, "clubs"), c(15, "diamonds")],
  });
  assert(jokerBombBeat.result === true && jokerBombBeat.nextCombo.type === "jokerBomb", "joker bomb should beat ordinary bombs");

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

  const snapshotRoundTrip = debug.roundTripOnlineSnapshotForTest({
    localPlayerOwnerId: "owner-b",
    players: [
      { id: 0, name: "A", team: 0, ownerId: "owner-a", controlledByAi: false, hand: [c(3, "spades", { id: "rt-3" })], finished: false, rank: null },
      { id: 1, name: "B", team: 1, ownerId: "owner-b", controlledByAi: false, hand: [c(7, "hearts", { id: "rt-wild" }), c(9, "spades", { id: "rt-9" })], finished: false, rank: null },
      { id: 2, name: "AI1", team: 0, ownerId: null, controlledByAi: true, hand: [c(10, "clubs", { id: "rt-10" })], finished: false, rank: null },
      { id: 3, name: "AI2", team: 1, ownerId: null, controlledByAi: true, hand: [c(11, "clubs", { id: "rt-j" })], finished: true, rank: 4 },
    ],
    currentPlayer: 1,
    levelRank: 7,
    latestTrickToken: 5,
    roundNumber: 3,
    pendingTribute: { type: "single", transfers: [{ from: 3, to: 0 }] },
    currentTributeInfo: { type: "single", resisted: false, transfers: [{ from: 3, to: 0, tributeCard: c(15, "spades", { id: "rt-t" }), returnCard: c(3, "spades", { id: "rt-r" }) }] },
    pendingRoundSetup: { levelRank: 8, roundNumber: 4, tributePlan: { type: "single", transfers: [{ from: 2, to: 1 }] }, startingPlayerId: 0 },
    roundResult: {
      winnerTeam: 1,
      outcomeType: "single",
      levelAdvance: 1,
      matchEnded: false,
      nextLevelRank: 8,
      placements: [
        { id: 1, name: "B", team: 1, rank: 1, roundPoints: 3, totalScore: 3 },
        { id: 0, name: "A", team: 0, rank: 2, roundPoints: 2, totalScore: 2 },
        { id: 2, name: "AI1", team: 0, rank: 3, roundPoints: 1, totalScore: 1 },
        { id: 3, name: "AI2", team: 1, rank: 4, roundPoints: 0, totalScore: 0 },
      ],
      teamTotals: [
        { team: 0, roundScore: 3, totalScore: 3 },
        { team: 1, roundScore: 3, totalScore: 3 },
      ],
    },
    playHistory: [{ playerId: 1, type: "pair", length: 2, compareRank: 9, ranks: [9, 9], token: 21 }],
    passHistory: [{ playerId: 0, type: "pair", length: 2, compareRank: 9, token: 22 }],
    finishedOrder: [3],
  });
  assert(snapshotRoundTrip.restored.localSeatId === 1, "online snapshot restore should keep the local seat perspective");
  assert(snapshotRoundTrip.restored.levelRank === 7 && snapshotRoundTrip.restored.roundNumber === 3, "online snapshot restore should keep trump and round counters");
  assert(snapshotRoundTrip.restored.pendingTribute && snapshotRoundTrip.restored.pendingTribute.type === "single", "online snapshot should preserve pending tribute");
  assert(snapshotRoundTrip.restored.currentTributeInfo && snapshotRoundTrip.restored.currentTributeInfo.transfers.length === 1, "online snapshot should preserve current tribute info");
  assert(snapshotRoundTrip.restored.pendingRoundSetup && snapshotRoundTrip.restored.pendingRoundSetup.levelRank === 8, "online snapshot should preserve next-round setup");
  assert(snapshotRoundTrip.restored.playHistory.length === 1 && snapshotRoundTrip.restored.passHistory.length === 1, "online snapshot should preserve play/pass histories");

  console.log("rule-regression: ok");
}

try {
  main();
} catch (error) {
  console.error(`rule-regression: failed - ${error.message}`);
  process.exitCode = 1;
}


const SUITS = [
  { key: "spades", symbol: "S", color: "black" },
  { key: "hearts", symbol: "H", color: "red" },
  { key: "clubs", symbol: "C", color: "black" },
  { key: "diamonds", symbol: "D", color: "red" },
];

const RANKS = [
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 6, label: "6" },
  { value: 7, label: "7" },
  { value: 8, label: "8" },
  { value: 9, label: "9" },
  { value: 10, label: "10" },
  { value: 11, label: "J" },
  { value: 12, label: "Q" },
  { value: 13, label: "K" },
  { value: 14, label: "A" },
  { value: 15, label: "2" },
];

const TYPE_LABELS = {
  single: "单张",
  pair: "对子",
  triple: "三张",
  triplePair: "三带二",
  straight: "顺子",
  doubleStraight: "连对",
  plane: "钢板",
  bomb: "炸弹",
  jokerBomb: "天王炸",
};

const SEAT_META = [
  { id: 0, name: "You", role: "Seat 1", team: 0, isHuman: true },
  { id: 1, name: "AI-Left", role: "Seat 2", team: 1, isHuman: false },
  { id: 2, name: "AI-Partner", role: "Seat 3", team: 0, isHuman: false },
  { id: 3, name: "AI-Right", role: "Seat 4", team: 1, isHuman: false },
];

const state = {
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
  selectedIds: new Set(),
  currentCombo: null,
  lastPlayPlayer: null,
  consecutivePasses: 0,
  logs: [],
  finishedOrder: [],
  winnerTeam: null,
  trickHistory: [],
  playHistory: [],
  passHistory: [],
  aiTimer: null,
  onlineMode: false,
  localPlayerOwnerId: null,
  lastOnlineSnapshotSignature: "",
  lastAiFeedbackToken: 0,
};

const els = {
  panels: SEAT_META.reduce((acc, seat) => {
    acc[seat.id] = document.getElementById(`player-${seat.id}-panel`);
    return acc;
  }, {}),
  toastLayer: document.getElementById("toast-layer"),
  trumpBanner: document.getElementById("trump-banner"),
  tributeBanner: document.getElementById("tribute-banner"),
  turnIndicator: document.getElementById("turn-indicator"),
  trickArea: document.getElementById("trick-area"),
  roundSummary: document.getElementById("round-summary"),
  rulesContent: document.getElementById("rules-content"),
  log: document.getElementById("log"),
  resultOverlay: document.getElementById("round-result-overlay"),
  resultSummary: document.getElementById("result-summary"),
  closeResultBtn: document.getElementById("close-result-btn"),
  infoPanel: document.getElementById("info-panel"),
  infoToggleBtn: document.getElementById("info-toggle-btn"),
  newGameBtn: document.getElementById("new-game-btn"),
  sortBtn: document.getElementById("sort-btn"),
  localTable: document.getElementById("local-table"),
};

function buildDeck() {
  const deck = [];
  for (let copy = 0; copy < 2; copy += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: `${copy}-${suit.key}-${rank.value}`,
          rank: rank.value,
          rankLabel: rank.label,
          suit: suit.key,
          suitSymbol: suit.symbol,
          color: suit.color,
          isJoker: false,
        });
      }
    }

    deck.push({
      id: `${copy}-joker-small`,
      rank: 16,
      rankLabel: "SJ",
      suit: "joker",
      suitSymbol: "J",
      color: "black",
      isJoker: true,
    });
    deck.push({
      id: `${copy}-joker-big`,
      rank: 17,
      rankLabel: "BJ",
      suit: "joker",
      suitSymbol: "J",
      color: "red",
      isJoker: true,
    });
  }
  return deck;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    return a.suit.localeCompare(b.suit);
  });
}

function createPlayers() {
  return SEAT_META.map((seat) => ({
    ...seat,
    controlledByAi: !seat.isHuman,
    ownerId: seat.isHuman ? "local-player" : null,
    hand: [],
    finished: false,
    rank: null,
  }));
}

function initializeScores() {
  state.matchScores = SEAT_META.reduce((acc, seat) => {
    acc[seat.id] = 0;
    return acc;
  }, {});
  state.pendingRoundSetup = null;
}

function getNextLevelRank(rank) {
  const cycle = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const index = cycle.indexOf(rank);
  if (index === -1 || index === cycle.length - 1) {
    return cycle[cycle.length - 1];
  }
  return cycle[index + 1];
}

function advanceLevelRank(rank, steps) {
  let next = rank;
  for (let i = 0; i < steps; i += 1) {
    next = getNextLevelRank(next);
  }
  return next;
}

function getMatchProgressAfterRound(levelRank, levelAdvance) {
  const nextLevelRank = advanceLevelRank(levelRank, levelAdvance || 0);
  const matchEnded = levelRank >= 15 && (levelAdvance || 0) > 0;
  return {
    nextLevelRank,
    matchEnded,
  };
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  els.toastLayer.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 2800);
}

function showErrorToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast error";
  toast.textContent = message;
  els.toastLayer.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 2800);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isGameplayViewVisible() {
  return Boolean(els.localTable && !els.localTable.classList.contains("hidden"));
}

function playUiPing() {
  if (typeof window === "undefined" || !window.AudioContext) {
    return;
  }
  try {
    const audioContext = new window.AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 784;
    gain.gain.value = 0.02;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.08);
    oscillator.onended = () => {
      audioContext.close().catch(() => {});
    };
  } catch {
    // Ignore audio failures; visual feedback still applies.
  }
}

function log(message) {
  state.logs.unshift(message);
  state.logs = state.logs.slice(0, 30);
}

function getLevelLabel(rank) {
  const found = RANKS.find((item) => item.value === rank);
  return found ? found.label : String(rank);
}

function isWildcardCard(card) {
  return !card.isJoker && card.suit === "hearts" && card.rank === state.levelRank;
}

function countByRank(cards) {
  const counts = new Map();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return counts;
}

function extractSortedRanks(counts, minCount = 1) {
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .map(([rank]) => rank)
    .sort((a, b) => a - b);
}

function isConsecutive(ranks) {
  if (ranks.length === 0) {
    return false;
  }
  for (let i = 1; i < ranks.length; i += 1) {
    if (ranks[i] !== ranks[i - 1] + 1) {
      return false;
    }
  }
  return true;
}

function isSequenceRank(rank) {
  return rank >= 3 && rank <= 14;
}

function getRankPower(rank) {
  if (rank === 17) {
    return 17;
  }
  if (rank === 16) {
    return 16;
  }
  if (rank === state.levelRank) {
    return 15;
  }
  if (rank === 15) {
    return 14;
  }
  if (rank === 14) {
    return 13;
  }
  return rank;
}

function compareRanksForPressure(rankA, rankB) {
  const powerDiff = getRankPower(rankA) - getRankPower(rankB);
  if (powerDiff !== 0) {
    return powerDiff;
  }
  return rankA - rankB;
}

function splitWildcards(cards) {
  const wildcards = [];
  const fixed = [];
  for (const card of cards) {
    if (isWildcardCard(card)) {
      wildcards.push(card);
    } else {
      fixed.push(card);
    }
  }
  return { wildcards, fixed };
}

function canBuildSameRankCombo(fixed, wildcardCount, targetRank, totalSize) {
  if (targetRank >= 16) {
    if (wildcardCount > 0 || totalSize > 2) {
      return false;
    }
    if (fixed.some((card) => card.rank !== targetRank)) {
      return false;
    }
    return fixed.length === totalSize;
  }
  if (fixed.some((card) => card.rank !== targetRank)) {
    return false;
  }
  return fixed.length + wildcardCount === totalSize;
}

function canBuildTriplePairCombo(fixedCounts, wildcardCount, tripleRank, pairRank) {
  if (tripleRank === pairRank || tripleRank >= 16 || pairRank >= 16) {
    return false;
  }
  const allowed = new Set([tripleRank, pairRank]);
  for (const rank of fixedCounts.keys()) {
    if (!allowed.has(rank)) {
      return false;
    }
  }
  const tripleHave = fixedCounts.get(tripleRank) || 0;
  const pairHave = fixedCounts.get(pairRank) || 0;
  if (tripleHave > 3 || pairHave > 2) {
    return false;
  }
  return (3 - tripleHave) + (2 - pairHave) === wildcardCount;
}

function canBuildSequenceCombo(fixedCounts, wildcardCount, groupSize) {
  const totalSize = [...fixedCounts.values()].reduce((sum, count) => sum + count, 0) + wildcardCount;
  if (totalSize % groupSize !== 0) {
    return null;
  }

  const sequenceLength = totalSize / groupSize;
  const validStartMax = 14 - sequenceLength + 1;
  for (let start = validStartMax; start >= 3; start -= 1) {
    const sequence = [];
    let valid = true;
    let needed = 0;
    const allowedRanks = new Set();

    for (let offset = 0; offset < sequenceLength; offset += 1) {
      const rank = start + offset;
      if (!isSequenceRank(rank)) {
        valid = false;
        break;
      }
      sequence.push(rank);
      allowedRanks.add(rank);
      const have = fixedCounts.get(rank) || 0;
      if (rank === state.levelRank && have > 0) {
        valid = false;
        break;
      }
      if (have > groupSize) {
        valid = false;
        break;
      }
      needed += groupSize - have;
    }

    if (!valid || needed !== wildcardCount) {
      continue;
    }

    for (const rank of fixedCounts.keys()) {
      if (!allowedRanks.has(rank)) {
        valid = false;
        break;
      }
    }

    if (valid) {
      return {
        compareRank: sequence[sequence.length - 1],
        sequence,
      };
    }
  }

  return null;
}

function analyzeCombo(cards) {
  if (!cards || cards.length === 0) {
    return null;
  }

  const sorted = sortCards(cards);
  const { wildcards, fixed } = splitWildcards(sorted);
  const wildcardCount = wildcards.length;
  const counts = countByRank(fixed);
  const ranks = extractSortedRanks(counts);
  const countValues = [...counts.values()].sort((a, b) => a - b);
  const size = sorted.length;

  if (size === 1) {
    return { type: "single", length: 1, compareRank: sorted[0].rank, cards: sorted };
  }

  if (size === 2) {
    for (let targetRank = 17; targetRank >= 3; targetRank -= 1) {
      if (canBuildSameRankCombo(fixed, wildcardCount, targetRank, 2)) {
        return { type: "pair", length: 2, compareRank: targetRank, cards: sorted };
      }
    }
  }

  if (size === 3) {
    for (let targetRank = 15; targetRank >= 3; targetRank -= 1) {
      if (canBuildSameRankCombo(fixed, wildcardCount, targetRank, 3)) {
        return { type: "triple", length: 3, compareRank: targetRank, cards: sorted };
      }
    }
  }

  if (size === 4 && sorted.every((card) => card.rank >= 16)) {
    return {
      type: "jokerBomb",
      length: size,
      compareRank: 99,
      cards: sorted,
    };
  }

  if (size >= 4) {
    for (let targetRank = 15; targetRank >= 3; targetRank -= 1) {
      if (canBuildSameRankCombo(fixed, wildcardCount, targetRank, size)) {
        return {
          type: "bomb",
          length: size,
          compareRank: targetRank,
          cards: sorted,
        };
      }
    }
  }

  if (size === 5) {
    for (let tripleRank = 15; tripleRank >= 3; tripleRank -= 1) {
      for (let pairRank = 15; pairRank >= 3; pairRank -= 1) {
        if (canBuildTriplePairCombo(counts, wildcardCount, tripleRank, pairRank)) {
          return { type: "triplePair", length: 5, compareRank: tripleRank, cards: sorted };
        }
      }
    }
  }

  if (size >= 5 && fixed.every((card) => !card.isJoker) && [...counts.values()].every((count) => count <= 1)) {
    const straightInfo = canBuildSequenceCombo(counts, wildcardCount, 1);
    if (straightInfo) {
      return { type: "straight", length: size, compareRank: straightInfo.compareRank, cards: sorted };
    }
  }

  if (size >= 6 && size % 2 === 0 && fixed.every((card) => !card.isJoker) && [...counts.values()].every((count) => count <= 2)) {
    const doubleStraightInfo = canBuildSequenceCombo(counts, wildcardCount, 2);
    if (doubleStraightInfo) {
      return {
        type: "doubleStraight",
        length: size,
        compareRank: doubleStraightInfo.compareRank,
        cards: sorted,
      };
    }
  }

  if (size >= 6 && size % 3 === 0 && fixed.every((card) => !card.isJoker) && [...counts.values()].every((count) => count <= 3)) {
    const planeInfo = canBuildSequenceCombo(counts, wildcardCount, 3);
    if (planeInfo) {
      return {
        type: "plane",
        length: size,
        compareRank: planeInfo.compareRank,
        cards: sorted,
      };
    }
  }

  return null;
}

function canBeat(nextCombo, currentCombo) {
  if (!nextCombo) {
    return false;
  }

  if (!currentCombo) {
    return true;
  }

  if (nextCombo.type === "jokerBomb") {
    return currentCombo.type !== "jokerBomb" || nextCombo.length > currentCombo.length;
  }

  if (currentCombo.type === "jokerBomb") {
    return false;
  }

  if (nextCombo.type === "bomb" && currentCombo.type !== "bomb") {
    return true;
  }

  if (nextCombo.type === "bomb" && currentCombo.type === "bomb") {
    if (nextCombo.length !== currentCombo.length) {
      return nextCombo.length > currentCombo.length;
    }
    return getRankPower(nextCombo.compareRank) > getRankPower(currentCombo.compareRank);
  }

  if (currentCombo.type === "bomb") {
    return false;
  }

  if (nextCombo.type !== currentCombo.type || nextCombo.length !== currentCombo.length) {
    return false;
  }

  return getRankPower(nextCombo.compareRank) > getRankPower(currentCombo.compareRank);
}

function comboToText(combo) {
  if (!combo) {
    return "无";
  }
  return `${TYPE_LABELS[combo.type] || combo.type} ${cardsToText(combo.cards)}`;
}

function getComboMemoryKey(comboLike) {
  if (!comboLike) {
    return "";
  }
  return `${comboLike.type}-${comboLike.length}`;
}

function rememberPlay(player, combo) {
  if (!player || !combo) {
    return;
  }
  state.playHistory.unshift({
    playerId: player.id,
    type: combo.type,
    length: combo.length,
    compareRank: combo.compareRank,
    ranks: combo.cards.map((card) => card.rank),
    token: state.latestTrickToken,
  });
  state.playHistory = state.playHistory.slice(0, 60);
}

function rememberPass(player, combo) {
  if (!player || !combo) {
    return;
  }
  state.passHistory.unshift({
    playerId: player.id,
    type: combo.type,
    length: combo.length,
    compareRank: combo.compareRank,
    token: state.latestTrickToken,
  });
  state.passHistory = state.passHistory.slice(0, 60);
}

function describeBeatRequirement(currentCombo) {
  if (!currentCombo) {
    return "当前没有待压牌，可以自由出牌。";
  }
  if (currentCombo.type === "bomb") {
    return `当前是${TYPE_LABELS[currentCombo.type]}，需要更大的炸弹或天王炸。`;
  }
  if (currentCombo.type === "jokerBomb") {
    return "当前是天王炸，无法再压。";
  }
  return `当前要压 ${TYPE_LABELS[currentCombo.type]}，需要同牌型同张数，或使用炸弹/天王炸。`;
}

function cardsToText(cards) {
  return cards
    .map((card) => `${card.suitSymbol}${card.rankLabel}`)
    .join(" ");
}

function getSelectedCards() {
  const human = state.players[0];
  return human.hand.filter((card) => state.selectedIds.has(card.id));
}

function nextActivePlayer(fromId) {
  let cursor = fromId;
  for (let i = 0; i < state.players.length; i += 1) {
    cursor = (cursor + 1) % state.players.length;
    if (!state.players[cursor].finished) {
      return cursor;
    }
  }
  return fromId;
}

function getOpponents(player) {
  return state.players.filter((other) => other.team !== player.team && !other.finished);
}

function getTeammate(player) {
  return state.players.find((other) => other.team === player.team && other.id !== player.id);
}

function getNextUnfinishedPlayer(fromId) {
  return state.players[nextActivePlayer(fromId)];
}

function previousActivePlayer(fromId) {
  let cursor = fromId;
  for (let i = 0; i < state.players.length; i += 1) {
    cursor = (cursor - 1 + state.players.length) % state.players.length;
    if (!state.players[cursor].finished) {
      return cursor;
    }
  }
  return fromId;
}

function getPreviousUnfinishedPlayer(fromId) {
  return state.players[previousActivePlayer(fromId)];
}

function getWinningTeamFromFinishedOrder() {
  if (state.finishedOrder.length < 2) {
    return null;
  }
  const first = state.players[state.finishedOrder[0]];
  const second = state.players[state.finishedOrder[1]];
  if (first.team === second.team) {
    return first.team;
  }
  if (state.finishedOrder.length >= 3) {
    return first.team;
  }
  return null;
}

function maybeFinishPlayer(player) {
  if (!player.finished && player.hand.length === 0) {
    player.finished = true;
    player.rank = state.finishedOrder.length + 1;
    state.finishedOrder.push(player.id);
    log(`${player.name} 出完牌，获得第 ${player.rank} 名。`);

    const winningTeam = getWinningTeamFromFinishedOrder();
    if (winningTeam !== null) {
      state.winnerTeam = winningTeam;
    }
  }
}

function finalizeRoundResult() {
  const remaining = state.players
    .filter((player) => !player.finished)
    .sort((a, b) => a.hand.length - b.hand.length || a.id - b.id);

  for (const player of remaining) {
    player.finished = true;
    player.rank = state.finishedOrder.length + 1;
    state.finishedOrder.push(player.id);
  }

  const roundPointsByRank = [3, 2, 1, 0];
  const placements = state.finishedOrder.map((id, index) => {
    const player = state.players[id];
    const roundPoints = roundPointsByRank[index] ?? 0;
    state.matchScores[id] = (state.matchScores[id] || 0) + roundPoints;
    return {
      id,
      name: player.name,
      team: player.team,
      rank: index + 1,
      roundPoints,
      totalScore: state.matchScores[id],
      remainingCards: player.hand.length,
    };
  });

  const teamTotals = [0, 1].map((team) => ({
    team,
    roundPoints: placements
      .filter((item) => item.team === team)
      .reduce((sum, item) => sum + item.roundPoints, 0),
    totalScore: placements
      .filter((item) => item.team === team)
      .reduce((sum, item) => sum + item.totalScore, 0),
  }));

  const topTwoSameTeam = placements[0] && placements[1] && placements[0].team === placements[1].team;
  const computedWinnerTeam = topTwoSameTeam ? placements[0].team : placements[0].team;
  const outcomeType = topTwoSameTeam ? "double" : "single";
  const levelAdvance = topTwoSameTeam ? 2 : 1;
  const progress = getMatchProgressAfterRound(state.levelRank, levelAdvance);

  state.roundResult = {
    winnerTeam: computedWinnerTeam,
    outcomeType,
    levelAdvance,
    matchEnded: progress.matchEnded,
    nextLevelRank: progress.nextLevelRank,
    placements,
    teamTotals,
  };

  state.pendingRoundSetup = progress.matchEnded
    ? null
    : {
        levelRank: progress.nextLevelRank,
        roundNumber: state.roundNumber + 1,
        tributePlan: buildTributePlan(state.roundResult),
        startingPlayerId: placements[0].id,
      };
}

function getCardPowerForSort(card) {
  return getRankPower(card.rank) * 10 + (card.isJoker ? 2 : 0);
}

function getTributeStructurePenalty(card, player) {
  if (!card || !player) {
    return 0;
  }
  if (isWildcardCard(card)) {
    return 10000;
  }

  const rankCards = player.hand.filter((item) => item.rank === card.rank);
  if (rankCards.length >= 4) {
    return 9000;
  }
  if (rankCards.length === 3) {
    return 320;
  }
  if (rankCards.length === 2) {
    return 180;
  }

  if (!isSequenceRank(card.rank)) {
    return 0;
  }

  const sequenceNeighbors = [card.rank - 2, card.rank - 1, card.rank + 1, card.rank + 2]
    .filter((rank) => isSequenceRank(rank))
    .reduce((count, rank) => count + (player.hand.some((item) => item.rank === rank) ? 1 : 0), 0);

  return sequenceNeighbors >= 3 ? 140 : sequenceNeighbors * 35;
}

function chooseTributeCard(player) {
  const scored = [...player.hand]
    .map((card) => ({
      card,
      score: getCardPowerForSort(card) * 20 - getTributeStructurePenalty(card, player),
    }))
    .sort((a, b) => b.score - a.score);

  const safeChoice = scored.find((item) => item.score > 0);
  return (safeChoice || scored[0] || {}).card || null;
}

function chooseReturnCard(player) {
  const scored = [...player.hand]
    .map((card) => {
      const power = getCardPowerForSort(card);
      const structurePenalty = getTributeStructurePenalty(card, player);
      const middleRankPenalty = isSequenceRank(card.rank) ? Math.max(0, 8 - Math.abs(8 - card.rank)) * 12 : 0;
      return {
        card,
        score: power + structurePenalty + middleRankPenalty,
      };
    })
    .sort((a, b) => a.score - b.score);

  return (scored[0] || {}).card || null;
}

function removeOneCard(player, cardId) {
  const index = player.hand.findIndex((card) => card.id === cardId);
  if (index >= 0) {
    return player.hand.splice(index, 1)[0];
  }
  return null;
}

function buildTributePlan(roundResult) {
  if (!roundResult || !roundResult.placements || roundResult.placements.length < 4) {
    return null;
  }

  const placements = [...roundResult.placements].sort((a, b) => a.rank - b.rank);
  const first = placements[0];
  const second = placements[1];
  const third = placements[2];
  const fourth = placements[3];

  if (first.team === second.team) {
    return {
      type: "double",
      transfers: [
        { from: fourth.id, to: first.id },
        { from: third.id, to: second.id },
      ],
    };
  }

  return {
    type: "single",
    transfers: [
      { from: fourth.id, to: first.id },
    ],
  };
}

function hasAntiTribute(player) {
  let bigJokerCount = 0;
  for (const card of player.hand) {
    if (card.rank === 17) {
      bigJokerCount += 1;
    }
  }
  return bigJokerCount >= 2;
}

function applyTribute(plan) {
  if (!plan) {
    state.currentTributeInfo = null;
    return;
  }

  const givers = [...new Set(plan.transfers.map((item) => item.from))].map((id) => state.players[id]);
  const antiTributePlayer = givers.find((player) => hasAntiTribute(player));
  if (antiTributePlayer) {
    state.currentTributeInfo = {
      type: plan.type,
      resisted: true,
      resistantPlayerId: antiTributePlayer.id,
      transfers: [],
    };
    log(`${antiTributePlayer.name} 持有双大王，抗贡成功。`);
    showToast("本局抗贡");
    return;
  }

  const logs = [];
  const executedTransfers = [];
  for (const transfer of plan.transfers) {
    const fromPlayer = state.players[transfer.from];
    const toPlayer = state.players[transfer.to];
    const tributeCard = chooseTributeCard(fromPlayer);
    if (!tributeCard) {
      continue;
    }
    const movedTribute = removeOneCard(fromPlayer, tributeCard.id);
    toPlayer.hand.push(movedTribute);

    const returnCard = chooseReturnCard(toPlayer);
    const movedReturn = removeOneCard(toPlayer, returnCard.id);
    fromPlayer.hand.push(movedReturn);

    logs.push(`${fromPlayer.name} 进贡 ${cardsToText([movedTribute])} 给 ${toPlayer.name}；${toPlayer.name} 回贡 ${cardsToText([movedReturn])} 给 ${fromPlayer.name}`);
    executedTransfers.push({
      from: fromPlayer.id,
      to: toPlayer.id,
      tributeCard: movedTribute,
      returnCard: movedReturn,
    });
  }

  for (const player of state.players) {
    player.hand = sortCards(player.hand);
  }

  if (logs.length > 0) {
    state.currentTributeInfo = {
      type: plan.type,
      resisted: false,
      transfers: executedTransfers,
    };
    for (const entry of logs) {
      log(entry);
    }
    showToast(plan.type === "double" ? "本局执行双贡" : "本局执行单贡");
  } else {
    state.currentTributeInfo = null;
  }
}

function removeCardsFromHand(player, cards) {
  const ids = new Set(cards.map((card) => card.id));
  player.hand = player.hand.filter((card) => !ids.has(card.id));
}

function applyPlay(player, combo) {
  removeCardsFromHand(player, combo.cards);
  state.currentCombo = combo;
  state.lastPlayPlayer = player.id;
  state.consecutivePasses = 0;
  state.latestTrickToken += 1;
  rememberPlay(player, combo);
  state.trickHistory.unshift({
    playerId: player.id,
    combo,
    token: state.latestTrickToken,
  });
  state.trickHistory = state.trickHistory.slice(0, 4);
  log(`${player.name} 出了 ${comboToText(combo)}`);
  maybeFinishPlayer(player);
}

function applyPass(player) {
  state.consecutivePasses += 1;
  rememberPass(player, state.currentCombo);
  log(`${player.name} 选择不要。`);
}

function maybeResetTrickSafe() {
  const activePlayers = state.players.filter((player) => !player.finished).length;
  if (!state.currentCombo || state.consecutivePasses < activePlayers - 1) {
    return false;
  }

  const leader = state.players[state.lastPlayPlayer];
  const nextLeaderId = leader.finished ? nextActivePlayer(leader.id) : leader.id;
  const nextLeader = state.players[nextLeaderId];
  log(`${nextLeader.name} 重新获得牌权`);
  state.currentCombo = null;
  state.consecutivePasses = 0;
  state.latestTrickToken += 1;
  state.trickHistory.unshift({ playerId: nextLeaderId, combo: null, reset: true, token: state.latestTrickToken });
  state.trickHistory = state.trickHistory.slice(0, 4);
  state.currentPlayer = nextLeaderId;
  return true;
}

function pushWildcardSequenceCombos(combos, byRank, wildcards, groupSize, minGroups) {
  if (!wildcards.length) {
    return;
  }

  for (let startRank = 3; startRank <= 14; startRank += 1) {
    let collectedCards = [];
    let neededWildcards = 0;

    for (let rank = startRank; rank <= 14; rank += 1) {
      const naturalCards = byRank.get(rank) || [];
      const takeCount = Math.min(groupSize, naturalCards.length);
      collectedCards = [...collectedCards, ...naturalCards.slice(0, takeCount)];
      neededWildcards += Math.max(0, groupSize - takeCount);

      const groupCount = rank - startRank + 1;
      if (neededWildcards > wildcards.length) {
        break;
      }

      if (groupCount >= minGroups && neededWildcards > 0) {
        combos.push(analyzeCombo([...collectedCards, ...wildcards.slice(0, neededWildcards)]));
      }
    }
  }
}

function advanceTurn() {
  if (state.winnerTeam !== null) {
    render();
    return;
  }

  if (!maybeResetTrickSafe()) {
    state.currentPlayer = nextActivePlayer(state.currentPlayer);
  }

  render();
  maybeRunAiTurn();
}

function endIfNeeded() {
  if (state.winnerTeam !== null) {
    if (!state.roundResult) {
      finalizeRoundResult();
    }
    render();
    return true;
  }

  const winningTeam = getWinningTeamFromFinishedOrder();
  if (winningTeam !== null) {
    state.winnerTeam = winningTeam;
    finalizeRoundResult();
    render();
    return true;
  }
  return false;
}

function allPossibleCombos(hand) {
  const combos = [];
  const byRank = new Map();
  for (const card of hand) {
    if (isWildcardCard(card)) {
      continue;
    }
    if (!byRank.has(card.rank)) {
      byRank.set(card.rank, []);
    }
    byRank.get(card.rank).push(card);
  }

  const wildcards = hand.filter((card) => isWildcardCard(card));
  for (const wildcard of wildcards) {
    combos.push(analyzeCombo([wildcard]));
  }

  for (const cards of byRank.values()) {
    combos.push(analyzeCombo(cards.slice(0, 1)));
    if (cards.length >= 2) combos.push(analyzeCombo(cards.slice(0, 2)));
    if (cards.length >= 3) combos.push(analyzeCombo(cards.slice(0, 3)));
    if (cards.length >= 4) {
      for (let take = 4; take <= cards.length; take += 1) {
        combos.push(analyzeCombo(cards.slice(0, take)));
      }
    }
  }

  for (let targetRank = 3; targetRank <= 15; targetRank += 1) {
    const natural = byRank.get(targetRank) || [];
    for (let take = 1; take <= Math.min(wildcards.length, 3); take += 1) {
      const comboCards = [...natural.slice(0, Math.max(0, Math.min(natural.length, 4))), ...wildcards.slice(0, take)];
      if (comboCards.length >= 2) {
        combos.push(analyzeCombo(comboCards));
      }
    }
  }

  const tripleRanks = [...byRank.entries()].filter(([, cards]) => cards.length >= 3).map(([rank]) => rank);
  const pairRanks = [...byRank.entries()].filter(([, cards]) => cards.length >= 2).map(([rank]) => rank);

  for (const tripleRank of tripleRanks) {
    for (const pairRank of pairRanks) {
      if (tripleRank === pairRank) continue;
      const cards = [...byRank.get(tripleRank).slice(0, 3), ...byRank.get(pairRank).slice(0, 2)];
      combos.push(analyzeCombo(cards));
    }
  }

  const singleRanks = [...byRank.keys()].sort((a, b) => a - b);
  for (let start = 0; start < singleRanks.length; start += 1) {
    const seq = [];
    for (let i = start; i < singleRanks.length; i += 1) {
      const rank = singleRanks[i];
      if (!isSequenceRank(rank)) break;
      if (seq.length > 0 && rank !== seq[seq.length - 1] + 1) break;
      seq.push(rank);
      if (seq.length >= 5) {
        combos.push(analyzeCombo(seq.map((value) => byRank.get(value)[0])));
        for (let wildCount = 1; wildCount <= Math.min(wildcards.length, 2); wildCount += 1) {
          const seqCards = [...seq.map((value) => byRank.get(value)[0]), ...wildcards.slice(0, wildCount)];
          combos.push(analyzeCombo(seqCards));
        }
      }
    }
  }
  pushWildcardSequenceCombos(combos, byRank, wildcards, 1, 5);

  for (let start = 0; start < pairRanks.length; start += 1) {
    const seq = [];
    for (let i = start; i < pairRanks.length; i += 1) {
      const rank = pairRanks[i];
      if (!isSequenceRank(rank)) break;
      if (seq.length > 0 && rank !== seq[seq.length - 1] + 1) break;
      seq.push(rank);
      if (seq.length >= 3) {
        combos.push(analyzeCombo(seq.flatMap((value) => byRank.get(value).slice(0, 2))));
        for (let wildCount = 1; wildCount <= Math.min(wildcards.length, 2); wildCount += 1) {
          const seqCards = [
            ...seq.flatMap((value) => byRank.get(value).slice(0, 2)),
            ...wildcards.slice(0, wildCount),
          ];
          combos.push(analyzeCombo(seqCards));
        }
      }
    }
  }
  pushWildcardSequenceCombos(combos, byRank, wildcards, 2, 3);

  for (let start = 0; start < tripleRanks.length; start += 1) {
    const seq = [];
    for (let i = start; i < tripleRanks.length; i += 1) {
      const rank = tripleRanks[i];
      if (!isSequenceRank(rank)) break;
      if (seq.length > 0 && rank !== seq[seq.length - 1] + 1) break;
      seq.push(rank);
      if (seq.length >= 2) {
        combos.push(analyzeCombo(seq.flatMap((value) => byRank.get(value).slice(0, 3))));
        for (let wildCount = 1; wildCount <= Math.min(wildcards.length, 2); wildCount += 1) {
          const seqCards = [
            ...seq.flatMap((value) => byRank.get(value).slice(0, 3)),
            ...wildcards.slice(0, wildCount),
          ];
          combos.push(analyzeCombo(seqCards));
        }
      }
    }
  }
  pushWildcardSequenceCombos(combos, byRank, wildcards, 3, 2);

  return combos
    .filter(Boolean)
    .filter((combo, index, arr) => {
      const key = `${combo.type}-${combo.length}-${combo.compareRank}-${combo.cards.map((card) => card.id).join(",")}`;
      return index === arr.findIndex((item) => `${item.type}-${item.length}-${item.compareRank}-${item.cards.map((card) => card.id).join(",")}` === key);
    })
    .sort((a, b) => {
      const typeWeight = ["single", "pair", "triple", "triplePair", "straight", "doubleStraight", "plane", "bomb", "jokerBomb"];
      const weightA = typeWeight.indexOf(a.type);
      const weightB = typeWeight.indexOf(b.type);
      if (weightA !== weightB) return weightA - weightB;
      if (a.length !== b.length) return a.length - b.length;
      return getRankPower(a.compareRank) - getRankPower(b.compareRank);
    });
}

function getComboStrengthScore(combo) {
  const weights = {
    single: 1,
    pair: 2,
    triple: 3,
    triplePair: 4,
    straight: 5,
    doubleStraight: 6,
    plane: 7,
    bomb: 20 + combo.length,
    jokerBomb: 40,
  };
  return (weights[combo.type] || 0) * 100 + getRankPower(combo.compareRank);
}

function isSubsetCombo(combo, container) {
  if (!combo || !container || combo.cards.length >= container.cards.length) {
    return false;
  }
  const containerIds = new Set(container.cards.map((card) => card.id));
  return combo.cards.every((card) => containerIds.has(card.id));
}

function getComboBreakPenalty(combo, hand, allCombos) {
  const rankCounts = getRankCountMap(hand);
  let penalty = 0;

  if (combo.type === "single") {
    const count = rankCounts.get(combo.compareRank) || 0;
    if (count >= 2) penalty += 120;
    if (allCombos.some((candidate) => candidate.type === "straight" && isSubsetCombo(combo, candidate))) {
      penalty += 80;
    }
  }

  if (combo.type === "pair") {
    const count = rankCounts.get(combo.compareRank) || 0;
    if (count >= 3) penalty += 120;
    if (allCombos.some((candidate) => candidate.type === "doubleStraight" && isSubsetCombo(combo, candidate))) {
      penalty += 90;
    }
  }

  if (combo.type === "triple") {
    if (allCombos.some((candidate) => candidate.type === "plane" && isSubsetCombo(combo, candidate))) {
      penalty += 100;
    }
  }

  if (combo.type === "single" || combo.type === "pair" || combo.type === "triple") {
    if (allCombos.some((candidate) => candidate.type === "triplePair" && isSubsetCombo(combo, candidate))) {
      penalty += 70;
    }
  }

  return penalty;
}

function sortByConservativeUse(candidates, hand, allCombos) {
  return [...candidates].sort((a, b) => {
    const penaltyDiff = getComboBreakPenalty(a, hand, allCombos) - getComboBreakPenalty(b, hand, allCombos);
    if (penaltyDiff !== 0) {
      return penaltyDiff;
    }
    return getComboStrengthScore(a) - getComboStrengthScore(b);
  });
}

function sortByPressure(candidates, hand, allCombos) {
  return [...candidates].sort((a, b) => {
    const penaltyDiff = getComboBreakPenalty(a, hand, allCombos) - getComboBreakPenalty(b, hand, allCombos);
    if (penaltyDiff !== 0) {
      return penaltyDiff;
    }
    return getComboStrengthScore(b) - getComboStrengthScore(a);
  });
}

function getRankCountMap(hand) {
  const counts = new Map();
  for (const card of hand) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return counts;
}

function pickPreferredSingle(combos, hand) {
  const singles = sortByConservativeUse(combos.filter((combo) => combo.type === "single"), hand, combos);
  if (singles.length === 0) {
    return null;
  }

  const counts = getRankCountMap(hand);
  const singletonSingles = singles.filter((combo) => counts.get(combo.compareRank) === 1);
  return singletonSingles[0] || singles[0];
}

function compareEndgamePlans(a, b) {
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  if (a.turns !== b.turns) {
    return a.turns - b.turns;
  }
  if (a.bombCount !== b.bombCount) {
    return a.bombCount - b.bombCount;
  }
  if (a.breakPenalty !== b.breakPenalty) {
    return a.breakPenalty - b.breakPenalty;
  }
  if (a.openingStrength !== b.openingStrength) {
    return a.openingStrength - b.openingStrength;
  }
  return a.sequence.length - b.sequence.length;
}

function buildEndgamePlan(hand, memo = new Map()) {
  if (!hand || hand.length === 0) {
    return {
      turns: 0,
      bombCount: 0,
      breakPenalty: 0,
      openingStrength: 0,
      sequence: [],
    };
  }

  const key = hand.map((card) => card.id).sort().join(",");
  if (memo.has(key)) {
    return memo.get(key);
  }

  if (hand.length > 12) {
    const combos = allPossibleCombos(hand);
    const preferred = combos.filter((combo) => combo.type !== "bomb" && combo.type !== "jokerBomb");
    const source = preferred.length > 0 ? preferred : combos;
    const bestLength = source.reduce((max, combo) => Math.max(max, combo.cards.length), 1);
    const fallback = {
      turns: Math.ceil(hand.length / Math.max(1, bestLength)),
      bombCount: 0,
      breakPenalty: 0,
      openingStrength: source[0] ? getComboStrengthScore(source[0]) : 0,
      sequence: source[0] ? [source[0]] : [],
    };
    memo.set(key, fallback);
    return fallback;
  }

  let combos = allPossibleCombos(hand);
  if (hand.length > 8) {
    combos = sortByEndgamePlan(combos, { hand }, combos, true).slice(0, 18);
  }
  let bestPlan = null;
  for (const combo of combos) {
    const ids = new Set(combo.cards.map((card) => card.id));
    const remaining = hand.filter((card) => !ids.has(card.id));
    const nextPlan = buildEndgamePlan(remaining, memo);
    const candidatePlan = {
      turns: 1 + nextPlan.turns,
      bombCount: (combo.type === "bomb" || combo.type === "jokerBomb" ? 1 : 0) + nextPlan.bombCount,
      breakPenalty: getComboBreakPenalty(combo, hand, combos) + nextPlan.breakPenalty,
      openingStrength: getComboStrengthScore(combo),
      sequence: [combo, ...nextPlan.sequence],
    };
    if (!bestPlan || compareEndgamePlans(candidatePlan, bestPlan) < 0) {
      bestPlan = candidatePlan;
    }
    if (bestPlan?.turns === 1) {
      break;
    }
  }

  memo.set(key, bestPlan);
  return bestPlan;
}

function estimateTurnsToEmpty(hand, memo = new Map()) {
  return buildEndgamePlan(hand, memo).turns;
}

function estimateTurnsAfterCombo(player, combo) {
  if (!player || !combo) {
    return Number.MAX_SAFE_INTEGER;
  }
  const ids = new Set(combo.cards.map((card) => card.id));
  const remaining = player.hand.filter((card) => !ids.has(card.id));
  return buildEndgamePlan(remaining).turns;
}

function estimateTurnsForPlayer(player) {
  if (!player) {
    return Number.MAX_SAFE_INTEGER;
  }
  return buildEndgamePlan(player.hand).turns;
}

function getDangerousOpponentInfo(player, nextPlayer = getNextUnfinishedPlayer(player.id)) {
  const visibleCounts = getVisibleRemainingCounts(player);
  const opponentInfos = getOpponents(player)
    .filter((opponent) => opponent.hand.length <= 8)
    .map((opponent) => ({
      player: opponent,
      turns: estimateTurnsForPlayer(opponent),
      handSize: opponent.hand.length,
      isNext: Boolean(nextPlayer && nextPlayer.id === opponent.id),
      likelyBomb: [...visibleCounts.values()].some((remaining) => remaining >= 4) && opponent.hand.length >= 4,
    }));

  if (opponentInfos.length === 0) {
    return null;
  }

  opponentInfos.sort((a, b) => {
    if (a.turns !== b.turns) {
      return a.turns - b.turns;
    }
    if (a.likelyBomb !== b.likelyBomb) {
      return a.likelyBomb ? -1 : 1;
    }
    if (a.isNext !== b.isNext) {
      return a.isNext ? -1 : 1;
    }
    if (a.handSize !== b.handSize) {
      return a.handSize - b.handSize;
    }
    return a.player.id - b.player.id;
  });

  return opponentInfos[0];
}

function getRankDeckCapacity(rank) {
  if (rank === 16 || rank === 17) {
    return 2;
  }
  return 8;
}

function getVisibleRemainingCounts(observerPlayer) {
  const counts = new Map();
  for (let rank = 3; rank <= 17; rank += 1) {
    counts.set(rank, getRankDeckCapacity(rank));
  }

  for (const entry of state.playHistory) {
    for (const rank of entry.ranks || []) {
      counts.set(rank, Math.max(0, (counts.get(rank) || 0) - 1));
    }
  }

  for (const card of observerPlayer?.hand || []) {
    counts.set(card.rank, Math.max(0, (counts.get(card.rank) || 0) - 1));
  }

  return counts;
}

function getVisibleRankUpperBounds(observerPlayer) {
  const visibleCounts = getVisibleRemainingCounts(observerPlayer);
  let singleMax = 2;
  let pairMax = 2;
  let tripleMax = 2;

  for (let rank = 17; rank >= 3; rank -= 1) {
    const remaining = visibleCounts.get(rank) || 0;
    if (singleMax === 2 && remaining >= 1) {
      singleMax = rank;
    }
    if (pairMax === 2 && remaining >= 2) {
      pairMax = rank;
    }
    if (tripleMax === 2 && remaining >= 3) {
      tripleMax = rank;
    }
  }

  return {
    singleMax,
    pairMax,
    tripleMax,
    visibleCounts,
  };
}

function getPlayerMemoryProfile(observerPlayer, targetPlayer) {
  if (!observerPlayer || !targetPlayer) {
    return null;
  }

  const recentPlays = state.playHistory.filter((entry) => entry.playerId === targetPlayer.id).slice(0, 8);
  const recentPasses = state.passHistory.filter((entry) => entry.playerId === targetPlayer.id).slice(0, 8);
  const typeCounts = new Map();
  const passHints = new Map();
  const upperBounds = getVisibleRankUpperBounds(observerPlayer);

  for (const entry of recentPlays) {
    typeCounts.set(entry.type, (typeCounts.get(entry.type) || 0) + 1);
  }

  for (const entry of recentPasses) {
    const key = getComboMemoryKey(entry);
    const previous = passHints.get(key);
    if (!previous || getRankPower(entry.compareRank) > getRankPower(previous.compareRank)) {
      passHints.set(key, entry);
    }
  }

  const dominantType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const structuredTypes = new Set(["straight", "doubleStraight", "plane", "triplePair"]);
  const structuredCount = recentPlays.filter((entry) => structuredTypes.has(entry.type)).length;
  const simpleCount = recentPlays.filter((entry) => !structuredTypes.has(entry.type)).length;

  let likelyFinishType = dominantType;
  if (structuredCount >= 2 && structuredCount >= simpleCount) {
    likelyFinishType = "structured";
  } else if (targetPlayer.hand.length <= 2 && passHints.has("pair-2")) {
    likelyFinishType = "single";
  } else if (targetPlayer.hand.length <= 3 && dominantType === "pair") {
    likelyFinishType = "pair";
  } else if (targetPlayer.hand.length <= 3 && dominantType === "triple") {
    likelyFinishType = "triple";
  }

  for (const entry of recentPasses) {
    if (entry.type === "single") {
      upperBounds.singleMax = Math.min(upperBounds.singleMax, entry.compareRank - 1);
    }
    if (entry.type === "pair") {
      upperBounds.pairMax = Math.min(upperBounds.pairMax, entry.compareRank - 1);
    }
    if (entry.type === "triple") {
      upperBounds.tripleMax = Math.min(upperBounds.tripleMax, entry.compareRank - 1);
    }
  }

  return {
    dominantType,
    likelyFinishType,
    passHints,
    structuredCount,
    simpleCount,
    upperBounds,
  };
}

function shouldDefendAgainstOpponent(dangerInfo) {
  if (!dangerInfo) {
    return false;
  }
  if (dangerInfo.turns <= 1) {
    return true;
  }
  if (dangerInfo.isNext && dangerInfo.turns <= 2) {
    return true;
  }
  if (dangerInfo.likelyBomb && dangerInfo.handSize <= 6) {
    return true;
  }
  return dangerInfo.handSize <= 4;
}

function getMemoryPressureScore(combo, profile) {
  if (!combo || !profile) {
    return 0;
  }

  let score = 0;
  const passHint = profile.passHints.get(getComboMemoryKey(combo));
  if (passHint && compareRanksForPressure(combo.compareRank, passHint.compareRank) >= 0) {
    score += 220 + compareRanksForPressure(combo.compareRank, passHint.compareRank) * 8;
  }

  if (combo.type === "single" && compareRanksForPressure(combo.compareRank, profile.upperBounds.singleMax) > 0) {
    score += 180;
  }
  if (combo.type === "pair" && compareRanksForPressure(combo.compareRank, profile.upperBounds.pairMax) > 0) {
    score += 220;
  }
  if (combo.type === "triple" && compareRanksForPressure(combo.compareRank, profile.upperBounds.tripleMax) > 0) {
    score += 200;
  }

  const visibleCount = profile.upperBounds.visibleCounts.get(combo.compareRank) || 0;
  if ((combo.type === "single" && visibleCount <= 1) || (combo.type === "pair" && visibleCount <= 2)) {
    score += 25;
  }

  if (profile.likelyFinishType === "structured") {
    if (combo.type === "straight" || combo.type === "doubleStraight" || combo.type === "plane" || combo.type === "triplePair") {
      score += 70;
    }
    if (combo.type === "single") {
      score -= 40;
    }
  } else if (profile.likelyFinishType === "single") {
    if (combo.type !== "single") {
      score += 50;
    }
  } else if (profile.likelyFinishType === "pair") {
    if (combo.type === "pair" || combo.type === "doubleStraight") {
      score += 55;
    }
  } else if (profile.likelyFinishType && combo.type === profile.likelyFinishType) {
    score += 45;
  }

  return score;
}

function sortByMemoryPressure(candidates, player, allCombos, targetPlayer, preferPressure = true) {
  const profile = getPlayerMemoryProfile(player, targetPlayer);
  if (!profile) {
    return preferPressure
      ? sortByPressure(candidates, player.hand, allCombos)
      : sortByConservativeUse(candidates, player.hand, allCombos);
  }

  const fallback = preferPressure
    ? sortByPressure(candidates, player.hand, allCombos)
    : sortByConservativeUse(candidates, player.hand, allCombos);
  const fallbackIndex = new Map(fallback.map((combo, index) => [combo.cards.map((card) => card.id).join(","), index]));

  return [...candidates].sort((a, b) => {
    const scoreDiff = getMemoryPressureScore(b, profile) - getMemoryPressureScore(a, profile);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const aKey = a.cards.map((card) => card.id).join(",");
    const bKey = b.cards.map((card) => card.id).join(",");
    return (fallbackIndex.get(aKey) || 0) - (fallbackIndex.get(bKey) || 0);
  });
}

function getEndgameFirstCombo(player, candidates) {
  if (!player || !candidates || candidates.length === 0 || player.hand.length > 8) {
    return null;
  }

  let bestCombo = null;
  let bestPlan = null;
  for (const combo of candidates) {
    const ids = new Set(combo.cards.map((card) => card.id));
    const remaining = player.hand.filter((card) => !ids.has(card.id));
    const nextPlan = buildEndgamePlan(remaining);
    const candidatePlan = {
      turns: 1 + nextPlan.turns,
      bombCount: (combo.type === "bomb" || combo.type === "jokerBomb" ? 1 : 0) + nextPlan.bombCount,
      breakPenalty: nextPlan.breakPenalty,
      openingStrength: getComboStrengthScore(combo),
      sequence: [combo, ...nextPlan.sequence],
    };
    if (!bestPlan || compareEndgamePlans(candidatePlan, bestPlan) < 0) {
      bestPlan = candidatePlan;
      bestCombo = combo;
    }
  }
  return bestCombo;
}

function sortByEndgamePlan(candidates, player, allCombos, preferPressure = false) {
  return [...candidates].sort((a, b) => {
    const turnsDiff = estimateTurnsAfterCombo(player, a) - estimateTurnsAfterCombo(player, b);
    if (turnsDiff !== 0) {
      return turnsDiff;
    }

    const bombPenaltyDiff = ((a.type === "bomb" || a.type === "jokerBomb") ? 1 : 0)
      - ((b.type === "bomb" || b.type === "jokerBomb") ? 1 : 0);
    if (bombPenaltyDiff !== 0) {
      return bombPenaltyDiff;
    }

    const penaltyDiff = getComboBreakPenalty(a, player.hand, allCombos) - getComboBreakPenalty(b, player.hand, allCombos);
    if (penaltyDiff !== 0) {
      return penaltyDiff;
    }

    return preferPressure
      ? getComboStrengthScore(b) - getComboStrengthScore(a)
      : getComboStrengthScore(a) - getComboStrengthScore(b);
  });
}

function findExactFinishCombo(candidates, player, allCombos) {
  const finishing = candidates.filter((combo) => combo.cards.length === player.hand.length);
  if (finishing.length === 0) {
    return null;
  }
  return sortByEndgamePlan(finishing, player, allCombos, true)[0] || null;
}

function chooseBombResponse(player, bombs, nonBombs, allCombos, urgentOpponent, urgentTeammate, teammate, dangerInfo = null) {
  if (bombs.length === 0) {
    return null;
  }

  const orderedBombs = sortByEndgamePlan(bombs, player, allCombos, true);
  const bestBomb = orderedBombs[0];
  if (!bestBomb) {
    return null;
  }

  const turnsAfterBomb = estimateTurnsAfterCombo(player, bestBomb);
  if (turnsAfterBomb === 0) {
    return bestBomb;
  }

  const twoHumanMode = isTwoHumanOnlineRoom();
  const dangerousOpponent = getOpponents(player).some((opponent) => opponent.hand.length <= 2);
  const teammateCritical = Boolean(teammate && !teammate.finished && estimateTurnsForPlayer(teammate) <= 1);
  const endgame = player.hand.length <= 6;
  const defensiveThreat = shouldDefendAgainstOpponent(dangerInfo);

  if (twoHumanMode) {
    if (nonBombs.length > 0) {
      return null;
    }
    if (teammateCritical && urgentTeammate && turnsAfterBomb > 1) {
      return null;
    }
    if (dangerousOpponent) {
      return turnsAfterBomb <= 2 ? bestBomb : null;
    }
    if (defensiveThreat && dangerInfo?.isNext) {
      return turnsAfterBomb <= Math.max(1, dangerInfo.turns) ? bestBomb : null;
    }
    if (urgentOpponent || endgame) {
      return turnsAfterBomb <= 1 ? bestBomb : null;
    }
    return null;
  }

  if (defensiveThreat && dangerInfo?.isNext) {
    return turnsAfterBomb <= Math.max(1, dangerInfo.turns) ? bestBomb : null;
  }
  if (teammateCritical && urgentTeammate && turnsAfterBomb <= 2) {
    return bestBomb;
  }
  if (defensiveThreat && dangerInfo?.likelyBomb) {
    return turnsAfterBomb <= Math.max(2, dangerInfo.turns) ? bestBomb : null;
  }
  if ((dangerInfo?.isNext && dangerInfo?.turns <= 2) || urgentOpponent || endgame) {
    return bestBomb;
  }
  return null;
}

function getSimpleTeammateFeedChoices(player, combos) {
  const nonBombs = combos.filter((combo) => combo.type !== "bomb" && combo.type !== "jokerBomb");
  const simple = nonBombs.filter((combo) => combo.type === "single" || combo.type === "pair" || combo.type === "triple");
  return sortByConservativeUse(simple.length > 0 ? simple : nonBombs, player.hand, combos);
}

function chooseTeammateFriendlyLead(player, teammate, combos, urgentTeammate) {
  const feedChoices = getSimpleTeammateFeedChoices(player, combos);
  if (feedChoices.length === 0) {
    return null;
  }

  const myTurns = estimateTurnsForPlayer(player);
  const teammateTurns = estimateTurnsForPlayer(teammate);
  const filtered = urgentTeammate || teammateTurns <= myTurns
    ? feedChoices.filter((combo) => combo.type !== "bomb" && combo.type !== "jokerBomb")
    : feedChoices;

  return filtered[0] || feedChoices[0] || null;
}

function chooseProtectiveBeat(player, candidates, allCombos, preferPressure = false) {
  const simple = candidates.filter((combo) => combo.type === "single" || combo.type === "pair" || combo.type === "triple");
  const source = simple.length > 0 ? simple : candidates;
  const sorter = preferPressure ? sortByPressure : sortByConservativeUse;
  return sorter(source, player.hand, allCombos)[0] || null;
}

function chooseDefensiveLead(player, combos, dangerInfo) {
  const nonBombs = combos.filter((combo) => combo.type !== "bomb" && combo.type !== "jokerBomb");
  if (nonBombs.length === 0) {
    return null;
  }

  const pressureChoices = sortByMemoryPressure(nonBombs, player, combos, dangerInfo.player, true);
  const structured = pressureChoices.filter((combo) => combo.type !== "single");
  const heavyStructured = structured.filter((combo) => (
    combo.type === "plane"
    || combo.type === "doubleStraight"
    || combo.type === "straight"
    || combo.type === "triplePair"
  ));

  if (dangerInfo.turns <= 1) {
    return heavyStructured[0] || structured[0] || pressureChoices[0] || null;
  }

  if (dangerInfo.isNext) {
    return structured[0] || pressureChoices[0] || null;
  }

  return pressureChoices[0] || null;
}

function chooseDefensiveBeat(player, candidates, allCombos, dangerInfo) {
  if (!dangerInfo || candidates.length === 0) {
    return null;
  }

  const nonBombs = candidates.filter((combo) => combo.type !== "bomb" && combo.type !== "jokerBomb");
  const source = nonBombs.length > 0 ? nonBombs : candidates;
  const pressureChoices = sortByMemoryPressure(source, player, allCombos, dangerInfo.player, true);
  const structured = pressureChoices.filter((combo) => combo.type !== "single");

  if (dangerInfo.turns <= 1) {
    return structured[0] || pressureChoices[0] || null;
  }

  if (dangerInfo.isNext) {
    return structured[0] || pressureChoices[0] || null;
  }

  return pressureChoices[0] || null;
}

function chooseLeadCombo(player, combos, urgentOpponent, urgentTeammate, nextPlayer, dangerInfo = null) {
  const defensiveThreat = shouldDefendAgainstOpponent(dangerInfo) && nextPlayer && nextPlayer.team !== player.team;
  const searchedLead = getEndgameFirstCombo(player, combos);
  if (searchedLead && !defensiveThreat) {
    return searchedLead;
  }

  const nonBombs = combos.filter((combo) => combo.type !== "bomb" && combo.type !== "jokerBomb");
  const planes = sortByConservativeUse(nonBombs.filter((combo) => combo.type === "plane"), player.hand, combos);
  const doubleStraights = sortByConservativeUse(nonBombs.filter((combo) => combo.type === "doubleStraight"), player.hand, combos);
  const straights = sortByConservativeUse(nonBombs.filter((combo) => combo.type === "straight"), player.hand, combos);
  const triplePairs = sortByConservativeUse(nonBombs.filter((combo) => combo.type === "triplePair"), player.hand, combos);
  const triples = sortByConservativeUse(nonBombs.filter((combo) => combo.type === "triple"), player.hand, combos);
  const pairs = sortByConservativeUse(nonBombs.filter((combo) => combo.type === "pair"), player.hand, combos);
  const preferredSingle = pickPreferredSingle(nonBombs, player.hand);
  const conservativeNonBombs = sortByConservativeUse(nonBombs, player.hand, combos);
  const pressureNonBombs = sortByPressure(nonBombs, player.hand, combos);
  const endgameChoices = sortByEndgamePlan(nonBombs.length > 0 ? nonBombs : combos, player, combos, urgentOpponent);
  const exactFinish = findExactFinishCombo(nonBombs.length > 0 ? nonBombs : combos, player, combos)
    || findExactFinishCombo(combos, player, combos);
  const twoHumanMode = isTwoHumanOnlineRoom();
  const teammate = getTeammate(player);

  if (exactFinish) {
    return exactFinish;
  }

  if (twoHumanMode && teammate && nextPlayer && nextPlayer.team === player.team) {
    const teammateFriendlyLead = chooseTeammateFriendlyLead(player, teammate, combos, urgentTeammate);
    if (teammateFriendlyLead) {
      return teammateFriendlyLead;
    }
  }

  if ((twoHumanMode && player.hand.length <= 8) || player.hand.length <= 5) {
    const teammateSafeChoices = urgentTeammate
      ? endgameChoices.filter((combo) => combo.type !== "bomb" && combo.type !== "jokerBomb")
      : endgameChoices;
    return teammateSafeChoices[0] || endgameChoices[0] || combos[0];
  }

  if (urgentTeammate && nextPlayer && nextPlayer.team === player.team) {
    return preferredSingle || pairs[0] || triples[0] || conservativeNonBombs[0] || combos[0];
  }

  if (defensiveThreat) {
    const defensiveLead = chooseDefensiveLead(player, combos, dangerInfo);
    if (defensiveLead) {
      return defensiveLead;
    }
  }

  if (urgentOpponent) {
    return sortByPressure(planes, player.hand, combos)[0]
      || sortByPressure(doubleStraights, player.hand, combos)[0]
      || sortByPressure(straights, player.hand, combos)[0]
      || sortByPressure(triplePairs, player.hand, combos)[0]
      || sortByPressure(triples, player.hand, combos)[0]
      || sortByPressure(pairs, player.hand, combos)[0]
      || preferredSingle
      || pressureNonBombs[0]
      || combos[0];
  }

  if (nextPlayer && nextPlayer.team === player.team) {
    return pairs[0] || triples[0] || preferredSingle || straights[0] || conservativeNonBombs[0] || combos[0];
  }

  return pairs[0]
    || preferredSingle
    || triples[0]
    || triplePairs[0]
    || straights[0]
    || doubleStraights[0]
    || planes[0]
    || preferredSingle
    || conservativeNonBombs[0]
    || combos[0];
}

function chooseRecommendedMove(player) {
  const combos = allPossibleCombos(player.hand);
  if (combos.length === 0) {
    return null;
  }

  const teammate = getTeammate(player);
  const nextPlayer = getNextUnfinishedPlayer(player.id);
  const previousPlayer = getPreviousUnfinishedPlayer(player.id);
  const opponents = getOpponents(player);
  const urgentOpponent = opponents.some((opponent) => opponent.hand.length <= 3);
  const urgentTeammate = teammate && !teammate.finished && estimateTurnsForPlayer(teammate) <= 1;
  const twoHumanMode = isTwoHumanOnlineRoom();
  const dangerInfo = getDangerousOpponentInfo(player, nextPlayer);
  const defensiveOpponent = shouldDefendAgainstOpponent(dangerInfo);
  const opponentAfterMe = nextPlayer && nextPlayer.team !== player.team;

  if (!state.currentCombo) {
    return chooseLeadCombo(player, combos, urgentOpponent, urgentTeammate, nextPlayer, dangerInfo);
  }

  const lastPlayer = state.players[state.lastPlayPlayer];
  if (lastPlayer && lastPlayer.team === player.team) {
    return null;
  }

  const beating = combos.filter((combo) => canBeat(combo, state.currentCombo));
  if (beating.length === 0) {
    return null;
  }

  const searchedBeat = getEndgameFirstCombo(player, beating);
  if (searchedBeat && !(defensiveOpponent && opponentAfterMe)) {
    return searchedBeat;
  }

  const nonBombs = sortByConservativeUse(
    beating.filter((combo) => combo.type !== "bomb" && combo.type !== "jokerBomb"),
    player.hand,
    combos
  );
  const endgameNonBombs = sortByEndgamePlan(nonBombs, player, combos, urgentOpponent);
  const bombs = beating.filter((combo) => combo.type === "bomb" || combo.type === "jokerBomb");
  const teammateAfterMe = nextPlayer && nextPlayer.team === player.team;
  const teammateBeforeMe = previousPlayer && previousPlayer.team === player.team;
  const exactFinish = findExactFinishCombo(nonBombs, player, combos);

  if (exactFinish) {
    return exactFinish;
  }

  if (((twoHumanMode && player.hand.length <= 8) || player.hand.length <= 5) && !(defensiveOpponent && opponentAfterMe)) {
    if (endgameNonBombs.length > 0) {
      return endgameNonBombs[0];
    }
  }

  if (urgentTeammate && endgameNonBombs.length > 0) {
    return endgameNonBombs[0];
  }

  if (twoHumanMode && teammateAfterMe && nonBombs.length > 0) {
    const teammateLaneCombo = chooseProtectiveBeat(player, endgameNonBombs.length > 0 ? endgameNonBombs : nonBombs, combos, false);
    if (teammateLaneCombo) {
      return teammateLaneCombo;
    }
  }

  if (twoHumanMode && teammateBeforeMe && nonBombs.length > 0) {
    const coverCombo = chooseProtectiveBeat(player, endgameNonBombs.length > 0 ? endgameNonBombs : nonBombs, combos, urgentOpponent);
    if (coverCombo) {
      return coverCombo;
    }
  }

  if (defensiveOpponent && opponentAfterMe) {
    const defensiveBeat = chooseDefensiveBeat(player, endgameNonBombs.length > 0 ? endgameNonBombs : nonBombs, combos, dangerInfo);
    if (defensiveBeat) {
      return defensiveBeat;
    }
  }

  if (urgentOpponent) {
    if (endgameNonBombs.length > 0 && opponentAfterMe) {
      return twoHumanMode ? endgameNonBombs[0] : sortByPressure(nonBombs, player.hand, combos)[0];
    }
    const bombAnswer = chooseBombResponse(player, bombs, nonBombs, combos, urgentOpponent, urgentTeammate, teammate, dangerInfo);
    if (bombAnswer) {
      return bombAnswer;
    }
  }

  if (defensiveOpponent) {
    const bombAnswer = chooseBombResponse(player, bombs, nonBombs, combos, urgentOpponent, urgentTeammate, teammate, dangerInfo);
    if (bombAnswer) {
      return bombAnswer;
    }
  }

  if (nonBombs.length > 0) {
    return twoHumanMode ? (endgameNonBombs[0] || nonBombs[0]) : nonBombs[0];
  }

  return chooseBombResponse(player, bombs, nonBombs, combos, urgentOpponent, urgentTeammate, teammate, dangerInfo);
}

function chooseAiMove(player) {
  return chooseRecommendedMove(player);
}

function maybeRunAiTurn() {
  if (state.winnerTeam !== null) {
    return;
  }

  if (!state.onlineMode && !isGameplayViewVisible()) {
    return;
  }

  const player = state.players[state.currentPlayer];
  if (player.isHuman || player.finished) {
    return;
  }

  clearTimeout(state.aiTimer);
  state.aiTimer = setTimeout(() => {
    const combo = chooseAiMove(player);
    if (combo) {
      applyPlay(player, combo);
    } else {
      applyPass(player);
    }

    if (endIfNeeded()) {
      render();
      return;
    }

    advanceTurn();
  }, 700);
}

function handleHumanPlay() {
  const player = state.players[0];
  if (state.currentPlayer !== 0 || player.finished || state.winnerTeam !== null) {
    return;
  }

  const combo = analyzeCombo(getSelectedCards());
  if (!combo) {
    log("The selected cards do not form a legal combo.");
    showToast("Illegal combo");
    render();
    return;
  }

  if (!canBeat(combo, state.currentCombo)) {
    log("That combo cannot beat the current table combo.");
    showToast("Not strong enough");
    render();
    return;
  }

  applyPlay(player, combo);
  state.selectedIds.clear();

  if (endIfNeeded()) {
    render();
    return;
  }

  advanceTurn();
}

function handleHumanPass() {
  const player = state.players[0];
  if (state.currentPlayer !== 0 || player.finished || state.winnerTeam !== null) {
    return;
  }

  if (!state.currentCombo) {
    log("You are leading a new trick, so you cannot pass.");
    render();
    return;
  }

  applyPass(player);
  advanceTurn();
}

function applySuggestedSelection() {
  const player = state.players[0];
  if (state.currentPlayer !== 0 || player.finished || state.winnerTeam !== null) {
    return;
  }

  const combo = chooseRecommendedMove(player);
  if (!combo) {
    showToast("No suggestion available right now.");
    return;
  }

  state.selectedIds = new Set(combo.cards.map((card) => card.id));
  render();
}

function renderSeat(player) {
  const panel = els.panels[player.id];
  panel.innerHTML = "";

  const header = document.createElement("div");
  header.className = "player-header";
  header.innerHTML = `
    <div>
      <strong>${player.name}</strong>
      <div class="player-role">${player.role} - ${player.team === 0 ? "our team" : "opponents"}</div>
    </div>
    <div>${player.finished ? `<span class="player-finished">Rank ${player.rank}</span>` : `${player.hand.length} cards left`}</div>
  `;
  panel.appendChild(header);

  const trickHint = document.createElement("div");
  trickHint.className = "player-role";
  if (state.lastPlayPlayer === player.id && state.currentCombo) {
    trickHint.textContent = `Current best: ${TYPE_LABELS[state.currentCombo.type]}`;
  } else if (state.currentPlayer === player.id && !state.winnerTeam) {
    trickHint.textContent = "Active";
  } else {
    trickHint.textContent = "Waiting";
  }
  panel.appendChild(trickHint);

  if (player.isHuman) {
    const hand = document.createElement("div");
    hand.className = "hand";

    for (const card of player.hand) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `card ${card.color} ${state.selectedIds.has(card.id) ? "selected" : ""}`;
      button.innerHTML = `
        <span class="card-rank">${card.rankLabel}</span>
        <span class="card-suit">${card.isJoker ? card.rankLabel : card.suitSymbol}</span>
      `;
      button.disabled = state.currentPlayer !== 0 || state.winnerTeam !== null;
      button.addEventListener("click", () => {
        if (state.selectedIds.has(card.id)) {
          state.selectedIds.delete(card.id);
        } else {
          state.selectedIds.add(card.id);
        }
        render();
      });
      hand.appendChild(button);
    }

    const actions = document.createElement("div");
    actions.className = "human-actions";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.id = "play-btn";
    playBtn.textContent = "Play";
    playBtn.disabled = state.currentPlayer !== 0 || state.winnerTeam !== null;
    playBtn.addEventListener("click", handleHumanPlay);

    const passBtn = document.createElement("button");
    passBtn.type = "button";
    passBtn.id = "pass-btn";
    passBtn.textContent = "Pass";
    passBtn.disabled = state.currentPlayer !== 0 || state.winnerTeam !== null || !state.currentCombo;
    passBtn.addEventListener("click", handleHumanPass);

    const suggestBtn = document.createElement("button");
    suggestBtn.type = "button";
    suggestBtn.id = "suggest-btn";
    suggestBtn.textContent = "AI Hint";
    suggestBtn.disabled = state.currentPlayer !== 0 || state.winnerTeam !== null;
    suggestBtn.addEventListener("click", applySuggestedSelection);

    actions.appendChild(playBtn);
    actions.appendChild(passBtn);
    actions.appendChild(suggestBtn);

    panel.appendChild(actions);
    panel.appendChild(hand);
  } else {
    const mini = document.createElement("div");
    mini.className = "mini-hand";
    const showCount = Math.min(player.hand.length, 10);
    for (let i = 0; i < showCount; i += 1) {
      const back = document.createElement("div");
      back.className = "card-back mini-card";
      back.textContent = "GD";
      mini.appendChild(back);
    }
    if (player.hand.length > showCount) {
      const more = document.createElement("div");
      more.className = "mini-placeholder";
      more.textContent = `+${player.hand.length - showCount}`;
      mini.appendChild(more);
    }
    panel.appendChild(mini);
  }
}

function renderTrickArea() {
  els.trickArea.innerHTML = "";
  if (state.trickHistory.length === 0) {
    const empty = document.createElement("div");
    empty.className = "trick-empty";
    empty.textContent = "牌桌还没有出牌。";
    els.trickArea.appendChild(empty);
    return;
  }

  const [latest, ...history] = state.trickHistory;
  els.trickArea.appendChild(createTrickBlock(latest, true));

  if (history.length > 0) {
    const details = document.createElement("details");
    details.className = "trick-history";
    const containsAiMove = isTwoHumanOnlineRoom() && history.some((item) => !item.reset && state.players[item.playerId]?.controlledByAi);
    if (containsAiMove) {
      details.open = true;
    }

    const summary = document.createElement("summary");
    summary.textContent = containsAiMove
      ? `更早出牌记录 ${history.length} 条（含 AI 动作）`
      : `更早出牌记录 ${history.length} 条`;
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "trick-history-body";
    for (const item of history) {
      body.appendChild(createHistoryItem(item));
    }
    details.appendChild(body);
    els.trickArea.appendChild(details);
  }
}

function createTrickBlock(item, isCurrent) {
  const block = document.createElement("div");
  const actor = state.players[item.playerId];
  const isAiPlay = Boolean(actor?.controlledByAi && !item.reset);
  block.className = `trick-block${isCurrent ? " current" : ""} ${getTrickSeatClass(item.playerId)}${isCurrent && item.token === state.latestTrickToken ? " flash" : ""}${isCurrent && isAiPlay ? " ai-play" : ""}`;
  const actorLabel = actor?.controlledByAi ? `${actor.name}（AI）` : actor?.name;
  if (item.reset) {
    block.innerHTML = `<div class="trick-title">${actorLabel}</div><div>重新获得牌权</div>`;
    return block;
  }

  const title = document.createElement("div");
  title.className = "trick-title";
  title.textContent = isCurrent ? "最新出牌" : state.players[item.playerId].name;

  const meta = document.createElement("div");
  meta.className = "trick-meta";
  meta.textContent = `${actorLabel} - ${TYPE_LABELS[item.combo.type] || item.combo.type}`;

  const cards = document.createElement("div");
  cards.className = "trick-cards";
  for (const card of item.combo.cards) {
    const cardEl = document.createElement("div");
    cardEl.className = `card trick-card ${card.color}`;
    cardEl.innerHTML = `
      <span class="card-rank">${card.rankLabel}</span>
      <span class="card-suit">${card.isJoker ? card.rankLabel : card.suitSymbol}</span>
    `;
    cards.appendChild(cardEl);
  }

  block.appendChild(title);
  block.appendChild(meta);
  block.appendChild(cards);
  return block;
}

function createHistoryItem(item) {
  const row = document.createElement("div");
  row.className = "trick-history-item";
  const actor = state.players[item.playerId];
  const actorLabel = actor?.controlledByAi ? `${actor.name}（AI）` : actor?.name;
  if (item.reset) {
    row.innerHTML = `<strong>${actorLabel}</strong><span>重新获得牌权</span>`;
    return row;
  }

  row.innerHTML = `
    <strong>${actorLabel}</strong>
    <span>${TYPE_LABELS[item.combo.type] || item.combo.type} · ${cardsToText(item.combo.cards)}</span>
  `;
  return row;
}

function isTwoHumanOnlineRoom() {
  return state.onlineMode && state.players.filter((player) => player.isHuman).length === 2;
}

function getHumanPlayableContext() {
  const localPlayer = getLocalSeatPlayer();
  if (!localPlayer || state.currentPlayer !== localPlayer.id || state.winnerTeam !== null) {
    return { playableIds: new Set(), blockedIds: new Set(), beatingCombos: [], allCombos: [] };
  }
  const allCombos = allPossibleCombos(localPlayer.hand);
  const legalCombos = state.currentCombo ? allCombos.filter((combo) => canBeat(combo, state.currentCombo)) : allCombos;
  const playableIds = new Set();
  for (const combo of legalCombos) {
    for (const card of combo.cards) {
      playableIds.add(card.id);
    }
  }
  const blockedIds = new Set(localPlayer.hand.map((card) => card.id).filter((id) => !playableIds.has(id)));
  return {
    playableIds,
    blockedIds,
    beatingCombos: legalCombos,
    allCombos,
  };
}

function chooseSmallestPlayableCombo(context = getHumanPlayableContext()) {
  const localPlayer = getLocalSeatPlayer();
  if (!localPlayer || !context.beatingCombos.length) {
    return null;
  }
  const ordered = sortByConservativeUse(context.beatingCombos, localPlayer.hand, context.allCombos);
  return ordered[0] || null;
}

function getLatestAiPlay() {
  return state.trickHistory.find((item) => !item.reset && state.players[item.playerId]?.controlledByAi) || null;
}

function getTrickSeatClass(playerId) {
  const displaySeatId = getDisplaySeatId(playerId);
  if (displaySeatId === 2) return "trick-seat-north";
  if (displaySeatId === 1) return "trick-seat-west";
  if (displaySeatId === 3) return "trick-seat-east";
  return "trick-seat-south";
}

function getDisplaySeatId(playerId) {
  if (!state.onlineMode || state.localSeatId === null || state.localSeatId === undefined || state.localSeatId < 0) {
    return playerId;
  }
  return (playerId - state.localSeatId + 4) % 4;
}

function getLocalPerspectiveTeam(teamId) {
  const localPlayer = getLocalSeatPlayer();
  if (!localPlayer) {
    return teamId === 0 ? "你方" : "对方";
  }
  return teamId === localPlayer.team ? "你方" : "对方";
}

function renderSummary() {
  if (state.winnerTeam !== null) {
    const side = getLocalPerspectiveTeam(state.winnerTeam);
    const names = state.finishedOrder.map((id) => state.players[id].name).join(" -> ");
    els.roundSummary.innerHTML = `<strong>${side}获胜。</strong> 出完顺序：${names}`;
  } else if (state.currentCombo) {
    const aiHint = isTwoHumanOnlineRoom() && getLatestAiPlay()
      ? ` 最近 AI 出牌：${state.players[getLatestAiPlay().playerId].name} · ${comboToText(getLatestAiPlay().combo)}`
      : "";
    els.roundSummary.textContent = `当前待压：${comboToText(state.currentCombo)}${aiHint}`;
  } else {
    els.roundSummary.textContent = "新一轮开始，当前玩家可以自由出牌。";
  }
}

function renderRoundResult() {
  if (!els.resultOverlay || !els.resultSummary) {
    return;
  }

  if (!state.roundResult) {
    els.resultOverlay.classList.add("hidden");
    els.resultSummary.innerHTML = "";
    return;
  }

  const winnerLabel = `${getLocalPerspectiveTeam(state.roundResult.winnerTeam)}获胜`;
  const outcomeLabel = state.roundResult.outcomeType === "double" ? "双下" : "单下";
  const nextLevel = state.roundResult.nextLevelRank ?? advanceLevelRank(state.levelRank, state.roundResult.levelAdvance || 1);
  const progressionLabel = state.roundResult.matchEnded ? "整场结束" : `下局主牌 ${getLevelLabel(nextLevel)}`;
  const placementsHtml = state.roundResult.placements
    .map((item) => `
      <div class="result-row">
        <span>第 ${item.rank} 名 · ${item.name}</span>
        <span>本局 +${item.roundPoints} · 累计 ${item.totalScore}</span>
      </div>
    `)
    .join("");

  const teamHtml = state.roundResult.teamTotals
    .map((item) => `
      <div class="result-row">
        <span>${getLocalPerspectiveTeam(item.team)}</span>
        <span>本局 ${item.roundPoints} · 累计 ${item.totalScore}</span>
      </div>
    `)
    .join("");

  els.resultSummary.innerHTML = `
    <div class="result-banner">${winnerLabel} · ${outcomeLabel} · ${progressionLabel}</div>
    <div class="result-grid">
      <div class="result-card">
        <h3>玩家排名</h3>
        ${placementsHtml}
      </div>
      <div class="result-card">
        <h3>队伍得分与升级</h3>
        <div class="result-row">
          <span>升级结果</span>
          <span>主牌 +${state.roundResult.levelAdvance}</span>
        </div>
        ${teamHtml}
      </div>
    </div>
  `;
  if (els.closeResultBtn) {
    els.closeResultBtn.textContent = state.roundResult.matchEnded ? "重新开赛" : "下一局";
  }
  els.resultOverlay.classList.remove("hidden");
}

function render() {
  renderRoundResult();
  for (const player of state.players) {
    renderSeat(player);
  }
  const humanPlayableContext = getHumanPlayableContext();

  if (state.winnerTeam !== null) {
    els.turnIndicator.classList.remove("turn-active");
    els.turnIndicator.innerHTML = `
      <div class="turn-hud-main">
        <span class="turn-hud-badge">本局状态</span>
        <span class="turn-hud-name">本局已结束</span>
      </div>
      <div class="turn-hud-meta">
        <span class="turn-hud-chip turn-hud-chip-muted">请等待房主开始下一局</span>
      </div>
    `;
  } else {
    const current = state.players[state.currentPlayer];
    const aiSuffix = isTwoHumanOnlineRoom() && current.controlledByAi ? " 这是 AI 回合，请稍候。" : "";
    const busySuffix = isOnlineActionLocked() ? " 动作提交中，请稍候。" : "";
    els.turnIndicator.classList.add("turn-active");
    const roleLabel = current.controlledByAi ? "AI" : "玩家";
    const statusChips = [
      `<span class="turn-hud-chip">${escapeHtml(roleLabel)}</span>`,
      `<span class="turn-hud-chip">${escapeHtml(getLocalPerspectiveTeam(current.team))}</span>`,
    ];
    if (aiSuffix) {
      statusChips.push(`<span class="turn-hud-chip turn-hud-chip-warn">${escapeHtml(aiSuffix.trim())}</span>`);
    }
    if (busySuffix) {
      statusChips.push(`<span class="turn-hud-chip turn-hud-chip-busy">${escapeHtml(busySuffix.trim())}</span>`);
    }
    els.turnIndicator.innerHTML = `
      <div class="turn-hud-main">
        <span class="turn-hud-badge">当前行动</span>
        <span class="turn-hud-name">${escapeHtml(current.name)}</span>
      </div>
      <div class="turn-hud-meta">${statusChips.join("")}</div>
    `;
  }

  renderTrickArea();
  renderSummary();
  els.trumpBanner.innerHTML = `
    <span class="trump-label">本轮主牌</span>
    <span class="trump-rank">${getLevelLabel(state.levelRank)}</span>
  `;

  if (els.tributeBanner) {
    if (!state.currentTributeInfo) {
      els.tributeBanner.classList.add("hidden");
      els.tributeBanner.innerHTML = "";
    } else if (state.currentTributeInfo.resisted) {
      const player = state.players[state.currentTributeInfo.resistantPlayerId];
      els.tributeBanner.classList.remove("hidden");
      els.tributeBanner.innerHTML = `<strong>本局抗贡：</strong>${player.name} 持有双大王，取消本局全部进贡。`;
    } else {
      const title = state.currentTributeInfo.type === "double" ? "本局双贡" : "本局单贡";
      const details = state.currentTributeInfo.transfers
        .map((item) => {
          const fromPlayer = state.players[item.from];
          const toPlayer = state.players[item.to];
          return `${fromPlayer.name} 进贡 ${cardsToText([item.tributeCard])} 给 ${toPlayer.name}，${toPlayer.name} 回贡 ${cardsToText([item.returnCard])}`;
        })
        .join("<br>");
      els.tributeBanner.classList.remove("hidden");
      els.tributeBanner.innerHTML = `<strong>${title}：</strong><br>${details}`;
    }
  }

  if (els.rulesContent) {
    els.rulesContent.innerHTML = `
      <div class="rule-item"><strong>主牌升级：</strong>主牌从 3 开始，单下升一级，双下升两级；打到 A 后再赢一局整场结束。</div>
      <div class="rule-item"><strong>主牌大小：</strong>大王 &gt; 小王 &gt; 本轮主牌 &gt; 2 &gt; A &gt; K ... &gt; 3。</div>
      <div class="rule-item"><strong>逢人配：</strong>红桃主牌是逢人配，可替代除大小王外的任意点数参与组合，AI 与联机同步共用这套判定。</div>
      <div class="rule-item"><strong>顺子类限制：</strong>顺子、连对、钢板本体不能包含 2、王、主牌点数；红桃主牌只可作为逢人配补缺口。</div>
      <div class="rule-item"><strong>进贡：</strong>新一局开局前按上一局名次执行，前两名同队为双贡。</div>
      <div class="rule-item"><strong>抗贡：</strong>进贡方任一玩家若持有双大王，则本局取消全部进贡。</div>
    `;
  }

  els.log.innerHTML = "";
  for (const entry of state.logs) {
    const line = document.createElement("div");
    line.className = "log-line";
    line.textContent = entry;
    els.log.appendChild(line);
  }

  const selectedCombo = analyzeCombo(getSelectedCards());
  const localPlayer = getLocalSeatPlayer();
  const isLocalTurn = Boolean(localPlayer && state.currentPlayer === localPlayer.id);

  if (isLocalTurn && selectedCombo) {
    els.turnIndicator.innerHTML += `
      <div class="turn-hud-extra">
        <span class="turn-hud-extra-label">当前选择</span>
        <span class="turn-hud-extra-value">${escapeHtml(comboToText(selectedCombo))}</span>
      </div>
    `;
  } else if (isLocalTurn && state.selectedIds.size > 0) {
    els.turnIndicator.innerHTML += `
      <div class="turn-hud-extra">
        <span class="turn-hud-extra-label message-error">牌型非法</span>
        <span class="turn-hud-extra-value">${escapeHtml(describeBeatRequirement(state.currentCombo))}</span>
      </div>
    `;
  } else if (isLocalTurn && humanPlayableContext.beatingCombos.length > 0) {
    const preview = humanPlayableContext.beatingCombos.slice(0, 3).map((combo) => comboToText(combo)).join(" / ");
    els.turnIndicator.innerHTML += `
      <div class="turn-hud-extra">
        <span class="turn-hud-extra-label">可出候选</span>
        <span class="turn-hud-extra-value">${escapeHtml(preview)}${humanPlayableContext.beatingCombos.length > 3 ? " ..." : ""}</span>
      </div>
    `;
  } else if (isLocalTurn && state.currentCombo) {
    els.turnIndicator.innerHTML += `
      <div class="turn-hud-extra">
        <span class="turn-hud-extra-label message-error">当前无法压住</span>
        <span class="turn-hud-extra-value">${escapeHtml(describeBeatRequirement(state.currentCombo))}</span>
      </div>
    `;
  }
  updateTopbarScoreboard();
  const latest = state.trickHistory[0];
  if (latest && latest.token > state.lastAiFeedbackToken) {
    const actor = state.players[latest.playerId];
    state.lastAiFeedbackToken = latest.token;
    if (actor?.controlledByAi && !latest.reset && isGameplayViewVisible()) {
      showToast(`${actor.name}（AI）出了 ${comboToText(latest.combo)}`);
      playUiPing();
    }
  }
  if (!state.onlineMode) {
    maybeRunAiTurn();
  }
}

function updateTopbarScoreboard() {
  let scoreboard = document.getElementById("match-scoreboard");
  if (!scoreboard) {
    scoreboard = document.createElement("div");
    scoreboard.id = "match-scoreboard";
    scoreboard.className = "scoreboard";
    const controls = document.querySelector(".controls");
    controls.insertAdjacentElement("afterbegin", scoreboard);
  }

  const teamZero = state.players
    .filter((player) => player.team === 0)
    .reduce((sum, player) => sum + (state.matchScores[player.id] || 0), 0);
  const teamOne = state.players
    .filter((player) => player.team === 1)
    .reduce((sum, player) => sum + (state.matchScores[player.id] || 0), 0);

  scoreboard.innerHTML = `
    <span class="score-pill">${getLocalPerspectiveTeam(0)} ${teamZero}</span>
    <span class="score-pill">${getLocalPerspectiveTeam(1)} ${teamOne}</span>
  `;
}

function toggleInfoPanel() {
  const hidden = els.infoPanel.classList.toggle("hidden");
  els.infoToggleBtn.setAttribute("aria-expanded", String(!hidden));
  els.infoToggleBtn.textContent = hidden ? "Match Info" : "Hide Info";
}

function sortHumanHand() {
  const human = state.players[0];
  human.hand = sortCards(human.hand);
  render();
}

function startNewGame() {
  clearTimeout(state.aiTimer);
  state.aiTimer = null;
  state.onlineMode = false;
  state.localSeatId = 0;
  state.localPlayerOwnerId = null;
  state.lastOnlineSnapshotSignature = "";
  const nextSetup = state.pendingRoundSetup;
  state.roundResult = null;
  if (els.resultOverlay) {
    els.resultOverlay.classList.add("hidden");
  }

  if (nextSetup) {
    state.levelRank = nextSetup.levelRank;
    state.roundNumber = nextSetup.roundNumber;
    state.pendingTribute = nextSetup.tributePlan;
  } else {
    state.levelRank = 3;
    state.roundNumber = 1;
    state.pendingTribute = null;
  }

  state.players = createPlayers();
  state.selectedIds.clear();
  state.currentCombo = null;
  state.lastPlayPlayer = null;
  state.consecutivePasses = 0;
  state.logs = [];
  state.finishedOrder = [];
  state.winnerTeam = null;
  state.trickHistory = [];
  state.latestTrickToken = 0;
  state.currentTributeInfo = null;

  const deck = shuffle(buildDeck());
  for (let i = 0; i < deck.length; i += 1) {
    state.players[i % 4].hand.push(deck[i]);
  }
  for (const player of state.players) {
    player.hand = sortCards(player.hand);
  }

  applyTribute(state.pendingTribute);

  state.currentPlayer = nextSetup ? nextSetup.startingPlayerId : Math.floor(Math.random() * 4);
  state.pendingRoundSetup = null;
  log(`${state.players[state.currentPlayer].name} 先手开始第 ${state.roundNumber} 局。`);
  log(`本局主牌：${getLevelLabel(state.levelRank)}`);
  log("Rules loaded: trump, wildcard, tribute, core combos, bombs and joker bomb.");
  render();
  maybeRunAiTurn();
}

els.newGameBtn.addEventListener("click", startNewGame);
els.sortBtn.addEventListener("click", sortHumanHand);
els.infoToggleBtn.addEventListener("click", toggleInfoPanel);
if (els.closeResultBtn) {
  els.closeResultBtn.addEventListener("click", () => {
    if (state.onlineMode && window.GuandanOnlineBridge?.requestNextRound) {
      window.GuandanOnlineBridge.requestNextRound();
      return;
    }
    if (state.roundResult?.matchEnded) {
      startNewGame();
      return;
    }
    if (state.roundResult || state.pendingRoundSetup) {
      startNewGame();
      return;
    }
    els.resultOverlay.classList.add("hidden");
  });
}

initializeScores();
startNewGame();

state.onlineMode = false;
state.localSeatId = 0;
state.localPlayerOwnerId = null;
const gameCore = window.GuandanGameCore;

function getLocalSeatPlayer() {
  if (state.onlineMode && state.localSeatId < 0) {
    return null;
  }
  return state.players[state.localSeatId] || state.players[0] || null;
}

function exportOnlineSnapshot() {
  const snapshot = gameCore.buildOnlineSnapshot(state);

  if (state.onlineMode) {
    state.lastOnlineSnapshotSignature = gameCore.buildOnlineSnapshotSignature(snapshot, state.localPlayerOwnerId);
  }

  return snapshot;
}

function buildOnlineSnapshotSignature(snapshot, localPlayerOwnerId) {
  return gameCore.buildOnlineSnapshotSignature(snapshot, localPlayerOwnerId);
}

function importOnlineSnapshot(snapshot, localPlayerOwnerId) {
  clearTimeout(state.aiTimer);
  state.aiTimer = null;
  const incomingSignature = buildOnlineSnapshotSignature(snapshot, localPlayerOwnerId);
  if (incomingSignature === state.lastOnlineSnapshotSignature) {
    return false;
  }
  gameCore.importOnlineSnapshot(state, snapshot, localPlayerOwnerId);
  state.lastOnlineSnapshotSignature = incomingSignature;
  render();
  return true;
}

function startOnlineRoundFromSetup(gameSetup, localPlayerOwnerId) {
  clearTimeout(state.aiTimer);
  state.aiTimer = null;
  gameCore.startOnlineRoundFromSetup(state, gameSetup, localPlayerOwnerId, {
    shuffle,
    buildDeck,
    sortCards,
    log,
    getLevelLabel,
    initializeScores,
  });
  render();
  return exportOnlineSnapshot();
}

function restartOnlineMatch() {
  if (!state.onlineMode) {
    return null;
  }
  gameCore.restartOnlineMatch(state, {
    shuffle,
    buildDeck,
    sortCards,
    log,
    getLevelLabel,
    initializeScores,
  });
  render();
  return exportOnlineSnapshot();
}

function startNextOnlineRound() {
  if (!state.onlineMode) {
    return null;
  }
  if (state.roundResult?.matchEnded) {
    return restartOnlineMatch();
  }
  clearTimeout(state.aiTimer);
  state.aiTimer = null;
  if (els.resultOverlay) {
    els.resultOverlay.classList.add("hidden");
  }
  gameCore.startNextOnlineRound(state, {
    shuffle,
    buildDeck,
    sortCards,
    log,
    getLevelLabel,
    applyTribute,
    initializeScores,
  });
  render();
  return exportOnlineSnapshot();
}

function processOnlineAction(action) {
  if (!action || state.winnerTeam !== null) {
    return false;
  }

  const player = state.players[action.seatId];
  if (!player || player.finished || state.currentPlayer !== player.id) {
    return false;
  }

  if (action.type === "pass") {
    if (!state.currentCombo) {
      return false;
    }
    applyPass(player);
  } else {
    const cardMap = new Map(player.hand.map((card) => [card.id, card]));
    const cards = (action.cardIds || []).map((id) => cardMap.get(id)).filter(Boolean);
    if (cards.length !== (action.cardIds || []).length) {
      return false;
    }
    const combo = analyzeCombo(cards);
    if (!combo || !canBeat(combo, state.currentCombo)) {
      return false;
    }
    applyPlay(player, combo);
  }

  if (endIfNeeded()) {
    render();
    return true;
  }

  if (!maybeResetTrickSafe()) {
    state.currentPlayer = nextActivePlayer(state.currentPlayer);
  }
  render();
  return true;
}

function resolveOnlineAiTurns() {
  if (!state.onlineMode || state.winnerTeam !== null) {
    return false;
  }

  let changed = false;
  let guard = 0;
  while (guard < 12) {
    guard += 1;
    const player = state.players[state.currentPlayer];
    if (!player || player.finished || !player.controlledByAi) {
      break;
    }
    const combo = chooseAiMove(player);
    if (combo) {
      applyPlay(player, combo);
    } else {
      applyPass(player);
    }
    changed = true;

    if (endIfNeeded()) {
      break;
    }

    if (!maybeResetTrickSafe()) {
      state.currentPlayer = nextActivePlayer(state.currentPlayer);
    }
  }

  if (changed) {
    render();
  }
  return changed;
}

window.GuandanApp = {
  startLocalGame: startNewGame,
  startOnlineRoundFromSetup,
  startNextOnlineRound,
  restartOnlineMatch,
  importOnlineSnapshot,
  exportOnlineSnapshot,
  processOnlineAction,
  resolveOnlineAiTurns,
  renderNow: render,
  showToast,
};

const debugApi = {
  createCard(rank, suit = "spades", options = {}) {
    const suitMeta = SUITS.find((item) => item.key === suit) || SUITS[0];
    const rankMeta = RANKS.find((item) => item.value === rank);
    const isJoker = rank >= 16 || suit === "joker";
    return {
      id: options.id || `${options.copy || 0}-${suit}-${rank}-${options.index || 0}`,
      rank,
      rankLabel: rankMeta ? rankMeta.label : (rank === 16 ? "SJ" : rank === 17 ? "BJ" : String(rank)),
      suit: isJoker ? "joker" : suitMeta.key,
      suitSymbol: isJoker ? "J" : suitMeta.symbol,
      color: isJoker ? (rank === 17 ? "red" : "black") : suitMeta.color,
      isJoker,
    };
  },
  analyzeComboForLevel(cards, levelRank) {
    const previousLevelRank = state.levelRank;
    state.levelRank = levelRank;
    const combo = analyzeCombo(cards.map((card) => ({ ...card })));
    state.levelRank = previousLevelRank;
    return combo;
  },
  canBeatForLevel({ nextCards, currentCards, levelRank }) {
    const previousLevelRank = state.levelRank;
    state.levelRank = levelRank;
    const nextCombo = analyzeCombo((nextCards || []).map((card) => ({ ...card })));
    const currentCombo = currentCards ? analyzeCombo(currentCards.map((card) => ({ ...card }))) : null;
    const result = canBeat(nextCombo, currentCombo);
    state.levelRank = previousLevelRank;
    return {
      result,
      nextCombo,
      currentCombo,
    };
  },
  getMatchProgressAfterRound,
  buildTributePlanForTest(roundResult) {
    return buildTributePlan(JSON.parse(JSON.stringify(roundResult)));
  },
  finalizeRoundResultForTest({ players, finishedOrder, levelRank = 3, matchScores = {} }) {
    state.players = players.map((player) => ({
      ...player,
      hand: (player.hand || []).map((card) => ({ ...card })),
    }));
    state.finishedOrder = [...finishedOrder];
    state.levelRank = levelRank;
    state.matchScores = { ...matchScores };
    state.roundResult = null;
    state.pendingRoundSetup = null;
    finalizeRoundResult();
    return {
      roundResult: JSON.parse(JSON.stringify(state.roundResult)),
      pendingRoundSetup: state.pendingRoundSetup ? JSON.parse(JSON.stringify(state.pendingRoundSetup)) : null,
      matchScores: { ...state.matchScores },
    };
  },
  applyTributeForTest({ players, levelRank = 3, plan }) {
    state.players = players.map((player) => ({
      ...player,
      hand: (player.hand || []).map((card) => ({ ...card })),
    }));
    state.levelRank = levelRank;
    state.logs = [];
    state.currentTributeInfo = null;
    applyTribute(plan);
    return {
      players: state.players.map((player) => ({
        ...player,
        hand: player.hand.map((card) => ({ ...card })),
      })),
      currentTributeInfo: state.currentTributeInfo ? JSON.parse(JSON.stringify(state.currentTributeInfo)) : null,
      logs: [...state.logs],
    };
  },
  roundTripOnlineSnapshotForTest({
    players,
    currentPlayer = 0,
    levelRank = 3,
    latestTrickToken = 0,
    roundNumber = 1,
    pendingTribute = null,
    currentTributeInfo = null,
    pendingRoundSetup = null,
    matchScores = {},
    roundResult = null,
    currentCombo = null,
    lastPlayPlayer = null,
    consecutivePasses = 0,
    logs = [],
    finishedOrder = [],
    winnerTeam = null,
    trickHistory = [],
    playHistory = [],
    passHistory = [],
    localPlayerOwnerId = null,
  }) {
    state.onlineMode = true;
    state.localPlayerOwnerId = localPlayerOwnerId || null;
    state.lastOnlineSnapshotSignature = "";
    state.players = players.map((player) => ({
      ...player,
      hand: (player.hand || []).map((card) => ({ ...card })),
    }));
    state.currentPlayer = currentPlayer;
    state.levelRank = levelRank;
    state.latestTrickToken = latestTrickToken;
    state.roundNumber = roundNumber;
    state.pendingTribute = pendingTribute ? JSON.parse(JSON.stringify(pendingTribute)) : null;
    state.currentTributeInfo = currentTributeInfo ? JSON.parse(JSON.stringify(currentTributeInfo)) : null;
    state.pendingRoundSetup = pendingRoundSetup ? JSON.parse(JSON.stringify(pendingRoundSetup)) : null;
    state.matchScores = { ...matchScores };
    state.roundResult = roundResult ? JSON.parse(JSON.stringify(roundResult)) : null;
    state.currentCombo = currentCombo
      ? {
          ...currentCombo,
          cards: currentCombo.cards.map((card) => ({ ...card })),
        }
      : null;
    state.lastPlayPlayer = lastPlayPlayer;
    state.consecutivePasses = consecutivePasses;
    state.logs = [...logs];
    state.finishedOrder = [...finishedOrder];
    state.winnerTeam = winnerTeam;
    state.trickHistory = trickHistory.map((item) => ({
      ...item,
      combo: item.combo ? { ...item.combo, cards: item.combo.cards.map((card) => ({ ...card })) } : null,
    }));
    state.playHistory = playHistory.map((item) => ({ ...item, ranks: [...(item.ranks || [])] }));
    state.passHistory = passHistory.map((item) => ({ ...item }));
    const snapshot = exportOnlineSnapshot();
    state.lastOnlineSnapshotSignature = "";
    importOnlineSnapshot(snapshot, localPlayerOwnerId);
    return {
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      restored: {
        players: state.players.map((player) => ({
          ...player,
          hand: player.hand.map((card) => ({ ...card })),
        })),
        pendingTribute: state.pendingTribute ? JSON.parse(JSON.stringify(state.pendingTribute)) : null,
        currentTributeInfo: state.currentTributeInfo ? JSON.parse(JSON.stringify(state.currentTributeInfo)) : null,
        pendingRoundSetup: state.pendingRoundSetup ? JSON.parse(JSON.stringify(state.pendingRoundSetup)) : null,
        roundResult: state.roundResult ? JSON.parse(JSON.stringify(state.roundResult)) : null,
        playHistory: state.playHistory.map((item) => ({ ...item, ranks: [...(item.ranks || [])] })),
        passHistory: state.passHistory.map((item) => ({ ...item })),
        currentPlayer: state.currentPlayer,
        levelRank: state.levelRank,
        roundNumber: state.roundNumber,
        localSeatId: state.localSeatId,
      },
    };
  },
  buildEndgamePlanForTest(cards) {
    const plan = buildEndgamePlan(cards.map((card) => ({ ...card })));
    return {
      ...plan,
      sequence: plan.sequence.map((combo) => ({
        ...combo,
        cards: combo.cards.map((card) => ({ ...card })),
      })),
    };
  },
  chooseTributeCardForTest({ hand, levelRank = 3 }) {
    state.levelRank = levelRank;
    return chooseTributeCard({
      hand: hand.map((card) => ({ ...card })),
    });
  },
  chooseReturnCardForTest({ hand, levelRank = 3 }) {
    state.levelRank = levelRank;
    return chooseReturnCard({
      hand: hand.map((card) => ({ ...card })),
    });
  },
  allPossibleCombosForTest({ hand, levelRank = 3 }) {
    state.levelRank = levelRank;
    return allPossibleCombos(hand.map((card) => ({ ...card }))).map((combo) => ({
      ...combo,
      cards: combo.cards.map((card) => ({ ...card })),
    }));
  },
  chooseRecommendedMoveForTest({
    players,
    currentPlayer,
    currentCombo = null,
    lastPlayPlayer = null,
    levelRank = 3,
    onlineMode = false,
    playHistory = [],
    passHistory = [],
  }) {
    state.players = players.map((player) => ({
      ...player,
      hand: (player.hand || []).map((card) => ({ ...card })),
    }));
    state.currentPlayer = currentPlayer;
    state.currentCombo = currentCombo
      ? {
          ...currentCombo,
          cards: currentCombo.cards.map((card) => ({ ...card })),
        }
      : null;
    state.lastPlayPlayer = lastPlayPlayer;
    state.levelRank = levelRank;
    state.onlineMode = onlineMode;
    state.playHistory = playHistory.map((item) => ({ ...item, ranks: [...(item.ranks || [])] }));
    state.passHistory = passHistory.map((item) => ({ ...item }));
    const player = state.players[currentPlayer];
    const combo = chooseRecommendedMove(player);
    return combo
      ? {
          ...combo,
          cards: combo.cards.map((card) => ({ ...card })),
        }
      : null;
  },
};

if (typeof window !== "undefined") {
  window.GuandanDebug = debugApi;
}
if (typeof globalThis !== "undefined") {
  globalThis.GuandanDebug = debugApi;
}

function isOnlineActionLocked() {
  return Boolean(state.onlineMode && window.GuandanOnlineBridge?.isActionLocked?.());
}

function getSelectedCards() {
  const localPlayer = getLocalSeatPlayer();
  return localPlayer.hand.filter((card) => state.selectedIds.has(card.id));
}

function maybeRunAiTurn() {
  if (state.onlineMode || state.winnerTeam !== null) {
    return;
  }

  const player = state.players[state.currentPlayer];
  if (!player || !player.controlledByAi || player.finished) {
    return;
  }

  if (state.aiTimer) {
    return;
  }

  clearTimeout(state.aiTimer);
  state.aiTimer = setTimeout(() => {
    state.aiTimer = null;
    const combo = chooseAiMove(player);
    if (combo) {
      applyPlay(player, combo);
    } else {
      applyPass(player);
    }

    if (endIfNeeded()) {
      render();
      return;
    }

    advanceTurn();
  }, 700);
}

function handleHumanPlay() {
  const player = getLocalSeatPlayer();
  if (!player || state.currentPlayer !== player.id || player.finished || state.winnerTeam !== null || isOnlineActionLocked()) {
    return;
  }

  const combo = analyzeCombo(getSelectedCards());
  if (!combo) {
    log("你选择的牌型不合法。");
    showErrorToast("牌型非法，请选择能组成合法牌型的牌。");
    render();
    return;
  }

  if (!canBeat(combo, state.currentCombo)) {
    log("这手牌压不过当前牌桌。");
    showErrorToast(`手牌不够大。${describeBeatRequirement(state.currentCombo)}`);
    render();
    return;
  }

  if (state.onlineMode && window.GuandanOnlineBridge?.sendAction) {
    window.GuandanOnlineBridge.sendAction({
      type: "play",
      cardIds: combo.cards.map((card) => card.id),
    });
    state.selectedIds.clear();
    render();
    return;
  }

  applyPlay(player, combo);
  state.selectedIds.clear();

  if (endIfNeeded()) {
    render();
    return;
  }

  advanceTurn();
}

function handleHumanPass() {
  const player = getLocalSeatPlayer();
  if (!player || state.currentPlayer !== player.id || player.finished || state.winnerTeam !== null || isOnlineActionLocked()) {
    return;
  }

  if (!state.currentCombo) {
    log("新一轮由你先手，不能选择不要。");
    render();
    return;
  }

  if (state.onlineMode && window.GuandanOnlineBridge?.sendAction) {
    window.GuandanOnlineBridge.sendAction({ type: "pass" });
    return;
  }

  applyPass(player);
  advanceTurn();
}

function applySuggestedSelection() {
  const player = getLocalSeatPlayer();
  if (!player || state.currentPlayer !== player.id || player.finished || state.winnerTeam !== null || isOnlineActionLocked()) {
    return;
  }

  const combo = chooseRecommendedMove(player);
  if (!combo) {
    showErrorToast("当前没有合适建议。");
    return;
  }

  state.selectedIds = new Set(combo.cards.map((card) => card.id));
  render();
}

function applyMinimumBeatSelection() {
  const player = getLocalSeatPlayer();
  if (!player || state.currentPlayer !== player.id || player.finished || state.winnerTeam !== null || isOnlineActionLocked()) {
    return;
  }

  const context = getHumanPlayableContext();
  const combo = chooseSmallestPlayableCombo(context);
  if (!combo) {
    showErrorToast(state.currentCombo ? "当前没有可压住的组合。" : "当前没有合适的先手组合。");
    return;
  }

  state.selectedIds = new Set(combo.cards.map((card) => card.id));
  render();
}

function renderSeat(player) {
  const panel = els.panels[getDisplaySeatId(player.id)];
  panel.innerHTML = "";
  panel.classList.toggle("seat-active-turn", state.currentPlayer === player.id && !state.winnerTeam);
  const actionLocked = isOnlineActionLocked();
  const humanPlayableContext = player.isHuman ? getHumanPlayableContext() : null;

  const header = document.createElement("div");
  header.className = "player-header";
  header.innerHTML = `
    <div>
      <strong>${player.name}</strong>
      <div class="player-role">${player.role} · ${getLocalPerspectiveTeam(player.team)}</div>
    </div>
    <div>${player.finished ? `<span class="player-finished">第 ${player.rank} 名</span>` : `剩余 ${player.hand.length} 张`}</div>
  `;
  panel.appendChild(header);

  const trickHint = document.createElement("div");
  trickHint.className = "player-role";
  if (state.lastPlayPlayer === player.id && state.currentCombo) {
    trickHint.textContent = `当前最大：${TYPE_LABELS[state.currentCombo.type]}`;
  } else if (state.currentPlayer === player.id && !state.winnerTeam) {
    trickHint.textContent = "当前行动中";
  } else {
    trickHint.textContent = "等待中";
  }
  panel.appendChild(trickHint);

  if (player.isHuman) {
    const hand = document.createElement("div");
    hand.className = "hand";

    for (const card of player.hand) {
      const button = document.createElement("button");
      button.type = "button";
      const canUseCard = humanPlayableContext?.playableIds.has(card.id);
      const blockedCard = humanPlayableContext?.blockedIds.has(card.id);
      button.className = `card ${card.color} ${state.selectedIds.has(card.id) ? "selected" : ""} ${canUseCard ? "candidate" : ""} ${blockedCard ? "dimmed" : ""}`;
      button.innerHTML = `
        <span class="card-rank">${card.rankLabel}</span>
        <span class="card-suit">${card.isJoker ? card.rankLabel : card.suitSymbol}</span>
      `;
      button.disabled = state.currentPlayer !== player.id || state.winnerTeam !== null || actionLocked;
      button.addEventListener("click", () => {
        if (state.selectedIds.has(card.id)) {
          state.selectedIds.delete(card.id);
        } else {
          state.selectedIds.add(card.id);
        }
        render();
      });
      hand.appendChild(button);
    }

    const actions = document.createElement("div");
    actions.className = "human-actions";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.id = "play-btn";
    playBtn.textContent = "出牌";
    playBtn.disabled = state.currentPlayer !== player.id || state.winnerTeam !== null || actionLocked;
    playBtn.addEventListener("click", handleHumanPlay);

    const passBtn = document.createElement("button");
    passBtn.type = "button";
    passBtn.id = "pass-btn";
    passBtn.textContent = "不要";
    passBtn.disabled = state.currentPlayer !== player.id || state.winnerTeam !== null || !state.currentCombo || actionLocked;
    passBtn.addEventListener("click", handleHumanPass);

    const suggestBtn = document.createElement("button");
    suggestBtn.type = "button";
    suggestBtn.id = "suggest-btn";
    suggestBtn.textContent = "AI建议";
    suggestBtn.disabled = state.currentPlayer !== player.id || state.winnerTeam !== null || actionLocked;
    suggestBtn.addEventListener("click", applySuggestedSelection);

    const minimumBtn = document.createElement("button");
    minimumBtn.type = "button";
    minimumBtn.id = "minimum-beat-btn";
    minimumBtn.textContent = "最小可压";
    minimumBtn.disabled = state.currentPlayer !== player.id || state.winnerTeam !== null || actionLocked || humanPlayableContext.beatingCombos.length === 0;
    minimumBtn.addEventListener("click", applyMinimumBeatSelection);

    actions.appendChild(playBtn);
    actions.appendChild(passBtn);
    actions.appendChild(suggestBtn);
    actions.appendChild(minimumBtn);

    panel.appendChild(actions);
    panel.appendChild(hand);
  } else {
    const mini = document.createElement("div");
    mini.className = "mini-hand";
    const showCount = Math.min(player.hand.length, 10);
    for (let i = 0; i < showCount; i += 1) {
      const back = document.createElement("div");
      back.className = "card-back mini-card";
      back.textContent = "GD";
      mini.appendChild(back);
    }
    if (player.hand.length > showCount) {
      const more = document.createElement("div");
      more.className = "mini-placeholder";
      more.textContent = `+${player.hand.length - showCount}`;
      mini.appendChild(more);
    }
    panel.appendChild(mini);
  }
}

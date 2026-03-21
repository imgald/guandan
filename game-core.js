(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }
  root.GuandanGameCore = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function cloneCard(card) {
    return { ...card };
  }

  function cloneCombo(combo) {
    if (!combo) {
      return combo;
    }
    return {
      ...combo,
      cards: (combo.cards || []).map(cloneCard),
    };
  }

  function cloneTrickHistory(trickHistory) {
    return (trickHistory || []).map((item) => ({
      ...item,
      combo: cloneCombo(item.combo),
    }));
  }

  function clonePlayHistory(playHistory) {
    return (playHistory || []).map((item) => ({
      ...item,
      ranks: [...(item.ranks || [])],
    }));
  }

  function clonePassHistory(passHistory) {
    return (passHistory || []).map((item) => ({ ...item }));
  }

  function buildOnlineSnapshot(state) {
    return {
      players: state.players.map((player) => ({
        id: player.id,
        name: player.name,
        role: player.role,
        team: player.team,
        ownerId: player.ownerId || null,
        controlledByAi: Boolean(player.controlledByAi),
        hand: player.hand.map(cloneCard),
        finished: Boolean(player.finished),
        rank: player.rank,
      })),
      currentPlayer: state.currentPlayer,
      levelRank: state.levelRank,
      latestTrickToken: state.latestTrickToken,
      roundNumber: state.roundNumber,
      pendingTribute: state.pendingTribute,
      currentTributeInfo: state.currentTributeInfo,
      pendingRoundSetup: state.pendingRoundSetup,
      matchScores: { ...state.matchScores },
      roundResult: state.roundResult,
      currentCombo: cloneCombo(state.currentCombo),
      lastPlayPlayer: state.lastPlayPlayer,
      consecutivePasses: state.consecutivePasses,
      logs: [...state.logs],
      finishedOrder: [...state.finishedOrder],
      winnerTeam: state.winnerTeam,
      trickHistory: cloneTrickHistory(state.trickHistory),
      playHistory: clonePlayHistory(state.playHistory),
      passHistory: clonePassHistory(state.passHistory),
    };
  }

  function buildOnlineSnapshotSignature(snapshot, localPlayerOwnerId) {
    return JSON.stringify({
      localPlayerOwnerId: localPlayerOwnerId || null,
      snapshot,
    });
  }

  function importOnlineSnapshot(state, snapshot, localPlayerOwnerId) {
    const previousSelectedIds = new Set(state.selectedIds || []);
    state.onlineMode = true;
    state.localPlayerOwnerId = localPlayerOwnerId || null;
    state.players = snapshot.players.map((player) => ({
      ...player,
      isHuman: player.ownerId === localPlayerOwnerId,
      hand: player.hand.map(cloneCard),
    }));
    const localSeatIndex = state.players.findIndex((player) => player.ownerId === localPlayerOwnerId);
    state.localSeatId = localSeatIndex >= 0 ? localSeatIndex : -1;
    const localPlayer = state.players[state.localSeatId];
    const availableIds = new Set((localPlayer?.hand || []).map((card) => card.id));
    state.selectedIds = new Set([...previousSelectedIds].filter((id) => availableIds.has(id)));
    state.currentPlayer = snapshot.currentPlayer;
    state.levelRank = snapshot.levelRank;
    state.latestTrickToken = snapshot.latestTrickToken;
    state.roundNumber = snapshot.roundNumber;
    state.pendingTribute = snapshot.pendingTribute;
    state.currentTributeInfo = snapshot.currentTributeInfo;
    state.pendingRoundSetup = snapshot.pendingRoundSetup;
    state.matchScores = { ...snapshot.matchScores };
    state.roundResult = snapshot.roundResult;
    state.currentCombo = cloneCombo(snapshot.currentCombo);
    state.lastPlayPlayer = snapshot.lastPlayPlayer;
    state.consecutivePasses = snapshot.consecutivePasses;
    state.logs = [...snapshot.logs];
    state.finishedOrder = [...snapshot.finishedOrder];
    state.winnerTeam = snapshot.winnerTeam;
    state.trickHistory = cloneTrickHistory(snapshot.trickHistory);
    state.playHistory = clonePlayHistory(snapshot.playHistory);
    state.passHistory = clonePassHistory(snapshot.passHistory);
  }

  function createPlayersFromSetup(gameSetup, localPlayerOwnerId) {
    return gameSetup.seats
      .slice()
      .sort((a, b) => a.seatId - b.seatId)
      .map((seat) => ({
        id: seat.seatId,
        name: seat.name,
        role: `Seat ${seat.seatId + 1}`,
        team: seat.team,
        ownerId: seat.playerId || null,
        controlledByAi: !seat.isHuman,
        isHuman: seat.playerId === localPlayerOwnerId,
        hand: [],
        finished: false,
        rank: null,
      }));
  }

  function dealHands(players, deps) {
    const deck = deps.shuffle(deps.buildDeck());
    for (let i = 0; i < deck.length; i += 1) {
      players[i % 4].hand.push(deck[i]);
    }
    for (const player of players) {
      player.hand = deps.sortCards(player.hand);
    }
  }

  function initializeRoundStateFields(state) {
    state.roundResult = null;
    state.pendingTribute = null;
    state.currentTributeInfo = null;
    state.pendingRoundSetup = null;
    state.levelRank = 3;
    state.roundNumber = 1;
    state.currentCombo = null;
    state.lastPlayPlayer = null;
    state.consecutivePasses = 0;
    state.logs = [];
    state.finishedOrder = [];
    state.winnerTeam = null;
    state.trickHistory = [];
    state.playHistory = [];
    state.passHistory = [];
    state.latestTrickToken = 0;
    state.selectedIds = new Set();
    state.matchScores = {};
  }

  function startOnlineRoundFromSetup(state, gameSetup, localPlayerOwnerId, deps) {
    state.onlineMode = true;
    state.localPlayerOwnerId = localPlayerOwnerId || null;
    initializeRoundStateFields(state);
    state.players = createPlayersFromSetup(gameSetup, localPlayerOwnerId);
    state.localSeatId = Math.max(0, state.players.findIndex((player) => player.ownerId === localPlayerOwnerId));
    for (const player of state.players) {
      state.matchScores[player.id] = 0;
    }

    dealHands(state.players, deps);
    state.currentPlayer = Math.floor(Math.random() * 4);
    deps.log(`${state.players[state.currentPlayer].name} 先手开始第 ${state.roundNumber} 局。`);
    deps.log(`本局主牌：${deps.getLevelLabel(state.levelRank)}`);
  }

  function restartOnlineMatch(state, deps) {
    if (!state.onlineMode) {
      return false;
    }
    const gameSetup = {
      seats: state.players
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((player) => ({
          seatId: player.id,
          name: player.name,
          team: player.team,
          teamLabel: player.team === 0 ? "你方" : "对方",
          playerId: player.ownerId || null,
          isHuman: Boolean(player.ownerId),
        })),
    };
    deps.initializeScores();
    startOnlineRoundFromSetup(state, gameSetup, state.localPlayerOwnerId, deps);
    return true;
  }

  function startNextOnlineRound(state, deps) {
    if (!state.onlineMode) {
      return false;
    }
    if (state.roundResult?.matchEnded) {
      return restartOnlineMatch(state, deps);
    }

    const nextSetup = state.pendingRoundSetup;
    state.roundResult = null;
    state.levelRank = nextSetup ? nextSetup.levelRank : state.levelRank;
    state.roundNumber = nextSetup ? nextSetup.roundNumber : state.roundNumber + 1;
    state.pendingTribute = nextSetup ? nextSetup.tributePlan : null;
    state.currentCombo = null;
    state.lastPlayPlayer = null;
    state.consecutivePasses = 0;
    state.logs = [];
    state.finishedOrder = [];
    state.winnerTeam = null;
    state.trickHistory = [];
    state.playHistory = [];
    state.passHistory = [];
    state.latestTrickToken = 0;
    state.currentTributeInfo = null;
    state.selectedIds = new Set();
    state.pendingRoundSetup = null;

    for (const player of state.players) {
      player.hand = [];
      player.finished = false;
      player.rank = null;
    }

    dealHands(state.players, deps);
    deps.applyTribute(state.pendingTribute);
    state.pendingTribute = null;
    state.currentPlayer = nextSetup ? nextSetup.startingPlayerId : Math.floor(Math.random() * 4);
    deps.log(`${state.players[state.currentPlayer].name} 先手开始第 ${state.roundNumber} 局。`);
    deps.log(`本局主牌：${deps.getLevelLabel(state.levelRank)}`);
    return true;
  }

  return {
    buildOnlineSnapshot,
    buildOnlineSnapshotSignature,
    importOnlineSnapshot,
    startOnlineRoundFromSetup,
    startNextOnlineRound,
    restartOnlineMatch,
  };
}));

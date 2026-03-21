(function () {
  const apiBase = "/api";
  const recentRoomsKey = "guandan-online-recent-rooms";
  const activeRoomKey = "guandan-online-active-room";
  const activeRoomStatusKey = "guandan-online-active-room-status";
  const playerIdKey = "guandan-online-player-id";
  const playerNameKey = "guandan-online-player-name";

  const els = {
    homeShell: document.getElementById("home-shell"),
    localTable: document.getElementById("local-table"),
    onlineShell: document.getElementById("online-shell"),
    backHomeBtn: document.getElementById("back-home-btn"),
    restartMatchBtn: document.getElementById("restart-match-btn"),
    exitOnlineGameBtn: document.getElementById("exit-online-game-btn"),
    infoToggleBtn: document.getElementById("info-toggle-btn"),
    newGameBtn: document.getElementById("new-game-btn"),
    sortBtn: document.getElementById("sort-btn"),
    enterLocalBtn: document.getElementById("enter-local-btn"),
    enterOnlineBtn: document.getElementById("enter-online-btn"),
    onlineNameInput: document.getElementById("online-name-input"),
    createRoomBtn: document.getElementById("create-room-btn"),
    joinRoomInput: document.getElementById("join-room-input"),
    joinRoomBtn: document.getElementById("join-room-btn"),
    roomStatusText: document.getElementById("room-status-text"),
    roomCodePill: document.getElementById("room-code-pill"),
    copyRoomCodeBtn: document.getElementById("copy-room-code-btn"),
    roomLobbyOptions: document.getElementById("room-lobby-options"),
    startPolicySelect: document.getElementById("start-policy-select"),
    startPolicyHint: document.getElementById("start-policy-hint"),
    readyRoomBtn: document.getElementById("ready-room-btn"),
    roomPlayerList: document.getElementById("room-player-list"),
    roomSpectatorList: document.getElementById("room-spectator-list"),
    roomSetupBox: document.getElementById("room-setup-box"),
    startRoomBtn: document.getElementById("start-room-btn"),
    leaveRoomBtn: document.getElementById("leave-room-btn"),
    chatSection: document.getElementById("online-chat-section"),
    chatToggleBtn: document.getElementById("chat-toggle-btn"),
    chatUnreadBadge: document.getElementById("chat-unread-badge"),
    chatLog: document.getElementById("chat-log"),
    chatInput: document.getElementById("chat-input"),
    mentionHostBtn: document.getElementById("mention-host-btn"),
    sendChatBtn: document.getElementById("send-chat-btn"),
    recentRoomList: document.getElementById("recent-room-list"),
    clearRecentRoomsBtn: document.getElementById("clear-recent-rooms-btn"),
  };

  const state = {
    view: "home",
    roomId: localStorage.getItem(activeRoomKey) || null,
    playerId: localStorage.getItem(playerIdKey) || null,
    playerName: localStorage.getItem(playerNameKey) || "",
    room: null,
    pollTimer: null,
    heartbeatTimer: null,
    recentRooms: loadRecentRooms(),
    syncingGame: false,
    lastRoomRenderSignature: "",
    actionPending: false,
    pendingRequestType: "",
    nextClientActionId: 1,
    lastSystemEventId: "",
    chatMinimized: false,
    unreadChatCount: 0,
    lastSeenChatCreatedAt: 0,
    chatFlashTimer: null,
  };

  const STRINGS = {
    noRoomYet: "\u8fd8\u6ca1\u6709\u8fdb\u5165\u623f\u95f4",
    noRecentRooms: "\u8fd8\u6ca1\u6709\u6700\u8fd1\u623f\u95f4\u8bb0\u5f55",
    quickJoinHint: "\u70b9\u51fb\u5373\u53ef\u5feb\u901f\u586b\u5165\u5e76\u52a0\u5165",
    quickJoin: "\u5feb\u901f\u52a0\u5165",
    host: "\u623f\u4e3b",
    member: "\u724c\u5c40\u73a9\u5bb6",
    spectator: "\u89c2\u6218\u8005",
    online: "\u5728\u7ebf",
    offline: "\u79bb\u7ebf",
    ready: "\u5df2\u51c6\u5907",
    notReady: "\u672a\u51c6\u5907",
    unknown: "\u672a\u77e5",
    roomCode: "\u623f\u95f4\u7801",
    startPolicyQuick: "\u5f53\u524d\u7b56\u7565\uff1a2 \u540d\u771f\u4eba\u5373\u53ef\u5f00\u59cb\uff0c2 \u4eba\u623f\u4f1a\u81ea\u52a8\u8865 AI \u642d\u6863\u3002",
    startPolicyWait: "\u5f53\u524d\u7b56\u7565\uff1a\u9700\u8981\u6ee1 4 \u540d\u771f\u4eba\u73a9\u5bb6\u540e\u624d\u80fd\u5f00\u59cb\u3002",
    restoreStartDenied: "\u8bf7\u7b49\u5f85\u623f\u4e3b\u5f00\u59cb\u4e0b\u4e00\u5c40",
    emptyChat: "\u8fdb\u5165\u724c\u5c40\u540e\u5373\u53ef\u968f\u65f6\u804a\u5929\u3002",
    emptyPlayers: "\u6682\u65e0\u724c\u5c40\u73a9\u5bb6",
    emptySpectators: "\u5f53\u524d\u6ca1\u6709\u89c2\u6218\u8005",
    setupTitle: "\u672c\u5c40\u5ea7\u4f4d\u4e0e\u7ec4\u961f",
    setupSummary: "\u623f\u95f4\u5df2\u5f00\u59cb\uff0c\u4e0b\u9762\u5c55\u793a\u672c\u5c40\u5ea7\u4f4d\u5206\u914d\u548c\u968f\u673a\u7ec4\u961f\u7ed3\u679c\u3002",
    startedSummary: (humanCount, spectatorCount, hostName) => `\u623f\u95f4\u5df2\u5f00\u59cb\uff0c\u5f53\u524d ${humanCount} \u540d\u724c\u5c40\u73a9\u5bb6\u3001${spectatorCount} \u540d\u89c2\u6218\u8005\uff0c\u623f\u4e3b\uff1a${hostName}` ,
    lobbySummary: (humanCount, spectatorCount, hostName) => `\u7b49\u5f85\u5f00\u59cb\uff0c\u5f53\u524d ${humanCount} \u540d\u724c\u5c40\u73a9\u5bb6\u3001${spectatorCount} \u540d\u89c2\u6218\u8005\uff0c\u623f\u4e3b\uff1a${hostName}` ,
    spectatorJoined: "\u623f\u95f4\u5df2\u6ee1\uff0c\u5df2\u4f5c\u4e3a\u89c2\u6218\u8005\u52a0\u5165\u3002",
    restoredRoom: "\u5df2\u6062\u590d\u5230\u8054\u673a\u623f\u95f4\u3002",
    restoredGame: "\u5df2\u6062\u590d\u5230\u8054\u673a\u724c\u5c40\u3002",
  };

  window.GuandanOnlineBridge = {
    isActionLocked() {
      return state.actionPending;
    },
    sendAction(action) {
      if (!state.roomId || !state.playerId || state.actionPending) {
        return Promise.resolve();
      }
      state.actionPending = true;
      state.pendingRequestType = action.type || "action";
      window.GuandanApp?.renderNow?.();
      return api(`/rooms/${state.roomId}/actions`, {
        method: "POST",
        body: {
          playerId: state.playerId,
          clientActionId: `${state.playerId}-${state.nextClientActionId++}`,
          ...action,
        },
      })
        .then(() => refreshRoom())
        .finally(() => {
          state.actionPending = false;
          state.pendingRequestType = "";
          window.GuandanApp?.renderNow?.();
        });
    },
    async requestNextRound() {
      if (!state.room || state.room.hostId !== state.playerId || !window.GuandanApp || state.actionPending) {
        if (!state.actionPending) {
          notify(STRINGS.restoreStartDenied);
        }
        return;
      }
      state.actionPending = true;
      state.pendingRequestType = "next-round";
      window.GuandanApp?.renderNow?.();
      const snapshot = window.GuandanApp.startNextOnlineRound();
      if (!snapshot) {
        state.actionPending = false;
        state.pendingRequestType = "";
        window.GuandanApp?.renderNow?.();
        return;
      }
      try {
        await api(`/rooms/${state.roomId}/next-round`, {
          method: "POST",
          body: {
            playerId: state.playerId,
            gameState: snapshot,
          },
        });
        state.room.gameState = snapshot;
        await refreshRoom();
      } finally {
        state.actionPending = false;
        state.pendingRequestType = "";
        window.GuandanApp?.renderNow?.();
      }
    },
    async requestRestartMatch() {
      if (!state.room || state.room.hostId !== state.playerId || !window.GuandanApp?.restartOnlineMatch || state.actionPending) {
        if (!state.actionPending) {
          notify("\u53ea\u6709\u623f\u4e3b\u53ef\u4ee5\u91cd\u65b0\u5f00\u59cb\u8054\u673a\u724c\u5c40\u3002");
        }
        return;
      }
      state.actionPending = true;
      state.pendingRequestType = "restart-match";
      window.GuandanApp?.renderNow?.();
      const snapshot = window.GuandanApp.restartOnlineMatch();
      if (!snapshot) {
        state.actionPending = false;
        state.pendingRequestType = "";
        window.GuandanApp?.renderNow?.();
        return;
      }
      try {
        await api(`/rooms/${state.roomId}/next-round`, {
          method: "POST",
          body: {
            playerId: state.playerId,
            gameState: snapshot,
            restartMatch: true,
          },
        });
        state.room.gameState = snapshot;
        await refreshRoom();
      } finally {
        state.actionPending = false;
        state.pendingRequestType = "";
        window.GuandanApp?.renderNow?.();
      }
      notify("\u623f\u4e3b\u5df2\u91cd\u65b0\u5f00\u59cb\u6574\u573a\u724c\u5c40\u3002");
    },
  };

  if (state.playerName) {
    els.onlineNameInput.value = state.playerName;
  }

  function loadRecentRooms() {
    try {
      const parsed = JSON.parse(localStorage.getItem(recentRoomsKey) || "[]");
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {
      return [];
    }
  }

  function saveRecentRooms() {
    localStorage.setItem(recentRoomsKey, JSON.stringify(state.recentRooms.slice(0, 5)));
  }

  function rememberRoom(roomId) {
    if (!roomId) {
      return;
    }
    state.recentRooms = [roomId, ...state.recentRooms.filter((item) => item !== roomId)].slice(0, 5);
    saveRecentRooms();
    localStorage.setItem(activeRoomKey, roomId);
    renderRecentRooms();
  }

  function rememberRoomStatus(status) {
    if (!status) {
      return;
    }
    localStorage.setItem(activeRoomStatusKey, status);
  }

  function clearRecentRooms() {
    state.recentRooms = [];
    saveRecentRooms();
    renderRecentRooms();
  }

  function clearActiveRoom() {
    localStorage.removeItem(activeRoomKey);
    localStorage.removeItem(activeRoomStatusKey);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function notify(message) {
    if (window.GuandanApp?.showToast) {
      window.GuandanApp.showToast(message);
      return;
    }
    window.alert(message);
  }

  function formatChatTime(createdAt) {
    if (!createdAt) {
      return "--:--";
    }
    return new Date(createdAt).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getLatestChatTimestamp(room = state.room) {
    const timeline = [
      ...((room?.chat || []).map((message) => message.createdAt || 0)),
      ...((room?.systemEvents || []).map((event) => event.createdAt || 0)),
    ];
    return timeline.length ? Math.max(...timeline) : 0;
  }

  function processSystemEvents(room, { silentInitial = false } = {}) {
    const events = room?.systemEvents || [];
    if (events.length === 0) {
      return;
    }
    const lastSeenIndex = state.lastSystemEventId
      ? events.findIndex((event) => event.id === state.lastSystemEventId)
      : -1;
    const unseen = lastSeenIndex >= 0
      ? events.slice(lastSeenIndex + 1)
      : (silentInitial ? [] : events.slice(-1));
    if (unseen.length > 0) {
      for (const event of unseen) {
        if (event.type === "host-changed" && room?.hostId === state.playerId) {
          notify("\u4f60\u5df2\u6210\u4e3a\u65b0\u7684\u623f\u4e3b\u3002");
        } else {
          notify(event.text);
        }
      }
    }
    state.lastSystemEventId = events[events.length - 1].id;
  }

  function markChatAsRead(room = state.room) {
    state.lastSeenChatCreatedAt = getLatestChatTimestamp(room);
    state.unreadChatCount = 0;
  }

  function updateChatChrome(room = state.room) {
    const visibleInGame = Boolean(room && room.status === "started");
    const showChat = visibleInGame && state.view === "online-game";
    els.chatSection.classList.toggle("hidden", !showChat);
    els.chatSection.classList.toggle("chat-minimized", Boolean(showChat && state.chatMinimized));
    if (els.chatToggleBtn) {
      els.chatToggleBtn.textContent = state.chatMinimized ? "\u5c55\u5f00" : "\u6700\u5c0f\u5316";
    }
    if (els.chatUnreadBadge) {
      els.chatUnreadBadge.textContent = String(state.unreadChatCount);
      els.chatUnreadBadge.classList.toggle("hidden", state.unreadChatCount <= 0);
    }
    if (els.mentionHostBtn) {
      els.mentionHostBtn.disabled = !showChat || !room;
    }
  }

  function flashChatWindow() {
    if (!els.chatSection || !state.chatMinimized) {
      return;
    }
    els.chatSection.classList.remove("chat-flash");
    void els.chatSection.offsetWidth;
    els.chatSection.classList.add("chat-flash");
    if (state.chatFlashTimer) {
      window.clearTimeout(state.chatFlashTimer);
    }
    state.chatFlashTimer = window.setTimeout(() => {
      els.chatSection.classList.remove("chat-flash");
      state.chatFlashTimer = null;
    }, 900);
  }

  async function copyRoomCodeWithToast() {
    if (!state.room?.id) {
      return;
    }
    const code = state.room.id;
    try {
      await navigator.clipboard.writeText(code);
      notify(`房间码已复制：${code}`);
    } catch {
      notify(`复制失败，请手动复制房间码：${code}`);
    }
  }

  function mentionHost() {
    if (!state.room || !els.chatInput) {
      return;
    }
    const hostName = state.room.players.find((player) => player.id === state.room.hostId)?.name || "\u623f\u4e3b";
    const prefix = els.chatInput.value && !els.chatInput.value.endsWith(" ") ? " " : "";
    els.chatInput.value = `${els.chatInput.value || ""}${prefix}@\u623f\u4e3b(${hostName}) `;
    els.chatInput.focus();
  }

  function buildRoomRenderSignature(room) {
    return JSON.stringify({
      roomId: state.roomId,
      playerId: state.playerId,
      view: state.view,
      joined: Boolean(room && state.roomId),
      room: room ? {
        id: room.id,
        status: room.status,
        hostId: room.hostId,
        startPolicy: room.startPolicy || "quick-2",
        players: room.players.map((player) => ({
          id: player.id,
          name: player.name,
          role: player.role,
          ready: Boolean(player.ready),
          status: player.status,
        })),
        spectators: (room.spectators || []).map((spectator) => ({
          id: spectator.id,
          name: spectator.name,
          status: spectator.status,
        })),
        chat: room.chat.map((message) => ({
          senderName: message.senderName,
          text: message.text,
          createdAt: message.createdAt,
        })),
        systemEvents: (room.systemEvents || []).map((event) => ({
          id: event.id,
          text: event.text,
          createdAt: event.createdAt,
        })),
        gameSetup: room.gameSetup ? {
          seats: room.gameSetup.seats.map((seat) => ({
            seatId: seat.seatId,
            name: seat.name,
            teamLabel: seat.teamLabel,
            isHuman: seat.isHuman,
          })),
          teamGroups: (room.gameSetup.teamGroups || []).map((group) => ({
            label: group.label,
            members: group.members.map((member) => member.name),
          })),
          mode: room.gameSetup.mode,
        } : null,
      } : null,
    });
  }

  function setView(view) {
    state.view = view;
    const isHome = view === "home";
    const isLocal = view === "local";
    const isOnline = view === "online";
    const isOnlineGame = view === "online-game";
    const showsTable = isLocal || isOnlineGame;

    els.homeShell.classList.toggle("hidden", !isHome);
    els.localTable.classList.toggle("hidden", !showsTable);
    els.onlineShell.classList.toggle("hidden", !isOnline);

    els.backHomeBtn.classList.toggle("hidden", isHome || isOnlineGame);
    els.exitOnlineGameBtn.classList.toggle("hidden", !isOnlineGame);
    els.restartMatchBtn.classList.toggle("hidden", !isOnlineGame);
    els.infoToggleBtn.classList.toggle("hidden", !showsTable);
    els.newGameBtn.classList.toggle("hidden", !isLocal);
    els.sortBtn.classList.toggle("hidden", !showsTable);
    updateChatChrome();
  }

  function resetRoomStateToHome(message = "") {
    stopPolling();
    state.roomId = null;
    state.room = null;
    state.actionPending = false;
    state.pendingRequestType = "";
    state.chatMinimized = false;
    state.unreadChatCount = 0;
    state.lastSeenChatCreatedAt = 0;
    state.lastSystemEventId = "";
    state.lastRoomRenderSignature = "";
    clearActiveRoom();
    renderRoom();
    setView("home");
    if (message) {
      notify(message);
    }
  }

  function normalizeNameForAction(mode) {
    const value = (els.onlineNameInput.value || "").trim();
    const fallbackName = mode === "create" ? "\u8001\u8c7a\u72d7" : "\u8c7a\u72d7\u59b9";
    const name = value || fallbackName;
    els.onlineNameInput.value = name;
    state.playerName = name;
    localStorage.setItem(playerNameKey, name);
    return name;
  }

  async function api(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "\u8bf7\u6c42\u5931\u8d25");
    }
    return payload;
  }

  function persistPlayerId(playerId) {
    state.playerId = playerId;
    localStorage.setItem(playerIdKey, playerId);
  }

  function startPolling() {
    stopPolling();
    state.pollTimer = window.setInterval(() => {
      if (state.roomId) {
        refreshRoom().catch(() => {});
      }
    }, 1200);
    state.heartbeatTimer = window.setInterval(() => {
      if (state.roomId && state.playerId) {
        api(`/rooms/${state.roomId}/heartbeat`, {
          method: "POST",
          body: { playerId: state.playerId },
        }).catch(() => {});
      }
    }, 2500);
  }

  function stopPolling() {
    if (state.pollTimer) {
      window.clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    if (state.heartbeatTimer) {
      window.clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }

  async function createRoom() {
    const name = normalizeNameForAction("create");
    const result = await api("/rooms", {
      method: "POST",
      body: {
        playerId: state.playerId,
        name,
      },
    });
    persistPlayerId(result.playerId);
    state.roomId = result.room.id;
    state.room = result.room;
    rememberRoom(result.room.id);
    rememberRoomStatus(result.room.status);
    setView("online");
    renderRoom();
    startPolling();
  }

  async function joinRoom(roomCode) {
    const normalizedRoomCode = (roomCode || els.joinRoomInput.value || "").trim().toUpperCase();
    if (!normalizedRoomCode) {
      notify("\u8bf7\u8f93\u5165\u623f\u95f4\u7801");
      return;
    }
    const name = normalizeNameForAction("join");
    const result = await api(`/rooms/${normalizedRoomCode}/join`, {
      method: "POST",
      body: {
        playerId: state.playerId,
        name,
      },
    });
    persistPlayerId(result.playerId);
    state.roomId = result.room.id;
    state.room = result.room;
    rememberRoom(result.room.id);
    rememberRoomStatus(result.room.status);
    els.joinRoomInput.value = result.room.id;
    if ((result.room.spectators || []).some((spectator) => spectator.id === result.playerId)) {
      notify(STRINGS.spectatorJoined);
    }
    setView("online");
    renderRoom();
    startPolling();
  }

  async function tryRestoreActiveRoom() {
    if (!state.roomId || !state.playerId) {
      return;
    }
    try {
      const result = await api(`/rooms/${state.roomId}?playerId=${encodeURIComponent(state.playerId)}`);
      const stillMember = result.room.players.some((player) => player.id === state.playerId)
        || (result.room.spectators || []).some((spectator) => spectator.id === state.playerId);
      if (!stillMember) {
        clearActiveRoom();
        state.roomId = null;
        state.room = null;
        return;
      }
      state.room = result.room;
      rememberRoomStatus(result.room.status);
      processSystemEvents(result.room, { silentInitial: true });
      if (result.room.status === "closed") {
        resetRoomStateToHome(result.room.closedNotice || "\u5f53\u524d\u724c\u5c40\u5df2\u7ed3\u675f\u3002");
        return;
      }
      setView(result.room.status === "started" ? "online-game" : "online");
      notify(result.room.status === "started" ? STRINGS.restoredGame : STRINGS.restoredRoom);
      startPolling();
      await maybeSyncOnlineGame();
      renderRoom();
    } catch (error) {
      if (state.room?.status === "started") {
        setView("online-game");
        try {
          renderRoom();
        } catch {}
        console.error("online restore warning:", error);
        return;
      }
      clearActiveRoom();
      state.roomId = null;
      state.room = null;
    }
  }

  async function refreshRoom() {
    if (!state.roomId) {
      return;
    }
    const result = await api(`/rooms/${state.roomId}?playerId=${encodeURIComponent(state.playerId || "")}`);
    state.room = result.room;
    rememberRoomStatus(result.room.status);
    processSystemEvents(result.room);
    if (result.room.status === "closed") {
      resetRoomStateToHome(result.room.closedNotice || "\u5f53\u524d\u724c\u5c40\u5df2\u7ed3\u675f\u3002");
      return;
    }
    await maybeSyncOnlineGame();
    renderRoom();
  }

  async function startRoom() {
    if (!state.roomId || !state.playerId) {
      return;
    }
    const result = await api(`/rooms/${state.roomId}/start`, {
      method: "POST",
      body: {
        playerId: state.playerId,
        startPolicy: els.startPolicySelect.value,
      },
    });
    state.room = result.room;
    rememberRoomStatus(result.room.status);
    processSystemEvents(result.room);
    renderRoom();
    await maybeSyncOnlineGame();
  }

  async function updateLobbyConfig() {
    if (!state.roomId || !state.playerId || !state.room) {
      return;
    }
    if (state.room.hostId !== state.playerId || state.room.status !== "lobby") {
      return;
    }
    const result = await api(`/rooms/${state.roomId}/lobby-config`, {
      method: "POST",
      body: {
        playerId: state.playerId,
        startPolicy: els.startPolicySelect.value,
      },
    });
    state.room = result.room;
    rememberRoomStatus(result.room.status);
    processSystemEvents(result.room);
    renderRoom();
  }

  async function toggleReady() {
    if (!state.roomId || !state.playerId || !state.room) {
      return;
    }
    const me = state.room.players.find((player) => player.id === state.playerId);
    if (!me || state.room.status !== "lobby") {
      return;
    }
    const result = await api(`/rooms/${state.roomId}/ready`, {
      method: "POST",
      body: {
        playerId: state.playerId,
        ready: !me.ready,
      },
    });
    state.room = result.room;
    rememberRoomStatus(result.room.status);
    processSystemEvents(result.room);
    renderRoom();
  }

  async function kickMember(targetId) {
    if (!state.roomId || !state.playerId || !targetId) {
      return;
    }
    const result = await api(`/rooms/${state.roomId}/kick`, {
      method: "POST",
      body: {
        playerId: state.playerId,
        targetId,
      },
    });
    state.room = result.room;
    rememberRoomStatus(result.room.status);
    processSystemEvents(result.room);
    renderRoom();
  }

  async function leaveRoom() {
    if (!state.roomId || !state.playerId) {
      return;
    }
    await api(`/rooms/${state.roomId}/leave`, {
      method: "POST",
      body: {
        playerId: state.playerId,
      },
    });
    stopPolling();
    state.roomId = null;
    state.room = null;
    state.actionPending = false;
    state.pendingRequestType = "";
    state.lastSystemEventId = "";
    state.lastRoomRenderSignature = "";
    clearActiveRoom();
    renderRoom();
    setView("home");
  }

  async function uploadGameState(gameState) {
    if (!state.roomId || !state.playerId) {
      return;
    }
    await api(`/rooms/${state.roomId}/game-state`, {
      method: "POST",
      body: {
        playerId: state.playerId,
        gameState,
      },
    });
  }

  async function pullActions() {
    if (!state.roomId || !state.playerId) {
      return [];
    }
    const result = await api(`/rooms/${state.roomId}/actions-pull`, {
      method: "POST",
      body: {
        playerId: state.playerId,
      },
    });
    return result.actions || [];
  }

  async function maybeSyncOnlineGame() {
    if (state.syncingGame || !state.room || state.room.status !== "started" || !window.GuandanApp) {
      return;
    }
    state.syncingGame = true;
    try {
      const room = state.room;
      const isHost = room.hostId === state.playerId;

      if (!room.gameState && isHost) {
        const initialState = window.GuandanApp.startOnlineRoundFromSetup(room.gameSetup, state.playerId);
        await uploadGameState(initialState);
        state.room.gameState = initialState;
      }

      if (state.room.gameState) {
        window.GuandanApp.importOnlineSnapshot(state.room.gameState, state.playerId);
        setView("online-game");
      }

      if (isHost && state.room.gameState) {
        const actions = await pullActions();
        let changed = false;
        for (const action of actions) {
          if (window.GuandanApp.processOnlineAction(action)) {
            changed = true;
          }
        }
        if (window.GuandanApp.resolveOnlineAiTurns()) {
          changed = true;
        }
        if (changed) {
          const snapshot = window.GuandanApp.exportOnlineSnapshot();
          await uploadGameState(snapshot);
          state.room.gameState = snapshot;
          window.GuandanApp.importOnlineSnapshot(snapshot, state.playerId);
        }
      }
    } finally {
      state.syncingGame = false;
    }
  }

  async function sendChat() {
    const text = (els.chatInput.value || "").trim();
    if (!text || !state.roomId || !state.playerId) {
      return;
    }
    await api(`/rooms/${state.roomId}/chat`, {
      method: "POST",
      body: {
        playerId: state.playerId,
        text,
      },
    });
    els.chatInput.value = "";
    if (!state.chatMinimized) {
      markChatAsRead();
    }
    await refreshRoom();
  }

  function renderRecentRooms() {
    els.recentRoomList.innerHTML = "";
    if (state.recentRooms.length === 0) {
      const empty = document.createElement("div");
      empty.className = "muted-text";
      empty.textContent = STRINGS.noRecentRooms;
      els.recentRoomList.appendChild(empty);
      return;
    }

    for (const roomId of state.recentRooms) {
      const row = document.createElement("div");
      row.className = "recent-room-item";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(roomId)}</strong>
          <span>${STRINGS.quickJoinHint}</span>
        </div>
      `;
      const actionBtn = document.createElement("button");
      actionBtn.type = "button";
      actionBtn.textContent = STRINGS.quickJoin;
      actionBtn.addEventListener("click", () => {
        els.joinRoomInput.value = roomId;
        joinRoom(roomId).catch((error) => notify(error.message));
      });
      row.appendChild(actionBtn);
      els.recentRoomList.appendChild(row);
    }
  }

  function renderPlayers(room) {
    els.roomPlayerList.innerHTML = "";
    els.roomSpectatorList.innerHTML = "";
    if (!room) {
      return;
    }
    if (!room.players.length) {
      const emptyPlayers = document.createElement("div");
      emptyPlayers.className = "muted-text";
      emptyPlayers.textContent = STRINGS.emptyPlayers;
      els.roomPlayerList.appendChild(emptyPlayers);
    }
    const isHost = room.hostId === state.playerId;
    for (const player of room.players) {
      const item = document.createElement("div");
      item.className = "room-player-item";
      const isMe = player.id === state.playerId;
      const roleLabel = player.id === room.hostId ? STRINGS.host : STRINGS.member;
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(player.name)}${isMe ? "（你）" : ""}</strong>
          <div class="muted-text">${roleLabel} · ${player.ready ? STRINGS.ready : STRINGS.notReady}</div>
        </div>
        <div class="room-member-side">
          <div class="muted-text">${player.status === "online" ? STRINGS.online : STRINGS.offline}</div>
        </div>
      `;
      if (isHost && !isMe) {
        const kickBtn = document.createElement("button");
        kickBtn.type = "button";
        kickBtn.className = "inline-danger-btn";
        kickBtn.textContent = "移出";
        kickBtn.disabled = state.actionPending || state.syncingGame || room.status === "started";
        kickBtn.addEventListener("click", () => {
          kickMember(player.id).catch((error) => notify(error.message));
        });
        const memberSide = item.querySelector?.(".room-member-side") || item;
        memberSide.appendChild(kickBtn);
      }
      els.roomPlayerList.appendChild(item);
    }
    const spectators = room.spectators || [];
    if (!spectators.length) {
      const emptySpectators = document.createElement("div");
      emptySpectators.className = "muted-text";
      emptySpectators.textContent = STRINGS.emptySpectators;
      els.roomSpectatorList.appendChild(emptySpectators);
      return;
    }
    for (const spectator of spectators) {
      const item = document.createElement("div");
      item.className = "room-player-item spectator-item";
      const isMe = spectator.id === state.playerId;
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(spectator.name)}${isMe ? "（你）" : ""}</strong>
          <div class="muted-text">${STRINGS.spectator}</div>
        </div>
        <div class="room-member-side">
          <div class="muted-text">${spectator.status === "online" ? STRINGS.online : STRINGS.offline}</div>
        </div>
      `;
      if (isHost && !isMe) {
        const kickBtn = document.createElement("button");
        kickBtn.type = "button";
        kickBtn.className = "inline-danger-btn";
        kickBtn.textContent = "移出";
        kickBtn.disabled = state.actionPending || state.syncingGame;
        kickBtn.addEventListener("click", () => {
          kickMember(spectator.id).catch((error) => notify(error.message));
        });
        const memberSide = item.querySelector?.(".room-member-side") || item;
        memberSide.appendChild(kickBtn);
      }
      els.roomSpectatorList.appendChild(item);
    }
  }

  function renderSetup(room) {
    if (!room || room.status !== "started" || !room.gameSetup) {
      els.roomSetupBox.classList.add("hidden");
      els.roomSetupBox.innerHTML = "";
      return;
    }
    const teamGroups = (room.gameSetup.teamGroups || [])
      .map((group) => `
        <div class="team-group">
          <strong>${escapeHtml(group.label)}</strong>
          <div class="muted-text">${group.members.map((member) => escapeHtml(member.name)).join(" / ")}</div>
        </div>
      `)
      .join("");
    const seats = room.gameSetup.seats
      .map((seat) => `
        <div class="setup-row">
          <span>座位 ${seat.seatId + 1}</span>
          <span>${escapeHtml(seat.name)} · ${escapeHtml(seat.teamLabel)}</span>
        </div>
      `)
      .join("");
    els.roomSetupBox.classList.remove("hidden");
    els.roomSetupBox.innerHTML = `
      <h3>${STRINGS.setupTitle}</h3>
      <div class="muted-text">${STRINGS.setupSummary}</div>
      <div class="team-groups">${teamGroups}</div>
      <div class="setup-list">${seats}</div>
    `;
  }

  function renderChat(room) {
    els.chatLog.innerHTML = "";
    if (!room) {
      updateChatChrome(room);
      return;
    }
    const timeline = [
      ...(room.chat || []).map((message) => ({
        kind: "chat",
        id: message.id || `chat-${message.createdAt}-${message.senderId || ""}`,
        senderId: message.senderId,
        senderName: message.senderName,
        text: message.text,
        createdAt: message.createdAt || 0,
      })),
      ...(room.systemEvents || []).map((event) => ({
        kind: "system",
        id: event.id || `system-${event.createdAt || 0}`,
        text: event.text,
        createdAt: event.createdAt || 0,
      })),
    ].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    const latestMessage = timeline.length ? timeline[timeline.length - 1] : null;
    const isUnreadCandidate = latestMessage?.kind === "system" || latestMessage?.senderId !== state.playerId;
    const latestCreatedAt = latestMessage?.createdAt || 0;
    const hasUnreadIncoming = Boolean(
      latestMessage
      && latestCreatedAt > state.lastSeenChatCreatedAt
      && isUnreadCandidate
    );

    if (state.view === "online-game" && !state.chatMinimized) {
      markChatAsRead(room);
    } else if (hasUnreadIncoming) {
      state.unreadChatCount += 1;
      state.lastSeenChatCreatedAt = latestCreatedAt;
      flashChatWindow();
    }

    if (!timeline.length) {
      const empty = document.createElement("div");
      empty.className = "muted-text";
      empty.textContent = STRINGS.emptyChat;
      els.chatLog.appendChild(empty);
      updateChatChrome(room);
      return;
    }
    for (const message of timeline) {
      const row = document.createElement("div");
      const selfClass = message.kind === "chat" && message.senderId === state.playerId ? " chat-line-self" : "";
      row.className = `chat-line ${message.kind === "system" ? "chat-line-system" : ""}${selfClass}`;
      if (message.kind === "system") {
        row.innerHTML = `
          <div class="chat-line-head">
            <strong>系统消息</strong>
            <span class="chat-time">${escapeHtml(formatChatTime(message.createdAt))}</span>
          </div>
          <span>${escapeHtml(message.text)}</span>
        `;
      } else {
        row.innerHTML = `
          <div class="chat-line-head">
            <strong>${escapeHtml(message.senderName)}</strong>
            <span class="chat-time">${escapeHtml(formatChatTime(message.createdAt))}</span>
          </div>
          <span>${escapeHtml(message.text)}</span>
        `;
      }
      els.chatLog.appendChild(row);
    }
    if (!state.chatMinimized) {
      els.chatLog.scrollTop = els.chatLog.scrollHeight;
    }
    updateChatChrome(room);
  }

  function renderRoom() {
    const room = state.room;
    const joined = Boolean(room && state.roomId);
    const renderSignature = buildRoomRenderSignature(room);
    if (renderSignature === state.lastRoomRenderSignature) {
      return;
    }
    state.lastRoomRenderSignature = renderSignature;

    const interactionLocked = state.actionPending || state.syncingGame;
    const localPlayer = room?.players?.find((player) => player.id === state.playerId) || null;
    const localSpectator = room?.spectators?.find((spectator) => spectator.id === state.playerId) || null;
    const isHost = Boolean(room && room.hostId === state.playerId);
    const playerCount = room?.players?.length || 0;
    const spectatorCount = room?.spectators?.length || 0;
    const startPolicy = room?.startPolicy || "quick-2";
    const canStart = Boolean(isHost && room?.status === "lobby" && (startPolicy === "wait-4" ? playerCount >= 4 : playerCount >= 2));

    els.startRoomBtn.disabled = !joined || !canStart || interactionLocked;
    els.readyRoomBtn.disabled = !localPlayer || room?.status !== "lobby" || interactionLocked;
    els.leaveRoomBtn.disabled = !joined || interactionLocked;
    els.sendChatBtn.disabled = !joined || state.actionPending;
    if (els.mentionHostBtn) {
      els.mentionHostBtn.disabled = !joined;
    }
    els.copyRoomCodeBtn.classList.toggle("hidden", !joined);
    els.roomLobbyOptions.classList.toggle("hidden", !joined || room?.status !== "lobby");

    if (!joined) {
      els.roomStatusText.textContent = STRINGS.noRoomYet;
      els.roomCodePill.classList.add("hidden");
      els.roomCodePill.textContent = "";
      els.startPolicySelect.value = "quick-2";
      els.startPolicySelect.disabled = true;
      els.startPolicyHint.textContent = STRINGS.startPolicyQuick;
      els.readyRoomBtn.textContent = "\u51c6\u5907";
      els.roomPlayerList.innerHTML = "";
      els.roomSpectatorList.innerHTML = "";
      els.roomSetupBox.classList.add("hidden");
      els.roomSetupBox.innerHTML = "";
      els.chatLog.innerHTML = "";
      els.restartMatchBtn.classList.add("hidden");
      updateChatChrome(room);
      return;
    }

    const hostName = room.players.find((player) => player.id === room.hostId)?.name || STRINGS.unknown;
    els.startPolicySelect.value = startPolicy;
    els.startPolicySelect.disabled = !isHost || room.status !== "lobby";
    els.startPolicyHint.textContent = startPolicy === "wait-4" ? STRINGS.startPolicyWait : STRINGS.startPolicyQuick;
    els.readyRoomBtn.textContent = localPlayer?.ready ? "\u53d6\u6d88\u51c6\u5907" : (localPlayer ? "\u51c6\u5907" : "\u89c2\u6218\u4e2d");

    let statusText = room.status === "started"
      ? STRINGS.startedSummary(playerCount, spectatorCount, hostName)
      : STRINGS.lobbySummary(playerCount, spectatorCount, hostName);
    if (localSpectator) {
      statusText += " \u00b7 \u4f60\u5f53\u524d\u6b63\u5728\u89c2\u6218";
    }
    els.roomStatusText.textContent = statusText;
    els.roomCodePill.classList.remove("hidden");
    els.roomCodePill.textContent = `${STRINGS.roomCode} ${room.id}`;
    els.restartMatchBtn.classList.toggle("hidden", !(room.status === "started" && isHost && state.view === "online-game"));

    renderPlayers(room);
    renderSetup(room);
    renderChat(room);
    updateChatChrome(room);
  }


  els.enterLocalBtn.addEventListener("click", () => {
    setView("local");
    window.GuandanApp?.startLocalGame?.();
  });

  els.enterOnlineBtn.addEventListener("click", async () => {
    const persistedRoomId = localStorage.getItem(activeRoomKey);
    const persistedPlayerId = localStorage.getItem(playerIdKey);
    if (!state.roomId && persistedRoomId) {
      state.roomId = persistedRoomId;
    }
    if (!state.playerId && persistedPlayerId) {
      state.playerId = persistedPlayerId;
    }
    if (state.roomId) {
      const persistedRoomStatus = localStorage.getItem(activeRoomStatusKey);
      setView((state.room?.status || persistedRoomStatus) === "started" ? "online-game" : "online");
      try {
        await tryRestoreActiveRoom();
      } catch {}
      if (!state.roomId) {
        setView("online");
      } else {
        setView(state.room?.status === "started" ? "online-game" : "online");
      }
      return;
    }
    setView("online");
  });

  els.backHomeBtn.addEventListener("click", () => {
    stopPolling();
    setView("home");
  });
  els.exitOnlineGameBtn.addEventListener("click", () => {
    leaveRoom().catch((error) => notify(error.message));
  });
  els.restartMatchBtn.addEventListener("click", () => {
    window.GuandanOnlineBridge.requestRestartMatch().catch((error) => notify(error.message));
  });

  els.createRoomBtn.addEventListener("click", () => {
    createRoom().catch((error) => notify(error.message));
  });

  els.joinRoomBtn.addEventListener("click", () => {
    joinRoom().catch((error) => notify(error.message));
  });

  els.startRoomBtn.addEventListener("click", () => {
    startRoom().catch((error) => notify(error.message));
  });

  els.readyRoomBtn.addEventListener("click", () => {
    toggleReady().catch((error) => notify(error.message));
  });

  els.leaveRoomBtn.addEventListener("click", () => {
    leaveRoom().catch((error) => notify(error.message));
  });

  els.sendChatBtn.addEventListener("click", () => {
    sendChat().catch((error) => notify(error.message));
  });
  els.chatToggleBtn.addEventListener("click", () => {
    state.chatMinimized = !state.chatMinimized;
    if (!state.chatMinimized) {
      markChatAsRead();
      els.chatLog.scrollTop = els.chatLog.scrollHeight;
    }
    updateChatChrome();
  });
  els.mentionHostBtn.addEventListener("click", () => {
    mentionHost();
  });

  els.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendChat().catch((error) => notify(error.message));
    }
  });

  els.clearRecentRoomsBtn.addEventListener("click", () => {
    clearRecentRooms();
  });

  els.copyRoomCodeBtn.addEventListener("click", () => {
    copyRoomCodeWithToast().catch(() => {});
  });

  els.startPolicySelect.addEventListener("change", () => {
    updateLobbyConfig().catch((error) => notify(error.message));
  });

  renderRecentRooms();
  setView("home");
  renderRoom();
  tryRestoreActiveRoom();
})();


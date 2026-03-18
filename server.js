const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");

const rootDir = __dirname;
const port = Number(process.env.PORT || 8000);
const rooms = new Map();
const offlineTimeoutMs = 8000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mimeTypes[ext] || "application/octet-stream";
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "File not found" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

function randomId(length = 6) {
  return crypto.randomBytes(length).toString("hex").slice(0, length).toUpperCase();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function createPlayerId() {
  return `p_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function createRoom(name, playerId) {
  let roomId = randomId(6);
  while (rooms.has(roomId)) {
    roomId = randomId(6);
  }
  const now = Date.now();
  const room = {
    id: roomId,
    hostId: playerId,
    status: "lobby",
    startPolicy: "quick-2",
    createdAt: now,
    updatedAt: now,
    players: [
      {
        id: playerId,
        name,
        status: "online",
        joinedAt: now,
        lastSeenAt: now,
      },
    ],
    chat: [],
    gameSetup: null,
    gameState: null,
    actions: [],
    nextActionId: 1,
  };
  rooms.set(roomId, room);
  return room;
}

function getRoomOrThrow(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    const error = new Error("房间不存在");
    error.statusCode = 404;
    throw error;
  }
  return room;
}

function ensurePlayer(room, playerId) {
  const player = room.players.find((item) => item.id === playerId);
  if (!player) {
    const error = new Error("你不在这个房间里");
    error.statusCode = 403;
    throw error;
  }
  player.status = "online";
  player.lastSeenAt = Date.now();
  return player;
}

function touchPlayer(room, playerId) {
  if (!playerId) {
    return;
  }
  const player = room.players.find((item) => item.id === playerId);
  if (player) {
    player.status = "online";
    player.lastSeenAt = Date.now();
  }
}

function reassignHostIfNeeded(room) {
  const currentHost = room.players.find((item) => item.id === room.hostId);
  if (currentHost && currentHost.status === "online") {
    return;
  }
  const nextHost = room.players.find((item) => item.status === "online") || room.players[0];
  if (nextHost) {
    room.hostId = nextHost.id;
  }
}

function refreshPresence(room) {
  const now = Date.now();
  for (const player of room.players) {
    if (player.lastSeenAt && now - player.lastSeenAt > offlineTimeoutMs) {
      player.status = "offline";
    }
  }
  reassignHostIfNeeded(room);
}

function snapshotRoom(room) {
  return {
    id: room.id,
    hostId: room.hostId,
    status: room.status,
    startPolicy: room.startPolicy || "quick-2",
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      status: player.status,
      joinedAt: player.joinedAt,
    })),
    chat: room.chat.slice(-40),
    gameSetup: room.gameSetup,
    gameState: room.gameState,
    updatedAt: room.updatedAt,
  };
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function assignSeats(room) {
  const humans = shuffle(room.players.map((player) => ({
    type: "human",
    id: player.id,
    name: player.name,
  })));

  let seats;
  if (humans.length === 2) {
    seats = [
      humans[0],
      humans[1],
      { type: "ai", name: `${humans[0].name}的AI搭档` },
      { type: "ai", name: `${humans[1].name}的AI搭档` },
    ];
  } else {
    seats = humans.slice(0, 4);
    while (seats.length < 4) {
      seats.push({ type: "ai", name: `AI-${seats.length + 1}` });
    }
    seats = shuffle(seats);
  }

  return seats.map((seat, seatId) => ({
    seatId,
    team: seatId % 2 === 0 ? 0 : 1,
    teamLabel: seatId % 2 === 0 ? "你方 / Team A" : "对方 / Team B",
    isHuman: seat.type === "human",
    playerId: seat.id || null,
    name: seat.name,
  }));
}

function assignSeatsWithTeams(room) {
  const seats = assignSeats(room);
  return {
    seats,
    teamGroups: [0, 1].map((team) => ({
      team,
      label: team === 0 ? "队伍 A" : "队伍 B",
      members: seats
        .filter((seat) => seat.team === team)
        .map((seat) => ({
          seatId: seat.seatId,
          name: seat.name,
          isHuman: seat.isHuman,
        })),
    })),
  };
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/rooms") {
    const body = await readBody(req);
    const playerId = body.playerId || createPlayerId();
    const name = String(body.name || "玩家").slice(0, 20);
    const room = createRoom(name, playerId);
    sendJson(res, 200, {
      playerId,
      room: snapshotRoom(room),
    });
    return;
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/([a-z-]+))?$/i);
  if (!roomMatch) {
    sendJson(res, 404, { error: "接口不存在" });
    return;
  }

  const roomId = roomMatch[1].toUpperCase();
  const action = roomMatch[2] || "";
  const room = getRoomOrThrow(roomId);
  touchPlayer(room, req.method === "GET" ? (url.parse(req.url || "/", true).query.playerId || "") : "");
  refreshPresence(room);

  if (req.method === "GET" && !action) {
    sendJson(res, 200, { room: snapshotRoom(room) });
    return;
  }

  const body = await readBody(req);

  if (req.method === "POST" && action === "join") {
    if (room.status !== "lobby") {
      sendJson(res, 400, { error: "房间已经开始，暂时不能加入" });
      return;
    }
    const playerId = body.playerId || createPlayerId();
    let player = room.players.find((item) => item.id === playerId);
    if (!player) {
      if (room.players.length >= 4) {
        sendJson(res, 400, { error: "房间已满" });
        return;
      }
      player = {
        id: playerId,
        name: String(body.name || "玩家").slice(0, 20),
        status: "online",
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      room.players.push(player);
    } else {
      player.name = String(body.name || player.name || "玩家").slice(0, 20);
      player.status = "online";
      player.lastSeenAt = Date.now();
    }
    room.updatedAt = Date.now();
    sendJson(res, 200, {
      playerId,
      room: snapshotRoom(room),
    });
    return;
  }

  if (req.method === "POST" && action === "leave") {
    const player = ensurePlayer(room, body.playerId);
    room.players = room.players.filter((item) => item.id !== player.id);
    if (room.hostId === player.id && room.players.length > 0) {
      room.hostId = room.players[0].id;
    }
    if (room.players.length === 0) {
      rooms.delete(room.id);
      sendJson(res, 200, { ok: true });
      return;
    }
    room.updatedAt = Date.now();
    sendJson(res, 200, { room: snapshotRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "start") {
    const player = ensurePlayer(room, body.playerId);
    if (player.id !== room.hostId) {
      sendJson(res, 403, { error: "只有房主可以开始" });
      return;
    }
    if (room.players.length < 2) {
      sendJson(res, 400, { error: "至少需要 2 名真人玩家" });
      return;
    }
    const startPolicy = body.startPolicy === "wait-4" ? "wait-4" : "quick-2";
    room.startPolicy = startPolicy;
    if (startPolicy === "wait-4" && room.players.length < 4) {
      sendJson(res, 400, { error: "当前策略要求满 4 名真人玩家后才能开始" });
      return;
    }
    const seatAssignment = assignSeatsWithTeams(room);
    room.status = "started";
    room.gameSetup = {
      seed: randomId(10),
      startedAt: Date.now(),
      seats: seatAssignment.seats,
      teamGroups: seatAssignment.teamGroups,
      mode: room.players.length === 2 ? "2p-plus-ai" : "mixed-teams",
      startPolicy,
    };
    room.actions = [];
    room.nextActionId = 1;
    room.gameState = null;
    room.updatedAt = Date.now();
    sendJson(res, 200, { room: snapshotRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "heartbeat") {
    const player = ensurePlayer(room, body.playerId);
    player.status = "online";
    player.lastSeenAt = Date.now();
    refreshPresence(room);
    room.updatedAt = Date.now();
    sendJson(res, 200, { room: snapshotRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "lobby-config") {
    const player = ensurePlayer(room, body.playerId);
    if (player.id !== room.hostId) {
      sendJson(res, 403, { error: "只有房主可以修改开局策略" });
      return;
    }
    if (room.status !== "lobby") {
      sendJson(res, 400, { error: "牌局已经开始，不能再修改开局策略" });
      return;
    }
    room.startPolicy = body.startPolicy === "wait-4" ? "wait-4" : "quick-2";
    room.updatedAt = Date.now();
    sendJson(res, 200, { room: snapshotRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "actions") {
    const player = ensurePlayer(room, body.playerId);
    if (room.status !== "started" || !room.gameSetup) {
      sendJson(res, 400, { error: "房间还没有开始" });
      return;
    }
    const seat = room.gameSetup.seats.find((item) => item.playerId === player.id);
    if (!seat) {
      sendJson(res, 403, { error: "你不是当前牌局玩家" });
      return;
    }
    const type = body.type === "pass" ? "pass" : "play";
    const actionItem = {
      id: room.nextActionId++,
      playerId: player.id,
      seatId: seat.seatId,
      type,
      cardIds: Array.isArray(body.cardIds) ? body.cardIds.slice(0, 40) : [],
      createdAt: Date.now(),
    };
    room.actions.push(actionItem);
    room.updatedAt = Date.now();
    sendJson(res, 200, { ok: true, action: actionItem });
    return;
  }

  if (req.method === "POST" && action === "actions-pull") {
    const player = ensurePlayer(room, body.playerId);
    if (player.id !== room.hostId) {
      sendJson(res, 403, { error: "只有房主可以拉取动作" });
      return;
    }
    const actions = room.actions.slice();
    room.actions = [];
    room.updatedAt = Date.now();
    sendJson(res, 200, { actions });
    return;
  }

  if (req.method === "POST" && action === "chat") {
    const player = ensurePlayer(room, body.playerId);
    const text = String(body.text || "").trim().slice(0, 200);
    if (!text) {
      sendJson(res, 400, { error: "聊天内容不能为空" });
      return;
    }
    room.chat.push({
      id: crypto.randomUUID(),
      senderId: player.id,
      senderName: player.name,
      text,
      createdAt: Date.now(),
    });
    room.chat = room.chat.slice(-80);
    room.updatedAt = Date.now();
    sendJson(res, 200, { room: snapshotRoom(room) });
    return;
  }

  if (req.method === "POST" && action === "game-state") {
    const player = ensurePlayer(room, body.playerId);
    if (player.id !== room.hostId) {
      sendJson(res, 403, { error: "只有房主可以同步对局状态" });
      return;
    }
    room.gameState = body.gameState || null;
    room.updatedAt = Date.now();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && action === "next-round") {
    const player = ensurePlayer(room, body.playerId);
    if (player.id !== room.hostId) {
      sendJson(res, 403, { error: "只有房主可以开始下一局" });
      return;
    }
    room.gameState = body.gameState || null;
    room.updatedAt = Date.now();
    sendJson(res, 200, { room: snapshotRoom(room) });
    return;
  }

  if (req.method === "GET" && action === "game-state") {
    sendJson(res, 200, { gameState: room.gameState || null });
    return;
  }

  sendJson(res, 404, { error: "接口不存在" });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url || "/", true);
  const pathname = parsed.pathname || "/";

  try {
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    let target = pathname === "/" ? "/index.html" : pathname;
    target = path.normalize(target).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(rootDir, target);
    if (!filePath.startsWith(rootDir)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    sendFile(res, filePath);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.message || "Server error",
    });
  }
});

server.listen(port, () => {
  console.log(`Guandan server listening on http://localhost:${port}`);
});

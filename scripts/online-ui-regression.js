const fs = require("fs");
const path = require("path");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createClassList(owner) {
  const classNames = new Set();
  return {
    add(...names) {
      for (const name of names) {
        classNames.add(name);
      }
      owner.className = [...classNames].join(" ");
    },
    remove(...names) {
      for (const name of names) {
        classNames.delete(name);
      }
      owner.className = [...classNames].join(" ");
    },
    toggle(name, force) {
      if (force === true) {
        classNames.add(name);
      } else if (force === false) {
        classNames.delete(name);
      } else if (classNames.has(name)) {
        classNames.delete(name);
      } else {
        classNames.add(name);
      }
      owner.className = [...classNames].join(" ");
      return classNames.has(name);
    },
    contains(name) {
      return classNames.has(name);
    },
  };
}

function createElementStub(id = "") {
  const listeners = new Map();
  const element = {
    id,
    innerHTML: "",
    textContent: "",
    value: "",
    disabled: false,
    className: "",
    style: {},
    children: [],
    scrollTop: 0,
    scrollHeight: 0,
    classList: null,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute() {},
    removeAttribute() {},
    insertAdjacentElement() {},
    focus() {},
    remove() {},
    addEventListener(type, handler) {
      const bucket = listeners.get(type) || [];
      bucket.push(handler);
      listeners.set(type, bucket);
    },
    dispatchEvent(event) {
      const bucket = listeners.get(event.type) || [];
      for (const handler of bucket) {
        handler(event);
      }
    },
    click() {
      this.dispatchEvent({ type: "click", preventDefault() {} });
    },
    keydown(key) {
      this.dispatchEvent({
        type: "keydown",
        key,
        preventDefault() {},
      });
    },
  };
  element.classList = createClassList(element);
  return element;
}

function createDocument() {
  const ids = new Map();
  return {
    getElementById(id) {
      if (!ids.has(id)) {
        ids.set(id, createElementStub(id));
      }
      return ids.get(id);
    },
    createElement(tag) {
      return createElementStub(tag);
    },
    querySelector() {
      return createElementStub();
    },
  };
}

function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

function okJson(payload) {
  return {
    ok: true,
    async json() {
      return payload;
    },
  };
}

function createFetchStub(room) {
  return async (url) => {
    if (String(url).includes("/api/rooms/")) {
      return okJson({ room });
    }
    return okJson({ ok: true });
  };
}

function createGameAppStub() {
  return {
    startLocalGame() {},
    startOnlineRoundFromSetup() {
      return { seed: "seed", phase: "online" };
    },
    importOnlineSnapshot(snapshot, playerId) {
      this.lastImported = { snapshot, playerId };
    },
    exportOnlineSnapshot() {
      return { seed: "seed", phase: "online-next" };
    },
    processOnlineAction() {
      return false;
    },
    resolveOnlineAiTurns() {
      return false;
    },
    startNextOnlineRound() {
      return { seed: "seed", phase: "next-round" };
    },
    renderNow() {},
    showToast() {},
  };
}

async function bootOnlineApp({ storage = {}, room = null } = {}) {
  const document = createDocument();
  const localStorage = createStorage(storage);
  const gameApp = createGameAppStub();
  const timers = new Map();
  let timerId = 1;

  const sandbox = {
    console,
    document,
    localStorage,
    navigator: {
      clipboard: {
        async writeText() {},
      },
    },
    fetch: createFetchStub(room),
    window: {
      document,
      alert() {},
      setInterval(handler) {
        const id = timerId++;
        timers.set(id, handler);
        return id;
      },
      clearInterval(id) {
        timers.delete(id);
      },
      GuandanApp: gameApp,
      GuandanOnlineBridge: null,
    },
    setTimeout,
    clearTimeout,
  };

  sandbox.globalThis = sandbox;
  sandbox.window.window = sandbox.window;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.window.localStorage = localStorage;
  sandbox.window.fetch = sandbox.fetch;

  const source = fs.readFileSync(path.join(__dirname, "..", "online.js"), "utf8");
  vm.runInNewContext(source, sandbox, { filename: "online.js" });

  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));

  return {
    document,
    gameApp,
  };
}

function isHidden(document, id) {
  return document.getElementById(id).classList.contains("hidden");
}

async function main() {
  const noRoom = await bootOnlineApp();
  assert(!isHidden(noRoom.document, "home-shell"), "boot should land on home");
  assert(isHidden(noRoom.document, "online-shell"), "online shell should be hidden at boot");
  assert(isHidden(noRoom.document, "local-table"), "table should be hidden at boot");

  noRoom.document.getElementById("enter-online-btn").click();
  assert(isHidden(noRoom.document, "home-shell"), "enter online should hide home");
  assert(!isHidden(noRoom.document, "online-shell"), "enter online should show lobby");

  noRoom.document.getElementById("back-home-btn").click();
  assert(!isHidden(noRoom.document, "home-shell"), "back home should return to home");
  assert(isHidden(noRoom.document, "online-shell"), "back home should hide lobby");

  const lobbyRoom = {
    id: "ROOM01",
    hostId: "p1",
    status: "lobby",
    startPolicy: "quick-2",
    players: [
      { id: "p1", name: "老豺狗", status: "online" },
      { id: "p2", name: "豺狗妹", status: "online" },
    ],
    chat: [],
    gameSetup: null,
  };

  const restoredLobby = await bootOnlineApp({
    storage: {
      "guandan-online-active-room": "ROOM01",
      "guandan-online-player-id": "p1",
    },
    room: lobbyRoom,
  });
  assert(!isHidden(restoredLobby.document, "online-shell"), "restore lobby should show online shell");
  assert(isHidden(restoredLobby.document, "local-table"), "restore lobby should not show table");
  assert(restoredLobby.document.getElementById("room-status-text").textContent !== "还没有进入房间", "restore lobby should replace empty room copy");
  assert(!isHidden(restoredLobby.document, "room-lobby-options"), "restore lobby should show lobby options");

  const startedRoom = {
    id: "ROOM02",
    hostId: "p1",
    status: "started",
    startPolicy: "quick-2",
    players: [
      { id: "p1", name: "老豺狗", status: "online" },
      { id: "p2", name: "豺狗妹", status: "online" },
    ],
    chat: [],
    gameSetup: {
      mode: "2p-plus-ai",
      teamGroups: [
        { label: "队伍 A", members: [{ name: "老豺狗" }, { name: "老豺狗的AI搭档" }] },
        { label: "队伍 B", members: [{ name: "豺狗妹" }, { name: "豺狗妹的AI搭档" }] },
      ],
      seats: [
        { seatId: 0, name: "老豺狗", teamLabel: "你方 / Team A", isHuman: true, playerId: "p1" },
        { seatId: 1, name: "豺狗妹", teamLabel: "对方 / Team B", isHuman: true, playerId: "p2" },
        { seatId: 2, name: "老豺狗的AI搭档", teamLabel: "你方 / Team A", isHuman: false, playerId: null },
        { seatId: 3, name: "豺狗妹的AI搭档", teamLabel: "对方 / Team B", isHuman: false, playerId: null },
      ],
    },
    gameState: { seed: "seed", phase: "online" },
  };

  const restoredStarted = await bootOnlineApp({
    storage: {
      "guandan-online-active-room": "ROOM02",
      "guandan-online-player-id": "p1",
    },
    room: startedRoom,
  });
  assert(isHidden(restoredStarted.document, "online-shell"), "restore started room should hide lobby");
  assert(!isHidden(restoredStarted.document, "local-table"), "restore started room should show table");
  assert(restoredStarted.gameApp.lastImported?.playerId === "p1", "restore started room should import snapshot");

  restoredStarted.document.getElementById("back-home-btn").click();
  assert(!isHidden(restoredStarted.document, "home-shell"), "started room back home should show home");
  assert(isHidden(restoredStarted.document, "local-table"), "started room back home should hide table");

  restoredStarted.document.getElementById("enter-online-btn").click();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert(!isHidden(restoredStarted.document, "local-table"), "re-enter online from home should restore table");
  assert(isHidden(restoredStarted.document, "online-shell"), "re-enter online from home should not show lobby for started room");

  console.log("online-ui-regression: ok");
}

main().catch((error) => {
  console.error(`online-ui-regression: failed - ${error.message}`);
  process.exitCode = 1;
});

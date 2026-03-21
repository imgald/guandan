const path = require("path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `request failed: ${pathname}`);
  }
  return payload;
}

async function withServer(run) {
  const port = 8134;
  process.env.PORT = String(port);
  const { server } = require(path.join(__dirname, "..", "server.js"));

  try {
    await new Promise((resolve, reject) => {
      server.listen(port, "127.0.0.1", (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await run(`http://127.0.0.1:${port}/api`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  await withServer(async (baseUrl) => {
    const created = await api(baseUrl, "/rooms", {
      method: "POST",
      body: {
        name: "Host",
      },
    });
    const hostPlayerId = created.playerId;
    const roomId = created.room.id;

    const joined = await api(baseUrl, `/rooms/${roomId}/join`, {
      method: "POST",
      body: {
        name: "Guest",
      },
    });
    const guestPlayerId = joined.playerId;

    await api(baseUrl, `/rooms/${roomId}/start`, {
      method: "POST",
      body: {
        playerId: hostPlayerId,
        startPolicy: "quick-2",
      },
    });

    await api(baseUrl, `/rooms/${roomId}/actions`, {
      method: "POST",
      body: {
        playerId: hostPlayerId,
        type: "pass",
        clientActionId: "dup-1",
      },
    });
    const duplicate = await api(baseUrl, `/rooms/${roomId}/actions`, {
      method: "POST",
      body: {
        playerId: hostPlayerId,
        type: "pass",
        clientActionId: "dup-1",
      },
    });
    assert(duplicate.duplicate === true, "duplicate action should be acknowledged");

    const pulled = await api(baseUrl, `/rooms/${roomId}/actions-pull`, {
      method: "POST",
      body: {
        playerId: hostPlayerId,
      },
    });
    assert(pulled.actions.length === 1, "duplicate actions should only enqueue once");

    await api(baseUrl, `/rooms/${roomId}/heartbeat`, {
      method: "POST",
      body: {
        playerId: guestPlayerId,
      },
    });
    await wait(8200);
    await api(baseUrl, `/rooms/${roomId}/heartbeat`, {
      method: "POST",
      body: {
        playerId: guestPlayerId,
      },
    });
    const afterHostDrop = await api(baseUrl, `/rooms/${roomId}?playerId=${encodeURIComponent(guestPlayerId)}`);
    assert(afterHostDrop.room.hostId === guestPlayerId, "host should transfer to the remaining online player");
    assert(afterHostDrop.room.systemEvents.some((event) => event.type === "host-changed"), "host change should produce a system event");

    await api(baseUrl, `/rooms/${roomId}/next-round`, {
      method: "POST",
      body: {
        playerId: guestPlayerId,
        gameState: { phase: "restart" },
        restartMatch: true,
      },
    });
    const afterRestart = await api(baseUrl, `/rooms/${roomId}?playerId=${encodeURIComponent(guestPlayerId)}`);
    assert(afterRestart.room.systemEvents.some((event) => event.type === "next-round"), "restart should emit a next-round system event");

    await api(baseUrl, `/rooms/${roomId}/leave`, {
      method: "POST",
      body: {
        playerId: guestPlayerId,
      },
    });
    const afterClose = await api(baseUrl, `/rooms/${roomId}?playerId=${encodeURIComponent(hostPlayerId)}`);
    assert(afterClose.room.status === "started", "match should continue when the current host exits during a started game");
    assert(afterClose.room.hostId === hostPlayerId, "host should transfer back to the remaining online player");
    assert(afterClose.room.systemEvents.some((event) => event.type === "host-left"), "host exit should emit a host-left system event");
  });

  console.log("online-stability-regression: ok");
}

main().catch((error) => {
  console.error(`online-stability-regression: failed - ${error.message}`);
  process.exitCode = 1;
});

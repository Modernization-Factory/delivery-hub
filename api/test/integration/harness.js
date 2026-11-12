/**
 * Integration-test harness: the real Express app (src/app.js) on an ephemeral port, backed
 * by a real MongoDB.
 *
 * - TEST_MONGODB_URI set (CI: the Drone `mongo` service) → that server is used.
 * - Otherwise a throwaway mongod is started with mongodb-memory-server (first run downloads
 *   the binary, ~100 MB, cached after that).
 *
 * Each test file gets its own database (node --test runs files in separate processes), so
 * files never see each other's data. Identity uses AUTH_MODE=proxy-headers with a plain
 * email in x-forwarded-email — the same path local development uses.
 */
const crypto = require("crypto");
const { MongoClient } = require("mongodb");

const INTEGRATION_TOKEN = "it-token-" + crypto.randomUUID();

let memServer = null;
let server = null;
let baseUrl = null;
let db = null; // the app's db module
let raw = null; // a separate client for seeding / asserting on stored documents

async function start() {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    memServer = await MongoMemoryServer.create();
    uri = memServer.getUri();
  }
  // config.js reads the environment once, at require time — set it before loading the app
  Object.assign(process.env, {
    MONGODB_URI: uri,
    DB_NAME: "dh_it_" + process.pid + "_" + crypto.randomBytes(3).toString("hex"),
    AUTH_MODE: "proxy-headers",
    IDENTITY_HEADER: "x-forwarded-email",
    INTEGRATION_TOKENS: INTEGRATION_TOKEN,
    STATIC_DIR: "/nonexistent", // API-only: keep the SPA fallback out of the way
  });
  const quietLog = console.log;
  console.log = () => {}; // app.js logs which mode it serves in; not useful in test output
  const app = require("../../src/app");
  console.log = quietLog;
  db = require("../../src/db");
  await db.connect();
  raw = new MongoClient(uri);
  await raw.connect();
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = "http://127.0.0.1:" + server.address().port;
}

async function stop() {
  if (raw) {
    await raw.db(process.env.DB_NAME).dropDatabase().catch(() => {});
    await raw.close();
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (db) await db.close();
  if (memServer) await memServer.stop();
}

/** Direct handle on the test database, for seeding and for checking what was stored. */
const store = () => raw.db(process.env.DB_NAME);

/**
 * Call the API. `as` is the caller's email (null for an anonymous request).
 * Returns { status, body } with the body parsed as JSON when it is JSON.
 */
async function api(as, method, path, body, headers = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(as ? { "x-forwarded-email": as } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body: parsed };
}

// ---- fixtures ----
const USERS = {
  admin: "admin@example.com",
  pm: "pm@example.com",
  dev: "dev@example.com",
  dev2: "dev2@example.com",
  inactive: "gone@example.com",
  ended: "ended@example.com",
};
const LEAVE_TYPES = [
  { name: "Vacation", value: 1 },
  { name: "Sick", value: 1 },
  { name: "Half Day", value: 0.5 },
  { name: "Comp-Off", value: 1, compOff: true },
];

/** Wipe the database and load a small, known org. Returns the inserted employees by key. */
async function seed() {
  const s = store();
  for (const c of await s.listCollections().toArray()) await s.collection(c.name).deleteMany({});
  const base = { company: "MDB", streamLead: false, viewer: false, isAdmin: false, teamManager: false, managerId: null, custom: {}, startDate: new Date("2020-01-01T00:00:00Z"), endDate: null };
  const people = {
    admin: { ...base, name: "Ada Admin", email: USERS.admin, role: "Project Manager", isAdmin: true },
    pm: { ...base, name: "Pat PM", email: USERS.pm, role: "Project Manager" },
    dev: { ...base, name: "Dev One", email: USERS.dev, role: "Developer" },
    dev2: { ...base, name: "Dev Two", email: USERS.dev2, role: "Developer" },
    inactive: { ...base, name: "Gone Person", email: USERS.inactive, role: "Developer", inactive: true },
    ended: { ...base, name: "Ended Person", email: USERS.ended, role: "Developer", endDate: new Date("2021-01-01T00:00:00Z") },
  };
  const out = {};
  for (const [k, doc] of Object.entries(people)) {
    const r = await s.collection("employees").insertOne(doc);
    out[k] = { ...doc, _id: r.insertedId, id: String(r.insertedId) };
  }
  await s.collection("settings").insertOne({ _id: "global", leaveTypes: LEAVE_TYPES, weekendDays: [0, 6], holidays: [] });
  return out;
}

/** ISO date of the Monday `weeksAhead` weeks from now (always a future working week). */
function futureMonday(weeksAhead = 4) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7) + 7 * (weeksAhead - 1));
  return d.toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = { start, stop, seed, api, store, USERS, INTEGRATION_TOKEN, futureMonday, addDays };

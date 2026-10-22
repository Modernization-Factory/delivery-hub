/** Mongo connection singleton + collection handles + readiness check. */
const { MongoClient, ObjectId } = require("mongodb");
const cfg = require("./config");

let client, db;

async function connect() {
  if (db) return db;
  client = new MongoClient(cfg.MONGODB_URI, { maxPoolSize: 20 });
  try {
    await client.connect();
  } catch (err) {
    await client.close().catch(() => {});
    client = null;
    throw err;
  }
  db = client.db(cfg.DB_NAME);
  return db;
}

function col(name) {
  if (!db) throw new Error("DB not connected yet");
  return db.collection(name);
}

async function ready() {
  if (!db) return false;
  try {
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

async function close() {
  if (client) await client.close();
}

module.exports = { connect, col, ready, close, ObjectId };

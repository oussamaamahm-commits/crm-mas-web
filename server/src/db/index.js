import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

// node:sqlite es síncrono: las transacciones no pueden contener await.

export function openDatabase(file = config.databasePath) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new DatabaseSync(file);
  conn.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  return conn;
}

let conn = null;
const statements = new Map();
const MAX_CACHED = 400;

export function getConnection() {
  if (!conn) conn = openDatabase();
  return conn;
}

/** Sustituye la conexión activa (tests). */
export function useConnection(next) {
  conn = next;
  statements.clear();
}

export function closeConnection() {
  if (conn) conn.close();
  conn = null;
  statements.clear();
}

function prepare(sql) {
  let stmt = statements.get(sql);
  if (!stmt) {
    stmt = getConnection().prepare(sql);
    if (statements.size >= MAX_CACHED) statements.delete(statements.keys().next().value);
    statements.set(sql, stmt);
  }
  return stmt;
}

function normalize(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === 'object' && !(value instanceof Uint8Array)) return JSON.stringify(value);
  return value;
}

const bind = (params = []) => params.map(normalize);
const plain = (row) => (row ? { ...row } : null);

export const db = {
  all: (sql, params) => prepare(sql).all(...bind(params)).map(plain),
  get: (sql, params) => plain(prepare(sql).get(...bind(params))),
  run: (sql, params) => prepare(sql).run(...bind(params)),
  value: (sql, params) => {
    const row = prepare(sql).get(...bind(params));
    return row ? Object.values(row)[0] : null;
  },
  exec: (sql) => getConnection().exec(sql),
};

let depth = 0;

/** Ejecuta fn dentro de una transacción (anidable mediante SAVEPOINT). */
export function tx(fn) {
  const c = getConnection();
  const savepoint = `sp_${depth}`;
  c.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
  depth += 1;
  try {
    const result = fn();
    if (result instanceof Promise) throw new Error('tx() no admite funciones asíncronas');
    depth -= 1;
    c.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
    return result;
  } catch (err) {
    depth -= 1;
    c.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
    throw err;
  }
}

export const nowIso = () => new Date().toISOString();

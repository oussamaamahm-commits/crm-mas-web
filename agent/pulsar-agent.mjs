#!/usr/bin/env node
// Agente de monitorización de Web Pulsar.
// Lee métricas del propio sistema (Linux /proc) y las envía por HTTPS cada WP_INTERVAL segundos.
// No abre puertos, no ejecuta órdenes remotas y no necesita dependencias. Requiere Node.js 18.15+.
//   WP_ENDPOINT=https://tu-dominio/api/agent/heartbeat
//   WP_TOKEN=wpa_<id>_<secreto>
import fs from 'node:fs';
import os from 'node:os';

const VERSION = '1.0.0';
const ENDPOINT = process.env.WP_ENDPOINT;
const TOKEN = process.env.WP_TOKEN;
let interval = Math.max(30, Number(process.env.WP_INTERVAL || 60));

if (!ENDPOINT || !TOKEN) {
  console.error('Faltan WP_ENDPOINT y/o WP_TOKEN');
  process.exit(1);
}
if (!ENDPOINT.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(ENDPOINT)) {
  console.error('WP_ENDPOINT debe usar https://');
  process.exit(1);
}

function cpuTimes() {
  const fields = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
  const idle = fields[3] + (fields[4] || 0);
  return { idle, total: fields.reduce((a, b) => a + b, 0) };
}

let previous = cpuTimes();
function cpuPct() {
  const current = cpuTimes();
  const idle = current.idle - previous.idle;
  const total = current.total - previous.total;
  previous = current;
  return total > 0 ? Math.round((1 - idle / total) * 1000) / 10 : null;
}

function memory() {
  const info = {};
  for (const line of fs.readFileSync('/proc/meminfo', 'utf8').split('\n')) {
    const [key, value] = line.split(':');
    if (value) info[key] = parseInt(value, 10) * 1024;
  }
  return { total: info.MemTotal, used: info.MemTotal - (info.MemAvailable ?? info.MemFree) };
}

function disk() {
  const s = fs.statfsSync('/');
  return { total: s.blocks * s.bsize, used: (s.blocks - s.bfree) * s.bsize };
}

function network() {
  let rx = 0;
  let tx = 0;
  for (const line of fs.readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2)) {
    const [iface, rest] = line.split(':');
    if (!rest || iface.trim() === 'lo') continue;
    const f = rest.trim().split(/\s+/).map(Number);
    rx += f[0];
    tx += f[8];
  }
  return { rx, tx };
}

async function send() {
  const mem = memory();
  const dsk = disk();
  const net = network();
  const body = {
    version: VERSION,
    hostname: os.hostname(),
    cpu_pct: cpuPct(),
    mem_total: mem.total,
    mem_used: mem.used,
    disk_total: dsk.total,
    disk_used: dsk.used,
    net_in: net.rx,
    net_out: net.tx,
    load1: Math.round(os.loadavg()[0] * 100) / 100,
    uptime_s: Math.round(os.uptime()),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, 'User-Agent': `WebPulsar-Agent/${VERSION}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 401) console.error('Token rechazado: genera uno nuevo en la ficha del servidor');
    else if (!res.ok) console.error(`Respuesta ${res.status}`);
    else {
      const data = await res.json().catch(() => ({}));
      if (data.interval_s && data.interval_s !== interval) interval = Math.max(30, data.interval_s);
    }
  } catch (err) {
    console.error(`No se pudo enviar el heartbeat: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function loop() {
  await send();
  setTimeout(loop, interval * 1000);
}

console.log(`Web Pulsar Agent ${VERSION} → ${new URL(ENDPOINT).host} cada ${interval} s`);
setTimeout(loop, 5_000);

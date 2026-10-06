'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {execFileSync} = require('child_process');

const now = () => new Date().toISOString();
function assert(condition, message) { if (!condition) throw new Error(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
}
function sha(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(8 * 1024 * 1024);
  try { let n; while ((n = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
function quantile(values, probability) {
  assert(values.length > 0 && values.every(Number.isFinite), 'Invalid percentile input');
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lo = Math.floor(index), hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}
function summarize(rounds) {
  const samples = rounds.flatMap(r => r.samples);
  const values = samples.map(s => s.e2eCompletionMs);
  const totalWindowMs = rounds.reduce((sum, r) => sum + r.windowElapsedMs, 0);
  assert(values.length && values.every(x => Number.isFinite(x) && x > 0) && totalWindowMs > 0, 'Invalid completion measurements');
  return {sampleCount: values.length, meanMs: values.reduce((s, x) => s + x, 0) / values.length,
    p50Ms: quantile(values, .5), p95Ms: quantile(values, .95), totalWindowMs,
    completedFramesPerSecond: values.length * 1000 / totalWindowMs};
}
function sourceHashes(root) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (['node_modules', '.git', '.venv', '__pycache__', '.DS_Store', '.vite', 'torch-home'].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && !/\.(log|pyc)$/.test(entry.name)) files.push(file);
    }
  }
  for (const directory of ['work', 'runner', 'config/data', 'config/cameras', 'validation']) walk(path.join(root, directory));
  for (const file of ['run-experiment.cjs', 'package.json', 'package-lock.json', 'config/data-lock.json', 'config/source-identities.json']) if (fs.existsSync(path.join(root, file))) files.push(path.join(root, file));
  return Object.fromEntries(files.sort().map(file => [path.relative(root, file), sha(file)]));
}
function command(exe, args) { return execFileSync(exe, args, {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024}); }
function powerSnapshot() { return {at: now(), power: command('/usr/bin/pmset', ['-g', 'batt']), memory: command('/usr/bin/vm_stat', [])}; }
function acPowerPolicy(settings) {
  const profiles = {}; let current;
  for (const line of settings.split(/\r?\n/)) {
    const header = line.trim().match(/^(.+):$/);
    if (header) { current = header[1]; profiles[current] = []; }
    else if (current) profiles[current].push(line);
  }
  // Desktop Macs may omit lowpowermode entirely; record the observed absence.
  const profile = profiles['AC Power'] || profiles['System-wide power settings'];
  assert(profile, 'No AC/system power settings available');
  const match = profile.join('\n').match(/^\s*lowpowermode[ \t]+(\d+)[ \t]*$/m);
  assert(!match || match[1] === '0', 'AC low-power mode is enabled');
  return {checkedPowerProfile: profiles['AC Power'] ? 'AC Power' : 'System-wide power settings', acLowPowerMode: match ? Number(match[1]) : null};
}
function browserIdentity(executable) {
  const frameworksRoot = path.resolve(path.dirname(executable), '../Frameworks');
  const frameworks = [];
  function walk(dir, depth) {
    if (depth > 6 || !fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file, depth + 1);
      else if (entry.isFile() && entry.name === 'Google Chrome Framework') frameworks.push({path: file, sha256: sha(file)});
    }
  }
  walk(frameworksRoot, 0);
  assert(frameworks.length > 0, 'Could not fingerprint the Google Chrome Framework');
  return {browserExecutable: executable, browserVersion: command(executable, ['--version']).trim(), browserSha256: sha(executable), browserFrameworkIdentity: frameworks.sort((a, b) => a.path.localeCompare(b.path))};
}
function inventory(executable) {
  const powerSettings = command('/usr/bin/pmset', ['-g', 'custom']);
  return {schema: 'mac-portable-host-v1', createdAt: now(), platform: process.platform, architecture: process.arch,
    nodeVersion: process.version, osVersion: command('/usr/bin/sw_vers', []),
    hardware: JSON.parse(command('/usr/sbin/system_profiler', ['SPHardwareDataType', 'SPDisplaysDataType', '-json']), (key, value) => /serial|uuid|provisioning/i.test(key) ? undefined : value),
    powerSettings, ...acPowerPolicy(powerSettings), power: powerSnapshot(), ...browserIdentity(executable)};
}
module.exports = {now, assert, readJson, writeJson, sha, quantile, summarize, sourceHashes, command, powerSnapshot, acPowerPolicy, browserIdentity, inventory};

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export const version = 1;
export const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const homeDir = () => process.env.PI_SETUP_HOME || os.homedir();
export const agentDir = () => process.env.PI_CODING_AGENT_DIR || path.join(homeDir(), '.pi/agent');
export const managed = ['settings.json', 'advisor.json', 'model-fallback/config.json', 'APPEND_SYSTEM.md', 'agents', 'prompts', 'extensions', 'skills', 'runtime/package.json', 'runtime/package-lock.json'];
export const external = { 'pi-lens-config.json': '.pi-lens/config.json' };
const fail = message => { throw new Error(message); };
export function json(file) {
  const text=fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  try { return JSON.parse(text); } catch { fail(`Invalid JSON file: ${path.basename(file)} (content redacted)`); }
}
export function writeJSON(file, value) { atomic(file, Buffer.from(JSON.stringify(value, null, 2) + '\n')); }
export function atomic(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${crypto.randomUUID()}`;
  try { fs.writeFileSync(tmp, bytes, { mode: 0o600, flag: 'wx' }); fs.renameSync(tmp, file); }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
export function safeRelative(name) {
  if (!name || name.includes('\\') || name.includes(':') || /[\x00-\x1f\x7f]/.test(name) || path.isAbsolute(name)) fail('Unsafe relative path');
  for (const part of name.split('/')) {
    if (!part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(part)) fail('Unsafe path component');
  }
  return name;
}
export function noLinks(file) {
  let current = path.resolve(file);
  for (;;) {
    try { if (fs.lstatSync(current).isSymbolicLink()) fail(`Symlink/junction refused: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
export function canonical(file) {
  const full = path.resolve(file);
  noLinks(full);
  return process.platform === 'win32' ? full.toLowerCase() : full;
}
export function disjoint(a, b) {
  const x = canonical(a), y = canonical(b);
  if (x === y || x.startsWith(y + path.sep) || y.startsWith(x + path.sep)) fail('Source and destination must not overlap');
}
export function walk(root) {
  noLinks(root);
  const files = {};
  function visit(dir, rel = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const name = rel ? `${rel}/${entry.name}` : entry.name;
      safeRelative(name);
      if (entry.isSymbolicLink()) fail('Source contains symlink/junction');
      if (entry.isDirectory()) visit(path.join(dir, entry.name), name);
      else if (entry.isFile()) files[name] = fs.readFileSync(path.join(dir, entry.name));
      else fail('Source contains unsupported file type');
    }
  }
  visit(root);
  return files;
}
export function allowed(name) { return managed.some(item => name === item || name.startsWith(item + '/')); }
export function scan(files) {
  const issues = [];
  const token = /(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
  const assigned = /["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|botToken)["']?\s*[:=]\s*["']([^"'\r\n]+)["']/gi;
  for (const [name, bytes] of Object.entries(files)) {
    if (/(^|\/)(auth\.json|\.env(?:\..*)?|.*\.pem)$/.test(name)) { issues.push(name); continue; }
    const text = bytes.toString('utf8');
    if (token.test(text) || [...text.matchAll(assigned)].some(m => !/^(?:|\$\{[A-Z_][A-Z0-9_]*\}|<[A-Z_][A-Z0-9_]*>)$/.test(m[1]))) issues.push(name);
  }
  if (issues.length) fail(`Possible secrets; export refused. Files: ${[...new Set(issues)].join(', ')} (values redacted)`);
}
export function validate(files) {
  const parse = name => {
    try { return JSON.parse(files[name].toString('utf8').replace(/^\uFEFF/, '')); }
    catch { fail(`Invalid or missing JSON: ${name}`); }
  };
  const settings = parse('settings.json');
  if (!settings || !Array.isArray(settings.packages)) fail('settings.packages must be an array');
  const packages = settings.packages.map(spec => {
    if (typeof spec !== 'string') fail('Package references must be pinned npm strings');
    const match = /^npm:((?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)@(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?)$/.exec(spec);
    if (!match) fail('Every package must have an exact npm version');
    return { name: match[1], version: match[2] };
  });
  if (new Set(packages.map(p => p.name)).size !== packages.length) fail('Duplicate package');
  if (typeof settings.defaultProvider !== 'string' || typeof settings.defaultModel !== 'string' || !settings.defaultProvider || !settings.defaultModel) fail('Select a default provider and model');
  const model = `${settings.defaultProvider}/${settings.defaultModel}`;
  if (!Array.isArray(settings.enabledModels) || !settings.enabledModels.includes(model)) fail('Default model is not enabled');
  if (files['advisor.json']) {
    const advisor = parse('advisor.json');
    if (advisor.executor !== model || !settings.enabledModels.includes(advisor.advisor)) fail('Advisor/executor model references are inconsistent');
    if (advisor.advisorRedactSecrets !== true) fail('Advisor secret redaction must stay enabled');
  }
  if (files['model-fallback/config.json']) {
    const fallback = parse('model-fallback/config.json');
    if (!Array.isArray(fallback.rules)) fail('Fallback rules must be an array');
    for (const rule of fallback.rules) {
      if (!settings.enabledModels.includes(`${rule.fallback?.provider}/${rule.fallback?.model}`)) fail('Fallback model is not enabled');
    }
  }
  return { settings, packages };
}
export function readSource(source) {
  noLinks(source);
  const all = {};
  for (const name of [...managed,...Object.keys(external),'external-configs.txt']) {
    const file=path.join(source,name); noLinks(file);
    if(!fs.existsSync(file)) continue;
    if(fs.statSync(file).isDirectory()) for(const [child,bytes] of Object.entries(walk(file))) all[`${name}/${child}`]=bytes;
    else all[name]=fs.readFileSync(file);
  }
  const files = Object.fromEntries(Object.entries(all).filter(([name]) => allowed(name) || Object.hasOwn(external, name)));
  if (all['external-configs.txt']) {
    for (const line of all['external-configs.txt'].toString('utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#'))) {
      const at = line.indexOf('=');
      const name = line.slice(0, at), dest = line.slice(at + 1);
      if (at < 0 || !Object.hasOwn(external, name) || dest !== `~/${external[name]}`) fail('External manifest destination is not allowlisted');
      if (!files[name]) fail('External manifest file is missing');
    }
  }
  validate(files);
  scan(files);
  return files;
}
export function pack(files) {
  return { format: 'pi-setup', version, files: Object.fromEntries(Object.entries(files).sort().map(([name, bytes]) => [name, { sha256: hash(bytes), base64: bytes.toString('base64') }])) };
}
export function unpack(bundle) {
  if (bundle.format !== 'pi-setup' || bundle.version !== version || !bundle.files || typeof bundle.files !== 'object') fail('Unsupported bundle; legacy tarballs must be inspected and converted separately');
  const files = {};
  for (const [name, entry] of Object.entries(bundle.files)) {
    safeRelative(name);
    if (!allowed(name) && !Object.hasOwn(external, name)) fail('Unexpected bundle file');
    if (!entry || typeof entry.base64 !== 'string' || typeof entry.sha256 !== 'string') fail('Invalid bundle entry');
    const bytes = Buffer.from(entry.base64, 'base64');
    if (hash(bytes) !== entry.sha256) fail('Bundle integrity check failed');
    files[name] = bytes;
  }
  validate(files); scan(files); return files;
}

// A journal stores the previous bytes for EVERY affected file, including absent
// files. It is written before the first mutation and retained for explicit undo.
export function transaction(changes, journalRoot, { dryRun = false } = {}) {
  noLinks(journalRoot);
  const seen = new Set();
  const entries = changes.map(({ file, bytes }) => {
    const target = path.resolve(file), key = canonical(target);
    if (seen.has(key)) fail('Duplicate transaction target');
    seen.add(key);
    disjoint(target, journalRoot);
    if (fs.existsSync(target) && !fs.statSync(target).isFile()) fail('Target is not a regular file');
    const old = fs.existsSync(target) ? fs.readFileSync(target) : null;
    return { target, old: old?.toString('base64') ?? null, after: bytes === null ? null : hash(bytes), bytes };
  });
  const changed = entries.filter(e => e.old === null ? e.bytes !== null : e.bytes === null || hash(Buffer.from(e.old, 'base64')) !== hash(e.bytes));
  if (dryRun || !changed.length) return { changed: changed.map(e => e.target), journal: null };
  fs.mkdirSync(journalRoot, { recursive: true, mode: 0o700 });
  const lock = path.join(journalRoot, 'transaction.lock');
  const fd = fs.openSync(lock, 'wx', 0o600);
  const file = path.join(journalRoot, `${Date.now()}-${crypto.randomUUID()}.json`);
  const record = { format: 'pi-setup-journal', version, status: 'pending', entries: changed.map(({bytes, ...e}) => e) };
  try {
    // Another process may have changed a file between planning and lock acquisition.
    for (const e of changed) {
      noLinks(e.target);
      const current=fs.existsSync(e.target)?fs.readFileSync(e.target).toString('base64'):null;
      if(current!==e.old) fail('Concurrent modification detected; retry with a fresh plan');
    }
    writeJSON(file, record);
    try {
      for (const e of changed) {
        noLinks(e.target);
        if (e.bytes === null) fs.unlinkSync(e.target); else atomic(e.target, e.bytes);
      }
      record.status = 'complete'; writeJSON(file, record);
    } catch (error) {
      try {
        for (const e of [...changed].reverse()) {
          noLinks(e.target);
          if (e.old !== null) atomic(e.target, Buffer.from(e.old, 'base64'));
          else if (fs.existsSync(e.target)) fs.unlinkSync(e.target);
        }
        record.status = 'reverted'; writeJSON(file, record);
      } catch { fail(`Write failed; automatic rollback incomplete. Recovery journal: ${file}`); }
      fail(`Write failed; changes reverted. Journal: ${file}`);
    }
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  return { changed: changed.map(e => e.target), journal: file };
}
export function rollback(file, journalRoot, options = {}) {
  const record = json(file);
  if (record.format !== 'pi-setup-journal' || record.version !== version || !['complete', 'pending'].includes(record.status) || !Array.isArray(record.entries)) fail('Invalid or already reverted journal');
  const changes = record.entries.map(e => {
    if (!path.isAbsolute(e.target) || (e.old !== null && typeof e.old !== 'string')) fail('Invalid journal target');
    noLinks(e.target);
    const now = fs.existsSync(e.target) ? hash(fs.readFileSync(e.target)) : null;
    const before = e.old === null ? null : hash(Buffer.from(e.old, 'base64'));
    if (now !== e.after && !(record.status === 'pending' && now === before)) fail('Rollback refused: a file changed after this transaction');
    return { file: e.target, bytes: e.old === null ? null : Buffer.from(e.old, 'base64') };
  });
  return transaction(changes, journalRoot, options);
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { agentDir, homeDir, json, writeJSON, atomic, safeRelative, noLinks, disjoint,
  walk, allowed, external, scan, validate, readSource, pack, unpack, transaction, rollback } from './lib/setup.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fail = message => { throw new Error(message); };
const flagNames = new Set(['scratch','dry-run','install','verify','live','smoke','strict','agents']);
const valueNames = new Set(['from-config','config-dir','target','bundle','output','journal','profile','provider','model','advisor','name','email','project','timeout']);
function args(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    let key = argv[i];
    if (key === '-o') key = '--output';
    if (!key.startsWith('--')) fail('Arguments must be named options');
    key = key.slice(2);
    if (key in options) fail('Duplicate option');
    if (flagNames.has(key)) options[key] = true;
    else if (valueNames.has(key) && argv[i+1] && !argv[i+1].startsWith('--')) options[key] = argv[++i];
    else fail(`Unsupported or missing option: --${key}`);
  }
  return options;
}
const manifest = () => json(path.join(root, 'template.json'));
const journals = () => path.join(homeDir(), '.pi-setup/journals');
function emit(result) { console.log(JSON.stringify(result, null, 2)); }
function run(command, argv, options = {}) {
  const result = spawnSync(command, argv, { encoding: 'utf8', timeout: 120000, ...options });
  if (result.error || result.status !== 0) fail(`Command failed or timed out: ${path.basename(command)} (exit ${result.status ?? 'unknown'}). ${result.error?.code || ''}`);
  return result.stdout;
}
function npm(argv, cwd) {
  // Avoid cmd.exe string interpolation. Standard Node installations include npm-cli.
  const candidates = [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
  const cli = candidates.find(p => fs.existsSync(p));
  if (cli) return run(process.execPath, [cli, ...argv], { cwd, timeout: 600000 });
  if (process.platform === 'win32') fail('npm-cli.js not found beside Node; use an official Node 24 installation');
  return run('npm', argv, { cwd, timeout: 600000 });
}
function runtimeCheck() {
  if (Number(process.versions.node.split('.')[0]) !== manifest().nodeMajor) fail('This template is tested with Node 24; select Node 24 first');
  if(Number(process.versions.node.split('.')[1])<18) fail('Use Node 24.18.0 or newer in the Node 24 line');
}
function load(options) {
  if (options.bundle && options['from-config']) fail('Choose exactly one source');
  return options.bundle ? unpack(json(options.bundle)) : readSource(options['from-config'] || path.join(root, 'config'));
}
function destinations(files, target, home) {
  return Object.entries(files).map(([name, bytes]) => ({ file: Object.hasOwn(external,name) ? path.join(home,external[name]) : path.join(target,safeRelative(name)), bytes }));
}
function reportDiff(changes) {
  return changes.map(c => ({file:path.resolve(c.file), action: c.bytes === null ? 'delete' : fs.existsSync(c.file) ? 'replace' : 'create'}));
}
function restore(options, prepared = null) {
  if (options.scratch && (options.install || options.verify || options.live || options.smoke)) fail('scratch cannot run install/verify: extension execution needs a real sandbox');
  const files = prepared || load(options);
  if (options.scratch && options['dry-run']) return emit({ mode:'scratch preview', files:Object.keys(files), executesExtensions:false });
  const home = options.scratch ? path.join(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'pi-setup-')), 'home') : homeDir();
  const target = options.scratch ? path.join(home,'.pi/agent') : path.resolve(options.target || agentDir());
  if (!options.bundle && !prepared) {
    const source = options['from-config'] || path.join(root,'config');
    disjoint(source,target);
    for (const c of destinations(files,target,home).filter(c=>!c.file.startsWith(target+path.sep))) disjoint(source,c.file);
  }
  const changes = destinations(files,target,home);
  // Only remove files previously managed by THIS tool, never unrelated runtime data.
  const state = path.join(target,'.pi-setup-managed.json');
  noLinks(state);
  const names = Object.keys(files).filter(n=>!Object.hasOwn(external,n));
  if (fs.existsSync(state)) {
    const prior = json(state);
    if (!Array.isArray(prior.files)) fail('Invalid managed-file index');
    for (const name of prior.files) {
      safeRelative(name); if (!allowed(name)) fail('Invalid managed-file index entry');
      const file = path.join(target,name);
      if (!names.includes(name) && fs.existsSync(file)) changes.push({file,bytes:null});
    }
  }
  changes.push({file:state,bytes:Buffer.from(JSON.stringify({version:1,files:names.sort()},null,2)+'\n')});
  const result = transaction(changes, options.scratch ? path.join(home,'.pi-setup/journals') : journals(),{dryRun:options['dry-run']});
  emit({mode:options.scratch?'scratch':'restore',target,home,...result,plan:options['dry-run']?reportDiff(changes):undefined});
  if (!options['dry-run']) {
    if (options.install) install({...options,target,deferVerify:Boolean(options.verify)});
    if (options.verify) doctor({...options,target,live:true});
  }
}
function backup(options) {
  if (options['config-dir'] && options.output) fail('Choose --config-dir or --output');
  const source = path.resolve(options.target || agentDir());
  const dest = path.resolve(options['config-dir'] || options.output || path.join(root,'pi-setup.bundle.json'));
  disjoint(source,dest);
  if ([path.parse(dest).root,path.resolve(homeDir())].includes(dest)) fail('Refuse export to home or filesystem root');
  // Read only declared setup roots; sessions/auth/cache never enter the scan or export.
  const files = {};
  for (const name of ['settings.json','advisor.json','model-fallback/config.json','APPEND_SYSTEM.md','agents','prompts','extensions','skills','runtime/package.json','runtime/package-lock.json']) {
    const file = path.join(source,name); noLinks(file);
    if (!fs.existsSync(file)) continue;
    if (fs.statSync(file).isDirectory()) for (const [child,bytes] of Object.entries(walk(file))) files[`${name}/${child}`]=bytes;
    else files[name]=fs.readFileSync(file);
  }
  for (const [name,relative] of Object.entries(external)) {
    const file=path.join(homeDir(),relative); noLinks(file);
    disjoint(file,dest);
    if(fs.existsSync(file)) files[name]=fs.readFileSync(file);
  }
  validate(files); scan(files);
  let changes;
  if (options['config-dir']) {
    changes=Object.entries(files).map(([name,bytes])=>({file:path.join(dest,name),bytes}));
    // Delete stale managed files, preserving README and unrelated files.
    if(fs.existsSync(dest)) for(const name of Object.keys(walk(dest))) if((allowed(name)||Object.hasOwn(external,name))&&!Object.hasOwn(files,name)) changes.push({file:path.join(dest,name),bytes:null});
    const ext=Object.keys(files).filter(n=>Object.hasOwn(external,n)).map(n=>`${n}=~/${external[n]}`).join('\n');
    changes.push({file:path.join(dest,'external-configs.txt'),bytes:Buffer.from(ext ? ext+'\n' : '')});
  } else changes=[{file:dest,bytes:Buffer.from(JSON.stringify(pack(files),null,2)+'\n')}];
  emit(transaction(changes,journals(),{dryRun:options['dry-run']}));
}
function configure(options, returnFiles = false) {
  const spec=manifest(), profile=options.profile || 'minimal';
  if (!Object.hasOwn(spec.profiles,profile)) fail('Unknown profile');
  const provider=options.provider, model=options.model;
  if (!provider || !model || !/^[\w.-]+$/.test(provider) || !/^[\w.-]+$/.test(model)) fail('Supply --provider and --model (IDs, not API keys)');
  const settings=json(path.join(root,'config/settings.json'));
  settings.packages=spec.packages.filter(p=>spec.profiles[profile].includes(p.name)).map(p=>`npm:${p.name}@${p.version}`);
  settings.defaultProvider=provider; settings.defaultModel=model; settings.enabledModels=[`${provider}/${model}`];
  const files={'settings.json':Buffer.from(JSON.stringify(settings,null,2)+'\n')};
  if(spec.profiles[profile].includes('pi-advisor-flow')) {
    if(!options.advisor || !/^[\w.-]+\/[\w.-]+$/.test(options.advisor)) fail('This profile needs --advisor provider/model');
    const advisor=json(path.join(root,'templates/config/advisor.json'));
    advisor.executor=`${provider}/${model}`;advisor.advisor=options.advisor;
    settings.enabledModels=[...new Set([...settings.enabledModels,options.advisor])];
    files['settings.json']=Buffer.from(JSON.stringify(settings,null,2)+'\n');
    files['advisor.json']=Buffer.from(JSON.stringify(advisor,null,2)+'\n');
  }
  if(spec.profiles[profile].includes('pi-model-fallback')) files['model-fallback/config.json']=Buffer.from(JSON.stringify({version:1,enabled:false,autoRetry:false,rules:[]},null,2)+'\n');
  if(spec.profiles[profile].includes('pi-lens')) files['pi-lens-config.json']=fs.readFileSync(path.join(root,'templates/config/pi-lens-config.json'));
  for(const name of ['package.json','package-lock.json']) files[`runtime/${name}`]=fs.readFileSync(path.join(root,'runtime',profile,name));
  validate(files);scan(files);
  if(checkLock(files)[spec.pi.name]!==spec.pi.version) fail('Profile lock is stale; regenerate it for the template Pi version');
  if(returnFiles) return files;
  const dest=path.resolve(options.output || path.join(root,'.local/config'));
  noLinks(dest);
  if(fs.existsSync(dest) && fs.readdirSync(dest).length) fail('Configure output must be empty; generate a new folder for an upgrade');
  validate(files);scan(files);
  emit(transaction(Object.entries(files).map(([name,bytes])=>({file:path.join(dest,name),bytes})),journals(),{dryRun:options['dry-run']}));
}
function checkLock(files) {
  const {packages}=validate(files);
  if(!files['runtime/package.json']||!files['runtime/package-lock.json']) fail('Missing runtime lock: generate a profile with configure first');
  const pkg=JSON.parse(files['runtime/package.json']), lock=JSON.parse(files['runtime/package-lock.json']);
  const piVersion=pkg.dependencies?.[manifest().pi.name];
  if(!/^\d+\.\d+\.\d+$/.test(piVersion||'')) fail('Pi runtime needs an exact version');
  const expected=Object.fromEntries([[manifest().pi.name,piVersion],...packages.map(p=>[p.name,p.version])]);
  const same=(a,b)=>JSON.stringify(Object.entries(a||{}).sort())===JSON.stringify(Object.entries(b||{}).sort());
  if(!same(pkg.dependencies,expected)||!same(lock.packages?.['']?.dependencies,expected)) fail('Runtime lock and settings disagree');
  for(const [name,v] of Object.entries(expected)) if(lock.packages?.[`node_modules/${name}`]?.version!==v) fail('Runtime lock version mismatch');
  return expected;
}
function install(options) {
  if(options.scratch) fail('scratch cannot install extensions');
  runtimeCheck();
  const target=path.resolve(options.target || agentDir()), files=readSource(target);
  checkLock(files);
  const npmRoot=path.join(target,'npm');noLinks(npmRoot);
  if(options['dry-run']) return emit({command:'npm ci --ignore-scripts --no-audit --no-fund',target:npmRoot});
  const changes=['package.json','package-lock.json'].map(name=>({file:path.join(npmRoot,name),bytes:files[`runtime/${name}`]}));
  const result=transaction(changes,journals());emit(result);
  npm(['ci','--ignore-scripts','--no-audit','--no-fund'],npmRoot);
  if(!options.deferVerify)doctor({...options,live:true});
}
function doctor(options) {
  runtimeCheck();
  const smokeTimeout=Number(options.timeout||60);
  if(!Number.isInteger(smokeTimeout)||smokeTimeout<1||smokeTimeout>300)fail('Doctor timeout must be 1..300 seconds');
  const target=path.resolve(options.target || agentDir());
  const files=options.live?readSource(target):load(options);
  const {packages}=validate(files);
  const result={configuration:'valid',packages:packages.length,installed:'not checked',authentication:'not checked',smoke:'not run'};
  if(options.strict||options.live) checkLock(files);
  if(options.live) {
    const expected=Object.entries(checkLock(files)).map(([name,version])=>({name,version}));
    for(const p of expected) {
      const file=path.join(target,'npm/node_modules',p.name,'package.json');noLinks(file);
      if(!fs.existsSync(file)||json(file).version!==p.version) fail(`Missing/wrong installed version: ${p.name}`);
    }
    result.installed='all pinned direct versions match';
    const auth=path.join(target,'auth.json');noLinks(auth);
    result.authentication=fs.existsSync(auth)?'auth file present; credentials not validated':'missing: run pi /login';
    if(options.smoke) {
      const cli=path.join(target,'npm/node_modules',manifest().pi.name,'dist/bundle/cli.js');
      // Startup only, no prompt/model request. This DOES execute trusted extensions.
      const probe=spawnSync(process.execPath,[cli,'--mode','rpc','--no-session'],{cwd:target,input:'{"id":"doctor","type":"get_state"}\n',encoding:'utf8',env:{...process.env,PI_CODING_AGENT_DIR:target,PI_SKIP_VERSION_CHECK:'1'},timeout:smokeTimeout*1000,maxBuffer:4*1024*1024});
      if(probe.error||probe.status!==0)fail('Pi RPC process failed or timed out');
      const output=probe.stdout;
      const events=output.split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
      if(!events.some(e=>e.id==='doctor'&&e.type==='response'&&e.success===true)||events.some(e=>e.type==='error'||e.success===false)||/failed to (?:load|import) extension|error (?:loading|importing) extension/i.test(output+probe.stderr)) fail('Pi RPC state probe or extension loading failed');
      result.startupNotifications=events.filter(e=>e.type==='extension_ui_request'&&e.method==='notify').length;
      result.smoke='RPC get_state succeeded; interactive tools/model access not tested';
    }
  } else if(options.smoke) fail('--smoke requires --live');
  emit(result);
}
function project(options) {
  if(!options.name || !options.email || /[\r\n]/.test(options.name+options.email)) fail('Supply --name and --email');
  const target=path.resolve(options.project || process.cwd()); noLinks(target);
  if(options['dry-run']) return emit({target,name:options.name,email:options.email,gitConfigScope:'local'});
  fs.mkdirSync(target,{recursive:true});
  const state=spawnSync('git',['rev-parse','--show-toplevel'],{cwd:target,encoding:'utf8'});
  noLinks(path.join(target,'.git'));
  if(state.status===0) {
    if(path.resolve(state.stdout.trim()).toLowerCase()!==target.toLowerCase()) fail('Target is inside another repository; choose its root or a separate directory');
  } else {
    if(fs.existsSync(path.join(target,'.git'))) fail('Existing Git metadata is not readable; refusing to reinitialize');
    run('git',['init','-b','main'],{cwd:target});
  }
  run('git',['config','--local','user.name',options.name],{cwd:target});
  run('git',['config','--local','user.email',options.email],{cwd:target});
  if(options.agents) {
    const file=path.join(target,'AGENTS.md');noLinks(file);
    if(!fs.existsSync(file)) atomic(file,fs.readFileSync(path.join(root,'templates/AGENTS.md')));
  }
  emit({target,identity:'configured locally',authentication:'unchanged'});
}

function help() { console.log(`Pi setup template (Node 24)
  setup --profile minimal|coding|full --provider ID --model ID [--advisor provider/model] [--scratch | --target DIR] [--dry-run]
  configure --profile minimal|coding|full --provider ID --model ID [--advisor provider/model] [--output DIR]
  restore [--from-config DIR | --bundle FILE] [--scratch | --target DIR] [--dry-run] [--install] [--verify]
  upgrade --from-config DIR [--target DIR] [--dry-run] [--install] [--verify]
  backup [--target DIR] [--config-dir DIR | --output FILE] [--dry-run]
  rollback --journal FILE [--dry-run]
  install [--target DIR] [--dry-run]
  doctor [--from-config DIR] [--strict] | --live [--target DIR] [--smoke]
  project --name NAME --email EMAIL [--project DIR] [--agents] [--dry-run]
Bundles are versioned JSON with SHA-256 per file; legacy tarballs and secret/state export are not supported.
PI_SETUP_HOME overrides the home used for FILE operations, not an execution sandbox.`); }
try {
  const [command,...rest]=process.argv.slice(2);
  if(!command||['help','--help','-h'].includes(command)) help();
  else {
    const options=args(rest);
    const accepted={
      setup:['profile','provider','model','advisor','target','scratch','dry-run'],
      configure:['profile','provider','model','advisor','output','dry-run'],
      restore:['from-config','bundle','target','scratch','dry-run','install','verify'],
      upgrade:['from-config','target','dry-run','install','verify'],
      backup:['target','config-dir','output','dry-run'],
      rollback:['journal','dry-run'],install:['target','dry-run'],
      doctor:['from-config','bundle','target','strict','live','smoke','timeout'],
      project:['name','email','project','agents','dry-run'],
    };
    for(const key of Object.keys(options)) if(!accepted[command]?.includes(key)) fail(`--${key} is not valid for ${command}`);
    const commands={configure,restore,backup,install,doctor,project,
      setup:o=>restore({...o,install:!o.scratch&&!o['dry-run'],verify:!o.scratch&&!o['dry-run']},configure(o,true)),
      upgrade:o=>{if(!o['from-config'])fail('Upgrade needs an explicit --from-config');restore(o);},
      rollback:o=>{if(!o.journal)fail('Supply --journal');emit(rollback(o.journal,journals(),{dryRun:o['dry-run']}));}};
    if(!Object.hasOwn(commands,command)) fail('Unknown command');
    commands[command](options);
  }
} catch(error) { console.error(`ERROR: ${error.message}`); process.exitCode=1; }

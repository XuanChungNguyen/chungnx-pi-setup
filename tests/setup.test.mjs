import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { readSource, pack, unpack, transaction, rollback, scan, disjoint, hash } from '../scripts/lib/setup.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url));
function fixture(t) {
  const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'pi-template-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const home=path.join(root,'home space'), source=path.join(root,'source'), target=path.join(home,'.pi/agent');
  for(const dir of [source,target,path.join(home,'.pi-lens')])fs.mkdirSync(dir,{recursive:true});
  const settings={packages:[],defaultProvider:'test',defaultModel:'model',enabledModels:['test/model']};
  fs.writeFileSync(path.join(source,'settings.json'),JSON.stringify(settings));
  fs.writeFileSync(path.join(source,'pi-lens-config.json'),'{"lsp":{"enabled":true}}');
  fs.writeFileSync(path.join(source,'external-configs.txt'),'pi-lens-config.json=~/.pi-lens/config.json\n');
  fs.writeFileSync(path.join(target,'settings.json'),'{"old":true}');
  fs.writeFileSync(path.join(home,'.pi-lens/config.json'),'{"old":true}');
  const run=(...args)=>{
    const r=spawnSync(process.execPath,[path.join(repo,'scripts/pi-setup.mjs'),...args],{encoding:'utf8',env:{...process.env,PI_SETUP_HOME:home,PI_CODING_AGENT_DIR:target}});
    assert.ifError(r.error);return {...r,output:r.stdout+r.stderr};
  };
  const unchanged=()=>{
    assert.equal(fs.readFileSync(path.join(target,'settings.json'),'utf8'),'{"old":true}');
    assert.equal(fs.readFileSync(path.join(home,'.pi-lens/config.json'),'utf8'),'{"old":true}');
  };
  return {root,home,source,target,run,unchanged,settings};
}
for(const ending of ['\n','\r\n',''])test(`scratch isolates external config (${JSON.stringify(ending)})`,t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.source,'external-configs.txt'),`pi-lens-config.json=~/.pi-lens/config.json${ending}`);
  const r=f.run('restore','--from-config',f.source,'--scratch');assert.equal(r.status,0,r.output);
  const result=JSON.parse(r.stdout);t.after(()=>fs.rmSync(path.dirname(result.home),{recursive:true,force:true}));
  assert.equal(fs.readFileSync(path.join(result.home,'.pi-lens/config.json'),'utf8'),'{"lsp":{"enabled":true}}');f.unchanged();
});
for(const flag of ['--install','--verify'])test(`scratch rejects ${flag}`,t=>{
  const f=fixture(t),r=f.run('restore','--from-config',f.source,'--scratch',flag);assert.notEqual(r.status,0);assert.match(r.output,/sandbox/);f.unchanged();
});
test('dry-run is read only',t=>{const f=fixture(t),r=f.run('restore','--from-config',f.source,'--dry-run');assert.equal(r.status,0,r.output);f.unchanged();assert.equal(fs.existsSync(path.join(f.home,'.pi-setup')),false);});
for(const destination of ['~/../escape','/tmp/escape','C:/escape','~/.pi-lens/../../escape'])test(`manifest rejects ${destination}`,t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.source,'external-configs.txt'),`pi-lens-config.json=${destination}`);
  assert.notEqual(f.run('restore','--from-config',f.source).status,0);f.unchanged();
});
test('restore and rollback cover ALL files, including external and new files',t=>{
  const f=fixture(t);fs.mkdirSync(path.join(f.source,'agents'));fs.writeFileSync(path.join(f.source,'agents/reviewer.md'),'review');
  const r=f.run('restore','--from-config',f.source);assert.equal(r.status,0,r.output);
  const journal=JSON.parse(r.stdout).journal;assert.ok(journal);
  assert.equal(fs.readFileSync(path.join(f.target,'agents/reviewer.md'),'utf8'),'review');
  const undo=f.run('rollback','--journal',journal);assert.equal(undo.status,0,undo.output);f.unchanged();
  assert.equal(fs.existsSync(path.join(f.target,'agents/reviewer.md')),false);
});
test('rollback refuses to overwrite a later user edit',t=>{
  const f=fixture(t),r=f.run('restore','--from-config',f.source);assert.equal(r.status,0,r.output);
  fs.writeFileSync(path.join(f.target,'settings.json'),'user edit');
  assert.notEqual(f.run('rollback','--journal',JSON.parse(r.stdout).journal).status,0);
  assert.equal(fs.readFileSync(path.join(f.target,'settings.json'),'utf8'),'user edit');
});
test('second restore removes only previously managed stale files',t=>{
  const f=fixture(t);fs.mkdirSync(path.join(f.source,'agents'));fs.writeFileSync(path.join(f.source,'agents/old.md'),'old');
  assert.equal(f.run('restore','--from-config',f.source).status,0);
  fs.writeFileSync(path.join(f.target,'agents/personal.md'),'keep');fs.unlinkSync(path.join(f.source,'agents/old.md'));
  assert.equal(f.run('restore','--from-config',f.source).status,0);
  assert.equal(fs.existsSync(path.join(f.target,'agents/old.md')),false);assert.equal(fs.readFileSync(path.join(f.target,'agents/personal.md'),'utf8'),'keep');
});
test('symlink/junction source is rejected',t=>{
  const f=fixture(t);fs.symlinkSync(path.join(f.home,'.pi-lens'),path.join(f.source,'extensions'),process.platform==='win32'?'junction':'dir');
  assert.notEqual(f.run('restore','--from-config',f.source).status,0);f.unchanged();
});
test('symlink/junction destination is rejected before writes',t=>{
  const f=fixture(t),out=path.join(f.root,'outside');fs.mkdirSync(out);fs.writeFileSync(path.join(out,'existing'),'keep');
  fs.symlinkSync(out,path.join(f.target,'agents'),process.platform==='win32'?'junction':'dir');
  fs.mkdirSync(path.join(f.source,'agents'));fs.writeFileSync(path.join(f.source,'agents/new.md'),'new');
  assert.notEqual(f.run('restore','--from-config',f.source).status,0);f.unchanged();assert.deepEqual(fs.readdirSync(out),['existing']);
});
test('secret detection blocks export without revealing value',t=>{
  const f=fixture(t),key=['pass','word'].join(''),secret=['not','Even','Twelve'].join('');fs.writeFileSync(path.join(f.target,'settings.json'),JSON.stringify({...f.settings,[key]:secret}));
  const out=path.join(f.root,'export');const r=f.run('backup','--config-dir',out);assert.notEqual(r.status,0);assert.ok(!r.output.includes(secret));assert.equal(fs.existsSync(out),false);
});
test('external secrets are scanned',t=>{const f=fixture(t),key=['pass','word'].join(''),secret='s'.repeat(12);fs.writeFileSync(path.join(f.target,'settings.json'),JSON.stringify(f.settings));fs.writeFileSync(path.join(f.home,'.pi-lens/config.json'),JSON.stringify({[key]:secret}));const r=f.run('backup','--output',path.join(f.root,'x.json'));assert.notEqual(r.status,0);assert.ok(!r.output.includes(secret));});
test('explicit placeholder accepted; alphabet-only secret rejected',()=>{const key=['pass','word'].join(''),secret=['very','secure','value'].join('');scan({'settings.json':Buffer.from('{"apiKey":"${API_KEY}"}')});assert.throws(()=>scan({'x':Buffer.from(JSON.stringify({[key]:secret}))}));});
test('source/destination aliases and nested paths rejected',t=>{const f=fixture(t);assert.throws(()=>disjoint(f.target,path.join(f.target,'.')));assert.throws(()=>disjoint(f.target,path.dirname(f.target)));assert.notEqual(f.run('backup','--config-dir',f.target+path.sep).status,0);f.unchanged();});
test('bundle roundtrip, tamper and path traversal',t=>{
  const f=fixture(t),files=readSource(f.source),bundle=pack(files);assert.deepEqual(unpack(bundle),files);
  bundle.files['settings.json'].base64=Buffer.from('tamper').toString('base64');assert.throws(()=>unpack(bundle),/integrity/);
  const hostile=pack(files);hostile.files['../escape']={base64:'',sha256:hash(Buffer.alloc(0))};assert.throws(()=>unpack(hostile),/Unsafe/);
});
test('backup omits credentials, state, cache and detects stale managed files',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.target,'settings.json'),JSON.stringify(f.settings));
  for(const name of ['auth.json','models-store.json'])fs.writeFileSync(path.join(f.target,name),'SECRET');
  const out=path.join(f.root,'export');fs.mkdirSync(out);fs.mkdirSync(path.join(out,'agents'));fs.writeFileSync(path.join(out,'agents/old.md'),'stale');fs.writeFileSync(path.join(out,'README.md'),'keep');
  const r=f.run('backup','--config-dir',out);assert.equal(r.status,0,r.output);assert.equal(fs.existsSync(path.join(out,'auth.json')),false);assert.equal(fs.existsSync(path.join(out,'models-store.json')),false);assert.equal(fs.existsSync(path.join(out,'agents/old.md')),false);assert.equal(fs.readFileSync(path.join(out,'README.md'),'utf8'),'keep');
});
test('invalid JSON and unpinned package fail before any writes',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.source,'settings.json'),JSON.stringify({...f.settings,packages:['npm:some-package']}));assert.notEqual(f.run('restore','--from-config',f.source).status,0);f.unchanged();});
test('transaction preflight refuses directory target without partial writes',t=>{const f=fixture(t),file=path.join(f.root,'first');assert.throws(()=>transaction([{file,bytes:Buffer.from('new')},{file:f.home,bytes:Buffer.from('bad')}],path.join(f.root,'journals')));assert.equal(fs.existsSync(file),false);});
test('interrupted pending journal can recover untouched and written entries',t=>{const f=fixture(t),file=path.join(f.root,'new'),j=path.join(f.root,'journal.json');fs.writeFileSync(file,'after');fs.writeFileSync(j,JSON.stringify({format:'pi-setup-journal',version:1,status:'pending',entries:[{target:file,old:null,after:hash(Buffer.from('after'))},{target:path.join(f.root,'not-yet-written'),old:null,after:hash(Buffer.from('later'))}]}));rollback(j,path.join(f.root,'journals'));assert.equal(fs.existsSync(file),false);});
test('missing installed packages cannot pass doctor',t=>{const f=fixture(t);const r=f.run('doctor','--live');assert.notEqual(r.status,0);});
for(const profile of ['minimal','coding','full'])test(`${profile} generated config matches committed lock`,t=>{
  const f=fixture(t),out=path.join(f.root,'generated');
  const r=f.run('configure','--profile',profile,'--provider','test','--model','executor','--advisor','test/reviewer','--output',out);assert.equal(r.status,0,r.output);
  const check=f.run('doctor','--from-config',out,'--strict');assert.equal(check.status,0,check.output);
  const lock=JSON.parse(fs.readFileSync(path.join(out,'runtime/package-lock.json')));lock.packages[''].dependencies['@earendil-works/pi-coding-agent']='0.0.0';fs.writeFileSync(path.join(out,'runtime/package-lock.json'),JSON.stringify(lock));
  assert.notEqual(f.run('doctor','--from-config',out,'--strict').status,0);
});
for(const profile of ['coding','full'])test(`${profile} config works without an explicit advisor`,t=>{
  const f=fixture(t),out=path.join(f.root,'generated');
  const r=f.run('configure','--profile',profile,'--provider','test','--model','executor','--output',out);
  assert.equal(r.status,0,r.output);
  const advisor=JSON.parse(fs.readFileSync(path.join(out,'advisor.json'),'utf8'));
  const settings=JSON.parse(fs.readFileSync(path.join(out,'settings.json'),'utf8'));
  assert.equal(advisor.executor,'test/executor');
  assert.equal(advisor.advisor,'test/executor');
  assert.deepEqual(settings.enabledModels,['test/executor']);
  assert.equal(f.run('doctor','--from-config',out,'--strict').status,0);
});
test('backup refuses unsupported scratch flag rather than writing',t=>{const f=fixture(t);const out=path.join(f.root,'output');assert.notEqual(f.run('backup','--scratch','--config-dir',out).status,0);assert.equal(fs.existsSync(out),false);});
test('restore is idempotent',t=>{const f=fixture(t);assert.equal(f.run('restore','--from-config',f.source).status,0);const r=f.run('restore','--from-config',f.source);assert.equal(r.status,0,r.output);assert.deepEqual(JSON.parse(r.stdout).changed,[]);assert.equal(JSON.parse(r.stdout).journal,null);});
test('write failure restores already-written files',t=>{
  const f=fixture(t),first=path.join(f.root,'first'),second=path.join(f.root,'second');fs.writeFileSync(first,'before');fs.writeFileSync(second,'before2');
  const original=fs.renameSync;let failed=false;
  fs.renameSync=(src,dest)=>{if(dest===second&&!failed){failed=true;throw new Error('simulated disk failure');}return original(src,dest);};
  try {assert.throws(()=>transaction([{file:first,bytes:Buffer.from('after')},{file:second,bytes:Buffer.from('after2')}],path.join(f.root,'journals')),/reverted/);}
  finally {fs.renameSync=original;}
  assert.equal(fs.readFileSync(first,'utf8'),'before');assert.equal(fs.readFileSync(second,'utf8'),'before2');
});
test('project identity is local and existing AGENTS is preserved',t=>{
  const f=fixture(t),project=path.join(f.root,'project');fs.mkdirSync(project);fs.writeFileSync(path.join(project,'AGENTS.md'),'keep');
  const r=f.run('project','--project',project,'--name','Test User','--email','test@example.com','--agents');assert.equal(r.status,0,r.output);assert.equal(fs.readFileSync(path.join(project,'AGENTS.md'),'utf8'),'keep');
  const git=spawnSync('git',['-C',project,'config','--local','user.email'],{encoding:'utf8'});assert.equal(git.stdout.trim(),'test@example.com');
  fs.mkdirSync(path.join(project,'nested'));assert.notEqual(f.run('project','--project',path.join(project,'nested'),'--name','Other','--email','other@example.com').status,0);
});
test('setup preview does not create files and upgrade requires an explicit source',t=>{
  const f=fixture(t);const r=f.run('setup','--profile','minimal','--provider','test','--model','model','--dry-run');assert.equal(r.status,0,r.output);f.unchanged();assert.equal(fs.existsSync(path.join(f.home,'.pi-setup')),false);assert.notEqual(f.run('upgrade').status,0);
});
test('invalid bundle error does not reveal content',t=>{const f=fixture(t),bundle=path.join(f.root,'bad.json'),key=['pass','word'].join(''),secret=['SENSITIVE','VALUE'].join('_');fs.writeFileSync(bundle,JSON.stringify({[key]:secret}).slice(0,-1)+', broken');const r=f.run('restore','--bundle',bundle);assert.notEqual(r.status,0);assert.ok(!r.output.includes(secret));});

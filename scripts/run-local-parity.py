from pathlib import Path
import subprocess,os,json,shutil,time,urllib.request,sys
import argparse
args=argparse.ArgumentParser()
args.add_argument('--oracle',required=True)
args.add_argument('--database',required=True)
args.add_argument('--node',default=shutil.which('node'))
args.add_argument('--wrangler',default=None)
opts=args.parse_args()
R=Path(__file__).resolve().parents[1]
NODE=opts.node
WR=opts.wrangler or str(R/'node_modules/wrangler/bin/wrangler.js')
backup=Path(opts.database).resolve()
assert backup.is_file(), 'A local restored D1 backup is required'
assert Path(opts.oracle).is_file(), 'The exact deployed Worker is required'
subprocess.run([sys.executable,str(R/'scripts/compare-local-schema.py'),'--database',str(backup)],check=True,timeout=30)
(R/'.test-artifacts').mkdir(exist_ok=True)
env=dict(os.environ,CI='true',WRANGLER_SEND_METRICS='false',CLOUDFLARE_API_TOKEN='local-test-only',PATH=str(Path(NODE).parent)+':'+os.environ['PATH'])
for label,module,port in [('oracle',str(Path(opts.oracle).resolve()),8895),('target',str(R/'dist/worker.mjs'),8896)]:
 state=R/'.test-state'/label
 if state.exists():shutil.rmtree(state)
 state.mkdir(parents=True,mode=0o700)
 cfg=state/'wrangler.toml';persist=state/'persist'
 cfg.write_text('name = "pepper-local-'+label+'"\nmain = '+json.dumps(module)+'\ncompatibility_date = "2026-06-17"\ncompatibility_flags = ["nodejs_compat"]\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "pepper-local-parity"\ndatabase_id = "00000000-0000-4000-8000-000000000001"\n')
 common=[NODE,WR]
 with (state/'seed.log').open('w') as log:
  seeded=subprocess.run(common+['d1','execute','pepper-local-parity','--local','--persist-to',str(persist),'--config',str(cfg),'--command','SELECT 1;','--json'],cwd=R,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=90)
 if seeded.returncode:raise RuntimeError('Local D1 initialization failed; see '+str(state/'seed.log'))
 files=[p for p in persist.rglob('*.sqlite') if '/d1/' in str(p) and p.name != 'metadata.sqlite']
 if len(files)!=1:raise RuntimeError('Expected one local D1 file, got '+str(files))
 for suffix in ['-wal','-shm']:
  p=Path(str(files[0])+suffix)
  if p.exists():p.unlink()
 shutil.copy2(backup,files[0]);files[0].chmod(0o600)
 log=(state/'server.log').open('w')
 server=subprocess.Popen(common+['dev','--local','--ip','127.0.0.1','--port',str(port),'--persist-to',str(persist),'--config',str(cfg)],cwd=R,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try:
  ready=False
  for _ in range(100):
   if server.poll() is not None:break
   try:
    with urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/api/questions?question_id=missing-local-id',timeout=1) as response:
     if response.status==200:ready=True;break
   except Exception:pass
   time.sleep(.3)
  if not ready:raise RuntimeError('Local Worker did not become ready; see '+str(state/'server.log'))
  result=R/'.test-artifacts'/('http-'+label+'.json');testenv=dict(env,PEPPER_LOCAL_URL='http://127.0.0.1:'+str(port),PEPPER_PARITY_RESULT=str(result))
  t=subprocess.run([NODE,'tests/local-http-parity.mjs'],cwd=R,env=testenv,capture_output=True,text=True,timeout=100)
  (state/'test.log').write_text(t.stdout+t.stderr)
  print('LOCAL_HTTP_PARITY',label,t.returncode,(t.stdout+t.stderr)[-2200:],flush=True)
  if t.returncode:raise RuntimeError(label+' HTTP parity failed')
 finally:
  import signal
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=15)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
  log.close()
a=json.loads((R/'.test-artifacts/http-oracle.json').read_text());b=json.loads((R/'.test-artifacts/http-target.json').read_text())
assert a['tools']==b['tools'],'MCP schemas differ'
assert a['routes']==b['routes'],'HTTP route results differ'
print('TOOLS_AND_HTTP_ROUTES_IDENTICAL',len(a['tools']),len(a['routes']),flush=True)

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';

test('backend failures return sanitized 503, capture safe exceptions and keep webhook retries alive', async t => {
  const captures = [];
  const backend = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    if (req.url === '/i/v0/e') { captures.push(JSON.parse(body)); res.end('{}'); return; }
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({error: 'sensitive-backend-message'}));
  });
  backend.listen(0, '127.0.0.1'); await once(backend, 'listening');
  t.after(() => backend.close());
  const reserve = createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = reserve.address().port; await new Promise(r => reserve.close(r));
  const origin = `http://127.0.0.1:${port}`;
  const upstream = `http://127.0.0.1:${backend.address().port}`;
  const child = spawn(process.execPath, ['src/server.mjs'], {env: {
    ...process.env, PORT: String(port), APP_URL: origin, BACKEND_URL: upstream,
    BACKEND_GATEWAY_SECRET: 'test-only', STRIPE_WEBHOOK_SECRET: 'test-only',
    STRIPE_PAYMENT_LINK_ID: 'plink_test', POSTHOG_PROJECT_KEY: 'test-only', POSTHOG_HOST: upstream
  }, stdio: ['ignore', 'pipe', 'pipe']});
  t.after(() => child.kill());
  let logs = ''; child.stderr.on('data', c => logs += c);
  await once(child.stdout, 'data');
  const owner = await fetch(`${origin}/api/state`, {headers: {cookie: 'sl_workspace=test-only'}});
  assert.equal(owner.status, 503);
  assert.deepEqual(await owner.json(), {error: 'Internal server error'});
  const payload = JSON.stringify({id:'evt_test',livemode:false,type:'checkout.session.completed',data:{object:{
    payment_link:'plink_test',payment_status:'paid',client_reference_id:'00000000-0000-4000-8000-000000000001'
  }}});
  const ts = Math.floor(Date.now()/1000);
  const sig = createHmac('sha256','test-only').update(`${ts}.${payload}`).digest('hex');
  const webhook = await fetch(`${origin}/api/stripe/webhook`, {method:'POST',body:payload,headers:{'stripe-signature':`t=${ts},v1=${sig}`}});
  assert.equal(webhook.status,503);
  assert.deepEqual(await webhook.json(),{error:'Internal server error'});
  assert.equal((await fetch(`${origin}/health`)).status,200);
  for(let i=0;i<30 && captures.length<2;i++) await new Promise(r=>setTimeout(r,20));
  assert.equal(captures.length,2);
  assert.ok(captures.every(c=>c.event==='$exception' && c.distinct_id==='scopeledger-server'));
  assert.doesNotMatch(JSON.stringify(captures),/sensitive-backend-message|sl_workspace|client_reference_id|evt_test/);
  assert.doesNotMatch(logs,/sensitive-backend-message|ReferenceError|test-only/);
  assert.equal(child.exitCode,null);
});

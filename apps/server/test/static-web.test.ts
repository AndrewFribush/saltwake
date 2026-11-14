import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publicOriginProblem,isLocalOrigin,staticFile} from '../src/static-web';

test('public origin: https and a real host only; the local origin stays http://127.0.0.1',()=>{
 assert.equal(publicOriginProblem('https://saltwake.fly.dev'),undefined);
 assert.equal(publicOriginProblem('https://play.example.org:8443'),undefined);
 assert.match(publicOriginProblem('http://saltwake.fly.dev')!,/https/);
 assert.match(publicOriginProblem('https://saltwake.fly.dev/')!,/bare origin/);
 assert.match(publicOriginProblem('https://127.0.0.1')!,/loopback/);
 assert.match(publicOriginProblem('https://localhost:8443')!,/loopback/);
 assert.match(publicOriginProblem('nonsense')!,/URL/);
 assert.ok(isLocalOrigin('http://127.0.0.1:18930'));
 assert.ok(!isLocalOrigin('http://localhost:18930')&&!isLocalOrigin('https://saltwake.fly.dev'));
});

test('static files: exact file, hashed asset caching, app-route fallback to index.html, never outside the directory',()=>{
 const dir=mkdtempSync(join(tmpdir(),'saltwake-web-'));
 try{
  mkdirSync(join(dir,'assets'));writeFileSync(join(dir,'index.html'),'<!doctype html>');writeFileSync(join(dir,'assets','app-abc123.js'),'1');writeFileSync(join(dir,'gallery.html'),'g');
  writeFileSync(join(tmpdir(),'saltwake-web-outside.txt'),'secret');
  const index=staticFile(dir,'/');assert.equal(index?.path,join(dir,'index.html'));assert.equal(index?.type,'text/html; charset=utf-8');assert.equal(index?.cache,'no-cache');
  const js=staticFile(dir,'/assets/app-abc123.js');assert.equal(js?.type,'text/javascript; charset=utf-8');assert.match(js!.cache,/immutable/);
  assert.equal(staticFile(dir,'/gallery.html')?.path,join(dir,'gallery.html'));
  assert.equal(staticFile(dir,'/town/harbour')?.path,join(dir,'index.html'),'app routes get the shell');
  assert.equal(staticFile(dir,'/assets/missing-999.js'),undefined,'a missing asset is not the shell');
  assert.equal(staticFile(dir,'/api/config'),undefined);
  assert.equal(staticFile(dir,'/../saltwake-web-outside.txt'),undefined);
  assert.equal(staticFile(dir,'/%2e%2e/saltwake-web-outside.txt'),undefined);
  assert.equal(staticFile(dir,'/assets/../../saltwake-web-outside.txt'),undefined);
 }finally{rmSync(dir,{recursive:true,force:true});rmSync(join(tmpdir(),'saltwake-web-outside.txt'),{force:true});}
});

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, '..', 'static', 'jump-mp.html'), 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const APP_ID = 'wx547c3e01e5c36eae';
const PICKUP_PATH = 'pages/pickup/pickup';

function run(search) {
  const navigations = [];
  const elements = new Map([
    ['card', { className: 'box' }],
    ['msg', { textContent: '' }],
    ['btn', { style: {}, href: '', onclick: null }],
    ['tip', { textContent: '' }],
  ]);
  const context = {
    Blob: class { constructor(parts) { this.size = Buffer.byteLength(parts.join(''), 'utf8'); } },
    URLSearchParams,
    location: {
      search,
      pathname: '/jump-mp.html',
      set href(value) { navigations.push(value); },
      get href() { return navigations[navigations.length - 1] || ''; },
    },
    history: { replaceState() {} },
    document: { getElementById(id) { return elements.get(id); } },
  };
  vm.runInNewContext(script, context, { timeout: 1000 });
  return { elements, navigations };
}

function expected(token) {
  return `weixin://dl/business/?appid=${APP_ID}&path=${PICKUP_PATH}&query=${encodeURIComponent(`e=${token}`)}`;
}

const accepted = [
  'DLE1.dle1-k1.lz8abc.eyJ2IjoxLCJ4IjoiYWJjIn0',
  'DLE1.sender_key.1k9z.ABC_def-123',
  `DLE1.${'k'.repeat(32)}.${'z'.repeat(10)}.ABC_def-123`,
];
for (const token of accepted) {
  const result = run(`?e=${token}`);
  assert.deepStrictEqual(result.navigations, [expected(token)]);
  assert.strictEqual(result.elements.get('btn').href, expected(token));
}

const rejected = [
  '',
  '?',
  '?go=member',
  '?_path=pages/pickup/pickup',
  '?e=',
  '?e=DLE2.token',
  '?e=DLE1.',
  '?e=DLE1.dle1-k1.lz8abc.',
  `?e=DLE1.${'k'.repeat(33)}.lz8abc.eyJ2IjoxfQ`,
  `?e=DLE1.dle1-k1.${'a'.repeat(11)}.eyJ2IjoxfQ`,
  '?e=DLE1.dle1-k1.lz8abc.bad%20token',
  '?e=DLE1.token&extra=1',
  '?e=DLE1.a&e=DLE1.b',
  '?%65=DLE1.token',
  '?E=DLE1.token',
];
for (const search of rejected) {
  const result = run(search);
  assert.deepStrictEqual(result.navigations, [], search);
  assert.strictEqual(result.elements.get('btn').style.display, 'none', search);
}

const oversized = run(`?e=DLE1.${'a'.repeat(900)}`);
assert.deepStrictEqual(oversized.navigations, []);
assert.match(oversized.elements.get('msg').textContent, /800/);

assert.ok(!source.includes('crypto'));
assert.ok(!source.includes('privateKey'));
assert.ok(!source.includes('analytics'));
assert.match(source, /meta name="referrer" content="no-referrer"/);
assert.match(source, /new Blob\(\[q\]\)\.size>800/);

console.log('jump-mp strict e-only contract: ok');

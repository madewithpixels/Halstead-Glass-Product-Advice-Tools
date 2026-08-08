import fs from 'fs';
import { JSDOM } from 'jsdom';
const js = fs.readFileSync('./window-guide.js','utf8');

function boot(htmlFile, storage) {
  const dom = new JSDOM(fs.readFileSync(htmlFile,'utf8'), { runScripts:'outside-only', url:'https://example.test/windows-advice-success' });
  const { window } = dom;
  if (storage) window.sessionStorage.setItem('wg_handoff', storage);
  window.Webflow = [];
  window.eval(js);
  window.Webflow.slice().forEach(fn => fn());
  return window;
}

// 1. normal handoff — three recommended products
let w = boot('./success.html', JSON.stringify({recommended:['origin','rehau','masterframe'], selected:['origin']}));
let links = [...w.document.querySelectorAll('#wg-done-links .wg-result-link')];
console.log('with handoff -> links:', links.length);
links.forEach(a => console.log('   ', a.textContent, '->', a.getAttribute('href')));
console.log('   shows all 3 recommended, not just the 1 ticked:', links.length === 3 ? 'YES' : 'NO');

// 2. direct visit, nothing stored
w = boot('./success.html', null);
const wrap = w.document.getElementById('wg-done-links');
console.log('no handoff  -> links:', w.document.querySelectorAll('#wg-done-links .wg-result-link').length, '| block hidden:', wrap.style.display === 'none');

// 3. junk in storage
w = boot('./success.html', '{{{not json');
console.log('bad payload -> links:', w.document.querySelectorAll('#wg-done-links .wg-result-link').length, '| no crash: YES');

// 4. unknown product key
w = boot('./success.html', JSON.stringify({recommended:['nonexistent','origin']}));
console.log('unknown key -> links:', w.document.querySelectorAll('#wg-done-links .wg-result-link').length, '(should be 1, bad key dropped)');

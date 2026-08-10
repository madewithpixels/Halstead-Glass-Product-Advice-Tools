import fs from 'fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('./harness.html','utf8');
// strip the harness's own driver script so we control init ourselves
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.test/' });
const { window } = dom;
const { document } = window;

window.Webflow = [];
const js = fs.readFileSync('./window-guide.js','utf8');
window.eval(js);
const queued = window.Webflow.slice();
console.log('init fns queued:', queued.length);
queued.forEach(fn => fn());

const STEPS = [
  ["period","modern","conservation"],
  ["value","traditional","contemporary","guarantee"],
  ["cost_effective","mid_range","premium","open"],
  ["casement","sash","tilt_turn","bay","gable","secondary","guide"]
];
const STYLE_SUPPORT = {
  "Liniar uPVC Casement Windows":         ["casement","bay"],
  "REHAU Rio Flush uPVC Casement Windows":["casement","bay"],
  "Quickslide uPVC Sliding Sash Windows": ["sash"],
  "Masterframe uPVC Sash Windows":        ["sash"],
  "Origin Aluminium Windows":             ["casement","tilt_turn","bay","gable"],
  "Granada Secondary Glazing":            ["secondary"]
};
const fv = n => { const el = document.querySelector(`#window-guide input[name="${n}"]`); return el ? el.value : "(missing)"; };

function runOne(combo){
  document.querySelector('#window-guide [data-wg="start"]').click();
  combo.forEach((v,i)=>{
    const st = document.querySelector(`#window-guide .wg-stage[data-step="${i+1}"]`);
    const o = st.querySelector(`.wg-option[data-value="${v}"]`);
    if(o) o.click();
  });
  const rec = fv("Recommended");
  const names = rec === "(none)" ? [] : rec.split(", ").filter(Boolean);
  const style = combo[3];
  // Strict since the backfill was removed: every product returned must support
  // the requested style. The one sanctioned exception is Granada, which is
  // force-eligible in a conservation area whatever style was asked for.
  const offenders = style==="guide" ? [] : names.filter(n =>
    !(STYLE_SUPPORT[n]||[]).includes(style) &&
    !(n==="Granada Secondary Glazing" && combo[0]==="conservation")
  );
  return {combo, names, mismatch:offenders.length>0, offenders, count:names.length};
}

const rows=[];
for(const a of STEPS[0])for(const b of STEPS[1])for(const c of STEPS[2])for(const d of STEPS[3]) rows.push(runOne([a,b,c,d]));

console.log('paths run:', rows.length);
const appear={}; Object.keys(STYLE_SUPPORT).forEach(n=>appear[n]=0);
let empty=0, flagged=0;
const byCount={};
rows.forEach(r=>{ r.names.forEach(n=>appear[n]=(appear[n]||0)+1); if(r.count===0) empty++; if(r.mismatch) flagged++; byCount[r.count]=(byCount[r.count]||0)+1; });
console.log('style mismatches:', flagged);
console.log('paths with no results:', empty);
console.log('result counts:', Object.entries(byCount).sort().map(([k,v])=>`${k} result${k==="1"?"":"s"} x${v}`).join(', '));

// Result count is no longer a constant, so assert the expected count per style
// instead. Conservation adds Granada to every style bar secondary glazing.
const EXPECTED = { casement:3, bay:3, sash:2, tilt_turn:1, gable:1, secondary:1, guide:3 };
const wrongCount = rows.filter(r => {
  const [prop,,,style] = r.combo;
  let want = EXPECTED[style];
  if (prop === "conservation" && style !== "secondary") want = Math.min(3, want + 1);
  return r.count !== want;
});
console.log('paths with an unexpected result count:', wrongCount.length);
wrongCount.slice(0,10).forEach(r=>console.log('  '+r.combo.join(' / ')+'  ->  '+r.count+'  '+r.names.join(' · ')));
console.log('\nappearance counts:');
Object.entries(appear).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${String(v).padStart(4)}  ${(v/rows.length*100).toFixed(1).padStart(5)}%  ${k}`));
const never=Object.entries(appear).filter(([,v])=>v===0).map(([k])=>k);
console.log('\nnever recommended:', never.length ? never.join(', ') : '(none)');

console.log('\nsample of flagged rows:');
rows.filter(r=>r.mismatch).slice(0,10).forEach(r=>console.log('  '+r.combo.join(' / ')+'  ->  '+r.names.join(' · ')+'   [offending: '+r.offenders.join(', ')+']'));

console.log('\nsample output fields (conservation/traditional/open/sash):');
runOne(["conservation","traditional","open","sash"]);
["Property","Priority","Budget","Style","Recommended","Selected","Changed","Source"].forEach(f=>console.log(`  ${f}: ${fv(f)}`));

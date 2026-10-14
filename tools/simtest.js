const fs=require('fs');
const code=['01_data','02_levels','03_world','04_bot'].map(f=>fs.readFileSync(__dirname+'/../src/'+f+'.js','utf8')).join('\n');
eval(code+`
const res=[];let fails=0;
const only=process.argv[2]?process.argv[2].split(',').map(Number):null;
for(let n=1;n<=100;n++){ if(only&&!only.includes(n))continue;
  const L=buildLevel(n); const W=new World(L); let steps=0; const kinds={};
  while(!W.done && steps<60*240){ W.step(1/60, botInput(W)); steps++; for(const e of W.events) if(e.name==='death') kinds[e.kind+'@'+L.segs[(L.checkpoints[W.cp]||{seg:1}).seg-1]]=(kinds[e.kind+'@'+L.segs[(L.checkpoints[W.cp]||{seg:1}).seg-1]]||0)+1; W.events.length=0; if(W.deaths>40)break;}
  const ok=W.done; if(!ok)fails++;
  if(!ok||W.deaths) console.log(n, ok?'OK':'FAIL', 'deaths',W.deaths, 't',(steps/60).toFixed(1), 'x',W.p.x|0,'/',L.exitX|0, JSON.stringify(kinds), L.segs.join(','));
}
console.log('fails',fails);
`);

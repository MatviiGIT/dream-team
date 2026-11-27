import type { Club, Fixture, GameState, JobOffer, League, MatchEvent, MatchResult, Player, PlayerSkills, Position, TableRow, TacticalMentality, TacticalPressure } from '../domain/types';

const WEEKS = 14;
const SQUAD = 16;
const WINDOWS = new Set([1, 2, 8, 9]);

const countries = ['England','Spain','Germany','Italy','France','Netherlands','Portugal','Belgium','Turkey','Austria','Scotland','Denmark'];
const cities: Record<string, string[]> = {
  England: ['London','Manchester','Liverpool','Leeds','Bristol','Sheffield','Brighton','Birmingham'],
  Spain: ['Madrid','Barcelona','Valencia','Seville','Bilbao','Vigo','Malaga','Zaragoza'],
  Germany: ['Berlin','Munich','Hamburg','Cologne','Frankfurt','Stuttgart','Leipzig','Bremen'],
  Italy: ['Rome','Milan','Turin','Naples','Florence','Bologna','Genoa','Palermo'],
  France: ['Paris','Lyon','Marseille','Lille','Nice','Toulouse','Nantes','Bordeaux'],
  Netherlands: ['Amsterdam','Rotterdam','Eindhoven','Utrecht','Groningen','Arnhem','Tilburg','Alkmaar'],
  Portugal: ['Lisbon','Porto','Braga','Coimbra','Faro','Aveiro','Guimaraes','Setubal'],
  Belgium: ['Brussels','Antwerp','Bruges','Ghent','Liege','Charleroi','Genk','Leuven'],
  Turkey: ['Istanbul','Ankara','Izmir','Bursa','Antalya','Adana','Konya','Trabzon'],
  Austria: ['Vienna','Graz','Linz','Salzburg','Innsbruck','Klagenfurt','Wels','St.Polten'],
  Scotland: ['Glasgow','Edinburgh','Aberdeen','Dundee','Paisley','Perth','Dunfermline','Inverness'],
  Denmark: ['Copenhagen','Aarhus','Odense','Aalborg','Esbjerg','Randers','Vejle','Horsens'],
};
const suffixes = ['Athletic','United','City','Rovers','Sporting','Wanderers','FC','Town'];
const colors = ['#e05268','#3c73d9','#e0ad45','#40aa78','#8b68d5','#319e9e','#e36c32','#596995'];
const firstNames = ['Alex','Noah','Liam','Leo','Elias','Milan','Theo','Jonas','Luca','Adrian','Felix','Nico','Daniel','Mateo','Oscar','David','Emil','Robin','Max','Sam','Leon','Julian','Luis','Marco','Enzo','Tom','Jan','Paul','Rayan','Victor'];
const lastNames = ['Meyer','Keller','Fischer','Berg','Kovac','Silva','Costa','Rossi','Novak','Turner','Weber','Santos','Moretti','Parker','Hart','Mills','Bianchi','Garcia','Dubois','Martin','Wilson','Bennett','Schmidt','Romano','Varga','Lind','Pereira','Young','Duarte','Bauer'];

function hash(text: string): number { let h=2166136261>>>0; for(let i=0;i<text.length;i++) h=Math.imul(h^text.charCodeAt(i),16777619); return h>>>0; }
function rnd(seed: number): () => number { let s=seed>>>0; return () => { s^=s<<13; s^=s>>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
function int(r:()=>number,min:number,max:number){ return Math.floor(min+r()*(max-min+1)); }
function clamp(v:number,min:number,max:number){ return Math.max(min,Math.min(max,v)); }
function avg(v:number[]){ return v.length?v.reduce((a,b)=>a+b,0)/v.length:0; }

type InternalSkills = PlayerSkills & { technique:number; physical:number };
function overall(s:InternalSkills,p:Position){
  if(p==='GK') return Math.round(s.goalkeeping*.78+s.passing*.08+s.speed*.06+s.tackling*.08);
  if(p==='DEF') return Math.round(s.tackling*.40+s.speed*.18+s.passing*.18+s.physical*.24);
  if(p==='MID') return Math.round(s.passing*.34+s.speed*.18+s.shooting*.18+s.tackling*.12+s.technique*.18);
  return Math.round(s.shooting*.40+s.speed*.25+s.passing*.10+s.technique*.25);
}
function publicSkills(s:InternalSkills):PlayerSkills{
  return {
    speed:s.speed,
    passing:s.passing,
    shooting:s.shooting,
    tackling:s.tackling,
    goalkeeping:s.goalkeeping,
    technique:s.technique,
    physical:s.physical,
  };
}
function makePlayer(country:string, seedText:string, strength:number, index:number):Player{
  const r=rnd(hash(seedText)); const positions: Position[]=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','MID','FWD','FWD','FWD','DEF','MID','FWD','GK']; const pos=positions[index];
  const age=int(r,17,34), base=clamp(strength+int(r,-8,7),40,93);
  const s:InternalSkills={
    speed:clamp(base+int(r,-6,9),20,97),
    passing:clamp(base+int(r,-7,8),20,97),
    shooting:clamp(base+int(r,pos==='FWD'?2:-7,pos==='FWD'?12:5),18,97),
    tackling:clamp(base+int(r,pos==='DEF'?2:-7,pos==='DEF'?12:5),18,97),
    goalkeeping:pos==='GK'?clamp(base+int(r,3,12),30,98):int(r,1,18),
    technique:clamp(base+int(r,-7,8),20,97),
    physical:clamp(base+int(r,-5,8),25,97),
  };
  const o=clamp(overall(s,pos),35,97);
  return {
    id:seedText,name:firstNames[(index*7+hash(country))%firstNames.length]+' '+lastNames[(index*11+hash(seedText))%lastNames.length],
    age,position:pos,nationality:country,skills:publicSkills(s),overall:o,
    potential:clamp(o+(age<21?int(r,9,18):age<24?int(r,4,10):int(r,0,4)),o,97),
    marketValue:Math.max(100000,Math.round(o*o*(age<24?1.05:age>30?.65:.9)/100)*10000),
    wage:Math.max(450,Math.round(o*(age>30?15:18))),fitness:100,morale:int(r,68,92),
    goals:0,assists:0,appearances:0,careerGoals:0,careerAssists:0,careerAppearances:0,
    transferListed:index>10 && r()<.25,
  };
}
function emptyTable(ids:string[]):TableRow[]{ return ids.map(teamId=>({teamId,played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,points:0})); }
function sortTable(rows:TableRow[]){ return [...rows].sort((a,b)=>b.points-a.points||((b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst))||b.goalsFor-a.goalsFor); }
function applyResult(rows:TableRow[],x:MatchResult){
  return sortTable(rows.map(row=>{
    if(row.teamId!==x.homeTeamId&&row.teamId!==x.awayTeamId)return row;
    const home=row.teamId===x.homeTeamId,gf=home?x.homeGoals:x.awayGoals,ga=home?x.awayGoals:x.homeGoals,win=gf>ga,draw=gf===ga;
    return {...row,played:row.played+1,wins:row.wins+(win?1:0),draws:row.draws+(draw?1:0),losses:row.losses+(win||draw?0:1),goalsFor:row.goalsFor+gf,goalsAgainst:row.goalsAgainst+ga,points:row.points+(win?3:draw?1:0)};
  }));
}
function formationRoles(formation:Club['formation']):Position[]{
  const map:Record<Club['formation'],Position[]> = {
    '4-3-3':['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'],
    '4-4-2':['GK','DEF','DEF','DEF','DEF','MID','MID','MID','MID','FWD','FWD'],
    '4-2-3-1':['GK','DEF','DEF','DEF','DEF','MID','MID','MID','MID','MID','FWD'],
    '4-5-1':['GK','DEF','DEF','DEF','DEF','MID','MID','MID','MID','MID','FWD'],
    '3-5-2':['GK','DEF','DEF','DEF','MID','MID','MID','MID','MID','FWD','FWD'],
    '3-4-3':['GK','DEF','DEF','DEF','MID','MID','MID','MID','FWD','FWD','FWD'],
    '5-3-2':['GK','DEF','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD'],
    '5-4-1':['GK','DEF','DEF','DEF','DEF','DEF','MID','MID','MID','MID','FWD'],
    '4-1-4-1':['GK','DEF','DEF','DEF','DEF','MID','MID','MID','MID','MID','FWD'],
    '3-4-2-1':['GK','DEF','DEF','DEF','MID','MID','MID','MID','MID','MID','FWD'],
  };
  return map[formation];
}
function defaultXI(ids:string[],players:Record<string,Player>,formation:Club['formation']='4-3-3'){
  const wanted=formationRoles(formation), left=new Set(ids),out:string[]=[];
  for(const p of wanted){
    const id=ids.filter(x=>left.has(x)&&players[x]?.position===p).sort((a,b)=>players[b].overall-players[a].overall)[0]
      ??ids.filter(x=>left.has(x)).sort((a,b)=>players[b].overall-players[a].overall)[0];
    if(id){out.push(id);left.delete(id);}
  }
  return out;
}
function makeWorld(){
  const clubs:Record<string,Club>={},players:Record<string,Player>={},leagues:Record<string,League>={},tables:Record<string,TableRow[]>={};
  countries.forEach((country,ci)=>{
    (['1','2'] as const).forEach(levelText=>{
      const level=Number(levelText) as 1|2, leagueId=country.slice(0,2).toLowerCase()+'_'+level, ids:string[]=[];
      for(let i=0;i<8;i++){
        const id='club_'+country.slice(0,2).toLowerCase()+'_'+level+'_'+i, strength=clamp(85-ci*2-(level-1)*13-i,38,91), city=cities[country][i];
        const pids:string[]=Array.from({length:SQUAD},(_,pi)=>id+'_p_'+pi);
        const club:Club={id,name:city+' '+suffixes[(i+ci+level)%suffixes.length],shortName:city.slice(0,3).toUpperCase(),country,leagueId,reputation:strength,budget:level===1?Math.round((2200000+strength*120000)/50000)*50000:Math.round((750000+strength*65000)/25000)*25000,wageBill:0,playerIds:pids,startingXI:[],formation:'4-3-3',mentality:'NEUTRAL',pressure:'NORMAL',color:colors[i],trophies:0};
        pids.forEach((pid,pi)=>players[pid]=makePlayer(country,pid,strength,pi));
        club.wageBill=pids.reduce((s,id)=>s+players[id].wage,0); club.startingXI=defaultXI(pids,players);
        clubs[id]=club;ids.push(id);
      }
      leagues[leagueId]={id:leagueId,country,name:level===1?country+' Premier':country+' Championship',level,clubIds:ids,promotionCount:level===2?1:0,relegationCount:level===1?1:0};
      tables[leagueId]=emptyTable(ids);
    });
  });
  return {clubs,players,leagues,tables};
}
function fixturesFor(leagues:Record<string,League>,season:number){
  const out:Fixture[]=[];
  Object.values(leagues).forEach(l=>{
    const ids=[...l.clubIds], n=ids.length, rounds=n-1;
    for(let r=0;r<rounds;r++){
      const rot=[ids[0],...ids.slice(1)];
      for(let k=0;k<r;k++) rot.push(rot.splice(1,1)[0]);
      for(let i=0;i<n/2;i++){
        const a=rot[i],b=rot[n-1-i],flip=(r+i+season)%2===0;
        out.push({id:l.id+'_'+season+'_'+(r+1)+'_'+i,leagueId:l.id,round:r+1,homeTeamId:flip?a:b,awayTeamId:flip?b:a,played:false});
      }
    }
    out.filter(f=>f.leagueId===l.id&&f.round<=rounds).forEach(f=>out.push({...f,id:f.id+'_2',round:f.round+rounds,homeTeamId:f.awayTeamId,awayTeamId:f.homeTeamId,played:false,result:undefined}));
  });
  return out;
}
function strength(c:Club,players:Record<string,Player>){
  const ps=c.startingXI.map(id=>players[id]).filter(Boolean);
  const baseAttack=avg(ps.filter(p=>p.position==='FWD'||p.position==='MID').map(p=>(p.skills.shooting+p.skills.passing+p.skills.speed)/3));
  const baseDefence=avg(ps.filter(p=>p.position==='GK'||p.position==='DEF').map(p=>(p.skills.tackling+p.skills.goalkeeping+p.skills.speed)/3));
  const basePower=avg(ps.map(p=>p.overall));
  const mentality=c.mentality??'NEUTRAL',pressure=c.pressure??'NORMAL';
  const attackFactor=mentality==='ATTACKING'?1.08:mentality==='DEFENSIVE'?.93:1;
  const defenceFactor=mentality==='DEFENSIVE'?1.08:mentality==='ATTACKING'?.94:1;
  const pressureFactor=pressure==='HIGH'?1.025:pressure==='LOW'?.985:1;
  return {
    attack:baseAttack*attackFactor*pressureFactor,
    defence:baseDefence*defenceFactor*pressureFactor,
    power:basePower*(pressure==='HIGH'?.995:pressure==='LOW'?1.005:1)
  };
}
function pick(c:Club,players:Record<string,Player>,kind:'g'|'a',r:()=>number){
  const ps=c.startingXI.map(id=>players[id]).filter((p):p is Player=>Boolean(p)&&p.position!=='GK'); if(!ps.length)return;
  const w=ps.map(p=>Math.max(1,kind==='g'?p.skills.shooting+p.skills.speed:p.skills.passing+p.skills.speed)),total=w.reduce((a,b)=>a+b,0);let x=r()*total;
  for(let i=0;i<ps.length;i++){x-=w[i];if(x<=0)return ps[i];} return ps[ps.length-1];
}
function goals(r:()=>number,lambda:number){ let p=1,k=0;while(p>Math.exp(-lambda)&&k<7){p*=Math.max(.05,r());k++;}return Math.max(0,k-1); }
export function simulateMatch(home:Club,away:Club,players:Record<string,Player>,seed:number):MatchResult{
  const r=rnd(seed),a=strength(home,players),b=strength(away,players);
  const hg=goals(r,clamp(.55+(a.attack-b.defence)/30+(a.power-b.power)/55+.025,.12,3.1));
  const ag=goals(r,clamp(.48+(b.attack-a.defence)/31+(b.power-a.power)/58,.10,2.8));
  const events:MatchEvent[]=[]; const minutes=new Set<number>();
  for(let i=0;i<hg+ag;i++){
    let m=int(r,4,88);while(minutes.has(m))m=int(r,4,88);minutes.add(m);
    const c=i<hg?home:away,s=pick(c,players,'g',r),ass=pick(c,players,'a',r);
    events.push({minute:m,teamId:c.id,playerId:s?.id,assistPlayerId:ass&&ass.id!==s?.id?ass.id:undefined,type:'goal'});
    if(s)s.goals++;
    if(ass&&ass.id!==s?.id)ass.assists++;
  }
  events.sort((x,y)=>x.minute-y.minute);events.push({minute:90,teamId:home.id,type:'full-time'});
  return {homeTeamId:home.id,awayTeamId:away.id,homeGoals:hg,awayGoals:ag,events};
}
function marketFromState(s:GameState){return Object.values(s.players).filter(p=>p.transferListed&&!s.clubs[s.clubId].playerIds.includes(p.id)).sort((a,b)=>b.overall-a.overall||a.marketValue-b.marketValue);}
function aiTransfers(s:GameState){
  if(!WINDOWS.has(s.week))return;
  const r=rnd(hash('ai:'+s.season+':'+s.week));
  Object.values(s.clubs).forEach(buyer=>{
    if(r()>.18||buyer.playerIds.length>=SQUAD)return;
    const p=marketFromState(s).find(x=>x.overall<=buyer.reputation+7&&buyer.budget>=x.marketValue);
    if(!p)return;
    const seller=Object.values(s.clubs).find(c=>c.playerIds.includes(p.id)); if(!seller||seller.id===buyer.id)return;
    seller.playerIds=seller.playerIds.filter(id=>id!==p.id); seller.startingXI=seller.startingXI.filter(id=>id!==p.id); seller.budget+=p.marketValue;
    buyer.playerIds.push(p.id); buyer.budget-=p.marketValue;p.transferListed=false;
    seller.wageBill=seller.playerIds.reduce((sum,id)=>sum+s.players[id].wage,0);buyer.wageBill=buyer.playerIds.reduce((sum,id)=>sum+s.players[id].wage,0);
    seller.startingXI=defaultXI(seller.playerIds,s.players,seller.formation);
    buyer.startingXI=defaultXI(buyer.playerIds,s.players,buyer.formation);
  });
}
function endSeason(s:GameState){
  const current=s.clubs[s.clubId], league=s.leagues[current.leagueId], pos=(s.tables[league.id].findIndex(r=>r.teamId===current.id)+1)||league.clubIds.length;
  s.history.push({season:s.season,clubId:current.id,clubName:current.name,leagueName:league.name,position:pos,trophies:current.trophies});
  Object.values(s.leagues).forEach(l=>{
    const rows=sortTable(s.tables[l.id]);
    if(l.level===1){const down=rows.at(-1),lower=Object.values(s.leagues).find(x=>x.country===l.country&&x.level===2);if(down&&lower){l.clubIds=l.clubIds.filter(id=>id!==down.teamId);lower.clubIds.push(down.teamId);s.clubs[down.teamId].leagueId=lower.id;}}
    else {const up=rows[0],upper=Object.values(s.leagues).find(x=>x.country===l.country&&x.level===1);if(up&&upper){l.clubIds=l.clubIds.filter(id=>id!==up.teamId);upper.clubIds.push(up.teamId);s.clubs[up.teamId].leagueId=upper.id;}}
  });
  Object.values(s.leagues).forEach(l=>{
    const rows=sortTable(s.tables[l.id]);
    rows.forEach((row,index)=>{
      const c=s.clubs[row.teamId]; if(!c)return;
      const r=rnd(hash('world:'+s.season+':'+row.teamId));
      const positionBoost=l.level===1 ? (index===0?2:index>=6?-2:0) : (index===0?3:index>=6?-1:0);
      c.reputation=clamp(c.reputation+positionBoost+int(r,-1,1),35,97);
    });
  });
  Object.values(s.players).forEach(p=>{
    p.age++;
    const r=rnd(hash(p.id+':'+s.season));
    if(p.age<=23)p.overall=clamp(p.overall+Math.min(p.potential-p.overall,1+int(r,0,3)),35,97);
    else if(p.age<=28)p.overall=clamp(p.overall+int(r,-1,1),35,97);
    else if(p.age>=30)p.overall=clamp(p.overall-int(r,0,2),35,97);
    p.marketValue=Math.max(100000,Math.round(p.overall*p.overall*(p.age<24?1.05:p.age>30?.65:.9)/100)*10000);
    p.wage=Math.max(450,Math.round(p.overall*(p.age>30?15:18)));p.fitness=100;p.morale=clamp(p.morale+int(r,-4,5),45,95);
    p.goals=0;p.assists=0;p.appearances=0;
  });
  Object.values(s.clubs).forEach(c=>{
    c.playerIds=c.playerIds.filter(id=>{const p=s.players[id];return p&&!(p.age>=35&&rnd(hash(id+':retire:'+s.season))()<.62);});
    c.startingXI=c.startingXI.filter(id=>c.playerIds.includes(id));
    let n=0;
    while(c.playerIds.length<SQUAD){
      const id=c.id+'_youth_'+s.season+'_'+n,r=rnd(hash(id)),pos:Position=(['GK','DEF','MID','FWD'] as Position[])[n%4];
      const base=clamp(c.reputation-18+int(r,-4,10),35,78);
      const q:InternalSkills={speed:clamp(base+int(r,-4,8),25,92),passing:clamp(base+int(r,-4,8),25,92),shooting:clamp(base+int(r,-4,8)+(pos==='FWD'?7:0),20,93),tackling:clamp(base+int(r,-4,8)+(pos==='DEF'?7:0),20,93),goalkeeping:pos==='GK'?clamp(base+8,25,92):5,technique:clamp(base+int(r,-4,8),25,92),physical:clamp(base+int(r,-4,8),25,92)};
      const o=overall(q,pos);
      s.players[id]={id,name:firstNames[(s.season+n)%firstNames.length]+' '+lastNames[(s.season*2+n*3)%lastNames.length],age:int(r,17,20),position:pos,nationality:c.country,skills:publicSkills(q),overall:o,potential:clamp(o+int(r,10,20),o,97),marketValue:Math.max(100000,o*o*6000),wage:Math.max(400,o*12),fitness:100,morale:int(r,68,90),goals:0,assists:0,appearances:0,careerGoals:0,careerAssists:0,careerAppearances:0,transferListed:false};
      c.playerIds.push(id);n++;
    }
    c.startingXI=defaultXI(c.playerIds,s.players,c.formation);c.wageBill=c.playerIds.reduce((sum,id)=>sum+s.players[id].wage,0);
  });
  Object.values(s.leagues).forEach(l=>s.tables[l.id]=emptyTable(l.clubIds));
  s.managerReputation=clamp(s.managerReputation+(pos<=2?7:pos<=4?3:pos>=7?-3:0),1,100);
  s.season++;s.week=1;s.fixtures=fixturesFor(s.leagues,s.season);
  s.jobOffers=Object.values(s.clubs).filter(c=>c.id!==s.clubId&&c.reputation<=s.managerReputation+15).sort((a,b)=>Math.abs(a.reputation-s.managerReputation)-Math.abs(b.reputation-s.managerReputation)).slice(0,3).map(c=>({clubId:c.id,reason:c.reputation>s.clubs[s.clubId].reputation?'Новый проект':'Новая команда ищет тренера'}));
}
export function createCareer(managerName:string,clubId:string):GameState{
  const w=makeWorld();if(!w.clubs[clubId])throw new Error('Клуб не найден');const now=new Date().toISOString();
  return {saveVersion:3,careerId:'career_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),managerName:managerName.trim(),clubId,season:1,week:1,managerReputation:50,clubs:w.clubs,players:w.players,leagues:w.leagues,fixtures:fixturesFor(w.leagues,1),tables:w.tables,lastWeekResults:[],history:[],jobOffers:[],createdAt:now,updatedAt:now};
}
export function getLeague(s:GameState){return s.leagues[s.clubs[s.clubId].leagueId];}
export function getCurrentFixture(s:GameState){return s.fixtures.find(f=>f.round===s.week&&!f.played&&(f.homeTeamId===s.clubId||f.awayTeamId===s.clubId));}
export function getPosition(s:GameState,clubId=s.clubId){const rows=s.tables[s.clubs[clubId].leagueId]??[];return rows.findIndex(r=>r.teamId===clubId)+1;}
export function isTransferWindow(s:GameState){return WINDOWS.has(s.week);}
export function getMarketPlayers(s:GameState){return marketFromState(s);}
export function simulateNextWeek(s:GameState){
  const n=structuredClone(s) as GameState, results:MatchResult[]=[];
  n.fixtures.filter(f=>f.round===n.week&&!f.played).forEach((f,i)=>{
    const result=simulateMatch(n.clubs[f.homeTeamId],n.clubs[f.awayTeamId],n.players,hash(n.season+':'+n.week+':'+i+':'+f.id));
    f.played=true;f.result=result;results.push(result);n.tables[f.leagueId]=applyResult(n.tables[f.leagueId],result);
    [f.homeTeamId,f.awayTeamId].forEach(id=>{const c=n.clubs[id],gf=result.homeTeamId===id?result.homeGoals:result.awayGoals,ga=result.homeTeamId===id?result.awayGoals:result.homeGoals; c.budget=Math.max(0,c.budget+(gf>ga?70000:gf===ga?30000:10000)+(id===result.homeTeamId?25000:10000)-c.wageBill);c.playerIds.forEach(pid=>{const p=n.players[pid];if(!p)return;const started=c.startingXI.includes(pid);const fatigue= c.pressure==='HIGH'?11:c.pressure==='LOW'?7:9;p.fitness=clamp(p.fitness+(started?-fatigue:3),30,100);if(started){p.appearances++;p.careerAppearances++;}p.careerGoals+=result.events.filter(e=>e.playerId===pid).length;p.careerAssists+=result.events.filter(e=>e.assistPlayerId===pid).length;});});
  });
  aiTransfers(n);n.lastWeekResults=results;n.lastMatch=results.find(x=>x.homeTeamId===n.clubId||x.awayTeamId===n.clubId);n.week++;if(n.week>WEEKS)endSeason(n);n.updatedAt=new Date().toISOString();return n;
}
export function buyPlayer(s:GameState,id:string){
  if(!isTransferWindow(s))throw new Error('Трансферное окно закрыто');const n=structuredClone(s) as GameState,b=n.clubs[n.clubId],p=n.players[id];
  if(!p||!p.transferListed||b.playerIds.includes(id))throw new Error('Игрок недоступен');if(b.budget<p.marketValue)throw new Error('Недостаточно средств');if(b.playerIds.length>=SQUAD+2)throw new Error('Состав заполнен');
  const seller=Object.values(n.clubs).find(c=>c.playerIds.includes(id));if(!seller)throw new Error('Продавец не найден');
  seller.playerIds=seller.playerIds.filter(x=>x!==id);seller.startingXI=seller.startingXI.filter(x=>x!==id);seller.budget+=p.marketValue;b.playerIds.push(id);b.budget-=p.marketValue;p.transferListed=false;seller.startingXI=defaultXI(seller.playerIds,n.players,seller.formation);b.startingXI=defaultXI(b.playerIds,n.players,b.formation);seller.wageBill=seller.playerIds.reduce((sum,x)=>sum+n.players[x].wage,0);b.wageBill=b.playerIds.reduce((sum,x)=>sum+n.players[x].wage,0);return {...n,updatedAt:new Date().toISOString()};
}
export function sellPlayer(s:GameState,id:string){
  if(!isTransferWindow(s))throw new Error('Трансферное окно закрыто');const n=structuredClone(s) as GameState,c=n.clubs[n.clubId],p=n.players[id];
  if(!p||!c.playerIds.includes(id))throw new Error('Игрок не в вашем клубе');if(c.startingXI.includes(id))throw new Error('Сначала уберите игрока из основы');
  c.playerIds=c.playerIds.filter(x=>x!==id);c.budget+=p.marketValue;delete n.players[id];c.wageBill=c.playerIds.reduce((sum,x)=>sum+n.players[x].wage,0);return {...n,updatedAt:new Date().toISOString()};
}
export function updateFormation(s:GameState,formation:Club['formation']){
  const n=structuredClone(s) as GameState;n.clubs[n.clubId].formation=formation;n.clubs[n.clubId].startingXI=defaultXI(n.clubs[n.clubId].playerIds,n.players,n.clubs[n.clubId].formation);return {...n,updatedAt:new Date().toISOString()};
}
export function swapStartingPlayers(s:GameState,a:string,b:string){
  const n=structuredClone(s) as GameState,club=n.clubs[n.clubId],xi=club.startingXI;
  const i=xi.indexOf(a),j=xi.indexOf(b);
  if(i>=0&&j>=0)[xi[i],xi[j]]=[xi[j],xi[i]];
  else if(i>=0&&club.playerIds.includes(b))xi[i]=b;
  else if(j>=0&&club.playerIds.includes(a))xi[j]=a;
  return {...n,updatedAt:new Date().toISOString()};
}
export function updateTactics(s:GameState,mentality:TacticalMentality,pressure:TacticalPressure){
  const n=structuredClone(s) as GameState;
  const club=n.clubs[n.clubId];
  club.mentality=mentality;club.pressure=pressure;
  return {...n,updatedAt:new Date().toISOString()};
}
export function takeJob(s:GameState,clubId:string){if(!s.jobOffers.some(o=>o.clubId===clubId))throw new Error('Предложение недоступно');const n=structuredClone(s) as GameState;n.clubId=clubId;n.jobOffers=[];n.updatedAt=new Date().toISOString();return n;}
export function leaders(s:GameState,mode:'goals'|'assists'){return Object.values(s.players).filter(p=>p.careerAppearances>0).sort((a,b)=>(mode==='goals'?b.goals-a.goals:b.assists-a.assists)||b.overall-a.overall).slice(0,12);}

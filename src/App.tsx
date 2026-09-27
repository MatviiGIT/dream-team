import { useEffect, useMemo, useState } from 'react';
import type { GameState, Player, Club, Formation } from './domain/types';
import {
  buyPlayer,
  createCareer,
  getCurrentFixture,
  getLeague,
  getMarketPlayers,
  getPosition,
  isTransferWindow,
  leaders,
  simulateNextWeek,
  sellPlayer,
  swapStartingPlayers,
  takeJob,
  updateFormation,
} from './game/wsc';
import { deleteCareer, loadCareers, saveGame, type StoredCareer } from './storage/gameStorage';

type Screen='home'|'squad'|'transfers'|'competition'|'trophies';

function money(v:number){
  const n=Math.round(v);
  if(Math.abs(n)>=1_000_000)return '€'+(n/1_000_000).toFixed(n%1_000_000===0?0:1)+'M';
  if(Math.abs(n)>=1000)return '€'+Math.round(n/1000)+'K';
  return '€'+n;
}
function resultText(x:{homeTeamId:string;awayTeamId:string;homeGoals:number;awayGoals:number},clubs:Record<string,Club>){
  return (clubs[x.homeTeamId]?.shortName??'---')+' '+x.homeGoals+':'+x.awayGoals+' '+(clubs[x.awayTeamId]?.shortName??'---');
}
function Fullscreen(){
  const [on,setOn]=useState(false);
  useEffect(()=>{const f=()=>setOn(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',f);return()=>document.removeEventListener('fullscreenchange',f)},[]);
  return <button className="icon-btn" onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()} title="Fullscreen">{on?'⤢':'⛶'}</button>;
}

export default function App(){
  const [careers,setCareers]=useState<StoredCareer[]>(()=>loadCareers());
  const [game,setGame]=useState<GameState|null>(null);
  const [screen,setScreen]=useState<Screen>('home');
  const [showCareers,setShowCareers]=useState(false);
  const [creating,setCreating]=useState(false);
  const [manager,setManager]=useState('');
  const [country,setCountry]=useState('Germany');
  const [leagueLevel,setLeagueLevel]=useState<1|2>(1);
  const [selectedClub,setSelectedClub]=useState('');
  const [menu,setMenu]=useState(false);
  const [settings,setSettings]=useState(false);
  const [pending,setPending]=useState<GameState|null>(null);
  const [minute,setMinute]=useState(0);
  const [error,setError]=useState('');
  const [deleteId,setDeleteId]=useState<string|null>(null);

  const worldPreview=useMemo(()=> {
    if(!creating) return [];
    const temp=createCareer('Preview','club_ge_1_0');
    return Object.values(temp.clubs).filter(c=>c.country===country && Number(c.leagueId.slice(-1))===leagueLevel).sort((a,b)=>b.reputation-a.reputation);
  },[creating,country,leagueLevel]);

  useEffect(()=>{
    if(!pending) return;
    const timer=window.setInterval(()=>{
      setMinute(m=>{
        const next=Math.min(90,m+1);
        if(next>=90){
          window.setTimeout(()=>{
            setGame(pending);
            saveGame(pending);
            setCareers(loadCareers());
            setPending(null);
            setMinute(0);
          },450);
        }
        return next;
      });
    },65);
    return()=>window.clearInterval(timer);
  },[pending]);

  const createNew=()=>{
    try{
      const chosen=selectedClub||worldPreview[0]?.id;
      if(!chosen)throw new Error('Выберите клуб');
      const next=createCareer(manager||'Manager',chosen);
      saveGame(next);setCareers(loadCareers());setGame(next);setScreen('home');setShowCareers(false);setCreating(false);setMenu(false);setError('');
    }catch(e){setError(e instanceof Error?e.message:'Ошибка')}
  };
  const openCareer=(c:StoredCareer)=>{setGame(c.state);setScreen('home');setShowCareers(false);setCreating(false);setMenu(false);setError('')};
  const removeCareer=(id:string)=>{deleteCareer(id);setCareers(loadCareers());setDeleteId(null)};
  const advance=()=>{
    if(!game)return;
    try{
      const next=simulateNextWeek(game);
      setPending(next);setMinute(0);setError('');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось симулировать тур') }
  };
  const mutate=(fn:(s:GameState)=>GameState)=>{if(!game)return;try{const next=fn(game);setGame(next);saveGame(next);setCareers(loadCareers());setError('')}catch(e){setError(e instanceof Error?e.message:'Операция недоступна')}};

  if(!game){
    return <StartScreen
      careers={careers} showCareers={showCareers} creating={creating}
      manager={manager} country={country} leagueLevel={leagueLevel} selectedClub={selectedClub}
      preview={worldPreview} deleteId={deleteId} error={error} settings={settings}
      setShowCareers={setShowCareers} setCreating={setCreating} setManager={setManager}
      setCountry={setCountry} setLeagueLevel={setLeagueLevel} setSelectedClub={setSelectedClub}
      setDeleteId={setDeleteId} createNew={createNew} openCareer={openCareer} removeCareer={removeCareer}
      setSettings={setSettings} setError={setError}
    />;
  }

  if(pending){
    return <LiveMatch state={pending} minute={minute} onClose={()=>{setGame(pending);saveGame(pending);setCareers(loadCareers());setPending(null);setMinute(0)}} />;
  }

  return <div className="app">
    <header className="topbar">
      <button className="hamburger" onClick={()=>setMenu(true)}><i/><i/><i/></button>
      <div className="crest" style={{background:game.clubs[game.clubId].color}}>{game.clubs[game.clubId].shortName}</div>
      <div className="club-head"><strong>{game.clubs[game.clubId].name}</strong><span>{getLeague(game).name} · Season {game.season} · Week {game.week}</span></div>
      <div className="top-spacer"/>
      <div className="stat"><span>REPUTATION</span><b>{game.managerReputation}</b></div>
      <div className="stat"><span>MONEY</span><b>{money(game.clubs[game.clubId].budget)}</b></div>
      <Fullscreen/>
    </header>

    {error&&<div className="toast">{error}<button onClick={()=>setError('')}>×</button></div>}

    <main className="content">
      {screen==='home'&&<Home game={game} onScreen={setScreen} onPlay={advance}/>}
      {screen==='squad'&&<Squad game={game} onChange={next=>mutate(s=>swapStartingPlayers(s,next[0],next[1]))} onFormation={f=>mutate(s=>updateFormation(s,f))}/>}
      {screen==='transfers'&&<Transfers game={game} onBuy={id=>mutate(s=>buyPlayer(s,id))} onSell={id=>mutate(s=>sellPlayer(s,id))}/>}
      {screen==='competition'&&<Competition game={game}/>}
      {screen==='trophies'&&<Trophies game={game}/>}
    </main>

    {menu&&<SideMenu game={game} screen={screen} setScreen={setScreen} close={()=>setMenu(false)} onCareer={()=>{setGame(null);setMenu(false);setShowCareers(true)}}/>}
    {game.jobOffers.length>0&&screen==='home'&&<JobOffers game={game} onTake={id=>mutate(s=>takeJob(s,id))}/>}
  </div>;
}

function StartScreen(p:{
  careers:StoredCareer[];showCareers:boolean;creating:boolean;manager:string;country:string;leagueLevel:1|2;selectedClub:string;
  preview:Club[];deleteId:string|null;error:string;settings:boolean;
  setShowCareers:(v:boolean)=>void;setCreating:(v:boolean)=>void;setManager:(v:string)=>void;setCountry:(v:string)=>void;
  setLeagueLevel:(v:1|2)=>void;setSelectedClub:(v:string)=>void;setDeleteId:(v:string|null)=>void;
  createNew:()=>void;openCareer:(c:StoredCareer)=>void;removeCareer:(id:string)=>void;setSettings:(v:boolean)=>void;setError:(v:string)=>void;
}){
  return <div className="start">
    <div className="start-top"><strong>DREAM TEAM</strong><span>WORLD CAREER</span><div/><Fullscreen/></div>
    <section className="start-center">
      <div className="start-logo">DT</div>
      <h1>FOOTBALL<br/><em>CAREER</em></h1>
      <button className="play-btn" onClick={()=>p.setShowCareers(true)}>▶ PLAY</button>
      <div className="start-grid">
        <button onClick={()=>p.setShowCareers(true)}>▣<strong>CAREERS</strong><small>LOAD / CREATE</small></button>
        <button onClick={()=>p.setSettings(true)}>⚙<strong>SETTINGS</strong><small>GAME OPTIONS</small></button>
      </div>
      <small className="start-note">A standalone football career simulation built from scratch.</small>
    </section>

    {p.error&&<div className="start-error">{p.error}</div>}
    {p.settings&&<Modal title="SETTINGS" onClose={()=>p.setSettings(false)}>
      <div className="simple-settings"><span>GAME MODE</span><strong>CAREER SIMULATION</strong><span>MATCH MODE</span><strong>AUTOMATIC KEY MOMENTS</strong></div>
    </Modal>}

    {p.showCareers&&<div className="overlay"><div className="career-window">
      <header><div><small>CAREER</small><h2>{p.creating?'NEW CAREER':'SELECT CAREER'}</h2></div><button onClick={()=>{p.setShowCareers(false);p.setCreating(false)}}>×</button></header>
      {!p.creating ? <div className="career-body">
        <div className="career-list">
          {p.careers.length?p.careers.map((c,i)=><div className="career-row" key={c.id}>
            <span className="slot">{i+1}</span><div className="tiny-crest">DT</div>
            <div className="career-copy"><strong>{c.clubName}</strong><span>{c.managerName} · Season {c.state.season}</span><small>{c.state.week>1?'In progress':'New career'}</small></div>
            <button className="small-green" onClick={()=>p.openCareer(c)}>▶</button><button className="small-gray" onClick={()=>p.setDeleteId(c.id)}>×</button>
          </div>):<div className="empty">No saved careers</div>}
        </div>
        <footer><button className="primary" onClick={()=>p.setCreating(true)}>+ NEW CAREER</button></footer>
      </div> : <div className="new-career">
        <label>MANAGER NAME<input value={p.manager} onChange={e=>p.setManager(e.target.value)} placeholder="Manager"/></label>
        <div className="filters"><label>COUNTRY<select value={p.country} onChange={e=>{p.setCountry(e.target.value);p.setSelectedClub('')}}>{['England','Spain','Germany','Italy','France'].map(c=><option key={c}>{c}</option>)}</select></label>
        <label>DIVISION<select value={p.leagueLevel} onChange={e=>{p.setLeagueLevel(Number(e.target.value) as 1|2);p.setSelectedClub('')}}><option value={1}>Premier</option><option value={2}>Championship</option></select></label></div>
        <div className="club-picker">{p.preview.map(c=><button key={c.id} className={p.selectedClub===c.id?'selected':''} onClick={()=>p.setSelectedClub(c.id)}>
          <span className="club-dot" style={{background:c.color}}>{c.shortName}</span><strong>{c.name}</strong><small>OVR {Math.round(c.reputation)}</small>
        </button>)}</div>
        <footer><button className="secondary" onClick={()=>p.setCreating(false)}>BACK</button><button className="primary" onClick={p.createNew}>START CAREER</button></footer>
      </div>}
    </div></div>}

    {p.deleteId&&<Confirm title="DELETE CAREER?" text="The saved career will be removed from this browser." onNo={()=>p.setDeleteId(null)} onYes={()=>p.removeCareer(p.deleteId!)}/>}
  </div>;
}

function Home({game,onScreen,onPlay}:{game:GameState;onScreen:(x:Screen)=>void;onPlay:()=>void}){
  const club=game.clubs[game.clubId], league=getLeague(game), fixture=getCurrentFixture(game), position=getPosition(game);
  const opp=fixture?game.clubs[fixture.homeTeamId===club.id?fixture.awayTeamId:fixture.homeTeamId]:undefined;
  const roster=club.playerIds.map(id=>game.players[id]).filter(Boolean);
  const avg=Math.round(roster.reduce((s,p)=>s+p.overall,0)/Math.max(1,roster.length));
  const recent=game.lastWeekResults.slice(-5).reverse();
  return <div className="home-board">
    <div className="weekbar"><span>SEASON {game.season} · WEEK {game.week}</span><span>{position} PLACE · {game.tables[league.id]?.find(r=>r.teamId===club.id)?.points??0} PTS</span></div>
    <div className="board-grid">
      <section className="panel next">
        <div className="panel-title"><div><span>NEXT MATCH</span><strong>{opp?league.name:'SEASON COMPLETE'}</strong></div><b>›</b></div>
        {opp?<><button className="match-card" onClick={onPlay}><div><strong>{opp.name}</strong><span>{fixture?.homeTeamId===club.id?'HOME':'AWAY'} · ROUND {game.week}</span><div className="stars">★★★★★</div></div><div className="opponent" style={{background:opp.color}}>{opp.shortName}</div></button><button className="play-green" onClick={onPlay}>▶ PLAY MATCH</button></>:<div className="empty">No scheduled match.</div>}
      </section>

      <section className="panel team">
        <div className="panel-title"><div><span>TEAM MANAGEMENT</span><strong>{club.formation} · SQUAD {roster.length}</strong></div><button onClick={()=>onScreen('squad')}>›</button></div>
        <button className="team-summary" onClick={()=>onScreen('squad')}>
          <div className="mini-pitch"><i/><i/><i/><i/><i/><i/></div>
          <div><strong>TEAM OVR {avg}</strong><span>{club.name}</span><p>ENERGY {Math.round(roster.reduce((s,p)=>s+p.fitness,0)/Math.max(1,roster.length))}%</p></div>
        </button>
      </section>

      <section className="panel schedule"><div className="panel-title"><div><span>SCHEDULE</span><strong>UPCOMING FIXTURES</strong></div><button onClick={()=>onScreen('competition')}>›</button></div>
        <div className="schedule-list">{game.fixtures.filter(f=>!f.played&&f.round>=game.week).slice(0,6).map(f=>{const o=game.clubs[f.homeTeamId===club.id?f.awayTeamId:f.homeTeamId];return <div className="schedule-row" key={f.id}><b>W{f.round}</b><span>{f.homeTeamId===club.id?'H':'A'}</span><strong>{o.name}</strong><small>{f.homeTeamId===club.id?'HOME':'AWAY'}</small></div>})}</div>
      </section>

      <section className="market-mini">
        <button className="panel mini-buy" onClick={()=>onScreen('transfers')}><span>TRANSFERS</span><strong>BUY</strong><small>{isTransferWindow(game)?'WINDOW OPEN':'NEXT WINDOW W'+[...new Set([1,2,8,9])].find(x=>x>game.week)||'—'}</small></button>
        <button className="panel mini-buy" onClick={()=>onScreen('transfers')}><span>TRANSFERS</span><strong>SELL</strong><small>{club.playerIds.length} PLAYERS</small></button>
        <button className="panel mini-bottom" onClick={()=>onScreen('competition')}><span>COMPETITION</span><strong>TABLE</strong><small>{league.name}</small></button>
        <button className="panel mini-bottom" onClick={()=>onScreen('trophies')}><span>CAREER</span><strong>HONOURS</strong><small>{club.trophies} TROPHIES</small></button>
      </section>
    </div>
    {recent.length>0&&<div className="results-strip">{recent.map((r,i)=><span key={i}>{resultText(r,game.clubs)}</span>)}</div>}
  </div>;
}

function Squad({game,onChange,onFormation}:{game:GameState;onChange:(pair:[string,string])=>void;onFormation:(f:Formation)=>void}){
  const club=game.clubs[game.clubId], [first,setFirst]=useState('');
  const players=club.playerIds.map(id=>game.players[id]).filter(Boolean);
  const xi=club.startingXI;
  const choose=(id:string)=>{if(!first)setFirst(id);else{onChange([first,id]);setFirst('')}};
  return <section className="page"><div className="page-head"><div><span>SQUAD</span><h2>{club.name}</h2></div><div className="formation"><span>FORMATION</span>{(['4-3-3','4-4-2','4-2-3-1'] as Formation[]).map(f=><button className={club.formation===f?'active':''} key={f} onClick={()=>onFormation(f)}>{f}</button>)}</div></div>
    <div className="squad-layout">
      <div className="pitch"><div className="pitch-lines"/>{xi.map((id,i)=>{const p=game.players[id];return <button className={first===id?'player-dot picked':'player-dot'} key={id} onClick={()=>choose(id)}><b>{p?.overall??'?'}</b><span>{p?.name.split(' ')[0]}</span></button>})}</div>
      <div className="roster-table"><div className="roster-head"><span>PLAYER</span><b>SPD</b><b>PAS</b><b>SHO</b><b>TCK</b><b>GK</b><b>OVR</b></div>{players.map(p=><div className={xi.includes(p.id)?'roster-row starter':'roster-row'} key={p.id} onClick={()=>choose(p.id)}><div><strong>{p.name}</strong><small>{p.position} · {p.age} · {p.nationality}</small></div><b>{p.skills.speed}</b><b>{p.skills.passing}</b><b>{p.skills.shooting}</b><b>{p.skills.tackling}</b><b>{p.skills.goalkeeping}</b><b className="ovr">{p.overall}</b></div>)}</div>
    </div>
    <p className="hint">{first?'Select another player to swap positions.':'Click two players to swap their starting positions.'}</p>
  </section>;
}

function Transfers({game,onBuy,onSell}:{game:GameState;onBuy:(id:string)=>void;onSell:(id:string)=>void}){
  const [tab,setTab]=useState<'buy'|'sell'>('buy'), [q,setQ]=useState('');
  const market=getMarketPlayers(game),club=game.clubs[game.clubId];
  const list=tab==='buy'?market.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())):club.playerIds.map(id=>game.players[id]).filter(Boolean);
  return <section className="page"><div className="page-head"><div><span>TRANSFERS</span><h2>{isTransferWindow(game)?'TRANSFER WINDOW OPEN':'MARKET CLOSED'}</h2></div><div className="transfer-tabs"><button className={tab==='buy'?'active':''} onClick={()=>setTab('buy')}>BUY</button><button className={tab==='sell'?'active':''} onClick={()=>setTab('sell')}>SELL</button></div></div>
    <div className="transfer-bar"><span>FUNDS {money(club.budget)}</span><span>SQUAD {club.playerIds.length}/18</span>{tab==='buy'&&<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search player"/></div>
    <div className="transfer-list">{list.map(p=><div className="transfer-row" key={p.id}><div className="transfer-player"><strong>{p.name}</strong><span>{p.position} · {p.age} · {p.nationality}</span></div><b>{p.overall}</b><span>{money(p.marketValue)}</span><span>{money(p.wage)}/week</span><button className={tab==='buy'?'action green':'action gray'} onClick={()=>tab==='buy'?onBuy(p.id):onSell(p.id)}>{tab==='buy'?'BUY':'SELL'}</button></div>)}{!list.length&&<div className="empty">No players available.</div>}</div>
  </section>;
}

function Competition({game}:{game:GameState}){
  const [tab,setTab]=useState<'table'|'goals'|'assists'>('table'), l=getLeague(game),rows=game.tables[l.id]??[], top=leaders(game,tab==='assists'?'assists':'goals');
  return <section className="page"><div className="page-head"><div><span>COMPETITION</span><h2>{l.name}</h2></div><div className="transfer-tabs">{(['table','goals','assists'] as const).map(t=><button className={tab===t?'active':''} key={t} onClick={()=>setTab(t)}>{t==='table'?'TABLE':t==='goals'?'SCORERS':'ASSISTS'}</button>)}</div></div>
  {tab==='table'?<div className="league-table"><div className="table-head"><span>#</span><span>CLUB</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GF</span><span>GA</span><span>GD</span><span>PTS</span></div>{rows.map((r,i)=>{const c=game.clubs[r.teamId];return <div className={r.teamId===game.clubId?'table-row yours':'table-row'} key={r.teamId}><b>{i+1}</b><strong>{c.name}</strong><span>{r.played}</span><span>{r.wins}</span><span>{r.draws}</span><span>{r.losses}</span><span>{r.goalsFor}</span><span>{r.goalsAgainst}</span><span>{r.goalsFor-r.goalsAgainst}</span><b>{r.points}</b></div>})}</div>
  :<div className="leader-list">{top.map((p,i)=>{const c=Object.values(game.clubs).find(x=>x.playerIds.includes(p.id));return <div className="leader-row" key={p.id}><span>{i+1}</span><div><strong>{p.name}</strong><small>{c?.shortName??'—'} · {p.position} · {p.age}</small></div><b>{tab==='goals'?p.goals:p.assists}</b></div>})}</div>}</section>;
}

function Trophies({game}:{game:GameState}){
  const club=game.clubs[game.clubId];
  return <section className="page"><div className="page-head"><div><span>CAREER</span><h2>HONOURS & HISTORY</h2></div></div><div className="honours"><div className="honour-box"><strong>{club.trophies}</strong><span>LEAGUE TROPHIES</span></div><div className="honour-box"><strong>{game.history.length}</strong><span>SEASONS COMPLETED</span></div><div className="honour-box"><strong>{game.managerReputation}</strong><span>MANAGER REP</span></div></div><div className="history">{game.history.length?game.history.slice().reverse().map(h=><div key={h.season}><b>SEASON {h.season}</b><span>{h.clubName}</span><small>{h.leagueName} · {h.position} PLACE</small></div>):<div className="empty">Your career history will appear here.</div>}</div></section>;
}

function LiveMatch({state,minute,onClose}:{state:GameState;minute:number;onClose:()=>void}){
  const result=state.lastMatch;if(!result)return null;
  const home=state.clubs[result.homeTeamId],away=state.clubs[result.awayTeamId],visible=result.events.filter(e=>e.type==='goal'&&e.minute<=minute);
  const shownHome=visible.filter(e=>e.teamId===home.id).length,shownAway=visible.filter(e=>e.teamId===away.id).length;
  return <div className="live-screen"><header><span>LIVE MATCH</span><strong>SEASON {state.season} · ROUND {Math.max(1,state.week-1)}</strong></header><main><div className="score"><div><span>{home.name}</span><b>{shownHome}</b></div><em>90'</em><div><span>{away.name}</span><b>{shownAway}</b></div></div><div className="live-progress"><i style={{width:(minute/90*100)+'%'}}/></div><div className="live-minute">{minute}'</div><div className="events">{result.events.filter(e=>e.type==='goal'&&e.minute<=minute).map((e,i)=><div key={i}><b>{e.minute}'</b><span>⚽ {e.teamId===home.id?home.shortName:away.shortName} · {state.players[e.playerId??'']?.name??'Goal'}</span></div>)}</div>{minute>=90&&<button className="primary close-live" onClick={onClose}>CONTINUE</button>}</main></div>;
}

function SideMenu({game,screen,setScreen,close,onCareer}:{game:GameState;screen:Screen;setScreen:(s:Screen)=>void;close:()=>void;onCareer:()=>void}){
  const item=(s:Screen,label:string,icon:string)=><button className={screen===s?'active':''} onClick={()=>{setScreen(s);close()}}><i>{icon}</i><strong>{label}</strong><b>›</b></button>;
  return <div className="side-backdrop" onClick={close}><aside className="side-menu" onClick={e=>e.stopPropagation()}><header><div><span>CAREER</span><strong>{game.clubs[game.clubId].shortName}</strong></div><button onClick={close}>×</button></header><nav>{item('home','MAIN SCREEN','⌂')}{item('squad','SQUAD','♟')}{item('transfers','TRANSFERS','↗')}{item('competition','COMPETITION','▤')}{item('trophies','HONOURS','★')}</nav><footer><button onClick={onCareer}>CAREER SELECTION</button></footer></aside></div>;
}
function JobOffers({game,onTake}:{game:GameState;onTake:(id:string)=>void}){
  return <div className="job-overlay"><div className="job-window"><header><span>CAREER</span><h2>JOB OFFERS</h2><p>Your manager reputation opened new opportunities.</p></header>{game.jobOffers.map(o=>{const c=game.clubs[o.clubId];return <button className="job-row" key={o.clubId} onClick={()=>onTake(o.clubId)}><span className="club-dot" style={{background:c.color}}>{c.shortName}</span><div><strong>{c.name}</strong><small>{getLeague({...game,clubId:c.id}).name}</small><em>{o.reason}</em></div><b>›</b></button>})}</div></div>;
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="overlay"><div className="modal"><header><h2>{title}</h2><button onClick={onClose}>×</button></header>{children}</div></div>}
function Confirm({title,text,onNo,onYes}:{title:string;text:string;onNo:()=>void;onYes:()=>void}){return <Modal title={title} onClose={onNo}><p className="confirm-text">{text}</p><div className="confirm-actions"><button className="secondary" onClick={onNo}>CANCEL</button><button className="danger" onClick={onYes}>DELETE</button></div></Modal>}


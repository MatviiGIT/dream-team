import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GameState, Player, Club, Formation, TacticalMentality, TacticalPressure } from './domain/types';
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
  updateTactics,
} from './game/wsc';
import { deleteCareer, loadCareers, saveGame, type StoredCareer } from './storage/gameStorage';

type Screen='home'|'squad'|'transfers'|'competition'|'schedule'|'news'|'coach'|'trophies'|'team';

const FORMATIONS: Formation[]=[
  '4-3-3','4-4-2','4-2-3-1','4-5-1','3-5-2','3-4-3','5-3-2','5-4-1','4-1-4-1','3-4-2-1'
];

const FORMATION_ROLE_LABELS: Record<Formation,string[]> = {
  '4-3-3':['GK','LB','CB','CB','RB','CM','DM','CM','LW','CF','RW'],
  '4-4-2':['GK','LB','CB','CB','RB','LM','CM','CM','RM','CF','CF'],
  '4-2-3-1':['GK','LB','CB','CB','RB','DM','DM','LW','AM','RW','CF'],
  '4-5-1':['GK','LB','CB','CB','RB','LM','CM','DM','CM','RM','CF'],
  '3-5-2':['GK','CB','CB','CB','LM','CM','DM','CM','RM','CF','CF'],
  '3-4-3':['GK','CB','CB','CB','LM','CM','CM','RM','LW','CF','RW'],
  '5-3-2':['GK','LWB','CB','CB','CB','RWB','CM','DM','CM','CF','CF'],
  '5-4-1':['GK','LWB','CB','CB','CB','RWB','LM','CM','CM','RM','CF'],
  '4-1-4-1':['GK','LB','CB','CB','RB','DM','LM','CM','CM','RM','CF'],
  '3-4-2-1':['GK','CB','CB','CB','LM','CM','CM','RM','AM','AM','CF'],
};

const PITCH_LAYOUTS: Record<Formation, Array<[number,number]>>={
  '4-3-3':[[50,90],[14,68],[37,72],[63,72],[86,68],[25,47],[50,44],[75,47],[18,20],[50,13],[82,20]],
  '4-4-2':[[50,90],[14,68],[37,72],[63,72],[86,68],[14,48],[37,46],[63,46],[86,48],[38,20],[62,20]],
  '4-2-3-1':[[50,90],[14,68],[37,72],[63,72],[86,68],[34,53],[66,53],[18,31],[50,27],[82,31],[50,12]],
  '4-5-1':[[50,90],[14,68],[37,72],[63,72],[86,68],[12,49],[31,46],[50,44],[69,46],[88,49],[50,12]],
  '3-5-2':[[50,90],[25,70],[50,73],[75,70],[12,49],[31,46],[50,44],[69,46],[88,49],[38,19],[62,19]],
  '3-4-3':[[50,90],[24,70],[50,73],[76,70],[14,49],[37,46],[63,46],[86,49],[18,20],[50,13],[82,20]],
  '5-3-2':[[50,90],[10,68],[28,70],[50,72],[72,70],[90,68],[27,47],[50,44],[73,47],[38,19],[62,19]],
  '5-4-1':[[50,90],[10,68],[28,70],[50,72],[72,70],[90,68],[16,48],[38,46],[62,46],[84,48],[50,12]],
  '4-1-4-1':[[50,90],[14,68],[37,72],[63,72],[86,68],[50,58],[16,44],[38,42],[62,42],[84,44],[50,12]],
  '3-4-2-1':[[50,90],[24,70],[50,73],[76,70],[15,49],[38,46],[62,46],[85,49],[39,29],[61,29],[50,12]],
};

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
  const [selectedTeamId,setSelectedTeamId]=useState('');
  const [menu,setMenu]=useState(false);
  const [settings,setSettings]=useState(false);
  const [howTo,setHowTo]=useState(false);
  const [pending,setPending]=useState<GameState|null>(null);
  const [minute,setMinute]=useState(0);
  const [error,setError]=useState('');
  const [deleteId,setDeleteId]=useState<string|null>(null);

  const worldPreview=useMemo(()=>{
    if(!creating)return [];
    const temp=createCareer('Preview','club_ge_1_0');
    return Object.values(temp.clubs)
      .filter(c=>c.country===country&&Number(c.leagueId.slice(-1))===leagueLevel)
      .sort((a,b)=>b.reputation-a.reputation);
  },[creating,country,leagueLevel]);

  useEffect(()=>{
    if(!pending)return;
    const timer=window.setInterval(()=>setMinute(m=>Math.min(90,m+1)),65);
    return()=>window.clearInterval(timer);
  },[pending]);

  useEffect(()=>{
    if(!pending||minute<90)return;
    const timer=window.setTimeout(()=>{
      setGame(pending);saveGame(pending);setCareers(loadCareers());setPending(null);setMinute(0);
    },450);
    return()=>window.clearTimeout(timer);
  },[pending,minute]);

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
    try{setPending(simulateNextWeek(game));setMinute(0);setError('')}
    catch(e){setError(e instanceof Error?e.message:'Не удалось симулировать тур')}
  };
  const mutate=(fn:(s:GameState)=>GameState)=>{
    if(!game)return;
    try{const next=fn(game);setGame(next);saveGame(next);setCareers(loadCareers());setError('')}
    catch(e){setError(e instanceof Error?e.message:'Операция недоступна')}
  };

  if(!game){
    return <StartScreen
      careers={careers} showCareers={showCareers} creating={creating} manager={manager}
      country={country} leagueLevel={leagueLevel} selectedClub={selectedClub} preview={worldPreview}
      deleteId={deleteId} error={error} settings={settings} howTo={howTo}
      setShowCareers={setShowCareers} setCreating={setCreating} setManager={setManager}
      setCountry={setCountry} setLeagueLevel={setLeagueLevel} setSelectedClub={setSelectedClub}
      setDeleteId={setDeleteId} createNew={createNew} openCareer={openCareer} removeCareer={removeCareer}
      setSettings={setSettings} setHowTo={setHowTo} setError={setError}
    />;
  }

  if(pending){
    return <LiveMatch state={pending} minute={minute} onClose={()=>{setGame(pending);saveGame(pending);setCareers(loadCareers());setPending(null);setMinute(0)}} />;
  }

  const club=game.clubs[game.clubId];

  return <div className="app">
    <header className="topbar">
      <button className="hamburger" onClick={()=>setMenu(true)} aria-label="Open menu"><i/><i/><i/></button>
      <div className="crest" style={{background:club.color}}>{club.shortName}</div>
      <div className="club-head"><strong>{club.name}</strong><span>{getLeague(game).name} · Year {game.season} · Week {game.week}</span></div>
      <div className="top-spacer"/>
      <div className="status-chip"><span>MONEY</span><b>{money(club.budget)}</b></div>
      <div className="status-chip"><span>SQUAD</span><b>{club.playerIds.length}/18</b></div>
      <Fullscreen/>
    </header>

    {error&&<div className="toast">{error}<button onClick={()=>setError('')}>×</button></div>}

    <main className="content">
      {screen==='home'&&<Home game={game} onScreen={setScreen} onPlay={advance}/>}
      {screen==='squad'&&<Squad game={game} onHome={()=>setScreen('home')} onChange={next=>mutate(s=>swapStartingPlayers(s,next[0],next[1]))} onFormation={f=>mutate(s=>updateFormation(s,f))} onTactics={(m,p)=>mutate(s=>updateTactics(s,m,p))}/>}
      {screen==='transfers'&&<Transfers game={game} onHome={()=>setScreen('home')} onBuy={id=>mutate(s=>buyPlayer(s,id))} onSell={id=>mutate(s=>sellPlayer(s,id))}/>}
      {screen==='competition'&&<Competition game={game} onHome={()=>setScreen('home')} onTeam={id=>{setSelectedTeamId(id);setScreen('team')}}/>}
      {screen==='schedule'&&<Schedule game={game} onHome={()=>setScreen('home')} onTeam={id=>{setSelectedTeamId(id);setScreen('team')}}/>}
      {screen==='news'&&<NewsScreen game={game} onHome={()=>setScreen('home')}/>}
      {screen==='team'&&<TeamViewer game={game} teamId={selectedTeamId||game.clubId} onBack={()=>setScreen('competition')}/>}
      {screen==='coach'&&<CoachRoom game={game} onHome={()=>setScreen('home')} onScreen={setScreen}/>}
      {screen==='trophies'&&<Trophies game={game} onHome={()=>setScreen('home')}/>}
    </main>

    {menu&&<CareerExitMenu club={club} close={()=>setMenu(false)} onCareer={()=>{setGame(null);setMenu(false);setShowCareers(true)}}/>}
    {game.jobOffers.length>0&&screen==='home'&&<JobOffers game={game} onTake={id=>mutate(s=>takeJob(s,id))}/>}
  </div>;
}

function StartScreen(p:{
  careers:StoredCareer[];showCareers:boolean;creating:boolean;manager:string;country:string;leagueLevel:1|2;selectedClub:string;
  preview:Club[];deleteId:string|null;error:string;settings:boolean;howTo:boolean;
  setShowCareers:(v:boolean)=>void;setCreating:(v:boolean)=>void;setManager:(v:string)=>void;setCountry:(v:string)=>void;
  setLeagueLevel:(v:1|2)=>void;setSelectedClub:(v:string)=>void;setDeleteId:(v:string|null)=>void;
  createNew:()=>void;openCareer:(c:StoredCareer)=>void;removeCareer:(id:string)=>void;
  setSettings:(v:boolean)=>void;setHowTo:(v:boolean)=>void;setError:(v:string)=>void;
}){
  return <div className="start-wsc">
    <div className="start-top-wsc">
      <div className="start-brand"><strong>DREAM TEAM</strong><span>FOOTBALL CAREER</span></div>
      <div className="start-top-space"/>
      <button className="start-top-icon" onClick={()=>p.setHowTo(true)}>?</button>
      <button className="start-top-icon" onClick={()=>p.setSettings(true)}>⚙</button>
      <Fullscreen/>
    </div>

    <div className="start-decoration left"><i/><i/><i/><i/><i/></div>
    <div className="start-decoration right"><i/><i/><i/><i/></div>

    <section className="start-menu-layout">
      <div className="start-intro"><small>THE MANAGER'S GAME</small><h1>DREAM<br/><em>TEAM</em></h1><p>Build a squad. Shape a club. Build your career.</p></div>
      <div className="start-menu-stack">
        <button className="wsc-main-menu-btn primary-big" onClick={()=>p.setShowCareers(true)}><span>▶</span><strong>PLAY</strong></button>
        <button className="wsc-main-menu-btn" onClick={()=>p.setShowCareers(true)}><span>▣</span><strong>CAREER</strong><small>LOAD OR START A CAREER</small></button>
        <button className="wsc-main-menu-btn" onClick={()=>p.setHowTo(true)}><span>?</span><strong>HOW TO PLAY</strong><small>CONTROLS AND GAME FLOW</small></button>
        <button className="wsc-main-menu-btn" onClick={()=>p.setSettings(true)}><span>⚙</span><strong>SETTINGS</strong><small>DISPLAY AND GAME OPTIONS</small></button>
      </div>
    </section>

    {p.showCareers&&<div className="career-overlay-wsc">
      <div className="career-window-wsc">
        <header><div><small>CAREER</small><h2>{p.creating?'CHOOSE YOUR TEAM':'SELECT CAREER'}</h2></div><button onClick={()=>{p.setShowCareers(false);p.setCreating(false)}}>×</button></header>

        {!p.creating ? <div className="career-select-body">
          <div className="career-save-list">
            {p.careers.length?p.careers.map((c,i)=>{
              const sc=c.state.clubs[c.state.clubId];
              return <div className="career-save-row" key={c.id}>
                <span className="save-index">{i+1}</span>
                <span className="save-crest" style={{background:sc?.color}}>{sc?.shortName??'DT'}</span>
                <div><strong>{c.clubName}</strong><span>{c.managerName}</span><small>YEAR {c.state.season} · WEEK {c.state.week} · {c.state.managerReputation} REP</small></div>
                <button className="save-play" onClick={()=>p.openCareer(c)}>▶</button>
                <button className="save-delete" onClick={()=>p.setDeleteId(c.id)}>×</button>
              </div>;
            }):<div className="career-empty"><strong>NO SAVED CAREERS</strong><span>Create your first manager career.</span></div>}
          </div>
          <footer><button className="wsc-gray-btn" onClick={()=>p.setShowCareers(false)}>BACK</button><button className="wsc-green-btn" onClick={()=>p.setCreating(true)}>NEW CAREER</button></footer>
        </div> : <div className="choose-team-body">
          <div className="manager-row"><label>MANAGER NAME<input value={p.manager} onChange={e=>p.setManager(e.target.value)} placeholder="Manager"/></label></div>
          <div className="choose-filters">
            <label>COUNTRY<select value={p.country} onChange={e=>{p.setCountry(e.target.value);p.setSelectedClub('')}}>{['England','Spain','Germany','Italy','France','Netherlands','Portugal','Belgium','Turkey','Austria','Scotland','Denmark'].map(c=><option key={c}>{c}</option>)}</select></label>
            <label>DIVISION<select value={p.leagueLevel} onChange={e=>{p.setLeagueLevel(Number(e.target.value) as 1|2);p.setSelectedClub('')}}><option value={1}>FIRST DIVISION</option><option value={2}>SECOND DIVISION</option></select></label>
          </div>
          <div className="choose-team-title"><span>TEAM</span><span>RATING</span><span>BUDGET</span></div>
          <div className="choose-team-list">
            {p.preview.map(c=><button key={c.id} className={p.selectedClub===c.id?'chosen':''} onClick={()=>p.setSelectedClub(c.id)}>
              <span className="choose-club-crest" style={{background:c.color}}>{c.shortName}</span>
              <span className="choose-club-name"><strong>{c.name}</strong><small>{c.country} · {c.leagueId.endsWith('1')?'Premier':'Championship'}</small></span>
              <span className="choose-club-rating">{c.reputation}</span>
              <span className="choose-club-budget">{money(c.budget)}</span>
            </button>)}
          </div>
          <footer><button className="wsc-gray-btn" onClick={()=>p.setCreating(false)}>BACK</button><button className="wsc-green-btn" onClick={p.createNew}>START CAREER</button></footer>
        </div>}
      </div>
    </div>}

    {p.settings&&<Modal title="SETTINGS" onClose={()=>p.setSettings(false)}><div className="simple-settings"><span>GAME MODE</span><strong>CAREER</strong><span>MATCH MODE</span><strong>KEY MOMENTS / AUTOMATIC SIMULATION</strong><span>DISPLAY</span><strong>FULLSCREEN READY</strong></div></Modal>}
    {p.howTo&&<Modal title="HOW TO PLAY" onClose={()=>p.setHowTo(false)}><div className="howto-copy"><p>Prepare your lineup, manage transfers and advance the season from the main screen.</p><p>Click two players on the squad screen to swap them. Use the formation selector to change the shape.</p><p>Matches progress automatically minute by minute and the world continues to evolve season after season.</p></div></Modal>}
    {p.error&&<div className="start-error">{p.error}</div>}
    {p.deleteId&&<Confirm title="DELETE CAREER?" text="The saved career will be removed from this browser." onNo={()=>p.setDeleteId(null)} onYes={()=>p.removeCareer(p.deleteId!)}/>}
  </div>;
}

function Home({game,onScreen,onPlay}:{game:GameState;onScreen:(x:Screen)=>void;onPlay:()=>void}){
  const club=game.clubs[game.clubId],league=getLeague(game),fixture=getCurrentFixture(game),position=getPosition(game);
  const tableRow=game.tables[league.id]?.find(r=>r.teamId===club.id);
  const opp=fixture?game.clubs[fixture.homeTeamId===club.id?fixture.awayTeamId:fixture.homeTeamId]:undefined;
  const roster=club.playerIds.map(id=>game.players[id]).filter(Boolean);
  const energy=Math.round(roster.reduce((s,p)=>s+p.fitness,0)/Math.max(1,roster.length));
  const avg=Math.round(roster.reduce((s,p)=>s+p.overall,0)/Math.max(1,roster.length));
  const last=game.lastMatch;
  const news=[
    last?resultText(last,game.clubs):'Club ready for the opening week.',
    isTransferWindow(game)?'Transfer window is open. Clubs are active in the market.':'The football world is preparing for the next round.',
    game.jobOffers.length?'Your reputation has attracted new job offers.':game.managerReputation>=60?'Your manager reputation is growing.':'Board expectations remain focused on league progress.',
  ];
  const upcoming=game.fixtures.filter(f=>!f.played&&f.round>=game.week).slice(0,5);
  return <div className="home-board">
    <div className="weekbar"><span>YEAR {game.season} · WEEK {game.week}</span><span>{position} PLACE · {tableRow?.points??0} PTS · {energy}% ENERGY</span></div>
    <div className="board-grid board-grid-wsc">

      <section className="panel next">
        <div className="panel-title"><div><span>NEXT MATCH</span><strong>{opp?league.name:'SEASON COMPLETE'}</strong></div><b>›</b></div>
        {opp?<><button className="match-card" onClick={onPlay}><div><strong>{opp.name}</strong><span>{fixture?.homeTeamId===club.id?'HOME':'AWAY'} · GAME {game.week}</span><div className="match-ratings"><b>DEF {Math.max(1,Math.round(opp.reputation*.82))}</b><b>MID {Math.max(1,Math.round(opp.reputation*.86))}</b><b>ATT {Math.max(1,Math.round(opp.reputation*.89))}</b></div><div className="stars">★★★★★</div></div><div className="opponent" style={{background:opp.color}}>{opp.shortName}</div></button><button className="play-green" onClick={onPlay}>▶ PLAY MATCH</button></>:<div className="empty">No scheduled match.</div>}
      </section>

      <section className="panel team">
        <div className="panel-title"><div><span>TEAM MANAGEMENT</span><strong>Energy {energy}% · {club.formation}</strong></div><button onClick={()=>onScreen('squad')}>›</button></div>
        <button className="team-summary" onClick={()=>onScreen('squad')}>
          <div className="mini-tactics-pitch"><i/><i/><i/><i/><i/><i/><i/><i/></div>
          <div><strong>DEF {Math.round(avg*.98)}</strong><strong>MID {avg}</strong><strong>ATT {Math.round(avg*1.02)}</strong><span>{club.name}</span></div>
        </button>
      </section>

      <section className="panel schedule">
        <div className="panel-title"><div><span>SCHEDULE</span><strong>UPCOMING GAMES</strong></div><button onClick={()=>onScreen('schedule')}>›</button></div>
        <div className="schedule-list">{upcoming.map(f=>{const o=game.clubs[f.homeTeamId===club.id?f.awayTeamId:f.homeTeamId];return <div className="schedule-row" key={f.id}><b>Week {f.round}</b><span>{f.homeTeamId===club.id?'H':'A'}</span><strong>{o.name}</strong><small>{f.homeTeamId===club.id?'HOME':'AWAY'}</small></div>})}</div>
      </section>

      <section className="panel news-board">
        <div className="panel-title"><div><span>NEWS</span><strong>CLUB NEWS</strong></div><button onClick={()=>onScreen('news')}>›</button></div>
        <div className="news-list">{news.map((item,i)=><button key={i} onClick={()=>onScreen('news')}><b>{i===0?'RESULT':i===1?'WORLD':'MANAGER'}</b><span>{item}</span></button>)}</div>
      </section>

      <section className="market-mini">
        <button className="panel mini-buy" onClick={()=>onScreen('transfers')}><span>TRANSFERS</span><strong>BUY</strong><small>{isTransferWindow(game)?'WINDOW OPEN':'MARKET CLOSED'}</small></button>
        <button className="panel mini-buy" onClick={()=>onScreen('transfers')}><span>TRANSFERS</span><strong>SELL</strong><small>{club.playerIds.length} PLAYERS</small></button>
      </section>

      <section className="bottom-mini">
        <button className="panel mini-bottom" onClick={()=>onScreen('coach')}><span>COACH ROOM</span><strong>{game.managerName.toUpperCase()}</strong><small>REPUTATION {game.managerReputation}</small></button>
        <button className="panel mini-bottom" onClick={()=>onScreen('competition')}><span>COMPETITION</span><strong>TABLE</strong><small>{league.name}</small></button>
        <button className="panel mini-bottom" onClick={()=>onScreen('trophies')}><span>HONOURS</span><strong>{club.trophies}</strong><small>TROPHIES</small></button>
      </section>
    </div>
  </div>;
}

function Squad({game,onHome,onChange,onFormation,onTactics}:{game:GameState;onHome:()=>void;onChange:(pair:[string,string])=>void;onFormation:(f:Formation)=>void;onTactics:(mentality:TacticalMentality,pressure:TacticalPressure)=>void}){
  const club=game.clubs[game.clubId],[first,setFirst]=useState(''),[selected,setSelected]=useState('');
  const players=club.playerIds.map(id=>game.players[id]).filter(Boolean) as Player[];
  const xi=club.startingXI, layout=PITCH_LAYOUTS[club.formation];
  const mentality=club.mentality??'NEUTRAL',pressure=club.pressure??'NORMAL';
  const choose=(id:string)=>{setSelected(id);if(!first)setFirst(id);else{onChange([first,id]);setFirst('')}};
  const cycleMentality=()=>{const v:TacticalMentality=mentality==='DEFENSIVE'?'NEUTRAL':mentality==='NEUTRAL'?'ATTACKING':'DEFENSIVE';onTactics(v,pressure)};
  const cyclePressure=()=>{const v:TacticalPressure=pressure==='LOW'?'NORMAL':pressure==='NORMAL'?'HIGH':'LOW';onTactics(mentality,v)};
  const focus=selected?game.players[selected]:undefined;
  const bench=players.filter(p=>!xi.includes(p.id));
  return <section className="page squad-page">
    <div className="page-head squad-head">
      <div><button className="page-home-btn" onClick={onHome}>‹ MAIN</button><div><span>TEAM MANAGEMENT</span><h2>{club.name}</h2></div></div>
      <div className="formation-picker"><button className="formation-arrow" onClick={()=>onFormation(FORMATIONS[(FORMATIONS.indexOf(club.formation)-1+FORMATIONS.length)%FORMATIONS.length] )}>‹</button><strong>{club.formation}</strong><button className="formation-arrow" onClick={()=>onFormation(FORMATIONS[(FORMATIONS.indexOf(club.formation)+1)%FORMATIONS.length] )}>›</button></div>
    </div>
    <div className="formation-strip">{FORMATIONS.map(f=><button key={f} className={club.formation===f?'active':''} onClick={()=>onFormation(f)}>{f}</button>)}</div>
    <div className="squad-layout-wsc">
      <div className="pitch-wsc">
        <svg className="pitch-svg" viewBox="0 0 600 780" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="pitch-grass" width="600" height="96" patternUnits="userSpaceOnUse">
              <rect width="600" height="96" fill="#1b6b34"/>
              <rect width="600" height="48" fill="#20753a"/>
            </pattern>
          </defs>
          <polygon points="58,8 542,8 578,772 22,772" fill="url(#pitch-grass)"/>
          <path d="M58 8 L542 8 L578 772 L22 772 Z" fill="none" stroke="rgba(255,255,255,.72)" stroke-width="4"/>
          <path d="M35 390 L565 390" fill="none" stroke="rgba(255,255,255,.66)" stroke-width="3"/>
          <circle cx="300" cy="390" r="52" fill="none" stroke="rgba(255,255,255,.66)" stroke-width="3"/>
          <circle cx="300" cy="390" r="4" fill="rgba(255,255,255,.82)"/>
          <path d="M112 8 L488 8 L500 180 L100 180 Z" fill="none" stroke="rgba(255,255,255,.64)" stroke-width="4"/>
          <path d="M100 180 Q300 285 500 180" fill="none" stroke="rgba(255,255,255,.64)" stroke-width="4"/>
          <path d="M182 8 L418 8 L422 82 L178 82 Z" fill="none" stroke="rgba(255,255,255,.64)" stroke-width="4"/>
          <path d="M100 600 Q300 495 500 600" fill="none" stroke="rgba(255,255,255,.64)" stroke-width="4"/>
          <path d="M100 600 L112 772 L488 772 L500 600 Z" fill="none" stroke="rgba(255,255,255,.64)" stroke-width="4"/>
          <path d="M178 698 L182 772 L418 772 L422 698 Z" fill="none" stroke="rgba(255,255,255,.64)" stroke-width="4"/>
          <rect x="255" y="0" width="90" height="12" fill="none" stroke="rgba(255,255,255,.82)" stroke-width="4"/>
          <rect x="255" y="768" width="90" height="12" fill="none" stroke="rgba(255,255,255,.82)" stroke-width="4"/>
        </svg>
        {xi.map((id,i)=>{const player=game.players[id],xy=layout[i]??[50,50],role=FORMATION_ROLE_LABELS[club.formation][i]??player?.position??'—';return <button key={id} className={['player-dot-wsc',role==='GK'?'gk':'',first===id?'picked':''].filter(Boolean).join(' ')} style={{left:xy[0]+'%',top:xy[1]+'%'}} onClick={()=>choose(id)}><b>{player?.overall??'?'}</b><span>{role}</span><small>{player?.name.split(' ')[0]??'Player'}</small></button>})}
      </div>
      <div className="squad-side-wsc">
        <div className="player-focus-wsc">
          <div className="focus-title">PLAYER DETAILS</div>
          {focus?<div className="focus-card-wsc"><div className="focus-avatar">{focus.overall}</div><div><strong>{focus.name}</strong><span>{focus.position} · {focus.age} · {focus.nationality}</span><small>SPD {focus.skills.speed} · PASS {focus.skills.passing} · SHOT {focus.skills.shooting}</small><small>TCKL {focus.skills.tackling} · GK {focus.skills.goalkeeping}</small></div></div>:<div className="focus-empty">Select a player. Select a second player to swap him with the first.</div>}
        </div>
        <div className="bench-wsc">
          <div className="bench-title"><span>SUBSTITUTES</span><b>{bench.length}</b></div>
          <div className="bench-grid-wsc">{bench.slice(0,8).map(p=><button key={p.id} className={first===p.id?'bench-player-wsc picked':'bench-player-wsc'} onClick={()=>choose(p.id)}><b>{p.overall}</b><span>{p.name.split(' ')[0]}</span><small>{p.position}</small></button>)}</div>
        </div>
        <div className="roster-table-wsc">
          <div className="roster-head-wsc"><span>PLAYER</span><b>SPD</b><b>PASS</b><b>SHOT</b><b>TCKL</b><b>GK</b><b>OVR</b></div>
          {players.map(p=><button className={xi.includes(p.id)?'roster-row-wsc starter':'roster-row-wsc'} key={p.id} onClick={()=>choose(p.id)}>
            <span><strong>{p.name}</strong><small>{p.position} · {p.age} · {p.nationality}</small></span><b>{p.skills.speed}</b><b>{p.skills.passing}</b><b>{p.skills.shooting}</b><b>{p.skills.tackling}</b><b>{p.skills.goalkeeping}</b><b className="ovr">{p.overall}</b>
          </button>)}
        </div>
      </div>
    </div>
    <div className="squad-bottom-controls">
      <span>{first?'SELECT ANOTHER PLAYER TO SWAP':'SELECT TWO PLAYERS TO SWAP'}</span>
      <button className="tactic-control-wsc" onClick={cycleMentality}><span>MENTALITY</span><b>{mentality}</b></button>
      <button className="tactic-control-wsc" onClick={cyclePressure}><span>PRESSURE</span><b>{pressure}</b></button>
      <span>FORMATION <b>{club.formation}</b></span>
    </div>
  </section>;
}
function Transfers({game,onHome,onBuy,onSell}:{game:GameState;onHome:()=>void;onBuy:(id:string)=>void;onSell:(id:string)=>void}){
  const [tab,setTab]=useState<'buy'|'sell'>('buy'),[q,setQ]=useState('');
  const market=getMarketPlayers(game),club=game.clubs[game.clubId];
  const list=tab==='buy'?market.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())):club.playerIds.map(id=>game.players[id]).filter(Boolean) as Player[];
  return <section className="page">
    <div className="page-head"><div><button className="page-home-btn" onClick={onHome}>‹ MAIN</button><div><span>TRANSFERS</span><h2>{isTransferWindow(game)?'TRANSFER WINDOW OPEN':'MARKET CLOSED'}</h2></div></div><div className="transfer-tabs"><button className={tab==='buy'?'active':''} onClick={()=>setTab('buy')}>BUY</button><button className={tab==='sell'?'active':''} onClick={()=>setTab('sell')}>SELL</button></div></div>
    <div className="transfer-bar"><span>FUNDS {money(club.budget)}</span><span>SQUAD {club.playerIds.length}/18</span>{tab==='buy'&&<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search player"/>}</div>
    <div className="transfer-list">{list.map(p=><div className="transfer-row" key={p.id}><div className="transfer-player"><strong>{p.name}</strong><span>{p.position} · {p.age} · {p.nationality}</span></div><b>{p.overall}</b><span>{money(p.marketValue)}</span><span>{money(p.wage)}/week</span><button className={tab==='buy'?'action green':'action gray'} onClick={()=>tab==='buy'?onBuy(p.id):onSell(p.id)}>{tab==='buy'?'BUY':'SELL'}</button></div>)}{!list.length&&<div className="empty">No players available.</div>}</div>
  </section>;
}

function Competition({game,onHome,onTeam}:{game:GameState;onHome:()=>void;onTeam:(id:string)=>void}){
  const [tab,setTab]=useState<'table'|'goals'|'assists'|'honours'>('table'),l=getLeague(game),rows=game.tables[l.id]??[],top=leaders(game,tab==='assists'?'assists':'goals');
  const honourRows=Object.values(game.clubs).filter(c=>c.leagueId===l.id).sort((x,y)=>y.trophies-x.trophies||y.reputation-x.reputation);
  return <section className="page">
    <div className="page-head">
      <div><button className="page-home-btn" onClick={onHome}>‹ MAIN</button><div><span>COMPETITION</span><h2>{l.name}</h2></div></div>
      <div className="transfer-tabs">{(['table','goals','assists','honours'] as const).map(t=><button className={tab===t?'active':''} key={t} onClick={()=>setTab(t)}>{t==='table'?'TABLE':t==='goals'?'SCORERS':t==='assists'?'ASSISTS':'HONOURS'}</button>)}</div>
    </div>
    {tab==='table'?<div className="league-table">
      <div className="table-head"><span>#</span><span>CLUB</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GF</span><span>GA</span><span>GD</span><span>PTS</span></div>
      {rows.map((r,i)=>{const c=game.clubs[r.teamId];return <button className={r.teamId===game.clubId?'table-row table-team-button yours':'table-row table-team-button'} key={r.teamId} onClick={()=>onTeam(c.id)}><b>{i+1}</b><strong>{c.name}</strong><span>{r.played}</span><span>{r.wins}</span><span>{r.draws}</span><span>{r.losses}</span><span>{r.goalsFor}</span><span>{r.goalsAgainst}</span><span>{r.goalsFor-r.goalsAgainst}</span><b>{r.points}</b></button>})}
    </div>
    :tab==='honours'?<div className="leader-list">{honourRows.map((c,i)=><button className="leader-row leader-team-button" key={c.id} onClick={()=>onTeam(c.id)}><span>{i+1}</span><div><strong>{c.name}</strong><small>{c.country} · {c.formation} · REP {c.reputation}</small></div><b>{c.trophies}</b></button>)}</div>
    :<div className="leader-list">{top.map((p,i)=>{const c=Object.values(game.clubs).find(x=>x.playerIds.includes(p.id));return <div className="leader-row" key={p.id}><span>{i+1}</span><div><strong>{p.name}</strong><small>{c?.shortName??'—'} · {p.position} · {p.age}</small></div><b>{tab==='goals'?p.goals:p.assists}</b></div>})}</div>}
  </section>;
}

function Schedule({game,onHome,onTeam}:{game:GameState;onHome:()=>void;onTeam:(id:string)=>void}){
  const club=game.clubs[game.clubId],league=getLeague(game);
  const fixtures=game.fixtures.filter(f=>f.leagueId===league.id&&(f.homeTeamId===club.id||f.awayTeamId===club.id)).sort((a,b)=>a.round-b.round);
  return <section className="page">
    <div className="page-head"><div><button className="page-home-btn" onClick={onHome}>‹ MAIN</button><div><span>SCHEDULE</span><h2>{league.name} · SEASON {game.season}</h2></div></div><div className="schedule-meta"><b>{fixtures.filter(f=>f.played).length}</b><span>PLAYED</span><b>{fixtures.filter(f=>!f.played).length}</b><span>REMAINING</span></div></div>
    <div className="schedule-page-body">
      <div className="schedule-calendar-head"><span>WEEK</span><span>OPPONENT</span><span>COMP.</span><span>VENUE</span><span>RESULT</span></div>
      <div className="schedule-calendar-list">
        {fixtures.map(f=>{
          const home=f.homeTeamId===club.id,oppId=home?f.awayTeamId:f.homeTeamId,opp=game.clubs[oppId],r=f.result;
          const resultTextValue=r?(home?String(r.homeGoals)+':'+String(r.awayGoals):String(r.awayGoals)+':'+String(r.homeGoals)):'—';
          return <button className={f.played?'schedule-calendar-row played':'schedule-calendar-row'} key={f.id} onClick={()=>onTeam(opp.id)}>
            <b>W{String(f.round).padStart(2,'0')}</b>
            <span className="schedule-team"><i style={{background:opp.color}}>{opp.shortName}</i><strong>{opp.name}</strong></span>
            <small>{league.name}</small>
            <span>{home?'HOME':'AWAY'}</span>
            <b className="schedule-result">{resultTextValue}</b>
          </button>;
        })}
      </div>
    </div>
  </section>;
}

function NewsScreen({game,onHome}:{game:GameState;onHome:()=>void}){
  const club=game.clubs[game.clubId],league=getLeague(game),table=game.tables[league.id]??[];
  const leader=table[0]?game.clubs[table[0].teamId]:club;
  const last=game.lastMatch,rows=game.lastWeekResults;
  const topScorer=Object.values(game.players).filter(p=>p.goals>0).sort((x,y)=>y.goals-x.goals)[0];
  const next=getCurrentFixture(game);
  const nextOpp=next?game.clubs[next.homeTeamId===club.id?next.awayTeamId:next.homeTeamId]:undefined;
  const headlines=[
    last?{tag:'MATCHDAY',title:resultText(last,game.clubs),body:'The latest result has been added to the season record.'}:{tag:'SEASON',title:'THE NEW CAMPAIGN BEGINS',body:'The first round is underway across the football world.'},
    isTransferWindow(game)?{tag:'TRANSFERS',title:'THE MARKET IS OPEN',body:'Clubs are checking their squads and searching for improvements.'}:{tag:'LEAGUE',title:leader.name.toUpperCase()+' LEAD THE TABLE',body:'The standings are updated after the latest round.'},
    rows.length>1?{tag:'ROUNDUP',title:'ROUND '+Math.max(1,game.week-1)+' ROUND-UP',body:String(rows.length)+' matches have been simulated around the world.'}:{tag:'CLUB',title:club.name.toUpperCase(),body:'Your team is preparing for Week '+String(game.week)+'.'},
    topScorer?{tag:'SCORERS',title:topScorer.name.toUpperCase()+' LEADS THE SCORING',body:String(topScorer.goals)+' goals in the current season so far.'}:{tag:'SCORERS',title:'THE SCORING CHART',body:'The goals table will grow as the season progresses.'},
    game.jobOffers.length?{tag:'CAREER',title:'NEW JOB OFFERS AVAILABLE',body:'Your manager profile has attracted interest from other clubs.'}:{tag:'WORLD',title:'WORLD FOOTBALL',body:'Club reputations continue to change as seasons progress.'},
    nextOpp?{tag:'FIXTURE',title:'NEXT: '+nextOpp.name.toUpperCase(),body:(next?.homeTeamId===club.id?'Home':'Away')+' · Week '+String(game.week)+' · '+league.name}:{tag:'FIXTURE',title:'SEASON COMPLETE',body:'There are no remaining fixtures in this season.'}
  ];
  return <section className="page">
    <div className="page-head"><div><button className="page-home-btn" onClick={onHome}>‹ MAIN</button><div><span>NEWS</span><h2>NEWSPAPER</h2></div></div><span className="news-date">YEAR {game.season} · WEEK {game.week}</span></div>
    <div className="newspaper-layout">
      <div className="newspaper-paper">
        <div className="paper-masthead"><span>THE DREAM TEAM CHRONICLE</span><b>FOOTBALL NEWS</b><small>YEAR {game.season} · WEEK {game.week}</small></div>
        <article className="lead-story"><span>{headlines[0].tag}</span><h3>{headlines[0].title}</h3><p>{headlines[0].body}</p></article>
        <div className="paper-grid">{headlines.slice(1).map((h,i)=><article key={i}><span>{h.tag}</span><h4>{h.title}</h4><p>{h.body}</p></article>)}</div>
      </div>
      <aside className="news-sidebar"><div className="news-sidebar-title">LATEST</div>{headlines.slice(0,5).map((h,i)=><button key={i}><b>{i+1}</b><div><strong>{h.title}</strong><small>{h.tag}</small></div></button>)}</aside>
    </div>
  </section>;
}

function TeamViewer({game,teamId,onBack}:{game:GameState;teamId:string;onBack:()=>void}){
  const team=game.clubs[teamId]??game.clubs[game.clubId];
  const league=game.leagues[team.leagueId],row=game.tables[team.leagueId]?.find(r=>r.teamId===team.id);
  const players=team.playerIds.map(id=>game.players[id]).filter(Boolean) as Player[];
  const avgAge=players.length?players.reduce((sum,p)=>sum+p.age,0)/players.length:0;
  const avgOverall=players.length?players.reduce((sum,p)=>sum+p.overall,0)/players.length:0;
  const attackers=players.filter(p=>p.position==='FWD'||p.position==='MID');
  const mids=players.filter(p=>p.position==='MID');
  const defenders=players.filter(p=>p.position==='DEF'||p.position==='GK');
  const atk=Math.round(attackers.reduce((sum,p)=>sum+p.overall,0)/Math.max(1,attackers.length));
  const mid=Math.round(mids.reduce((sum,p)=>sum+p.overall,0)/Math.max(1,mids.length));
  const def=Math.round(defenders.reduce((sum,p)=>sum+p.overall,0)/Math.max(1,defenders.length));
  const [showSquad,setShowSquad]=useState(false);
  if(showSquad)return <section className="page team-page">
    <div className="page-head"><div><button className="page-home-btn" onClick={()=>setShowSquad(false)}>‹ TEAM</button><div><span>{team.country} · {league?.name??''}</span><h2>SQUAD</h2></div></div><button className="team-back-main" onClick={onBack}>MAIN</button></div>
    <div className="club-squad-body">
      <div className="club-squad-title"><span>PLAYER</span><b>POS</b><b>AGE</b><b>SPD</b><b>PASS</b><b>SHOT</b><b>TCKL</b><b>GK</b><b>OVR</b></div>
      <div className="club-squad-list">{players.map((p,i)=><div className={team.startingXI.includes(p.id)?'club-squad-row starter':'club-squad-row'} key={p.id}><strong><em>{i+1}</em>{p.name}</strong><span>{p.position}</span><span>{p.age}</span><b>{p.skills.speed}</b><b>{p.skills.passing}</b><b>{p.skills.shooting}</b><b>{p.skills.tackling}</b><b>{p.skills.goalkeeping}</b><b className="ovr">{p.overall}</b></div>)}</div>
    </div>
  </section>;
  return <section className="page team-page">
    <div className="page-head"><div><button className="page-home-btn" onClick={onBack}>‹ BACK</button><div><span>{team.country} · {league?.name??''}</span><h2>{team.name}</h2></div></div><button className="team-squad-open" onClick={()=>setShowSquad(true)}>SQUAD ›</button></div>
    <div className="team-overview-body">
      <div className="team-hero"><div className="team-big-crest" style={{background:team.color}}>{team.shortName}</div><div><span>CLUB PROFILE</span><h3>{team.name}</h3><p>{team.country} · {league?.name??'Independent club'}</p><div className="team-stars">{'★★★★★'.slice(0,Math.max(1,Math.min(5,Math.round(team.reputation/20))))}{'☆'.repeat(5-Math.max(1,Math.min(5,Math.round(team.reputation/20))))}</div></div></div>
      <div className="team-stat-grid"><div><small>AVERAGE AGE</small><b>{avgAge.toFixed(1)}</b></div><div><small>SQUAD SIZE</small><b>{players.length}</b></div><div><small>TEAM OVR</small><b>{Math.round(avgOverall)}</b></div><div><small>DEF</small><b>{def}</b></div><div><small>MID</small><b>{mid}</b></div><div><small>ATT</small><b>{atk}</b></div></div>
      <div className="team-detail-grid"><section><span>LEAGUE POSITION</span><strong>{row?String((game.tables[team.leagueId]??[]).findIndex(r=>r.teamId===team.id)+1):'—'}</strong></section><section><span>FORMATION</span><strong>{team.formation}</strong></section><section><span>TROPHIES</span><strong>{team.trophies}</strong></section><section><span>TRANSFER BUDGET</span><strong>{money(team.budget)}</strong></section></div>
      <div className="team-action-strip"><button onClick={()=>setShowSquad(true)}><strong>VIEW SQUAD</strong><small>PLAYER LIST & ATTRIBUTES</small>›</button><div><span>STARTING XI</span><strong>{team.startingXI.length}/11</strong></div><div><span>ENERGY</span><strong>{Math.round(players.reduce((sum,p)=>sum+p.fitness,0)/Math.max(1,players.length))}%</strong></div></div>
    </div>
  </section>;
}


function CoachRoom({game,onHome,onScreen}:{game:GameState;onHome:()=>void;onScreen:(x:Screen)=>void}){
  const club=game.clubs[game.clubId],table=game.tables[club.leagueId]?.find(r=>r.teamId===club.id);
  return <section className="page"><div className="page-head"><div><button className="page-home-btn" onClick={onHome}>‹ MAIN</button><div><span>MANAGER</span><h2>COACH ROOM</h2></div></div></div><div className="coach-room-grid">
    <section className="coach-profile"><div className="coach-avatar">DT</div><div><small>MANAGER</small><strong>{game.managerName}</strong><span>Reputation {game.managerReputation}</span></div></section>
    <section className="coach-note"><span>CLUB OBJECTIVE</span><strong>Keep improving the squad</strong><p>Current position {getPosition(game)} · {table?.points??0} points · Year {game.season}</p></section>
    <button className="coach-action" onClick={()=>onScreen('squad')}><span>TEAM</span><strong>OPEN SQUAD</strong><small>MANAGE FORMATION</small></button>
    <button className="coach-action" onClick={()=>onScreen('transfers')}><span>MARKET</span><strong>OPEN TRANSFERS</strong><small>BUILD YOUR SQUAD</small></button>
  </div></section>;
}

function Trophies({game,onHome}:{game:GameState;onHome:()=>void}){
  const club=game.clubs[game.clubId];
  return <section className="page"><div className="page-head"><div><button className="page-home-btn" onClick={onHome}>‹ MAIN</button><div><span>CAREER</span><h2>HONOURS & HISTORY</h2></div></div></div><div className="honours"><div className="honour-box"><strong>{club.trophies}</strong><span>LEAGUE TROPHIES</span></div><div className="honour-box"><strong>{game.history.length}</strong><span>SEASONS COMPLETED</span></div><div className="honour-box"><strong>{game.managerReputation}</strong><span>MANAGER REP</span></div></div><div className="history">{game.history.length?game.history.slice().reverse().map(h=><div key={h.season}><b>YEAR {h.season}</b><span>{h.clubName}</span><small>{h.leagueName} · {h.position} PLACE</small></div>):<div className="empty">Your career history will appear here.</div>}</div></section>;
}

function LiveMatch({state,minute,onClose}:{state:GameState;minute:number;onClose:()=>void}){
  const result=state.lastMatch;if(!result)return null;
  const home=state.clubs[result.homeTeamId],away=state.clubs[result.awayTeamId],visible=result.events.filter(e=>e.type==='goal'&&e.minute<=minute);
  const shownHome=visible.filter(e=>e.teamId===home.id).length,shownAway=visible.filter(e=>e.teamId===away.id).length;
  return <div className="live-screen"><header><span>LIVE MATCH</span><strong>YEAR {state.season} · ROUND {Math.max(1,state.week-1)}</strong></header><main><div className="score"><div><span>{home.name}</span><b>{shownHome}</b></div><em>{minute}'</em><div><span>{away.name}</span><b>{shownAway}</b></div></div><div className="live-progress"><i style={{width:(minute/90*100)+'%'}}/></div><div className="live-minute">{minute}'</div><div className="events">{result.events.filter(e=>e.type==='goal'&&e.minute<=minute).map((e,i)=><div key={i}><b>{e.minute}'</b><span>⚽ {e.teamId===home.id?home.shortName:away.shortName} · {state.players[e.playerId??'']?.name??'Goal'}</span></div>)}</div>{minute>=90&&<button className="primary close-live" onClick={onClose}>CONTINUE</button>}</main></div>;
}

function CareerExitMenu({club,close,onCareer}:{club:Club;close:()=>void;onCareer:()=>void}){
  return <div className="career-exit-backdrop" onClick={close}>
    <aside className="career-exit-menu" onClick={e=>e.stopPropagation()}>
      <header><div><span>CAREER MENU</span><strong>{club.shortName}</strong></div><button onClick={close}>×</button></header>
      <div className="career-exit-body">
        <p>Leave this career and return to your saved careers.</p>
        <button className="career-exit-action" onClick={onCareer}><span>▣</span><strong>CAREER SELECTION</strong><small>BACK TO SAVES</small><b>›</b></button>
        <button className="career-exit-cancel" onClick={close}>CANCEL</button>
      </div>
    </aside>
  </div>;
}

function JobOffers({game,onTake}:{game:GameState;onTake:(id:string)=>void}){
  return <div className="job-overlay"><div className="job-window"><header><span>CAREER</span><h2>JOB OFFERS</h2><p>Your manager reputation opened new opportunities.</p></header>{game.jobOffers.map(o=>{const c=game.clubs[o.clubId];return <button className="job-row" key={o.clubId} onClick={()=>onTake(o.clubId)}><span className="club-dot" style={{background:c.color}}>{c.shortName}</span><div><strong>{c.name}</strong><small>{c.country} · {c.leagueId.endsWith('1')?'Premier':'Championship'}</small><em>{o.reason}</em></div><b>›</b></button>})}</div></div>;
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){return <div className="overlay"><div className="modal"><header><h2>{title}</h2><button onClick={onClose}>×</button></header>{children}</div></div>}
function Confirm({title,text,onNo,onYes}:{title:string;text:string;onNo:()=>void;onYes:()=>void}){return <Modal title={title} onClose={onNo}><p className="confirm-text">{text}</p><div className="confirm-actions"><button className="secondary" onClick={onNo}>CANCEL</button><button className="danger" onClick={onYes}>DELETE</button></div></Modal>}


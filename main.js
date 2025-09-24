/* ===================== main.js (v6.0) ===================== */
/* SEARCH FOR: BOOT + FETCH — START */
const $ = s => document.querySelector(s);
const LINE = '#2b2f36';
const PALETTE = ['#ed6c03','#22c55e','#8b5cf6','#3b82f6','#14b8a6','#ef4444','#eab308','#a855f7'];
const RANGE_COLORS = {'24h':'#ed6c03','7d':'#14b8a6','30d':'#3b82f6','90d':'#8b5cf6'};
const METRIC_ACCENTS = {
  'Reply %':'#ed6c03','Replies → Appt/Lead %':'#8b5cf6','Appt/Lead → Close %':'#22c55e',
  'Contacted':'#3b82f6','Replies':'#ed6c03','Appointments / Leads':'#8b5cf6','Sold':'#22c55e'
};
const rangeLabel = r => ({'24h':'Last 24 Hours','7d':'Last 7 Days','30d':'Last 30 Days','90d':'Last 90 Days'})[r]||r;
const chartLabel = c => ({'funnel':'Funnel','bar':'Bar (vertical)','bar-h':'Bar (horizontal)','donut':'Donut','line':'Line'})[c]||c;
const fmtInt = n => new Intl.NumberFormat().format(Math.round(Number(n)||0));
const fmt2 = n => { const v = Number(n)||0; return Math.abs(v - Math.round(v)) < 0.005 ? fmtInt(v) : v.toFixed(2); };
const safeDiv = (a,b) => (b>0 ? (Number(a)||0)/(Number(b)||0) : 0);
const pct = (num, den) => 100*safeDiv(num, den);
const nicePct = v => `${Math.round(Number(v)||0)}%`;
const agentColor = name => {
  if(!name) return '#6B7280';
  let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))>>>0;
  return PALETTE[h%PALETTE.length];
};
function lighten(hex, amt){
  const v = hex.replace('#','');
  const r = Math.min(255, parseInt(v.substr(0,2),16)+Math.round(255*amt));
  const g = Math.min(255, parseInt(v.substr(2,2),16)+Math.round(255*amt));
  const b = Math.min(255, parseInt(v.substr(4,2),16)+Math.round(255*amt));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

/* App state */
let DATA = {};
let mainChart = null, pipeChart = null;
const state = { range:'24h', metric:'Reply %', agent:'All', chart:'funnel', pipeView:'table', pipeInclude:new Set() };
const METRICS = [
  { label:'Reply %', key:'Reply %', pct:true },
  { label:'Replies → Appt/Lead %', key:'Replies → Appt/Lead %', pct:true },
  { label:'Appt/Lead → Close %', key:'Appt/Lead → Close %', pct:true },
  { label:'Contacted', key:'Contacted' },
  { label:'Replies', key:'Replies' },
  { label:'Appointments / Leads', key:'Appointments / Leads' },
  { label:'Sold', key:'Sold' }
];

function getAgents(){ return (DATA.agentsByRange?.[state.range]||[])
  .filter(a => a.agent && a.agent.toLowerCase()!=='cxa')
  .map(a => ({ name:a.agent, Contacted:a.outbound||0, Replies:a.inbound||0, 'Appointments / Leads':a.leads||0, Sold:a.sold||0 })); }
const totalsOf = arr => arr.reduce((acc,c)=>{ Object.keys(c).forEach(k=>{ if(k!=='name') acc[k]=(acc[k]||0)+(Number(c[k])||0); }); return acc; },{Contacted:0,Replies:0,'Appointments / Leads':0,Sold:0});
const addDerived = o => ({...o,'Reply %': pct(o.Replies,o.Contacted),'Replies → Appt/Lead %': pct(o['Appointments / Leads'],o.Replies),'Appt/Lead → Close %': pct(o.Sold,o['Appointments / Leads'])});

/* Loader */
function showLoader(flag){
  document.body.classList.toggle('loading', !!flag);
  if(flag){
    const f = $('#loadbar-fill');
    if(f){ f.style.animation = 'none'; void f.offsetWidth; f.style.animation = ''; }
  }
}
function finishLoader(){
  if(!document.body.classList.contains('loading')) return;
  const f = $('#loadbar-fill'); const loader = $('#loader'); const wrap = document.querySelector('.wrap');
  if(f){ f.style.animation = 'none'; f.style.transition = 'width .35s ease-out'; f.style.width = '100%'; }
  setTimeout(()=>{
    if(wrap){ wrap.style.display = 'block'; requestAnimationFrame(()=> wrap.classList.add('reveal')); }
    if(loader){ loader.style.transition = 'transform .35s ease, opacity .32s ease'; loader.style.transform = 'translateY(-100%)'; loader.style.opacity = '0'; }
    document.body.classList.remove('loading');
    setTimeout(()=>{ if(loader){ loader.style.display='none'; } if(f){ f.style.transition=''; f.style.width='0%'; } }, 380);
  }, 220);
}

/* UI accents */
function setMetricAccent(){
  const color = METRIC_ACCENTS[state.metric] || '#ed6c03';
  $('#metric-pill-name').textContent = state.metric;
  const metricPill = $('#metric-pill');
  metricPill.style.borderColor = color;
  metricPill.style.boxShadow = `0 0 0 2px ${color} inset, 0 0 18px rgba(237,108,3,.35)`;
  ['kpi-contacted-card','kpi-replies-card','kpi-leads-card','kpi-sold-card'].forEach(id=>$('#'+id).classList.remove('glow'));
  if(state.metric==='Contacted') $('#kpi-contacted-card').classList.add('glow');
  if(state.metric==='Replies' || state.metric==='Reply %'){ $('#kpi-replies-card').classList.add('glow'); if(state.metric==='Reply %') $('#kpi-contacted-card').classList.add('glow'); }
  if(state.metric==='Appointments / Leads') $('#kpi-leads-card').classList.add('glow');
  if(state.metric==='Replies → Appt/Lead %'){ $('#kpi-replies-card').classList.add('glow'); $('#kpi-leads-card').classList.add('glow'); }
  if(state.metric==='Appt/Lead → Close %'){ $('#kpi-leads-card').classList.add('glow'); $('#kpi-sold-card').classList.add('glow'); }
  if(state.metric==='Sold') $('#kpi-sold-card').classList.add('glow');
}
function setRangeAccent(){
  const color = RANGE_COLORS[state.range] || '#6B7280';
  $('#range-pill-name').textContent = rangeLabel(state.range);
  const pill = $('#range-pill');
  pill.style.borderColor = color;
  pill.style.boxShadow = `0 0 0 2px ${color} inset`;
}
function setAgentPill(){
  $('#agent-pill-name').textContent = state.agent;
  const pill = $('#agent-pill');
  pill.style.borderColor = state.agent==='All' ? 'var(--line)' : agentColor(state.agent);
  pill.style.boxShadow = state.agent==='All' ? 'none' : `0 0 0 2px ${agentColor(state.agent)} inset`;
}
function renderKeys(){
  const el = $('#keys-row'); const bits = [];
  bits.push(`<span class="keygroup-title">Agents</span>`);
  const names = state.agent==='All' ? getAgents().map(a=>a.name) : [state.agent];
  for(const n of names){ bits.push(`<span class="key"><span class="dot" style="background:${agentColor(n)}"></span>${n}</span>`); }
  bits.push(`<span class="keygroup-title" style="margin-left:10px">Range</span>`);
  bits.push(`<span class="key"><span class="dot" style="background:${RANGE_COLORS[state.range]||'#6B7280'}"></span>${rangeLabel(state.range)}</span>`);
  el.innerHTML = bits.join('');
}

/* Populate + KPIs */
function populateSelectors(){
  $('#metric-select-top').innerHTML = METRICS.map(m=>`<option>${m.label}</option>`).join('');
  $('#metric-select-top').value = state.metric;
  $('#chart-select-top').value = state.chart;
  const names = ['All', ...getAgents().map(a=>a.name)];
  $('#agent-select').innerHTML = names.map(n=>`<option value="${n}">${n}</option>`).join('');
  $('#agent-select').value = state.agent;
  $('#range-select').value = state.range;
  setMetricAccent(); setRangeAccent(); setAgentPill(); renderKeys();
}
function renderHeaderKPIs(){
  $('#company').textContent = DATA.company || 'Performance';
  const date = new Date(DATA.generatedAtUTC || Date.now());
  $('#last-updated').textContent = date.toLocaleString('en-US',{month:'numeric',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  const base = (state.agent==='All') ? totalsOf(getAgents())
        : (getAgents().find(a=>a.name===state.agent) || {Contacted:0,Replies:0,'Appointments / Leads':0,Sold:0});
  const d = addDerived(base);
  $('#kpi-contacted').textContent = fmtInt(base.Contacted);
  $('#kpi-replies').textContent = fmtInt(base.Replies);
  $('#kpi-leads').textContent = fmtInt(base['Appointments / Leads']);
  $('#kpi-sold').textContent = fmtInt(base.Sold);
  $('#kpi-replyPct').textContent = nicePct(d['Reply %']);
  $('#kpi-r2l').textContent = nicePct(d['Replies → Appt/Lead %']);
  $('#kpi-l2c').textContent = nicePct(d['Appt/Lead → Close %']);
}
function describeMain(){
  const title = (state.agent==='All')
    ? `Agent performance — ${state.metric}`
    : `<span class="dot" style="background:${agentColor(state.agent)}"></span>${state.agent} — ${state.metric}`;
  const sub = `Range: ${rangeLabel(state.range)} · Chart: ${chartLabel(state.chart)}`;
  $('#main-chart-title').innerHTML = title;
  $('#main-chart-sub').textContent = sub;
}

/* Charts */
function renderMainChart(){
  describeMain();
  const agents = getAgents().map(addDerived);
  const selectedMetric = METRICS.find(m=>m.label===state.metric);
  let cats=[], dataVals=[];
  if(state.agent==='All'){ cats = agents.map(a=>a.name); dataVals = agents.map(a=>Number(a[selectedMetric.key])||0); }
  else { const a = agents.find(x=>x.name===state.agent) || null;
    cats = ['Contacted','Replies','Appt/Leads','Sold'];
    dataVals = a ? [a.Contacted,a.Replies,a['Appointments / Leads'],a.Sold].map(v=>Number(v)||0) : [0,0,0,0]; }
  const isPct = !!selectedMetric?.pct;
  const accent = state.agent==='All' ? (METRIC_ACCENTS[state.metric]||'#ed6c03') : agentColor(state.agent);
  const usableType = (state.chart==='line' && (dataVals.filter(v=>v>0).length<2 || cats.length<2)) ? 'funnel' : state.chart;
  const baseOpts = {
    chart:{ toolbar:{show:false}, parentHeightOffset:0, foreColor:'#c9ced8', dropShadow:{enabled:true, blur:2, opacity:0.18} },
    grid:{borderColor:LINE, strokeDashArray:4},
    tooltip:{theme:'dark', y:{formatter:(val)=> isPct ? `${Math.round(Number(val)||0)}%` : fmt2(val)}},
    legend:{labels:{colors:'#c9ced8'}},
    xaxis:{ labels:{ style:{colors:'#c9ced8'}, rotate:0, trim:true },
            title:{text: state.agent==='All'?'Agents':'Stages', style:{color:'#c9ced8'}} },
    yaxis:{ labels:{ style:{colors:'#c9ced8'}, formatter:(v)=> isPct ? `${Math.round(v)}%` : fmt2(v) }, min:0 }
  };
  let opts = {...baseOpts};
  if(usableType==='funnel'){
    const b = (state.agent==='All') ? totalsOf(getAgents())
      : (getAgents().find(a=>a.name===state.agent)||{Contacted:0,Replies:0,'Appointments / Leads':0,Sold:0});
    const seriesData = [
      {x:'Contacted', y:Number(b.Contacted)||0},
      {x:'Replies', y:Number(b.Replies)||0},
      {x:'Appt/Leads', y:Number(b['Appointments / Leads'])||0},
      {x:'Sold', y:Number(b.Sold)||0}
    ];
    opts.colors=[accent];
    opts.chart.type='bar';
    opts.plotOptions={bar:{horizontal:true, borderRadius:6, barHeight:'40%', dataLabels:{position:'center'}}};
    opts.yaxis={ labels:{ style:{colors:'#c9ced8'} } };
    opts.dataLabels={enabled:true, style:{fontWeight:700}, formatter:(v,{dataPointIndex})=> fmt2(seriesData[dataPointIndex].y)};
    opts.series=[{name:state.metric, data:seriesData}];
    opts.xaxis={...opts.xaxis, title:{text:'Count', style:{color:'#c9ced8'}}, labels:{style:{colors:'#c9ced8'}}};
  } else if(usableType==='donut'){
    const sum = dataVals.reduce((a,b)=>a+(Number(b)||0),0);
    let series = dataVals.map(v=>Math.max(0, Number(v)||0));
    let labels = cats.length?cats:[state.metric];
    let colors = (state.agent==='All') ? cats.map(n=>agentColor(n)) : series.map(()=>accent);
    if(sum<=0){ series=[1]; labels=['No data']; colors=['#2b2f36']; }
    opts = {
      ...baseOpts, chart:{...baseOpts.chart, type:'donut'}, series, labels, colors,
      stroke:{show:true, width:0},
      dataLabels:{enabled: sum>0, formatter:(val)=> `${Math.round(val)}%`, style:{fontSize:'12px', fontWeight:700}},
      legend:{position:'right', labels:{colors:'#c9ced8'}},
      fill:{ type:'gradient', gradient:{ shade:'dark', type:'vertical', shadeIntensity:0.5, gradientToColors:colors.map(c=>lighten(c,.15)), opacityFrom:0.95, opacityTo:0.85, stops:[0,50,100]} },
      plotOptions:{ pie:{ donut:{ size:'68%', labels:{ show:true, total:{ show:true, label: sum>0?'Total':'No data', formatter:(w)=> sum>0? fmtInt(series.reduce((a,b)=>a+b,0)) : '' } } } } }
    };
  } else if(usableType==='bar-h'){
    const distributed = (state.agent==='All'); const colors = distributed ? cats.map(n=>agentColor(n)) : [accent];
    opts.colors = colors; opts.chart.type='bar';
    opts.plotOptions={bar:{horizontal:true, borderRadius:6, distributed, dataLabels:{position:'center'}}};
    opts.yaxis={ labels:{ style:{colors:'#c9ced8'} } };
    opts.xaxis={...opts.xaxis, categories:cats, title:{text: isPct?'Percent':'Count', style:{color:'#c9ced8'}}};
    opts.dataLabels={enabled:true, style:{fontWeight:700}, formatter:(v)=> isPct? `${Math.round(v)}%` : fmt2(v)};
    opts.series=[{name:state.metric, data:dataVals.map(v=>Math.max(0, Number(v)||0))}];
  } else if(usableType==='bar'){
    const distributed = (state.agent==='All'); const colors = distributed ? cats.map(n=>agentColor(n)) : [accent];
    opts.colors = colors; opts.chart.type='bar';
    opts.plotOptions={bar:{horizontal:false, borderRadius:6, columnWidth:'55%', distributed, dataLabels:{position:'top'}}};
    opts.dataLabels={enabled:true, offsetY:-8, style:{fontWeight:700}, formatter:(v)=> isPct? `${Math.round(v)}%` : fmt2(v)};
    opts.xaxis={...opts.xaxis, categories:cats, title:{text: state.agent==='All'?'Agents':'Stages', style:{color:'#c9ced8'}}};
    opts.series=[{name:state.metric, data:dataVals.map(v=>Math.max(0, Number(v)||0))}];
  } else { // line
    const pointColors = cats.map(c=>agentColor(c));
    const discrete = cats.map((c,i)=>({ seriesIndex:0, dataPointIndex:i, fillColor:pointColors[i], strokeColor:'#101215', size:4 }));
    opts.colors=[accent]; opts.chart.type='line'; opts.stroke={curve:'smooth', width:3}; opts.markers={size:3, discrete};
    opts.xaxis={...opts.xaxis, categories:cats, title:{text: state.agent==='All'?'Agents':'Stages', style:{color:'#c9ced8'}}};
    opts.series=[{name:(state.agent==='All'?state.metric:state.agent), data:dataVals.map(v=>Math.max(0, Number(v)||0))}];
  }
  if(mainChart) mainChart.destroy();
  mainChart = new ApexCharts($('#main-chart'), {...opts, chart:{...opts.chart, height:460}});
  mainChart.render();
}

/* Pipeline */
function getPipeTotals(){ if(state.agent==='All') return (DATA.auditStatusTotals||[]);
  const agentBlock = (DATA.auditByAgent||[]).find(a=>a.agent===state.agent);
  return agentBlock ? agentBlock.totals || [] : []; }
function filteredPipeRows(rows){ if(!state.pipeInclude || state.pipeInclude.size===0) return rows;
  return rows.filter(r=> state.pipeInclude.has(String(r.Status))); }
function renderStatusChips(rows){
  const container = $('#status-chips'); if(!rows.length){ container.innerHTML = '<span class="hint">No statuses.</span>'; return; }
  const allStatuses = rows.map(r=>String(r.Status));
  if(state.pipeInclude.__init!==true){ state.pipeInclude = new Set(allStatuses); state.pipeInclude.__init = true; }
  const html = [`<span class="chip ${state.pipeInclude.size===allStatuses.length?'active':''}" data-status="__ALL__"><span class="dot" style="background:#9ca3af"></span>All</span>`]
    .concat(allStatuses.map(s=>`<span class="chip ${state.pipeInclude.has(s)?'active':''}" data-status="${s}"><span class="dot" style="background:${agentColor(s)}"></span>${s}</span>`)).join('');
  container.innerHTML = html;
  container.querySelectorAll('.chip').forEach(ch=>{
    ch.addEventListener('click', ()=>{
      const key = ch.getAttribute('data-status');
      if(key==='__ALL__'){ state.pipeInclude = new Set(allStatuses); }
      else { if(state.pipeInclude.has(key)) state.pipeInclude.delete(key); else state.pipeInclude.add(key); }
      renderPipeline();
    });
  });
}
function describePipe(){
  const title = (state.agent==='All') ? 'Sales pipeline performance — all agents'
    : `Sales pipeline performance — <span class="dot" style="background:${agentColor(state.agent)}"></span>${state.agent}`;
  $('#pipe-title').innerHTML = title;
  $('#pipe-sub').textContent = `Distribution of contact statuses · ${state.agent==='All'? 'All agents' : state.agent}`;
}
function renderPipeline(){
  describePipe();
  const rawRows = getPipeTotals();
  renderStatusChips(rawRows);
  const rows = filteredPipeRows(rawRows);
  const total = rows.reduce((s,r)=>s+(Number(r.Count)||0),0);
  $('#pipe-total').textContent = `Total Contacts: ${fmtInt(total)}`;
  const view = state.pipeView;
  $('#pipeline-table').style.display = view==='table'? 'block':'none';
  $('#pipeline-chart').style.display = view==='table'? 'none':'block';
  if(view==='table'){
    const html = rows.map(r=>{
      const count = Number(r.Count)||0; const p = pct(count, total); const color = agentColor(r.Status);
      return `<div class="pipe-row">
        <div><span class="dot" style="background:${color}"></span>${r.Status}</div>
        <div style="text-align:right">${fmtInt(count)} (${Math.round(p)}%)</div>
        <div class="bar"><span style="width:${Math.max(0,p)}%; background:${color}"></span></div>
      </div>`;
    }).join('');
    $('#pipeline-table').innerHTML = html || '<div class="hint">No data.</div>';
  } else {
    const series = rows.map(r=>Math.max(0,(Number(r.Count)||0)));
    const labels = rows.map(r=>r.Status);
    const colors = labels.map(l=>agentColor(l));
    const h = Math.max(420, Math.min(560, 150 + labels.length*28));
    const base = { chart:{toolbar:{show:false}, parentHeightOffset:0, foreColor:'#c9ced8', dropShadow:{enabled:true, blur:2, opacity:.18}}, labels, colors, tooltip:{theme:'dark'}, legend:{labels:{colors:'#c9ced8'}} };
    if(view==='bars'){
      const opts = { ...base, chart:{...base.chart, type:'bar'},
        plotOptions:{bar:{horizontal:true, borderRadius:6, dataLabels:{position:'center'}}},
        xaxis:{categories:labels, title:{text:'Count', style:{color:'#c9ced8'}}},
        yaxis:{ labels:{ style:{colors:'#c9ced8'} } },
        dataLabels:{enabled:true, style:{fontWeight:700}, formatter:(v)=>fmt2(v)},
        series:[{name:'Count', data:series}] };
      if(pipeChart) pipeChart.destroy();
      pipeChart = new ApexCharts($('#pipeline-chart'), {...opts, chart:{...opts.chart, height:h}}); pipeChart.render();
    } else if(view==='donut'){
      const sum = series.reduce((a,b)=>a+b,0);
      const opts = { ...base, chart:{...base.chart, type:'donut'},
        series:(sum>0?series:[1]), labels:(sum>0?labels:['No data']),
        colors:(sum>0?colors:['#2b2f36']), stroke:{show:true, width:0},
        dataLabels:{enabled: sum>0, formatter:(v)=> `${Math.round(v)}%`},
        plotOptions:{ pie:{ donut:{ size:'68%', labels:{ show:true, total:{ show:true, label: sum>0? 'Total':'No data', formatter:()=> sum>0? fmtInt(sum) : '' } } } } },
        legend:{position:'right', labels:{colors:'#c9ced8'}} };
      if(pipeChart) pipeChart.destroy();
      pipeChart = new ApexCharts($('#pipeline-chart'), {...opts, chart:{...opts.chart, height:h}}); pipeChart.render();
    } else { // line
      const discrete = labels.map((l,i)=>({ seriesIndex:0, dataPointIndex:i, fillColor:agentColor(l), strokeColor:'#101215', size:4 }));
      const opts = { ...base, colors:['#ed6c03'], chart:{...base.chart, type:'line'},
        stroke:{curve:'smooth', width:3}, markers:{size:3, discrete},
        xaxis:{categories:labels, title:{text:'Status', style:{color:'#c9ced8'}}},
        yaxis:{ labels:{ formatter:(v)=>fmt2(v) }, title:{text:'Count', style:{color:'#c9ced8'}}},
        series:[{name:'Count', data:series}] };
      if(pipeChart) pipeChart.destroy();
      pipeChart = new ApexCharts($('#pipeline-chart'), {...opts, chart:{...opts.chart, height:h}}); pipeChart.render();
    }
  }
}

/* Wiring */
function wire(){
  $('#range-select').addEventListener('change', e=>{
    state.range=e.target.value; setRangeAccent(); renderKeys(); state.pipeInclude.__init=false; refreshAll();
  });
  $('#agent-select').addEventListener('change', e=>{
    state.agent=e.target.value; setAgentPill(); renderKeys(); state.pipeInclude.__init=false; refreshAll();
  });
  $('#metric-select-top').addEventListener('change', e=>{
    state.metric=e.target.value; setMetricAccent(); refreshChartsOnly();
  });
  $('#chart-select-top').addEventListener('change', e=>{
    state.chart=e.target.value; renderMainChart();
  });
  $('#pipe-view').addEventListener('change', e=>{
    state.pipeView=e.target.value; renderPipeline();
  });
  $('#show-all').addEventListener('click', ()=>{
    state.agent='All'; $('#agent-select').value='All'; setAgentPill(); renderKeys(); state.pipeInclude.__init=false; refreshAll();
  });
  $('#refresh-btn').addEventListener('click', ()=> bootstrapFetchOnce(true)); // force refresh
}
function refreshAll(){ renderHeaderKPIs(); renderMainChart(); renderPipeline(); }
function refreshChartsOnly(){ renderMainChart(); renderPipeline(); }

/* ===== BOOTSTRAP & FETCH (single call) ===== */
let inflight = null;
async function bootstrapFetchOnce(force=false){
  if (inflight && !force) return inflight;
  const params = new URLSearchParams(location.search);
  const webhook = params.get('webhook');
  const locationId = params.get('locationId') || params.get('location_id') || '';
  if (!webhook){ $('#loadtext').textContent = 'Missing ?webhook URL param'; return; }
  if (!locationId){ $('#loadtext').textContent = 'Missing ?locationId URL param'; return; }

  showLoader(true);
  const controller = new AbortController();
  inflight = (async()=>{
    try{
      const res = await fetch(webhook, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        signal: controller.signal,
        body: JSON.stringify({ location:{ id: locationId }, range: state.range })
      });
      const json = await res.json().catch(()=> ({}));
      renderDashboard(json);
    }catch(e){
      console.error('Webhook fetch failed', e);
      $('#loadtext').textContent = 'Error fetching data — retrying…';
    }finally{
      inflight = null;
    }
  })();
  return inflight;
}

/* public entry point for reuse if needed */
function renderDashboard(payload){
  const next = (typeof payload==='string')? JSON.parse(payload||'{}') : (payload||{});
  DATA = next;
  state.chart = 'funnel'; state.metric = state.metric || 'Reply %';
  state.agent = 'All'; state.pipeInclude = new Set(); state.pipeInclude.__init=false;
  populateSelectors(); refreshAll(); finishLoader();
}

/* Init */
document.addEventListener('DOMContentLoaded', ()=>{
  wire();
  // long-running jobs: keep loader up indefinitely; progress bar anim is 180s by default
  bootstrapFetchOnce();
});
/* SEARCH FOR: BOOT + FETCH — END */


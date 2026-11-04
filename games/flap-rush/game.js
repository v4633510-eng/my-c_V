/* =========================================================
   FLAP RUSH — COMPLETE
   Simple · Deep · Dino-style Speed Creep
   ========================================================= */
const canvas  = document.getElementById('game');
const ctx     = canvas.getContext('2d', { alpha:false });
const elScore = document.getElementById('score');
const elBest  = document.getElementById('best');
const elCombo = document.getElementById('combo');
const elCoins = document.getElementById('coins');
const elSpeed = document.getElementById('speed');
const overlay = document.getElementById('overlay');
let W = 0, H = 0;

const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const rand  = (a,b)=> a + Math.random()*(b-a);
const lerp  = (a,b,t)=> a + (b-a)*t;
function roundRect(x,y,w,h,r){
  r = Math.min(r, Math.abs(w)/2, Math.abs(h)/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

/* =========================================================
   AUDIO
   ========================================================= */
const Audio = {
  ctx:null, enabled:false,
  init(){
    if(this.enabled) return;
    try{ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); this.enabled = true; }catch(e){}
  },
  tone(f, dur, type='sine', vol=0.07, slideTo=null, delay=0){
    if(!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  },
  flap(){ this.tone(400, 0.07, 'sine', 0.045, 600); },
  pass(){ this.tone(660, 0.06, 'triangle', 0.05); },
  perfect(){
    this.tone(880, 0.06, 'sine', 0.055);
    this.tone(1180, 0.07, 'sine', 0.045, null, 0.04);
  },
  near(){ this.tone(520, 0.08, 'sawtooth', 0.045, 780); },
  coin(){
    this.tone(880, 0.05, 'triangle', 0.07);
    this.tone(1320, 0.08, 'triangle', 0.06, null, 0.04);
  },
  milestone(){
    [523,659,784,1046].forEach((f,i)=> this.tone(f, 0.16, 'triangle', 0.08, null, i*0.07));
  },
  perfectStreak(){
    [523,659,784,1046,1318,1568].forEach((f,i)=> this.tone(f, 0.14, 'sine', 0.09, null, i*0.055));
  },
  // MỚI: Speed up — rising tone ngắn, nhẹ
  speedUp(){ this.tone(330, 0.18, 'sawtooth', 0.055, 720); },
  powerup(){ this.tone(440, 0.14, 'sawtooth', 0.06, 880); },
  hit(){
    this.tone(150, 0.32, 'sawtooth', 0.11, 55);
    this.tone(85, 0.38, 'square', 0.07, 35, 0.05);
  }
};

/* =========================================================
   BIOMES
   ========================================================= */
const BIOMES = [
  { name:'NEON CITY',    bg:'#05060f', bg2:'#0e0a24', accent:'#00e5ff', accent2:'#ff2bd6' },
  { name:'CRYSTAL CAVE', bg:'#040f0d', bg2:'#08201b', accent:'#3dffa8', accent2:'#7af0ff' },
  { name:'DEEP SPACE',   bg:'#0a0512', bg2:'#170a2b', accent:'#b06bff', accent2:'#ff9a3d' },
  { name:'THE CORE',     bg:'#140305', bg2:'#2b0709', accent:'#ff4d4d', accent2:'#ffd93d' }
];
const biome = ()=> BIOMES[G.biomeIdx % BIOMES.length];

/* =========================================================
   STATE
   ========================================================= */
const G = {
  mode:'ready', t:0,
  score:0, gates:0, combo:0, bestCombo:0,
  best: +(localStorage.getItem('flaprush_best')||0),
  coinBank: +(localStorage.getItem('flaprush_coins')||0),
  coinsRun:0,
  spawnDist:0,
  // === SPEED CREEP (Dino-style) ===
  runTime:0, speedLevel:0, lastSpeed:220,
  obstacles:[], items:[], particles:[], stars:[], trail:[],
  popups:[], ripples:[],
  slowmo:0, shield:0,
  shake:0, flash:0, chroma:0, freeze:0,
  biomeIdx:0, toast:'', toastT:0, toastColor:'',
  queue:[], qIdx:0, lastCenter:0.5,
  patternHistory:[], hardCount:0,
  perfectStreak:0
};
let deadTimer = 0;
let lastTrail = 0;
const player = { x:0, y:0, vy:0, r:14, rot:0, hitR:11 };

/* =========================================================
   SPEED FORMULA — Dino-style
   ========================================================= */
const SPEED_BASE = 220;
const SPEED_MAX  = 420;
const SPEED_PER_SEC = 3.5;
const SPEED_PER_GATE = 1.2;
const SPEED_LEVEL_STEP = 30;

function computeSpeed(){
  if(G.mode === 'dead') return G.lastSpeed;
  const raw = SPEED_BASE + G.runTime * SPEED_PER_SEC + G.gates * SPEED_PER_GATE;
  return Math.min(raw, SPEED_MAX);
}

/* =========================================================
   PATTERN SYSTEM
   ========================================================= */
function nextPattern(){
  if(G.qIdx >= G.queue.length){
    const q = [];
    if(G.hardCount >= 3){ q.push('breather'); G.hardCount = 0; }
    const total = 6 + ((Math.random()*3)|0);
    for(let i=0;i<total;i++){
      if(q.length > 0 && q[q.length-1] === 'breather' && Math.random() < 0.7){
        q.push('straight'); continue;
      }
      const r = Math.random();
      let p;
      if(r < 0.35) p = 'straight';
      else if(r < 0.60) p = 'staircase';
      else if(r < 0.85) p = 'bounce';
      else p = 'breather';
      const isHard = (p === 'staircase' || p === 'bounce');
      const lastHard = G.patternHistory.length > 0 &&
        (G.patternHistory[G.patternHistory.length-1] === 'staircase' ||
         G.patternHistory[G.patternHistory.length-1] === 'bounce');
      if(isHard && lastHard && Math.random() < 0.5) p = 'straight';
      q.push(p);
    }
    G.queue = q; G.qIdx = 0;
  }
  const p = G.queue[G.qIdx++];
  G.patternHistory.push(p);
  if(G.patternHistory.length > 10) G.patternHistory.shift();
  if(p === 'staircase' || p === 'bounce') G.hardCount++;
  else G.hardCount = 0;
  return p;
}
function getCenterForPattern(pattern, prev){
  switch(pattern){
    case 'straight':  return clamp(prev + rand(-0.04, 0.04), 0.28, 0.72);
    case 'staircase': return clamp(prev + (Math.random()<0.5 ? -0.20 : 0.20), 0.22, 0.78);
    case 'bounce':    return clamp(1 - prev, 0.25, 0.75);
    case 'breather':  return 0.5;
  }
  return 0.5;
}

/* =========================================================
   RESIZE
   ========================================================= */
function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.floor(W*dpr); canvas.height = Math.floor(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resize);

/* =========================================================
   HELPERS
   ========================================================= */
function comboMult(){ return Math.min(6, 1 + Math.floor(G.combo/5) * 0.5); }
function toast(msg, color){ G.toast = msg; G.toastT = 1.3; G.toastColor = color; }
function popup(x, y, text, color, size){
  G.popups.push({ x, y, text, color, size:size||22, life:1.0, vy:-90, vx:rand(-25,25) });
}
function burst(x, y, n, color, power){
  power = power || 1;
  for(let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2;
    const sp = rand(70,360)*power;
    G.particles.push({
      x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
      life: rand(.35,.9), color, r: rand(1.5,4),
      glow: Math.random() < 0.4
    });
  }
}
function ripple(x, y, color){ G.ripples.push({ x, y, r:8, maxR:220, life:1, color }); }

/* =========================================================
   HUD
   ========================================================= */
let hudC = { s:-1, b:-1, c:'', k:-1, spd:-1 };
function updateHUD(punch){
  const s = Math.floor(G.score);
  if(hudC.s !== s){
    elScore.textContent = s; hudC.s = s;
    if(punch){
      elScore.classList.add('punch');
      setTimeout(()=>elScore.classList.remove('punch'), 120);
    }
  }
  if(hudC.b !== G.best){ elBest.textContent = 'BEST ' + G.best; hudC.b = G.best; }
  const tot = G.coinBank + G.coinsRun;
  if(hudC.k !== tot){ elCoins.textContent = '◈ ' + tot; hudC.k = tot; }
  const spdLv = G.speedLevel + 1;
  if(hudC.spd !== spdLv){
    elSpeed.textContent = 'SPD ' + spdLv;
    hudC.spd = spdLv;
  }
  const m = comboMult();
  if(G.combo >= 4 && G.mode === 'playing'){
    const txt = 'x' + (m % 1 === 0 ? m : m.toFixed(1)) + ' · ' + G.combo;
    if(hudC.c !== txt){
      elCombo.textContent = txt; hudC.c = txt;
      elCombo.classList.add('punch');
      setTimeout(()=>elCombo.classList.remove('punch'), 130);
    }
    elCombo.style.opacity = '1';
  } else elCombo.style.opacity = '0';
}

/* =========================================================
   OVERLAY
   ========================================================= */
function showOverlay(kind){
  if(kind === 'ready'){
    overlay.innerHTML = `
      <h1>FLAP<span>RUSH</span></h1>
      <p class="big">TAP / SPACE</p>
      <p class="sub">Nhấn để bắt đầu</p>
      <p class="tip">PERFECT +50 · NEAR MISS +25 · TỐC ĐỘ TĂNG DẦN</p>`;
  } else {
    overlay.innerHTML = `
      <p class="lbl">Đ I Ể M</p>
      <h2>${Math.floor(G.score)}</h2>
      <p class="sub">BEST ${G.best} · COMBO ${G.bestCombo}</p>
      <p class="big">TAP ĐỂ CHƠI LẠI</p>
      <p class="tip">+${G.coinsRun} ◈ · ${G.gates} CỔNG · SPD ${G.speedLevel+1}</p>`;
  }
  overlay.classList.remove('hidden');
}
function hideOverlay(){ overlay.classList.add('hidden'); }

/* =========================================================
   RESET / START
   ========================================================= */
function reset(){
  G.mode = 'ready';
  G.score = 0; G.gates = 0; G.combo = 0; G.bestCombo = 0;
  G.coinsRun = 0;
  G.runTime = 0; G.speedLevel = 0; G.lastSpeed = SPEED_BASE;
  G.obstacles.length = 0; G.items.length = 0;
  G.particles.length = 0; G.trail.length = 0;
  G.popups.length = 0; G.ripples.length = 0;
  G.spawnDist = 300;
  G.slowmo = 0; G.shield = 0;
  G.shake = 0; G.flash = 0; G.chroma = 0; G.freeze = 0;
  G.toast = ''; G.toastT = 0;
  G.biomeIdx = 0;
  G.queue = []; G.qIdx = 0; G.lastCenter = 0.5;
  G.patternHistory = []; G.hardCount = 0;
  G.perfectStreak = 0;
  player.x = W * 0.28;
  player.y = H * 0.45;
  player.vy = 0; player.rot = 0;
  hudC = { s:-1, b:-1, c:'', k:-1, spd:-1 };
  updateHUD();
  showOverlay('ready');
}
function startRun(){ reset(); G.mode = 'playing'; hideOverlay(); flap(); }

/* =========================================================
   INPUT
   ========================================================= */
function press(){
  Audio.init();
  if(G.mode === 'ready'){ G.mode = 'playing'; hideOverlay(); flap(); }
  else if(G.mode === 'playing') flap();
  else if(G.mode === 'dead' && deadTimer > 0.4) startRun();
}
function flap(){
  player.vy = -430;
  Audio.flap();
  burst(player.x, player.y + player.r*0.7, 4, biome().accent, 0.55);
}
window.addEventListener('pointerdown', e=>{ e.preventDefault(); press(); }, {passive:false});
window.addEventListener('keydown', e=>{
  if(e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW'){
    e.preventDefault();
    if(!e.repeat) press();
  }
});

/* =========================================================
   SPAWN OBSTACLE
   ========================================================= */
function spawnObstacle(){
  const pattern = nextPattern();
  const centerPct = getCenterForPattern(pattern, G.lastCenter);
  G.lastCenter = centerPct;

  let gapH;
  if(pattern === 'breather') gapH = Math.max(280, 320 - G.gates * 0.4);
  else gapH = Math.max(180, 240 - G.gates * 0.7);

  const usable = H - 160 - gapH;
  const gapCenter = 80 + centerPct * usable + gapH/2;
  const gapY = gapCenter - gapH/2;

  G.obstacles.push({
    x: W + 60, w: 76, gapY, gapH,
    passed:false, minDist:999, pattern
  });

  const cx = W + 60 + 38;
  const cy = gapY + gapH/2;
  const r = Math.random();

  if(r < 0.5){
    const count = pattern === 'breather' ? 5 : (3 + ((Math.random()*3)|0));
    for(let i=0;i<count;i++){
      const offsetX = (i - (count-1)/2) * 40;
      G.items.push({ x:cx + offsetX, y:cy, r:9, type:'coin', pulse: Math.random()*6 });
    }
  }

  if(Math.random() < 0.09){
    const types = ['shield','slow'];
    G.items.push({ x:cx, y:cy, r:15, type: types[(Math.random()*2)|0], pulse: Math.random()*6 });
  }

  const ni = Math.floor(G.gates / 25) % BIOMES.length;
  if(ni !== G.biomeIdx){
    G.biomeIdx = ni;
    toast(BIOMES[ni].name, BIOMES[ni].accent2);
    G.flash = Math.max(G.flash, 0.7);
    Audio.milestone();
  }
}

/* =========================================================
   DEATH
   ========================================================= */
function die(){
  if(G.mode !== 'playing') return;
  G.mode = 'dead';
  deadTimer = 0;
  G.shake = 1; G.flash = 1; G.chroma = 1; G.freeze = 0.06;
  Audio.hit();
  burst(player.x, player.y, 40, biome().accent2, 1.7);
  const fin = Math.floor(G.score);
  if(fin > G.best){ G.best = fin; localStorage.setItem('flaprush_best', G.best); }
  G.coinBank += G.coinsRun;
  localStorage.setItem('flaprush_coins', G.coinBank);
  updateHUD();
  showOverlay('dead');
}

/* =========================================================
   COLLECT
   ========================================================= */
function collect(it){
  if(it.type === 'coin'){
    G.score += 5; G.coinsRun++;
    burst(it.x, it.y, 10, '#ffd93d', 0.7);
    Audio.coin();
  } else if(it.type === 'shield'){
    G.shield = 12;
    burst(it.x, it.y, 22, '#7af0ff', 1.1);
    toast('SHIELD', '#7af0ff');
    Audio.powerup();
  } else if(it.type === 'slow'){
    G.slowmo = Math.max(G.slowmo, 3);
    burst(it.x, it.y, 22, '#b06bff', 1.1);
    toast('SLOW-MO', '#b06bff');
    Audio.powerup();
  }
  G.flash = Math.max(G.flash, 0.3);
  updateHUD();
}

/* =========================================================
   UPDATE
   ========================================================= */
function update(dt){
  const b = biome();

  // === SPEED CREEP: tính tốc độ hiện tại (Dino-style) ===
  const speed = computeSpeed();

  // Stars — tốc độ cuộn tỷ lệ với game speed
  const bgSpeed = (G.mode === 'playing' || G.mode === 'dead') ? speed * 0.85 : 50;
  for(const s of G.stars){
    s.x -= bgSpeed * s.z * 0.07 * dt;
    if(s.x < -6){ s.x = W + 6; s.y = Math.random() * H; }
  }

  // Particles
  for(let i=G.particles.length-1;i>=0;i--){
    const p = G.particles[i];
    p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 320*dt;
    const d = Math.pow(0.15, dt);
    p.vx *= d; p.vy *= d;
    p.life -= dt;
    if(p.life <= 0) G.particles.splice(i,1);
  }

  // Popups
  for(let i=G.popups.length-1;i>=0;i--){
    const p = G.popups[i];
    p.y += p.vy*dt; p.x += p.vx*dt;
    p.vy *= Math.pow(0.5, dt);
    p.life -= dt * 1.2;
    if(p.life <= 0) G.popups.splice(i,1);
  }

  // Ripples
  for(let i=G.ripples.length-1;i>=0;i--){
    const r = G.ripples[i];
    r.r = lerp(r.r, r.maxR, 1 - Math.pow(0.02, dt));
    r.life -= dt * 1.4;
    if(r.life <= 0) G.ripples.splice(i,1);
  }

  // Timers
  if(G.shake > 0) G.shake = Math.max(0, G.shake - dt*2.5);
  if(G.flash > 0) G.flash = Math.max(0, G.flash - dt*3);
  if(G.chroma > 0) G.chroma = Math.max(0, G.chroma - dt*1.8);
  if(G.freeze > 0) G.freeze = Math.max(0, G.freeze - dt);
  if(G.toastT > 0) G.toastT -= dt;
  if(G.slowmo > 0) G.slowmo = Math.max(0, G.slowmo - dt);
  if(G.shield > 0) G.shield = Math.max(0, G.shield - dt);

  if(G.mode === 'ready'){
    player.y = H*0.45 + Math.sin(G.t*2.6)*12;
    player.rot = Math.sin(G.t*2.6)*0.12;
    return;
  }

  if(G.mode === 'dead'){
    player.vy += 1500*dt;
    player.y += player.vy*dt;
    player.rot = Math.min(player.rot + dt*4.5, 1.7);
    for(let i=G.trail.length-1;i>=0;i--){
      G.trail[i].life -= dt;
      if(G.trail[i].life <= 0) G.trail.splice(i,1);
    }
    return;
  }

  /* ---------- PLAYING ---------- */
  const ts = G.slowmo > 0 ? 0.45 : 1;
  const sdt = dt * ts;

  // === TĂNG runTime — càng chơi càng nhanh ===
  G.runTime += sdt;

  // === TÍNH LẠI SPEED sau khi cập nhật runTime ===
  const liveSpeed = computeSpeed();
  G.lastSpeed = liveSpeed;

  // === SPEED LEVEL UP — flash nhẹ + âm thanh + HUD pulse ===
  const newLevel = Math.floor((liveSpeed - SPEED_BASE) / SPEED_LEVEL_STEP);
  if(newLevel > G.speedLevel){
    G.speedLevel = newLevel;
    G.flash = Math.max(G.flash, 0.3);
    G.shake = Math.max(G.shake, 0.12);
    Audio.speedUp();
    elSpeed.textContent = 'SPD ' + (newLevel + 1);
    elSpeed.classList.add('pulse');
    setTimeout(()=>elSpeed.classList.remove('pulse'), 450);
    hudC.spd = newLevel + 1;
  }

  // Physics
  player.vy += 1420 * sdt;
  if(player.vy > 740) player.vy = 740;
  player.y += player.vy * sdt;
  player.rot = clamp(player.vy / 900, -0.5, 1.0);

  if(player.y < player.r){ player.y = player.r; player.vy = Math.max(player.vy, 0); }
  if(player.y - player.r > H + 70){ die(); return; }

  // Trail
  if(G.t - lastTrail > 0.014){
    lastTrail = G.t;
    G.trail.push({ x:player.x, y:player.y, life:0.4 });
    if(G.trail.length > 16) G.trail.shift();
  }
  for(let i=G.trail.length-1;i>=0;i--){
    G.trail[i].life -= dt;
    if(G.trail[i].life <= 0) G.trail.splice(i,1);
  }

  // === SPAWN: thời gian co giãn theo speed ===
  G.spawnDist -= liveSpeed * sdt;
  if(G.spawnDist <= 0){
    spawnObstacle();
    // speedFactor: 0 (base) → 1 (max)
    const speedFactor = clamp((liveSpeed - SPEED_BASE) / (SPEED_MAX - SPEED_BASE), 0, 1);
    const timeBetween = lerp(2.10, 1.45, speedFactor);
    G.spawnDist = liveSpeed * timeBetween;
  }

  // ---- OBSTACLES ----
  for(let i=G.obstacles.length-1;i>=0;i--){
    const o = G.obstacles[i];
    o.x -= liveSpeed * sdt;

    const overlapX = (player.x + player.hitR > o.x) && (player.x - player.hitR < o.x + o.w);
    if(overlapX){
      const dTop = Math.abs(player.y - o.gapY);
      const dBot = Math.abs(player.y - (o.gapY + o.gapH));
      o.minDist = Math.min(o.minDist, dTop, dBot);
      if(player.y - player.hitR < o.gapY || player.y + player.hitR > o.gapY + o.gapH){
        if(G.shield > 0){
          G.shield = 0;
          G.shake = 0.9; G.flash = 0.6; G.chroma = 0.8;
          burst(o.x + o.w/2, player.y, 32, '#7af0ff', 1.4);
          toast('SHIELD BROKEN', '#7af0ff');
          Audio.hit();
          G.perfectStreak = 0;
          G.obstacles.splice(i,1);
          continue;
        }
        die(); return;
      }
    }

    if(!o.passed && o.x + o.w < player.x - player.hitR){
      o.passed = true;
      G.gates++; G.combo++;
      const mult = comboMult();
      const base = 10 * mult;
      G.score += base;

      const gapCenter = o.gapY + o.gapH/2;
      const distFromCenter = Math.abs(player.y - gapCenter);

      // PERFECT PASS
      if(distFromCenter < 22){
        G.score += 50;
        G.perfectStreak++;
        burst(player.x, player.y, 16, '#ffd93d', 0.95);
        ripple(player.x, player.y, '#ffd93d');
        Audio.perfect();
        G.flash = Math.max(G.flash, 0.25);
        updateHUD(true);

        if(G.perfectStreak >= 10){
          const bonus = 500;
          G.score += bonus;
          G.flash = Math.max(G.flash, 0.9);
          G.shake = Math.max(G.shake, 0.6);
          G.chroma = 1;
          popup(W/2, H*0.38, 'PERFECT ×10', '#ffd93d', 44);
          popup(W/2, H*0.38 + 60, '+' + bonus, '#ff2bd6', 30);
          toast('STREAK!', '#ffd93d');
          Audio.perfectStreak();
          ripple(player.x, player.y, '#ffd93d');
          G.perfectStreak = 0;
        }
      }
      // NEAR MISS
      else if(o.minDist < player.hitR + 30){
        G.score += 25;
        G.shake = Math.max(G.shake, 0.25);
        burst(player.x, player.y, 12, b.accent2, 1.0);
        Audio.near();
        G.perfectStreak = 0;
      }
      // PASS THƯỜNG
      else {
        burst(player.x - 15, player.y, 5, b.accent, 0.5);
        Audio.pass();
        G.perfectStreak = 0;
      }

      if(G.combo > G.bestCombo) G.bestCombo = G.combo;

      // MILESTONE
      if(G.gates % 10 === 0){
        G.flash = Math.max(G.flash, 0.9);
        G.shake = Math.max(G.shake, 0.7);
        G.chroma = 1;
        const bonus = G.gates * 5;
        G.score += bonus;
        popup(W/2, H*0.38, G.gates + ' CỔNG!', '#ff2bd6', 44);
        popup(W/2, H*0.38 + 60, '+' + bonus, '#ffd93d', 26);
        toast(G.gates + ' GATES!', '#ff2bd6');
        Audio.milestone();
        ripple(player.x, player.y, '#ff2bd6');
      }
      updateHUD(true);
    }
    if(o.x + o.w < -90) G.obstacles.splice(i,1);
  }

  // ---- ITEMS ----
  for(let i=G.items.length-1;i>=0;i--){
    const it = G.items[i];
    it.x -= liveSpeed * sdt;
    const dx = player.x - it.x, dy = player.y - it.y;
    const rr = player.hitR + it.r + 6;
    if(dx*dx + dy*dy < rr*rr){
      collect(it); G.items.splice(i,1); continue;
    }
    if(it.x < -70) G.items.splice(i,1);
  }
}

/* =========================================================
   RENDER
   ========================================================= */
function render(){
  const b = biome();
  const comboLevel = Math.min(G.combo / 20, 1);
  // Speed ratio 0→1 để tăng intensity visuals
  const speedRatio = clamp((G.lastSpeed - SPEED_BASE) / (SPEED_MAX - SPEED_BASE), 0, 1);

  ctx.save();
  if(G.shake > 0){
    const s = G.shake * 16;
    ctx.translate((Math.random()-0.5)*s, (Math.random()-0.5)*s);
  }

  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, b.bg); g.addColorStop(1, b.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(-40,-40,W+80,H+80);

  if(comboLevel > 0.1 && G.mode === 'playing'){
    const pulse = (Math.sin(G.t*4)*0.5 + 0.5) * comboLevel * 0.15;
    ctx.fillStyle = b.accent;
    ctx.globalAlpha = pulse;
    ctx.fillRect(-40,-40,W+80,H+80);
    ctx.globalAlpha = 1;
  }

  // Stars — to hơn + sáng hơn khi speed cao
  ctx.fillStyle = b.accent;
  for(const s of G.stars){
    ctx.globalAlpha = 0.10 + s.z * 0.55 + speedRatio * 0.15;
    ctx.fillRect(s.x, s.y, s.s * (1 + speedRatio * 0.3), s.s * (1 + speedRatio * 0.3));
  }
  ctx.globalAlpha = 1;

  for(const o of G.obstacles){
    const isBreather = o.pattern === 'breather';
    ctx.shadowBlur = 18 + comboLevel*12 + speedRatio*8;
    ctx.shadowColor = b.accent;
    ctx.fillStyle = b.accent;
    roundRect(o.x, -40, o.w, o.gapY + 40, 10); ctx.fill();
    roundRect(o.x, o.gapY + o.gapH, o.w, H - o.gapY - o.gapH + 80, 10); ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    roundRect(o.x + 8, -40, o.w-16, o.gapY + 40, 6); ctx.fill();
    roundRect(o.x + 8, o.gapY + o.gapH, o.w-16, H - o.gapY - o.gapH + 80, 6); ctx.fill();

    ctx.shadowBlur = 22;
    ctx.shadowColor = isBreather ? '#ffd93d' : b.accent2;
    ctx.fillStyle = isBreather ? '#ffd93d' : b.accent2;
    ctx.globalAlpha = 0.9;
    roundRect(o.x - 3, o.gapY - 5, o.w + 6, 5, 3); ctx.fill();
    roundRect(o.x - 3, o.gapY + o.gapH, o.w + 6, 5, 3); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  for(const it of G.items){
    const pulse = 1 + Math.sin(G.t*6 + it.pulse) * 0.15;
    let col = '#ffd93d', label = '';
    if(it.type === 'shield'){ col = '#7af0ff'; label = 'S'; }
    else if(it.type === 'slow'){ col = '#b06bff'; label = 'T'; }

    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.scale(pulse, pulse);
    ctx.shadowBlur = 24; ctx.shadowColor = col;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0,0,it.r,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#05060f';
    ctx.beginPath(); ctx.arc(0,0,it.r*0.62,0,Math.PI*2); ctx.fill();
    if(label){
      ctx.fillStyle = col;
      ctx.font = '800 14px system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 1);
    } else {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0,0,it.r*0.32,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  const trailBoost = 1 + comboLevel * 1.5;
  for(let i=0;i<G.trail.length;i++){
    const t = G.trail[i];
    const k = i / Math.max(1, G.trail.length-1);
    ctx.globalAlpha = (t.life/0.4) * 0.4 * k * trailBoost;
    ctx.fillStyle = G.combo >= 10 ? '#ffd93d' : b.accent;
    ctx.beginPath();
    ctx.arc(t.x, t.y, player.r * (0.25 + 0.9*k) * trailBoost, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for(const r of G.ripples){
    ctx.globalAlpha = r.life * 0.6;
    ctx.strokeStyle = r.color; ctx.lineWidth = 3;
    ctx.shadowBlur = 20; ctx.shadowColor = r.color;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.rot);

  if(comboLevel > 0.15){
    ctx.globalAlpha = 0.35 * comboLevel;
    ctx.fillStyle = '#ffd93d';
    ctx.shadowBlur = 40; ctx.shadowColor = '#ffd93d';
    ctx.beginPath();
    ctx.arc(0, 0, player.r + 12 + Math.sin(G.t*8)*3, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  ctx.shadowBlur = 26 + speedRatio * 10; ctx.shadowColor = b.accent;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0,0,player.r,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = G.combo >= 10 ? '#ffd93d' : b.accent;
  ctx.beginPath(); ctx.arc(0,0,player.r*0.6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#05060f';
  ctx.beginPath(); ctx.arc(player.r*0.28, -player.r*0.22, player.r*0.22, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  if(G.shield > 0){
    const a = G.shield < 3 ? (Math.sin(G.t*22)*0.4 + 0.6) : 1;
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = '#7af0ff'; ctx.lineWidth = 3;
    ctx.shadowBlur = 22; ctx.shadowColor = '#7af0ff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 12 + Math.sin(G.t*5)*2, 0, Math.PI*2);
    ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  for(const p of G.particles){
    ctx.globalAlpha = clamp(p.life / 0.7, 0, 1);
    ctx.fillStyle = p.color;
    if(p.glow){ ctx.shadowBlur = 14; ctx.shadowColor = p.color; }
    else ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;

  if(G.flash > 0){
    ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.22})`;
    ctx.fillRect(-40,-40,W+80,H+80);
  }

  if(G.chroma > 0.1){
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = G.chroma * 0.35;
    ctx.fillStyle = '#ff0044';
    ctx.fillRect(-6*G.chroma, 0, W, H);
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(6*G.chroma, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  for(const p of G.popups){
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${p.size}px system-ui,sans-serif`;
    ctx.shadowBlur = 20; ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;

  if(G.toastT > 0){
    const a = Math.min(1, G.toastT / 0.5);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 20px system-ui,sans-serif';
    ctx.shadowBlur = 22;
    ctx.shadowColor = G.toastColor || b.accent2;
    ctx.fillStyle = G.toastColor || b.accent2;
    ctx.fillText(G.toast, W/2, H*0.2);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  if(G.slowmo > 0){
    ctx.globalAlpha = Math.min(0.5, G.slowmo) * 0.5;
    ctx.strokeStyle = '#b06bff'; ctx.lineWidth = 16;
    ctx.strokeRect(0,0,W,H);
    ctx.globalAlpha = 1;
  }

  if(comboLevel > 0.3){
    ctx.globalAlpha = comboLevel * 0.4 * (Math.sin(G.t*6) * 0.3 + 0.7);
    ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W-4, H-4);
    ctx.globalAlpha = 1;
  }

  // Viền cam mờ khi speed cao — dấu hiệu "đang bay nhanh"
  if(speedRatio > 0.5 && G.mode === 'playing'){
    const a = (speedRatio - 0.5) * 2;
    ctx.globalAlpha = a * 0.35 * (Math.sin(G.t*3) * 0.2 + 0.8);
    ctx.strokeStyle = '#ff9a3d';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W-12, H-12);
    ctx.globalAlpha = 1;
  }
}

/* =========================================================
   LOOP
   ========================================================= */
let lastT = 0;
function loop(t){
  requestAnimationFrame(loop);
  if(!lastT) lastT = t;
  let dt = (t - lastT) / 1000;
  lastT = t;
  dt = Math.min(dt, 0.05);
  if(G.freeze > 0) dt *= 0.15;
  G.t += dt;
  if(G.mode === 'dead') deadTimer += dt;
  update(dt);
  render();
}

/* =========================================================
   BOOT
   ========================================================= */
function init(){
  resize();
  G.stars = [];
  for(let i=0;i<130;i++){
    G.stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      z: rand(0.15, 1),
      s: rand(0.7, 2.4)
    });
  }
  reset();
  requestAnimationFrame(loop);
}
init();

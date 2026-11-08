import * as THREE from '../vendor/three.module.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Act1 } from './act1.js';
import { Act2 } from './act2.js';
import { Act3 } from './act3.js';
import { clamp, damp } from './utils.js';

const ACT_META = {
  1: { num: 'ACTO I', name: 'LA HUÍDA', fade: 'Acto I · La huída' },
  2: { num: 'ACTO II', name: 'LA CARRETERA', fade: 'Acto II · La carretera' },
  3: { num: 'ACTO III', name: 'CUERPO A CUERPO', fade: 'Acto III · Cuerpo a cuerpo' },
};

const STORY = {
  1: {
    num: 'I', title: 'La huída',
    copy: `Tu pueblo lleva tres noches sin dormir. Las sirenas se apagaron hace una hora y <strong>él</strong> ya está dentro de la valla.<br><br>
    Roba el combustible de las casas abandonadas, llega al coche del establo y <span class="accent">no dejes que te alcance</span>. La carretera es tu única salida.`,
  },
  2: {
    num: 'II', title: 'La carretera',
    copy: `El motor tose, pero arranca. Detrás de ti, los faros del camión no se separan del retrovisor.<br><br>
    Esquiva los restos de la caravana, mantén el acelerador y <span class="accent">cruza la noche hasta la ciudad</span>. Si te alcanza aquí, no habrá pelea.`,
  },
  3: {
    num: 'III', title: 'Cuerpo a cuerpo',
    copy: `La azotea huele a lluvia y a hierro. No hay coche, no hay carretera, no hay nadie más.<br><br>
    Solo tú, él y <span class="accent">todo lo que aprendiste huyendo</span>. Golpea, esquiva y termina lo que empezó en tu pueblo.`,
  },
};

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.isMobile = matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.isMobile ? 1.5 : 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);
    this.camera.position.set(0, 8, 18);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a10);
    this.scene.fog = new THREE.FogExp2(0x070a10, 0.012);

    this.audio = new AudioEngine();
    this.input = new Input(this.canvas);
    this.clock = new THREE.Clock();

    this.act = null;
    this.actIndex = 0;
    this.state = 'title';
    this.transitioning = false;
    this.actStats = {};
    this.damageTaken = 0;
    this.startedAt = 0;
    this.elapsed = 0;
    this.bestTime = Number(localStorage.getItem('uc_best') || 0);

    this._cacheUI();
    this._bindUI();
    this._bindScreens();
    this._resize();

    document.body.classList.toggle('touch', this.input.isTouch);
    this._titlePreview();

    const loading = document.getElementById('loading');
    setTimeout(() => loading.classList.add('off'), 380);
    setTimeout(() => loading.remove(), 1100);

    window.addEventListener('resize', () => this._resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });

    this.renderer.setAnimationLoop(() => this._frame());
  }

  _cacheUI() {
    const $ = (id) => document.getElementById(id);
    this.ui = {
      hud: $('hud'), hpFill: $('hp-fill'), hpNum: $('hp-num'), stamFill: $('stam-fill'), stamNum: $('stam-num'),
      objMain: $('obj-main'), objSub: $('obj-sub'), actNum: $('act-num'), actName: $('act-name'),
      compass: $('compass'), compassArrow: $('compass-arrow'), compassDist: $('compass-dist'),
      prompt: $('prompt'), toast: $('toast'), bossbar: $('bossbar'), bossFill: $('boss-fill'), bossPips: $('boss-pips'),
      hitflash: $('hitflash'), fade: $('fade'), fadeTitle: $('fade-title'), fadeTitleText: $('fade-title-text'),
      title: $('title-screen'), story: $('story-screen'), death: $('death-screen'), win: $('win-screen'), pause: $('pause-screen'),
      storyAct: $('story-act'), storyTitle: $('story-title'), storyCopy: $('story-copy'),
      deathEyebrow: $('death-eyebrow'), deathTitle: $('death-title'), deathSub: $('death-sub'),
      winStats: $('win-stats'), winSub: $('win-sub'), best: $('best-line'),
      btnAction: $('btn-action'), mute: $('mute'),
    };
    this._toastTimer = 0;
    this._promptText = '';
  }

  _bindUI() {
    document.getElementById('btn-play').addEventListener('click', () => { this.audio.init(); this.audio.ui(); this.showStory(1); });
    document.getElementById('btn-continue').addEventListener('click', () => { this.audio.ui(); this._continueStory(); });
    document.getElementById('btn-retry').addEventListener('click', () => { this.audio.ui(); this._hideScreens(); this.beginAct(this.actIndex || 1, true); });
    document.getElementById('btn-menu').addEventListener('click', () => { this.audio.ui(); this.goTitle(); });
    document.getElementById('btn-again').addEventListener('click', () => { this.audio.ui(); this.showStory(1); });
    document.getElementById('btn-win-menu').addEventListener('click', () => { this.audio.ui(); this.goTitle(); });
    document.getElementById('btn-resume').addEventListener('click', () => { this.audio.ui(); this.resume(); });
    document.getElementById('btn-restart').addEventListener('click', () => { this.audio.ui(); this._hideScreens(); this.beginAct(this.actIndex, true); });
    document.getElementById('btn-pause-menu').addEventListener('click', () => { this.audio.ui(); this.goTitle(); });
    this.ui.mute.addEventListener('click', () => {
      this.audio.init();
      this.audio.setMuted(!this.audio.muted);
      this.ui.mute.textContent = this.audio.muted ? '✕' : '♪';
      this.ui.mute.style.opacity = this.audio.muted ? '.45' : '1';
    });

    // first interaction unlocks audio
    const unlock = () => { this.audio.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  _bindScreens() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        return;
      }
      if (this.state === 'story' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        this._continueStory();
      }
    });
  }

  _continueStory() {
    const n = this.pendingAct || 1;
    this._hideScreens();
    this.beginAct(n);
  }

  _resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.act?.resize?.(innerWidth, innerHeight);
  }

  _titlePreview() {
    // slow cinematic orbit of a dark, foggy scene while on the menu
    this.previewScene = new THREE.Scene();
    this.previewScene.background = new THREE.Color(0x05070b);
    this.previewScene.fog = new THREE.FogExp2(0x05070b, 0.028);
    const g = new THREE.PlaneGeometry(140, 140, 1, 1);
    const m = new THREE.MeshStandardMaterial({ color: 0x141a22, roughness: 1 });
    const ground = new THREE.Mesh(g, m);
    ground.rotation.x = -Math.PI / 2;
    this.previewScene.add(ground);
    const light = new THREE.DirectionalLight(0x5f7ba8, 0.7);
    light.position.set(-8, 14, 6);
    this.previewScene.add(light, new THREE.HemisphereLight(0x2a3550, 0x0a0c10, 0.7));
    for (let i = 0; i < 26; i++) {
      const h = 4 + Math.random() * 22;
      const b = new THREE.Mesh(new THREE.BoxGeometry(3 + Math.random() * 6, h, 3 + Math.random() * 6),
        new THREE.MeshStandardMaterial({ color: 0x0c1119, roughness: 1 }));
      const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 46;
      b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      this.previewScene.add(b);
    }
    const amber = new THREE.PointLight(0xff8a3d, 60, 40, 2);
    amber.position.set(4, 3, 2);
    this.previewScene.add(amber);
    this._previewT = 0;
  }

  showTitle() { this.goTitle(); }

  goTitle() {
    this.audio.setAmbience({ rain: 0.1, wind: 0.18, drone: 0.1, engine: 0 });
    this.audio.setTension(0);
    this.disposeAct();
    this.state = 'title';
    this.actIndex = 0;
    this._hideScreens();
    this.ui.hud.classList.remove('on');
    this.ui.title.classList.remove('hidden');
    this.ui.fade.classList.remove('on');
    this.ui.fadeTitle.classList.remove('on');
    this.ui.mute.classList.remove('hidden');
    this._updateBestLine();
  }

  _updateBestLine() {
    if (this.bestTime > 0) {
      const m = Math.floor(this.bestTime / 60), s = Math.floor(this.bestTime % 60);
      this.ui.best.innerHTML = `Mejor tiempo <b>${m}:${String(s).padStart(2, '0')}</b>`;
    } else {
      this.ui.best.textContent = 'Tres actos. Una noche. Ninguna segunda oportunidad.';
    }
  }

  showStory(n) {
    this.pendingAct = n;
    this.state = 'story';
    this.disposeAct();
    this.ui.hud.classList.remove('on');
    this.ui.title.classList.add('hidden');
    this._hideScreens();
    const s = STORY[n];
    this.ui.storyAct.textContent = s.num;
    this.ui.storyTitle.textContent = s.title;
    this.ui.storyCopy.innerHTML = s.copy;
    this.ui.story.classList.remove('hidden');
    this.ui.fade.classList.remove('on');
    this.audio.setAmbience({ rain: 0.12, wind: 0.2, drone: 0.16, engine: 0 });
    this.audio.setTension(0);
  }

  async beginAct(n, retry = false) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.state = 'loading';
    this.actIndex = n;
    this._hideScreens();
    this.ui.hud.classList.remove('on');
    this.ui.fadeTitleText.textContent = retry ? 'Reintentando' : ACT_META[n].fade;
    this.ui.fadeTitle.classList.add('on');
    this.ui.fade.classList.add('on');
    await this._wait(560);

    this.disposeAct();
    try {
      if (n === 1) this.act = new Act1(this);
      else if (n === 2) this.act = new Act2(this);
      else this.act = new Act3(this);
    } catch (err) {
      console.error('Act build failed', err);
      this.ui.fadeTitleText.textContent = 'Error al cargar';
      await this._wait(1200);
      this.transitioning = false;
      this.goTitle();
      return;
    }

    this.camera.fov = this.act.fov || 62;
    this.camera.updateProjectionMatrix();
    this.state = 'playing';
    this.audio.setTension(0);
    this.actTime = 0;
    await this._wait(760);

    this.ui.fadeTitle.classList.remove('on');
    this.ui.fade.classList.remove('on');
    this.ui.hud.classList.add('on');
    this.ui.actNum.textContent = ACT_META[n].num;
    this.ui.actName.textContent = ACT_META[n].name;
    this.ui.bossbar.classList.remove('on');
    this.ui.compass.classList.remove('on');
    this.setBossPips(0);
    this.setActionLabel(n === 3 ? 'Golpear' : '');
    this.ui.mute.classList.add('hidden');
    this.transitioning = false;
    this.act.onStart?.();
  }

  _wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  _hideScreens() {
    for (const k of ['title', 'story', 'death', 'win', 'pause']) this.ui[k].classList.add('hidden');
  }

  disposeAct() {
    if (this.act) {
      try { this.act.dispose(); } catch (e) { console.warn(e); }
      this.act = null;
    }
  }

  pause() {
    if (this.state !== 'playing' || this.transitioning) return;
    this.state = 'paused';
    this.ui.pause.classList.remove('hidden');
    this.ui.hud.classList.remove('on');
    this.audio.setAmbience({ rain: 0.04, wind: 0.06, drone: 0.05, engine: 0 });
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.pause.classList.add('hidden');
    this.ui.hud.classList.add('on');
    this.act?.onResume?.();
    this.clock.getDelta();
  }

  setActionLabel(t) {
    this.ui.btnAction.textContent = t || 'Acción';
    this.ui.btnAction.classList.toggle('off', !t);
  }

  /* ---------------- HUD ---------------- */
  setBars(hp, hpMax, stam, stamMax) {
    const h = clamp(hp / hpMax, 0, 1);
    this.ui.hpFill.style.transform = `scaleX(${h})`;
    this.ui.hpNum.textContent = String(Math.max(0, Math.ceil(hp)));
    this.ui.hpNum.style.color = h < 0.3 ? '#ff5a4a' : '#dfe6ee';
    if (stam !== undefined) {
      this.ui.stamFill.style.transform = `scaleX(${clamp(stam / stamMax, 0, 1)})`;
      this.ui.stamNum.textContent = String(Math.max(0, Math.ceil(stam)));
    }
  }
  setObjective(main, sub = '') {
    this.ui.objMain.textContent = main;
    this.ui.objSub.textContent = sub;
  }
  toast(main, sub = '', dur = 2.2) {
    this.ui.toast.innerHTML = `${main}${sub ? `<small>${sub}</small>` : ''}`;
    this.ui.toast.classList.add('on');
    this._toastTimer = dur;
  }
  prompt(text) {
    if (text === this._promptText) return;
    this._promptText = text;
    if (text) { this.ui.prompt.textContent = text; this.ui.prompt.classList.add('on'); }
    else this.ui.prompt.classList.remove('on');
  }
  compassTo(pos, camPos, yaw) {
    if (!pos) { this.ui.compass.classList.remove('on'); return; }
    const dx = pos.x - camPos.x, dz = pos.z - camPos.z;
    const ang = Math.atan2(dx, dz);
    const rel = ((ang - yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.ui.compassArrow.style.transform = `rotate(${-rel}rad)`;
    this.ui.compassDist.textContent = `${Math.round(Math.hypot(dx, dz))} m`;
    this.ui.compass.classList.add('on');
  }
  hideCompass() { this.ui.compass.classList.remove('on'); }
  damageFlash() {
    const el = this.ui.hitflash;
    el.classList.add('on');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => el.classList.remove('on'), 90);
  }
  bossBar(hp, max, phase) {
    this.ui.bossbar.classList.add('on');
    this.ui.bossFill.style.transform = `scaleX(${clamp(hp / max, 0, 1)})`;
    this.setBossPips(phase);
  }
  hideBossBar() { this.ui.bossbar.classList.remove('on'); }
  setBossPips(n) {
    const pips = this.ui.bossPips;
    if (pips.children.length !== 3) {
      pips.innerHTML = '<b></b><b></b><b></b>';
    }
    [...pips.children].forEach((b, i) => b.classList.toggle('on', i < n));
  }

  /* ---------------- flow ---------------- */
  recordAct(n, data) { this.actStats[n] = { ...data }; }

  playerDied({ cause = 'Te alcanzó en la oscuridad.', eyebrow = 'Acto I', title = 'Has caído' }) {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.ui.hud.classList.remove('on');
    this.ui.bossbar.classList.remove('on');
    this.ui.compass.classList.remove('on');
    this.ui.deathEyebrow.textContent = eyebrow;
    this.ui.deathTitle.textContent = title;
    this.ui.deathSub.textContent = cause;
    this.ui.death.classList.remove('hidden');
    this.audio.setAmbience({ rain: 0.05, wind: 0.1, drone: 0.1, engine: 0 });
    this.audio.setTension(0);
    this.audio.death();
  }

  actComplete(n, data = {}) {
    if (this.transitioning) return;
    this.recordAct(n, data);
    if (n < 3) {
      this.audio.win();
      this.showStory(n + 1);
    } else {
      this._win();
    }
  }

  _win() {
    this.state = 'win';
    this.ui.hud.classList.remove('on');
    this.ui.bossbar.classList.remove('on');
    this.ui.compass.classList.remove('on');
    this.audio.setAmbience({ rain: 0, wind: 0.06, drone: 0.03, engine: 0 });
    this.audio.setTension(0);
    const total = (this.actStats[1]?.time || 0) + (this.actStats[2]?.time || 0) + (this.actStats[3]?.time || 0);
    if (!this.bestTime || total < this.bestTime) {
      this.bestTime = total;
      localStorage.setItem('uc_best', String(total));
    }
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    const dmg = this.actStats[1]?.damage || 0;
    this.ui.winSub.textContent = 'El Segador ya no volverá a levantarse. La ciudad es tuya hasta el amanecer.';
    this.ui.winStats.innerHTML = `
      <div class="stat"><b>${fmt(total)}</b><span>Tiempo total</span></div>
      <div class="stat"><b>${Math.round(dmg)}</b><span>Daño recibido</span></div>
      <div class="stat"><b>2.4 km</b><span>Carretera</span></div>
      <div class="stat"><b>III / III</b><span>Actos</span></div>`;
    this.ui.win.classList.remove('hidden');
    this.audio.win();
  }

  /* ---------------- loop ---------------- */
  _frame() {
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.05);
    this.input.update();
    this.audio.update(dt);

    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.ui.toast.classList.remove('on');
    }

    if (this.state === 'playing' && this.act) {
      this.elapsed += dt;
      this.actTime += dt;
      this.act.update(dt);
    } else if (this.state === 'title' || this.state === 'story') {
      this._updatePreview(dt);
    }

    this.input.endFrame();

    if (this.state === 'title' || this.state === 'story' || this.state === 'loading') {
      this.renderer.render(this.previewScene || this.scene, this.camera);
    } else {
      this.renderer.render(this.act?.scene || this.scene, this.camera);
    }
  }

  _updatePreview(dt) {
    this._previewT += dt;
    const t = this._previewT * 0.045;
    this.camera.position.set(Math.cos(t) * 26, 9 + Math.sin(t * 0.7) * 2, Math.sin(t) * 26);
    this.camera.lookAt(0, 4, 0);
    this.camera.fov = 55;
    this.camera.updateProjectionMatrix();
    if (this.previewScene) {
      const amber = this.previewScene.children.find((c) => c.isPointLight);
      if (amber) amber.intensity = 45 + Math.sin(this._previewT * 2.2) * 12;
    }
  }
}

const game = new Game();
window.__game = game;

// prevent iOS double-tap zoom / context menus on the canvas
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

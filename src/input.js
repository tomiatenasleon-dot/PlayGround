export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.just = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.sprint = false;
    this.crouch = false;
    this.dragging = false;
    this.pointerLocked = false;
    this.sensitivity = 0.0026;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.enabled = true;
    this.stick = { active: false, id: null, x: 0, y: 0, cx: 0, cy: 0 };
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) e.preventDefault();
      if (!this.keys.has(code)) this.just.add(code);
      this.keys.add(code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.dragging = false; });

    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'mouse') {
        this.dragging = true;
        el.setPointerCapture?.(e.pointerId);
        if (e.button === 0) this.just.add('MouseAttack');
      }
    });
    window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') this.dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'mouse' && this.dragging) {
        this.look.x += e.movementX * this.sensitivity;
        this.look.y += e.movementY * this.sensitivity;
      }
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    // touch look (right side of screen, outside controls)
    let lookId = null, lx = 0, ly = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || !this.enabled) return;
      if (lookId !== null) return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      this.just.add('TouchAttack');
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      this.look.x += dx * 0.0055;
      this.look.y += dy * 0.0055;
    });
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
    window.addEventListener('pointerup', endLook);
    window.addEventListener('pointercancel', endLook);

    this._bindTouchStick();
    this._bindButtons();
  }

  _bindTouchStick() {
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    if (!stick) return;
    const R = 46;
    const setKnob = (x, y) => { knob.style.transform = `translate(${x * R}px, ${y * R}px)`; };
    const move = (e) => {
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      this.stick.x = dx / R; this.stick.y = dy / R;
      setKnob(this.stick.x, this.stick.y);
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.stick.active = true; this.stick.id = e.pointerId;
      stick.setPointerCapture?.(e.pointerId);
      move(e);
    });
    stick.addEventListener('pointermove', (e) => {
      if (!this.stick.active || e.pointerId !== this.stick.id) return;
      e.preventDefault(); move(e);
    });
    const end = (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.active = false; this.stick.id = null;
      this.stick.x = this.stick.y = 0;
      setKnob(0, 0);
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    stick.addEventListener('pointerleave', (e) => { if (e.buttons === 0) end(e); });
  }

  _bindButtons() {
    const hold = (id, key) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        b.setPointerCapture?.(e.pointerId);
        this.keys.add(key); this.just.add(key);
      });
      const up = (e) => { e.preventDefault(); this.keys.delete(key); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', (e) => { if (e.buttons === 0) this.keys.delete(key); });
    };
    hold('btn-sprint', 'ShiftLeft');
    hold('btn-dodge', 'Space');
    hold('btn-action', 'KeyJ');
  }

  get isTouch() { return this.touch; }

  update() {
    let mx = 0, my = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.stick.active) {
      mx += this.stick.x;
      my += this.stick.y;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx;
    this.move.y = my;
    this.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    this.crouch = this.keys.has('KeyC') || this.keys.has('ControlLeft');
  }

  pressed(code) { return this.just.has(code); }
  attackPressed() { return this.just.has('KeyJ') || this.just.has('MouseAttack'); }
  interactPressed() { return this.just.has('KeyE'); }
  dodgePressed() { return this.just.has('Space'); }

  endFrame() {
    this.just.clear();
    this.look.x = 0;
    this.look.y = 0;
  }
}

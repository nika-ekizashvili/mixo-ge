/* =========================================================
   მიხო — ხინკლის სათავგადასავლო (Super Mikho)
   A Mario-style platformer with a Georgian/Kakhetian theme.
   - Hero: Mikho (mustache, Georgian hat, cross necklace)
   - Collectibles: Khinkali (instead of mushrooms/coins)
   - Enemies: Dwarf Qizilbash (ჯუჯა ყიზილბაშები)
   - This file ships the FIRST LEVEL (პირველი ტური).
   ========================================================= */

(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start-btn");

  // ---- Tunables ----
  const GRAVITY = 0.7;
  const MOVE_SPEED = 3.4;
  const JUMP_VELOCITY = -13.5;
  const TILE = 40;

  // ---- Input ----
  const keys = { left: false, right: false, jump: false };
  const keyMap = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "jump", KeyW: "jump", Space: "jump",
  };
  window.addEventListener("keydown", (e) => {
    const k = keyMap[e.code];
    if (k) { keys[k] = true; e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => {
    const k = keyMap[e.code];
    if (k) { keys[k] = false; e.preventDefault(); }
  });

  // =========================================================
  //  LEVEL 1 (პირველი ტური)
  //  Legend in the tilemap rows:
  //   X = solid ground/brick   #=floating platform
  //   K = khinkali collectible  Q = qizilbash enemy
  //   C = goal (cross/jvari)    . = empty
  // =========================================================
  const LEVEL_1 = [
    "..............................................................",
    "..............................................................",
    "..............................................................",
    "...................K..........................................",
    "..............................................................",
    "..........K......####..........K....K.........................",
    "..............................................................",
    ".......####.........................####...........K..........",
    "...............K..........Q.....................######........",
    "....K....................................K....................",
    "........####.......####.......Q.......####...........Q.....C..",
    "..........................................................X...",
    "XXXXXXXXXXXXXXXXXXXXXXXX...XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "XXXXXXXXXXXXXXXXXXXXXXXX...XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  ];

  // ---- Game state ----
  let solids = [];      // {x,y,w,h}
  let khinkali = [];    // {x,y,r,bob,taken}
  let enemies = [];     // {x,y,w,h,vx,alive,...}
  let goal = null;      // {x,y,w,h}
  let levelPixelWidth = 0;

  let player;
  let camera = { x: 0 };
  let score = 0;
  let lives = 3;
  let level = 1;
  let running = false;
  let message = null;     // {text, color, until}

  function resetPlayer(spawnX, spawnY) {
    player = {
      x: spawnX, y: spawnY,
      w: 26, h: 38,
      vx: 0, vy: 0,
      onGround: false,
      facing: 1,
      walkTime: 0,
      invuln: 0,
      dead: false,
    };
  }

  function buildLevel(map) {
    solids = [];
    khinkali = [];
    enemies = [];
    goal = null;

    const rows = map.length;
    const cols = map[0].length;
    levelPixelWidth = cols * TILE;
    const offsetY = H - rows * TILE; // align map to bottom

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const ch = map[r][c];
        const x = c * TILE;
        const y = offsetY + r * TILE;
        switch (ch) {
          case "X":
            solids.push({ x, y, w: TILE, h: TILE, type: "ground" });
            break;
          case "#":
            solids.push({ x, y, w: TILE, h: TILE, type: "platform" });
            break;
          case "K":
            khinkali.push({ x: x + TILE / 2, y: y + TILE / 2, r: 13, bob: Math.random() * Math.PI * 2, taken: false });
            break;
          case "Q":
            enemies.push({
              x: x + 4, y: y + 6, w: 32, h: 34,
              vx: -1.1, alive: true, squashTime: 0, walkTime: Math.random() * 10,
            });
            break;
          case "C":
            goal = { x: x + 8, y: y - TILE, w: 24, h: TILE * 2 };
            break;
        }
      }
    }
    resetPlayer(TILE, offsetY + (rows - 4) * TILE);
    camera.x = 0;
  }

  // ---- Collision helpers ----
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function moveAndCollide() {
    const p = player;

    // Horizontal
    p.x += p.vx;
    for (const s of solids) {
      if (aabb(p, s)) {
        if (p.vx > 0) p.x = s.x - p.w;
        else if (p.vx < 0) p.x = s.x + s.w;
        p.vx = 0;
      }
    }
    if (p.x < 0) p.x = 0;
    if (p.x + p.w > levelPixelWidth) p.x = levelPixelWidth - p.w;

    // Vertical
    p.vy += GRAVITY;
    if (p.vy > 18) p.vy = 18;
    p.y += p.vy;
    p.onGround = false;
    for (const s of solids) {
      if (aabb(p, s)) {
        if (p.vy > 0) { p.y = s.y - p.h; p.onGround = true; }
        else if (p.vy < 0) { p.y = s.y + s.h; }
        p.vy = 0;
      }
    }
  }

  // ---- Update ----
  function update() {
    const p = player;
    if (p.dead) return;

    // input -> velocity
    p.vx = 0;
    if (keys.left) { p.vx = -MOVE_SPEED; p.facing = -1; }
    if (keys.right) { p.vx = MOVE_SPEED; p.facing = 1; }
    if (keys.jump && p.onGround) { p.vy = JUMP_VELOCITY; p.onGround = false; }

    if (p.vx !== 0) p.walkTime += 0.25;
    if (p.invuln > 0) p.invuln--;

    moveAndCollide();

    // fell off the world
    if (p.y > H + 200) return loseLife();

    // khinkali pickup
    for (const k of khinkali) {
      if (k.taken) continue;
      k.bob += 0.08;
      const kbox = { x: k.x - k.r, y: k.y - k.r, w: k.r * 2, h: k.r * 2 };
      if (aabb(p, kbox)) {
        k.taken = true;
        score++;
        scoreEl.textContent = score;
        flash("🥟 +1", "#f3c14b");
      }
    }

    // enemies
    for (const e of enemies) {
      if (!e.alive) {
        e.squashTime++;
        continue;
      }
      e.walkTime += 0.2;
      e.x += e.vx;

      // turn at edges/walls: check for ground ahead and wall hits
      let hitWall = false;
      for (const s of solids) {
        if (aabb(e, s)) {
          if (e.vx > 0) e.x = s.x - e.w; else e.x = s.x + s.w;
          hitWall = true;
        }
      }
      // ledge detection
      const aheadX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
      const footY = e.y + e.h + 4;
      let groundAhead = false;
      for (const s of solids) {
        if (aheadX >= s.x && aheadX <= s.x + s.w && footY >= s.y && footY <= s.y + s.h) {
          groundAhead = true; break;
        }
      }
      if (hitWall || !groundAhead) e.vx *= -1;

      // collision with player
      if (p.invuln === 0 && aabb(p, e)) {
        const stomped = p.vy > 0 && (p.y + p.h) - e.y < 20;
        if (stomped) {
          e.alive = false;
          p.vy = JUMP_VELOCITY * 0.6; // bounce
          score += 2;
          scoreEl.textContent = score;
          flash("💥 ჯუჯა დაიმარცხა!", "#e23b2e");
        } else {
          loseLife();
          return;
        }
      }
    }

    // reached the cross (goal)
    if (goal && aabb(p, goal)) {
      winLevel();
      return;
    }

    // camera follows player
    const target = p.x - W * 0.4;
    camera.x = Math.max(0, Math.min(target, levelPixelWidth - W));
  }

  function loseLife() {
    lives--;
    livesEl.textContent = Math.max(0, lives);
    player.dead = true;
    if (lives <= 0) {
      endGame(false);
    } else {
      flash("ვაი! სცადე თავიდან", "#e23b2e");
      setTimeout(() => { buildLevel(LEVEL_1); }, 900);
    }
  }

  function winLevel() {
    player.dead = true;
    running = false;
    flash("🏁 გაიმარჯვე!", "#f3c14b");
    setTimeout(() => endGame(true), 400);
  }

  function flash(text, color) {
    message = { text, color, until: performance.now() + 1100 };
  }

  // =========================================================
  //  RENDERING
  // =========================================================
  function drawBackground() {
    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#7ec0ff");
    g.addColorStop(1, "#bfe3ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // distant Caucasus mountains (parallax)
    const px = camera.x * 0.3;
    ctx.fillStyle = "#9fb6c9";
    for (let i = -1; i < 8; i++) {
      const mx = i * 260 - (px % 260);
      ctx.beginPath();
      ctx.moveTo(mx, H);
      ctx.lineTo(mx + 130, H - 200);
      ctx.lineTo(mx + 260, H);
      ctx.closePath();
      ctx.fill();
    }
    // snow caps
    ctx.fillStyle = "#ffffff";
    for (let i = -1; i < 8; i++) {
      const mx = i * 260 - (px % 260);
      ctx.beginPath();
      ctx.moveTo(mx + 105, H - 162);
      ctx.lineTo(mx + 130, H - 200);
      ctx.lineTo(mx + 155, H - 162);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawSolids() {
    for (const s of solids) {
      const x = s.x - camera.x;
      if (x + s.w < 0 || x > W) continue;
      if (s.type === "platform") {
        ctx.fillStyle = "#caa15a";
        ctx.fillRect(x, s.y, s.w, s.h);
        ctx.fillStyle = "#9b7838";
        ctx.fillRect(x, s.y, s.w, 6);
      } else {
        // ground/brick with vine pattern (Kakheti = wine country)
        ctx.fillStyle = "#7a4a26";
        ctx.fillRect(x, s.y, s.w, s.h);
        ctx.fillStyle = "#8d5a30";
        ctx.fillRect(x + 2, s.y + 2, s.w - 4, s.h - 4);
        ctx.strokeStyle = "#5e3819";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, s.y + 2, s.w - 4, s.h - 4);
        // top grass
        if (!solidAbove(s)) {
          ctx.fillStyle = "#4caf50";
          ctx.fillRect(x, s.y, s.w, 7);
        }
      }
    }
  }

  function solidAbove(s) {
    return solids.some(o => o !== s && o.x === s.x && o.y === s.y - TILE);
  }

  function drawKhinkali(k) {
    if (k.taken) return;
    const x = k.x - camera.x;
    const y = k.y + Math.sin(k.bob) * 4;
    if (x + k.r < 0 || x - k.r > W) return;

    // dumpling body
    ctx.fillStyle = "#f7f1e1";
    ctx.beginPath();
    ctx.arc(x, y + 2, k.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d8caa6";
    ctx.lineWidth = 2;
    ctx.stroke();

    // pleats
    ctx.strokeStyle = "#cbbd95";
    ctx.lineWidth = 1.5;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x + Math.cos(a) * (k.r - 2), y - 3 + Math.sin(a) * (k.r - 2));
      ctx.stroke();
    }
    // top twist (knob)
    ctx.fillStyle = "#e9dcb8";
    ctx.beginPath();
    ctx.arc(x, y - k.r + 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawQizilbash(e) {
    const x = e.x - camera.x;
    const y = e.y;
    if (x + e.w < 0 || x > W) return;

    if (!e.alive) {
      // squashed
      ctx.fillStyle = "#7a3b3b";
      ctx.fillRect(x, y + e.h - 8, e.w, 8);
      return;
    }

    const bob = Math.sin(e.walkTime) * 2;
    const cx = x + e.w / 2;

    // stubby body (dwarf) - dark red Safavid coat
    ctx.fillStyle = "#9b2d2d";
    ctx.fillRect(x + 4, y + 14 + bob, e.w - 8, e.h - 14);
    // belt
    ctx.fillStyle = "#3a2410";
    ctx.fillRect(x + 4, y + e.h - 8 + bob, e.w - 8, 4);

    // head
    ctx.fillStyle = "#e3b78c";
    ctx.beginPath();
    ctx.arc(cx, y + 12 + bob, 9, 0, Math.PI * 2);
    ctx.fill();

    // angry brow + eyes (facing movement)
    const dir = e.vx > 0 ? 1 : -1;
    ctx.fillStyle = "#222";
    ctx.fillRect(cx - 5 + dir * 1, y + 9 + bob, 3, 3);
    ctx.fillRect(cx + 2 + dir * 1, y + 9 + bob, 3, 3);

    // the iconic Qizilbash taj — tall red cap with 12 gores + white turban base
    ctx.fillStyle = "#cf3b2f";
    ctx.beginPath();
    ctx.moveTo(cx - 7, y + 4 + bob);
    ctx.lineTo(cx, y - 16 + bob);
    ctx.lineTo(cx + 7, y + 4 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#7d1c14";
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i += 3) {
      ctx.beginPath();
      ctx.moveTo(cx, y - 16 + bob);
      ctx.lineTo(cx + i, y + 4 + bob);
      ctx.stroke();
    }
    // white turban wrap at base
    ctx.fillStyle = "#f1ece0";
    ctx.fillRect(cx - 8, y + 3 + bob, 16, 4);
  }

  function drawGoal() {
    if (!goal) return;
    const x = goal.x - camera.x;
    // pole
    ctx.fillStyle = "#b9b9b9";
    ctx.fillRect(x + goal.w / 2 - 2, goal.y, 4, goal.h);
    // Georgian cross (jvari) on top — golden
    ctx.fillStyle = "#f3c14b";
    const cx = x + goal.w / 2;
    const top = goal.y - 4;
    ctx.fillRect(cx - 3, top, 6, 26);       // vertical
    ctx.fillRect(cx - 11, top + 8, 22, 6);  // horizontal
    ctx.strokeStyle = "#a9821f";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 3, top, 6, 26);
    ctx.strokeRect(cx - 11, top + 8, 22, 6);
  }

  function drawMikho() {
    const p = player;
    const x = p.x - camera.x;
    const y = p.y;
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) return; // blink

    const cx = x + p.w / 2;
    const step = p.onGround && p.vx !== 0 ? Math.sin(p.walkTime) * 3 : 0;
    const dir = p.facing;

    // legs (dark trousers)
    ctx.fillStyle = "#2b2b35";
    ctx.fillRect(cx - 9, y + 28, 7, 10 + step);
    ctx.fillRect(cx + 2, y + 28, 7, 10 - step);

    // chokha (traditional black coat)
    ctx.fillStyle = "#23232b";
    ctx.fillRect(x, y + 12, p.w, 18);
    // belt
    ctx.fillStyle = "#5a3a1a";
    ctx.fillRect(x, y + 26, p.w, 3);
    // bandolier pockets (masri) on chest
    ctx.fillStyle = "#3a3a44";
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * 5, y + 15, 3, 7);

    // cross necklace (jvari) on chest — silver
    ctx.fillStyle = "#dfe6ee";
    ctx.fillRect(cx - 1, y + 22, 2, 6);
    ctx.fillRect(cx - 3, y + 24, 6, 2);

    // head
    ctx.fillStyle = "#e9c39a";
    ctx.beginPath();
    ctx.arc(cx, y + 7, 9, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(cx + dir * 1 - 4, y + 5, 2, 3);
    ctx.fillRect(cx + dir * 1 + 2, y + 5, 2, 3);

    // big Kakhetian mustache (ულვაში)
    ctx.strokeStyle = "#2a1d12";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 6, y + 10);
    ctx.quadraticCurveTo(cx - 9, y + 14, cx - 11, y + 12);
    ctx.moveTo(cx + 6, y + 10);
    ctx.quadraticCurveTo(cx + 9, y + 14, cx + 11, y + 12);
    ctx.stroke();

    // Georgian wool hat (კახური ქუდი) — flat black felt
    ctx.fillStyle = "#15151a";
    ctx.beginPath();
    ctx.ellipse(cx, y - 1, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 9, y - 4, 18, 4);
  }

  function drawMessage() {
    if (!message) return;
    if (performance.now() > message.until) { message = null; return; }
    ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeText(message.text, W / 2, 70);
    ctx.fillStyle = message.color;
    ctx.fillText(message.text, W / 2, 70);
    ctx.textAlign = "left";
  }

  function render() {
    drawBackground();
    drawSolids();
    for (const k of khinkali) drawKhinkali(k);
    drawGoal();
    for (const e of enemies) drawQizilbash(e);
    drawMikho();
    drawMessage();
  }

  // ---- Main loop ----
  function loop() {
    if (running) update();
    render();
    requestAnimationFrame(loop);
  }

  // ---- Game flow ----
  function startGame() {
    score = 0;
    lives = 3;
    level = 1;
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    levelEl.textContent = level;
    buildLevel(LEVEL_1);
    overlay.classList.add("hidden");
    running = true;
  }

  function endGame(won) {
    running = false;
    overlay.classList.remove("hidden");
    overlay.innerHTML = won
      ? `<h1 style="color:#f3c14b">🏁 გამარჯვება!</h1>
         <p class="subtitle">მიხომ დაამარცხა ჯუჯა ყიზილბაშები!</p>
         <p class="story">შეგროვებული ხინკალი: <b>${score}</b> 🥟</p>
         <button id="start-btn">თავიდან თამაში</button>`
      : `<h1 style="color:#e23b2e">თამაში დასრულდა</h1>
         <p class="subtitle">მიხო დაეცა...</p>
         <p class="story">შეგროვებული ხინკალი: <b>${score}</b> 🥟</p>
         <button id="start-btn">კიდევ სცადე</button>`;
    document.getElementById("start-btn").addEventListener("click", startGame);
  }

  startBtn.addEventListener("click", startGame);

  // boot
  buildLevel(LEVEL_1);
  render();
  loop();
})();

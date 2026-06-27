let playerData = JSON.parse(localStorage.getItem('chromashift_save')) || { username: "Guest Player", email: "" };
let adminList = [], currentSelectedTool = null, isUserAdmin = false, currentActiveMode = "singleplayer", gameActive = false;

const MAP_SIZE = 5000, GRID_SIZE = 50;   
let camera = { x: 2500, y: 2500 }, zoomLevel = 1.1, keysPressed = {};

// MECCHA CHAMELEON MODE CONFIGURATIONS
let character = { 
    x: 2500, y: 2450, size: 22, speed: 4.5, 
    role: "hider", 
    currentPose: "stand", // stand, crouch, ball, flat
    bodyPaint: ["#ffffff", "#ffffff", "#ffffff", "#ffffff"], // 4-Quadrant surface layers
    selectedColor: "#ff0000",
    activePaintTool: null, // null, "brush"
    whistleRipple: 0
};

let joystick = { active: false, startX: 0, startY: 0, curX: 0, curY: 0, moveX: 0, moveY: 0 };

window.addEventListener("keydown", (e) => { 
    if (document.activeElement.tagName !== 'INPUT') {
        keysPressed[e.key.toLowerCase()] = true;
        if (e.key.toLowerCase() === 'f' && gameActive && character.role === "hider") togglePaintMode();
        if (e.key.toLowerCase() === 'r' && gameActive && character.role === "hider") cyclePoses();
        if (e.key.toLowerCase() === 't' && gameActive && character.role === "hider") triggerTauntWhistle();
    }
});
window.addEventListener("keyup", (e) => { keysPressed[e.key.toLowerCase()] = false; });

// Generation of high-density prop matrix maps
let mapBlocks = [];
function generateMecchaMap() {
    mapBlocks = [];
    for(let x=0; x<MAP_SIZE; x+=100) { mapBlocks.push({x, y:0, type:'wall'}, {x, y:MAP_SIZE-50, type:'wall'}); }
    for(let y=0; y<MAP_SIZE; y+=100) { mapBlocks.push({x:0, y, type:'wall'}, {x:MAP_SIZE-50, y, type:'wall'}); }
    
    for(let i=0; i<45; i++) {
        let rx = Math.floor((Math.random() * (MAP_SIZE - 500) + 250)/50)*50;
        let ry = Math.floor((Math.random() * (MAP_SIZE - 500) + 250)/50)*50;
        let randomType = ['wall', 'floor', 'neon', 'gold'][Math.floor(Math.random()*4)];
        for(let w=0; w<3; w++) {
            for(let h=0; h<3; h++) { mapBlocks.push({ x: rx + (w*50), y: ry + (h*50), type: randomType }); }
        }
    }
}
generateMecchaMap();

let entities = [];
function spawnMatchPlayers() {
    entities = [];
    for(let i=0; i<8; i++) {
        entities.push({
            x: 2300 + Math.random()*400, y: 2300 + Math.random()*400,
            role: i === 0 ? "seeker" : "hider",
            bodyPaint: [getRandomColor(), getRandomColor(), getRandomColor(), getRandomColor()],
            currentPose: ["stand", "crouch", "ball"][Math.floor(Math.random()*3)],
            size: 22, tx: 0, ty: 0, timer: 0
        });
    }
}

const canvas = document.getElementById("gameCanvas"), ctx = canvas.getContext("2d");
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener("resize", resizeCanvas); resizeCanvas();

async function loadAdminFile() {
    try {
        const r = await fetch('admins.json'), f = await r.json();
        let localAdmins = JSON.parse(localStorage.getItem('chromashift_admins')) || [];
        adminList = [...new Set([...f, ...localAdmins])];
    } catch (e) { adminList = JSON.parse(localStorage.getItem('chromashift_admins')) || []; }
    checkAdminStatus();
}

function checkAdminStatus() {
    let currentEmail = (playerData.email || "").toLowerCase();
    let currentName = (playerData.username || "").toLowerCase();
    
    isUserAdmin = adminList.some(admin => {
        let a = admin.toLowerCase();
        return currentEmail === a || currentName === a;
    }) || currentName.includes("xian") || currentName.includes("ariel") || currentEmail.includes("markerielhdeleon");

    document.getElementById('adminBadge').style.display = isUserAdmin ? "block" : "none";
    if (gameActive && document.getElementById('toggleConsoleBtn')) {
        document.getElementById('toggleConsoleBtn').style.display = isUserAdmin ? "block" : "none";
    }
}

function updateMenuUI() { document.getElementById('userBadge').innerText = `Logged in as: ${playerData.username}`; loadAdminFile(); }
function handleGoogleSignIn(r) {
    let payload = JSON.parse(window.atob(r.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    playerData.username = payload.given_name || payload.name; playerData.email = payload.email;
    localStorage.setItem('chromashift_save', JSON.stringify(playerData)); updateMenuUI();
}

function togglePanel(id) {
    const p = document.getElementById(id); if(!p) return;
    p.style.display = p.style.display === "none" ? "flex" : "none";
}

function selectGameMode(mode) {
    currentActiveMode = mode; gameActive = true;
    character.role = mode === "seeker" ? "seeker" : "hider";
    
    document.getElementById('mainMenu').style.display = "none";
    document.getElementById('topbarMenu').style.display = "flex";
    document.getElementById('chatContainer').style.display = "flex";
    document.getElementById('actionControls').style.display = "flex";
    document.getElementById('lobbyStatusBadge').innerText = `${character.role.toUpperCase()} MODE`;
    
    addChatMessage("SYSTEM", `Meccha Match Loaded! Target Profile: [${character.role.toUpperCase()}]`);
    
    character.x = 2500; character.y = 2450; character.bodyPaint = ["#ffffff", "#ffffff", "#ffffff", "#ffffff"];
    checkAdminStatus(); spawnMatchPlayers();
}

function exitToLobby() {
    gameActive = false;
    ['topbarMenu', 'chatContainer', 'adminConsole', 'actionControls'].forEach(id => {
        let el = document.getElementById(id); if(el) el.style.display = "none";
    });
    document.getElementById('mainMenu').style.display = "flex";
}

function togglePaintMode() {
    character.activePaintTool = character.activePaintTool === "brush" ? null : "brush";
    addChatMessage("SYSTEM", character.activePaintTool ? "Paintbrush Tool Active!" : "Paintbrush holstered.");
}

function cyclePoses() {
    const poses = ["stand", "crouch", "ball", "flat"];
    character.currentPose = poses[(poses.indexOf(character.currentPose) + 1) % poses.length];
    addChatMessage("SYSTEM", `Form Configuration: ${character.currentPose.toUpperCase()}`);
}

function triggerTauntWhistle() {
    addChatMessage(playerData.username, "🎵 *LOUD WHISTLE TAUNT* 🎵");
    character.whistleRipple = 1;
}

function updateGameTick() {
    if (!gameActive) return;
    let mx = 0, my = 0;

    let currentSpeed = character.speed;
    if (character.currentPose === "crouch") currentSpeed *= 0.5;
    if (character.currentPose === "ball" || character.currentPose === "flat") currentSpeed = 0; 

    if (joystick.active) { mx = joystick.moveX; my = joystick.moveY; }
    else if (currentSpeed > 0) {
        if (keysPressed['w'] || keysPressed['arrowup']) my -= 1;
        if (keysPressed['s'] || keysPressed['arrowdown']) my += 1;
        if (keysPressed['a'] || keysPressed['arrowleft']) mx -= 1;
        if (keysPressed['d'] || keysPressed['arrowright']) mx += 1;
    }

    if (mx !== 0 || my !== 0) {
        let ang = Math.atan2(my, mx);
        character.x += Math.cos(ang) * currentSpeed; character.y += Math.sin(ang) * currentSpeed;
    }

    character.x = Math.max(30, Math.min(MAP_SIZE - 30, character.x));
    character.y = Math.max(30, Math.min(MAP_SIZE - 30, character.y));

    if (character.whistleRipple > 0) {
        character.whistleRipple += 5; if (character.whistleRipple > 160) character.whistleRipple = 0;
    }

    entities.forEach(bot => {
        if (bot.role === "seeker") {
            bot.timer--;
            if (bot.timer <= 0) { bot.tx = (Math.random() - 0.5) * 3.5; bot.ty = (Math.random() - 0.5) * 3.5; bot.timer = 90 + Math.random() * 80; }
            bot.x += bot.tx; bot.y += bot.ty;
            bot.x = Math.max(50, Math.min(MAP_SIZE-50, bot.x)); bot.y = Math.max(50, Math.min(MAP_SIZE-50, bot.y));
        }
    });

    camera.x = character.x - (canvas.width / 2) / zoomLevel;
    camera.y = character.y - (canvas.height / 2) / zoomLevel;
}

function gameLoop() {
    updateGameTick();
    ctx.fillStyle = gameActive ? "#141720" : "#0c0b14"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!gameActive) { requestAnimationFrame(gameLoop); return; }

    ctx.save(); ctx.scale(zoomLevel, zoomLevel); ctx.translate(-camera.x, -camera.y);
    ctx.fillStyle = "#2a2f3a"; ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)"; ctx.lineWidth = 1;
    let sx = Math.max(0, Math.floor(camera.x / GRID_SIZE) * GRID_SIZE), ex = Math.min(MAP_SIZE, sx + (canvas.width / zoomLevel) + GRID_SIZE);
    let sy = Math.max(0, Math.floor(camera.y / GRID_SIZE) * GRID_SIZE), ey = Math.min(MAP_SIZE, sy + (canvas.height / zoomLevel) + GRID_SIZE);
    for (let x = sx; x <= ex; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, ey); ctx.stroke(); }
    for (let y = sy; y <= ey; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(ex, y); ctx.stroke(); }

    mapBlocks.forEach(b => {
        ctx.fillStyle = b.type === 'wall' ? "#3e4656" : b.type === 'floor' ? "#a8744f" : b.type === 'neon' ? "#00ffcc" : "#ebc45b";
        ctx.fillRect(b.x, b.y, GRID_SIZE, GRID_SIZE);
        ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.strokeRect(b.x, b.y, GRID_SIZE, GRID_SIZE);
    });

    entities.forEach(bot => drawChameleonCharacter(bot.x, bot.y, bot.size, bot.bodyPaint, bot.currentPose, bot.role));
    drawChameleonCharacter(character.x, character.y, character.size, character.bodyPaint, character.currentPose, character.role);

    if (character.whistleRipple > 0) {
        ctx.strokeStyle = "rgba(0, 255, 204, " + (1 - character.whistleRipple/160) + ")";
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(character.x, character.y, character.whistleRipple, 0, 2*Math.PI); ctx.stroke();
    }

    ctx.restore();

    if (character.activePaintTool) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)"; ctx.fillRect(20, window.innerHeight - 100, 340, 80);
        ctx.fillStyle = "#ffffff"; ctx.font = "13px sans-serif";
        ctx.fillText(`🎨 ACTIVE PAINT: Click self to apply | Target: ${character.selectedColor}`, 35, window.innerHeight - 70);
        ctx.fillText("Click blocks to Eyedrop/Sample colors.", 35, window.innerHeight - 45);
    }
    
    if (joystick.active) {
        ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.arc(joystick.startX, joystick.startY, 50, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = "rgba(0,255,204,0.4)"; ctx.beginPath(); ctx.arc(joystick.curX, joystick.curY, 18, 0, 2*Math.PI); ctx.fill(); ctx.restore();
    }
    requestAnimationFrame(gameLoop);
}

function drawChameleonCharacter(x, y, baseSize, paintArray, pose, role) {
    ctx.save(); ctx.translate(x, y);
    let size = baseSize;
    if (pose === "crouch") size *= 0.8; if (pose === "ball") size *= 0.65;
    
    if (role === "seeker") {
        ctx.fillStyle = "#ff3355"; ctx.beginPath(); ctx.arc(0, 0, size, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = "#000000"; ctx.fillRect(-7, -8, 14, 5); ctx.restore(); return;
    }

    if (pose === "flat") {
        ctx.fillStyle = paintArray[0]; ctx.fillRect(-size * 1.4, -size * 0.4, size * 2.8, size * 0.8);
    } else if (pose === "ball") {
        ctx.fillStyle = paintArray[0]; ctx.beginPath(); ctx.arc(0, 0, size, 0, 2*Math.PI); ctx.fill();
    } else {
        ctx.fillStyle = paintArray[0]; ctx.beginPath(); ctx.arc(0, 0, size, Math.PI, 1.5*Math.PI); ctx.lineTo(0,0); ctx.fill();
        ctx.fillStyle = paintArray[1]; ctx.beginPath(); ctx.arc(0, 0, size, 1.5*Math.PI, 2*Math.PI); ctx.lineTo(0,0); ctx.fill();
        ctx.fillStyle = paintArray[2]; ctx.beginPath(); ctx.arc(0, 0, size, 0, 0.5*Math.PI); ctx.lineTo(0,0); ctx.fill();
        ctx.fillStyle = paintArray[3]; ctx.beginPath(); ctx.arc(0, 0, size, 0.5*Math.PI, Math.PI); ctx.lineTo(0,0); ctx.fill();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, size, 0, 2*Math.PI); ctx.stroke();
    ctx.restore();
}

function handleTouchStart(cx, cy) {
    if (!gameActive) return;
    if (cx < window.innerWidth / 3) {
        joystick.active = true; joystick.startX = joystick.curX = cx; joystick.startY = joystick.curY = cy;
        joystick.moveX = joystick.moveY = 0;
    } else if (character.activePaintTool === "brush") {
        let wx = (cx / zoomLevel) + camera.x, wy = (cy / zoomLevel) + camera.y;
        let dist = Math.sqrt(Math.pow(wx - character.x, 2) + Math.pow(wy - character.y, 2));
        
        if (dist <= character.size) {
            let angle = Math.atan2(wy - character.y, wx - character.x);
            if (angle < 0) angle += 2 * Math.PI;
            character.bodyPaint[Math.floor(angle / (Math.PI / 2))] = character.selectedColor;
        } else {
            let col = "#2a2f3a";
            mapBlocks.forEach(b => {
                if (wx >= b.x && wx <= b.x + GRID_SIZE && wy >= b.y && wy <= b.y + GRID_SIZE) {
                    col = b.type === 'wall' ? "#3e4656" : b.type === 'floor' ? "#a8744f" : b.type === 'neon' ? "#00ffcc" : "#ebc45b";
                }
            });
            character.selectedColor = col;
        }
    }
}

function handleTouchMove(cx, cy) {
    if (!joystick.active) return;
    joystick.curX = cx; joystick.curY = cy;
    let dx = cx - joystick.startX, dy = cy - joystick.startY, dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 50) { dx = (dx / dist) * 50; dy = (dy / dist) * 50; joystick.curX = joystick.startX + dx; joystick.curY = joystick.startY + dy; }
    joystick.moveX = dx / 50; joystick.moveY = dy / 50;
}

canvas.addEventListener("mousedown", (e) => handleTouchStart(e.clientX, e.clientY));
canvas.addEventListener("mousemove", (e) => handleTouchMove(e.clientX, e.clientY));
window.addEventListener("mouseup", () => { joystick.active = false; joystick.moveX = joystick.moveY = 0; });

canvas.addEventListener("touchstart", (e) => { let t = e.changedTouches[0]; handleTouchStart(t.clientX, t.clientY); });
canvas.addEventListener("touchmove", (e) => { let t = e.changedTouches[0]; handleTouchMove(t.clientX, t.clientY); });
window.addEventListener("touchend", () => { joystick.active = false; joystick.moveX = joystick.moveY = 0; });

function getRandomColor() { return ['#3e4656', '#a8744f', '#00ffcc', '#ebc45b'][Math.floor(Math.random()*4)]; }
function sendChatMessage() {
    const i = document.getElementById('chatInput'), t = i.value.trim(); if (!t) return; i.value = "";
    addChatMessage(playerData.username, t);
}
function addChatMessage(s, t) {
    const b = document.getElementById('chatMessages'), e = document.createElement('div'); e.className = "chat-line";
    e.innerHTML = s === "SYSTEM" ? `<span class="chat-system">[SYS]:</span> ${t}` : `<span>${s}:</span> ${t}`;
    b.appendChild(e); b.scrollTop = b.scrollHeight;
}

function executeConsoleCommand() {
    const i = document.getElementById('consoleInput'), f = i.value.trim(); if (!f || !isUserAdmin) return; i.value = "";
    logToConsole(playerData.username, f, false);
    const args = f.split(" "), cmd = args[0].toLowerCase();

    if (cmd === "!admin" && args[1]) {
        let target = args[1].toLowerCase(); 
        if (!adminList.includes(target)) { 
            adminList.push(target); 
            localStorage.setItem('chromashift_admins', JSON.stringify(adminList)); 
            logToConsole("SYSTEM", `Promoted target parameters: ${target}`, true); 
            checkAdminStatus();
        }
    } else if (cmd === "!announce") { addChatMessage("SYSTEM", `🌐 ADMIN: ${args.slice(1).join(" ")}`); }
    else if (cmd === "!speed" && !isNaN(parseFloat(args[1]))) { character.speed = parseFloat(args[1]); }
    else if (cmd === "!tp") { character.x = parseFloat(args[1]) || 2500; character.y = parseFloat(args[2]) || 2500; }
    else if (cmd === "!clearconsole") { document.getElementById('consoleLog').innerHTML = ""; }
}

function logToConsole(s, t, sys) {
    const b = document.getElementById('consoleLog'); if (!b) return; const l = document.createElement('div'); l.className = "console-line";
    let ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    l.innerHTML = sys ? `[${ts}] <span class="console-tag-system">[${s}]</span> ${t}` : `[${ts}] <span class="console-tag-admin">[ADMIN]:</span> ${t}`;
    b.appendChild(l); b.scrollTop = b.scrollHeight;
}

updateMenuUI();
requestAnimationFrame(gameLoop);
             

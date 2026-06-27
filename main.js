let playerData = JSON.parse(localStorage.getItem('chromashift_save')) || { username: "Guest Player", email: "" };
let adminList = [], currentSelectedTool = null, isUserAdmin = false, currentActiveMode = "singleplayer", gameActive = false;

const MAP_SIZE = 5000, GRID_SIZE = 50;   
let camera = { x: 2500, y: 2500 }, zoomLevel = 1.2, keysPressed = {};

let character = { 
    x: 2500, y: 2450, size: 20, speed: 5, color: "#00ffcc", eyeAngle: 0,
    z: 0, jumpZ: 0, isJumping: false, gravity: 0.6, jumpForce: 10
};

let joystick = { active: false, startX: 0, startY: 0, curX: 0, curY: 0, moveX: 0, moveY: 0 };

window.addEventListener("keydown", (e) => { 
    if (document.activeElement.tagName !== 'INPUT') keysPressed[e.key.toLowerCase()] = true; 
    if (e.key === " " && !character.isJumping && gameActive && document.activeElement.tagName !== 'INPUT') {
        character.isJumping = true; character.jumpZ = character.jumpForce;
    }
});
window.addEventListener("keyup", (e) => { keysPressed[e.key.toLowerCase()] = false; });

let mapBlocks = [];
function generateBarnMap() {
    mapBlocks = [];
    for(let x=2200; x<=2800; x+=50) { mapBlocks.push({x: x, y: 2100, type: 'wall'}, {x: x, y: 2600, type: 'wall'}); }
    for(let y=2100; y<=2600; y+=50) { if(y !== 2350 && y !== 2400) { mapBlocks.push({x: 2200, y: y, type: 'wall'}, {x: 2800, y: y, type: 'wall'}); } }
    for(let x=2250; x<2800; x+=50) { for(let y=2150; y<2600; y+=50) mapBlocks.push({x: x, y: y, type: 'floor'}); }
    mapBlocks.push({x: 2300, y: 2200, type: 'neon'}, {x: 2700, y: 2200, type: 'neon'});
}
generateBarnMap();

let entities = [];
function spawnCows() {
    entities = [];
    for(let i=0; i<12; i++) {
        entities.push({
            x: 2000 + Math.random()*1000, y: 1900 + Math.random()*1000,
            tx: 0, ty: 0, timer: 0, color: i % 2 === 0 ? "#ffffff" : "#4a3525", size: 16
        });
    }
}
spawnCows();

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
    }) || currentName.includes("xian") || currentName.includes("ariel");

    document.getElementById('adminBadge').style.display = isUserAdmin ? "block" : "none";
    if (gameActive) {
        ['toggleConsoleBtn', 'toggleBuilderBtn'].forEach(id => document.getElementById(id).style.display = isUserAdmin ? "block" : "none");
    }
}

function updateMenuUI() { document.getElementById('userBadge').innerText = `Logged in as: ${playerData.username}`; loadAdminFile(); }
function handleGoogleSignIn(r) {
    let payload = JSON.parse(window.atob(r.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    playerData.username = payload.given_name || payload.name; playerData.email = payload.email;
    localStorage.setItem('chromashift_save', JSON.stringify(playerData)); updateMenuUI();
}

function togglePanel(id) {
    const p = document.getElementById(id), b = document.getElementById(id === 'chatContainer' ? 'toggleChatBtn' : id === 'adminConsole' ? 'toggleConsoleBtn' : 'toggleBuilderBtn');
    p.style.display = p.style.display === "none" ? "flex" : "none";
    if(b) b.classList.toggle('active', p.style.display === "flex");
}

// FORCE LANDSCAPE SYSTEM
function lockLandscape() {
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch((err) => console.log("Orientation lock paused until interaction."));
    }
}

function selectGameMode(mode) {
    lockLandscape();
    currentActiveMode = mode; gameActive = true;
    ['mainMenu', 'adminConsole', 'builderPanel'].forEach(id => document.getElementById(id).style.display = "none");
    ['topbarMenu', 'chatContainer'].forEach(id => document.getElementById(id).style.display = "flex");
    document.getElementById('toggleChatBtn').classList.add('active');
    document.getElementById('lobbyStatusBadge').innerText = mode.toUpperCase() + " FIELD";
    addChatMessage("SYSTEM", `Field loaded: [${mode.toUpperCase()}]`);
    checkAdminStatus();
    character.x = 2500; character.y = 2450; character.z = 0; character.isJumping = false;
}

function exitToLobby() {
    gameActive = false; currentSelectedTool = null;
    ['topbarMenu', 'chatContainer', 'adminConsole', 'builderPanel'].forEach(id => document.getElementById(id).style.display = "none");
    document.getElementById('mainMenu').style.display = "flex";
}

function updateGameTick() {
    if (!gameActive) return;
    let mx = 0, my = 0;

    if (joystick.active) { mx = joystick.moveX; my = joystick.moveY; }
    else {
        if (keysPressed['w'] || keysPressed['arrowup']) my -= 1;
        if (keysPressed['s'] || keysPressed['arrowdown']) my += 1;
        if (keysPressed['a'] || keysPressed['arrowleft']) mx -= 1;
        if (keysPressed['d'] || keysPressed['arrowright']) mx += 1;
    }

    if (mx !== 0 || my !== 0) {
        let ang = Math.atan2(my, mx);
        character.x += Math.cos(ang) * character.speed; character.y += Math.sin(ang) * character.speed;
        character.eyeAngle += 0.12;
    }

    if (character.isJumping) {
        character.z += character.jumpZ; character.jumpZ -= character.gravity;
        if (character.z <= 0) { character.z = 0; character.isJumping = false; character.jumpZ = 0; }
    }

    character.x = Math.max(20, Math.min(MAP_SIZE - 20, character.x));
    character.y = Math.max(20, Math.min(MAP_SIZE - 20, character.y));

    entities.forEach(c => {
        c.timer--;
        if(c.timer <= 0) { c.tx = (Math.random() - 0.5)*2; c.ty = (Math.random() - 0.5)*2; c.timer = 60 + Math.random()*120; }
        c.x += c.tx * 0.8; c.y += c.ty * 0.8;
        c.x = Math.max(50, Math.min(MAP_SIZE-50, c.x)); c.y = Math.max(50, Math.min(MAP_SIZE-50, c.y));
    });

    camera.x = character.x - (canvas.width / 2) / zoomLevel;
    camera.y = character.y - (canvas.height / 2) / zoomLevel;
}

function gameLoop() {
    updateGameTick();
    ctx.fillStyle = gameActive ? "#11141a" : "#0c0b14"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!gameActive) { requestAnimationFrame(gameLoop); return; }

    ctx.save(); ctx.scale(zoomLevel, zoomLevel); ctx.translate(-camera.x, -camera.y);
    ctx.fillStyle = "#223d26"; ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)"; ctx.lineWidth = 1;
    let sx = Math.max(0, Math.floor(camera.x / GRID_SIZE) * GRID_SIZE), ex = Math.min(MAP_SIZE, sx + (canvas.width / zoomLevel) + GRID_SIZE);
    let sy = Math.max(0, Math.floor(camera.y / GRID_SIZE) * GRID_SIZE), ey = Math.min(MAP_SIZE, sy + (canvas.height / zoomLevel) + GRID_SIZE);
    for (let x = sx; x <= ex; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, ey); ctx.stroke(); }
    for (let y = sy; y <= ey; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(ex, y); ctx.stroke(); }

    mapBlocks.forEach(b => {
        ctx.fillStyle = b.type === 'wall' ? "#a83232" : b.type === 'floor' ? "#614129" : b.type === 'neon' ? "#00ff88" : "#d4af37";
        ctx.fillRect(b.x, b.y, GRID_SIZE, GRID_SIZE);
        ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.strokeRect(b.x, b.y, GRID_SIZE, GRID_SIZE);
    });

    entities.forEach(c => {
        ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = "#000000"; ctx.beginPath(); ctx.arc(c.x - 4, c.y - 4, 3, 0, 2*Math.PI); ctx.arc(c.x + 8, c.y + 2, 4, 0, 2*Math.PI); ctx.fill();
    });

    ctx.save(); ctx.translate(character.x, character.y - character.z);
    let faceAngle = Math.atan2(joystick.moveY, joystick.moveX);
    if (!joystick.active && (keysPressed['w'] || keysPressed['arrowup'] || keysPressed['s'] || keysPressed['arrowdown'] || keysPressed['a'] || keysPressed['arrowleft'] || keysPressed['d'] || keysPressed['arrowright'])) {
        let kx = 0, ky = 0;
        if (keysPressed['w'] || keysPressed['arrowup']) ky -= 1; if (keysPressed['s'] || keysPressed['arrowdown']) ky += 1;
        if (keysPressed['a'] || keysPressed['arrowleft']) kx -= 1; if (keysPressed['d'] || keysPressed['arrowright']) kx += 1;
        faceAngle = Math.atan2(ky, kx);
    }
    ctx.rotate(faceAngle);

    if (character.z > 0) {
        ctx.save(); ctx.translate(0, character.z); ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.arc(0, 0, character.size * (1 - character.z/150), 0, 2*Math.PI); ctx.fill(); ctx.restore();
    }

    ctx.fillStyle = character.color; ctx.beginPath(); ctx.arc(0, 0, character.size, 0, 2*Math.PI); ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();
    
    [ {dx: character.size - 6, dy: -character.size + 8, r: character.eyeAngle}, {dx: character.size - 6, dy: character.size - 8, r: -character.eyeAngle * 1.2} ].forEach(e => {
        ctx.save(); ctx.translate(e.dx, e.dy); ctx.rotate(e.r); ctx.fillStyle = "#111116"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = "#ff3300"; ctx.fillRect(2, -1, 4, 2); ctx.restore();
    });
    ctx.restore(); ctx.restore();

    if (joystick.active) {
        ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.beginPath(); ctx.arc(joystick.startX, joystick.startY, 50, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = "rgba(0,255,200,0.5)"; ctx.beginPath(); ctx.arc(joystick.curX, joystick.curY, 20, 0, 2*Math.PI); ctx.fill(); ctx.restore();
    }
    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

function handleTouchStart(cx, cy) {
    if (!gameActive) return;
    if (cx < window.innerWidth / 2) {
        joystick.active = true; joystick.startX = joystick.curX = cx; joystick.startY = joystick.curY = cy;
        joystick.moveX = joystick.moveY = 0;
    } else if (isUserAdmin && currentSelectedTool) {
        let wx = (cx / zoomLevel) + camera.x, wy = (cy / zoomLevel) + camera.y;
        let gx = Math.floor(wx / GRID_SIZE) * GRID_SIZE, gy = Math.floor(wy / GRID_SIZE) * GRID_SIZE;
        mapBlocks = mapBlocks.filter(b => !(b.x === gx && b.y === gy));
        if (currentSelectedTool !== 'erase') mapBlocks.push({ x: gx, y: gy, type: currentSelectedTool });
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
window.addEventListener("contextmenu", e => e.preventDefault());

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
            logToConsole("SYSTEM", `Promoted target value: ${target}`, true); 
            checkAdminStatus();
        }
    } else if (cmd === "!announce") { addChatMessage("SYSTEM", `🌐 ADMIN: ${args.slice(1).join(" ")}`); }
    else if (cmd === "!speed" && !isNaN(parseFloat(args[1]))) { character.speed = parseFloat(args[1]); logToConsole("SYSTEM", `Velocity modified: ${character.speed}`, true); }
    else if (cmd === "!tp") { character.x = parseFloat(args[1]) || 2500; character.y = parseFloat(args[2]) || 2500; logToConsole("SYSTEM", "Teleported!", true); }
    else if (cmd === "!clearblocks") { mapBlocks = []; logToConsole("SYSTEM", "Map cleared.", true); }
    else if (cmd === "!clearconsole") { document.getElementById('consoleLog').innerHTML = ""; }
    else { logToConsole("ENGINE", "Unknown developer string parameters.", true); }
}

function logToConsole(s, t, sys) {
    const b = document.getElementById('consoleLog'); if (!b) return; const l = document.createElement('div'); l.className = "console-line";
    let ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    l.innerHTML = sys ? `[${ts}] <span class="console-tag-system">[${s}]</span> ${t}` : `[${ts}] <span class="console-tag-admin">[ADMIN - ${s}]:</span> ${t}`;
    b.appendChild(l); b.scrollTop = b.scrollHeight;
}

function setBuildItem(t) {
    ['tool-wall', 'tool-floor', 'tool-neon', 'tool-gold', 'tool-erase'].forEach(id => document.getElementById(id).classList.remove('active'));
    currentSelectedTool = currentSelectedTool === t ? null : t; if (currentSelectedTool) document.getElementById(`tool-${t}`).classList.add('active');
}
function openShop() { alert("Shop database offline."); }
updateMenuUI();
        

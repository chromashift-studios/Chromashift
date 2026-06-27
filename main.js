let playerData = JSON.parse(localStorage.getItem('chromashift_save')) || { username: "Guest Player", email: "" };
let adminList = [], currentSelectedTool = null, isUserAdmin = false, currentActiveMode = "singleplayer", gameActive = false;

const MAP_SIZE = 100000, GRID_SIZE = 50;   
let camera = { x: 50000, y: 50000 }, zoomLevel = 1.0, isRightClickDragging = false, startDragX = 0, startDragY = 0, keysPressed = {};

let character = { x: 50025, y: 50025, targetX: 50025, targetY: 50025, size: 20, speed: 6, color: "#00ffcc", eyeAngle: 0 };

window.addEventListener("keydown", (e) => { if (document.activeElement.tagName !== 'INPUT') keysPressed[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { keysPressed[e.key.toLowerCase()] = false; });

let defaultBlocks = [
    {x: 49950, y: 49950, type: 'neon'}, {x: 50000, y: 49950, type: 'neon'}, {x: 50050, y: 49950, type: 'neon'},
    {x: 49950, y: 50000, type: 'gold'}, {x: 50000, y: 50000, type: 'floor'}, {x: 50050, y: 50000, type: 'gold'},
    {x: 49950, y: 50050, type: 'neon'}, {x: 50000, y: 50050, type: 'neon'}, {x: 50050, y: 50050, type: 'neon'}
];
let mapBlocks = JSON.parse(localStorage.getItem('chromashift_map_blocks')) || defaultBlocks;
let worldSpawnPoints = JSON.parse(localStorage.getItem('chromashift_spawns')) || { 1: { x: 50000, y: 50000 } };

const canvas = document.getElementById("gameCanvas"), ctx = canvas.getContext("2d");
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener("resize", resizeCanvas); resizeCanvas();

async function loadAdminFile() {
    try {
        const r = await fetch('admins.json'), f = await r.json();
        adminList = [...new Set([...f, ...(JSON.parse(localStorage.getItem('chromashift_admins')) || [])])];
    } catch (e) { adminList = JSON.parse(localStorage.getItem('chromashift_admins')) || []; }
    checkAdminStatus();
}

function checkAdminStatus() {
    isUserAdmin = (playerData.email && adminList.map(e => e.toLowerCase()).includes(playerData.email.toLowerCase())) || playerData.username.toLowerCase().includes("xian");
    document.getElementById('adminBadge').style.display = isUserAdmin ? "block" : "none";
    if (gameActive) {
        document.getElementById('toggleConsoleBtn').style.display = isUserAdmin ? "block" : "none";
        document.getElementById('toggleBuilderBtn').style.display = isUserAdmin ? "block" : "none";
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

function selectGameMode(mode) {
    currentActiveMode = mode; gameActive = true;
    ['mainMenu', 'adminConsole', 'builderPanel'].forEach(id => document.getElementById(id).style.display = "none");
    document.getElementById('topbarMenu').style.display = "flex";
    document.getElementById('chatContainer').style.display = "flex";
    document.getElementById('toggleChatBtn').classList.add('active');
    document.getElementById('lobbyStatusBadge').innerText = mode.toUpperCase() + " MODE";
    addChatMessage("SYSTEM", `Lobby connected: [${mode.toUpperCase()}]`);
    checkAdminStatus();
    let sp = worldSpawnPoints[1] || { x: 50000, y: 50000 };
    character.x = character.targetX = sp.x; character.y = character.targetY = sp.y;
}

function exitToLobby() {
    gameActive = false; currentSelectedTool = null;
    ['topbarMenu', 'chatContainer', 'adminConsole', 'builderPanel'].forEach(id => document.getElementById(id).style.display = "none");
    document.getElementById('mainMenu').style.display = "flex";
}

canvas.addEventListener("wheel", (e) => {
    if (!gameActive) return; e.preventDefault();
    zoomLevel = e.deltaY < 0 ? Math.min(2.0, zoomLevel + 0.1) : Math.max(0.3, zoomLevel - 0.1);
    document.getElementById('zoomPercent').innerText = `Zoom: ${Math.floor(zoomLevel * 100)}%`;
});

function updateGameTick() {
    if (!gameActive) return;
    let mx = 0, my = 0;
    if (keysPressed['w'] || keysPressed['arrowup']) my -= 1;
    if (keysPressed['s'] || keysPressed['arrowdown']) my += 1;
    if (keysPressed['a'] || keysPressed['arrowleft']) mx -= 1;
    if (keysPressed['d'] || keysPressed['arrowright']) mx += 1;

    if (mx !== 0 || my !== 0) {
        let ang = Math.atan2(my, mx);
        character.x += Math.cos(ang) * character.speed; character.y += Math.sin(ang) * character.speed;
        character.targetX = character.x; character.targetY = character.y; character.eyeAngle += 0.15;
    } else {
        let dx = character.targetX - character.x, dy = character.targetY - character.y, d = Math.sqrt(dx*dx + dy*dy);
        if (d > character.speed) {
            let ang = Math.atan2(dy, dx);
            character.x += Math.cos(ang) * character.speed; character.y += Math.sin(ang) * character.speed; character.eyeAngle += 0.08;
        } else { character.x = character.targetX; character.y = character.targetY; }
    }
    character.x = Math.max(10, Math.min(MAP_SIZE - 10, character.x));
    character.y = Math.max(10, Math.min(MAP_SIZE - 10, character.y));
    camera.x = character.x - (canvas.width / 2) / zoomLevel; camera.y = character.y - (canvas.height / 2) / zoomLevel;
}

function gameLoop() {
    updateGameTick();
    ctx.fillStyle = gameActive ? "#161920" : "#0c0b14"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!gameActive) { requestAnimationFrame(gameLoop); return; }

    ctx.save(); ctx.scale(zoomLevel, zoomLevel); ctx.translate(-camera.x, -camera.y);
    ctx.fillStyle = "#1b361f"; ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)"; ctx.lineWidth = 1;
    let sx = Math.max(0, Math.floor(camera.x / GRID_SIZE) * GRID_SIZE), ex = Math.min(MAP_SIZE, sx + (canvas.width / zoomLevel) + GRID_SIZE);
    let sy = Math.max(0, Math.floor(camera.y / GRID_SIZE) * GRID_SIZE), ey = Math.min(MAP_SIZE, sy + (canvas.height / zoomLevel) + GRID_SIZE);
    for (let x = sx; x <= ex; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, ey); ctx.stroke(); }
    for (let y = sy; y <= ey; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(ex, y); ctx.stroke(); }

    mapBlocks.forEach(b => {
        ctx.fillStyle = b.type === 'wall' ? "#8a3d22" : b.type === 'floor' ? "#2d527c" : b.type === 'neon' ? "#ff00aa" : "#d4af37";
        ctx.fillRect(b.x, b.y, GRID_SIZE, GRID_SIZE);
        if (b.type === 'neon') { ctx.shadowBlur = 15; ctx.shadowColor = "#ff00aa"; ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; ctx.fillRect(b.x+5, b.y+5, GRID_SIZE-10, GRID_SIZE-10); ctx.shadowBlur = 0; }
        else { ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.strokeRect(b.x, b.y, GRID_SIZE, GRID_SIZE); }
    });

    Object.keys(worldSpawnPoints).forEach(id => { ctx.strokeStyle = "#00ffcc"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(worldSpawnPoints[id].x, worldSpawnPoints[id].y, 20, 0, 2*Math.PI); ctx.stroke(); });

    ctx.save(); ctx.translate(character.x, character.y);
    let wa = Math.atan2(character.targetY - character.y, character.targetX - character.x);
    if (keysPressed['w'] || keysPressed['arrowup'] || keysPressed['s'] || keysPressed['arrowdown'] || keysPressed['a'] || keysPressed['arrowleft'] || keysPressed['d'] || keysPressed['arrowright']) {
        let kx = 0, ky = 0;
        if (keysPressed['w'] || keysPressed['arrowup']) ky -= 1; if (keysPressed['s'] || keysPressed['arrowdown']) ky += 1;
        if (keysPressed['a'] || keysPressed['arrowleft']) kx -= 1; if (keysPressed['d'] || keysPressed['arrowright']) kx += 1;
        wa = Math.atan2(ky, kx);
    }
    ctx.rotate(wa);
    ctx.fillStyle = character.color; ctx.beginPath(); ctx.arc(0, 0, character.size, 0, 2*Math.PI); ctx.fill(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = character.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-character.size + 4, 0, 8, 0, Math.PI * 1.5, true); ctx.stroke();
    
    [ {dx: character.size - 6, dy: -character.size + 8, rot: character.eyeAngle}, {dx: character.size - 6, dy: character.size - 8, rot: -character.eyeAngle * 1.2} ].forEach(e => {
        ctx.save(); ctx.translate(e.dx, e.dy); ctx.rotate(e.rot); ctx.fillStyle = "#111116"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = "#ff3300"; ctx.fillRect(2, -1, 4, 2); ctx.restore();
    });
    ctx.restore(); ctx.restore(); requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

canvas.addEventListener("mousedown", (e) => { if (e.button >= 1) { isRightClickDragging = true; startDragX = e.clientX; startDragY = e.clientY; } });
canvas.addEventListener("mousemove", (e) => { if (isRightClickDragging) { camera.x -= (e.clientX - startDragX) / zoomLevel; camera.y -= (e.clientY - startDragY) / zoomLevel; startDragX = e.clientX; startDragY = e.clientY; } });
window.addEventListener("mouseup", (e) => { if (e.button >= 1) isRightClickDragging = false; });
window.addEventListener("contextmenu", e => e.preventDefault());

function handleGridInput(cx, cy) {
    let wx = (cx / zoomLevel) + camera.x, wy = (cy / zoomLevel) + camera.y;
    if (isUserAdmin && currentSelectedTool) {
        let gx = Math.floor(wx / GRID_SIZE) * GRID_SIZE, gy = Math.floor(wy / GRID_SIZE) * GRID_SIZE;
        mapBlocks = mapBlocks.filter(b => !(b.x === gx && b.y === gy));
        if (currentSelectedTool !== 'erase') mapBlocks.push({ x: gx, y: gy, type: currentSelectedTool });
        localStorage.setItem('chromashift_map_blocks', JSON.stringify(mapBlocks));
    } else { character.targetX = wx; character.targetY = wy; }
}
canvas.addEventListener("click", (e) => { if (gameActive && e.button === 0) handleGridInput(e.clientX, e.clientY); });
canvas.addEventListener("touchstart", (e) => { if (gameActive && e.touches.length === 1) handleGridInput(e.touches[0].clientX, e.touches[0].clientY); });

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
        let email = args[1].toLowerCase(); if (!adminList.includes(email)) { adminList.push(email); localStorage.setItem('chromashift_admins', JSON.stringify(adminList)); logToConsole("SYSTEM", `Promoted: ${email}`, true); }
    } else if (cmd === "!setspawn") {
        let id = parseInt(args[1]) || 1; worldSpawnPoints[id] = { x: character.x, y: character.y }; localStorage.setItem('chromashift_spawns', JSON.stringify(worldSpawnPoints)); logToConsole("SYSTEM", `Spawn [${id}] saved!`, true);
    } else if (cmd === "!announce") { addChatMessage("SYSTEM", `🌐 ADMIN: ${args.slice(1).join(" ")}`); }
    else if (cmd === "!speed" && !isNaN(parseFloat(args[1]))) { character.speed = parseFloat(args[1]); logToConsole("SYSTEM", `Speed configured: ${character.speed}`, true); }
    else if (cmd === "!size" && !isNaN(parseFloat(args[1]))) { character.size = parseFloat(args[1]); logToConsole("SYSTEM", `Chassis size set: ${character.size}`, true); }
    else if (cmd === "!tp" && !isNaN(parseFloat(args[1]))) { character.x = character.targetX = parseFloat(args[1]); character.y = character.targetY = parseFloat(args[2]); logToConsole("SYSTEM", "Teleported!", true); }
    else if (cmd === "!color" && args[1]) { character.color = args[1]; logToConsole("SYSTEM", `Color matches: ${args[1]}`, true); }
    else if (cmd === "!clearblocks") { mapBlocks = []; localStorage.setItem('chromashift_map_blocks', JSON.stringify(mapBlocks)); logToConsole("SYSTEM", "Canvas elements wiped.", true); }
    else if (cmd === "!clearconsole") { document.getElementById('consoleLog').innerHTML = ""; }
    else { logToConsole("ENGINE", "Unknown developer command target query string.", true); }
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
                                                                                       

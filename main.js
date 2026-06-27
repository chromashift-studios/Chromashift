let playerData = JSON.parse(localStorage.getItem('chromashift_save')) || { username: "PlayerXian", email: "" };
let adminList = [], isUserAdmin = false, gameActive = false;
const GRID_SIZE = 64; 

// 3D Raycasting Position Vector Parameters
let player = {
    x: 3.5 * GRID_SIZE, 
    y: 3.5 * GRID_SIZE,
    angle: Math.PI / 4,
    fov: Math.PI / 3, // 60 Degree FOV Distortion
    speed: 3.2, 
    rotateSpeed: 0.05,
    selectedColor: "#00ffcc",
    activePaintTool: null,
    currentPose: "stand"
};

let joystick = { active: false, startX: 0, startY: 0, curX: 0, curY: 0, moveX: 0, moveY: 0 };
let keysPressed = {};

window.addEventListener("keydown", (e) => { 
    if (document.activeElement.tagName !== 'INPUT') {
        keysPressed[e.key.toLowerCase()] = true;
        if (e.key.toLowerCase() === 'f' && gameActive) togglePaintMode();
        if (e.key.toLowerCase() === 'r' && gameActive) cyclePoses();
    }
});
window.addEventListener("keyup", (e) => { keysPressed[e.key.toLowerCase()] = false; });

// Pure Map Layout Environment Matrix
const MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
    [1,0,2,2,0,0,1,0,3,3,3,0,0,4,0,1],
    [1,0,2,2,0,0,0,0,3,3,3,0,0,4,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,4,0,1],
    [1,0,0,0,4,4,4,4,0,0,0,0,0,0,0,1],
    [1,0,0,0,4,0,0,4,0,2,2,2,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];
const MAP_W = MAP[0].length, MAP_H = MAP.length;

const canvas = document.getElementById("gameCanvas"), ctx = canvas.getContext("2d");
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener("resize", resizeCanvas); resizeCanvas();

function loadAdminFile() {
    let localAdmins = JSON.parse(localStorage.getItem('chromashift_admins')) || [];
    adminList = [...new Set([...localAdmins])];
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

function updateMenuUI() { 
    document.getElementById('userBadge').innerText = `Logged in as: ${playerData.username}`; 
    document.getElementById('usernameFallback').value = playerData.username;
    loadAdminFile(); 
}

function handleGoogleSignIn(r) {
    let payload = JSON.parse(window.atob(r.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    playerData.username = payload.given_name || payload.name; playerData.email = payload.email;
    localStorage.setItem('chromashift_save', JSON.stringify(playerData)); 
    updateMenuUI();
}

function togglePanel(id) {
    const p = document.getElementById(id); if(!p) return;
    p.style.display = p.style.display === "none" ? "flex" : "none";
}

function selectGameMode() {
    let inputName = document.getElementById('usernameFallback').value.trim();
    if(inputName) {
        playerData.username = inputName;
        localStorage.setItem('chromashift_save', JSON.stringify(playerData));
    }
    
    gameActive = true;
    document.getElementById('mainMenu').style.display = "none";
    ['topbarMenu', 'chatContainer', 'actionControls'].forEach(id => {
        let el = document.getElementById(id); if(el) el.style.display = "flex";
    });
    
    addChatMessage("SYSTEM", "Spawning into 3D Arena... Camera Engine Ready.");
    checkAdminStatus();
}

function exitToLobby() {
    gameActive = false;
    ['topbarMenu', 'chatContainer', 'adminConsole', 'actionControls'].forEach(id => {
        let el = document.getElementById(id); if(el) el.style.display = "none";
    });
    document.getElementById('mainMenu').style.display = "flex";
}

function togglePaintMode() {
    player.activePaintTool = player.activePaintTool === "brush" ? null : "brush";
    addChatMessage("SYSTEM", player.activePaintTool ? "Paint tool armed! Tap the top half of the screen to sample textures." : "Paint tool stowed away.");
}

function cyclePoses() {
    const poses = ["stand", "crouch", "flat"];
    player.currentPose = poses[(poses.indexOf(player.currentPose) + 1) % poses.length];
    addChatMessage("SYSTEM", `Form shifted to: ${player.currentPose.toUpperCase()}`);
}

function updateGameTick() {
    if (!gameActive) return;

    if (keysPressed['a'] || keysPressed['arrowleft']) player.angle -= player.rotateSpeed;
    if (keysPressed['d'] || keysPressed['arrowright']) player.angle += player.rotateSpeed;

    let moveStep = 0;
    if (keysPressed['w'] || keysPressed['arrowup']) moveStep = player.speed;
    if (keysPressed['s'] || keysPressed['arrowdown']) moveStep = -player.speed;

    if (joystick.active) {
        player.angle += joystick.moveX * 0.04;
        moveStep = -joystick.moveY * player.speed;
    }

    if (moveStep !== 0) {
        let newX = player.x + Math.cos(player.angle) * moveStep;
        let newY = player.y + Math.sin(player.angle) * moveStep;
        
        let gridX = Math.floor(newX / GRID_SIZE);
        let gridY = Math.floor(newY / GRID_SIZE);
        let currGridX = Math.floor(player.x / GRID_SIZE);
        let currGridY = Math.floor(player.y / GRID_SIZE);

        if (gridX >= 0 && gridX < MAP_W && currGridY >= 0 && currGridY < MAP_H) {
            if (MAP[currGridY][gridX] === 0) player.x = newX;
        }
        if (currGridX >= 0 && currGridX < MAP_W && gridY >= 0 && gridY < MAP_H) {
            if (MAP[gridY][currGridX] === 0) player.y = newY;
        }
    }
}

function gameLoop() {
    updateGameTick();
    
    if (!gameActive) {
        ctx.fillStyle = "#0c0b14"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(gameLoop); return;
    }

    // Sky & Floor Fields
    ctx.fillStyle = "#161925"; ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    ctx.fillStyle = "#24293a"; ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    // Optimized Ray Casting Execution Limit
    const numRays = 120; 
    const columnWidth = Math.ceil(canvas.width / numRays);
    const deltaAngle = player.fov / numRays;
    const startAngle = player.angle - player.fov / 2;

    for (let i = 0; i < numRays; i++) {
        let rayAngle = startAngle + i * deltaAngle;
        let distance = 0, hitWall = false, wallType = 0;
        let cos = Math.cos(rayAngle), sin = Math.sin(rayAngle);

        while (!hitWall && distance < 1000) {
            distance += 4;
            let checkX = Math.floor((player.x + cos * distance) / GRID_SIZE);
            let checkY = Math.floor((player.y + sin * distance) / GRID_SIZE);

            if (checkX >= 0 && checkX < MAP_W && checkY >= 0 && checkY < MAP_H) {
                if (MAP[checkY][checkX] > 0) { hitWall = true; wallType = MAP[checkY][checkX]; }
            } else { break; }
        }

        let correctedDist = distance * Math.cos(rayAngle - player.angle);
        if (correctedDist < 1) correctedDist = 1;
        let wallHeight = (GRID_SIZE * canvas.height) / correctedDist;

        let col = "#3e4656"; 
        if (wallType === 2) col = "#a8744f"; 
        if (wallType === 3) col = "#00ffcc"; 
        if (wallType === 4) col = "#ebc45b"; 

        ctx.fillStyle = col;
        let shadeFactor = Math.max(0.15, 1 - (correctedDist / 700));
        ctx.globalAlpha = shadeFactor;
        ctx.fillRect(i * columnWidth, (canvas.height - wallHeight) / 2, columnWidth + 1, wallHeight);
        ctx.globalAlpha = 1.0;
    }

    if (player.activePaintTool) {
        let cx = canvas.width / 2, cy = canvas.height - 120;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(cx - 90, cy - 30, 180, 60);
        ctx.fillStyle = player.selectedColor; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, 2*Math.PI); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    }

    if (joystick.active) {
        ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.beginPath(); ctx.arc(joystick.startX, joystick.startY, 40, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = "#00ffcc"; ctx.beginPath(); ctx.arc(joystick.curX, joystick.curY, 15, 0, 2*Math.PI); ctx.fill();
    }

    requestAnimationFrame(gameLoop);
}

canvas.addEventListener("mousedown", (e) => {
    if (!gameActive) return;
    if (player.activePaintTool === "brush" && e.clientY < canvas.height / 2) {
        let sampleColors = ["#3e4656", "#a8744f", "#00ffcc", "#ebc45b"];
        player.selectedColor = sampleColors[Math.floor(Math.random() * sampleColors.length)];
        addChatMessage("SYSTEM", `Eyedropper Sampled: ${player.selectedColor}`);
    }
});

function handleTouchStart(cx, cy) {
    if (!gameActive) return;
    if (cx < window.innerWidth / 2) {
        joystick.active = true; joystick.startX = joystick.curX = cx; joystick.startY = joystick.curY = cy;
        joystick.moveX = joystick.moveY = 0;
    }
}
function handleTouchMove(cx, cy) {
    if (!joystick.active) return;
    joystick.curX = cx; joystick.curY = cy;
    let dx = cx - joystick.startX, dy = cy - joystick.startY, dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 40) { dx = (dx / dist) * 40; dy = (dy / dist) * 40; joystick.curX = joystick.startX + dx; joystick.curY = joystick.startY + dy; }
    joystick.moveX = dx / 40; joystick.moveY = dy / 40;
}

canvas.addEventListener("touchstart", (e) => { let t = e.changedTouches[0]; handleTouchStart(t.clientX, t.clientY); });
canvas.addEventListener("touchmove", (e) => { let t = e.changedTouches[0]; handleTouchMove(t.clientX, t.clientY); });
window.addEventListener("touchend", () => { joystick.active = false; });

function sendChatMessage() {
    const i = document.getElementById('chatInput'), t = i.value.trim(); if (!t) return; i.value = "";
    addChatMessage(playerData.username, t);
}
function addChatMessage(s, t) {
    const b = document.getElementById('chatMessages'), e = document.createElement('div'); e.className = "chat-line";
    e.innerHTML = s === "SYSTEM" ? `<span>[SYS]:</span> ${t}` : `<span>${s}:</span> ${t}`;
    if(b) { b.appendChild(e); b.scrollTop = b.scrollHeight; }
}

function executeConsoleCommand() {
    const i = document.getElementById('consoleInput'), f = i.value.trim(); if (!f || !isUserAdmin) return; i.value = "";
    logToConsole(playerData.username, f, false);
    const args = f.split(" "), cmd = args[0].toLowerCase();
    if (cmd === "!announce") { addChatMessage("SYSTEM", `🌐 ADMIN: ${args.slice(1).join(" ")}`); }
    else if (cmd === "!speed" && !isNaN(parseFloat(args[1]))) { player.speed = parseFloat(args[1]); }
}

function logToConsole(s, t, sys) {
    const b = document.getElementById('consoleLog'); if (!b) return; const l = document.createElement('div'); l.className = "console-line";
    let ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    l.innerHTML = sys ? `[${ts}] <span class="console-tag-system">[${s}]</span> ${t}` : `[${ts}] <span class="console-tag-admin">[ADMIN]:</span> ${t}`;
    b.appendChild(l); b.scrollTop = b.scrollHeight;
}

updateMenuUI();
requestAnimationFrame(gameLoop);
     

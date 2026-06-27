let playerData = JSON.parse(localStorage.getItem('chromashift_save')) || {
    username: "Guest Player",
    email: "",
    coins: 150
};

let adminList = [];
let currentSelectedTool = null;
let isUserAdmin = false;
let currentActiveMode = "singleplayer";
let gameActive = false;

// --- MAP ENGINE SETUP ---
const MAP_SIZE = 100000; 
const GRID_SIZE = 50;   

// Camera Configuration
let camera = { x: 50000, y: 50000 };
let zoomLevel = 1.0;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;

let isDragging = false;
let startDragX = 0, startDragY = 0;
let isRightClickDragging = false;

// --- MECHA CHAMELEON PLAYER OBJECT ---
let character = {
    x: 50025,
    y: 50025,
    targetX: 50025,
    targetY: 50025,
    size: 20,
    speed: 6,
    color: "#00ffcc",
    eyeAngle: 0
};

// --- KEYBOARD CONTROLS FOR ROBLOX WALKING ---
let keysPressed = {};
window.addEventListener("keydown", (e) => { 
    if (document.activeElement.tagName === 'INPUT') return; // Don't move while typing in chat/console
    keysPressed[e.key.toLowerCase()] = true; 
});
window.addEventListener("keyup", (e) => { keysPressed[e.key.toLowerCase()] = false; });

// --- PRE-GENERATED MAP STARTER DATA ---
let defaultBlocks = [
    // Center Core Lobby Base Platform
    {x: 49850, y: 49850, type: 'floor'}, {x: 49900, y: 49850, type: 'floor'}, {x: 49950, y: 49850, type: 'floor'}, {x: 50000, y: 49850, type: 'floor'}, {x: 50050, y: 49850, type: 'floor'}, {x: 50100, y: 49850, type: 'floor'}, {x: 50150, y: 49850, type: 'floor'},
    {x: 49850, y: 49900, type: 'floor'}, {x: 50150, y: 49900, type: 'floor'},
    {x: 49850, y: 49950, type: 'floor'}, {x: 50150, y: 49950, type: 'floor'},
    {x: 49850, y: 50000, type: 'floor'}, {x: 50150, y: 50000, type: 'floor'},
    {x: 49850, y: 50050, type: 'floor'}, {x: 50150, y: 50050, type: 'floor'},
    {x: 49850, y: 50100, type: 'floor'}, {x: 50150, y: 50100, type: 'floor'},
    {x: 49850, y: 50150, type: 'floor'}, {x: 49900, y: 50150, type: 'floor'}, {x: 49950, y: 50150, type: 'floor'}, {x: 50000, y: 50150, type: 'floor'}, {x: 50050, y: 50150, type: 'floor'}, {x: 50100, y: 50150, type: 'floor'}, {x: 50150, y: 50150, type: 'floor'},
    // Prebuilt Structural Border Fortress Walls
    {x: 49800, y: 49800, type: 'wall'}, {x: 49850, y: 49800, type: 'wall'}, {x: 49900, y: 49800, type: 'wall'}, {x: 49950, y: 49800, type: 'wall'}, {x: 50000, y: 49800, type: 'wall'}, {x: 50050, y: 49800, type: 'wall'}, {x: 50100, y: 49800, type: 'wall'}, {x: 50150, y: 49800, type: 'wall'}, {x: 50200, y: 49800, type: 'wall'},
    {x: 49800, y: 49850, type: 'wall'}, {x: 49800, y: 49900, type: 'wall'}, {x: 49800, y: 49950, type: 'wall'}, {x: 49800, y: 50000, type: 'wall'}, {x: 49800, y: 50050, type: 'wall'}, {x: 49800, y: 50100, type: 'wall'}, {x: 49800, y: 50150, type: 'wall'}, {x: 49800, y: 50200, type: 'wall'},
    {x: 50200, y: 49850, type: 'wall'}, {x: 50200, y: 49900, type: 'wall'}, {x: 50200, y: 49950, type: 'wall'}, {x: 50200, y: 50000, type: 'wall'}, {x: 50200, y: 50050, type: 'wall'}, {x: 50200, y: 50100, type: 'wall'}, {x: 50200, y: 50150, type: 'wall'}, {x: 50200, y: 50200, type: 'wall'},
    {x: 49850, y: 50200, type: 'wall'}, {x: 49900, y: 50200, type: 'wall'}, {x: 49950, y: 50200, type: 'wall'}, {x: 50000, y: 50200, type: 'wall'}, {x: 50050, y: 50200, type: 'wall'}, {x: 50100, y: 50200, type: 'wall'}, {x: 50150, y: 50200, type: 'wall'},
    // Epic Neon Center Runway Grid
    {x: 49950, y: 49950, type: 'neon'}, {x: 50000, y: 49950, type: 'neon'}, {x: 50050, y: 49950, type: 'neon'},
    {x: 49950, y: 50000, type: 'gold'}, {x: 50050, y: 50000, type: 'gold'},
    {x: 49950, y: 50050, type: 'neon'}, {x: 50000, y: 50050, type: 'neon'}, {x: 50050, y: 50050, type: 'neon'}
];

let mapBlocks = JSON.parse(localStorage.getItem('chromashift_map_blocks'));
if (!mapBlocks || mapBlocks.length === 0) {
    mapBlocks = defaultBlocks;
    localStorage.setItem('chromashift_map_blocks', JSON.stringify(mapBlocks));
}

let worldSpawnPoints = JSON.parse(localStorage.getItem('chromashift_spawns')) || {
    1: { x: 50000, y: 50000 }
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- FETCH ADMINS CONFIG ---
async function loadAdminFile() {
    try {
        const response = await fetch('admins.json');
        const fileAdmins = await response.json();
        let localAdmins = JSON.parse(localStorage.getItem('chromashift_admins')) || [];
        adminList = [...new Set([...fileAdmins, ...localAdmins])];
        checkAdminStatus();
    } catch (error) {
        adminList = JSON.parse(localStorage.getItem('chromashift_admins')) || [];
        checkAdminStatus();
    }
}

function checkAdminStatus() {
    const isNowAdmin = playerData.email && adminList.map(e => e.toLowerCase()).includes(playerData.email.toLowerCase());
    if (isNowAdmin) {
        isUserAdmin = true;
        document.getElementById('adminBadge').style.display = "block";
        if (gameActive) {
            document.getElementById('toggleConsoleBtn').style.display = "block";
            document.getElementById('toggleBuilderBtn').style.display = "block";
        }
    } else {
        isUserAdmin = false;
        document.getElementById('adminBadge').style.display = "none";
        document.getElementById('toggleConsoleBtn').style.display = "none";
        document.getElementById('toggleBuilderBtn').style.display = "none";
    }
}

function updateMenuUI() {
    document.getElementById('userBadge').innerText = `Logged in as: ${playerData.username}`;
    loadAdminFile();
}

function handleGoogleSignIn(response) {
    const responsePayload = parseJwt(response.credential);
    playerData.username = responsePayload.given_name || responsePayload.name;
    playerData.email = responsePayload.email;
    localStorage.setItem('chromashift_save', JSON.stringify(playerData));
    updateMenuUI();
}

function parseJwt(token) {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
}

// --- PANEL INTERFACES ---
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    let btn = document.getElementById(panelId === 'chatContainer' ? 'toggleChatBtn' : panelId === 'adminConsole' ? 'toggleConsoleBtn' : 'toggleBuilderBtn');
    if (panel.style.display === "none") {
        panel.style.display = "flex";
        if(btn) btn.classList.add('active');
    } else {
        panel.style.display = "none";
        if(btn) btn.classList.remove('active');
    }
}

// --- RUNTIME INITS ---
function selectGameMode(modeType) {
    currentActiveMode = modeType;
    gameActive = true;
    
    document.getElementById('mainMenu').style.display = "none";
    document.getElementById('topbarMenu').style.display = "flex";
    document.getElementById('chatContainer').style.display = "flex";
    document.getElementById('toggleChatBtn').classList.add('active');
    
    document.getElementById('adminConsole').style.display = "none";
    document.getElementById('builderPanel').style.display = "none";

    document.getElementById('lobbyStatusBadge').innerText = modeType.toUpperCase() + " MODE";
    addChatMessage("SYSTEM", `Lobby connected: [${modeType.toUpperCase()}]`);

    checkAdminStatus();

    // Reset Mecha Chameleon Position
    const activeSpawn = worldSpawnPoints[1] || { x: 50000, y: 50000 };
    character.x = activeSpawn.x;
    character.y = activeSpawn.y;
    character.targetX = activeSpawn.x;
    character.targetY = activeSpawn.y;
}

function exitToLobby() {
    gameActive = false;
    currentSelectedTool = null;
    document.getElementById('topbarMenu').style.display = "none";
    document.getElementById('chatContainer').style.display = "none";
    document.getElementById('adminConsole').style.display = "none";
    document.getElementById('builderPanel').style.display = "none";
    document.getElementById('mainMenu').style.display = "flex";
}

// --- ROBLOX ROBUST FOV ZOOM LOGIC ---
canvas.addEventListener("wheel", (e) => {
    if (!gameActive) return;
    e.preventDefault();

    if (e.deltaY < 0) zoomLevel = Math.min(MAX_ZOOM, zoomLevel + 0.1);
    else zoomLevel = Math.max(MIN_ZOOM, zoomLevel - 0.1);

    document.getElementById('zoomPercent').innerText = `Zoom: ${Math.floor(zoomLevel * 100)}%`;
});

// --- CHARACTER MOVEMENT ENGINE & ENGINE UPDATE LOOPS ---
function updateGameTick() {
    if (!gameActive) return;

    let moveX = 0;
    let moveY = 0;

    // Check keyboard registers for Roblox WASD/Arrow Controls
    if (keysPressed['w'] || keysPressed['arrowup']) moveY -= 1;
    if (keysPressed['s'] || keysPressed['arrowdown']) moveY += 1;
    if (keysPressed['a'] || keysPressed['arrowleft']) moveX -= 1;
    if (keysPressed['d'] || keysPressed['arrowright']) moveX += 1;

    // Apply translation values
    if (moveX !== 0 || moveY !== 0) {
        // Normalize vector paths
        let angle = Math.atan2(moveY, moveX);
        character.x += Math.cos(angle) * character.speed;
        character.y += Math.sin(angle) * character.speed;
        
        // Sync position target points
        character.targetX = character.x;
        character.targetY = character.y;
        
        // Rotate chameleon independent eyes dynamically while moving
        character.eyeAngle += 0.15;
    } else {
        // Interpolate character to mobile click target location points smoothly
        let dx = character.targetX - character.x;
        let dy = character.targetY - character.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > character.speed) {
            let angle = Math.atan2(dy, dx);
            character.x += Math.cos(angle) * character.speed;
            character.y += Math.sin(angle) * character.speed;
            character.eyeAngle += 0.08;
        } else {
            character.x = character.targetX;
            character.y = character.targetY;
        }
    }

    // Keep character confined strictly inside map limits
    character.x = Math.max(10, Math.min(MAP_SIZE - 10, character.x));
    character.y = Math.max(10, Math.min(MAP_SIZE - 10, character.y));

    // Roblox Lock-Camera-on-Character Tracking Interpolation
    camera.x = character.x - (canvas.width / 2) / zoomLevel;
    camera.y = character.y - (canvas.height / 2) / zoomLevel;
}

function gameLoop() {
    updateGameTick();

    if (!gameActive) {
        ctx.fillStyle = "#0c0b14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(gameLoop);
        return;
    }

    // Clear and scale view matrix based on FOV configuration
    ctx.fillStyle = "#161920";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-camera.x, -camera.y);

    // Render Massive 100k Grass Base
    ctx.fillStyle = "#1b361f";
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Visible Local Grid Shader Lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;

    let startX = Math.max(0, Math.floor(camera.x / GRID_SIZE) * GRID_SIZE);
    let endX = Math.min(MAP_SIZE, startX + (canvas.width / zoomLevel) + GRID_SIZE);
    let startY = Math.max(0, Math.floor(camera.y / GRID_SIZE) * GRID_SIZE);
    let endY = Math.min(MAP_SIZE, startY + (canvas.height / zoomLevel) + GRID_SIZE);

    for (let x = startX; x <= endX; x += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    // Draw Blocks Array Map Layers
    mapBlocks.forEach(b => {
        if(b.type === 'wall') ctx.fillStyle = "#8a3d22";       // Industrial Brick Wall
        else if(b.type === 'floor') ctx.fillStyle = "#2d527c";  // Metal Plate Flooring
        else if(b.type === 'neon') ctx.fillStyle = "#ff00aa";   // High-Power Magenta Neon Block
        else if(b.type === 'gold') ctx.fillStyle = "#d4af37";   // Refined Gold Block
        
        ctx.fillRect(b.x, b.y, GRID_SIZE, GRID_SIZE);
        
        // Add specific style details for special building blocks
        if (b.type === 'neon') {
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#ff00aa";
            ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
            ctx.fillRect(b.x + 5, b.y + 5, GRID_SIZE - 10, GRID_SIZE - 10);
            ctx.shadowBlur = 0; // Reset glow
        } else {
            ctx.strokeStyle = "rgba(0,0,0,0.2)";
            ctx.strokeRect(b.x, b.y, GRID_SIZE, GRID_SIZE);
        }
    });

    // Draw Active Level Spawns Indicator Rings
    Object.keys(worldSpawnPoints).forEach(id => {
        let sp = worldSpawnPoints[id];
        ctx.strokeStyle = "#00ffcc";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 20, 0, 2 * Math.PI);
        ctx.stroke();
    });

    // --- DRAW MECHA CHAMELEON CHARACTER MODEL ---
    ctx.save();
    ctx.translate(character.x, character.y);
    
    // Smooth model rotation path based on velocity direction vectors
    let walkAngle = Math.atan2(character.targetY - character.y, character.targetX - character.x);
    if (keysPressed['w'] || keysPressed['arrowup'] || keysPressed['s'] || keysPressed['arrowdown'] || keysPressed['a'] || keysPressed['arrowleft'] || keysPressed['d'] || keysPressed['arrowright']) {
        let mx = 0, my = 0;
        if (keysPressed['w'] || keysPressed['arrowup']) my -= 1;
        if (keysPressed['s'] || keysPressed['arrowdown']) my += 1;
        if (keysPressed['a'] || keysPressed['arrowleft']) mx -= 1;
        if (keysPressed['d'] || keysPressed['arrowright']) mx += 1;
        walkAngle = Math.atan2(my, mx);
    }
    ctx.rotate(walkAngle);

    // Mecha Hard Metallic Body Core
    ctx.fillStyle = character.color;
    ctx.beginPath();
    ctx.arc(0, 0, character.size, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Robotic Coiled Cyber Tail Ring
    ctx.strokeStyle = character.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-character.size + 4, 0, 8, 0, Math.PI * 1.5, true);
    ctx.stroke();

    // Left Mechanical Eye Dome (Rotates independently)
    ctx.save();
    ctx.translate(character.size - 6, -character.size + 8);
    ctx.rotate(character.eyeAngle);
    ctx.fillStyle = "#111116";
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#ff3300"; // Laser Target Reticle Pupil Pointer
    ctx.fillRect(2, -1, 4, 2);
    ctx.restore();

    // Right Mechanical Eye Dome (Rotates independently)
    ctx.save();
    ctx.translate(character.size - 6, character.size - 8);
    ctx.rotate(-character.eyeAngle * 1.2);
    ctx.fillStyle = "#111116";
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#ff3300";
    ctx.fillRect(2, -1, 4, 2);
    ctx.restore();

    ctx.restore(); // Character layer restore

    ctx.restore(); // Zoom core scale matrix loop restore
    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

// --- INPUT SELECTION PARSERS FOR SCREEN CLICKING & MOUSE EVENTS ---
canvas.addEventListener("mousedown", (e) => {
    if (e.button === 2 || e.button === 1) {
        isRightClickDragging = true;
        startDragX = e.clientX; startDragY = e.clientY;
    }
});

canvas.addEventListener("mousemove", (e) => {
    if (isRightClickDragging) {
        let diffX = e.clientX - startDragX;
        let diffY = e.clientY - startDragY;
        camera.x -= diffX / zoomLevel;
        camera.y -= diffY / zoomLevel;
        startDragX = e.clientX; startDragY = e.clientY;
    }
});

window.addEventListener("mouseup", (e) => {
    if (e.button === 2 || e.button === 1) isRightClickDragging = false;
});

// Disable right click menu inside game layer window context
window.addEventListener("contextmenu", e => e.preventDefault());

canvas.addEventListener("click", (e) => {
    if (!gameActive) return;
    
    // Determine screen context absolute translation points mapped into actual world coordinate points
    let worldX = (e.clientX / zoomLevel) + camera.x;
    let worldY = (e.clientY / zoomLevel) + camera.y;

    if (isUserAdmin && currentSelectedTool) {
        // Snap directly onto structural building grid boundaries
        let gridX = Math.floor(worldX / GRID_SIZE) * GRID_SIZE;
        let gridY = Math.floor(worldY / GRID_SIZE) * GRID_SIZE;

        if (currentSelectedTool === 'erase') {
            mapBlocks = mapBlocks.filter(b => !(b.x === gridX && b.y === gridY));
        } else {
            mapBlocks = mapBlocks.filter(b => !(b.x === gridX && b.y === gridY));
            mapBlocks.push({ x: gridX, y: gridY, type: currentSelectedTool });
        }
        localStorage.setItem('chromashift_map_blocks', JSON.stringify(mapBlocks));
    } else {
        // Run standard Roblox mouse single-click path target movement vector update
        character.targetX = worldX;
        character.targetY = worldY;
    }
});

// Touch controls handling mobile tapping to move character
canvas.addEventListener("touchstart", (e) => {
    if (!gameActive || e.touches.length > 1) return;
    let worldX = (e.touches[0].clientX / zoomLevel) + camera.x;
    let worldY = (e.touches[0].clientY / zoomLevel) + camera.y;
    
    if (isUserAdmin && currentSelectedTool) {
        let gridX = Math.floor(worldX / GRID_SIZE) * GRID_SIZE;
        let gridY = Math.floor(worldY / GRID_SIZE) * GRID_SIZE;
        if (currentSelectedTool === 'erase') {
            mapBlocks = mapBlocks.filter(b => !(b.x === gridX && b.y === gridY));
        } else {
            mapBlocks = mapBlocks.filter(b => !(b.x === gridX && b.y === gridY));
            mapBlocks.push({ x: gridX, y: gridY, type: currentSelectedTool });
        }
        localStorage.setItem('chromashift_map_blocks', JSON.stringify(mapBlocks));
    } else {
        character.targetX = worldX;
        character.targetY = worldY;
    }
});

// --- MESSAGING AND EXTENDED CONSOLE COMMAND SYSTEM ---
function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const txt = input.value.trim();
    if (!txt) return;
    input.value = "";
    addChatMessage(playerData.username, txt);
}

function addChatMessage(sender, text) {
    const box = document.getElementById('chatMessages');
    const el = document.createElement('div');
    el.className = "chat-line";
    el.innerHTML = sender === "SYSTEM" ? `<span class="chat-system">[SYS]:</span> ${text}` : `<span>${sender}:</span> ${text}`;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
}

function executeConsoleCommand() {
    const input = document.getElementById('consoleInput');
    const fullCommand = input.value.trim();
    if (!fullCommand || !isUserAdmin) return;
    input.value = "";

    logToConsole(playerData.username, fullCommand, false);
    const args = fullCommand.split(" ");
    const cmd = args[0].toLowerCase();

    if (cmd === "!admin") {
        const targetEmail = args[1] ? args[1].toLowerCase() : "";
        if (targetEmail && !adminList.includes(targetEmail)) {
            adminList.push(targetEmail);
            let localAdmins = JSON.parse(localStorage.getItem('chromashift_admins')) || [];
            localAdmins.push(targetEmail);
            localStorage.setItem('chromashift_admins', JSON.stringify(localAdmins));
            logToConsole("SYSTEM", `Promoted email: ${targetEmail}`, true);
        }
    } 
    else if (cmd === "!setspawn") {
        const spawnId = parseInt(args[1]) || 1;
        if (spawnId >= 1 && spawnId <= 5) {
            worldSpawnPoints[spawnId] = { x: character.x, y: character.y };
            localStorage.setItem('chromashift_spawns', JSON.stringify(worldSpawnPoints));        else if (cmd === "!setspawn") {
            const spawnId = parseInt(args[1]) || 1;
            if (spawnId >= 1 && spawnId <= 5) {
                worldSpawnPoints[spawnId] = { x: character.x, y: character.y };
                localStorage.setItem('chromashift_spawns', JSON.stringify(worldSpawnPoints));
                logToConsole("SYSTEM", `Spawn Slot [${spawnId}] saved at player location: (${Math.floor(character.x)}, ${Math.floor(character.y)})`, true);
            }
        }
        else if (cmd === "!announce") {
            const msg = args.slice(1).join(" ");
            addChatMessage("SYSTEM", `🌐 ADMIN: ${msg}`);
        }
        else if (cmd === "!speed") {
            const amt = parseFloat(args[1]);
            if (!isNaN(amt)) {
                character.speed = amt;
                logToConsole("SYSTEM", `Mecha velocity scalar configured to value: ${amt}`, true);
            }
        }
        else if (cmd === "!size") {
            const amt = parseFloat(args[1]);
            if (!isNaN(amt) && amt > 2) {
                character.size = amt;
                logToConsole("SYSTEM", `Character chassis diameter scaled to: ${amt}px`, true);
            }
        }
        else if (cmd === "!tp") {
            const tx = parseFloat(args[1]);
            const ty = parseFloat(args[2]);
            if (!isNaN(tx) && !isNaN(ty)) {
                character.x = tx; character.y = ty;
                character.targetX = tx; character.targetY = ty;
                logToConsole("SYSTEM", `Instant particle teleportation complete: (${tx}, ${ty})`, true);
            }
        }
        else if (cmd === "!color") {
            const hexStr = args[1];
            if (hexStr) {
                character.color = hexStr;
                logToConsole("SYSTEM", `Chameleon primary cosmetic armor plate color matched: ${hexStr}`, true);
            }
        }
        else if (cmd === "!clearblocks") {
            mapBlocks = [];
            localStorage.setItem('chromashift_map_blocks', JSON.stringify(mapBlocks));
            logToConsole("SYSTEM", `Flushed project build vectors. All custom canvas elements wiped.`, true);
        }
        else if (cmd === "!clearconsole") {
            document.getElementById('consoleLog').innerHTML = "";
        } 
        else {
            logToConsole("ENGINE", "Unknown developer command matrix string query.", true);
        }
    }
}

function logToConsole(sender, text, isSystemGenerated) {
    const logBox = document.getElementById('consoleLog');
    if (!logBox) return;
    const line = document.createElement('div');
    line.className = "console-line";
    let timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.innerHTML = isSystemGenerated ? `[${timestamp}] <span class="console-tag-system">[${sender}]</span> ${text}` : `[${timestamp}] <span class="console-tag-admin">[ADMIN - ${sender}]:</span> ${text}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
}

function setBuildItem(toolType) { 
    document.getElementById('tool-wall').classList.remove('active');
    document.getElementById('tool-floor').classList.remove('active');
    document.getElementById('tool-neon').classList.remove('active');
    document.getElementById('tool-gold').classList.remove('active');
    document.getElementById('tool-erase').classList.remove('active');

    if (currentSelectedTool === toolType) {
        currentSelectedTool = null;
    } else {
        currentSelectedTool = toolType;
        document.getElementById(`tool-${toolType}`).classList.add('active');
    }
}

function openShop() { 
    alert("Shop database offline."); 
}

// Start everything up on file initialization
updateMenuUI();
        
      

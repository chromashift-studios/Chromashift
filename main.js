let playerData = JSON.parse(localStorage.getItem('chromashift_save')) || {
    username: "Guest Player",
    email: "",
    coins: 150
};

let adminList = [];
let currentSelectedTool = null;
let isUserAdmin = false;
let currentActiveMode = "singleplayer";

// --- MAP ENGINE CONSTANTS ---
const MAP_SIZE = 100000; 
const GRID_SIZE = 50;   

// Camera vectors
let camera = { x: 50000, y: 50000 }; 
let isDragging = false;
let startDragX = 0, startDragY = 0;

// Placed map elements storage
let mapBlocks = JSON.parse(localStorage.getItem('chromashift_map_blocks')) || [];

let worldSpawnPoints = JSON.parse(localStorage.getItem('chromashift_spawns')) || {
    1: { x: 50000, y: 50020 }
};

// Canvas references
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- FETCH ADMINS FROM FILE ---
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
    if (playerData.email && adminList.map(e => e.toLowerCase()).includes(playerData.email.toLowerCase())) {
        isUserAdmin = true;
        document.getElementById('adminBadge').style.display = "block";
        document.getElementById('adminConsole').style.display = "flex"; 
        document.getElementById('builderPanel').style.display = "flex"; 
        logToConsole("SYSTEM", "Admin authorization approved.", true);
    } else {
        isUserAdmin = false;
        document.getElementById('adminBadge').style.display = "none";
        document.getElementById('adminConsole').style.display = "none";
        document.getElementById('builderPanel').style.display = "none";
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

// --- GAME RUNTIME LOOPS ---
function selectGameMode(modeType) {
    currentActiveMode = modeType;
    document.getElementById('mainMenu').style.display = "none";
    document.getElementById('chatContainer').style.display = "flex";
    
    document.getElementById('activeModeStatus').innerText = modeType.toUpperCase() + " MODE";
    addChatMessage("SYSTEM", `Lobby connected: [${modeType.toUpperCase()}]`);

    // Center camera on Spawn point 1
    const activeSpawn = worldSpawnPoints[1] || { x: 50000, y: 50000 };
    camera.x = activeSpawn.x - canvas.width / 2;
    camera.y = activeSpawn.y - canvas.height / 2;

    addChatMessage("SYSTEM", `Spawned safely at: (${Math.floor(activeSpawn.x)}, ${Math.floor(activeSpawn.y)})`);
    
    // Kickstart rendering frame ticks
    requestAnimationFrame(gameLoop);
}

// --- 100,000 x 100,000 RENDER MATRIX ---
function gameLoop() {
    // Clear display buffer
    ctx.fillStyle = "#161920";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Translate rendering grid positions to camera viewport coordinate mappings
    ctx.translate(-camera.x, -camera.y);

    // Render Green Grass Land base boundary borders
    ctx.fillStyle = "#1e3d23";
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Draw Grid Network segments visible to camera field
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;

    let startX = Math.max(0, Math.floor(camera.x / GRID_SIZE) * GRID_SIZE);
    let endX = Math.min(MAP_SIZE, startX + canvas.width + GRID_SIZE);
    let startY = Math.max(0, Math.floor(camera.y / GRID_SIZE) * GRID_SIZE);
    let endY = Math.min(MAP_SIZE, startY + canvas.height + GRID_SIZE);

    for (let x = startX; x <= endX; x += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    // Render placed block arrays
    mapBlocks.forEach(b => {
        if(b.type === 'wall') ctx.fillStyle = "#a64b2a";
        else if(b.type === 'floor') ctx.fillStyle = "#2a6fa6";
        ctx.fillRect(b.x, b.y, GRID_SIZE, GRID_SIZE);
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.strokeRect(b.x, b.y, GRID_SIZE, GRID_SIZE);
    });

    // Draw current active saved Spawns indicators
    Object.keys(worldSpawnPoints).forEach(id => {
        let sp = worldSpawnPoints[id];
        ctx.fillStyle = "#00ffcc";
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 12, 0, 2 * Math.PI);
        ctx.fill();
    });

    ctx.restore();
    requestAnimationFrame(gameLoop);
}

// --- DRAG TO MOVE & BLOCK PLACE SYSTEM ---
canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    startDragX = e.clientX; startDragY = e.clientY;
});

canvas.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    let diffX = e.clientX - startDragX;
    let diffY = e.clientY - startDragY;

    // Shift camera space positions
    camera.x -= diffX; camera.y -= diffY;
    startDragX = e.clientX; startDragY = e.clientY;

    // Bounds limit check
    camera.x = Math.max(0, Math.min(MAP_SIZE - canvas.width, camera.x));
    camera.y = Math.max(0, Math.min(MAP_SIZE - canvas.height, camera.y));
});

window.addEventListener("mouseup", () => { isDragging = false; });

// Touch inputs for mobile devices
canvas.addEventListener("touchstart", (e) => {
    isDragging = true;
    startDragX = e.touches[0].clientX; startDragY = e.touches[0].clientY;
});
canvas.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    let diffX = e.touches[0].clientX - startDragX;
    let diffY = e.touches[0].clientY - startDragY;
    camera.x -= diffX; camera.y -= diffY;
    startDragX = e.touches[0].clientX; startDragY = e.touches[0].clientY;
});
canvas.addEventListener("touchend", () => { isDragging = false; });

// Handle Block placements on tapping screen map mesh
canvas.addEventListener("click", (e) => {
    if (!isUserAdmin || !currentSelectedTool) return;
    
    // Convert click vector directly to absolute world positioning offsets
    let worldX = e.clientX + camera.x;
    let worldY = e.clientY + camera.y;

    // Snap positions seamlessly onto grid dimensions
    let gridX = Math.floor(worldX / GRID_SIZE) * GRID_SIZE;
    let gridY = Math.floor(worldY / GRID_SIZE) * GRID_SIZE;

    if (currentSelectedTool === 'erase') {
        mapBlocks = mapBlocks.filter(b => !(b.x === gridX && b.y === gridY));
    } else {
        // Filter overlaps and add element node record
        mapBlocks = mapBlocks.filter(b => !(b.x === gridX && b.y === gridY));
        mapBlocks.push({ x: gridX, y: gridY, type: currentSelectedTool });
    }
    localStorage.setItem('chromashift_map_blocks', JSON.stringify(mapBlocks));
});

// --- COMMAND INTERACTION PORTS ---
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

    if (fullCommand.startsWith("!admin ")) {
        const targetEmail = fullCommand.replace("!admin ", "").trim().toLowerCase();
        if (targetEmail && !adminList.includes(targetEmail)) {
            adminList.push(targetEmail);
            let localAdmins = JSON.parse(localStorage.getItem('chromashift_admins')) || [];
            localAdmins.push(targetEmail);
            localStorage.setItem('chromashift_admins', JSON.stringify(localAdmins));
            logToConsole("SYSTEM", `Promoted email: ${targetEmail}`, true);
        }
    } 
    else if (fullCommand.startsWith("!setspawn ")) {
        const spawnId = parseInt(fullCommand.replace("!setspawn ", "").trim());
        if (spawnId >= 1 && spawnId <= 5) {
            // Pin the spawn point directly to the camera center position
            let centerX = camera.x + canvas.width / 2;
            let centerY = camera.y + canvas.height / 2;
            
            worldSpawnPoints[spawnId] = { x: centerX, y: centerY };
            localStorage.setItem('chromashift_spawns', JSON.stringify(worldSpawnPoints));
            logToConsole("SYSTEM", `Spawn Slot [${spawnId}] saved at center: (${Math.floor(centerX)}, ${Math.floor(centerY)})`, true);
        }
    }
    else if (fullCommand === "!clearconsole") {
        document.getElementById('consoleLog').innerHTML = "";
    } 
    else if (fullCommand.startsWith("!announce ")) {
        addChatMessage("SYSTEM", `🌐 ADMIN: ${fullCommand.replace("!announce ", "")}`);
    }
}

function logToConsole(sender, text, isSystemGenerated) {
    const logBox = document.getElementById('consoleLog');
    const line = document.createElement('div');
    line.className = "console-line";
    let timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.innerHTML = isSystemGenerated ? `[${timestamp}] <span class="console-tag-system">[${sender}]</span> ${text}` : `[${timestamp}] <span class="console-tag-admin">[ADMIN - ${sender}]:</span> ${text}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
}

function setBuildItem(toolType) { currentSelectedTool = toolType; }
function openShop() { alert("Shop database offline."); }

updateMenuUI();
            

let playerData = JSON.parse(localStorage.getItem('chromashift_save')) || { username: "Guest Player", email: "" };
let adminList = [], isUserAdmin = false, currentActiveMode = "singleplayer", gameActive = false;

const MAP_SIZE = 5000, GRID_SIZE = 50;   
let camera = { x: 2500, y: 2500 }, zoomLevel = 1.1, keysPressed = {};

// MECCHA CHAMELEON CHARACTER DEFINITION
let character = { 
    x: 2500, y: 2450, size: 22, speed: 4.5, 
    role: "hider", // "hider" or "seeker"
    currentPose: "stand", // "stand", "crouch", "ball", "flat"
    isStuckToWall: false,
    
    // 3D-Style Body Paint Grid (Simulating Meccha Chameleon's body mapping)
    // 4 quadrants: 0=Front, 1=Back, 2=Left, 3=Right
    bodyPaint: ["#ffffff", "#ffffff", "#ffffff", "#ffffff"], 
    selectedColor: "#ff0000",
    activePaintTool: null // null, "brush", "eyedropper"
};

// Controls
window.addEventListener("keydown", (e) => { 
    if (document.activeElement.tagName !== 'INPUT') {
        keysPressed[e.key.toLowerCase()] = true;
        
        // 'F' Key toggles Paint Mode
        if (e.key.toLowerCase() === 'f' && gameActive && character.role === "hider") {
            togglePaintMode();
        }
        // 'R' Key cycles through Poses
        if (e.key.toLowerCase() === 'r' && gameActive && character.role === "hider") {
            cyclePoses();
        }
        // 'T' Key triggers a Taunt / Whistle sound indicator
        if (e.key.toLowerCase() === 't' && gameActive && character.role === "hider") {
            triggerTauntWhistle();
        }
    }
});
window.addEventListener("keyup", (e) => { keysPressed[e.key.toLowerCase()] = false; });

// Environment Generation (Cluttered Room Style for hiding)
let mapBlocks = [];
function generateMecchaMap() {
    mapBlocks = [];
    // Outer boundary walls
    for(let x=0; x<MAP_SIZE; x+=100) { mapBlocks.push({x, y:0, type:'wall'}, {x, y:MAP_SIZE-50, type:'wall'}); }
    for(let y=0; y<MAP_SIZE; y+=100) { mapBlocks.push({x:0, y, type:'wall'}, {x:MAP_SIZE-50, y, type:'wall'}); }
    
    // Colorful hiding props, rooms, and patterns
    for(let i=0; i<40; i++) {
        let rx = Math.floor((Math.random() * (MAP_SIZE - 400) + 200)/50)*50;
        let ry = Math.floor((Math.random() * (MAP_SIZE - 400) + 200)/50)*50;
        let randomType = ['wall', 'floor', 'neon', 'gold'][Math.floor(Math.random()*4)];
        
        // Spawn clusters to represent furniture/crates
        for(let w=0; w<3; w++) {
            for(let h=0; h<3; h++) {
                mapBlocks.push({ x: rx + (w*50), y: ry + (h*50), type: randomType });
            }
        }
    }
}
generateMecchaMap();

// Seekers/Hiders list (AI Simulation for offline/singleplayer testing)
let entities = [];
function spawnMatchPlayers() {
    entities = [];
    for(let i=0; i<8; i++) {
        entities.push({
            x: 2200 + Math.random()*600, y: 2200 + Math.random()*600,
            role: i === 0 ? "seeker" : "hider",
            bodyPaint: [getRandomColor(), getRandomColor(), getRandomColor(), getRandomColor()],
            currentPose: ["stand", "crouch", "ball"][Math.floor(Math.random()*3)],
            size: 22, tx: 0, ty: 0, timer: 0
        });
    }
}
spawnMatchPlayers();

const canvas = document.getElementById("gameCanvas"), ctx = canvas.getContext("2d");
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener("resize", resizeCanvas); resizeCanvas();

// Admin System Checks
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
    isUserAdmin = adminList.some(a => { let al = a.toLowerCase(); return currentEmail === al || currentName === al; }) || currentName.includes("xian") || currentName.includes("ariel");
    document.getElementById('adminBadge').style.display = isUserAdmin ? "block" : "none";
}

function updateMenuUI() { document.getElementById('userBadge').innerText = `Logged in as: ${playerData.username}`; loadAdminFile(); }

function lockLandscape() {
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => console.log("Landscape lock enabled via menu hook."));
    }
}

function selectGameMode(mode) {
    lockLandscape();
    currentActiveMode = mode; gameActive = true;
    character.role = mode === "seeker" ? "seeker" : "hider";
    
    ['mainMenu', 'adminConsole', 'builderPanel'].forEach(id => document.getElementById(id).style.display = "none");
    ['topbarMenu', 'chatContainer'].forEach(id => document.getElementById(id).style.display = "flex");
    document.getElementById('lobbyStatusBadge').innerText = `${character.role.toUpperCase()} MODE`;
    
    addChatMessage("SYSTEM", `Meccha Match Started! You are a ${character.role.toUpperCase()}`);
    if(character.role === "hider") addChatMessage("SYSTEM", "Press [F] to Paint, [R] to Change Pose, [T] to Whistle!");
    
    character.x = 2500; character.y = 2450; character.bodyPaint = ["#ffffff", "#ffffff", "#ffffff", "#ffffff"];
    spawnMatchPlayers();
}

function exitToLobby() {
    gameActive = false;
    ['topbarMenu', 'chatContainer', 'adminConsole', 'builderPanel'].forEach(id => document.getElementById(id).style.display = "none");
    document.getElementById('mainMenu').style.display = "flex";
}

// TOGGLE CONTROLS FOR MECCHA UTILITIES
function togglePaintMode() {
    if (character.activePaintTool === "brush") {
        character.activePaintTool = null;
        addChatMessage("SYSTEM", "Paintbrush put away.");
    } else {
        character.activePaintTool = "brush";
        addChatMessage("SYSTEM", "Paint Mode Active! Click on your body quadrants to paint, or click environment to Eyedrop.");
    }
}

function cyclePoses() {
    const poses = ["stand", "crouch", "ball", "flat"];
    let idx = poses.indexOf(character.currentPose);
    character.currentPose = poses[(idx + 1) % poses.length];
    addChatMessage("SYSTEM", `Pose changed to: ${character.currentPose.toUpperCase()}`);
}

function triggerTauntWhistle() {
    addChatMessage(playerData.username, "🎵 *LOUD WHISTLE TAUNT* 🎵");
    // Visually create an expanding tracking ripple on screen for seekers to notice
    character.whistleRipple = 1;
}

// GAME UPDATE CALCULATIONS
function updateGameTick() {
    if (!gameActive) return;
    let mx = 0, my = 0;

    // Movement speeds vary based on active postures
    let currentSpeed = character.speed;
    if (character.currentPose === "crouch") currentSpeed *= 0.5;
    if (character.currentPose === "ball" || character.currentPose === "flat") currentSpeed = 0; // Frozen entirely while blended!

    if (currentSpeed > 0) {
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

    // Handle whistle ring expansion animations
    if (character.whistleRipple && character.whistleRipple > 0) {
        character.whistleRipple += 4;
        if (character.whistleRipple > 150) character.whistleRipple = 0;
    }

    // Process AI Bots actions
    entities.forEach(bot => {
        if (bot.role === "seeker") {
            bot.timer--;
            if (bot.timer <= 0) {
                bot.tx = (Math.random() - 0.5) * 4; bot.ty = (Math.random() - 0.5) * 4;
                bot.timer = 80 + Math.random() * 100;
            }
            bot.x += bot.tx; bot.y += bot.ty;
        }
    });

    camera.x = character.x - (canvas.width / 2) / zoomLevel;
    camera.y = character.y - (canvas.height / 2) / zoomLevel;
}

// CANVAS DRAW ENGINE
function gameLoop() {
    updateGameTick();
    ctx.fillStyle = gameActive ? "#161920" : "#0c0b14"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!gameActive) { requestAnimationFrame(gameLoop); return; }

    ctx.save(); ctx.scale(zoomLevel, zoomLevel); ctx.translate(-camera.x, -camera.y);
    
    // Background Ground
    ctx.fillStyle = "#2c313c"; ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Grid Floor Overlay
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)"; ctx.lineWidth = 1;
    let sx = Math.max(0, Math.floor(camera.x / GRID_SIZE) * GRID_SIZE), ex = Math.min(MAP_SIZE, sx + (canvas.width / zoomLevel) + GRID_SIZE);
    let sy = Math.max(0, Math.floor(camera.y / GRID_SIZE) * GRID_SIZE), ey = Math.min(MAP_SIZE, sy + (canvas.height / zoomLevel) + GRID_SIZE);
    for (let x = sx; x <= ex; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, ey); ctx.stroke(); }
    for (let y = sy; y <= ey; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(ex, y); ctx.stroke(); }

    // Render Environment Furniture & Walls
    mapBlocks.forEach(b => {
        ctx.fillStyle = b.type === 'wall' ? "#3a4252" : b.type === 'floor' ? "#a3704c" : b.type === 'neon' ? "#00ffcc" : "#e5c158";
        ctx.fillRect(b.x, b.y, GRID_SIZE, GRID_SIZE);
        ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.strokeRect(b.x, b.y, GRID_SIZE, GRID_SIZE);
    });

    // Render Competitors / Bot Targets
    entities.forEach(bot => {
        drawChameleonCharacter(bot.x, bot.y, bot.size, bot.bodyPaint, bot.currentPose, bot.role);
    });

    // Render Client Player character model
    drawChameleonCharacter(character.x, character.y, character.size, character.bodyPaint, character.currentPose, character.role);

    // Draw active Whistle Sound Indicators mapping layout
    if (character.whistleRipple && character.whistleRipple > 0) {
        ctx.strokeStyle = "rgba(0, 255, 204, " + (1 - character.whistleRipple/150) + ")";
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(character.x, character.y, character.whistleRipple, 0, 2*Math.PI); ctx.stroke();
    }

    ctx.restore();
    
    // Paint HUD Overlay indicator when tool is functional
    if (character.activePaintTool) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.fillRect(10, window.innerHeight - 90, 310, 80);
        ctx.fillStyle = "#ffffff"; ctx.font = "14px sans-serif";
        ctx.fillText(`PAINT MODE: Click player to paint | Active Color: ${character.selectedColor}`, 20, window.innerHeight - 60);
        ctx.fillText("Press [R] to change Form-Pose. Press [F] to exit tools.", 20, window.innerHeight - 30);
    }
    
    requestAnimationFrame(gameLoop);
}

// COMPACT SEGMENTATION DRAW FUNCTION FOR MULTI-SURFACE PAINTING
function drawChameleonCharacter(x, y, baseSize, paintArray, pose, role) {
    ctx.save(); ctx.translate(x, y);
    
    let size = baseSize;
    if (pose === "crouch") size *= 0.8;
    if (pose === "ball") size *= 0.65;
    
    if (role === "seeker") {
        // Seekers have distinct bright warning frames so hiders identify them instantly
        ctx.fillStyle = "#ff3333"; ctx.beginPath(); ctx.arc(0, 0, size, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = "#111"; ctx.fillRect(-6, -10, 12, 6);
        ctx.fillStyle = "#fff"; ctx.fillText("SEEKER", -22, -size - 5);
        ctx.restore(); return;
    }

    // Render customizable flat 4-Quadrant surface layers
    if (pose === "flat") {
        // Flattened out flat over surface spaces
        ctx.fillStyle = paintArray[0]; ctx.fillRect(-size*1.4, -size*0.4, size*2.8, size*0.8);
    } else if (pose === "ball") {
        // Curled up tight into round shape blobs
        ctx.fillStyle = paintArray[0]; ctx.beginPath(); ctx.arc(0, 0, size, 0, 2*Math.PI); ctx.fill();
    } else {
        // Regular detailed segmented layouts (Front, Back, Left, Right sides paintable)
        // Top Left quadrant
        ctx.fillStyle = paintArray[0]; ctx.beginPath(); ctx.arc(0, 0, size, Math.PI, 1.5*Math.PI); ctx.lineTo(0,0); ctx.fill();
        // Top Right quadrant
        ctx.fillStyle = paintArray[1]; ctx.beginPath(); ctx.arc(0, 0, size, 1.5*Math.PI, 2*Math.PI); ctx.lineTo(0,0); ctx.fill();
        // Bottom Right quadrant
        ctx.fillStyle = paintArray[2]; ctx.beginPath(); ctx.arc(0, 0, size, 0, 0.5*Math.PI); ctx.lineTo(0,0); ctx.fill();
        // Bottom Left quadrant
        ctx.fillStyle = paintArray[3]; ctx.beginPath(); ctx.arc(0, 0, size, 0.5*Math.PI, Math.PI); ctx.lineTo(0,0); ctx.fill();
    }

    // Outer edge border lines mapping setup
    ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, size, 0, 2*Math.PI); ctx.stroke();
    
    ctx.restore();
}

// EYEDROPPER & PAINT CANVAS INTERACTION CLICKS
canvas.addEventListener("mousedown", (e) => {
    if (!gameActive || !character.activePaintTool) return;
    
    // Compute game-world grid coordinate tracking lines
    let clickWorldX = (e.clientX / zoomLevel) + camera.x;
    let clickWorldY = (e.clientY / zoomLevel) + camera.y;
    
    // Check if player clicked directly on themselves to apply active texture colors
    let distanceToPlayer = Math.sqrt(Math.pow(clickWorldX - character.x, 2) + Math.pow(clickWorldY - character.y, 2));
    
    if (distanceToPlayer <= character.size) {
        // Determine which side slice area was clicked to change that segment's color
        let angle = Math.atan2(clickWorldY - character.y, clickWorldX - character.x);
        if (angle < 0) angle += 2 * Math.PI;
        
        let quadrantIndex = Math.floor(angle / (Math.PI / 2)); // 0 to 3
        character.bodyPaint[quadrantIndex] = character.selectedColor;
    } else {
        // EYEDROPPER ACTION: Sample color directly from clicked map environment layout
        let sampledColor = "#2c313c"; // fallback ground color
        mapBlocks.forEach(b => {
            if (clickWorldX >= b.x && clickWorldX <= b.x + GRID_SIZE && clickWorldY >= b.y && clickWorldY <= b.y + GRID_SIZE) {
                sampledColor = b.type === 'wall' ? "#3a4252" : b.type === 'floor' ? "#a3704c" : b.type === 'neon' ? "#00ffcc" : "#e5c158";
            }
        });
        character.selectedColor = sampledColor;
    }
});

function getRandomColor() { return ['#3a4252', '#a3704c', '#00ffcc', '#e5c158', '#ffffff'][Math.floor(Math.random()*5)]; }

function sendChatMessage() {
    const i = document.getElementById('chatInput'), t = i.value.trim(); if (!t) return; i.value = "";
    addChatMessage(playerData.username, t);
}
function addChatMessage(s, t) {
    const b = document.getElementById('chatMessages'), e = document.createElement('div'); e.className = "chat-line";
    e.innerHTML = s === "SYSTEM" ? `<span class="chat-system">[SYS]:</span> ${t}` : `<span>${s}:</span> ${t}`;
    b.appendChild(e); b.scrollTop = b.scrollHeight;
}

updateMenuUI();
requestAnimationFrame(gameLoop);

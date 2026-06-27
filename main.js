let playerData = { username: "Guest Player" };
let gameActive = false;
const GRID_SIZE = 64; 

// 3D Engine State
let player = {
    x: 3.5 * GRID_SIZE, 
    y: 3.5 * GRID_SIZE,
    angle: Math.PI / 4,
    fov: Math.PI / 3, // 60 Degree FOV
    speed: 3.0, 
    rotateSpeed: 0.05,
    selectedColor: "#00ffcc",
    activePaintTool: null,
    currentPose: "stand"
};

let joystick = { active: false, startX: 0, startY: 0, curX: 0, curY: 0, moveX: 0, moveY: 0 };
let keysPressed = {};

window.addEventListener("keydown", (e) => { keysPressed[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { keysPressed[e.key.toLowerCase()] = false; });

// Pure Map Layout Matrix (0 = Empty Space, Numbers = Wall Textures)
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
function resizeCanvas() { 
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight; 
}
window.addEventListener("resize", resizeCanvas); 
resizeCanvas();

function selectGameMode() {
    let inputName = document.getElementById('usernameFallback').value.trim();
    if(inputName) playerData.username = inputName; Player
    
    gameActive = true;
    document.getElementById('mainMenu').style.display = "none";
    ['topbarMenu', 'chatContainer', 'actionControls'].forEach(id => {
        let el = document.getElementById(id);
        if(el) el.style.display = "flex";
    });
    addChatMessage("SYSTEM", "Spawning... Camera Engine Ready.");
}

function exitToLobby() {
    gameActive = false;
    ['topbarMenu', 'chatContainer', 'actionControls'].forEach(id => {
        let el = document.getElementById(id);
        if(el) el.style.display = "none";
    });
    document.getElementById('mainMenu').style.display = "flex";
}

function togglePaintMode() {
    player.activePaintTool = player.activePaintTool === "brush" ? null : "brush";
    addChatMessage("SYSTEM", player.activePaintTool ? "Paint tool armed!" : "Paint tool stowed away.");
}

function cyclePoses() {
    const poses = ["stand", "crouch", "flat"];
    player.currentPose = poses[(poses.indexOf(player.currentPose) + 1) % poses.length];
    addChatMessage("SYSTEM", `Form shifted to: ${player.currentPose.toUpperCase()}`);
}

function updateGameTick() {
    if (!gameActive) return;

    // Handle Keyboard Turning
    if (keysPressed['a'] || keysPressed['arrowleft']) player.angle -= player.rotateSpeed;
    if (keysPressed['d'] || keysPressed['arrowright']) player.angle += player.rotateSpeed;

    let moveStep = 0;
    if (keysPressed['w'] || keysPressed['arrowup']) moveStep = player.speed;
    if (keysPressed['s'] || keysPressed['arrowdown']) moveStep = -player.speed;

    // Handle Mobile Virtual Touch Joystick
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

        // Safe Map Bound Check Collision Prevention
        if (gridX >= 0 && gridX < MAP_W && currGridY >= 0 && currGridY < MAP_H) {
            if (MAP[currGridY][gridX] === 0) player.x = newX;
        }
        if (currGridX >= 0 && currGridX < MAP_W && gridY >= 0 && gridY < MAP_H) {
            if (MAP[gridY][currGridX] === 0) player.y = newY;
        }
    }
}

// THE MOBILE-OPTIMIZED 3D RAYCASTER
function gameLoop() {
    updateGameTick();
    
    if (!gameActive) {
        ctx.fillStyle = "#0c0b14"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(gameLoop); 
        return;
    }

    // Sky & Floor
    ctx.fillStyle = "#161925"; ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    ctx.fillStyle = "#24293a"; ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    // FIXED RAY COUNT: Prevents mobile crashes!
    const numRays = 120; 
    const columnWidth = Math.ceil(canvas.width / numRays);
    const deltaAngle = player.fov / numRays;
    const startAngle = player.angle - player.fov / 2;

    for (let i = 0; i < numRays; i++) {
        let rayAngle = startAngle + i * deltaAngle;
        let distance = 0;
        let hitWall = false;
        let wallType = 0;

        let cos = Math.cos(rayAngle);
        let sin = Math.sin(rayAngle);

        // Scan environment line vectors
        while (!hitWall && distance < 1000) {
            distance += 4; // Bigger steps = lightning-fast execution
            let checkX = Math.floor((player.x + cos * distance) / GRID_SIZE);
            let checkY = Math.floor((player.y + sin * distance) / GRID_SIZE);

            if (checkX >= 0 && checkX < MAP_W && checkY >= 0 && checkY < MAP_H) {
                if (MAP[checkY][checkX] > 0) {
                    hitWall = true;
                    wallType = MAP[checkY][checkX];
                }
            } else {
                break; // Break loop if looking outside bounds
            }
        }

        // Fix fish-eye warp lens projection distortion
        let correctedDist = distance * Math.cos(rayAngle - player.angle);
        if (correctedDist < 1) correctedDist = 1;
        
        let wallHeight = (GRID_SIZE * canvas.height) / correctedDist;

        // Color mapping matching video components
        let col = "#3e4656"; 
        if (wallType === 2) col = "#a8744f"; // Wooden texture structures
        if (wallType === 3) col = "#00ffcc"; // Chameleon neon cells
        if (wallType === 4) col = "#ebc45b"; // Solid Gold blocks

        // Perspective depth shading
        ctx.fillStyle = col;
        let shadeFactor = Math.max(0.15, 1 - (correctedDist / 700));
        ctx.globalAlpha = shadeFactor;
        
        ctx.fillRect(i * columnWidth, (canvas.height - wallHeight) / 2, columnWidth + 1, wallHeight);
        ctx.globalAlpha = 1.0;
    }

    // Paint UI Display Tracker
    if (player.activePaintTool) {
        let cx = canvas.width / 2, cy = canvas.height - 120;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(cx - 90, cy - 30, 180, 60);
        ctx.fillStyle = player.selectedColor; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, 2*Math.PI); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    }

    // Joystick Overlay
    if (joystick.active) {
        ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.beginPath(); ctx.arc(joystick.startX, joystick.startY, 40, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = "#00ffcc"; ctx.beginPath(); ctx.arc(joystick.curX, joystick.curY, 15, 0, 2*Math.PI); ctx.fill();
    }

    requestAnimationFrame(gameLoop);
}

// Click/Tap to Eyedrop Sample Map Textures
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
    const b = document.getElementById('chatMessages'), e = document.createElement('div');
    e.innerHTML = `<strong>${s}:</strong> ${t}`; if(b) { b.appendChild(e); b.scrollTop = b.scrollHeight; }
}

requestAnimationFrame(gameLoop);
            

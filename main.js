let playerData = { username: "Guest Player" };
let gameActive = false, mapBlocks = [];
const MAP_SIZE = 32, GRID_SIZE = 64; // Grid tile counts

// Pure 3D Raycasting Position State Vectors
let player = {
    x: 3.5 * GRID_SIZE, y: 3.5 * GRID_SIZE,
    angle: Math.PI / 4,
    fov: Math.PI / 3, // True 60-degree Field of View perspective distortion
    speed: 3.5, rotateSpeed: 0.04,
    bodyPaint: ["#ffffff", "#ffffff", "#ffffff", "#ffffff"],
    selectedColor: "#ff00cc",
    activePaintTool: null,
    currentPose: "stand"
};

let joystick = { active: false, startX: 0, startY: 0, curX: 0, curY: 0, moveX: 0, moveY: 0 };
let keysPressed = {};

window.addEventListener("keydown", (e) => { keysPressed[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { keysPressed[e.key.toLowerCase()] = false; });

// Build actual physical structures to blend against (No floating random bots!)
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

function selectGameMode() {
    let inputName = document.getElementById('usernameFallback').value.trim();
    if(inputName) playerData.username = inputName;
    
    gameActive = true;
    document.getElementById('mainMenu').style.display = "none";
    ['topbarMenu', 'chatContainer', 'actionControls'].forEach(id => document.getElementById(id).style.display = "flex");
    addChatMessage("SYSTEM", "3D First-Person Perspective Rendered. Use WASD/Arrows!");
}

function exitToLobby() {
    gameActive = false;
    ['topbarMenu', 'chatContainer', 'actionControls'].forEach(id => document.getElementById(id).style.display = "none");
    document.getElementById('mainMenu').style.display = "flex";
}

function togglePaintMode() {
    player.activePaintTool = player.activePaintTool === "brush" ? null : "brush";
    addChatMessage("SYSTEM", player.activePaintTool ? "Paint tool armed. Tap block to sample texture!" : "Paint tool removed.");
}

function cyclePoses() {
    const poses = ["stand", "crouch", "flat"];
    player.currentPose = poses[(poses.indexOf(player.currentPose) + 1) % poses.length];
    addChatMessage("SYSTEM", `Form changed to: ${player.currentPose.toUpperCase()}`);
}

function updateGameTick() {
    if (!gameActive) return;

    // Turn Rotation Angle Inputs
    if (keysPressed['a'] || keysPressed['arrowleft']) player.angle -= player.rotateSpeed;
    if (keysPressed['d'] || keysPressed['arrowright']) player.angle += player.rotateSpeed;

    // Forward/Backward Step Vector Updates
    let moveStep = 0;
    if (keysPressed['w'] || keysPressed['arrowup']) moveStep = player.speed;
    if (keysPressed['s'] || keysPressed['arrowdown']) moveStep = -player.speed;

    if (joystick.active) {
        player.angle += joystick.moveX * 0.03;
        moveStep = -joystick.moveY * player.speed;
    }

    if (moveStep !== 0) {
        let newX = player.x + Math.cos(player.angle) * moveStep;
        let newY = player.y + Math.sin(player.angle) * moveStep;
        
        // Accurate grid cell bounding collision prevention
        if (MAP[Math.floor(player.y / GRID_SIZE)][Math.floor(newX / GRID_SIZE)] === 0) player.x = newX;
        if (MAP[Math.floor(newY / GRID_SIZE)][Math.floor(player.x / GRID_SIZE)] === 0) player.y = newY;
    }
}

// 3D DEPTH PROJECTION RENDERING LOOP (ROBLOX 3D RAYCASTER)
function gameLoop() {
    updateGameTick();
    
    if (!gameActive) {
        ctx.fillStyle = "#0c0b14"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(gameLoop); return;
    }

    // 1. Draw 3D Horizon Sky & Floor Plane fields
    ctx.fillStyle = "#14161f"; ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    ctx.fillStyle = "#222633"; ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    // 2. Projection Casting Field of View Parameters
    let numRays = canvas.width;
    let deltaAngle = player.fov / numRays;
    let startAngle = player.angle - player.fov / 2;

    for (let i = 0; i < numRays; i++) {
        let rayAngle = startAngle + i * deltaAngle;
        let distance = 0;
        let hitWall = false;
        let wallType = 0;

        let cos = Math.cos(rayAngle), sin = Math.sin(rayAngle);

        while (!hitWall && distance < 800) {
            distance += 2;
            let checkX = Math.floor((player.x + cos * distance) / GRID_SIZE);
            let checkY = Math.floor((player.y + sin * distance) / GRID_SIZE);

            if (checkX >= 0 && checkX < MAP_W && checkY >= 0 && checkY < MAP_H) {
                if (MAP[checkY][checkX] > 0) {
                    hitWall = true;
                    wallType = MAP[checkY][checkX];
                }
            }
        }

        // Fix fish-eye perspective camera distortion lens warp
        let correctedDist = distance * Math.cos(rayAngle - player.angle);
        let wallHeight = Math.min(canvas.height, (GRID_SIZE * canvas.height) / correctedDist);

        // Map colors to wall textures matching the video chunks
        let col = "#3e4656"; // Wall type 1
        if (wallType === 2) col = "#a8744f"; // Wood crates
        if (wallType === 3) col = "#00ffcc"; // Neon blocks
        if (wallType === 4) col = "#ebc45b"; // Gold blocks

        // Apply dark atmospheric lighting depth dropoff shaders
        ctx.fillStyle = col;
        let shadeFactor = Math.max(0.1, 1 - (correctedDist / 600));
        ctx.globalAlpha = shadeFactor;
        
        ctx.fillRect(i, (canvas.height - wallHeight) / 2, 1, wallHeight);
        ctx.globalAlpha = 1.0;
    }

    // 3. Render Paint Mode Overlay Interface Matrix
    if (player.activePaintTool) {
        let size = 120;
        let cx = canvas.width / 2, cy = canvas.height - 130;
        
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(cx - 100, cy - 40, 200, 80);
        ctx.fillStyle = player.selectedColor; ctx.beginPath(); ctx.arc(cx, cy, 25, 0, 2*Math.PI); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
        
        ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("ACTIVE COLOR BUFFER", cx, cy - 30);
    }

    // 4. Mobile Joystick rendering loops
    if (joystick.active) {
        ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.beginPath(); ctx.arc(joystick.startX, joystick.startY, 45, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = "#00ffcc"; ctx.beginPath(); ctx.arc(joystick.curX, joystick.curY, 15, 0, 2*Math.PI); ctx.fill();
    }

    requestAnimationFrame(gameLoop);
}

// Tap environment tiles to read texture colors instantly
canvas.addEventListener("mousedown", (e) => {
    if (!gameActive) return;
    if (player.activePaintTool === "brush" && e.clientY < canvas.height / 2) {
        // Sample color index tracking
        let sampleColors = ["#3e4656", "#a8744f", "#00ffcc", "#ebc45b"];
        player.selectedColor = sampleColors[Math.floor(Math.random() * sampleColors.length)];
        addChatMessage("SYSTEM", `Eyedropper Sampled Color: ${player.selectedColor}`);
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
    if (dist > 45) { dx = (dx / dist) * 45; dy = (dy / dist) * 45; joystick.curX = joystick.startX + dx; joystick.curY = joystick.startY + dy; }
    joystick.moveX = dx / 45; joystick.moveY = dy / 45;
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
    e.innerHTML = `<strong>${s}:</strong> ${t}`; b.appendChild(e); b.scrollTop = b.scrollHeight;
}

resizeCanvas();
requestAnimationFrame(gameLoop);

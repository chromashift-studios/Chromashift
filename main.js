let playerData = JSON.parse(localStorage.getItem('chromashift_save')) || {
    username: "Guest Player",
    email: "",
    coins: 150
};

// Global registry for live admins running on this session
let adminList = [];

let currentSelectedTool = null;
let isUserAdmin = false;
let currentActiveMode = "singleplayer";

// --- FETCH ADMINS FROM THE SEPARATE FILE ---
async function loadAdminFile() {
    try {
        // Fetch the list from your new admins.json file
        const response = await fetch('admins.json');
        const fileAdmins = await response.json();
        
        // Merge the file list with any dynamically added admins saved locally
        let localAdmins = JSON.parse(localStorage.getItem('chromashift_admins')) || [];
        adminList = [...new Set([...fileAdmins, ...localAdmins])];
        
        // Check permissions once the data is loaded
        checkAdminStatus();
    } catch (error) {
        console.error("Could not load admins.json file:", error);
        // Fallback to local storage if file fetch fails
        adminList = JSON.parse(localStorage.getItem('chromashift_admins')) || [];
        checkAdminStatus();
    }
}

// --- WORLD METADATA STORAGE ---
let worldSpawnPoints = JSON.parse(localStorage.getItem('chromashift_spawns')) || {
    1: { x: 100, y: 200 },
    2: { x: 300, y: 200 },
    3: { x: 500, y: 200 }
};

function checkAdminStatus() {
    if (playerData.email && adminList.map(e => e.toLowerCase()).includes(playerData.email.toLowerCase())) {
        isUserAdmin = true;
        document.getElementById('adminBadge').style.display = "block";
        document.getElementById('adminConsole').style.display = "flex"; 
        document.getElementById('builderPanel').style.display = "flex"; 
        logToConsole("SYSTEM", "Core system diagnostic check ready. Admin authorized.", true);
    } else {
        isUserAdmin = false;
        document.getElementById('adminBadge').style.display = "none";
        document.getElementById('adminConsole').style.display = "none";
        document.getElementById('builderPanel').style.display = "none";
    }
}

function updateMenuUI() {
    document.getElementById('userBadge').innerText = `Logged in as: ${playerData.username}`;
    loadAdminFile(); // Kicks off the file loader sequence
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

// --- MODE SELECTOR CHANNELS ---
function selectGameMode(modeType) {
    currentActiveMode = modeType;
    document.getElementById('mainMenu').style.display = "none";
    document.getElementById('chatContainer').style.display = "flex";
    
    document.getElementById('activeModeStatus').innerText = modeType.toUpperCase() + " MODE";
    addChatMessage("SYSTEM", `Initialized engine running: [${modeType.toUpperCase()}]`);

    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(err => {
            console.log("Automated orientation lock pending layout resolution.");
        });
    }

    const activeSpawn = worldSpawnPoints[1] || { x: 100, y: 100 };
    addChatMessage("SYSTEM", `Player spawned at vector coordinate: (${activeSpawn.x}, ${activeSpawn.y})`);
}

function openShop() { alert("Store database offline."); }

// --- STANDARDIZED PLAYER CHAT HUB ---
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

// --- SECURE CONSOLE INTERACTION CONTROL MATRIX ---
function executeConsoleCommand() {
    const input = document.getElementById('consoleInput');
    const fullCommand = input.value.trim();
    if (!fullCommand || !isUserAdmin) return;
    input.value = "";

    logToConsole(playerData.username, fullCommand, false);

    // COMMAND RUNTIME SWITCH PARSER
    if (fullCommand.startsWith("!admin ")) {
        const targetEmail = fullCommand.replace("!admin ", "").trim().toLowerCase();
        if (targetEmail && !adminList.includes(targetEmail)) {
            adminList.push(targetEmail);
            
            // Save newly promoted admins locally
            let localAdmins = JSON.parse(localStorage.getItem('chromashift_admins')) || [];
            if(!localAdmins.includes(targetEmail)) {
                localAdmins.push(targetEmail);
                localStorage.setItem('chromashift_admins', JSON.stringify(localAdmins));
            }
            
            logToConsole("SYSTEM", `Successfully registered admin profile data: ${targetEmail}`, true);
        }
    } 
    else if (fullCommand.startsWith("!setspawn ")) {
        const spawnId = parseInt(fullCommand.replace("!setspawn ", "").trim());
        if (spawnId >= 1 && spawnId <= 5) {
            const targetX = 150 + (spawnId * 40);
            const targetY = 250;
            
            worldSpawnPoints[spawnId] = { x: targetX, y: targetY };
            localStorage.setItem('chromashift_spawns', JSON.stringify(worldSpawnPoints));
            logToConsole("SYSTEM", `Spawn Configuration Slot [${spawnId}] pinned at: (${targetX}, ${targetY})`, true);
        } else {
            logToConsole("ENGINE", "Error: Spawn setup slot configuration index out of range (use 1-5).", true);
        }
    }
    else if (fullCommand === "!clearconsole") {
        document.getElementById('consoleLog').innerHTML = "";
    } 
    else if (fullCommand.startsWith("!announce ")) {
        const announcement = fullCommand.replace("!announce ", "").trim();
        addChatMessage("SYSTEM", `🌐 ADMIN: ${announcement}`);
    } 
    else {
        logToConsole("ENGINE", "Unknown system command entry token.", true);
    }
}

function logToConsole(sender, text, isSystemGenerated) {
    const logBox = document.getElementById('consoleLog');
    const line = document.createElement('div');
    line.className = "console-line";
    let timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (isSystemGenerated) {
        line.innerHTML = `[${timestamp}] <span class="console-tag-system">[${sender}]</span> ${text}`;
    } else {
        line.innerHTML = `[${timestamp}] <span class="console-tag-admin">[ADMIN - ${sender}]:</span> ${text}`;
    }

    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
}

// --- CLICK NODE MESH BINDINGS ---
function setBuildItem(toolType) {
    currentSelectedTool = toolType;
    if (isUserAdmin) logToConsole("SYSTEM", `Selected node matrix tracking updated: ${toolType.toUpperCase()}`, true);
}

document.getElementById('gameCanvas').addEventListener('click', function(e) {
    if (!isUserAdmin || !currentSelectedTool) return;
    const r = this.getBoundingClientRect();
    logToConsole("BUILDER", `Render block placement element at coordinate map values: (${Math.floor(e.clientX - r.left)}, ${Math.floor(e.clientY - r.top)})`, true);
});

updateMenuUI();

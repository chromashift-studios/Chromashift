// --- CENTRAL DATA STORAGE ---
let playerData = JSON.parse(localStorage.getItem('chromashift_save')) || {
    username: "Guest Player",
    email: "",
    coins: 150
};

// --- SECURITY: ADMIN ACCOUNTS LIST ---
// Put YOUR real personal Gmail inside this array so you have permission to run commands!
let adminList = JSON.parse(localStorage.getItem('chromashift_admins')) || [
    "your-own-gmail@gmail.com" 
];

let currentSelectedTool = null;
let isUserAdmin = false;

function checkAdminStatus() {
    if (playerData.email && adminList.includes(playerData.email.toLowerCase())) {
        isUserAdmin = true;
        document.getElementById('adminBadge').style.display = "block";
        document.getElementById('builderPanel').style.display = "flex";
        addSystemMessage(`Welcome back admin, ${playerData.username}. Construction tools active.`);
    } else {
        isUserAdmin = false;
        document.getElementById('adminBadge').style.display = "none";
        document.getElementById('builderPanel').style.display = "none";
    }
}

function updateMenuUI() {
    document.getElementById('userBadge').innerText = `Logged in as: ${playerData.username}`;
    checkAdminStatus();
}

// --- GOOGLE API SIGN-IN COMPLETION OVERWATCH ---
function handleGoogleSignIn(response) {
    const responsePayload = parseJwt(response.credential);
    
    playerData.username = responsePayload.given_name || responsePayload.name;
    playerData.email = responsePayload.email; // Capture user email address securely
    
    localStorage.setItem('chromashift_save', JSON.stringify(playerData));
    updateMenuUI();
}

function parseJwt(token) {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
}

// --- CORE GAME MATCH INITIALIZATION ---
function startGame() {
    document.getElementById('mainMenu').style.display = "none";
    document.getElementById('chatContainer').style.display = "flex";
    addSystemMessage("Match joined. Type messages below. Admins can use standard commands.");
}

function openShop() {
    alert("Shop module coming soon!");
}

// --- IN-GAME CHAT & ENGINE ADMIN COMMANDS ---
function sendChatMessage() {
    const inputElement = document.getElementById('chatInput');
    const messageText = inputElement.value.trim();
    if (!messageText) return;

    // Clear input field instantly
    inputElement.value = "";

    // Render message on locally running device screen layout
    appendLineToChat(playerData.username, messageText, isUserAdmin);

    // COMMAND DECODER SYSTEM
    if (messageText.startsWith("!Admin ")) {
        if (!isUserAdmin) {
            addSystemMessage("Error: You do not have permissions to use admin protocols.");
            return;
        }

        // Parse out target email string
        const targetEmail = messageText.replace("!Admin ", "").trim().toLowerCase();
        
        if (targetEmail && !adminList.includes(targetEmail)) {
            adminList.push(targetEmail);
            localStorage.setItem('chromashift_admins', JSON.stringify(adminList));
            addSystemMessage(`Success: ${targetEmail} has been added to the Builders list.`);
        }
    }
}

function appendLineToChat(sender, text, isAdminSource) {
    const chatBox = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = "chat-line";
    
    if (isAdminSource) {
        messageElement.innerHTML = `<span class="chat-admin-text">[ADMIN] ${sender}:</span> ${text}`;
    } else {
        messageElement.innerHTML = `<span>${sender}:</span> ${text}`;
    }
    
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function addSystemMessage(text) {
    const chatBox = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = "chat-line chat-system";
    messageElement.innerText = `[SYSTEM]: ${text}`;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- MAP BUILDER CONTROLS ENGINE ---
function setBuildItem(toolType) {
    currentSelectedTool = toolType;
    addSystemMessage(`Active tool updated to: ${toolType.toUpperCase()}`);
}

// Track mouse or finger clicks on the main gameplay arena canvas layout grid
document.getElementById('gameCanvas').addEventListener('click', function(event) {
    if (!isUserAdmin || !currentSelectedTool) return;
    
    const rect = this.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    addSystemMessage(`Placed ${currentSelectedTool.toUpperCase()} coordinate at point: (${Math.floor(clickX)}, ${Math.floor(clickY)})`);
});

// Run UI Setup
updateMenuUI();
          

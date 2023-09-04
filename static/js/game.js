const socket = io();

// Message div
const messageContainer = document.getElementById('message-container');

// Other top-level divs
const dashDiv = document.getElementById('dashboard-div');
const lobbyDiv = document.getElementById('lobby-div');
const gameDiv = document.getElementById('game-div');

// Dashboard elements
const userSpan = document.getElementById('user');
const newLobbyBtn = document.getElementById('newLobbyBtn');
const joinBtn = document.getElementById('joinBtn');
const joinInput = document.getElementById('joinInput');

// Lobby elements
const roomCodeSpan = document.getElementById('room-code');
const startBtn = document.getElementById('start-button');
const lobbyPlayerListDiv = document.getElementById('lobby-player-list');

// Game elements
const gamePlayerListDiv = document.getElementById('player-list');
const discardDiv = document.getElementById('discard-pile');
const drawDiv = document.getElementById('draw-pile');
const drawBtn = document.getElementById('draw-button');
const handTable = document.getElementById('hand-table');

// Helper functions
function showMessage(msg) {
    let newMessage = document.createElement('div');
    newMessage.classList.add("message");
    newMessage.textContent = msg;
    messageContainer.insertBefore(newMessage, messageContainer.firstChild);
    setTimeout(() => {
        messageContainer.removeChild(newMessage);
    }, 3000);
}

function titleCase(username) {
    return username.charAt(0).toUpperCase() + username.slice(1);
}

function addPlayer(username, cards = 0) {
    let newPlayer = document.createElement('li');

    let newPlayerImg = document.createElement('img');
    newPlayerImg.src = '/img/person-outline.svg';
    newPlayerImg.alt = `${username}'s picture`;

    let newPlayerName = document.createElement('h3');
    newPlayerName.innerText = titleCase(username);

    newPlayer.appendChild(newPlayerImg);
    newPlayer.appendChild(newPlayerName);
    lobbyPlayerListDiv.appendChild(newPlayer);

    if (titleCase(username) != userSpan.textContent) {
        let newGamePlayer = newPlayer.cloneNode(true);
        let newPlayerCards = document.createElement('p');
        newPlayerCards.innerText = `Cards: ${cards}`;

        newGamePlayer.appendChild(newPlayerCards);
        gamePlayerListDiv.appendChild(newGamePlayer);
    }
}

function refreshPlayers(players) {
    lobbyPlayerListDiv.innerHTML = "";
    gamePlayerListDiv.innerHTML = "";

    for (let player of players) {
        addPlayer(player);
    }
}

function getCardListener(card_type, card_color) {
    console.log(card_color, card_type);
}

function initializeGame(initialGameState) {
    console.log('Starting the game with initial state:', initialGameState);
}


// Event listeners
newLobbyBtn.addEventListener('click', () => {
    socket.emit('newLobby');
});

joinBtn.addEventListener('click', () => {
    const roomCode = joinInput.value;
    socket.emit('joinLobby', roomCode);
});

startBtn.addEventListener('click', () => {
    socket.emit('startGame', roomCodeSpan.textContent);
});

drawBtn.addEventListener('click', () => {
    const playerId = drawBtn.getAttribute('socket-id');
    socket.emit('draw', playerId)
});



// Sockets

socket.on('lobbyNotFound', () => {
    showMessage('Lobby not found');
});

socket.on('lobbyCreated', (roomCode, username) => {
    dashDiv.style.display = 'none';
    roomCodeSpan.textContent = roomCode;
    startBtn.style.display = null;
    lobbyDiv.style.display = null;
    addPlayer(username);
});

socket.on('startGame', (initialGameState) => {
    lobbyDiv.style.display = 'none';
    document.body.classList.add('game');
    gameDiv.style.display = null;
    showMessage('The game has begun!');

    initializeGame(initialGameState);
})

socket.on('playerJoined', (roomCode, newPlayer, players) => {
    refreshPlayers(players);
    if (newPlayer) {
        dashDiv.style.display = 'none';
        roomCodeSpan.textContent = roomCode;
        lobbyDiv.style.display = null;
    }
    showMessage(`A player joined. Current players: ${players.length}`);
});

socket.on('playerLeft', (players) => {
    showMessage(`A player left. Current players: ${players.length}`);
    refreshPlayers(players);
});

socket.on('lobbyCreationFailed', () => {
    showMessage('You have already created a lobby');
});

socket.on('lobbyJoinFailed', () => {
    showMessage('You have already joined a lobby');
});

socket.on('notEnoughPlayers', () => {
    showMessage('At least 2 players needed to start a game.');
});

socket.on('changeHost', () => {
    showMessage('You are now the host');
    startBtn.style.display = 'block';
    startBtn.style.marginLeft = 'auto';
    startBtn.style.marginRight = 'auto';
});

socket.on('')
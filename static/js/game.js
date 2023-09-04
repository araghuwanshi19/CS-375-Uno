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
const colorSelect = document.getElementById('color-select');
const gamePlayerListDiv = document.getElementById('player-list');
const discardDiv = document.getElementById('discard-pile');
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
    lobbyPlayerListDiv.innerText = "";
    gamePlayerListDiv.innerText = "";

    for (let player of players) {
        addPlayer(player);
    }
}

function setTopCard(card) {
    discardDiv.className = card.color;
    discardDiv.textContent = card.value;
}

function addCards(cards) {
    for (let card of cards) {
        let newCard = document.createElement("td");
        newCard.className = card.color;
        newCard.textContent = card.value;
        newCard.addEventListener("click", () => {
            socket.emit('playerMove', newCard.cellIndex);
        });
        handTable.appendChild(newCard);
    }
}

function removeCard(index) {
    handTable.removeChild(handTable.getElementsByTagName('td')[index]);
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

for (let colorBtn of colorSelect.getElementsByTagName('button')) {
    colorBtn.addEventListener('click', () => {
      socket.emit('colorChosen', roomCodeSpan.textContent, colorBtn.textContent.toLowerCase());
      colorSelect.classList.remove('show');
    });
  }

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

socket.on('playerJoined', (roomCode, newPlayer, players) => {
    refreshPlayers(players);
    if (currentPlayer === newPlayer) {
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
    startBtn.style.display = null;
    showMessage('You are the new host!');
});

socket.on('setupGame', (topCard, hand) => {
    console.log(topCard, hand);
    setTopCard(topCard);

    addCards(hand);
})

socket.on('startGame', () => {
    lobbyDiv.style.display = 'none';
    document.body.classList.add('game');
    gameDiv.style.display = null;
    showMessage('The game has begun!');
});

socket.on('yourTurn', () => {
    showMessage('It\'s your turn!');
});

socket.on('drawCards', (cards) => {
    addCards(cards);
    showMessage(`You drew ${cards.length} cards!`);
});

socket.on('playerChoseColor', (color) => {
    showMessage(`The new color is ${color}!`);
    discardDiv.style.backgroundColor = color.toLowerCase();
});

socket.on('chooseColor', () => {
    colorSelect.classList.add('show');
});
// Used for card data and types
const actions = ["draw-two", "reverse", "skip-turn"];
const wild_actions = ["draw-four", "change-color"];
const colors = ["red", "blue", "green", "yellow"];
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];


// Stuff specific to a game
let roomCode = "";
const deck = createStartDeck();
const discard = [];
const players = new Map();
let skipNext = false;
let clockwiseOrder = true;

/**
 * Creates the starting deck for the game - will always look the same until it's shuffled
 * @returns A list of dictionaries: each card is represented by a dictionary
 */
// Functions for game starting and ending processes

function begin(code, playerIds) {
    roomCode = code;

    playerIds.forEach(id => {
        players[id] = [];
    });

    shuffle();

    return getBeginState();
};



function createStartDeck() {
    const deck = [];

    for (const color of colors) {
        // Create the normal cards, two of each number from 1-9 and one 0, for each color.
        deck.push({type: "normal-card", color: color, number: 0});
        for (const number of numbers) {
            deck.push({type: "normal-card", color: color, number: number});
            deck.push({type: "normal-card", color: color, number: number});
        };

        // Create the action cards, two of each action, for each color
        for (const action of actions) {
            deck.push({type: "action-card", color: color, action: action});
            deck.push({type: "action-card", color: color, action: action});
        };
    };
    
    // Create the wild cards, four of each action
    for (let i = 0; i < 4; i++) {
        for (const action of this.wild_actions)
        deck.push({type: "wild-card", color: "black", action: action});
    };

    return deck;
};

function shuffle() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    };
};

function dealCards() {
    for (let i = 0; i < 7; i++) {
        players.forEach((value, key) => {
            drawCard(key);
        });
    };
};

function putDiscardToDeck() {
    deck = discard;
    discard = [];
    shuffle();
};

// Game state functions
function getBeginState() {
    return {
        deck: deck,
        discard: [],
        players: players,
        currentPlayer: getFirstPlayer(),
        currentColor: currentColor,
        currentNumber: currentNumber,
        clockwiseOrder: true,
        skipNext: false,
    };
};

function getFirstPlayer() {
    return players.keys.next().value;
};


function getPlayerWonGameState(playerId) {
    return {
        deck: deck,
        discard: discard,
        currentPlayer: playerId,
    };
};

function getNormalCardGameState(playerId, move) {
    return {
        deck: deck,
        discard: discard,
        currentPlayer: playerId,
        move: move,
        players: players,
        currentColor: currentColor,
        currentNumber: currentNumber,
    };
};

function getDrawTwoActionGameState(currentPlayerId, drawCardPlayerId) {
    return {
        deck: deck,
        discard: discard,
        currentPlayer: currentPlayerId,
        move: "draw-two",
        playerToDrawCard: drawCardPlayerId,
        players: players,
        currentColor: currentColor,
        currentNumber: currentNumber,
    };
};

function getDrawFourActionGameState(currentPlayerId, drawCardPlayerId) {
    return {
        deck: deck,
        discard: discard,
        currentPlayer: currentPlayerId,
        move: "draw-four",
        playerToDrawCard: drawCardPlayerId,
        players: players,
        currentColor: currentColor,
        currentNumber: currentNumber,
    };
};

function getColorChangeGameState(playerId) {
    return {
        deck: deck,
        discard: discard,
        currentPlayer: playerId,
        move: "change-color",
        players: players,
        currentColor: currentColor,
        currentNumber: currentNumber,
    };
};

function getReverseOrderGameState(playerId, move) {
    return {
        deck: deck,
        discard: discard,
        currentPlayer: playerId,
        move: "reverse",
        players: players,
        currentColor: currentColor,
        currentNumber: currentNumber,
        clockwiseOrder: clockwiseOrder,
    };
};


// Stuff for each turn
function doTurn(playerId) {
    if (skipNext) {
        skipNext = false;
        return;
    };

    const card = promptPlayerForMove();

}

function checkWinConditions(playerId) {
    if (players.get(playerId).length === 0) {

    }
    else if (deck.length === 0) {
        putDiscardToDeck();
    }
    else {

    };
};

// Predicates for card types
function isNormalCard(card) {
    return (card.type === "normal-card");
};

function isActionCard(card) {
    return (card.type === "action-card");
};

function isWildCard(card) {
    return (card.type === "wild-card");
};

function isSkipCard(card) {
    return (card.action === "skip-turn");
};

function isDrawTwoCard(card) {
    return (card.action === "draw-two");
};

function isReverseCard(card) {
    return (card.action === "reverse");
};

function isDrawFourCard(card) {
    return (card.action === "draw-four");
};

function isChangeColorCard(card) {
    return (card.action === "change-color");
};


// Game actions for players
function drawTwo(playerId) {
    for (let i = 0; i < 2; i++) {
        drawCard(playerId);
    };
};

function drawFour(playerId) {
    for (let i = 0; i < 4; i++) {
        drawCard(playerId);
    };
};

function drawCard(playerId) {
    const card = deck.pop();
    players.get(playerId).push(card);
};

function discard(playerId, cardMove) {
    const hand = players.get(playerId).filter(card => card != cardMove);
    players.set(playerId, hand);
    discard.push(cardMove);
};


// Functionality for potential special cards
function reverseTurnOrder() {
    clockwiseOrder = !clockwiseOrder;
};


function doCardAction(card) {
    if (isActionCard()) {
        if (isSkipCard(card)) {
            skipNext = true;
        }
        else if (isReverseCard(card)) {
            reverseTurnOrder();
        }
        else if (isDrawTwoCard(card)) {
            promptForChoiceToDraw(2);
        };
    }
    else if (isWildCard(card)) {
        if (isChangeColorCard(card)) {
            promptForColorChoice();
        }
        else if (isDrawFourCard(card)) {
            promptForChoiceToDraw(4);
        };
    }
    return;
};



// const data = doGame(gameState, playerMove);

// Used for card data and types
const actions = ["draw-two", "reverse", "skip-turn"];
const wild_actions = ["draw-four", "change-color"];
const colors = ["red", "blue", "green", "yellow"];
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];


// Stuff specific to a game
let roomCode = "";
const deck = createStartDeck();
const discardPile = [];
const players = new Map();
let skipNext = false;
let clockwiseOrder = true;


function createPlayerMap(playerIds) {
    const players = new Map();

    playerIds.forEach(id => {
        players[id] = [];
    });

    return players;
};

class Uno {
    constructor(code, playerIds) {
        this.code = code;
        this.players = createPlayerMap(playerIds)

        this.deck = createStartDeck();
        this.discard = [];
    }


    // Processes for a new game
    begin() {
        shuffle();
        dealCards();
        return getBeginState();
    };

    createStartDeck() {
        const deck = [];

        for (const color of colors) {
            // Create the normal cards, two of each number from 1-9 and one 0, for each color.
            this.deck.push({type: "normal-card", color: color, number: 0});
            for (const number of numbers) {
                this.deck.push({type: "normal-card", color: color, value: number});
                this.deck.push({type: "normal-card", color: color, value: number});
            };

            // Create the action cards, two of each action, for each color
            for (const action of actions) {
                this.deck.push({type: "action-card", color: color, value: action});
                this.deck.push({type: "action-card", color: color, value: action});
            };
        };
        
        // Create the wild cards, four of each action
        for (let i = 0; i < 4; i++) {
            for (const action of wild_actions)
            this.deck.push({type: "wild-card", color: "black", value: action});
        };

        return deck;
    };

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        };
    };

    dealCards() {
        for (let i = 0; i < 7; i++) {
            this.players.forEach((value, key) => {
                drawCard(key);
            });
        };
    };


    // Game actions for players
    drawCards(playerId, numCards) {
        for (let i = 0; i < numCards; i++) {
            drawCard(playerId);
        };

        return getDrawCardsActionGameState(playerId, numCards);
    };

    drawCard(playerId) {
        const card = deck.pop();
        players.get(playerId).push(card);
        return getPlayerDrewCardGameState(playerId, card);
    };



    // Game state getters
    getPlayerWonGameState(playerId) {
        return {
            winner: playerId,
        };
    };
    
    getRestartGameState(playerId) {
        return {
            deck: deck,
            discard: discardPile,
            currentPlayer: playerId,
            move: move,
            players: players,
            currentColor: currentColor,
            currentNumber: currentNumber,
        };
    };
    
    getPlayerDrewCardGameState(playerId, card) {
        return {
            deck: deck,
            currentPlayer: playerId,
            move: card,
        };
    };
    
    getNormalCardGameState(playerId, move) {
        return {
            deck: deck,
            discard: discardPile,
            currentPlayer: playerId,
            move: move,
            players: players,
            currentColor: currentColor,
            currentNumber: currentNumber,
        };
    };
    
    // Action cards
    getSkipCardGameState(playerId) {
        return {
            deck: deck,
            discard: discardPile,
            currentPlayer: playerId,
            move: "skip",
            skipNext: skipNext,
            currentColor: currentColor,
            currentNumber: currentNumber,
        };
    };

    getReverseOrderGameState(playerId) {
        return {
            deck: deck,
            discard: discardPile,
            currentPlayer: playerId,
            move: "reverse",
            players: players,
            currentColor: currentColor,
            currentNumber: currentNumber,
            clockwiseOrder: clockwiseOrder,
        };
    };
    
    // Wild cards
    getDrawCardsActionGameState(currentPlayerId, numCards) {
        return {
            deck: deck,
            discard: discardPile,
            currentPlayer: currentPlayerId,
            move: "draw",
            numCardsToDraw: numCards,
            playerToDrawCard: drawCardPlayerId,
            players: players,
            currentColor: currentColor,
            currentNumber: currentNumber,
        };
    };
    
    getColorChangeGameState(playerId) {
        return {
            deck: deck,
            discard: discardPile,
            currentPlayer: playerId,
            move: "change-color",
            players: players,
            currentColor: currentColor,
            currentNumber: currentNumber,
        };
    };
};


// // Functions for game starting and ending processes
// function begin(code, playerIds) {
//     roomCode = code;

//     playerIds.forEach(id => {
//         players[id] = [];
//     });

//     shuffle();
//     dealCards();
//     return getBeginState();
// };

// function createStartDeck() {
//     const deck = [];

//     for (const color of colors) {
//         // Create the normal cards, two of each number from 1-9 and one 0, for each color.
//         deck.push({type: "normal-card", color: color, number: 0});
//         for (const number of numbers) {
//             deck.push({type: "normal-card", color: color, value: number});
//             deck.push({type: "normal-card", color: color, value: number});
//         };

//         // Create the action cards, two of each action, for each color
//         for (const action of actions) {
//             deck.push({type: "action-card", color: color, value: action});
//             deck.push({type: "action-card", color: color, value: action});
//         };
//     };
    
//     // Create the wild cards, four of each action
//     for (let i = 0; i < 4; i++) {
//         for (const action of wild_actions)
//         deck.push({type: "wild-card", color: "black", value: action});
//     };

//     return deck;
// };

// function shuffle() {
//     for (let i = deck.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [deck[i], deck[j]] = [deck[j], deck[i]];
//     };
// };

// function dealCards() {
//     for (let i = 0; i < 7; i++) {
//         players.forEach((value, key) => {
//             drawCard(key);
//         });
//     };
// };

function putDiscardToDeck() {
    let topCard = discardPile.pop();
    deck = discardPile;
    discardPile = [topCard];
    shuffle();
};

// Game state functions
// function getBeginState() {
//     let topCard = deck.shift();
//     return {
//         roomCode: roomCode,
//         deck: deck,
//         discardPile: [topCard],
//         players: players,
//         currentPlayer: getFirstPlayer(),
//         currentColor: topCard.color,
//         currentNumber: topCard.number,
//         clockwiseOrder: true,
//         skipNext: false,
//     };
// };

// function getPlayerWonGameState(playerId) {
//     return {
//         winner: playerId,
//     };
// };

// function getRestartGameState(playerId) {
//     return {
//         deck: deck,
//         discard: discardPile,
//         currentPlayer: playerId,
//         move: move,
//         players: players,
//         currentColor: currentColor,
//         currentNumber: currentNumber,
//     };
// };

// function getPlayerDrewCardGameState(playerId, card) {
//     return {
//         deck: deck,
//         currentPlayer: playerId,
//         move: card,
//     };
// };

// function getNormalCardGameState(playerId, move) {
//     return {
//         deck: deck,
//         discard: discardPile,
//         currentPlayer: playerId,
//         move: move,
//         players: players,
//         currentColor: currentColor,
//         currentNumber: currentNumber,
//     };
// };

// function getSkipCardGameState(playerId) {
//     return {
//         deck: deck,
//         discard: discardPile,
//         currentPlayer: playerId,
//         move: "skip",
//         skipNext: skipNext,
//         currentColor: currentColor,
//         currentNumber: currentNumber,
//     };
// };

// function getDrawCardsActionGameState(currentPlayerId, numCards) {
//     return {
//         deck: deck,
//         discard: discardPile,
//         currentPlayer: currentPlayerId,
//         move: "draw",
//         numCardsToDraw: numCards,
//         playerToDrawCard: drawCardPlayerId,
//         players: players,
//         currentColor: currentColor,
//         currentNumber: currentNumber,
//     };
// };

// function getColorChangeGameState(playerId) {
//     return {
//         deck: deck,
//         discard: discardPile,
//         currentPlayer: playerId,
//         move: "change-color",
//         players: players,
//         currentColor: currentColor,
//         currentNumber: currentNumber,
//     };
// };

// function getReverseOrderGameState(playerId) {
//     return {
//         deck: deck,
//         discard: discardPile,
//         currentPlayer: playerId,
//         move: "reverse",
//         players: players,
//         currentColor: currentColor,
//         currentNumber: currentNumber,
//         clockwiseOrder: clockwiseOrder,
//     };
// };


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
    return (card.value === "skip-turn");
};

function isDrawTwoCard(card) {
    return (card.value === "draw-two");
};

function isReverseCard(card) {
    return (card.value === "reverse");
};

function isDrawFourCard(card) {
    return (card.value === "draw-four");
};

function isChangeColorCard(card) {
    return (card.value === "change-color");     
};

function discard(playerId, cardMove) {
    const hand = players.get(playerId).filter(card => card != cardMove);
    players.set(playerId, hand);
    discard.push(cardMove);
};


// Stuff for each turn
function doTurn(playerId) {
    if (skipNext) {
        skipNext = false;
        return;
    };

    const move = promptPlayerForMove(playerId);
    if (move === "draw") {
        const state = drawCard(playerId);
        return state;
    }

    const winState = checkWinConditions(playerId)
    if (winState) {
        return winState;
    };

    const turnState = doCardAction(playerId, move);
    return turnState;
};

function checkWinConditions(playerId, move) {
    if (players.get(playerId).length === 0) {
        return getPlayerWonGameState(playerId);
    }
    else if (deck.length === 0) {
        putDiscardToDeck();
        return getRestartGameState(playerId, move);
    }
    else {
        return;
    };
};


// Functionality for potential special cards
function doCardAction(playerId, card) {
    if (isActionCard()) {
        if (isSkipCard(card)) {
            skipNext = true;
            const state = getSkipCardGameState(playerId);
            return state;
        }
        else if (isReverseCard(card)) {
            const state = reverseTurnOrder(playerId);
            return state;
        }
        else if (isDrawTwoCard(card)) {
            const state = getDrawCardsActionGameState(playerId, 2);
            return state;
        };
    }
    else if (isWildCard(card)) {
        if (isChangeColorCard(card)) {
            promptForColorChoice(playerId);
        }
        else if (isDrawFourCard(card)) {
            const state = getDrawCardsActionGameState(playerId, 4);
            return state;
        };
    }
    else  if (isNormalCard(card)){
        return getNormalCardGameState(playerId, move);
    };
};

function reverseTurnOrder(playerId) {
    const reversedPlayers = new Map()
    const entries = Array.from(players.entries()).reverse();
    
    for (const [key, value] of entries) {
        reversedMap.set(key, value);
    };

    players = reversedPlayers;
    clockwiseOrder = !clockwiseOrder;
    return getReverseOrderGameState(playerId);
};


module.exports = {
    begin,
    doTurn,
    getPlayerWonGameState,
    getRestartGameState,
    getPlayerDrewCardGameState,
    getNormalCardGameState,
    getSkipCardGameState,
    getDrawCardsActionGameState,
    getColorChangeGameState,
    getReverseOrderGameState
};
const actions = ["draw-two", "reverse", "skip-turn"];
const wild_actions = ["draw-four", "change-color"];
const colors = ["red", "blue", "green", "yellow"];
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];


class Uno {
    constructor(code, playerIds) {
        this.code = code;
        this.players = this.createPlayerMap(playerIds)

        this.deck = this.createStartDeck();
        this.discardPile = [];

        this.topColor = "";
        this.topValue = "";
        this.skipNextPlayer = false;
        this.reversed = true;
    };

    // Processes for starting a new game
    begin() {
        this.shuffle();
        this.dealCards();
        this.drawTopCard();
        return this.getBeginState();
    };

    // Map each player ID to a "deck" (or list)
    createPlayerMap(playerIds) {
        const players = new Map();

        playerIds.forEach(id => {
            players.set([id], []);
        });
        return players;
    };

    // Does exactly what it sounds like - creates cards and puts them into the deck
    createStartDeck() {
        const deck = [];

        for (const color of colors) {
            // Create the normal cards, two of each number from 1-9 (and one 0), for each color
            deck.push({ type: "normal-card", color: color, number: 0 });
            for (const number of numbers) {
                deck.push({ type: "normal-card", color: color, value: number });
                deck.push({ type: "normal-card", color: color, value: number });
            };

            // Create the action cards, two of each action, for each color
            for (const action of actions) {
                deck.push({ type: "action-card", color: color, value: action });
                deck.push({ type: "action-card", color: color, value: action });
            };
        };

        // Create the wild cards, four of each action
        for (let i = 0; i < 4; i++) {
            for (const action of wild_actions)
                deck.push({ type: "wild-card", color: "black", value: action });
        };

        return deck;
    };

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        };
    };

    // Deal 7 cards to each player
    dealCards() {
        for (let i = 0; i < 7; i++) {
            this.players.forEach((value, key) => {
                this.drawCard(key);
            });
        };
    };

    // draw top card and handle all top card rules
    drawTopCard() {
        while (true) {
            const topCard = this.deck.pop();
            this.discardPile.push(topCard);

            this.topColor = topCard.color;
            this.topValue = topCard.topValue;

            if (this.topValue === 'wild-draw-four') {
                this.deck.push(this.discardPile.pop());
                this.shuffle();
            } else {
                break;
            }
        }
    }

    // If the deck runs out of cards, move all cards from the discard pile back to the deck
    putDiscardToDeck() {
        this.deck = this.discardPile;
        this.discardPile = [];
        this.shuffle();
    };


    // Game actions for players
    drawCards(playerId, numCards) {
        for (let i = 0; i < numCards; i++) {
            this.drawCard(playerId);
        };

        return this.getDrawCardsActionGameState(playerId, numCards);
    };

    setColor(color) {
        const colors = {
            "r": "red",
            "b": "blue",
            "y": "yellow",
            "g": "green",
        };

        const selectedColor = colors[color];
        if (selectedColor) {
            this.topColor = selectedColor;
        }
        else {
            this.topColor = color;
        };
    };

    // Per turn functionality: occurs on each player turn
    drawCard(playerId) {
        const card = this.deck.pop();
        this.players.get(playerId).push(card);
        return this.getPlayerDrewCardGameState(playerId, card);
    };

    doTurn(playerId) {
        if (skipNext) {
            skipNext = false;
            return;
        };

        const move = promptPlayerForMove(playerId);
        if (move === "draw") {
            const state = drawCard(playerId);
            return state;
        }

        const winState = this.checkWinConditions(playerId)
        if (winState) {
            return winState;
        };

        const turnState = doCardAction(playerId, move);
        return turnState;
    };

    checkWinConditions(playerId, move) {
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

    doCardAction(playerId, card) {
        if (this.isActionCard()) {
            if (this.isSkipCard(card)) {
                skipNext = true;
                const state = this.getSkipCardGameState(playerId);
                return state;
            }
            else if (this.isReverseCard(card)) {
                const state = this.reverseTurnOrder(playerId);
                return state;
            }
            else if (isDrawTwoCard(card)) {
                const state = this.getDrawCardsActionGameState(playerId, 2);
                return state;
            };
        }
        else if (this.isWildCard(card)) {
            if (this.isChangeColorCard(card)) {
                promptForColorChoice(playerId);
            }
            else if (this.isDrawFourCard(card)) {
                const state = this.getDrawCardsActionGameState(playerId, 4);
                return state;
            };
        }
        else if (this.isNormalCard(card)) {
            return this.getNormalCardGameState(playerId, move);
        };
    };

    reverseTurnOrder(playerId) {
        const reversedPlayers = new Map()
        const entries = Array.from(players.entries()).reverse();

        for (const [key, value] of entries) {
            reversedMap.set(key, value);
        };

        this.players = reversedPlayers;
        this.reversed = !this.reversed;
        return getReverseOrderGameState(playerId);
    };

    // Predicates for card types
    isNormalCard(card) {
        return (card.type === "normal-card");
    };

    isActionCard(card) {
        return (card.type === "action-card");
    };

    isWildCard(card) {
        return (card.type === "wild-card");
    };

    isSkipCard(card) {
        return (card.value === "skip-turn");
    };

    isDrawTwoCard(card) {
        return (card.value === "draw-two");
    };

    isReverseCard(card) {
        return (card.value === "reverse");
    };

    isDrawFourCard(card) {
        return (card.value === "draw-four");
    };

    isChangeColorCard(card) {
        return (card.value === "change-color");
    };


    getNextPlayer(playerId, skipped=false, reversed=false) {
        const keys = Array.from(this.players.keys());
        const currentIndex = keys.indexOf(playerId);

        let nextIndex;
        let direction;
        if (reversed) {
            direction = -1;
        }
        else {
            direction = 1;
        }
        if (skipped) {
            nextIndex = (currentIndex + 2 * direction) % keys.length;
        }
        else {
            nextIndex = (currentIndex + 1 * direction) % keys.length;
        };

        return this.players.get(keys[nextIndex]);
    };


    // Game state getters
    getBeginState() {
        return {
            roomCode: this.code,
            deck: this.deck,
            discardPile: [],
            players: this.players,
            currentPlayer: this.getFirstPlayer(),
            topColor: this.topColor,
            topValue: this.topValue,
            reversed: true,
            skipNext: false,
        };
    };

    getFirstPlayer() {
        const playerIds = Array.from(this.players.keys());
        return playerIds[0][0];
    };

    getPlayerWonGameState(playerId) {
        return {
            roomCode: this.code,
            move: "won",
            winner: playerId,
        };
    };

    getRestartGameState(playerId) {
        return {
            roomCode: this.code,
            deck: this.deck,
            discard: this.discardPile,
            currentPlayer: playerId,
            move: "restart",
            reversed: this.reversed,
            players: this.players,
            topColor: this.topColor,
            topValue: this.topValue,
        };
    };

    getPlayerDrewCardGameState(playerId, drawnCard) {
        return {
            roomCode: this.code,
            deck: this.deck,
            hand: this.players[playerId],
            move: "draw",
            reversed: this.reversed,
            currentPlayer: playerId,
            drawnCard: drawnCard,
        };
    };

    getNormalCardGameState(playerId, move) {
        return {
            roomCode: this.code,
            deck: this.deck,
            discard: this.discardPile,
            currentPlayer: playerId,
            move: "discard",
            reversed: this.reversed,
            topColor: this.topColor,
            topValue: this.topValue,
        };
    };


    // Action card states
    getSkipCardGameState(playerId) {
        return {
            roomCode: this.code,
            deck: this.deck,
            discard: this.discardPile,
            currentPlayer: playerId,
            move: "skip",
            reversed: this.reversed,
            skipNext: this.skipNext,
            topColor: this.topColor,
            topValue: this.topValue,
        };
    };

    getReverseOrderGameState(playerId) {
        return {
            roomCode: this.code,
            deck: this.deck,
            discard: discardPile,
            currentPlayer: playerId,
            move: "reverse",
            reversed: this.reversed,
            topColor: this.topColor,
            topValue: this.topValue,
        };
    };


    // Wild card states
    getDrawCardsActionGameState(currentPlayerId, numCards) {
        return {
            roomCode: this.code,
            deck: this.deck,
            discard: this.discardPile,
            currentPlayer: currentPlayerId,
            move: "draw-cards",
            numCards: numCards,
            reversed: this.reversed,
            players: this.players,
            topColor: this.topColor,
            topValue: this.topValue,
        };
    };

    getColorChangeCardGameState(playerId) {
        return {
            roomCode: this.code,
            deck: this.deck,
            discard: this.discardPile,
            currentPlayer: playerId,
            move: "change-color",
            reversed: this.reversed,
            players: this.players,
            topColor: this.topColor,
            topValue: this.topValue,
        };
    };

    getColorChangedGameState(playerId) {

    }
};


module.exports = {
    Uno
};
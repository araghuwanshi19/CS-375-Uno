const express = require('express'); // import express framework
const app = express(); // create instance of express
const { pool } = require('./dbConfig');
const argon2 = require('argon2'); // import argon2 for password hashing
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const ShortUniqueId = require('short-unique-id');

const httpServer = http.createServer(app);
const wsServer = socketIO(httpServer);

const initializePassport = require('./passportConfig');
const { Uno } = require('./uno');

initializePassport(passport);

const port = 3000;

app.set('view engine', 'ejs');

app.use(express.urlencoded({
    extended: false
}));

app.use(express.static(path.join(__dirname, "static")));

const sessionMiddleware = session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Add middleware wrap for SocketIO
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);

// Add auth to websockets
wsServer.use(wrap(sessionMiddleware));
wsServer.use(wrap(passport.initialize()));
wsServer.use(wrap(passport.session()));

// Tell websocket to only connect if authorized
wsServer.use((socket, next) => {
    if (socket.request.user) {
        next();
    } else {
        next(new Error('unauthorized'))
    }
});

app.use(flash());

const getNewId = new ShortUniqueId({ length: 10, dictionary: 'alphanum_upper' });

const rooms = {};
const userSockets = new Map();
const inGamePlayers = new Set();


// handle websocket connections
wsServer.on('connection', (socket) => {
    userSockets.set(socket.request.user.name, socket.id);
    socket.request.session.socketId = socket.id;

    socket.on('newLobby', () => {
        if (inGamePlayers.has(socket.id)) {
            socket.emit('lobbyCreationFailed');
        }
        else {
            const roomCode = getNewId();
            const playerInfo = { name: socket.request.user.name, id: socket.id };
            rooms[roomCode] = {
                players: [playerInfo],
                game: null,
                data: {}
            };

            socket.join(roomCode);
            inGamePlayers.add(socket.id);
            socket.emit('lobbyCreated', roomCode, socket.request.user.name);
        };
    });


    socket.on('joinLobby', (roomCode) => {
        let currentPlayer = socket.request.user.name;

        if (inGamePlayers.has(socket.id)) {
            socket.emit('lobbyJoinFailed');
        } else if (rooms[roomCode]) {
            const playerInfo = { name: currentPlayer, id: socket.id };
            rooms[roomCode].players.push(playerInfo);
            socket.join(roomCode);
            wsServer.to(roomCode).emit('playerJoined', roomCode, currentPlayer, rooms[roomCode].players.map(playerInfo => playerInfo.name));
            inGamePlayers.add(socket.id);
        } else {
            socket.emit('lobbyNotFound');
        }
    });

    socket.on('startGame', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.players[0].id === socket.id) {
            // check if there are atleast 2 players in lobby
            if (room.players.length >= 2) {
                // initialize game instance
                const unoGame = new Uno(roomCode, room.players.map(x => x.id));
                room.game = unoGame;
                const initialGameState = unoGame.begin();

                for (let player of initialGameState.players) {
                    wsServer.to(player[0]).emit('setupGame', { color: initialGameState.topColor, value: initialGameState.topValue }, player[1]);
                }

                wsServer.to(roomCode).emit('startGame');

                socket.emit('yourTurn', initialGameState, roomCode);
            } else {
                socket.emit('notEnoughPlayers');
            }
        }
    });

    // TODO: figure out how to do turns
    socket.on('playerTurn', async(state, roomCode) => {
		socket.emit('itsYourTurnMsg');
		const currentPlayer = state.currentPlayer;
		const game = rooms[state.roomCode].game;

		let move = "apple"
		let cardIndex = null;

		if (game.topValue == 'change-color') {
			socket.emit('chooseColor');
		}

		if (!noValidCards(currentPlayer, game)) {
			move = "draw"
		}
		else {
			const playerMovePromise = new Promise((resolve) => {
				socket.on('playerMove', (index) => {
					cardIndex = index; 
					move = game.players.get(currentPlayer)[parseInt(index)];
					resolve();
				});
			});
			await playerMovePromise;


			if (isMatch(move, game)) {
				socket.emit('removeCard', cardIndex);
				wsServer.to(roomCode).emit('setTopCard', move);
			} else {
				socket.emit('invalidMove');
				socket.emit('yourTurn', state);
				return;
			}
		}

		if (move === "draw") {
            const drawnCards = []
            while (true) {
                const state = game.drawCard(currentPlayer)
                const card = state.drawnCard;
                drawnCards.push(card);
                if (isMatch(card, game)) {
                    break;
                };
            };

            socket.emit('drawCards', drawnCards);
            game.players.get(playerId).push(...[drawnCards])
        };

		const newState = checkMove(move, game, currentPlayer, state);
		game.setTopCard(move);

		const gameOverState = game.checkWinConditions(currentPlayer, move);
		if (gameOverState.move === "won") {
			wsServer.to(game.roomCode).emit('gameWon');
		}
		else if (gameOverState.move === "restart") {
			socket.emit('restartDeck');
		}
		else {
			const nextPlayer = getNextPlayer(game, newState);
			wsServer.to(nextPlayer).emit('yourTurn', newState, roomCode);
		};
	});

    function checkMove(move, game, player, state) {
        if (move === "draw") {
            return game.drawCard(player);
        };

        if (game.isNormalCard(move)) {
            return game.getNormalCardGameState(player);
        }
        else if (game.isSkipCard(move)) {
            return game.skipNext(player);
        }
        else if (game.isDrawTwoCard(move)) {
            const nextPlayer = getNextPlayer(game, state);
            return game.drawCards(nextPlayer, 2);
        }
        else if (game.isReverseCard(move)) {
            return game.reverseTurnOrder(player);
        }
        else if (game.isDrawFourCard(move)) {
            const nextPlayer = getNextPlayer(game, state);
            return game.drawCards(nextPlayer, 4);
        }
        // else if (game.isChangeColorCard(move)) {
        //     const color = getColorSelection(player);
        //     return game.setColor(player, color);
        // }
    };

    function noValidCards(playerId, game) {
		const hand = game.players.get(playerId);
		
        for (const card of hand) {

            if (isMatch(card, game)) {
                return true;
            };
        };

        return false;
    };

    function isMatch(card, game) {
        const topColor = game.topColor;
        const topValue = game.topValue;
        
        return (topColor === card.color || topValue === card.value || card.color === "black");
    };
    

    function getNextPlayer(game, state) {
        const currentPlayer = state.currentPlayer;
        if (state.move === "skip") {
            return game.getNextPlayer(currentPlayer, skipped=true, reversed=state.reversed);
        };

        return game.getNextPlayer(currentPlayer, skipped=false, reversed=state.reversed);
    };

    socket.on('selectColor', (state) => {
        const colors = ["red", "blue", "yellow", "green", "r", "b", "y", "g"];
        const game = rooms[state.roomCode].game;
        while (true) {
            const color = prompt('Select the new color');
            if (colors.includes(newColor.toLowerCase())) {
                game.setColor(color);
                
            };
        };
    });
  
    socket.on('colorChosen', (roomCode, colorChosen) => {
        wsServer.to(roomCode).emit('playerChoseColor', colorChosen);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        for (const roomCode in rooms) {
            const index = rooms[roomCode].players.map(x => x.id).indexOf(socket.id);

            if (index !== -1) {
                let room = rooms[roomCode];

                room.players.splice(index, 1);
                wsServer.to(roomCode).emit('playerLeft', room.players.map(x => x.name));

                // if a lobby has 0 players, delete lobby
                if (room.players.length === 0) {
                    delete rooms[roomCode];
                } else {
                    // Disconnected player was host, select new one
                    if (index == 0) {
                        wsServer.to(room.players[0].id).emit('changeHost');
                    }
                }
                break;
            };
        };
    });
});


// serve the login.html file at the root path
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/game", checkNotAuthenticated, (req, res) => {
    return res.render("game", { username: req.user.name })
})

app.get("/login", checkAuthenticated, (req, res) => {
    res.render("login");
});

app.get("/register", checkAuthenticated, (req, res) => {
    res.render("register");
});

app.get("/logout", (req, res, next) => {
    req.logOut(() => {
        req.flash('success_message', 'You have successfully logged out');
        res.redirect('/login');
    });
});

app.post('/register', async (req, res) => {
    let { username, password, password2 } = req.body;

    let errors = [];

    if (!username || !password || !password2) {
        errors.push({ message: 'Please enter all fields' });
    };

    if (password.length < 6) {
        errors.push({ message: "Password should be atleast 6 characters long" });
    };

    if (password != password2) {
        errors.push({ message: "Passwords do not match" });
    };

    if (errors.length > 0) {
        res.render('register', { errors });
    }
    else {
        try {
            // validation passed
            let hashpassword = await argon2.hash(password);

            const results = await pool.query(
                `SELECT * FROM users WHERE name = $1`, [username]
            );

            if (results.rows.length > 0) {
                errors.push({ message: "Username already in use" });
                res.render('register', { errors });
            } else {
                pool.query(`INSERT INTO users (name, password) VALUES ($1, $2) RETURNING id, password`, [username, hashpassword], (err, results) => {
                    if (err) {
                        throw err;
                    }
                    req.flash('success_message', 'Your account has been registered. Please log in');
                    res.redirect('/login');
                });
            };
        }
        catch (err) {
            // handle errors
            throw err;
        };
    };
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/game',
    failureRedirect: '/login',
    failureFlash: true,
}));

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/game');
    };
    next();
};

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        req.session.socketId = userSockets.get(req.user.name);
        return next();
    }
    res.redirect('/login');
};

// start the http server
httpServer.listen(port, () => {
    console.log(`WebSocket server is running on port ${port}`);
});
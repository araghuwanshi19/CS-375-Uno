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
const { showMessage } = require('./static/js/game');

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
	console.log('A user connected:', socket.request.user.name, socket.id);
	userSockets.set(socket.request.user.name, socket.id);
	socket.request.session.socketId = socket.id;

	socket.on('newLobby', () => {
		if (inGamePlayers.has(socket.id)) {
			socket.emit('lobbyCreationFailed');
		} 
		else {
			const roomCode = getNewId();
			const playerInfo = { name: socket.request.user.name, id: socket.id };
			const playerIds = [playerInfo.id];
			// initialize game instance
			const unoGame = new Uno(roomCode, playerIds);
			rooms[roomCode] = { 
				players: [playerInfo], 
				game: unoGame,
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
			const playerInfo = {name: currentPlayer, id: socket.id};
			rooms[roomCode].players.push(playerInfo);
			socket.join(roomCode);
			wsServer.to(roomCode).emit('playerJoined', roomCode, currentPlayer, rooms[roomCode].players.map(playerInfo => playerInfo.name));
			inGamePlayers.add(socket.id);
		} else {
			socket.emit('lobbyNotFound');
		};
	});

	socket.on('startGame', (roomCode) => {
		if (rooms[roomCode] && rooms[roomCode].players[0].id === socket.id) {
			// check if there are atleast 2 players in lobby
			if (rooms[roomCode].players.length >= 2) {
				const unoGame = rooms[roomCode].game;
				const initialGameState = unoGame.begin();

				const firstPlayer = initialGameState.currentPlayer;				
				socket.emit('yourTurn', firstPlayer);
				
				wsServer.to(roomCode).emit('startGame', initialGameState);
							} else {
				socket.emit('notEnoughPlayers');
			};
		};
	});
	
	socket.on('yourTurn', (state) => {
		showMessage('It is now your turn!');
		const currentPlayer = state.currentPlayer;
		const game = rooms[state.roomCode].game;

		let move = ""
		if (noValidCards(currentPlayer, game)) {
			move = "draw"
		}
		else {
			move = getPlayerMove(currentPlayer);
		};

		const newState = checkMove(move, game, currentPlayer);
		if (move === "draw") {
			wsServer.to(currentPlayer).emit('yourTurn');
			return;
		};

		const cardPlayed = game.players[currentPlayer][move];
		game.setTopCard(cardPlayed);

		const gameOverState = game.checkWinConditions(currentPlayer, cardPlayed);
		if (gameOverState.move === "won") {
			wsServer.to(game.roomCode).emit('gameWon');
		}
		else if (gameOverState.move === "restart") {
			showMessage("Deck is out of cards! Shuffling...");
		}
		else {
			if (newState.move === "skip" ||
				newState.move === "discard" ||
				newState.move === "reverse" ||
				newState.move === "draw-cards" ||
				newState.move === "change-color") {
					const nextPlayer = getNextPlayer(newState);
					wsServer.to(nextPlayer).emit('yourTurn');
			};
		};
	});

	function noValidCards(playerId, game) {
        for (const card of this.players[playerId]) {
            if (isMatch(card, game)) {
				return true;
			};
        };

		return false;
    };

	function isMatch(card, game) {
		const topColor = game.topColor;
		const topValue = game.topValue;
		
		return (topColor === card.color || topValue === card.value);
	};
	
	function checkMove(move, game, player) {
		if (move === "draw") {
			return game.drawCard(player);
		};
		
		const card = game.players[socket.id][move];
		if (game.isNormalCard(card)) {
			return game.getNormalCardGameState(player);
		}
		else if (game.isSkipCard(card)) {
			return game.skipNext(player);
		}
		else if (game.isDrawTwoCard(card)) {
			const nextPlayer = getNextPlayer(player, reversed=game.reversed);
			return game.drawCards(nextPlayer, 2);
		}
		else if (game.isReverseCard(card)) {
			return game.reverseTurnOrder(player);
		}
		else if (game.isDrawFourCard(card)) {
			const nextPlayer = getNextPlayer(player, reversed=game.reversed)
			return game.drawCards(nextPlayer, 4);
		}
		else if (game.isChangeColorCard(card)) {
			const color = getColorSelection(player);
			return game.setColor(player, color);
		}
		else {
			
		};
	};

	function getNextPlayer(state) {
		const currentPlayer = state.currentPlayer;
		const game = rooms[state.roomCode].game;
		if (state.move === "skip") {
			return game.getNextPlayer(currentPlayer, skipped=true, reversed=state.reversed);
		};

		return game.getNextPlayer(currentPlayer, skipped=false, reversed=state.reversed);
	};
    
	socket.on('disconnect', () => {
		console.log('A user disconnected:', socket.id);
		for (const roomCode in rooms) {
			const index = rooms[roomCode].players.map(x => x[1]).indexOf(socket.id);
            
			// If disconnected player was the host, change host
			if (index === 0) {
				wsServer.to(rooms[roomCode].players[1]).emit('changeHost');
			}
			else if (index !== -1) {
				rooms[roomCode].players.splice(index, 1);
				wsServer.to(roomCode).emit('playerLeft', rooms[roomCode].players.map(x => x[0]));

				// if a lobby has 0 players, delete lobby
				if (rooms[roomCode].players.length === 0) {
					delete rooms[roomCode];
				};
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
	const socketId = userSockets.get(req.user.name);
	console.log(socketId)
	console.log(userSockets)
	const state = {
		state: "dashboard",
		roomCode: "",
		user: {
			name: req.user.name,
			socketId: socketId,
			cards: [
				{ color: "red", type: "four" },
				{ color: "green", type: "four" },
				{ color: "blue", type: "four" },
				{ color: "yellow", type: "four" },
				{ color: "red", type: "reverse" },
				{ color: "blue", type: "skip" },
				{ color: "red", type: "+2" },
			],
			isHost: false,
		},
		users: []
	}
	return res.render("game", state)
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
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
const inGamePlayers = new Set();

// handle websocket connections
wsServer.on('connection', (socket) => {
	console.log('A user connected:', socket.request.user.name, socket.id);

	socket.on('newLobby', () => {
		if (inGamePlayers.has(socket.id)) {
			socket.emit('lobbyCreationFailed');
		} else {
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
		}
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
		}
	});

	socket.on('startGame', (roomCode) => {
		if (rooms[roomCode] && rooms[roomCode].players[0].id === socket.id) {
			// check if there are atleast 2 players in lobby
			if (rooms[roomCode].players.length >= 2) {
				const unoGame = rooms[roomCode].game;
				const initialGameState = unoGame.begin();

				wsServer.to(roomCode).emit('startGame', initialGameState);
			} else {
				socket.emit('notEnoughPlayers');
			}
		}
	});

	socket.on('disconnect', () => {
		console.log('A user disconnected:', socket.id);
		for (const roomCode in rooms) {
			const index = rooms[roomCode].players.map(x => x[1]).indexOf(socket.id);

			// if disconnected player was the host, change host
			if (index === 0) {
				wsServer.to(rooms[roomCode].players[1]).emit('changeHost');
			}

			if (index !== -1) {
				rooms[roomCode].players.splice(index, 1);
				wsServer.to(roomCode).emit('playerLeft', rooms[roomCode].players.map(x => x[0]));

				// if a lobby has 0 players, delete lobby
				if (rooms[roomCode].players.length === 0) {
					delete rooms[roomCode];
				}
				break;
			}
		}
	});
});


// serve the login.html file at the root path
app.get("/", (req, res) => {
	res.render("index");

});

app.get("/game", checkNotAuthenticated, (req, res) => {
	const state = {
		state: "dashboard",
		roomCode: "",
		user: {
			name: req.user.name,
			isHost: false,
			cards: [
				{ color: "red", type: "four" },
				{ color: "green", type: "four" },
				{ color: "blue", type: "four" },
				{ color: "yellow", type: "four" },
				{ color: "red", type: "reverse" },
				{ color: "blue", type: "skip" },
				{ color: "red", type: "+2" },
			]
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
	}

	if (password.length < 6) {
		errors.push({ message: "Password should be atleast 6 characters long" });
	}

	if (password != password2) {
		errors.push({ message: "Passwords do not match" });
	}

	if (errors.length > 0) {
		res.render('register', { errors });
	} else {
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
				})
			}
		} catch (err) {
			// handle errors
			throw err;
		}
	}
});

app.post('/login', passport.authenticate('local', {
	successRedirect: '/game',
	failureRedirect: '/login',
	failureFlash: true,
}));

function checkAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		return res.redirect('/game');
	}
	next();
}

function checkNotAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	res.redirect('/login');
}

// start the http server
httpServer.listen(port, () => {
	console.log(`WebSocket server is running on port ${port}`);
});
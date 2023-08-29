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
const shortid = require('shortid');

const httpServer = http.createServer(app);
const wsServer = socketIO(httpServer);

const initializePassport = require('./passportConfig');

initializePassport(passport);

const port = 3000;
const hostname = "localhost";

const {Player, Uno} = require("./game.js");

app.set('view engine', 'ejs');

app.use(express.urlencoded({
    extended: false
}));

app.use(express.static(path.join(__dirname, "static")));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

const rooms = {};
const runningGames = {};
const newLobbyPlayers = new Set();
const joinLobbyPlayers = new Set();

// handle websocket connections
wsServer.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('newLobby', () => {
        if (newLobbyPlayers.has(socket.id)) {
            socket.emit('lobbyCreationFailed');
        } 
        else {
            const roomCode = shortid.generate();
            rooms[roomCode] = { players: [socket.id], data: {} };
            socket.join(roomCode);

            newLobbyPlayers.add(socket.id);
            console.log(rooms)

            // socket.emit('redirect', `/lobby?room=${roomCode}`);
            socket.emit('lobbyCreated', roomCode);  
        };
    });

    socket.on('joinLobby', (roomCode) => {
        if (joinLobbyPlayers.has(socket.id) || newLobbyPlayers.has(socket.id)) {
            socket.emit('lobbyJoinFailed');
        } 
        else if (rooms[roomCode]) {
            rooms[roomCode].players.push(socket.id);
            socket.join(roomCode);
            wsServer.to(roomCode).emit('playerJoined', rooms[roomCode].players.length);
            joinLobbyPlayers.add(socket.id);
            // socket.emit('redirect', `/lobby?room=${roomCode}`);

            // if the lobby has three players, start the game automatically
            if (rooms[roomCode].players.length === 3) {
                // TODO: create a function / write code to start the game
                const players = createPlayers(rooms[roomCode].player);
                const uno = new Uno(roomCode, players);
                runningGames[roomCode] = uno;

                let startState = uno.start();
            };
        } 
        else {
            socket.emit('lobbyNotFound');
        };
    });

    function createPlayers(playerSockets) {
        const players = new Map();
        playerSockets.forEach(socketId => {
            wsServer.to(socketId).emit('promptUsername');

            socket.on('usernameEntered', (username) => {
                const player = new Player(username, socketId);
                players.set(socketId, player);
            });
        });

        return players;
    };

    // socket.on('promptUsername', () => {
    //     const username = prompt("Enter your username");
    //     socket.emit('usernameEntered', username);
    // });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        for (const roomCode in rooms) {
            const index = rooms[roomCode].players.indexOf(socket.id);
            
            if (index !== -1) {
                rooms[roomCode].players.splice(index, 1);
                wsServer.to(roomCode).emit('playerLeft', rooms[roomCode].players.length);
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

// ORIGINAL LOBBY CODE
app.get("/lobby", (req, res) => {
    const newRoomCode = req.query.room;
    res.render("lobby", {roomCode: newRoomCode, user: {isHost: true}, users: [
        {name: "Ethan"},
        {name: "Naqi"},
        {name: "Fei"},
        {name: "Test"}
    ]});
});

app.get("/game", (req, res) => {
    res.render("game", {user: {cards: [
        {color: "red", type: "four"},
        {color: "green", type: "four"},
        {color: "blue", type: "four"},
        {color: "yellow", type: "four"},
        {color: "red", type: "reverse"},
        {color: "blue", type: "skip"},
        {color: "red", type: "+2"},
    ]}, users: [
        {name: "Ethan", numCards: 2},
        {name: "Naqi", numCards: 5},
        {name: "Fei", numCards: 1},
        {name: "Test", numCards: 4}
    ]});
});

app.get("/login", checkAuthenticated, (req, res) => {
    res.render("login");

});

app.get("/register", checkAuthenticated, (req, res) => {
    res.render("register");

});

app.get("/dashboard", checkNotAuthenticated, (req, res) => {
    res.render("dashboard", {user: req.user.name});

});

app.get("/logout", (req, res, next) => {
    req.logOut(() => {
        req.flash('success_message', 'You have successfully logged out');
        res.redirect('/login');
    });
});

app.post('/register', async (req, res) => {
    let {username, password, password2} = req.body;

    let errors = [];

    if (!username || !password || !password2) {
        errors.push({message: 'Please enter all fields'});
    };

    if (password.length < 6) {
        errors.push({message: "Password should be atleast 6 characters long"});
    };

    if (password != password2) {
        errors.push({message: "Passwords do not match"});
    };

    if(errors.length > 0) {
        res.render('register', {errors});
    } else {
        try{ 
            // validation passed
            let hashpassword = await argon2.hash(password);
            const results = await pool.query(
                `SELECT * FROM users WHERE name = $1`, [username]
            );
        
            if (results.rows.length > 0) {
                errors.push({ message: "Username already in use" });
                res.render('register', { errors });
            } 
            else {
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
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true,
}));

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
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

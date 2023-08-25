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

const httpServer = http.createServer(app);
const wsServer = socketIO(httpServer);

const initializePassport = require('./passportConfig');

initializePassport(passport);

const port = 3000;
const hostname = "localhost";

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


// handle websocket connections
wsServer.on('connection', (socket) => {
    console.log('a user just connected');
  
    socket.emit('message', 'Welcome to the WebSocket server!');
    
    socket.on('chatMessage', (message) => {
        wsServer.emit('chatMessage', message); // broadcasting message sent to all clients/users
    });

    socket.on('disconnect', () => {
      console.log('a user just disconnected');
    });
});


// serve the login.html file at the root path
app.get("/", (req, res) => {
    res.render("index");

});

app.get("/lobby", (req, res) => {
    const roomCode = req.query.code;
    res.render("lobby", {roomCode: roomCode, user: {isHost: true}, users: [
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
})

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
    }

    if (password.length < 6) {
        errors.push({message: "Password should be atleast 6 characters long"});
    }

    if (password != password2) {
        errors.push({message: "Passwords do not match"});
    }

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

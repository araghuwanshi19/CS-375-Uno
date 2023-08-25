const LocalStrategy = require("passport-local").Strategy;
const { pool } = require("./dbConfig");
const argon2 = require('argon2');

function initialize(passport) {
    const authenticateUser = async (username, password, done) => {
        try {
            const results = await pool.query(
                `SELECT * FROM users WHERE name = $1`, [username]
            );

            if (results.rows.length > 0) {
                const user = results.rows[0];
                const isMatch = await argon2.verify(user.password, password);

                if (isMatch) {
                    return done(null, user);
                } else {
                    return done(null, false, { message: "Password is not correct" });
                }
            } else {
                return done(null, false, { message: "Username is not registered" });
            }
        } catch (err) {
            return done(err);
        }
    };


    passport.use(new LocalStrategy(
        {
            usernameField: "username",
            passwordField: "password"
        },
        authenticateUser
        )
    );

    passport.serializeUser((user, done) => done(null, user.id));

    passport.deserializeUser(async (id, done) => {
        try {
            const results = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
            return done(null, results.rows[0]);
        } catch (err) {
            return done(err);
        }
    });
}

module.exports = initialize;
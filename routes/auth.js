const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const usersFile = path.join(__dirname, '..', 'users.json');

let users = [];
if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
}

function isAuthenticated(req, res, next) {
    try {
        if (req.session && req.session.userId) return next();
        res.redirect('/login');
    } catch (err) {
        console.error('Error en autenticación:', err);
        res.redirect('/login');
    }
}

router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.render('login', { error: 'Usuario o contraseña incorrectos' });
    }
    req.session.userId = user.id;
    res.redirect('/');
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

router.post('/register', (req, res) => {
    const { username, password, nombre, notificacion } = req.body;
    if (users.find(u => u.username === username)) {
        return res.render('login', { error: 'El usuario ya existe' });
    }
    const newUser = {
        id: Date.now().toString(),
        username,
        password: bcrypt.hashSync(password, 10),
        nombre,
        notificacion
    };
    users.push(newUser);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    res.redirect('/login');
});

module.exports = { router, isAuthenticated };
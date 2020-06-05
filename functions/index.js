const functions = require('firebase-functions');

const { getAllScreams, postOneScream } = require('./handlers/screams');
const {signup, login} = require('./handlers/users');

const express = require('express');
const app = express();

const FBAuth = require('./util/fbAuth');

//  Scream routes
app.get('/screams', getAllScreams);
app.post('/scream', FBAuth, postOneScream);

// user routes
app.post('/signup', signup);
app.post('/login', login);

exports.api = functions.https.onRequest(app);
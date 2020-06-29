const functions = require('firebase-functions');

const { getAllScreams, postOneScream } = require('./handlers/screams');
const {signup, 
    login, 
    uploadImage, 
    addUserDetails,
    getAuthenticatedUser
    } = require('./handlers/users');

const express = require('express');
const app = express();

const FBAuth = require('./util/fbAuth');

//  Scream routes
app.get('/screams', getAllScreams);
app.post('/scream', FBAuth, postOneScream);
app.get('/scream/:screamId', getScream);
// TODO: delete scream
// TODO: like scream
// TODO: unlike acream
// TODO: comment scream

// user routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);

exports.api = functions.https.onRequest(app);
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const firebaseConfig = {
    apiKey: "AIzaSyBNh6gV1DYkwMtgKZU86L0zTaeI4DgmjIY",
    authDomain: "socialape-eb8d8.firebaseapp.com",
    databaseURL: "https://socialape-eb8d8.firebaseio.com",
    projectId: "socialape-eb8d8",
    storageBucket: "socialape-eb8d8.appspot.com",
    messagingSenderId: "339342582201",
    appId: "1:339342582201:web:b4a49b116e24b6e002d668",
    measurementId: "G-T1DPYEZQ74"
  };

const express = require('express');
const app = express();

const firebase = require('firebase');
firebase.initializeApp(firebaseConfig);

const db = admin.firestore();

app.get('/screams', (req, res) => {
    db
        .collection('screams')
        .orderBy('createdAt', 'desc')
        .get()
        .then((data) => {
        let screams = [];
        data.forEach((doc) => {
            screams.push({
                screamId: doc.id,
                body: doc.data().body,
                userHandle: doc.data().userHandle,
                createdAt: doc.data().createdAt
            })
        });
        return res.json(screams);
    })
    .catch((err) => console.error(err));
});

app.post('/scream', (req, res) => {

    const newScream = {
        body: req.body.body,
        userHandle: req.body.userHandle,
        createdAt: new Date().toISOString()
    };

    db
        .collection('screams')
        .add(newScream)
        .then(doc => {
        res.json({message: `Document ${doc.id} created successfully`});
    })
    .catch( err => {
        res.status(500).json({error: 'something went wrong'});
        console.error(err)
    });
});

const isEmail = (email) => {
    console.log('Check for Email');
    const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(email.match(emailRegEx)){
        console.log(email);
        return true;
    }else{
        return false;
    }
};

const isEmpty = (string) => {
    console.log('Check for Empty');
    if(string.trim() === "") return true;
    else return false;
};


// Signup route
app.post('/signup', (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    // TODO: validate data
    let errors = {};
    
    if(isEmpty(newUser.email)){
        errors.email = 'Must not be empty';
    } else if(!isEmail(newUser.email)){
        console.log(newUser.email);
        errors.email = 'Must be a valid email address';
    }
    // errors.password = "Passwords must match";
    
    if(isEmpty(newUser.password)) errors.password = 'Must not be empty';
    if(newUser.password !== newUser.confirmPassword){
        errors.password = "Passwords must match";
    };
    if(isEmpty(newUser.handle)) errors.handle = 'Must not be empty';

    if(Object.keys(errors).length > 0) return res.status(400).json(errors);

    let userId, tokenId;
    db.doc(`/users/${newUser.handle}`).get()
        .then(doc => {
            if(doc.exists){
                return res.status(400).json({handle: `this handle is already taken`});
            }else{
                return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password);
            }
        })
        .then(data => {
            userId = data.user.uid;
            return data.user.getIdToken();
        })
        .then(token => {
            tokenId = token;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                userId
            };
            return db.doc(`/users/${newUser.handle}`).set(userCredentials);
        })
        .then(() => {
            return res.status(201).json({tokenId});
        })
        .catch(err => {
            if(err.code === "auth/email-already-in-use"){
                return res.status(400).json({email: 'Email is already in use'});
            }else{
                console.error(err);
                res.status(500).json({ error: err.code});
            }
        });

});

exports.api = functions.https.onRequest(app);
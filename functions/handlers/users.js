const {admin, db} = require('../util/admin');
const config = require('../util/config');

const firebase = require('firebase');
firebase.initializeApp(config);

const {validateSignupData, validateLoginData} = require('../util/validators');

exports.signup = (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    const{valid, errors} = validateSignupData(newUser);

    if(!valid) return res.status(400).json(errors);

    const noImg = 'no-img.png';

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
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
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

};

exports.login = (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };


    const{valid, errors} = validateLoginData(user);

    if(!valid) return res.status(400).json(errors);


    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken();
        })
        .then(token => {
            return res.json(token);
        })
        .catch(err => {
            console.error(err);
            if(err.code === "auth/wrong-password"){
                return res.status(403).json({general: "Wrong credentials, please try again"});
            } else return res.status(500).json({error: err.code});
        });

};

exports.uploadImage = (req, res) => {
    const BusBoy  = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');


    const busboy = new BusBoy({headers: req.headers});

    let imageFileName;
    let imageToBeUploaded = {};
    const userHandle = req.user.handle;

    busboy.on('file', (fieldname, file, filename, encoding, mimeType) => {
        console.log(fieldname);
        console.log(filename);
        console.log(mimeType);

        if(mimeType !== 'image/png' && mimeType !== 'image/jpeg'){
            return res.status(400).json({eror: 'Wrong file type submited'});
        }

        const imageExtension = filename.split('.')[filename.split('.').length - 1];
        imageFileName = `${userHandle}.${imageExtension}`;
        const filePath = path.join(os.tmpdir(), imageFileName);

        imageToBeUploaded = {filePath, mimeType};
        file.pipe(fs.createWriteStream(filePath));

    });

    busboy.on('finish', () => {
        admin.storage().bucket().upload(imageToBeUploaded.filePath, {
            resumable: false,
            metadata: {
                contentType: imageToBeUploaded.mimitype
            }
        })
        .then( () => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
            return db.doc(`users/${userHandle}`).update({imageUrl});
        })
        .then(() => {
            return res.json({message: 'Image uploaded successfully'});
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({eror: err.code});
        })
    });
    busboy.end(req.rawBody);
};
const {admin, db} = require('../util/admin');
const config = require('../util/config');

const firebase = require('firebase');
firebase.initializeApp(config);

const {validateSignupData, validateLoginData, reduceUserDetails} = require('../util/validators');
const { user } = require('firebase-functions/lib/providers/auth');

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

// add user details
exports.addUserDetails = (req, res) => {
    let userDetails = reduceUserDetails(req.body);
    db.doc(`/users/${req.user.handle}`).update(userDetails)
    .then(() => {
        return res.json({message: 'Details added successfully'});
    })
    .catch( err => {
        console.error(err);
        return res.status(500).json({error: err.code});
    })
};

// upload profile photo
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

// Get details of any user
exports.getUserDetails = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.params.handle}`).get()
    .then( doc => {
        if(doc.exists){
            userData = doc.data();
            return db.collection('screams').where('userHandle', '==', req.params.handle)
            .orderBy('createdAt', 'desc')
            .get();
        }else{
            return res.status(404).json({error: 'User not found'});
        }
    })
    .then( data => {
        userData.screams = [];
        data.forEach(doc => {
            userData.screams.push({
                body: doc.data().body,
                createdAt: doc.data().createdAt,
                userHandle: doc.data().userHandle,
                userImage: doc.data().userImage,
                likeCount: doc.data().likeCount,
                commentCount: doc.data().commentCount,
                screamId: doc.id
            })
            return res.json(userData);
        })
    })
    .catch(err => {
        console.error(err);
        return res.status(500).json({error: err.code});
    })
}

// get details of logged in user
exports.getAuthenticatedUser = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.user.handle}`).get()
    .then(doc => {
        if(doc.exists){
            userData.credentials = doc.data();
            return db.collection('likes').where('handle', '==', req.user.handle).get();
        }
    })
    .then(data => {
        userData.likes = [];
        data.forEach(doc => {
            userData.likes.push(doc.data());
        });
        return db.collection('notifications').where('recipient', '==', req.user.handle)
        .orderBy('createdAt', 'desc').get();
    })
    .then((data) => {
        userData.notifications = [];
        data.forEach(doc => {
            userData.notifications.push({
                recipient: doc.data().recipient,
                sender: doc.data().sender,
                createdAt: doc.data().createdAt,
                screamId: doc.data().screamId,
                type: doc.data().type,
                read: doc.data().read,
                notificationId: doc.id
            })
        })
        return res.json(userData);
    })
    .catch(err => {
        console.error(err);
        return res.status(500).json({error: err.code});
    })
};

// mark notifications as read
exports.markNotificationsRead = (req, res) => {
    let batch = db.batch();
    req.body.forEach(notificationId => {
        const notification = db.doc(`/notifications/${notificationId}`);
        batch.update(notification, {read: true});
    });
    batch.commit()
    .then(() => {
        return res.json({message: 'Notifications marked read'});
    })
    .catch(err => {
        console.eror(err);
        return res.status(500).json({error: err.code});
    });
}
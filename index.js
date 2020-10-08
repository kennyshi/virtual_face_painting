const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); 
const multer = require('multer'); 
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const sharp = require('sharp');
require('dotenv').config();
// models
const Image = require('./models/image.model');


const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false })) 
app.use(express.json());
app.use(cookieParser());

// public folder
app.use('/public', express.static(path.join(__dirname, 'static')));
// set up template engine
app.set('view engine', 'ejs');

// mongoose connection
const uri = process.env.ATLAS_URI;
mongoose.connect(uri, { useNewUrlParser: true, useCreateIndex: true });
const connection = mongoose.connection;
connection.once('open', () => {
    console.log("MongoDB database connection established successfully");
})

app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: process.env.EXPRESS_SESSION_SECRET
}));

// passport
var passport = require('passport');
var userProfile;

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});

/*  Google AUTH  */
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_AUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_AUTH_CLIENT_SECRET;

const googleAuthCallBackDomain = process.env.GOOGLE_AUTH_CALLBACK_DOMAIN;
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: googleAuthCallBackDomain + "/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
      userProfile=profile;
      return done(null, userProfile);
  }
));

// for image upload
var storage = multer.diskStorage({ 
    destination: (req, file, cb) => { 
        cb(null, 'uploads') 
    }, 
    filename: (req, file, cb) => { 
        cb(null, file.fieldname + '-' + Date.now()) 
    } 
}); 
  
var upload = multer({ storage: storage }); 


// routes for api
const drawingRouter = require('./routes/drawings');
const userRouter = require('./routes/users');
app.use('/api/drawings', drawingRouter);
app.use('/api/users', userRouter);

function isAuthenticated(req, res, next) {
    if (userProfile)
        return next();
    res.render('pages/auth');
  }

// routes for pages
app.get('/', isAuthenticated, function(req, res) {
    res.render('pages/home', { user: userProfile });
});

// Uploading the image 
app.get('/upload', isAuthenticated, (req, res) => {
    Image.findOne({ userid: userProfile.id }, (err, image) => { 
        if (err) { 
            console.log(err); 
        } 
        else { 
            res.render('pages/upload', { image: image }); 
        } 
    }); 
});
app.post('/upload', upload.single('image'), (req, res, next) => { 
    if (!userProfile) {
        res.render('pages/auth');
    } else {
        sharp(path.join(__dirname + '/uploads/' + req.file.filename))
            .resize({ height:550 })
            .toFile(path.join(__dirname + '/uploads/resized_' + req.file.filename))
            .then(() => {
                var obj = { 
                    userid: userProfile.id, 
                    image: { 
                        data: fs.readFileSync(path.join(__dirname + '/uploads/resized_' + req.file.filename)), 
                        contentType: 'image/png'
                    } 
                };
                Image.findOneAndUpdate({ userid: userProfile.id }, obj, {upsert: true}, function(err, doc) {
                    if (err) return res.send(500, {error: err});
                    res.redirect('/image/' + userProfile.id);
                });
            })
            .catch(err => {
                console.log(err);
            });
        
    }
}); 

// Retriving the image 
app.get('/image/:userid', (req, res) => { 
    if (!userProfile) {
        res.render('pages/auth');
    } else {
        Image.findOne({ userid: req.params.userid }, (err, image) => { 
            if (err || !image) { 
                console.log(err);
                res.redirect('/error'); 
            } 
            else { 
                res.render('pages/image', { image: image }); 
            } 
        }); 
    }
}); 

// Retriving the raw image 
app.get('/rawimage/:userid', (req, res) => { 
    if (!userProfile) {
        res.render('pages/auth');
    } else {
        Image.findOne({ userid: req.params.userid }, (err, image) => { 
            if (err || !image) { 
                console.log(err);
                res.redirect('/error');
            } 
            else { 
                res.contentType(image.image.contentType);
                res.end(image.image.data); 
            } 
        }); 
    }
}); 


app.get('/draw/:targetUserid', (req, res) => {
    if (!userProfile) {
        res.render('pages/auth');
    } else {
        //console.log("userprofile is " + userProfile.displayName);
        Image.findOne({ userid: req.params.targetUserid }, (err, image) => {
            if (err || !image) {
                console.log(err);
                res.redirect('/error');
            }
        });
        res.render('pages/draw', {
            image_url: '/rawimage/' + req.params.targetUserid,
            user: userProfile,
            targetUserid: req.params.targetUserid
        });
    }
});

app.get('/error', (req, res) => res.status(500).send("Something is wrong"));

// routes for auth
app.get('/auth/success', (req, res) => {
    res.render('pages/success', {user: userProfile});
  });

app.get('/auth/error', (req, res) => res.send("error logging in"));

app.get('/auth/google',
  passport.authenticate('google', { scope : ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/error' }),
  function(req, res) {
    // Successful authentication, redirect success.
    req.session.token = userProfile.id;
    res.redirect('/');
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout();
  req.session.token = null;
  req.session = null;
  res.redirect('/');
});




// start server
app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});
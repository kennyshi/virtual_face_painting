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
const User = require('./models/user.model');
const Drawing = require('./models/drawing.model');


const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
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
    maxAge: 24*60*60*1000,
    secret: process.env.EXPRESS_SESSION_SECRET
}));

// passport
var passport = require('passport');

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id).then(user => {
      done(null, user);
    });
  });

/*  Google AUTH  */
var GoogleStrategy = require('passport-google-oauth20').Strategy;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_AUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_AUTH_CLIENT_SECRET;

const googleAuthCallBackDomain = process.env.GOOGLE_AUTH_CALLBACK_DOMAIN;
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: googleAuthCallBackDomain + "/auth/google/callback"
  },
  (accessToken, refreshToken, profile, done) => {
        User.findOne({ userid: profile.id })
            .then(currentUser => {
                if (currentUser) {
                    done(null, currentUser);
                } else {
                    new User({
                        userid: profile.id,
                        username: profile.emails[0].value,
                        name: profile.displayName
                      }).save().then((newUser) =>{
                        done(null, newUser);
                      });
                }                
            })
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
    if (req.user)
        return next();
    res.render('pages/auth');
  }

// routes for pages
app.get('/', isAuthenticated, function(req, res) {
    res.render('pages/home', { user: req.user });
});

// Uploading the image 
app.get('/upload', isAuthenticated, (req, res) => {
    Image.findOne({ userid: req.user.userid }, (err, image) => { 
        if (err) { 
            console.log(err); 
        } 
        else { 
            res.render('pages/upload', { image: image, user: req.user }); 
        } 
    }); 
});
app.post('/upload', upload.single('image'), (req, res, next) => { 
    if (!req.user) {
        res.render('pages/auth');
    } else {
        sharp(path.join(__dirname + '/uploads/' + req.file.filename))
            .resize({ width:550 })
            .toFile(path.join(__dirname + '/uploads/resized_' + req.file.filename))
            .then(() => {
                sharp(path.join(__dirname + '/uploads/resized_' + req.file.filename))
                    .metadata()
                    .then(metadata => {
                        var obj = { 
                            userid: req.user.userid, 
                            name: req.user.name,
                            image: { 
                                data: fs.readFileSync(path.join(__dirname + '/uploads/resized_' + req.file.filename)), 
                                contentType: 'image/png',
                                width: metadata.width,
                                height: metadata.height
                            } 
                        };
                        Image.findOneAndUpdate({ userid: req.user.userid }, obj, {upsert: true}, function(err, doc) {
                            fs.unlink(path.join(__dirname + '/uploads/' + req.file.filename));
                            fs.unlink(path.join(__dirname + '/uploads/resized_' + req.file.filename));
                            if (err) return res.send(500, {error: err});
                            res.redirect('/upload');
                        });
                    });
                })
            .catch(err => {
                console.log(err);
            });
        
    }
}); 

// Retriving the image 
app.get('/image/:userid', isAuthenticated, (req, res) => { 
    Image.findOne({ userid: req.params.userid }, (err, image) => { 
        if (err || !image) { 
            console.log(err);
            res.redirect('/error'); 
        } 
        else { 
            res.render('pages/image', { image: image, user: req.user }); 
        } 
    }); 
}); 

// Retriving the raw image 
app.get('/rawimage/:userid', isAuthenticated, (req, res) => { 
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
}); 


app.get('/draw/:targetUserid', isAuthenticated, (req, res) => {
    Image.findOne({ userid: req.params.targetUserid }, (err, image) => {
        if (err || !image) {
            console.log(err);
            res.redirect('/error');
        }
        Drawing.findOne({ userid: req.user.userid, target_userid: req.params.targetUserid }, (err, drawing) => {
                if (err) {
                    res.redirect('/error');
                }
                //console.log(req.user.userid + "," + req.params.targetUserid + "," + drawing);
                res.render('pages/draw', {
                    image_url: '/rawimage/' + req.params.targetUserid,
                    user: req.user,
                    targetUserid: req.params.targetUserid,
                    image: image,
                    drawing: drawing
                });
            })
        });
    });

app.post('/draw/:targetUserid', isAuthenticated, (req, res) => {
    var drawing = { 
        userid: req.user.userid, 
        name: req.user.name,
        target_userid: req.params.targetUserid,
        target_name: req.body.target_name,
        snapshot: req.body.snapshot
    };
    Drawing.findOneAndUpdate({ userid: req.user.userid, target_userid: req.params.targetUserid }, drawing, {upsert: true}, (err, doc) => {
        if (err) return res.send(500, {error: err});
        res.redirect('/draw/' + req.params.targetUserid);
    });
});


app.get('/select', isAuthenticated, (req, res) => {
    Image.find()
        .then(images => {
            res.render('pages/select', {
                user: req.user,
                images: images
            });
        })
        .catch(err => res.status(400).json('Error: ' + err));
});

app.get('/myfaces', isAuthenticated, (req, res) => {
    Drawing.find({ target_userid: req.user.userid })
        .then(drawings => {
            Image.findOne({ userid: req.user.userid }, (err, image) => {
                if (err || !image) {
                    res.redirect('/error');
                }
                res.render('pages/myfaces', {
                    user: req.user,
                    drawings: drawings,
                    image: image
                });
            })
        })
        .catch(err => res.status(400).json('Error: ' + err));
});

app.get('/random', isAuthenticated, (req, res) => {
    Drawing.count().exec(function (err, count) {

        // Get a random entry
        var random = Math.floor(Math.random() * count)
      
        // Again query all users but only fetch one offset by our random #
        Drawing.findOne().skip(random).exec(
          function (err, drawing) {
            if (err) {
                res.redirect('/error');
            }
            Image.findOne({ userid: drawing.target_userid }, (err, image) => {
                if (err) {
                    res.redirect('/error');
                }
                res.render('pages/random', {
                    image_url: '/rawimage/' + drawing.target_userid,
                    user: req.user,
                    targetUserid: drawing.target_userid,
                    image: image,
                    drawing: drawing
                });
            });            
          });
      });
    });

app.get('/drawshow/:userid/:targetUserid', isAuthenticated, (req, res) => {
    Drawing.findOne({ userid: req.params.userid, target_userid: req.params.targetUserid }, 
        (err, drawing) => {
          if (err) {
              res.redirect('/error');
          }
          Image.findOne({ userid: drawing.target_userid }, (err, image) => {
              if (err) {
                  res.redirect('/error');
              }
              res.render('pages/drawshow', {
                  image_url: '/rawimage/' + drawing.target_userid,
                  user: req.user,
                  targetUserid: drawing.target_userid,
                  image: image,
                  drawing: drawing
              });
          });            
        });
});

app.get('/error', (req, res) => res.status(500).send("Something is wrong"));

// routes for auth
app.get('/auth/success', (req, res) => {
    res.render('pages/success', {user: req.user});
  });

app.get('/auth/error', (req, res) => res.send("error logging in"));

app.get('/auth/google',
  passport.authenticate('google', { scope : ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/error' }),
  function(req, res) {
    // Successful authentication, redirect success.
    res.redirect('/');
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout();
  res.redirect("/");
});



// start server
app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});
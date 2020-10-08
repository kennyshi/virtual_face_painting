const router = require('express').Router();
const User = require('../models/user.model');

router.route('/').get((req, res) => {
    User.find()
        .then(users => res.json(users))
        .catch(err => res.status(400).json('Error: ' + err));
});

router.route('/add').post((req, res) => {
    const userid = req.body.userid;
    const username = req.body.username;
    const name = req.body.name;
    const school = req.body.school;
    const grade = req.body.grade;
    const newUser = new User({
        userid: userid,
        username: username,
        name: name,
        school: school,
        grade: grade
    });
    newUser.save()
        .then(() => res.json('User added!'))
        .catch(err => res.status(400).json('Error: ' + err));
});

module.exports = router;
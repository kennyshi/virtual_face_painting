const router = require('express').Router();
let User = require('../models/drawing.model');

router.route('/').get((req, res) => {
    User.find()
        .then(drawings => res.json(drawings))
        .catch(err => res.status(400).json('Error: ' + err));
});

router.route('/add').post((req, res) => {
    const userid = req.body.userid;
    const target_userid = req.body.target_userid;
    const drawing = req.body.drawing;
    const newDrawing = new Drawing({
        userid: userid,
        target_userid: target_userid,
        drawing: drawing
    });
    newDrawing.save()
        .then(() => res.json('Drawing added!'))
        .catch(err => res.status(400).json('Error: ' + err));
});

module.exports = router;
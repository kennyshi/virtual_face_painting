const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const drawingSchema = new Schema({
    userid: { type: Number, required: true, unique: false },
    target_userid: { type: Number, required: true, unique: false },
    drawing: { type: String, required: true, unique: false }
}, {
    timestamps: true,
});

const Drawing = mongoose.model('Drawing', drawingSchema);

module.exports = Drawing;
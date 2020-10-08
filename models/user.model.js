const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    userid: { type: Number, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    school: { type: String },
    grade: { type: Number }
}, {
    timestamps: true,
});

const User = mongoose.model('DrawingUser', userSchema);

module.exports = User;
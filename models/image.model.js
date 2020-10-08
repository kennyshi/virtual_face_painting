const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const imageSchema = new Schema({
    userid: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    image: { data: Buffer, contentType: String, width: Number, height: Number }
}, {
    timestamps: true,
});

const Image = mongoose.model('Image', imageSchema);

module.exports = Image;
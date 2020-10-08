const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const imageSchema = new Schema({
    userid: { type: Number, required: true, unique: true },
    image: { data: Buffer, contentType: String }
}, {
    timestamps: true,
});

const Image = mongoose.model('Image', imageSchema);

module.exports = Image;
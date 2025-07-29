const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
    roomName: {
        type: String,
        required: true,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add index for faster queries
chatRoomSchema.index({ roomName: 1 });
chatRoomSchema.index({ createdBy: 1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);

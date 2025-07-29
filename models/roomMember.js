const mongoose = require('mongoose');

const roomMemberSchema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatRoom',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
});

// Add compound index for roomId and userId combination
// Ensure unique membership (user can't join same room twice)
roomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });

// Add single indexes for common queries
roomMemberSchema.index({ roomId: 1 });
roomMemberSchema.index({ userId: 1 });

module.exports = mongoose.model('RoomMember', roomMemberSchema);

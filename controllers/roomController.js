const ChatRoom = require('../models/chatRoom');
const RoomMember = require('../models/roomMember');
const User = require('../models/user');

// Helper function to get room with member count
async function getRoomWithMemberCount(roomId) {
    const room = await ChatRoom.findById(roomId).populate('createdBy', 'username');
    const memberCount = await RoomMember.countDocuments({ roomId });
    const roomObj = room.toObject();
    roomObj.memberCount = memberCount;
    return roomObj;
}

async function createRoom (req, res) {
    try {
        const { roomName } = req.body;
        
        if (!roomName) {
            return res.status(400).json({ message: 'Room name is required' });
        }

        // Create new room
        const room = new ChatRoom({
            roomName,
            createdBy: req.user._id
        });

        await room.save();

        // Add creator as first member
        const roomMember = new RoomMember({
            roomId: room._id,
            userId: req.user._id
        });

        await roomMember.save();
        
        // Populate creator's info
        await room.populate('createdBy', 'username');

        res.status(201).json(room);
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ message: 'Error creating chat room' });
    }
};


async function joinRoom (req, res) {
    try {
        const { roomId } = req.params;
        const userId = req.user._id;

        const room = await ChatRoom.findById(roomId);
        
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Check if user is already a member
        const existingMember = await RoomMember.findOne({ roomId, userId });
        if (existingMember) {
            return res.status(400).json({ message: 'You are already a member of this room' });
        }

        // Create new room membership
        const roomMember = new RoomMember({
            roomId,
            userId
        });

        await roomMember.save();
        
        // Get room with members count
        const roomWithMembers = await getRoomWithMemberCount(roomId);
        
        res.json(roomWithMembers);
    } catch (error) {
        console.error('Error joining room:', error);
        res.status(500).json({ message: 'Error joining chat room' });
    }
};


async function leaveRoom (req, res) {
    try {
        const { roomId } = req.params;
        const userId = req.user._id;

        const room = await ChatRoom.findById(roomId);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Prevent creator from leaving
        if (room.createdBy.toString() === userId.toString()) {
            return res.status(400).json({ message: 'Room creator cannot leave. Delete the room instead.' });
        }

        // Remove membership
        const result = await RoomMember.findOneAndDelete({ roomId, userId });
        if (!result) {
            return res.status(400).json({ message: 'You are not a member of this room' });
        }

        res.json({ message: 'Successfully left the room' });
    } catch (error) {
        console.error('Error leaving room:', error);
        res.status(500).json({ message: 'Error leaving chat room' });
    }
};

//(only creator can delete)
async function deleteRoom (req, res) {
    try {
        const { roomId } = req.params;
        const userId = req.user._id;

        const room = await ChatRoom.findById(roomId);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Check if user is the creator
        if (room.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Only the room creator can delete the room' });
        }

        // Delete all memberships first, then delete the room
        await RoomMember.deleteMany({ roomId });
        await ChatRoom.findByIdAndDelete(roomId);
        
        res.json({ message: 'Room deleted successfully' });
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).json({ message: 'Error deleting chat room' });
    }
};


async function getUserRooms (req, res) {
    try {
        // Get all room IDs where user is a member
        const memberships = await RoomMember.find({ userId: req.user._id });
        const roomIds = memberships.map(m => m.roomId);

        // Get rooms with member count
        const rooms = await Promise.all(
            roomIds.map(roomId => getRoomWithMemberCount(roomId))
        );

        // Sort by creation date
        rooms.sort((a, b) => b.createdAt - a.createdAt);
        
        res.json(rooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ message: 'Error fetching chat rooms' });
    }
};


async function getRoomDetails (req, res) {
    try {
        const { roomId } = req.params;
        
        // Get room details with member count
        const room = await getRoomWithMemberCount(roomId);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Get room members
        const members = await RoomMember.find({ roomId })
            .populate('userId', 'username')
            .sort('joinedAt');

        room.members = members.map(m => ({
            userId: m.userId._id,
            username: m.userId.username,
            joinedAt: m.joinedAt
        }));

        res.json(room);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error fetching room details' });
    }
};

module.exports = {
    createRoom,
    joinRoom,
    leaveRoom,
    deleteRoom,
    getUserRooms,
    getRoomDetails
};
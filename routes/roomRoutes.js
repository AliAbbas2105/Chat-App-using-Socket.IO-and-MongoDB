const express = require('express');
const router = express.Router();
const authenticateToken  = require('../middlewares/authMiddleware'); // Adjust path as needed
const {
    createRoom,
    joinRoom,
    leaveRoom,
    deleteRoom,
    getUserRooms,
    getRoomDetails,
    getRoomUnreadCounts,
    getRoomMessages
} = require('../controllers/roomController');

router.post('/create', authenticateToken, createRoom);
router.get('/unread-counts', authenticateToken, getRoomUnreadCounts);
router.get('/user-rooms', authenticateToken, getUserRooms);
router.post('/:roomId/join', authenticateToken, joinRoom);
router.post('/:roomId/leave', authenticateToken, leaveRoom);
router.get('/:roomId/messages', authenticateToken, getRoomMessages);
router.delete('/:roomId', authenticateToken, deleteRoom);
router.get('/:roomId', authenticateToken, getRoomDetails);

module.exports = router;

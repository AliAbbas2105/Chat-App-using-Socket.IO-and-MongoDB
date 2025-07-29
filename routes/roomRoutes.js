const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.post('/create', roomController.createRoom);
router.post('/join/:roomId', roomController.joinRoom);
router.post('/leave/:roomId', roomController.leaveRoom);
router.delete('/delete/:roomId', roomController.deleteRoom);
router.get('/my-rooms', roomController.getUserRooms);
router.get('/:roomId', roomController.getRoomDetails);

module.exports = router;

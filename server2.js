const express = require('express')
const session = require('express-session');
const app = express()
const dotenv = require('dotenv')
dotenv.config()
const mongoose = require('mongoose')
const passport = require('passport');
const path = require('path');
const cookieParser = require('cookie-parser');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');

const userRoutes = require('./routes/userRoutes');
const GoogleRoutes = require('./routes/googleRouter');
const roomRoutes = require('./routes/roomRoutes');
const User = require('./models/user');
const Notification = require('./models/notification');
require('./controllers/auth-google');

mongoose.connect(process.env.MONGODBLINK)
        .then(() => {
            console.log('Connected to MongoDB');
        })
        .catch((error) => {
            console.error('MongoDB connection error:', error);
        })

app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static("public"))
app.set("view engine", "ejs");

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (user, done) {
  done(null, user._id);
});

passport.deserializeUser(async function (id, done) {
  const user = await User.findById(id);
  done(null, user);
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.get('/', (req, res) => {
  res.render('signup');
});

app.use('/auth', GoogleRoutes);
app.use('/', userRoutes);
app.use('/rooms', roomRoutes);

const server = createServer(app);
const io = new Server(server);

const onlineUsers = {};
const Message = require('./models/message');
const ChatRoom = require('./models/chatRoom');
const RoomMember = require('./models/roomMember');

const roomMembers = new Map();

async function initializeRoomMembers() {
    const members = await RoomMember.find().lean();
    members.forEach(member => {
        const roomId = member.roomId.toString();
        if (!roomMembers.has(roomId)) {
            roomMembers.set(roomId, new Set());
        }
        roomMembers.get(roomId).add(member.userId.toString());
    });
}
initializeRoomMembers();

io.on('connection', async (socket) => {
  const rawCookies = socket.handshake.headers.cookie || '';
  const cookies = cookie.parse(rawCookies);
  const token = cookies.token;
  let userId = null;
  let username = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decoded.id);
      if (user && decoded.tokenVersion === user.tokenVersion) {
        userId = user._id.toString();
        username = user.username;
        socket.userId = userId;
        socket.username = username;
        onlineUsers[userId] = socket.id;
        
        const userRooms = await RoomMember.find({ userId }).lean();
        userRooms.forEach(membership => {
            socket.join(membership.roomId.toString());
        });
      } else {
        socket.emit('tokenExpired');
        socket.disconnect();
        return;
      }
    } catch (err) {
      socket.emit('tokenExpired');
      socket.disconnect();
      return;
    }
  } else {
    socket.emit('tokenExpired');
    socket.disconnect();
    return;
  }

  socket.on('private message', async ({ toUserId, text }) => {
    if (!toUserId || !text) return;
    
    const sender = await User.findById(userId);
    
    const message = new Message({
      sender: userId,
      recipient: toUserId,
      content: text,
      isRead: false,
      createdAt: new Date()
    });
    await message.save();

    const notification = new Notification({
      userId: toUserId,
      fromUserId: userId,
      message: `New message from ${sender.username}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
      read: false
    });
    await notification.save();

    const recipientSocketId = onlineUsers[toUserId];
    
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('private message', {
        fromUserId: userId,
        senderName: sender.username,
        text,
        _id: message._id,
        createdAt: message.createdAt
      });
    }
  });

  socket.on('mark as read', async ({ withUserId }) => {
    if (!withUserId) return;
    
    try {
      const unreadMessages = await Message.find({
        sender: withUserId,
        recipient: userId,
        isRead: false
      });

      await Message.updateMany(
        { sender: withUserId, recipient: userId, isRead: false },
        { isRead: true }
      );
      
      const senderSocketId = onlineUsers[withUserId];
      if (senderSocketId && unreadMessages.length > 0) {
        unreadMessages.forEach(message => {
          io.to(senderSocketId).emit('message-status', {
            messageId: message._id,
            isRead: true
          });
        });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  socket.on('room message', async ({ roomId, text }) => {
  if (!roomId || !text) return;
  
  try {
    const isMember = await RoomMember.findOne({ roomId, userId });
    if (!isMember) {
      socket.emit('error', { message: 'You are not a member of this room' });
      return;
    }

    const message = new Message({
      sender: userId,
      roomId: roomId,
      content: text,
      isRead: false,
      type: 'room',
      createdAt: new Date(),
      readBy: []
    });
    await message.save();

    const roomMembersList = await RoomMember.find({ roomId }).select('userId');
    const memberIds = roomMembersList.map(m => m.userId.toString());

    const notifications = memberIds
      .filter(memberId => memberId !== userId)
      .map(memberId => ({
        userId: memberId,
        fromUserId: userId,
        roomId: roomId,
        message: `New message from ${username} in room`,
        read: false
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    io.to(roomId.toString()).emit('room message', {
      roomId,
      sender: userId,
      senderName: username,
      text,
      _id: message._id,
      createdAt: message.createdAt
    });
  } catch (error) {
    console.error('Error sending room message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
});

  socket.on('join room', async (roomId) => {
    socket.join(roomId);
    if (!roomMembers.has(roomId)) {
      roomMembers.set(roomId, new Set());
    }
    roomMembers.get(roomId).add(userId);
  });

  socket.on('leave room', async (roomId) => {
    socket.leave(roomId);
    if (roomMembers.has(roomId)) {
      roomMembers.get(roomId).delete(userId);
    }
  });

  socket.on('mark room as read', async ({ roomId }) => {
  if (!roomId) return;
  
  try {
    // Update messages to include user in readBy
    await Message.updateMany(
      {
        roomId,
        sender: { $ne: userId },
        'readBy.userId': { $ne: userId }
      },
      {
        $addToSet: { readBy: { userId, readAt: new Date() } }
      }
    );

    // Check each message for full read status
    const messages = await Message.find({
      roomId,
      sender: { $ne: userId },
      type: 'room'
    });
    
    const roomMembersList = await RoomMember.find({ roomId }).select('userId');
    const memberIds = roomMembersList.map(m => m.userId.toString());
    
    for (const message of messages) {
      if (message.readBy.length === memberIds.length - 1) { // Exclude sender
        await Message.updateOne(
          { _id: message._id },
          { isRead: true }
        );
        io.to(roomId.toString()).emit('room message status', {
          messageId: message._id,
          isRead: true
        });
      }
    }
  } catch (error) {
    console.error('Error marking room messages as read:', error);
  }
});

  socket.on('disconnect', () => {
    console.log(`${socket.username} disconnected`);
    delete onlineUsers[userId];
    
    roomMembers.forEach((members, roomId) => {
      members.delete(userId);
    });
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})
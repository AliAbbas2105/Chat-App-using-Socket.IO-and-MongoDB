const express = require('express')
const session = require('express-session');
const app = express()
const dotenv=require('dotenv')
dotenv.config()
const mongoose = require('mongoose')
const passport = require('passport');
const path = require('path');
const cookieParser = require('cookie-parser');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');

const userRoutes=require('./routes/userRoutes')
const GoogleRoutes = require('./routes/googleRouter');
const User = require('./models/user');
require('./controllers/auth-google');

mongoose.connect(process.env.MONGODBLINK)
        .then(()=>{
            console.log('Connected to MongoDB');
        })
        .catch((error)=>{
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
app.use('/',userRoutes)

const server = createServer(app);
const io = new Server(server);

const onlineUsers = {}; // userId -> socketId
const Message = require('./models/message');

io.on('connection', async (socket) => {
  // Parse cookies and verify JWT
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

  // Handle private messages
  socket.on('private message', async ({ toUserId, text }) => {
    if (!toUserId || !text) return;
    // Save message to DB, unread by default
    const message = new Message({
      sender: userId,
      recipient: toUserId,
      content: text,
      isRead: false
    });
    await message.save();

    // Send to recipient if online
    const recipientSocketId = onlineUsers[toUserId];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('private message', {
        sender: userId,
        senderName: username,
        text,
        _id: message._id,
        createdAt: message.createdAt
      });
    }
    // Also emit to sender for instant UI update
    socket.emit('private message', {
      sender: userId,
      senderName: username,
      text,
      _id: message._id,
      createdAt: message.createdAt
    });
  });

  // Mark messages as read when user opens a chat
  socket.on('mark as read', async ({ withUserId }) => {
    if (!withUserId) return;
    await Message.updateMany({ sender: withUserId, recipient: userId, isRead: false }, { isRead: true });
  });

  // On disconnect, remove from online users
  socket.on('disconnect', () => {
    console.log(`${socket.username} disconnected`)
    delete onlineUsers[userId];
  });
});


server.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})
// app.listen(PORT)
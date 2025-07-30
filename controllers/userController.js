const jwt = require('jsonwebtoken')
const bcrypt=require('bcrypt')
require('dotenv').config();
const User = require('../models/user');
const Notification = require('../models/notification');
const Message = require('../models/message');
const RoomMember = require('../models/roomMember');
const ChatRoom = require('../models/chatRoom');

async function Signup(req, res) {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) return res.status(400).json({ error: 'Username already in use' });

    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).json({ error: 'Email already in use' });

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({username,email,password:hashedPassword,isVerified:true,provider: 'custom'});
    await newUser.save();
    res.status(201).json({message: 'User registered successfully'});
    // await UserVerificationLink.deleteMany({ email }); // clear old pending records

    // const token = uuidv4(); // unique token
    // const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // const pendingUser = new UserVerificationLink({
    //   name: username,
    //   email,
    //   hashedPassword,
    //   token,
    //   expiresAt,
    //   provider: 'custom' // for manual signup
    // });

    // await pendingUser.save();

    // const verificationLink = `${process.env.BASE_URL}/verify-link/${token}`;

    // await transporter.sendMail({
    //   from: process.env.EMAIL_USER,
    //   to: email,
    //   subject: 'Confirm Your Email',
    //   html: linkEmailTemplate(verificationLink),
    // });

    // res.status(200).json({ message: 'Verification link sent. Please confirm your email and then login.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
}

async function Login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'User not found' });

    if (!user.isVerified) return res.status(401).json({ error: 'Email not verified' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid password' });

    user.tokenVersion += 1;
    await user.save();

    const token = jwt.sign(
      { id: user._id, tokenVersion: user.tokenVersion },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, {
      httpOnly: true,           // prevents JS access (protects from XSS)
      //secure: process.env.NODE_ENV === 'production',
      secure: false,
      sameSite: 'lax',
      maxAge: 3600000
    });

    res.redirect('/homepage');
    //res.render('homepage'); //for frontend
    // res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function Logout(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Invalidate token
    user.tokenVersion += 1;
    await user.save();

    // Clear the cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Logout failed' });
  }
};

// // Search users by username (case-insensitive, partial match)
// async function searchUsers(req, res) {
//   try {
//     const { q } = req.query;
//     if (!q) return res.status(400).json({ error: 'Query required' });
//     // Exclude self from search results
//     const users = await User.find({
//       username: { $regex: q, $options: 'i' },
//       _id: { $ne: req.user._id }
//     }).select('username email');
//     res.json(users);
//   } catch (err) {
//     console.error('Search users error:', err);
//     res.status(500).json({ error: 'Failed to search users' });
//   }
// }
// UPDATED Search function - searches both users and rooms
async function searchUsers(req, res) {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    
    const userId = req.user._id;
    
    // Search for users (exclude self)
    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      _id: { $ne: userId }
    }).select('username email');
    
    // Search for chat rooms
    const rooms = await ChatRoom.find({
      roomName: { $regex: q, $options: 'i' }
    }).select('roomName createdBy createdAt').populate('createdBy', 'username');
    
    // Check which rooms the user is already a member of
    const userRoomMemberships = await RoomMember.find({ userId }).select('roomId');
    const userRoomIds = userRoomMemberships.map(m => m.roomId.toString());
    
    // Format rooms with membership status
    const formattedRooms = rooms.map(room => ({
      _id: room._id,
      name: room.roomName,
      roomName: room.roomName, // Keep both for compatibility
      type: 'room',
      createdBy: room.createdBy._id,
      createdAt: room.createdAt,
      isMember: userRoomIds.includes(room._id.toString()),
      isCreator: room.createdBy._id.toString() === userId.toString()
    }));
    
    // Format users
    const formattedUsers = users.map(user => ({
      ...user.toObject(),
      type: 'private'
    }));
    
    // Combine results
    const results = [...formattedUsers, ...formattedRooms];
    
    res.json(results);
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Failed to search users and rooms' });
  }
}
async function getChattedUsers(req, res) {
  try {
    const userId = req.user._id;
    
    // Get all private messages involving current user by their last message time
    const privateMessages = await Message.find({
      type: 'private',
      $or: [
        { sender: userId },
        { recipient: userId }
      ]
    })
    .sort({ createdAt: -1 })
    .lean();

    // Get all room messages for rooms user is member of
    const userRooms = await RoomMember.find({ userId }).select('roomId');
    const roomIds = userRooms.map(room => room.roomId);
    
    const roomMessages = await Message.find({
      type: 'room',
      roomId: { $in: roomIds }
    })
    .sort({ createdAt: -1 })
    .lean();

    // Process private chats
    const userMap = new Map();
    privateMessages.forEach(msg => {
      const otherId = msg.sender.toString() === userId.toString() ? 
                     msg.recipient.toString() : 
                     msg.sender.toString();
      
      if (!userMap.has(otherId)) {
        userMap.set(otherId, {
          type: 'private',
          lastMessageAt: msg.createdAt,
          lastMessage: msg.content,
          isLastMessageMine: msg.sender.toString() === userId.toString(),
          lastMessageDate: msg.createdAt
        });
      }
    });

    // Process room chats
    const roomMap = new Map();
    for (const room of userRooms) {
      const lastMessage = roomMessages.find(msg => msg.roomId.toString() === room.roomId.toString());
      if (lastMessage) {
        roomMap.set(room.roomId.toString(), {
          type: 'room',
          lastMessageAt: lastMessage.createdAt,
          lastMessage: lastMessage.content,
          isLastMessageMine: lastMessage.sender.toString() === userId.toString(),
          lastMessageDate: lastMessage.createdAt
        });
      }
    }

    // Get user details for private chats
    const users = await User.find({
      _id: { $in: Array.from(userMap.keys()) }
    })
    .select('username email')
    .lean();

    // Get room details
    const rooms = await ChatRoom.find({
      _id: { $in: roomIds }
    })
    .select('roomName createdBy')
    .lean();

    // Combine private chats and rooms
    const privateChats = users.map(user => {
      const messageInfo = userMap.get(user._id.toString());
      return {
        ...user,
        type: 'private',
        lastMessageAt: messageInfo.lastMessageAt,
        lastMessage: messageInfo.lastMessage,
        isLastMessageMine: messageInfo.isLastMessageMine,
        lastMessageDate: messageInfo.lastMessageDate
      };
    });

    const roomChats = rooms.map(room => {
      const messageInfo = roomMap.get(room._id.toString());
      return messageInfo ? {
        ...room,
        name: room.roomName,
        type: 'room',
        lastMessageAt: messageInfo.lastMessageAt,
        lastMessage: messageInfo.lastMessage,
        isLastMessageMine: messageInfo.isLastMessageMine,
        lastMessageDate: messageInfo.lastMessageDate
      } : null;
    }).filter(Boolean);

    // Combine and sort all chats by last message time
    const allChats = [...privateChats, ...roomChats]
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    res.json(allChats);
  } catch (err) {
    console.error('Get chatted users error:', err);
    res.status(500).json({ error: 'Failed to get chatted users' });
  }
}

async function getUnreadCounts(req, res) {
  try {
    const userId = req.user._id;

    const unreadMessages = await Message.find({
      recipient: userId,
      isRead: false
    }).select('sender');

    const unreadCountsForSender = {};
    unreadMessages.forEach(msg => {
      const senderId = msg.sender.toString();
      unreadCountsForSender[senderId] = (unreadCountsForSender[senderId] || 0) + 1;
    });

    res.json(unreadCountsForSender);
  } catch (err) {
    console.error('Get unread counts error:', err);
    res.status(500).json({ error: 'Failed to get unread counts' });
  }
}

async function getChatHistory(req, res) {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.userId;
    
    // Find all messages between the two users
    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: otherUserId },
        { sender: otherUserId, recipient: userId }
      ]
    })
      .sort({ createdAt: 1 })
      .lean();

    // Mark messages as read
    await Message.updateMany(
      {
        sender: otherUserId,
        recipient: userId,
        isRead: false
      },
      { isRead: true }
    );

    // Add senderName for frontend display
    const users = await User.find({ _id: { $in: [userId, otherUserId] } }).select('username');
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u.username; });
    const messagesWithNames = messages.map(msg => ({
      ...msg,
      senderName: userMap[msg.sender.toString()] || msg.sender
    }));
    res.json(messagesWithNames);
  } catch (err) {
    console.error('Get chat history error:', err);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
}

async function getNotifications(req, res) {
  try {
    const notifications = await Notification.find({ 
      userId: req.user._id,
      read: false // Only get unread notifications
    })
    .sort({ createdAt: -1 })
    .populate('fromUserId', 'username')
    .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

async function deleteNotifications(req, res) {
  try {
    const { notificationIds } = req.body;
    await Notification.deleteMany({
      _id: { $in: notificationIds },
      userId: req.user._id // Security check
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
}

module.exports = {
    Signup,
    Login,
    Logout,
    searchUsers,
    getChattedUsers,
    getChatHistory,
    getUnreadCounts,
    getNotifications,
    deleteNotifications
};
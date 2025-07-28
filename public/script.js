const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const userList = document.getElementById('userList');
const searchInput = document.getElementById('searchInput');
const currentUserName = document.getElementById('currentUserName');
currentUserName.textContent = CURRENT_USER;

let selectedUser = null;
let users = [];
let unreadCounts = {};
let chatHistory = {};
let notifications = [];
let onlineUsers = new Set();

async function fetchUnreadCounts() {
  try {
    const res = await fetch('/users/unread-counts');
    unreadCounts = await res.json();
    renderUserList(users); // Updates display with new counts
  } catch (err) {
    console.error('Failed to fetch unread counts:', err);
  }
}

// Fetch notifications from server
async function fetchNotifications() {
  try {
    const res = await fetch('/users/notifications');
    notifications = await res.json();
    updateNotificationBadge();
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
  }
}

function updateNotificationBadge() {
  // Only count actually unread notifications from the server
  const unreadCount = notifications.filter(n => !n.read).length;
  const badge = document.getElementById('notification-badge');
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
  
  // Update notification panel if it's open
  const panel = document.getElementById('notifications-panel');
  if (panel && panel.style.display === 'block') {
    renderNotifications();
  }
}

// Handle notification icon click and outside clicks
document.querySelector('.notification-icon').addEventListener('click', (e) => {
  e.stopPropagation();
  const panel = document.getElementById('notifications-panel');
  if (!panel) {
    // Create notifications panel if it doesn't exist
    const newPanel = document.createElement('div');
    newPanel.id = 'notifications-panel';
    document.querySelector('.header').appendChild(newPanel);
    renderNotifications();
    newPanel.style.display = 'block';
  } else {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') {
      renderNotifications();
    }
  }
});

// Close notification panel when clicking outside
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notifications-panel');
  const notificationIcon = document.querySelector('.notification-icon');
  if (panel && !panel.contains(e.target) && !notificationIcon.contains(e.target)) {
    panel.style.display = 'none';
  }
});

function formatDate(date) {
  const now = new Date();
  const messageDate = new Date(date);
  const diff = now - messageDate;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    // Today - show time
    return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][messageDate.getDay()];
  } else {
    // More than a week ago - show date
    return messageDate.toLocaleDateString();
  }
}

function renderNotifications() {
  const panel = document.getElementById('notifications-panel');
  const unreadNotifications = notifications.filter(n => !n.read);
  panel.innerHTML = unreadNotifications.length === 0 ? 
    '<div class="notification-item">No new notifications</div>' :
    unreadNotifications.map((notif) => `
      <div class="notification-item unread" 
           onclick="markNotificationRead('${notif._id}', '${notif.fromUserId}')">
        <div>${notif.message}</div>
        <small>${formatDate(notif.createdAt)}</small>
      </div>
    `).join('');
}

async function markNotificationRead(notificationId, fromUserId) {
  try {
    // Delete notification from server
    await fetch('/users/notifications/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notificationIds: [notificationId] })
    });

    // Remove notification from local state
    notifications = notifications.filter(n => n._id !== notificationId);
    updateNotificationBadge();
    renderNotifications();

    // Find and select the user from the notification
    const user = users.find(u => u._id === fromUserId);
    if (user) {
      selectUser(user);
    }
  } catch (err) {
    console.error('Failed to delete notification:', err);
  }
}

// Fetch chatted users on load
async function fetchChattedUsers() {
  const res = await fetch('/users/chatted');
  users = await res.json();
  await fetchUnreadCounts(); // Get initial unread counts
  renderUserList(users);
}

// Fetch chat history with a user
async function fetchChatHistory(userId) {
  const res = await fetch(`/messages/history/${userId}`);
  const history = await res.json();
  
  // Make sure each message has isRead property set
  history.forEach(msg => {
    if (msg.sender === CURRENT_USER) {
      msg.isRead = !!msg.isRead; // Convert to boolean
    }
  });
  
  chatHistory[userId] = history;
  renderMessages(history);
  scrollToBottom();
}

// Search users
async function searchUsers(query) {
  if (!query) {
    fetchChattedUsers();
    return;
  }
  const res = await fetch(`/users/search?q=${encodeURIComponent(query)}`);
  users = await res.json();
  renderUserList(users);
}

// Render user list
function renderUserList(users) {
  userList.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    
    // Create avatar
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    // Using UI Avatars API - generates consistent avatars based on username
    avatar.innerHTML = `<img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random&color=fff" alt="${user.username}">`;
    li.appendChild(avatar);
    
    // Create user info container
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    
    // Create header with username and date
    const header = document.createElement('div');
    header.className = 'chat-header';
    
    const username = document.createElement('div');
    username.className = 'username';
    username.textContent = user.username;
    header.appendChild(username);
    
    if (user.lastMessageDate) {
      const date = document.createElement('div');
      date.className = 'chat-date';
      date.textContent = formatDate(user.lastMessageDate);
      header.appendChild(date);
    }
    
    userInfo.appendChild(header);
    
    // Add last message preview
    if (user.lastMessage) {
      const lastMessage = document.createElement('div');
      lastMessage.className = 'last-message';
      lastMessage.textContent = user.isLastMessageMine ? 
        `You: ${user.lastMessage}` : 
        user.lastMessage;
      userInfo.appendChild(lastMessage);
    }
    
    li.appendChild(userInfo);
    
    // Add unread badge if needed
    if (unreadCounts[user._id]) {
      const badge = document.createElement('span');
      badge.className = 'unread-badge';
      badge.textContent = unreadCounts[user._id];
      li.appendChild(badge);
    }
    
    if (selectedUser && selectedUser._id === user._id) {
      li.classList.add('selected');
    }
    
    li.onclick = () => selectUser(user);
    userList.appendChild(li);
  });
}

function getMessageStatusHTML(isRead) {
  return `<span style="font-size: 0.75em; color: #8696A0; white-space: nowrap">${isRead ? 'Seen' : 'Delivered'}</span>`;
}

function renderMessages(msgs) {
  messages.innerHTML = '';
  msgs.forEach(msg => {
    const item = document.createElement('li');
    const messageDate = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
    const isSentByMe = (msg.senderName && msg.senderName === CURRENT_USER) || (msg.sender === CURRENT_USER);
    
    if (isSentByMe) {
      const statusHTML = getMessageStatusHTML(msg.isRead);
      item.setAttribute('data-message-id', msg._id);
      item.innerHTML = `
        <div class="message-content">${msg.content || msg.text}</div>
        <div class="message-info" style="display: flex; align-items: center; gap: 8px; margin-top: 4px">
          <span class="message-date" style="margin-right: 4px">${formatDate(messageDate)}</span>
          <span class="message-status">${statusHTML}</span>
        </div>`;
      item.className = 'sent';
    } else {
      item.innerHTML = `
        <div class="message-content">${msg.content || msg.text}</div>
        <div class="message-info">
          <span class="message-date">${formatDate(messageDate)}</span>
        </div>`;
      item.className = 'received';
    }
    messages.appendChild(item);
  });
  scrollToBottom();
}

// Scroll to bottom of messages
function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

// Select a user to chat with and set unread count to 0
async function selectUser(user) {
  selectedUser = user;
  
  await fetchChatHistory(user._id);
  
  // Mark messages as read
  socket.emit('mark as read', { withUserId: user._id });
  
  // Reset unread count for this user
  unreadCounts[user._id] = 0;
  
  // Update UI
  renderUserList(users);
  
  // Delete all notifications from this user
  const notificationsToDelete = notifications
    .filter(notif => notif.fromUserId === user._id)
    .map(notif => notif._id);
    
  if (notificationsToDelete.length > 0) {
    fetch('/users/notifications/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: notificationsToDelete })
    }).then(() => {
      // Remove notifications from local state
      notifications = notifications.filter(notif => notif.fromUserId !== user._id);
      updateNotificationBadge();
      renderNotifications();
    }).catch(err => console.error('Failed to delete notifications:', err));
  }
}

// Handle sending a message
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value && selectedUser) {
    const messageText = input.value;
    input.value = '';
    
    // Add message to local chat history immediately
    if (!chatHistory[selectedUser._id]) chatHistory[selectedUser._id] = [];
    const newMessage = {
      sender: CURRENT_USER,
      senderName: CURRENT_USER,
      text: messageText,
      _id: Date.now(),
      createdAt: new Date(), // Add current date/time for the message
      status: 'sent' // Initial status
     } 
    chatHistory[selectedUser._id].push(newMessage);
    renderMessages(chatHistory[selectedUser._id]);
    scrollToBottom();

    // Send to server
    socket.emit('private message', { toUserId: selectedUser._id, text: messageText });
    
    // Fetch updated user list to get new order
    fetchChattedUsers();
  }
});


// Search bar event
searchInput.addEventListener('input', (e) => {
        searchUsers(e.target.value);
});

// Initial load
async function initialLoad() {
  await fetchChattedUsers();
  await fetchNotifications();
}
initialLoad();

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    const response = await fetch('/logout', {
      method: 'POST',
      credentials: 'include'
    });

    if (response.ok) {
      socket.disconnect();
      window.location.href = '/login';
    } else {
      alert('Logout failed. Please try again.');
    }
  } catch (error) {
    console.error('Logout error:', error);
    alert('Logout failed. Please try again.');
  }
});

socket.on('tokenExpired', () => {
  alert('Session expired or not logged in. Please log in again.');
  window.location.href = '/login';
});

// Handle incoming messages and notifications
socket.on('private message', async ({ fromUserId, senderName, text, _id, createdAt, isRead }) => {
  if (selectedUser && fromUserId === selectedUser._id) {
    // If chat is open with this user, add message and mark as read
    if (!chatHistory[fromUserId]) chatHistory[fromUserId] = [];
    chatHistory[fromUserId].push({ 
      sender: senderName, 
      text, 
      _id: _id || Date.now(),
      createdAt: createdAt || new Date(),
      isRead: !!isRead
    });
    renderMessages(chatHistory[fromUserId]);
    // Immediately mark as read on server
    socket.emit('mark as read', { withUserId: fromUserId });
    unreadCounts[fromUserId] = 0;
    renderUserList(users);
  } else {
    // Only update unread count if chat is not open
    await fetchUnreadCounts();
  }

  // Always update notifications and chat order
  await fetchNotifications();
  
  // Update chat list without modifying unread counts
  const res = await fetch('/users/chatted');
  users = await res.json();
  renderUserList(users);
  
  // If current chat is open, scroll to bottom
  if (selectedUser && fromUserId === selectedUser._id) {
    scrollToBottom();
  }
});

// Handle message status updates
socket.on('message-status', ({ messageId, isRead }) => {
  console.log('Status update received:', messageId, isRead);
  // First try to update the specific status element without re-rendering
  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageElement) {
    const statusSpan = messageElement.querySelector('.message-status');
    if (statusSpan) {
      statusSpan.innerHTML = getMessageStatusHTML(isRead);
      console.log('Updated status display for message:', messageId);
    }
  }
  
  // Also update in chat history
  for (let userId in chatHistory) {
    const messages = chatHistory[userId];
    const message = messages.find(msg => msg._id.toString() === messageId.toString());
    if (message) {
      message.isRead = isRead;
      break;
    }
  }
});
    
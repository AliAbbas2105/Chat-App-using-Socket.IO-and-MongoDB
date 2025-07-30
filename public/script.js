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
    const privateUnread = await res.json();

    // Fetch room chat unread counts
    const roomRes = await fetch('/rooms/unread-counts');
    const roomUnread = await roomRes.json();

    // Merge both into unreadCounts
    unreadCounts = { ...privateUnread, ...roomUnread };
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
  const unreadCount = notifications.filter(n => !n.read).length;
  const badge = document.getElementById('notification-badge');
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
  
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
    return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][messageDate.getDay()];
  } else {
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
    await fetch('/users/notifications/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notificationIds: [notificationId] })
    });

    notifications = notifications.filter(n => n._id !== notificationId);
    updateNotificationBadge();
    renderNotifications();

    const user = users.find(u => u._id === fromUserId);
    if (user) {
      selectUser(user);
    }
  } catch (err) {
    console.error('Failed to delete notification:', err);
  }
}

async function fetchChattedUsers() {
  const res = await fetch('/users/chatted');
  users = await res.json();
  await fetchUnreadCounts();
  renderUserList(users);
}

async function fetchChatHistory(userId) {
  const res = await fetch(`/messages/history/${userId}`);
  const history = await res.json();
  
  history.forEach(msg => {
    if (msg.sender === CURRENT_USER) {
      msg.isRead = !!msg.isRead;
    }
  });
  
  chatHistory[userId] = history;
  renderMessages(history);
  scrollToBottom();
}

async function searchUsers(query) {
  if (!query) {
    fetchChattedUsers();
    return;
  }
  const res = await fetch(`/users/search?q=${encodeURIComponent(query)}`);
  users = await res.json();
  renderUserList(users);
}

function renderCreateRoomButton() {
  const li = document.createElement('li');
  li.className = 'create-room-button';
  li.innerHTML = `
    <div class="user-avatar">
      <i class="fas fa-plus-circle"></i>
    </div>
    <div class="user-info">
      <div class="username">Create New Chat Room</div>
    </div>
  `;
  li.onclick = () => {
    const roomName = prompt('Enter room name:');
    if (roomName) {
      createChatRoom(roomName);
    }
  };
  return li;
}

async function createChatRoom(roomName) {
  try {
    const response = await fetch('/rooms/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roomName })
    });
    
    const result = await response.json();
    if (response.ok) {
      fetchChattedUsers();
    } else {
      alert(result.message || 'Failed to create room');
    }
  } catch (error) {
    console.error('Error creating room:', error);
    alert('Failed to create room');
  }
}

function renderUserList(users) {
  userList.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    
    li.appendChild(createUserAvatar(user.type === 'room' ? user.name : user.username));
    
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    
    const header = document.createElement('div');
    header.className = 'chat-header';
    
    const username = document.createElement('div');
    username.className = 'username';
    username.textContent = user.type === 'room' ? user.name : user.username;
    header.appendChild(username);
    
    if (user.lastMessageDate) {
      const date = document.createElement('div');
      date.className = 'chat-date';
      date.textContent = formatDate(user.lastMessageDate);
      header.appendChild(date);
    }
    
    userInfo.appendChild(header);
    
    if (user.lastMessage) {
      const lastMessage = document.createElement('div');
      lastMessage.className = 'last-message';
      lastMessage.textContent = user.isLastMessageMine ? 
        `You: ${user.lastMessage}` : 
        user.lastMessage;
      userInfo.appendChild(lastMessage);
    }
    
    if (user.type === 'room' && user.hasOwnProperty('isMember') && !user.isMember) {
      const joinBtn = document.createElement('button');
      joinBtn.className = 'join-room-btn';
      joinBtn.textContent = 'Join';
      joinBtn.onclick = (e) => {
        e.stopPropagation();
        const roomId = prompt('Enter room ID to join:');
        if (roomId === user._id) {
          joinRoom(user._id, user.name);
        } else {
          alert('Invalid room ID');
        }
      };
      userInfo.appendChild(joinBtn);
    }

    li.appendChild(userInfo);

    if (unreadCounts[user._id]) {
      const badge = document.createElement('span');
      badge.className = 'unread-badge';
      badge.textContent = unreadCounts[user._id];
      li.appendChild(badge);
    }
    
    if (selectedUser && selectedUser._id === user._id) {
      li.classList.add('selected');
    }
    
    if (user.type !== 'room' || !user.hasOwnProperty('isMember') || user.isMember) {
      li.onclick = () => selectUser(user);
    } else {
      li.style.opacity = '0.7';
    }

    userList.appendChild(li);
  });
  
  userList.appendChild(renderCreateRoomButton());
}

async function joinRoom(roomId, roomName) {
  try {
    const response = await fetch(`/rooms/${roomId}/join`, {
      method: 'POST'
    });
    
    const result = await response.json();
    if (response.ok) {
      alert(`Successfully joined room: ${roomName}`);
      socket.emit('join room', roomId);
      await fetchChattedUsers();
      searchInput.value = '';
      const joinedRoom = users.find(u => u._id === roomId);
      if (joinedRoom) {
        selectUser(joinedRoom);
      }
    } else {
      alert(result.message || 'Failed to join room');
    }
  } catch (error) {
    console.error('Error joining room:', error);
    alert('Failed to join room');
  }
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
      const showSenderName = msg.senderName && msg.type === 'room'
      item.innerHTML = `
        ${showSenderName ? `<div class="sender-name">${msg.senderName}</div>` : ''}
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

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

function createUserAvatar(username) {
  const avatar = document.createElement('div');
  avatar.className = 'user-avatar';
  avatar.innerHTML = `<img src="https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&color=fff" alt="${username}">`;
  return avatar;
}

async function selectUser(user) {
  selectedUser = user;
  
  const headerDiv = document.getElementById('selectedUserName');
  headerDiv.innerHTML = '';
  
  if (user.type === 'room') {
    // Create container for avatar and info
    const headerContainer = document.createElement('div');
    headerContainer.className = 'room-header-container';
    
    // Avatar
    headerContainer.appendChild(createUserAvatar(user.name || user.roomName));
    
    // Info section
    const roomInfo = document.createElement('div');
    roomInfo.className = 'room-info';
    
    // Room name and ID
    const roomTitle = document.createElement('div');
    roomTitle.className = 'room-title';
    roomTitle.textContent = `${user.name || user.roomName} -- (Room ID: ${user._id})`;
    roomInfo.appendChild(roomTitle);
    
    // Action container (right-aligned)
    const actionContainer = document.createElement('div');
    actionContainer.className = 'room-actions';
    
    // Check if current user is the creator
    if (user.createdBy && user.createdBy.toString() === CURRENT_USER_ID) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'room-action-btn delete';
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
      deleteBtn.onclick = () => deleteRoom(user._id);
      actionContainer.appendChild(deleteBtn);
    } else {
      const leaveBtn = document.createElement('button');
      leaveBtn.className = 'room-action-btn';
      leaveBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Leave';
      leaveBtn.onclick = () => leaveRoom(user._id);
      actionContainer.appendChild(leaveBtn);
    }
    
    // Append info and actions to container
    headerContainer.appendChild(roomInfo);
    headerContainer.appendChild(actionContainer);
    headerDiv.appendChild(headerContainer);

    await fetchRoomHistory(user._id);
    socket.emit('join room', user._id);
    socket.emit('mark room as read', { roomId: user._id });
  } else {
    // Private chat header remains unchanged
    headerDiv.appendChild(createUserAvatar(user.username));
    
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    
    const username = document.createElement('div');
    username.className = 'username';
    username.textContent = user.username;
    userInfo.appendChild(username);
    
    headerDiv.appendChild(userInfo);

    await fetchChatHistory(user._id);
    socket.emit('mark as read', { withUserId: user._id });
  }
  
  unreadCounts[user._id] = 0;
  await fetchUnreadCounts(); // Refresh unread counts after marking as read
  renderUserList(users);
  
  const notificationsToDelete = notifications
    .filter(notif => notif.fromUserId === user._id)
    .map(notif => notif._id);
    
  if (notificationsToDelete.length > 0) {
    fetch('/users/notifications/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: notificationsToDelete })
    }).then(() => {
      notifications = notifications.filter(notif => notif.fromUserId !== user._id);
      updateNotificationBadge();
      renderNotifications();
    }).catch(err => console.error('Failed to delete notifications:', err));
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value && selectedUser) {
    const messageText = input.value;
    input.value = '';
    
    if (selectedUser.type === 'room') {
      socket.emit('room message', { roomId: selectedUser._id, text: messageText });
    } else {
      socket.emit('private message', { toUserId: selectedUser._id, text: messageText });
    }
    
    fetchChattedUsers();
  }
});

async function leaveRoom(roomId) {
  if (!confirm('Are you sure you want to leave this room?')) return;
  
  try {
    const response = await fetch(`/rooms/${roomId}/leave`, {
      method: 'POST'
    });
    
    const result = await response.json();
    if (response.ok) {
      alert('Successfully left the room');
      socket.emit('leave room', roomId);
      selectedUser = null;
      messages.innerHTML = '';
      document.getElementById('selectedUserName').innerHTML = '';
      fetchChattedUsers();
    } else {
      alert(result.message || 'Failed to leave room');
    }
  } catch (error) {
    console.error('Error leaving room:', error);
    alert('Failed to leave room');
  }
}

async function deleteRoom(roomId) {
  if (!confirm('Are you sure you want to delete this room? This cannot be undone.')) return;
  
  try {
    const response = await fetch(`/rooms/${roomId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    if (response.ok) {
      alert('Room deleted successfully');
      socket.emit('leave room', roomId);
      selectedUser = null;
      messages.innerHTML = '';
      document.getElementById('selectedUserName').innerHTML = '';
      fetchChattedUsers();
    } else {
      alert(result.message || 'Failed to delete room');
    }
  } catch (error) {
    console.error('Error deleting room:', error);
    alert('Failed to delete room');
  }
}

async function fetchRoomHistory(roomId) {
  try {
    const res = await fetch(`/rooms/${roomId}/messages`);
    const history = await res.json();
    chatHistory[roomId] = history;
    renderMessages(history);
    scrollToBottom();
    
    socket.emit('mark room as read', { roomId });
  } catch (error) {
    console.error('Error fetching room history:', error);
    alert('Failed to fetch room messages');
  }
}

searchInput.addEventListener('input', (e) => {
  searchUsers(e.target.value);
});

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

socket.on('room message', async ({ roomId, sender, senderName, text, _id, createdAt }) => {
  if (selectedUser && selectedUser.type === 'room' && selectedUser._id === roomId) {
    if (!chatHistory[roomId]) chatHistory[roomId] = [];
    const existingMessage = chatHistory[roomId].find(msg => msg._id === _id);
    if (!existingMessage) {
      chatHistory[roomId].push({
        sender,
        senderName,
        text,
        _id: _id || Date.now(),
        createdAt: createdAt || new Date(),
        type: 'room'
      });
      renderMessages(chatHistory[roomId]);
      scrollToBottom();
    }
  }

  await fetchNotifications();
  await fetchChattedUsers();
});

socket.on('private message', async ({ fromUserId, senderName, text, _id, createdAt, isRead }) => {
  console.log(`Received private message on frontend for ${fromUserId}, selectedUser: ${selectedUser ? selectedUser._id : 'none'}`);
  if (selectedUser && fromUserId === selectedUser._id) {
    if (!chatHistory[fromUserId]) chatHistory[fromUserId] = [];
    const existingMessage = chatHistory[fromUserId].find(msg => msg._id === _id);
    if (!existingMessage) {
      chatHistory[fromUserId].push({ 
        sender: senderName, 
        text, 
        _id: _id || Date.now(),
        createdAt: createdAt || new Date(),
        isRead: !!isRead,
        fromUserId: fromUserId
      });
      renderMessages(chatHistory[fromUserId]);
      socket.emit('mark as read', { withUserId: fromUserId });
      unreadCounts[fromUserId] = 0;
      renderUserList(users);
    }
  } else {
    await fetchUnreadCounts();
  }

  await fetchNotifications();
  const res = await fetch('/users/chatted');
  users = await res.json();
  renderUserList(users);
  
  if (selectedUser && fromUserId === selectedUser._id) {
    scrollToBottom();
  }
});

socket.on('message-status', ({ messageId, isRead }) => {
  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageElement) {
    const statusSpan = messageElement.querySelector('.message-status');
    if (statusSpan) {
      statusSpan.innerHTML = getMessageStatusHTML(isRead);
    }
  }
  
  for (let userId in chatHistory) {
    const messages = chatHistory[userId];
    const message = messages.find(msg => msg._id.toString() === messageId.toString());
    if (message) {
      message.isRead = isRead;
      break;
    }
  }
});

socket.on('room message status', ({ messageId, isRead }) => {
  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageElement) {
    const statusSpan = messageElement.querySelector('.message-status');
    if (statusSpan) {
      statusSpan.innerHTML = getMessageStatusHTML(isRead);
    }
  }
  
  for (let roomId in chatHistory) {
    const messages = chatHistory[roomId];
    const message = messages.find(msg => msg._id.toString() === messageId.toString());
    if (message) {
      message.isRead = isRead;
      break;
    }
  }
});
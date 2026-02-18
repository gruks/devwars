/**
 * Chat event handlers
 */
const { EVENTS } = require('../utils/events.js');
const { asyncHandler } = require('../middleware/error.js');
const { logger } = require('../../../utils/logger.js');

// In-memory message cache per room (last 50 messages)
const roomMessages = new Map(); // roomId -> Array of messages

const MAX_MESSAGES_PER_ROOM = 50;

/**
 * Register chat event handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Socket instance
 */
const registerChatHandlers = (io, socket) => {
  /**
   * Send chat message
   * Requires authentication and room membership
   */
  socket.on(EVENTS.ROOM.CHAT_MESSAGE, asyncHandler(async (data, callback) => {
    if (!socket.user) {
      throw new Error('Authentication required');
    }

    const { roomId, message, type = 'text' } = data;

    if (!roomId || !message) {
      throw new Error('Room ID and message are required');
    }

    // Validate message length
    if (message.length > 500) {
      throw new Error('Message too long (max 500 characters)');
    }

    // Check if socket is in the room
    const roomSockets = await io.in(`room:${roomId}`).fetchSockets();
    const isInRoom = roomSockets.some(s => s.id === socket.id);

    if (!isInRoom) {
      throw new Error('You are not in this room');
    }

    // Create message object
    const chatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      userId: socket.user.userId,
      username: socket.user.username,
      message: message.trim(),
      type, // 'text', 'system', 'action'
      timestamp: new Date().toISOString()
    };

    // Store in cache
    if (!roomMessages.has(roomId)) {
      roomMessages.set(roomId, []);
    }
    const messages = roomMessages.get(roomId);
    messages.push(chatMessage);
    
    // Keep only last N messages
    if (messages.length > MAX_MESSAGES_PER_ROOM) {
      messages.shift();
    }

    // Broadcast to room (including sender)
    io.to(`room:${roomId}`).emit(EVENTS.ROOM.CHAT_MESSAGE, chatMessage);

    logger.debug(`Chat message in room ${roomId} from ${socket.user.username}`);

    if (typeof callback === 'function') {
      callback({
        success: true,
        data: { message: chatMessage },
        timestamp: new Date().toISOString()
      });
    }
  }));

  /**
   * Get recent chat history
   */
  socket.on('chat:history', asyncHandler(async (data, callback) => {
    const { roomId } = data;
    
    const messages = roomMessages.get(roomId) || [];
    
    if (typeof callback === 'function') {
      callback({
        success: true,
        data: { messages },
        timestamp: new Date().toISOString()
      });
    }
  }));

  /**
   * Send system message to room
   * (Used internally by other handlers)
   */
  socket.sendSystemMessage = (roomId, message) => {
    const systemMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      userId: 'system',
      username: 'System',
      message,
      type: 'system',
      timestamp: new Date().toISOString()
    };

    if (!roomMessages.has(roomId)) {
      roomMessages.set(roomId, []);
    }
    const messages = roomMessages.get(roomId);
    messages.push(systemMessage);
    
    if (messages.length > MAX_MESSAGES_PER_ROOM) {
      messages.shift();
    }

    io.to(`room:${roomId}`).emit(EVENTS.ROOM.CHAT_MESSAGE, systemMessage);
  };
};

/**
 * Clean up messages for a room (called when room is deleted)
 */
const cleanupRoomMessages = (roomId) => {
  roomMessages.delete(roomId);
  logger.debug(`Cleaned up messages for room ${roomId}`);
};

module.exports = { registerChatHandlers, cleanupRoomMessages };

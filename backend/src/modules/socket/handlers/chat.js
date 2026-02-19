/**
 * Chat event handlers
 */
const { EVENTS } = require('../utils/events.js');
const { asyncHandler } = require('../middleware/error.js');
const { logger } = require('../../../utils/logger.js');
const { Message } = require('../../rooms/room.model.js');

// In-memory message cache per room (last 50 messages) - for real-time performance
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

    // Store in memory cache for real-time performance
    if (!roomMessages.has(roomId)) {
      roomMessages.set(roomId, []);
    }
    const messages = roomMessages.get(roomId);
    messages.push(chatMessage);
    
    // Keep only last N messages in memory
    if (messages.length > MAX_MESSAGES_PER_ROOM) {
      messages.shift();
    }

    // Persist to MongoDB for durability
    try {
      await Message.create({
        roomId,
        userId: socket.user.userId,
        username: socket.user.username,
        content: message.trim(),
        type
      });
    } catch (dbError) {
      logger.error(`Failed to persist chat message to MongoDB: ${dbError.message}`);
      // Don't fail the request - message already broadcasted
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
    const { roomId, limit = 50 } = data;
    
    if (!roomId) {
      throw new Error('Room ID is required');
    }

    // Try to get from memory cache first
    let cachedMessages = roomMessages.get(roomId) || [];
    
    // If cache is empty or has few messages, load from MongoDB
    if (cachedMessages.length < 10) {
      try {
        const dbMessages = await Message.find({ roomId })
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .lean();
        
        // Format messages from MongoDB
        const formattedMessages = dbMessages.map(msg => ({
          id: msg._id.toString(),
          roomId: msg.roomId.toString(),
          userId: msg.userId.toString(),
          username: msg.username,
          message: msg.content,
          type: msg.type,
          timestamp: msg.createdAt.toISOString()
        })).reverse();

        // Update cache with loaded messages
        roomMessages.set(roomId, formattedMessages.slice(-MAX_MESSAGES_PER_ROOM));
        cachedMessages = formattedMessages;
      } catch (dbError) {
        logger.error(`Failed to load chat history from MongoDB: ${dbError.message}`);
        // Fall back to cached messages
      }
    }
    
    if (typeof callback === 'function') {
      callback({
        success: true,
        data: { messages: cachedMessages },
        timestamp: new Date().toISOString()
      });
    }
  }));

  /**
   * Send system message to room
   * (Used internally by other handlers)
   */
  socket.sendSystemMessage = async (roomId, message) => {
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

    // Persist to MongoDB
    try {
      await Message.create({
        roomId,
        userId: null, // System messages have no user
        username: 'System',
        content: message,
        type: 'system'
      });
    } catch (dbError) {
      logger.error(`Failed to persist system message to MongoDB: ${dbError.message}`);
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

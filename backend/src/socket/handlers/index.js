/**
 * Socket Handlers Index
 * Central export point for all socket event handlers
 */

const { registerGameHandlers } = require('./game.handler.js');

/**
 * Register all socket handlers for a connection
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
const registerAllHandlers = (io, socket) => {
  // Register game handlers
  registerGameHandlers(io, socket);

  // Additional handlers can be registered here in the future
  // registerChatHandlers(io, socket);
  // registerLobbyHandlers(io, socket);
};

module.exports = {
  registerGameHandlers,
  registerAllHandlers
};

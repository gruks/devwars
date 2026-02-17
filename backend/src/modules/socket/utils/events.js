/**
 * Socket event constants
 * Uses domain:action naming for consistency
 */

const EVENTS = {
  // Lobby domain
  LOBBY: {
    JOIN: 'lobby:join',
    LEAVE: 'lobby:leave',
    ROOM_LIST: 'lobby:room_list',
    STATS: 'lobby:stats',
    USER_JOINED: 'lobby:user_joined',
    USER_LEFT: 'lobby:user_left'
  },

  // Room domain
  ROOM: {
    CREATE: 'room:create',
    CREATED: 'room:created',
    JOIN: 'room:join',
    LEAVE: 'room:leave',
    UPDATE: 'room:update',
    DELETE: 'room:delete',
    PLAYER_JOINED: 'room:player_joined',
    PLAYER_LEFT: 'room:player_left',
    PLAYER_READY: 'room:player_ready',
    CHAT_MESSAGE: 'room:chat_message'
  },

  // Match domain
  MATCH: {
    START: 'match:start',
    STARTED: 'match:started',
    END: 'match:end',
    ENDED: 'match:ended',
    STATE_UPDATE: 'match:state_update'
  },

  // Player domain
  PLAYER: {
    ONLINE: 'player:online',
    OFFLINE: 'player:offline',
    STATUS_CHANGE: 'player:status_change'
  },

  // System domain
  SYSTEM: {
    ERROR: 'system:error',
    CONNECTED: 'system:connected',
    DISCONNECTED: 'system:disconnected',
    PING: 'system:ping',
    PONG: 'system:pong'
  }
};

module.exports = { EVENTS };

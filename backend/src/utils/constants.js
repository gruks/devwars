/**
 * Application constants
 * Centralized location for all constant values
 */

/**
 * HTTP Status Codes
 */
const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
};

/**
 * Error Messages
 */
const ERROR_MESSAGES = {
  // Generic
  INTERNAL_ERROR: 'An internal server error occurred',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  BAD_REQUEST: 'Bad request',
  
  // Auth
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid token',
  USER_NOT_FOUND: 'User not found',
  EMAIL_EXISTS: 'Email already registered',
  USERNAME_EXISTS: 'Username already taken',
  
  // Game
  GAME_NOT_FOUND: 'Game not found',
  GAME_FULL: 'Game is full',
  GAME_ALREADY_STARTED: 'Game has already started',
  INVALID_MOVE: 'Invalid move',
  NOT_YOUR_TURN: 'Not your turn',
  
  // Validation
  VALIDATION_ERROR: 'Validation error',
  REQUIRED_FIELD: 'Required field missing',
  INVALID_FORMAT: 'Invalid format'
};

/**
 * Socket.IO Event Names
 */
const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  
  // Lobby
  LOBBY_JOIN: 'lobby:join',
  LOBBY_LEAVE: 'lobby:leave',
  LOBBY_UPDATE: 'lobby:update',
  LOBBY_LIST: 'lobby:list',
  
  // Room
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_UPDATE: 'room:update',
  ROOM_DELETE: 'room:delete',
  ROOM_LIST: 'room:list',
  
  // Game
  GAME_START: 'game:start',
  GAME_END: 'game:end',
  GAME_STATE_UPDATE: 'game:state:update',
  GAME_ACTION: 'game:action',
  GAME_ERROR: 'game:error',
  
  // Player
  PLAYER_JOIN: 'player:join',
  PLAYER_LEAVE: 'player:leave',
  PLAYER_READY: 'player:ready',
  PLAYER_ACTION: 'player:action',
  
  // Chat
  CHAT_MESSAGE: 'chat:message',
  CHAT_HISTORY: 'chat:history',
  
  // Matchmaking
  MATCHMAKING_JOIN: 'matchmaking:join',
  MATCHMAKING_LEAVE: 'matchmaking:leave',
  MATCH_FOUND: 'match:found'
};

/**
 * Game Constants
 */
const GAME_CONSTANTS = {
  // Player limits
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 2,
  
  // Timing (in seconds)
  ROUND_TIME: 60,
  TURN_TIME: 30,
  LOBBY_TIMEOUT: 300,
  
  // Scoring
  BASE_POINTS: 100,
  TIME_BONUS_MULTIPLIER: 10,
  STREAK_BONUS: 50,
  
  // Limits
  MAX_ROUNDS: 10,
  MAX_CHAT_HISTORY: 100,
  
  // Intervals (in ms)
  HEARTBEAT_INTERVAL: 30000,
  RECONNECT_TIMEOUT: 60000
};

/**
 * User Roles
 */
const USER_ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
  GUEST: 'guest'
};

/**
 * Game Status
 */
const GAME_STATUS = {
  WAITING: 'waiting',
  STARTING: 'starting',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  FINISHED: 'finished',
  CANCELLED: 'cancelled'
};

/**
 * Room Visibility
 */
const ROOM_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  FRIENDS_ONLY: 'friends_only'
};

module.exports = {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SOCKET_EVENTS,
  GAME_CONSTANTS,
  USER_ROLES,
  GAME_STATUS,
  ROOM_VISIBILITY
};

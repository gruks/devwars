/**
 * Match Service
 * Business logic for match lifecycle management
 */

const { Match } = require('./match.model.js');
const { Room } = require('../rooms/room.model.js');
const { Question } = require('../questions/question.model.js');
const { User } = require('../users/user.model.js');
const { evaluateSolution } = require('../evaluation/evaluation.controller.js');
const { AppError } = require('../../utils/helpers.js');
const { HTTP_STATUS } = require('../../utils/constants.js');
const { logger } = require('../../utils/logger.js');

/**
 * Create a new match
 * @param {Object} params - Match creation parameters
 * @param {string} params.roomId - Room ID
 * @param {string} params.questionId - Question ID
 * @param {number} [params.timerDuration=900] - Timer duration in seconds
 * @returns {Promise<Object>} Created match
 */
const createMatch = async ({ roomId, questionId, timerDuration = 900 }) => {
  logger.info({ roomId, questionId }, 'Creating new match');

  // Validate room exists and status is playing
  const room = await Room.findById(roomId);
  if (!room) {
    throw new AppError('Room not found', HTTP_STATUS.NOT_FOUND);
  }

  if (room.status !== 'playing') {
    throw new AppError('Room must be in playing status to create match', HTTP_STATUS.BAD_REQUEST);
  }

  // Validate question exists and mode is debug
  const question = await Question.findById(questionId);
  if (!question) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND);
  }

  if (question.mode !== 'debug') {
    throw new AppError('Question must be in debug mode', HTTP_STATUS.BAD_REQUEST);
  }

  // Create players array from room players
  const players = room.players.map(player => ({
    playerId: player.userId,
    username: player.username,
    score: 0
  }));

  if (players.length < 2) {
    throw new AppError('Need at least 2 players to create a match', HTTP_STATUS.BAD_REQUEST);
  }

  // Create match
  const match = await Match.create({
    roomId,
    questionId,
    timerDuration,
    players,
    submissions: [],
    status: 'waiting'
  });

  logger.info({ matchId: match._id }, 'Match created successfully');
  return match;
};

/**
 * Start a match
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} Updated match
 */
const startMatch = async (matchId) => {
  logger.info({ matchId }, 'Starting match');

  const match = await Match.findById(matchId);
  if (!match) {
    throw new AppError('Match not found', HTTP_STATUS.NOT_FOUND);
  }

  if (match.status !== 'waiting') {
    throw new AppError('Match can only be started from waiting status', HTTP_STATUS.BAD_REQUEST);
  }

  match.status = 'active';
  match.startTime = new Date();
  await match.save();

  logger.info({ matchId }, 'Match started successfully');
  return match;
};

/**
 * Submit code for a match
 * @param {string} matchId - Match ID
 * @param {string} playerId - Player ID
 * @param {string} code - Submitted code
 * @returns {Promise<Object>} Submission result
 */
const submitCode = async (matchId, playerId, code) => {
  logger.info({ matchId, playerId, codeLength: code?.length }, 'Processing code submission');

  const match = await Match.findById(matchId);
  if (!match) {
    throw new AppError('Match not found', HTTP_STATUS.NOT_FOUND);
  }

  if (match.status !== 'active') {
    throw new AppError('Match is not active', HTTP_STATUS.BAD_REQUEST);
  }

  // Get player info
  const player = match.getPlayer(playerId);
  if (!player) {
    throw new AppError('Player not in match', HTTP_STATUS.BAD_REQUEST);
  }

  // Get question for evaluation
  const question = await Question.findById(match.questionId);
  if (!question) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND);
  }

  // Evaluate the solution
  const evaluation = await evaluateSolution({
    questionId: question.id,
    code
  });

  // Check if player already has a submission
  const existingSubmission = match.getPlayerSubmission(playerId);
  const isFirstSubmission = !existingSubmission;
  const isFirstBlood = evaluation.score === 100 && !match.submissions.some(
    sub => sub.score === 100
  );

  // Prepare test results
  const testResults = evaluation.results.map(result => ({
    passed: result.passed,
    input: result.input,
    expected: result.expected,
    actual: result.actual
  }));

  // Create submission object
  const submission = {
    playerId,
    username: player.username,
    code,
    score: evaluation.score,
    testResults,
    submittedAt: new Date(),
    solvedAt: evaluation.score === 100 ? new Date() : null
  };

  // Update or add submission
  if (existingSubmission) {
    // Only update if new score is better
    if (evaluation.score > existingSubmission.score) {
      const submissionIndex = match.submissions.findIndex(
        sub => sub.playerId.toString() === playerId.toString()
      );
      match.submissions[submissionIndex] = submission;
    }
  } else {
    match.submissions.push(submission);
  }

  // Update player score
  const playerIndex = match.players.findIndex(
    p => p.playerId.toString() === playerId.toString()
  );
  if (playerIndex >= 0) {
    match.players[playerIndex].score = Math.max(
      match.players[playerIndex].score,
      evaluation.score
    );
    if (evaluation.score === 100 && !match.players[playerIndex].solvedAt) {
      match.players[playerIndex].solvedAt = new Date();
    }
  }

  await match.save();

  logger.info({
    matchId,
    playerId,
    score: evaluation.score,
    isFirstBlood
  }, 'Code submission processed');

  return {
    score: evaluation.score,
    passedTests: evaluation.passedTests,
    totalTests: evaluation.totalTests,
    isFirstSubmission,
    isFirstBlood,
    testResults
  };
};

/**
 * End a match and calculate final results
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} Final match results
 */
const endMatch = async (matchId) => {
  logger.info({ matchId }, 'Ending match');

  const match = await Match.findById(matchId);
  if (!match) {
    throw new AppError('Match not found', HTTP_STATUS.NOT_FOUND);
  }

  if (match.status === 'finished') {
    throw new AppError('Match is already finished', HTTP_STATUS.BAD_REQUEST);
  }

  // Update match status
  match.status = 'finished';
  match.endTime = new Date();
  
  // Calculate duration
  if (match.startTime) {
    match.duration = Math.floor((match.endTime - match.startTime) / 1000);
  }

  // Determine winner (highest score, earliest solve time if tied)
  let winner = null;
  let highestScore = -1;
  let earliestSolveTime = null;

  for (const player of match.players) {
    // Update user stats
    const user = await User.findById(player.playerId);
    if (user) {
      const won = player.score === 100;
      await user.updateStats(won);
    }

    // Determine winner
    if (player.score > highestScore) {
      highestScore = player.score;
      winner = player;
      earliestSolveTime = player.solvedAt;
    } else if (player.score === highestScore && player.solvedAt) {
      // Tie-breaker: earliest solve time
      if (!earliestSolveTime || player.solvedAt < earliestSolveTime) {
        winner = player;
        earliestSolveTime = player.solvedAt;
      }
    }
  }

  if (winner) {
    match.winner = {
      playerId: winner.playerId,
      username: winner.username
    };
  }

  await match.save();

  logger.info({ matchId, winner: match.winner }, 'Match ended successfully');

  return {
    matchId: match._id,
    status: match.status,
    duration: match.duration,
    winner: match.winner,
    players: match.players.map(p => ({
      playerId: p.playerId,
      username: p.username,
      score: p.score,
      solvedAt: p.solvedAt
    }))
  };
};

/**
 * Get match results sorted by score (desc), then solvedAt (asc)
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} Match with sorted results
 */
const getMatchResults = async (matchId) => {
  logger.info({ matchId }, 'Getting match results');

  const match = await Match.findById(matchId)
    .populate('roomId', 'name mode')
    .populate('questionId', 'title difficulty');

  if (!match) {
    throw new AppError('Match not found', HTTP_STATUS.NOT_FOUND);
  }

  // Sort players by score (desc), then solvedAt (asc)
  const sortedPlayers = [...match.players].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score; // Higher score first
    }
    // If scores tied, earlier solve time wins
    if (!a.solvedAt && !b.solvedAt) return 0;
    if (!a.solvedAt) return 1;
    if (!b.solvedAt) return -1;
    return a.solvedAt - b.solvedAt;
  });

  // Sort submissions by score (desc), then submittedAt (asc)
  const sortedSubmissions = [...match.submissions].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (!a.solvedAt && !b.solvedAt) return 0;
    if (!a.solvedAt) return 1;
    if (!b.solvedAt) return -1;
    return a.solvedAt - b.solvedAt;
  });

  return {
    matchId: match._id,
    room: match.roomId,
    question: match.questionId,
    status: match.status,
    startTime: match.startTime,
    endTime: match.endTime,
    duration: match.duration,
    winner: match.winner,
    players: sortedPlayers,
    submissions: sortedSubmissions,
    timerDuration: match.timerDuration
  };
};

/**
 * Get match by ID
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} Match
 */
const getMatchById = async (matchId) => {
  const match = await Match.findById(matchId)
    .populate('roomId', 'name mode status')
    .populate('questionId', 'title description difficulty starterCode');

  if (!match) {
    throw new AppError('Match not found', HTTP_STATUS.NOT_FOUND);
  }

  return match;
};

/**
 * Get active matches for a room
 * @param {string} roomId - Room ID
 * @returns {Promise<Array>} Active matches
 */
const getActiveMatchesByRoom = async (roomId) => {
  return Match.find({ roomId, status: { $in: ['waiting', 'active'] } });
};

module.exports = {
  createMatch,
  startMatch,
  submitCode,
  endMatch,
  getMatchResults,
  getMatchById,
  getActiveMatchesByRoom
};

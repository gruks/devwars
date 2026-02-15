/**
 * Room routes
 * Route definitions for lobby endpoints
 */

const express = require('express');
const roomController = require('./room.controller.js');
const { authenticate } = require('../auth/auth.middleware.js');

const router = express.Router();

/**
 * @route   GET /api/v1/lobby/rooms
 * @desc    Get all active rooms
 * @access  Public
 */
router.get('/rooms', roomController.getRooms);

/**
 * @route   POST /api/v1/lobby/rooms
 * @desc    Create a new room
 * @access  Private
 */
router.post('/rooms', authenticate, roomController.createRoom);

/**
 * @route   GET /api/v1/lobby/rooms/:identifier
 * @desc    Get room by ID or invite code
 * @access  Public
 */
router.get('/rooms/:identifier', roomController.getRoom);

/**
 * @route   POST /api/v1/lobby/rooms/:id/join
 * @desc    Join a room
 * @access  Private
 */
router.post('/rooms/:id/join', authenticate, roomController.joinRoom);

/**
 * @route   POST /api/v1/lobby/rooms/:id/leave
 * @desc    Leave a room
 * @access  Private
 */
router.post('/rooms/:id/leave', authenticate, roomController.leaveRoom);

/**
 * @route   POST /api/v1/lobby/rooms/:id/start-match
 * @desc    Start a full game match with question
 * @access  Private (Host only)
 */
router.post('/rooms/:id/start-match', authenticate, roomController.startGameMatch);

/**
 * @route   GET /api/v1/lobby/stats
 * @desc    Get lobby statistics
 * @access  Public
 */
router.get('/stats', roomController.getLobbyStats);

module.exports = router;

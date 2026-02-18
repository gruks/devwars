/**
 * ML Routes
 * API routes for ML prediction service
 */

const express = require('express');
const router = express.Router();
const mlController = require('./ml.controller');
const { authenticate } = require('../auth/auth.middleware');

// Health check endpoint (public for monitoring)
router.get('/health', mlController.getHealth);

// Predict winner endpoint (requires authentication)
router.post('/predict-winner', authenticate, mlController.predictWinner);

module.exports = router;

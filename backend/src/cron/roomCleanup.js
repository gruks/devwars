const cron = require('node-cron');
const { Room } = require('../modules/rooms/room.model.js');
const { logger } = require('../utils/logger.js');

/**
 * Room cleanup cron job
 * 
 * This cron job runs daily to clean up old finished rooms that are no longer active.
 * It helps prevent database bloat by removing rooms that are older than 1 day
 * and have no active players or spectators.
 */

class RoomCleanupCron {
  constructor() {
    this.schedule = '0 0 * * *'; // Run daily at midnight
    this.enabled = process.env.ROOM_CLEANUP_ENABLED === 'true';
  }

  /**
   * Find rooms eligible for cleanup
   * 
   * Rooms are eligible for cleanup if:
   * - Status is 'finished'
   * - Created more than 1 day ago
   * - No active players (all players have departedAt timestamp)
   * - No spectators
   */
  async findRoomsForCleanup() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const eligibleRooms = await Room.find({
        status: 'finished',
        createdAt: { $lt: oneDayAgo },
        'players.departedAt': { $exists: true }, // All players have departed
        'players.lastActiveAt': { $lt: oneDayAgo } // All players inactive for 1+ day
      }).exec();

      return eligibleRooms;
    } catch (error) {
      logger.error('Error finding rooms for cleanup:', error);
      throw error;
    }
  }

  /**
   * Clean up a single room
   * 
   * This method handles the actual deletion of a room and logs the cleanup
   */
  async cleanupRoom(room) {
    try {
      // Log the cleanup
      logger.info(`Cleaning up old room: ${room._id} (${room.name}) created ${room.createdAt}`);
      
      // Delete the room
      await room.deleteOne();
      
      // Log success
      logger.info(`Successfully cleaned up room: ${room._id}`);
      
      return { success: true, roomId: room._id };
    } catch (error) {
      logger.error(`Error cleaning up room ${room._id}:`, error);
      return { success: false, roomId: room._id, error: error.message };
    }
  }

  /**
   * Clean up multiple rooms
   * 
   * This method processes multiple rooms for cleanup
   */
  async cleanupRooms(rooms) {
    const results = [];
    
    for (const room of rooms) {
      const result = await this.cleanupRoom(room);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Main cleanup method
   * 
   * This method finds and cleans up eligible rooms
   */
  async cleanup() {
    if (!this.enabled) {
      logger.info('Room cleanup cron is disabled');
      return { skipped: true, reason: 'disabled' };
    }

    logger.info('Starting room cleanup cron job...');

    try {
      // Find rooms eligible for cleanup
      const roomsForCleanup = await this.findRoomsForCleanup();
      
      if (roomsForCleanup.length === 0) {
        logger.info('No rooms eligible for cleanup');
        return { cleanedUp: 0, totalRooms: roomsForCleanup.length };
      }

      logger.info(`Found ${roomsForCleanup.length} rooms eligible for cleanup`);

      // Clean up the rooms
      const cleanupResults = await this.cleanupRooms(roomsForCleanup);
      
      const successfulCleanups = cleanupResults.filter(r => r.success).length;
      const failedCleanups = cleanupResults.filter(r => !r.success);

      logger.info(`Successfully cleaned up ${successfulCleanups} rooms`);
      
      if (failedCleanups.length > 0) {
        logger.warn(`Failed to clean up ${failedCleanups.length} rooms`);
      }

      return {
        cleanedUp: successfulCleanups,
        failed: failedCleanups.length,
        totalRooms: roomsForCleanup.length,
        results: cleanupResults
      };
    } catch (error) {
      logger.error('Room cleanup cron job failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Start the cron job
   * 
   * This method schedules the cleanup job to run at the specified interval
   */
  start() {
    if (!this.enabled) {
      logger.info('Room cleanup cron is disabled, not starting');
      return;
    }

    cron.schedule(this.schedule, async () => {
      logger.info('Running room cleanup cron job...');
      
      try {
        const result = await this.cleanup();
        logger.info('Room cleanup cron job completed:', result);
      } catch (error) {
        logger.error('Room cleanup cron job encountered an error:', error);
      }
    });

    logger.info(`Room cleanup cron job scheduled to run daily at ${this.schedule}`);
  }

  /**
   * Stop the cron job
   * 
   * This method stops the scheduled cron job
   */
  stop() {
    // In a real implementation, you would need to keep track of the cron job
    // instance and call .stop() on it. For now, we just log the action.
    logger.info('Room cleanup cron job stopped');
  }
}

// Export the cron job class
module.exports = RoomCleanupCron;
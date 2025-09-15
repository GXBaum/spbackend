import {sendNotificationToUser} from './services/notifications.js';
import express from 'express';
import {CHANNEL_NAMES, EXPRESS_PORT} from './config/constants.js';
import {scheduleUpdates} from './services/scheduleUpdates.js';

import apiDevRoutes from './routes/api.dev.js';

import 'dotenv/config';

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use('/api/dev', apiDevRoutes);

/**
 * Starts the Express server with database initialization and scheduled tasks.
 */
async function startServer() {
  let server; // Declare server variable in outer scope for cleanup

  try {
    // Initialize the database


    // Start the Express server
    server = app.listen(EXPRESS_PORT, () => {
      console.log(`Server running on port ${EXPRESS_PORT}`);

      // Send test notification only if explicitly enabled
      if (process.env.SEND_STARTUP_NOTIFICATION === 'true') {
        const testUserId = 1;
        const testTitle = 'Server started';
        const testMessage = new Date().toISOString();
        sendNotificationToUser(testUserId, testTitle, testMessage, {"channel_id": CHANNEL_NAMES.CHANNEL_OTHER})
          .then(() => console.log('Test notification sent'))
          .catch((err) => console.error('Test notification error:', err));
      }

      // Schedule periodic updates with error handling
      try {
        const { job, vpJob } = scheduleUpdates();

        console.log('Update job scheduled:', job);
        console.log('VP job scheduled:', vpJob);

      } catch (scheduleError) {
        console.error('Failed to schedule updates:', scheduleError);
      }
    });

    // Handle server errors gracefully
    server.on('error', (err) => {
      console.error('Server error:', err);
      process.exit(1); // Consider more robust recovery in production
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown on SIGTERM
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...');

    if (process.env.SEND_STARTUP_NOTIFICATION === 'true') {
      const testUserId = 1;
      const testTitle = 'Server shutting down';
      const testMessage = new Date().toISOString();
      sendNotificationToUser(testUserId, testTitle, testMessage, {"channel_id": CHANNEL_NAMES.CHANNEL_OTHER})
          .then(() => console.log('Test notification sent'))
          .catch((err) => console.error('Test notification error:', err));
    }

    if (server) {
      server.close(() => {
        console.log('Server closed');
      });
    }
    try {
      console.log('Database connection closed');
    } catch (closeError) {
      console.error('Error closing database:', closeError);
    }
    process.exit(0);
  });
}

// Start the server
startServer();
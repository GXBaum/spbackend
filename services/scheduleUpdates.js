import schedule from "node-schedule";
import {updateAllSpUserData} from "./updateAllSpUserData.js";
import db from "../db/db.js";

export function scheduleUpdates() {
    // Configuration variables (could be moved to environment variables)
    const updateInterval = process.env.UPDATE_INTERVAL || '*/5 * * * *'; // Default: every 15 minutes
    const concurrentUpdates = parseInt(process.env.CONCURRENT_UPDATES || '3', 10);

    console.log(`Updates scheduled with pattern: ${updateInterval}, concurrent updates: ${concurrentUpdates}`);

    const job = schedule.scheduleJob(updateInterval, async () => {
        console.log('Running scheduled update job at', new Date().toISOString());

        try {
            // Get all users with notifications enabled in one db call
            await db.connect();
            const users = await db.getUsers();
            await db.close();
            const enabledUsers = users.filter(user => user.notifications_enabled === 1);

            console.log(`Users ${enabledUsers.length}; ${JSON.stringify(enabledUsers)}`);

            if (enabledUsers.length === 0) {
                console.log('No users with notifications enabled found');
                return;
            }

            console.log(`Processing updates for ${enabledUsers.length} users`);

            // Process users in batches to limit concurrent operations
            for (let i = 0; i < enabledUsers.length; i += concurrentUpdates) {
                const batch = enabledUsers.slice(i, i + concurrentUpdates);

                // Run batch updates concurrently
                await Promise.all(batch.map(async (user) => {
                    console.log(`Starting update for user: ${user.sp_username}`);
                    try {
                        await updateAllSpUserData(user.sp_username, user.sp_password, 6078);
                        console.log(`Update completed for user: ${user.sp_username}`);
                    } catch (error) {
                        console.error(`Update failed for user ${user.sp_username}:`, error.message);
                        // Could add notification to user about failed update
                    }
                }));
            }

            console.log('All user updates completed');
        } catch (error) {
            console.error('Scheduled update job failed:', error);
        }
    });

    // Add a method to the job to manually trigger an update
    job.runNow = async () => {
        console.log('Manually triggering update job');
        await job.invoke();
    };

    return job;
}
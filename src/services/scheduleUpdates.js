import schedule from "node-schedule";
import {updateAllSpUserData} from "./updateAllSpUserData.js";
import {vpCheckForDifferences} from "./vpCheckForDifferences.js";
import {createDefaultUserRepository} from "../db/repositories/userRepository.js";

function chunk(arr, size) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  if (size <= 0) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function scheduleUpdates({
  spCron = "*/5 * * * *",       // every 5 minutes
  vpCron = "*/5 * * * * *",     // every 5 seconds
  concurrentUpdates = parseInt(process.env.CONCURRENT_UPDATES || "3", 10),
  schoolId = 6078,
  userRepository = createDefaultUserRepository(),
  updater = updateAllSpUserData,
  vpDiffChecker = vpCheckForDifferences,
  scheduler = schedule
} = {}) {

  console.log(`[INIT] scheduleUpdates spCron=${spCron} vpCron=${vpCron} concurrency=${concurrentUpdates}`);

  const spJob = scheduler.scheduleJob(spCron, async () => {
    const started = Date.now();
    console.log(`[SP] Job start ${new Date().toISOString()}`);

    let users;
    try {
      users = userRepository.getUsersWithEnabledNotificationsAndSp();
    } catch (e) {
      console.error("[SP] Failed to load users:", e);
      return;
    }

    if (!users || users.length === 0) {
      console.log("[SP] No enabled users");
      return;
    }

    console.log(`[SP] Processing ${users.length} users`);

    for (const group of chunk(users, concurrentUpdates)) {
      await Promise.all(group.map(async (u) => {
        const username = u.sp_username;
        try {
          console.log(`[SP] Updating ${username}`);
          await updater(u.userId, schoolId);
          console.log(`[SP] Done ${username}`);
        } catch (err) {
          console.error(`[SP] Failed ${username}: ${err.message}`);
        }
      }));
    }

    console.log(`[SP] Job finished in ${Date.now() - started}ms`);
  });

  const vpJob = scheduler.scheduleJob(vpCron, async () => {
    const t0 = Date.now();
    console.log(`[VP] Diff check ${new Date().toISOString()}`);
    try {
      await vpDiffChecker(1);
      await vpDiffChecker(2);
    } catch (e) {
      console.error("[VP] Diff check failed:", e);
    } finally {
      console.log(`[VP] Done in ${Date.now() - t0}ms`);
    }
  });

  spJob.runNow = async () => {
    console.log("[SP] Manual trigger");
    await spJob.invoke();
  };

  vpJob.runNow = async () => {
    console.log("[VP] Manual trigger");
    await vpJob.invoke();
  };

  return {spJob, vpJob};
}

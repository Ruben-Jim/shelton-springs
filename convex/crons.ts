import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/** Hard-delete declined comments that have been in the removed bin for 30+ days. */
crons.daily(
  "purge declined comments",
  { hourUTC: 8, minuteUTC: 0 },
  internal.communityPosts.purgeDeclinedComments,
);

export default crons;

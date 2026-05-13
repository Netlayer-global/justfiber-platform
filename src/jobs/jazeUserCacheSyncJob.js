import { JazeUserCache } from "../models/JazeUserCache.js";
import { jazeClient } from "../integrations/jazeClient.js";

export async function runJazeUserCacheSync() {
  console.log("[jaze-user-cache] Starting sync...");
  try {
    const result = await jazeClient.getUsersByDate({
      fromDate: "2020-01-01",
      toDate: "2030-12-31",
      basedOn: "created"
    });
    const raw = result?.data || [];
    const users = raw.map(item => Array.isArray(item) ? item[0]?.User : item?.User).filter(Boolean);

    let synced = 0;
    for (const u of users) {
      if (!u.id) continue;
      await JazeUserCache.updateOne(
        { jazeUserId: String(u.id) },
        {
          $set: {
            jazeUserId: String(u.id),
            username: u.username || "",
            phone: (u.phone || "").replace(/\D/g, "").slice(-10),
            name: u.name || "",
            firstName: u.name?.split(/\s+/)[0] || "",
            lastName: u.name?.split(/\s+/).slice(1).join(" ") || "",
            email: u.email || "",
            groupId: u.groupId || "",
            groupName: u.userGroupName || u.groupName || "",
            status: u.status || "",
            activationTime: u.activationTime || "",
            expirationTime: u.expirationTime || "",
            address: u.address_line1 || "",
            city: u.address_city || "",
            syncedAt: new Date(),
          }
        },
        { upsert: true }
      );
      synced++;
    }
    console.log(`[jaze-user-cache] Synced ${synced} users`);
    return { synced, total: users.length };
  } catch (error) {
    console.error("[jaze-user-cache] Sync failed:", error.message);
    return { synced: 0, error: error.message };
  }
}

import { Customer } from "../models/Customer.js";
import { jazeClient } from "../integrations/jazeClient.js";

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapJazeStatus(userState) {
  const normalized = String(userState || "").toLowerCase().trim();
  if (normalized === "block" || normalized === "blocked") {
    return "suspended";
  }
  if (normalized === "active") {
    return "active";
  }
  return null;
}

function buildBillingUpdate(jazeMessage) {
  if (!jazeMessage) return null;
  const update = {};
  if (jazeMessage.balance !== undefined) {
    update.dueAmount = Number(jazeMessage.balance) || 0;
  }
  if (jazeMessage.lastPaymentDate) {
    update.lastPaymentDate = jazeMessage.lastPaymentDate;
  }
  if (jazeMessage.userGroupName) {
    update.currentPlanName = jazeMessage.userGroupName;
  }
  return Object.keys(update).length > 0 ? update : null;
}

export async function runJazeSyncJob() {
  console.log("[jaze-sync] Starting Jaze polling sync job...");
  const startTime = Date.now();

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    const customers = await Customer.find({
      jazeUserId: { $exists: true, $ne: null, $ne: "" }
    }).lean();

    console.log(`[jaze-sync] Found ${customers.length} customers with jazeUserId`);

    if (customers.length === 0) {
      console.log("[jaze-sync] No customers to sync. Done.");
      return { totalProcessed: 0, totalUpdated: 0, totalSkipped: 0, totalFailed: 0 };
    }

    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
      const batch = customers.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(customers.length / BATCH_SIZE);

      console.log(`[jaze-sync] Processing batch ${batchNumber}/${totalBatches} (${batch.length} customers)`);

      for (const customer of batch) {
        try {
          const response = await jazeClient.getSingleUserDetails(customer.jazeUserId);
          const jazeMessage = response?.message;

          if (!jazeMessage) {
            console.log(`[jaze-sync] No data returned for customer ${customer.customerId} (jazeUserId: ${customer.jazeUserId})`);
            totalSkipped++;
            totalProcessed++;
            continue;
          }

          const updates = {};
          let hasChanges = false;

          // Sync status
          const mappedStatus = mapJazeStatus(jazeMessage.userState);
          if (mappedStatus && mappedStatus !== customer.jazeStatus) {
            updates.jazeStatus = mappedStatus;
            updates.operationalStatus = mappedStatus;
            hasChanges = true;
          }

          // Sync billing snapshot
          const billingUpdate = buildBillingUpdate(jazeMessage);
          if (billingUpdate) {
            const currentSnapshot = customer.billingSnapshot || {};
            const snapshotChanged =
              currentSnapshot.dueAmount !== billingUpdate.dueAmount ||
              currentSnapshot.lastPaymentDate !== billingUpdate.lastPaymentDate ||
              currentSnapshot.currentPlanName !== billingUpdate.currentPlanName;

            if (snapshotChanged) {
              updates.billingSnapshot = {
                ...currentSnapshot,
                ...billingUpdate
              };
              hasChanges = true;
            }
          }

          // Sync expiry date if available
          if (jazeMessage.expiryDate) {
            const expiryDate = new Date(jazeMessage.expiryDate);
            if (!Number.isNaN(expiryDate.getTime())) {
              const currentExpiry = customer.expiryAt ? new Date(customer.expiryAt).toISOString() : null;
              if (currentExpiry !== expiryDate.toISOString()) {
                updates.expiryAt = expiryDate;
                hasChanges = true;
              }
            }
          }

          if (hasChanges) {
            updates.lastSyncedAt = new Date();
            await Customer.updateOne({ _id: customer._id }, { $set: updates });
            totalUpdated++;
          } else {
            await Customer.updateOne({ _id: customer._id }, { $set: { lastSyncedAt: new Date() } });
            totalSkipped++;
          }

          totalProcessed++;
        } catch (error) {
          console.error(`[jaze-sync] Failed to sync customer ${customer.customerId} (jazeUserId: ${customer.jazeUserId}):`, error.message);
          totalFailed++;
          totalProcessed++;
        }
      }

      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < customers.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }
  } catch (error) {
    console.error("[jaze-sync] Fatal error during sync job:", error.message);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[jaze-sync] Sync complete in ${duration}s — processed: ${totalProcessed}, updated: ${totalUpdated}, skipped: ${totalSkipped}, failed: ${totalFailed}`
  );

  return { totalProcessed, totalUpdated, totalSkipped, totalFailed, durationSeconds: Number(duration) };
}

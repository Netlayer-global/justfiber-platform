import { Worker } from "bullmq";
import { connectMongo } from "./db/mongoose.js";
import { getRedisConnection } from "./db/redis.js";
import { seedSystemData } from "./bootstrap/seedSystem.js";
import { AdminActionRequest } from "./models/AdminActionRequest.js";
import { Customer } from "./models/Customer.js";
import { DeviceOperationalCache } from "./models/DeviceOperationalCache.js";
import { InstallerJob } from "./models/InstallerJob.js";
import { InstallerNotification } from "./models/InstallerNotification.js";
import { jazeClient } from "./integrations/jazeClient.js";
import { genieacsClient } from "./integrations/genieacsClient.js";
import { writeAuditLog } from "./common/audit.js";

await connectMongo();
await seedSystemData();

const worker = new Worker(
  "admin-actions",
  async (job) => {
    if (job.name === "approved-action") {
      const request = await AdminActionRequest.findById(job.data.actionRequestId);
      if (!request) {
        throw new Error("Action request not found");
      }
      if (request.actionType === "apply_preset") {
        return processDevicePresetJob({
          actionRequestId: request._id.toString(),
          deviceId: request.targetId,
          presetName: request.payload.presetName
        });
      }
      throw new Error(`Unsupported approved action type: ${request.actionType}`);
    }

    switch (job.name) {
      case "customer-status-change": {
        const request = await AdminActionRequest.findById(job.data.actionRequestId);
        const customer = await Customer.findOne({ customerId: job.data.customerId });
        if (!request || !customer) {
          throw new Error("Customer action prerequisites missing");
        }
        if (job.data.actionType === "suspend") {
          await jazeClient.suspendService({
            serviceId: job.data.serviceId,
            reason: request.payload.reason,
            idempotencyKey: request._id.toString()
          });
          const device = await DeviceOperationalCache.findOne({ customerId: job.data.customerId });
          if (device) {
            await genieacsClient.applyPreset({
              deviceId: device.deviceId,
              presetName: "SERVICE_SUSPEND",
              correlationId: request._id.toString()
            });
          }
          customer.operationalStatus = "suspended";
        } else {
          await jazeClient.resumeService({
            serviceId: job.data.serviceId,
            reason: request.payload.reason,
            idempotencyKey: request._id.toString()
          });
          const device = await DeviceOperationalCache.findOne({ customerId: job.data.customerId });
          if (device) {
            await genieacsClient.applyPreset({
              deviceId: device.deviceId,
              presetName: "SERVICE_RESUME",
              correlationId: request._id.toString()
            });
          }
          customer.operationalStatus = "active";
        }
        await customer.save();
        request.status = "executed";
        request.lastError = undefined;
        await request.save();
        await writeAuditLog({
          actorType: "system",
          actorId: "worker",
          actorName: "admin-actions-worker",
          action: `customer.${job.data.actionType}.executed`,
          entityType: "customer",
          entityId: customer.customerId,
          metadata: { actionRequestId: request._id.toString() }
        });
        break;
      }
      case "installer-activation": {
        const jobRecord = await InstallerJob.findById(job.data.installerJobId);
        if (!jobRecord) {
          throw new Error("Installer job not found");
        }
        await jazeClient.createPppoeUser({
          customerId: jobRecord.customerId,
          serviceId: jobRecord.serviceId,
          planCode: jobRecord.customerSnapshot?.planCode || jobRecord.customerSnapshot?.planName,
          username: `${jobRecord.customerId}`.toLowerCase(),
          password: `jf-${jobRecord.customerId}`.toLowerCase()
        });
        await genieacsClient.applyPreset({
          deviceId: jobRecord.deviceContext?.finalDeviceId || `ONT-${job.data.finalSerialNumber}`,
          presetName: "SERVICE_ACTIVATE",
          correlationId: jobRecord._id.toString()
        });
        jobRecord.status = "active";
        jobRecord.activation = {
          ...(jobRecord.activation || {}),
          configStatus: "pushed",
          internetVerifiedAt: new Date(),
          smsSentAt: new Date(),
          notificationSentAt: new Date()
        };
        jobRecord.timeline.push({
          event: "job.activation_completed",
          actorType: "system",
          actorId: "worker",
          note: "Provisioning completed and welcome notification dispatched",
          at: new Date()
        });
        await jobRecord.save();
        await InstallerNotification.create({
          installerId: jobRecord.installerId,
          type: "activation_success",
          title: "Activation complete",
          body: `${jobRecord.jobNumber} is live now.`,
          payload: { installerJobId: jobRecord._id }
        });
        await writeAuditLog({
          actorType: "system",
          actorId: "worker",
          actorName: "admin-actions-worker",
          action: "installer.activation.executed",
          entityType: "installer_job",
          entityId: jobRecord._id.toString(),
          metadata: { installerJobId: jobRecord._id.toString() }
        });
        break;
      }
      case "retry-provisioning":
      case "device-apply-preset":
        return processDevicePresetJob(job.data);
      default:
        throw new Error(`Unsupported job type: ${job.name}`);
    }
  },
  {
    connection: getRedisConnection()
  }
);

async function processDevicePresetJob(data) {
  const request = await AdminActionRequest.findById(data.actionRequestId);
  const device =
    (data.deviceId && (await DeviceOperationalCache.findOne({ deviceId: data.deviceId }))) ||
    (await DeviceOperationalCache.findOne({ customerId: data.customerId }));
  if (!request || !device) {
    throw new Error("Provisioning action prerequisites missing");
  }
  await genieacsClient.applyPreset({
    deviceId: device.deviceId,
    presetName: data.presetName,
    correlationId: request._id.toString()
  });
  device.provisioningState = data.presetName;
  await device.save();
  request.status = "executed";
  request.lastError = undefined;
  await request.save();
  await writeAuditLog({
    actorType: "system",
    actorId: "worker",
    actorName: "admin-actions-worker",
    action: "device.preset.executed",
    entityType: "device",
    entityId: device.deviceId,
    metadata: { presetName: data.presetName, actionRequestId: request._id.toString() }
  });
}

worker.on("failed", async (job, error) => {
  if (job?.data?.actionRequestId) {
    await AdminActionRequest.findByIdAndUpdate(job.data.actionRequestId, {
      $set: {
        status: "failed",
        lastError: error.message
      }
    });
  }
});

console.log("Admin worker started");

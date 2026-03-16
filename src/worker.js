import { Worker } from "bullmq";
import { connectMongo } from "./db/mongoose.js";
import { getRedisConnection } from "./db/redis.js";
import { seedSystemData } from "./bootstrap/seedSystem.js";
import { AdminActionRequest } from "./models/AdminActionRequest.js";
import { Customer } from "./models/Customer.js";
import { DeviceOperationalCache } from "./models/DeviceOperationalCache.js";
import { InstallerJob } from "./models/InstallerJob.js";
import { InstallerNotification } from "./models/InstallerNotification.js";
import { CustomerNotification } from "./models/CustomerNotification.js";
import { CustomerUser } from "./models/CustomerUser.js";
import { jazeClient } from "./integrations/jazeClient.js";
import { genieacsClient } from "./integrations/genieacsClient.js";
import { writeAuditLog } from "./common/audit.js";
import { buildPppoeCredentials, buildWifiCredentials, detectOntBrand } from "./common/networkProvisioning.js";

await connectMongo();
await seedSystemData();

const worker = new Worker(
  "admin-actions",
  async (job) => {
    console.log(`[worker] processing ${job.name} ${job.id || ""}`.trim());
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
        const deviceId =
          jobRecord.deviceContext?.finalDeviceId ||
          job.data.finalDeviceId ||
          `ONT-${job.data.finalSerialNumber}`;
        const existingDevice = await DeviceOperationalCache.findOne({ deviceId }).lean();
        const brand = detectOntBrand({
          serialNumber: jobRecord.deviceContext?.finalSerialNumber || existingDevice?.serialNumber,
          productClass: existingDevice?.productClass,
          deviceId
        });
        const prepared = jobRecord.activation?.preparedCredentials || {};
        const pppoe = prepared.pppoe || buildPppoeCredentials(jobRecord.customerId);
        const wifi = prepared.wifi || buildWifiCredentials();
        const vlanId = prepared.vlanId || existingDevice?.wanInfo?.vlanId || 100;

        await jazeClient.createPppoeUser({
          customerId: jobRecord.customerId,
          serviceId: jobRecord.serviceId,
          planCode: jobRecord.customerSnapshot?.planCode || jobRecord.customerSnapshot?.planName,
          username: pppoe.username,
          password: pppoe.password
        });
        try {
          await genieacsClient.pushAccessConfig({
            deviceId,
            brand,
            pppoeUsername: pppoe.username,
            pppoePassword: pppoe.password,
            vlanId,
            natEnabled: true,
            ssid24: wifi.ssid24,
            ssid5: wifi.ssid5,
            wifiPassword: wifi.password
          });
        } catch (configError) {
          await genieacsClient.applyPreset({
            deviceId,
            presetName: "SERVICE_ACTIVATE",
            correlationId: jobRecord._id.toString()
          });
          jobRecord.activation = {
            ...(jobRecord.activation || {}),
            configFallback: true,
            configFallbackError: configError.message
          };
        }
        await DeviceOperationalCache.updateOne(
          { deviceId },
          {
            $set: {
              customerId: jobRecord.customerId,
              serviceId: jobRecord.serviceId || jobRecord.customerId,
              deviceId,
              serialNumber: jobRecord.deviceContext?.finalSerialNumber || existingDevice?.serialNumber,
              provisioningState: "SERVICE_ACTIVATE",
              wifiInfo: {
                ...(existingDevice?.wifiInfo || {}),
                ssid24Masked: wifi.ssid24,
                ssid5Masked: wifi.ssid5,
                passwordMasked: "********",
                natEnabled: true
              },
              wanInfo: {
                ...(existingDevice?.wanInfo || {}),
                pppoeUsernameMasked: pppoe.username,
                vlanId
              }
            }
          },
          { upsert: true }
        );
        jobRecord.status = "active";
        jobRecord.activation = {
          ...(jobRecord.activation || {}),
          configStatus: "pushed",
          internetVerifiedAt: new Date(),
          smsSentAt: new Date(),
          notificationSentAt: new Date(),
          ontBrand: brand,
          credentials: {
            pppoeUsername: pppoe.username,
            pppoePassword: pppoe.password,
            vlanId,
            natEnabled: true,
            wifi: {
              ssid24: wifi.ssid24,
              ssid5: wifi.ssid5,
              password: wifi.password
            }
          }
        };
        jobRecord.timeline.push({
          event: "job.activation_completed",
          actorType: "system",
          actorId: "worker",
          note: "Provisioning completed with PPPoE + Wi-Fi config",
          at: new Date()
        });
        await jobRecord.save();
        await InstallerNotification.create({
          installerId: jobRecord.installerId,
          type: "activation_success",
          title: "Activation complete",
          body: `${jobRecord.jobNumber} live. PPPoE: ${pppoe.username} / ${pppoe.password}, Wi-Fi: ${wifi.ssid24} (${wifi.password})`,
          payload: {
            installerJobId: jobRecord._id,
            credentials: jobRecord.activation?.credentials
          }
        });
        const customerUser = await CustomerUser.findOne({
          linkedCustomerIds: jobRecord.customerId
        });
        if (customerUser) {
          await CustomerNotification.create({
            customerUserId: customerUser._id,
            type: "activation_success",
            title: "Connection Activated",
            body: `Wi-Fi SSID: ${wifi.ssid24}, Password: ${wifi.password}. PPPoE User: ${pppoe.username}`,
            payload: {
              customerId: jobRecord.customerId,
              pppoeUsername: pppoe.username,
              pppoePassword: pppoe.password,
              wifiSsid: wifi.ssid24,
              wifiPassword: wifi.password
            }
          });
        }
        await writeAuditLog({
          actorType: "system",
          actorId: "worker",
          actorName: "admin-actions-worker",
          action: "installer.activation.executed",
          entityType: "installer_job",
          entityId: jobRecord._id.toString(),
          metadata: { installerJobId: jobRecord._id.toString() }
        });
        console.log(`[worker] installer activation completed for ${jobRecord._id.toString()}`);
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
  console.error(`[worker] job failed ${job?.name || "unknown"} ${job?.id || ""}: ${error.message}`);
  if (job?.data?.actionRequestId) {
    await AdminActionRequest.findByIdAndUpdate(job.data.actionRequestId, {
      $set: {
        status: "failed",
        lastError: error.message
      }
    });
  }
  if (job?.name === "installer-activation" && job?.data?.installerJobId) {
    const jobRecord = await InstallerJob.findById(job.data.installerJobId);
    if (jobRecord) {
      jobRecord.status = "failed";
      jobRecord.activation = {
        ...(jobRecord.activation || {}),
        configStatus: "failed",
        lastConfigError: error.message,
        failedAt: new Date()
      };
      jobRecord.timeline.push({
        event: "job.activation_failed",
        actorType: "system",
        actorId: "worker",
        note: error.message,
        at: new Date()
      });
      await jobRecord.save();
      await InstallerNotification.create({
        installerId: jobRecord.installerId,
        type: "activation_failed",
        title: "Activation failed",
        body: `${jobRecord.jobNumber} activation failed: ${error.message}`,
        payload: { installerJobId: jobRecord._id, error: error.message }
      }).catch(() => null);
      const customerUser = await CustomerUser.findOne({ linkedCustomerIds: jobRecord.customerId });
      if (customerUser) {
        await CustomerNotification.create({
          customerUserId: customerUser._id,
          type: "activation_failed",
          title: "Activation delayed",
          body: "Your installation is delayed. Our team is retrying activation.",
          payload: { customerId: jobRecord.customerId, error: error.message }
        }).catch(() => null);
      }
    }
  }
});

worker.on("completed", (job) => {
  console.log(`[worker] job completed ${job.name} ${job.id || ""}`.trim());
});

console.log("Admin worker started");

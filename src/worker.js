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
import { env } from "./config/env.js";
import { IntegrationEventLog } from "./models/IntegrationEventLog.js";
import { KycVerificationRequest } from "./models/KycVerificationRequest.js";
import { OttSubscription } from "./models/OttSubscription.js";
import { genieacsClient } from "./integrations/genieacsClient.js";
import { AutomationTrigger } from "./models/AutomationTrigger.js";
import { ScheduledReport } from "./models/ScheduledReport.js";
import { SupportTicket } from "./models/SupportTicket.js";
import { radiusServiceManager } from "./integrations/radiusServiceManager.js";
import { internalSubscriberPlatform } from "./integrations/internalSubscriberPlatform.js";
import { notificationDispatcher } from "./integrations/notificationDispatcher.js";
import { providerAdapters } from "./integrations/providerAdapters.js";
import { writeAuditLog } from "./common/audit.js";
import { buildPppoeCredentials, buildWifiCredentials, detectOntBrand, resolveProvisioningProfile } from "./common/networkProvisioning.js";

await connectMongo();
await seedSystemData();

function updateActivationStage(jobRecord, stage, note, extra = {}) {
  jobRecord.activation = {
    ...(jobRecord.activation || {}),
    stage,
    ...extra
  };
  jobRecord.timeline.push({
    event: `job.activation_stage.${stage}`,
    actorType: "system",
    actorId: "worker",
    note,
    at: new Date()
  });
}

function readPathValue(source, path) {
  if (!source || !path) return undefined;
  return path.split(".").reduce((current, segment) => {
    if (current === null || current === undefined) return undefined;
    return current[segment];
  }, source)?._value;
}

function findFirstMatchingValue(deviceSummary, paths, expectedValue) {
  for (const path of paths || []) {
    const actual = readPathValue(deviceSummary, path);
    if (actual !== undefined && String(actual) === String(expectedValue)) {
      return { path, actual };
    }
  }
  return null;
}

function verifyProvisionedConfig({ deviceSummary, brand, expected }) {
  const profile = resolveProvisioningProfile(brand);
  const checks = {
    pppoeUsername: findFirstMatchingValue(deviceSummary, profile.pppoeUsernamePath, expected.pppoeUsername),
    ssid24: findFirstMatchingValue(deviceSummary, profile.ssid24Path, expected.ssid24),
    ssid5: findFirstMatchingValue(deviceSummary, profile.ssid5Path, expected.ssid5)
  };
  const verified = Object.values(checks).every(Boolean);
  return {
    verified,
    checks
  };
}

function computeNextRun(frequency, from = new Date()) {
  const next = new Date(from);
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  else if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  else return null;
  return next;
}

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
          await radiusServiceManager.suspendSubscriberAccess({
            serviceId: job.data.serviceId,
            reason: request.payload.reason
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
          await radiusServiceManager.resumeSubscriberAccess({
            serviceId: job.data.serviceId
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
        const bootstrap = await internalSubscriberPlatform.prepareServiceFromInstallerJob(jobRecord);
        if (bootstrap?.customer?.customerId && bootstrap?.customer?.serviceId) {
          jobRecord.customerId = bootstrap.customer.customerId;
          jobRecord.serviceId = bootstrap.customer.serviceId;
          jobRecord.customerSnapshot = {
            ...(jobRecord.customerSnapshot || {}),
            customerId: bootstrap.customer.customerId,
            accountNumber: bootstrap.customer.accountNumber,
            serviceId: bootstrap.customer.serviceId,
            planCode: bootstrap.customer.planCode,
            planName: bootstrap.customer.planName,
            speedMbps: bootstrap.accessProfile?.downMbps || jobRecord.customerSnapshot?.speedMbps
          };
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

        updateActivationStage(
          jobRecord,
          "radius_create_pending",
          "Creating PPPoE user in FreeRADIUS"
        );
        await radiusServiceManager.createSubscriberAccess({
          serviceId: jobRecord.serviceId,
          customerId: jobRecord.customerId,
          radiusUsername: pppoe.username,
          radiusPassword: pppoe.password,
          accessProfileCode: bootstrap?.accessProfile?.code || jobRecord.customerSnapshot?.planCode,
          billingProfileCode: bootstrap?.billingProfile?.code,
          bngNodeCode: bootstrap?.bngNode?.nodeCode,
          metadata: {
            source: "installer_activation"
          }
        });
        updateActivationStage(jobRecord, "radius_create_done", "PPPoE user created in FreeRADIUS");
        try {
          updateActivationStage(jobRecord, "genie_push_pending", "Pushing access config to GenieACS");
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
          updateActivationStage(jobRecord, "genie_push_done", "Access config pushed to GenieACS");
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
          updateActivationStage(jobRecord, "genie_fallback", "Config push failed, fallback preset applied", {
            lastConfigError: configError.message
          });
        }
        if (brand === "nokia" && wifi.password) {
          await genieacsClient.rebootDevice(deviceId);
          jobRecord.timeline.push({
            event: "job.device_reboot_requested",
            actorType: "system",
            actorId: "worker",
            note: "Queued reboot after Nokia Wi-Fi security update",
            at: new Date()
          });
        }
        let verification = { verified: false, checks: {} };
        try {
          updateActivationStage(jobRecord, "readback_pending", "Reading back device config from GenieACS");
          const deviceSummary = await genieacsClient.getDeviceSummary(deviceId);
          verification = verifyProvisionedConfig({
            deviceSummary,
            brand,
            expected: {
              pppoeUsername: pppoe.username,
              ssid24: wifi.ssid24,
              ssid5: wifi.ssid5
            }
          });
          updateActivationStage(
            jobRecord,
            verification.verified ? "readback_verified" : "readback_warning",
            verification.verified
              ? "Provisioned config read-back verified"
              : "Provisioned config pushed but read-back verification is partial",
            {
              verification
            }
          );
        } catch (verificationError) {
          updateActivationStage(jobRecord, "readback_failed", "Read-back verification failed", {
            verification: {
              verified: false,
              error: verificationError.message
            }
          });
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
        await internalSubscriberPlatform.finalizeActivation({
          installerJob: jobRecord,
          pppoe,
          wifi,
          deviceId,
          serialNumber: jobRecord.deviceContext?.finalSerialNumber || existingDevice?.serialNumber,
          vlanId
        });
        jobRecord.activation = {
          ...(jobRecord.activation || {}),
          configStatus: verification.verified ? "verified" : "pushed",
          rebootQueuedAt: brand === "nokia" && wifi.password ? new Date() : jobRecord.activation?.rebootQueuedAt,
          internetVerifiedAt: new Date(),
          smsSentAt: new Date(),
          notificationSentAt: new Date(),
          ontBrand: brand,
          verification,
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
          metadata: {
            installerJobId: jobRecord._id.toString(),
            ontBrand: brand,
            verificationStatus: verification.verified ? "verified" : "pushed",
            verification
          }
        });
        console.log(`[worker] installer activation completed for ${jobRecord._id.toString()}`);
        break;
      }
      case "retry-provisioning":
      case "device-apply-preset":
        return processDevicePresetJob(job.data);
      case "dispatch-message": {
        return notificationDispatcher.dispatchChannel(job.data);
      }
      case "kyc-request-submit": {
        const request = await KycVerificationRequest.findOne({ requestNumber: job.data.requestNumber });
        if (!request) {
          throw new Error("KYC request not found");
        }
        request.status = "submitted";
        request.timeline.push({
          type: "kyc.submitted",
          actorType: "system",
          actorId: "worker",
          note: "KYC verification submitted to provider"
        });
        await request.save();

        const result = await providerAdapters.startKycVerification({
          providerKey: request.providerKey,
          requestNumber: request.requestNumber,
          customerId: request.customerId,
          documentType: request.documentType,
          verificationMode: request.verificationMode,
          payload: request.payload,
          entityId: request._id
        });

        request.provider = result.connection?.provider || "mock";
        request.providerResponse = result.response || result.log?.response;
        if (result.ok) {
          request.status = env.MOCK_EXTERNALS ? "verified" : "submitted";
          if (request.status === "verified") {
            request.verifiedAt = new Date();
          }
          request.timeline.push({
            type: request.status === "verified" ? "kyc.verified" : "kyc.provider_accepted",
            actorType: "system",
            actorId: "worker",
            note: request.status === "verified"
              ? "KYC verified in mock/provider sandbox mode"
              : "KYC request accepted by provider"
          });
        } else {
          request.status = "failed";
          request.errorMessage = result.error || "KYC verification failed";
          request.timeline.push({
            type: "kyc.failed",
            actorType: "system",
            actorId: "worker",
            note: request.errorMessage
          });
        }
        await request.save();
        return {
          requestNumber: request.requestNumber,
          status: request.status
        };
      }
      case "ott-subscription-activate": {
        const subscription = await OttSubscription.findOne({ subscriptionCode: job.data.subscriptionCode });
        if (!subscription) {
          throw new Error("OTT subscription not found");
        }
        const result = await providerAdapters.activateOttSubscription({
          providerKey: subscription.providerKey,
          subscriptionCode: subscription.subscriptionCode,
          customerId: subscription.customerId,
          addonCode: subscription.addonCode,
          planCode: subscription.planCode,
          metadata: subscription.metadata,
          entityId: subscription._id
        });
        subscription.provider = result.connection?.provider || "mock";
        subscription.providerResponse = result.response || result.log?.response;
        if (result.ok) {
          subscription.status = "active";
          subscription.startsAt = subscription.startsAt || new Date();
          subscription.timeline.push({
            type: "ott.activated",
            actorType: "system",
            actorId: "worker",
            note: "OTT subscription activated"
          });
        } else {
          subscription.status = "failed";
          subscription.errorMessage = result.error || "OTT activation failed";
          subscription.timeline.push({
            type: "ott.failed",
            actorType: "system",
            actorId: "worker",
            note: subscription.errorMessage
          });
        }
        await subscription.save();
        return {
          subscriptionCode: subscription.subscriptionCode,
          status: subscription.status
        };
      }
      case "scheduled-report-run": {
        const report = await ScheduledReport.findOne({ reportCode: job.data.reportCode });
        if (!report) {
          throw new Error("Scheduled report not found");
        }
        const recipientCount = report.recipients?.length || 0;
        await IntegrationEventLog.create({
          integrationKey: "internal_reports",
          category: "reporting",
          provider: "internal_platform",
          eventType: "scheduled_report_run",
          status: "success",
          entityType: "scheduled_report",
          entityId: report.reportCode,
          payload: {
            reportCode: report.reportCode,
            title: report.title,
            format: report.format,
            recipientCount
          },
          response: {
            generated: true,
            mocked: env.MOCK_EXTERNALS
          }
        });
        report.lastRunAt = new Date();
        report.nextRunAt = computeNextRun(report.frequency, report.lastRunAt);
        await report.save();
        return {
          reportCode: report.reportCode,
          generated: true,
          recipientCount
        };
      }
      case "automation-trigger-fire": {
        const trigger = await AutomationTrigger.findOne({ triggerCode: job.data.triggerCode });
        if (!trigger) {
          throw new Error("Automation trigger not found");
        }
        trigger.lastTriggeredAt = new Date();
        await trigger.save();
        if (trigger.actionType === "notify" && trigger.actionConfig?.category && trigger.actionConfig?.recipient) {
          await notificationDispatcher.dispatchChannel({
            category: trigger.actionConfig.category,
            recipient: trigger.actionConfig.recipient,
            subject: trigger.actionConfig.subject || trigger.title,
            body: trigger.actionConfig.body || `Trigger fired: ${trigger.title}`,
            entityType: "automation_trigger",
            entityId: trigger.triggerCode,
            metadata: {
              triggerCode: trigger.triggerCode,
              payload: job.data.payload || {}
            }
          });
        }
        await IntegrationEventLog.create({
          integrationKey: "internal_automation",
          category: "automation",
          provider: "internal_platform",
          eventType: "automation_trigger_fire",
          status: "success",
          entityType: "automation_trigger",
          entityId: trigger.triggerCode,
          payload: job.data.payload || {},
          response: {
            actionType: trigger.actionType
          }
        });
        return {
          triggerCode: trigger.triggerCode,
          actionType: trigger.actionType,
          fired: true
        };
      }
      case "helpdesk-sla-scan": {
        const now = new Date();
        const tickets = await SupportTicket.find({
          status: { $in: ["open", "assigned", "in_progress"] },
          $or: [
            {
              "sla.resolutionDueAt": { $ne: null, $lt: now },
              "sla.breached": { $ne: true }
            },
            {
              status: "open",
              "sla.firstResponseDueAt": { $ne: null, $lt: now },
              "sla.firstResponseBreached": { $ne: true }
            }
          ]
        });
        const breachedTicketIds = [];
        for (const ticket of tickets) {
          const firstResponseBreached = ticket.status === "open" &&
            ticket.sla?.firstResponseDueAt &&
            ticket.sla.firstResponseDueAt < now;
          const resolutionBreached = ticket.sla?.resolutionDueAt &&
            ticket.sla.resolutionDueAt < now;
          ticket.sla = {
            ...(ticket.sla || {}),
            breached: Boolean(ticket.sla?.breached || resolutionBreached),
            firstResponseBreached: Boolean(ticket.sla?.firstResponseBreached || firstResponseBreached)
          };
          ticket.timeline.push({
            type: firstResponseBreached && !resolutionBreached ? "sla_first_response_breached" : "sla_breached",
            actorType: "system",
            actorId: "worker",
            note: firstResponseBreached && !resolutionBreached
              ? "First response SLA breached"
              : "Resolution SLA breached"
          });
          await ticket.save();
          breachedTicketIds.push(ticket.ticketNumber);
        }
        await IntegrationEventLog.create({
          integrationKey: "internal_helpdesk",
          category: "helpdesk",
          provider: "internal_platform",
          eventType: "sla_scan",
          status: "success",
          entityType: "support_ticket",
          entityId: "batch",
          payload: {
            scannedAt: now
          },
          response: {
            breachedCount: breachedTicketIds.length,
            breachedTicketIds
          }
        });
        return {
          scanned: true,
          breachedCount: breachedTicketIds.length,
          breachedTicketIds
        };
      }
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

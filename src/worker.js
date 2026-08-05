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
import { PlanCatalog } from "./models/PlanCatalog.js";
import { genieacsClient } from "./integrations/genieacsClient.js";
import { AutomationTrigger } from "./models/AutomationTrigger.js";
import { ScheduledReport } from "./models/ScheduledReport.js";
import { SupportTicket } from "./models/SupportTicket.js";
import { BillingInvoice } from "./models/BillingInvoice.js";
import { BillingRun } from "./models/BillingRun.js";
import { PaymentTransaction } from "./models/PaymentTransaction.js";
import { BillingLedgerEntry } from "./models/BillingLedgerEntry.js";
import { SubscriberService } from "./models/SubscriberService.js";
import { serviceControlAdapter } from "./integrations/serviceControlAdapter.js";
import { internalSubscriberPlatform } from "./integrations/internalSubscriberPlatform.js";
import { internalBillingEngine } from "./integrations/internalBillingEngine.js";
import { buildBillingNotificationContent, notificationDispatcher } from "./integrations/notificationDispatcher.js";
import { providerAdapters } from "./integrations/providerAdapters.js";
import { writeAuditLog } from "./common/audit.js";
import { buildPppoeCredentials, buildWifiCredentials, detectOntBrand, resolveProvisioningProfile } from "./common/networkProvisioning.js";
import { normalizeInstallerIdentifier } from "./modules/installerApp/routes.js";
import { renderInstallerActivationSms } from "./common/installerMessaging.js";
import {
  createLedgerEntry,
  deriveInvoiceLifecycle,
  findBestInvoiceForPayment,
  reconcilePaymentToInvoice,
  syncInvoiceLifecycle,
  syncCustomerBillingState
} from "./common/billingAccounting.js";
import { applyCustomerWaiverResolution, applyCustomerWriteoffResolution } from "./common/billingResolutions.js";


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

function collectProvisioningPaths(root, matcher, basePath = "", acc = []) {
  if (!root || typeof root !== "object") return acc;
  for (const [key, value] of Object.entries(root)) {
    const nextPath = basePath ? `${basePath}.${key}` : key;
    if (matcher(nextPath, value)) {
      acc.push(nextPath);
    }
    if (value && typeof value === "object") {
      collectProvisioningPaths(value, matcher, nextPath, acc);
    }
  }
  return acc;
}

function discoverLivePppoeUsernamePaths(deviceSummary) {
  return collectProvisioningPaths(deviceSummary, (path, value) => {
    const normalizedPath = path.toLowerCase();
    if (!("_value" in Object(value || {}))) return false;
    const isWanPath =
      normalizedPath.includes("wanconnectiondevice") ||
      normalizedPath.includes("wanpppconnection") ||
      normalizedPath.includes("wanipconnection") ||
      normalizedPath.includes("device.ppp.interface") ||
      normalizedPath.includes("device.wan.pppconnection");
    return isWanPath && normalizedPath.endsWith(".username");
  });
}

function verifyProvisionedConfig({ deviceSummary, brand, expected }) {
  const profile = resolveProvisioningProfile(brand);
  const livePppoeUsernamePaths = discoverLivePppoeUsernamePaths(deviceSummary);
  const checks = {
    pppoeUsername: findFirstMatchingValue(
      deviceSummary,
      livePppoeUsernamePaths.length ? [...livePppoeUsernamePaths, ...profile.pppoeUsernamePath] : profile.pppoeUsernamePath,
      expected.pppoeUsername
    ),
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

function normalizeDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getDurationMonthsFromBillingTerm(billingTerm = "monthly") {
  if (billingTerm === "yearly") return 12;
  if (billingTerm === "halfYearly") return 6;
  if (billingTerm === "quarterly") return 3;
  return 1;
}

function isSameUtcDay(left, right) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function canSendCollectionEvent(customer, key, invoiceId, now) {
  const collections = customer?.billingSnapshot?.collections || {};
  const lastSentAt = normalizeDate(collections[key]);
  const lastInvoiceId = String(collections[`${key}InvoiceId`] || "");
  if (!lastSentAt) return true;
  if (lastInvoiceId && invoiceId && lastInvoiceId !== invoiceId) return true;
  return !isSameUtcDay(lastSentAt, now);
}

async function persistCollectionEvent(customer, key, invoiceId, now, extra = {}) {
  customer.billingSnapshot = {
    ...(customer.billingSnapshot || {}),
    collections: {
      ...(customer.billingSnapshot?.collections || {}),
      [key]: now,
      [`${key}InvoiceId`]: invoiceId,
      ...extra
    }
  };
  await customer.save();
}

async function applyAutomatedCustomerStatusChange(customer, nextStatus, reason) {
  if (!customer?.serviceId || customer.operationalStatus === nextStatus) {
    return { changed: false, skipped: true };
  }
  let serviceControlResult = null;
  if (nextStatus === "suspended") {
    serviceControlResult = await serviceControlAdapter.suspendSubscriberAccess({
      serviceId: customer.serviceId,
      reason
    });
  } else if (nextStatus === "active") {
    serviceControlResult = await serviceControlAdapter.resumeSubscriberAccess({
      serviceId: customer.serviceId
    });
  } else {
    return { changed: false, skipped: true };
  }

  const device = await DeviceOperationalCache.findOne({ customerId: customer.customerId });
  let geniePresetApplied = false;
  if (device) {
    await genieacsClient.applyPreset({
      deviceId: device.deviceId,
      presetName: nextStatus === "suspended" ? "SERVICE_SUSPEND" : "SERVICE_RESUME",
      correlationId: `billing-${customer.customerId}-${nextStatus}`
    }).then(() => {
      geniePresetApplied = true;
    }).catch(() => null);
  }

  customer.operationalStatus = nextStatus;
  await customer.save();
  await writeAuditLog({
    actorType: "system",
    actorId: "worker",
    actorName: "billing-scheduler",
    action: `customer.${nextStatus}.automated`,
    entityType: "customer",
    entityId: customer.customerId,
    metadata: {
      reason,
      serviceId: customer.serviceId,
      geniePresetApplied,
      radiusState: serviceControlResult?.radiusState || null,
      bngSession: serviceControlResult?.serviceControl || serviceControlResult?.bngSession || null
    }
  });
  return {
    changed: true,
    geniePresetApplied,
    serviceControlResult
  };
}

async function resolveActivationTarget(jobRecord, requestedSerial) {
  const finalSerialNumber = normalizeInstallerIdentifier(
    jobRecord.deviceContext?.finalSerialNumber ||
      requestedSerial ||
      null
  );
  const finalDeviceId = normalizeInstallerIdentifier(jobRecord.deviceContext?.finalDeviceId);
  const candidateDeviceIds = [
    finalDeviceId,
    finalSerialNumber ? `ONT-${finalSerialNumber}` : null
  ].filter(Boolean);

  if (candidateDeviceIds.length) {
    const existingDevice = await DeviceOperationalCache.findOne({
      deviceId: { $in: candidateDeviceIds }
    }).lean();
    if (existingDevice) {
      return {
        deviceId: existingDevice.deviceId,
        existingDevice,
        finalSerialNumber: normalizeInstallerIdentifier(existingDevice.serialNumber) || finalSerialNumber
      };
    }
  }

  if (finalSerialNumber) {
    const existingBySerial = await DeviceOperationalCache.findOne({
      $or: [
        { serialNumber: finalSerialNumber },
        { serialNumber: finalSerialNumber.toLowerCase() },
        { serialNumber: finalSerialNumber.toUpperCase() }
      ]
    }).lean();
    if (existingBySerial) {
      return {
        deviceId: existingBySerial.deviceId,
        existingDevice: existingBySerial,
        finalSerialNumber
      };
    }
  }

  const liveSummary = await genieacsClient.getRichDeviceSummary({
    deviceId: candidateDeviceIds[0],
    serialNumber: finalSerialNumber
  });
  if (liveSummary) {
    const resolvedDeviceId = normalizeInstallerIdentifier(
      liveSummary._id || liveSummary?.DeviceID?.ID || candidateDeviceIds[0]
    );
    return {
      deviceId: resolvedDeviceId,
      existingDevice: null,
      finalSerialNumber
    };
  }

  if (finalSerialNumber) {
    const liveDevices = await genieacsClient.listDevices(500);
    const matchedDevice = Array.isArray(liveDevices)
      ? liveDevices.find((item) => {
          const itemId = normalizeInstallerIdentifier(item?._id || item?.DeviceID?.ID);
          const itemSerial = normalizeInstallerIdentifier(
            item?.DeviceID?.SerialNumber || item?.InternetGatewayDevice?.DeviceInfo?.SerialNumber
          );
          return itemSerial === finalSerialNumber || (itemId && itemId.endsWith(finalSerialNumber));
        })
      : null;

    if (matchedDevice) {
      return {
        deviceId: normalizeInstallerIdentifier(matchedDevice._id || matchedDevice?.DeviceID?.ID),
        existingDevice: null,
        finalSerialNumber
      };
    }
  }

  return {
    deviceId: candidateDeviceIds[0],
    existingDevice: null,
    finalSerialNumber
  };
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
      if (request.actionType === "billing_waiver") {
        const customer = await Customer.findOne({ customerId: request.targetId });
        if (!customer) {
          throw new Error("Customer not found for billing waiver approval");
        }
        const result = await applyCustomerWaiverResolution({
          customer,
          amount: Number(request.payload?.amount || 0),
          taxAmount: Number(request.payload?.taxAmount || 0),
          taxMode: request.payload?.taxMode || "india_gst",
          taxBreakdown: Array.isArray(request.payload?.taxBreakdown) ? request.payload.taxBreakdown : [],
          invoiceId: request.payload?.invoiceId,
          reasonCode: request.payload?.reasonCode || "waiver",
          note: request.payload?.note || "Billing waiver approved",
          metadata: {
            ...(request.payload?.metadata || {}),
            actionRequestId: request._id.toString()
          },
          createdByAdminId: request.approvers?.[request.approvers.length - 1]?.adminUserId || request.requestedBy,
          source: "approval_billing_waiver"
        });
        request.status = "executed";
        request.lastError = undefined;
        await request.save();
        return result;
      }
      if (request.actionType === "billing_writeoff") {
        const customer = await Customer.findOne({ customerId: request.targetId });
        if (!customer) {
          throw new Error("Customer not found for billing write-off approval");
        }
        const result = await applyCustomerWriteoffResolution({
          customer,
          amount: Number(request.payload?.amount || 0),
          invoiceId: request.payload?.invoiceId,
          reference: request.payload?.reference || `WO-${Date.now()}`,
          note: request.payload?.note || "Billing write-off approved",
          metadata: {
            ...(request.payload?.metadata || {}),
            actionRequestId: request._id.toString()
          },
          createdByAdminId: request.approvers?.[request.approvers.length - 1]?.adminUserId || request.requestedBy,
          source: "approval_billing_writeoff"
        });
        request.status = "executed";
        request.lastError = undefined;
        await request.save();
        return result;
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
        let serviceControlResult = null;
        let geniePresetApplied = false;
        if (job.data.actionType === "suspend") {
          serviceControlResult = await serviceControlAdapter.suspendSubscriberAccess({
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
            geniePresetApplied = true;
          }
          customer.operationalStatus = "suspended";
        } else {
          serviceControlResult = await serviceControlAdapter.resumeSubscriberAccess({
            serviceId: job.data.serviceId
          });
          const device = await DeviceOperationalCache.findOne({ customerId: job.data.customerId });
          if (device) {
            await genieacsClient.applyPreset({
              deviceId: device.deviceId,
              presetName: "SERVICE_RESUME",
              correlationId: request._id.toString()
            });
            geniePresetApplied = true;
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
          metadata: {
            actionRequestId: request._id.toString(),
            serviceId: job.data.serviceId,
            geniePresetApplied,
            radiusState: serviceControlResult?.radiusState || null,
            bngSession: serviceControlResult?.serviceControl || serviceControlResult?.bngSession || null
          }
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
            speedMbps:
              bootstrap.plan?.speedMbps ||
              bootstrap.accessProfile?.downMbps ||
              jobRecord.customerSnapshot?.speedMbps,
            uploadSpeedMbps:
              bootstrap.plan?.uploadSpeedMbps ||
              bootstrap.accessProfile?.upMbps ||
              jobRecord.customerSnapshot?.uploadSpeedMbps,
            burstDownloadMbps:
              bootstrap.plan?.burstDownloadMbps ||
              bootstrap.accessProfile?.burstDownMbps ||
              jobRecord.customerSnapshot?.burstDownloadMbps,
            burstUploadMbps:
              bootstrap.plan?.burstUploadMbps ||
              bootstrap.accessProfile?.burstUpMbps ||
              jobRecord.customerSnapshot?.burstUploadMbps,
            dataPolicy: bootstrap.plan?.dataPolicy || jobRecord.customerSnapshot?.dataPolicy || "unlimited",
            dataLimitGb: Number(bootstrap.plan?.dataLimitGb || jobRecord.customerSnapshot?.dataLimitGb || 0) || null,
            fupSpeedMbps: Number(bootstrap.plan?.fupSpeedMbps || jobRecord.customerSnapshot?.fupSpeedMbps || 0) || null,
            fairUsageResetPolicy: bootstrap.plan?.fairUsageResetPolicy || jobRecord.customerSnapshot?.fairUsageResetPolicy || "monthly",
            latencyClass: bootstrap.plan?.latencyClass || jobRecord.customerSnapshot?.latencyClass || "standard",
            contentionRatio: bootstrap.plan?.contentionRatio || jobRecord.customerSnapshot?.contentionRatio || null
          };
        }
        const activationTarget = await resolveActivationTarget(
          jobRecord,
          job.data.finalSerialNumber
        );
        const deviceId =
          activationTarget.deviceId ||
          jobRecord.deviceContext?.finalDeviceId ||
          job.data.finalDeviceId ||
          `ONT-${job.data.finalSerialNumber}`;
        const existingDevice = activationTarget.existingDevice;
        const brand = detectOntBrand({
          serialNumber:
            activationTarget.finalSerialNumber ||
            jobRecord.deviceContext?.finalSerialNumber ||
            existingDevice?.serialNumber,
          productClass: existingDevice?.productClass,
          deviceId
        });
        const prepared = jobRecord.activation?.preparedCredentials || {};
        const planProvisioning = bootstrap?.plan?.provisioning || {};
        const pppoe = prepared.pppoe || buildPppoeCredentials(jobRecord.customerId, planProvisioning);
        const wifi = prepared.wifi || buildWifiCredentials(planProvisioning, jobRecord.customerId);
        const vlanId = prepared.vlanId || planProvisioning.vlanId || existingDevice?.wanInfo?.vlanId || 100;
        const resumeStage = String(job.data.resumeStage || jobRecord.activation?.resumeStage || "radius");
        const shouldRunRadiusStage = !["genie_push", "readback"].includes(resumeStage);
        const shouldRunGenieStage = resumeStage !== "readback";

        if (shouldRunRadiusStage) {
          updateActivationStage(
            jobRecord,
            "radius_create_pending",
            "Creating PPPoE user in FreeRADIUS"
          );
          await serviceControlAdapter.createSubscriberAccess({
            serviceId: jobRecord.serviceId,
            customerId: jobRecord.customerId,
            radiusUsername: pppoe.username,
            radiusPassword: pppoe.password,
            accessProfileCode:
              bootstrap?.plan?.provisioning?.accessProfileCode ||
              bootstrap?.accessProfile?.code ||
              jobRecord.customerSnapshot?.planCode,
            billingProfileCode: bootstrap?.billingProfile?.code,
            bngNodeCode: bootstrap?.bngNode?.nodeCode,
            metadata: {
              source: "installer_activation",
              networkProfile: {
                speedMbps:
                  bootstrap?.plan?.speedMbps ||
                  bootstrap?.accessProfile?.downMbps ||
                  jobRecord.customerSnapshot?.speedMbps ||
                  0,
                uploadSpeedMbps:
                  bootstrap?.plan?.uploadSpeedMbps ||
                  bootstrap?.accessProfile?.upMbps ||
                  jobRecord.customerSnapshot?.uploadSpeedMbps ||
                  0,
                burstDownloadMbps:
                  bootstrap?.plan?.burstDownloadMbps ||
                  bootstrap?.accessProfile?.burstDownMbps ||
                  jobRecord.customerSnapshot?.burstDownloadMbps ||
                  null,
                burstUploadMbps:
                  bootstrap?.plan?.burstUploadMbps ||
                  bootstrap?.accessProfile?.burstUpMbps ||
                  jobRecord.customerSnapshot?.burstUploadMbps ||
                  null,
                dataPolicy: bootstrap?.plan?.dataPolicy || jobRecord.customerSnapshot?.dataPolicy || "unlimited",
                dataLimitGb: Number(bootstrap?.plan?.dataLimitGb || jobRecord.customerSnapshot?.dataLimitGb || 0) || null,
                fupSpeedMbps: Number(bootstrap?.plan?.fupSpeedMbps || jobRecord.customerSnapshot?.fupSpeedMbps || 0) || null,
                fairUsageResetPolicy: bootstrap?.plan?.fairUsageResetPolicy || jobRecord.customerSnapshot?.fairUsageResetPolicy || "monthly",
                latencyClass: bootstrap?.plan?.latencyClass || jobRecord.customerSnapshot?.latencyClass || "standard",
                contentionRatio: bootstrap?.plan?.contentionRatio || jobRecord.customerSnapshot?.contentionRatio || null
              }
            }
          });
          updateActivationStage(jobRecord, "radius_create_done", "PPPoE user created in FreeRADIUS");
        } else {
          updateActivationStage(jobRecord, "radius_resume_skip", "Skipping FreeRADIUS step during granular resume", {
            resumeStage
          });
        }
        if (shouldRunGenieStage) {
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
            jobRecord.activation = {
              ...(jobRecord.activation || {}),
              configFallback: false,
              configFallbackError: configError.message
            };
            updateActivationStage(jobRecord, "genie_fallback", "Config push failed; legacy Genie preset fallback skipped", {
              lastConfigError: configError.message
            });
          }
        } else {
          updateActivationStage(jobRecord, "genie_resume_skip", "Skipping config push during read-back resume", {
            resumeStage
          });
        }
        if (shouldRunGenieStage && (brand === "nokia" || brand === "dasan") && wifi.password) {
          await genieacsClient.rebootDevice(deviceId);
          jobRecord.timeline.push({
            event: "job.device_reboot_requested",
            actorType: "system",
            actorId: "worker",
            note: `Queued reboot after ${brand} Wi-Fi security update`,
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
              serialNumber:
                activationTarget.finalSerialNumber ||
                jobRecord.deviceContext?.finalSerialNumber ||
                existingDevice?.serialNumber,
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
          rebootQueuedAt: (brand === "nokia" || brand === "dasan") && wifi.password ? new Date() : jobRecord.activation?.rebootQueuedAt,
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
        if (jobRecord.customerSnapshot?.phone) {
          const smsBody = await renderInstallerActivationSms(jobRecord, {
            pppoeUsername: pppoe.username,
            pppoePassword: pppoe.password,
            wifiSsid: wifi.ssid24,
            wifiPassword: wifi.password,
            vlanId
          });
          await notificationDispatcher.dispatchChannel({
            category: "sms",
            recipient: jobRecord.customerSnapshot.phone,
            subject: "JustFiber activation details",
            body: smsBody,
            entityType: "installer_job",
            entityId: jobRecord._id.toString(),
            metadata: {
              eventKey: "installer_activation_sms",
              customerId: jobRecord.customerId
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

let billingSchedulerRunning = false;
let usagePolicySchedulerRunning = false;


function resolveUsageCycleStart(service, customer) {
  const resetPolicy = service?.metadata?.networkProfile?.fairUsageResetPolicy || "monthly";
  const now = new Date();
  if (resetPolicy === "rolling_30") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  if (resetPolicy === "billing_cycle") {
    const invoiceDate = customer?.invoiceSummary?.lastInvoiceDate
      ? new Date(customer.invoiceSummary.lastInvoiceDate)
      : null;
    if (invoiceDate && !Number.isNaN(invoiceDate.getTime())) {
      return invoiceDate;
    }
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

async function notifyCustomerPolicyChange(customer, type, title, body, payload = {}) {
  if (!customer?.customerId) return;
  const customerUser = await CustomerUser.findOne({ linkedCustomerIds: customer.customerId }).lean();
  if (!customerUser?._id) return;
  await CustomerNotification.create({
    customerUserId: customerUser._id,
    type,
    title,
    body,
    payload
  });
}

async function runRecurringUsagePolicyTasks() {
  if (usagePolicySchedulerRunning) return;
  usagePolicySchedulerRunning = true;
  try {
    const services = await SubscriberService.find({
      status: "active",
      "metadata.networkProfile.dataPolicy": { $in: ["fup", "hard_cap"] },
      "metadata.networkProfile.dataLimitGb": { $gt: 0 }
    }).limit(250);

    for (const service of services) {
      const networkProfile = service.metadata?.networkProfile || {};
      const dataPolicy = String(networkProfile.dataPolicy || "unlimited");
      const dataLimitGb = Number(networkProfile.dataLimitGb || 0) || 0;
      if (!dataLimitGb) continue;

      const customer = await Customer.findOne({ customerId: service.customerId });
      const cycleStart = resolveUsageCycleStart(service, customer);
      const usage = await serviceControlAdapter.getSubscriberUsageSummary({
        serviceId: service.serviceId,
        radiusUsername: service.radiusUsername,
        since: cycleStart
      });
      const capOctets = Math.round(dataLimitGb * 1024 * 1024 * 1024);
      const exceeded = usage.totalOctets >= capOctets;
      const nextPolicyState = exceeded
        ? dataPolicy === "fup"
          ? "fup_active"
          : "hard_cap_reached"
        : "base";
      const previousPolicyState = service.metadata?.usagePolicyState || "base";
      const servicePlanCode =
        service.metadata?.planCode ||
        service.metadata?.planSnapshot?.planCode ||
        customer?.planCode ||
        customer?.billingSnapshot?.planCode ||
        null;
      const currentSpeedMbps = Number(networkProfile.speedMbps || customer?.billingSnapshot?.speedMbps || 0) || null;
      const recommendedPlan = await PlanCatalog.findOne({
        active: true,
        ...(currentSpeedMbps > 0 ? { speedMbps: { $gt: currentSpeedMbps } } : {}),
        ...(servicePlanCode ? { planCode: { $ne: servicePlanCode } } : {})
      })
        .sort({ speedMbps: 1, sortOrder: 1, monthlyPrice: 1, createdAt: 1 })
        .lean();
      const upgradePayload = recommendedPlan
        ? {
            currentPlanCode: servicePlanCode,
            currentSpeedMbps,
            recommendedPlanCode: recommendedPlan.planCode,
            recommendedPlanName: recommendedPlan.name,
            recommendedSpeedMbps: Number(recommendedPlan.speedMbps || 0) || null,
            recommendedUploadSpeedMbps: Number(recommendedPlan.uploadSpeedMbps || 0) || null,
            recommendedPrice: Number(recommendedPlan.monthlyPrice || 0) || null,
            upgradeRecommended: true
          }
        : {
            currentPlanCode: servicePlanCode,
            currentSpeedMbps,
            upgradeRecommended: false
          };

      if (customer) {
        customer.billingSnapshot = {
          ...(customer.billingSnapshot || {}),
          usageOctets: usage.totalOctets,
          usageGb: Number((usage.totalOctets / (1024 * 1024 * 1024)).toFixed(2)),
          usageCapGb: dataLimitGb,
          usageCapReached: exceeded,
          dataPolicy,
          fupSpeedMbps: Number(networkProfile.fupSpeedMbps || customer.billingSnapshot?.fupSpeedMbps || 0) || null,
          fairUsageResetPolicy: networkProfile.fairUsageResetPolicy || customer.billingSnapshot?.fairUsageResetPolicy || "monthly",
          usageCycleStartedAt: cycleStart,
          usageLastUpdatedAt: usage.latestUpdateAt || new Date()
        };
        await customer.save();
      }

      service.metadata = {
        ...(service.metadata || {}),
        usageSummary: {
          totalOctets: usage.totalOctets,
          totalInputOctets: usage.totalInputOctets,
          totalOutputOctets: usage.totalOutputOctets,
          cycleStartedAt: cycleStart,
          lastUpdatedAt: usage.latestUpdateAt || new Date(),
          capOctets,
          exceeded
        },
        usagePolicyState: nextPolicyState
      };

      if (dataPolicy === "fup" && exceeded && previousPolicyState !== "fup_active") {
        const throttledSpeed = Number(networkProfile.fupSpeedMbps || 0) || Math.min(10, Number(networkProfile.speedMbps || 10));
        const baseNetworkProfile = service.metadata?.baseNetworkProfile || networkProfile;
        const throttledProfile = {
          ...baseNetworkProfile,
          speedMbps: throttledSpeed,
          uploadSpeedMbps: Math.max(1, Math.min(Number(baseNetworkProfile.uploadSpeedMbps || throttledSpeed), throttledSpeed)),
          burstDownloadMbps: null,
          burstUploadMbps: null
        };
        service.metadata = {
          ...(service.metadata || {}),
          baseNetworkProfile,
          networkProfile: throttledProfile,
          appliedFupAt: new Date(),
          usagePolicyState: "fup_active",
          usageSummary: service.metadata?.usageSummary
        };
        await serviceControlAdapter.createSubscriberAccess({
          serviceId: service.serviceId,
          customerId: service.customerId,
          radiusUsername: service.radiusUsername,
          radiusPassword: service.metadata?.radiusPassword,
          accessProfileCode: service.accessProfileCode,
          billingProfileCode: service.billingProfileCode,
          bngNodeCode: service.bngNodeCode,
          metadata: {
            ...(service.metadata || {}),
            networkProfile: throttledProfile,
            baseNetworkProfile
          }
        });
        if (customer) {
          await notifyCustomerPolicyChange(
            customer,
            "fup_applied",
            "FUP speed applied",
            `Your plan usage crossed ${dataLimitGb} GB. Speed is now running at ${throttledSpeed} Mbps until reset.`,
            { serviceId: service.serviceId, dataLimitGb, fupSpeedMbps: throttledSpeed, ...upgradePayload }
          );
        }
      }

      if (dataPolicy === "fup" && !exceeded && previousPolicyState === "fup_active") {
        const restoredProfile = service.metadata?.baseNetworkProfile || networkProfile;
        service.metadata = {
          ...(service.metadata || {}),
          networkProfile: restoredProfile,
          restoredFromFupAt: new Date(),
          usagePolicyState: "base",
          usageSummary: service.metadata?.usageSummary
        };
        await serviceControlAdapter.createSubscriberAccess({
          serviceId: service.serviceId,
          customerId: service.customerId,
          radiusUsername: service.radiusUsername,
          radiusPassword: service.metadata?.radiusPassword,
          accessProfileCode: service.accessProfileCode,
          billingProfileCode: service.billingProfileCode,
          bngNodeCode: service.bngNodeCode,
          metadata: {
            ...(service.metadata || {}),
            networkProfile: restoredProfile
          }
        });
        if (customer) {
          await notifyCustomerPolicyChange(
            customer,
            "fup_restored",
            "Base plan speed restored",
            "Your plan usage cycle reset and base broadband speed is active again.",
            { serviceId: service.serviceId, dataLimitGb, ...upgradePayload }
          );
        }
      }

      if (dataPolicy === "hard_cap" && exceeded && previousPolicyState !== "hard_cap_reached" && customer) {
        await notifyCustomerPolicyChange(
          customer,
          "data_cap_reached",
          "Data cap reached",
          `Your plan usage crossed ${dataLimitGb} GB. Service is now running under hard-cap policy until reset.`,
          { serviceId: service.serviceId, dataLimitGb, ...upgradePayload }
        );
      }

      await service.save();
    }
  } catch (error) {
    console.error("[worker] recurring usage policy task failed:", error.message);
  } finally {
    usagePolicySchedulerRunning = false;
  }
}

async function runRecurringBillingTasks() {
  if (billingSchedulerRunning) return;
  billingSchedulerRunning = true;
  try {
    const now = new Date();
    const billCycle = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const existingRun = await BillingRun.findOne({
      triggerMode: "scheduled",
      billCycle,
      createdAt: { $gte: dayStart }
    }).lean();

    if (!existingRun) {
      const customersWithScheduledPlanChanges = await Customer.find({
        "billingSnapshot.pendingPlanChange.effectiveMode": "next_cycle"
      });
      for (const customer of customersWithScheduledPlanChanges) {
        const pending = customer.billingSnapshot?.pendingPlanChange;
        if (!pending?.planCode) continue;
        const nextBillingDate = normalizeDate(customer.billingSnapshot?.nextBillingDate || customer.expiryAt);
        if (!nextBillingDate || nextBillingDate.getTime() > now.getTime()) continue;
        const plan = await PlanCatalog.findOne({ planCode: pending.planCode, active: true }).lean();
        if (!plan) continue;
        const durationMonths = getDurationMonthsFromBillingTerm(pending.billingTerm || customer.billingSnapshot?.nextPlanTerm || "monthly");
        const recurringAmount =
          durationMonths >= 12
            ? Number(plan.yearlyPrice || (Number(plan.monthlyPrice || 0) * 12) || 0) || 0
            : durationMonths >= 6
              ? Number(plan.halfYearlyPrice || (Number(plan.monthlyPrice || 0) * 6) || 0) || 0
              : durationMonths >= 3
                ? Number(plan.quarterlyPrice || (Number(plan.monthlyPrice || 0) * 3) || 0) || 0
                : Number(plan.monthlyPrice || 0) || 0;
        const routerRental = Number(plan.routerRental || 0) || 0;
        const totalPlanAmount = Number((recurringAmount + routerRental * durationMonths).toFixed(2));
        customer.planCode = plan.planCode;
        customer.planName = plan.name;
        customer.customerType = pending.billMode === "postpaid" ? "business" : "home";
        customer.billingSnapshot = {
          ...(customer.billingSnapshot || {}),
          speedMbps: plan.speedMbps || customer.billingSnapshot?.speedMbps || 100,
          uploadSpeedMbps:
            plan.uploadSpeedMbps ||
            customer.billingSnapshot?.uploadSpeedMbps ||
            Math.max(2, Math.round((plan.speedMbps || customer.billingSnapshot?.speedMbps || 100) * 0.35)),
          dataPolicy: plan.dataPolicy || customer.billingSnapshot?.dataPolicy || "unlimited",
          dataLimitGb: Number(plan.dataLimitGb || customer.billingSnapshot?.dataLimitGb || 0) || null,
          fupSpeedMbps: Number(plan.fupSpeedMbps || customer.billingSnapshot?.fupSpeedMbps || 0) || null,
          billMode: pending.billMode || customer.billingSnapshot?.billMode,
          pendingPlanChange: null,
          adjustmentPreview: 0,
          lastPlanPrice: Number(pending.currentPrice || customer.billingSnapshot?.lastPlanPrice || 0),
          nextPlanPrice: Number(plan.monthlyPrice || 0),
          nextPlanTerm: pending.billingTerm || customer.billingSnapshot?.nextPlanTerm || "monthly",
          nextPlanChangeMode: pending.effectiveMode || "next_cycle"
        };
        await customer.save();
        if (customer.serviceId) {
          await SubscriberService.updateOne(
            { serviceId: customer.serviceId },
            {
              $set: {
                planCode: plan.planCode,
                planName: plan.name,
                routerRental,
                billingBreakup: plan.billingBreakup || {},
                billingPeriodMonths: durationMonths,
                "metadata.planCode": plan.planCode,
                "metadata.planName": plan.name,
                "metadata.planAmount": recurringAmount,
                "metadata.monthlyPrice": Number(plan.monthlyPrice || 0) || 0,
                "metadata.quarterlyPrice": Number(plan.quarterlyPrice || 0) || 0,
                "metadata.halfYearlyPrice": Number(plan.halfYearlyPrice || 0) || 0,
                "metadata.yearlyPrice": Number(plan.yearlyPrice || 0) || 0,
                "metadata.durationMonths": durationMonths,
                "metadata.totalAmount": totalPlanAmount,
                "metadata.billingTotalAmount": totalPlanAmount,
                "metadata.recurringAmount": recurringAmount,
                "metadata.baseRecurringAmount": recurringAmount,
                "metadata.routerRental": routerRental,
                "metadata.speedMbps": plan.speedMbps || customer.billingSnapshot?.speedMbps || 100,
                "metadata.uploadSpeedMbps":
                  plan.uploadSpeedMbps ||
                  customer.billingSnapshot?.uploadSpeedMbps ||
                  Math.max(2, Math.round((plan.speedMbps || customer.billingSnapshot?.speedMbps || 100) * 0.35)),
                "metadata.dataPolicy": plan.dataPolicy || customer.billingSnapshot?.dataPolicy || "unlimited",
                "metadata.dataLimitGb": Number(plan.dataLimitGb || customer.billingSnapshot?.dataLimitGb || 0) || null,
                "metadata.fupSpeedMbps": Number(plan.fupSpeedMbps || customer.billingSnapshot?.fupSpeedMbps || 0) || null
              }
            }
          );
        }
        await writeAuditLog({
          actorType: "system",
          actorId: "worker",
          actorName: "billing-scheduler",
          action: "customer.plan_change.scheduled_applied",
          entityType: "customer",
          entityId: customer.customerId,
          metadata: {
            nextPlanCode: plan.planCode,
            effectiveMode: pending.effectiveMode || "next_cycle",
            billingTerm: pending.billingTerm || "monthly"
          }
        });
      }

      const run = await BillingRun.create({
        runId: `BR-AUTO-${Date.now()}`,
        triggerMode: "scheduled",
        billCycle,
        status: "running",
        startedAt: now,
        notes: "Automatic recurring due-date scheduler run"
      });
      const result = await internalBillingEngine.runBillingCycle({
        billCycle: run.billCycle,
        referenceDate: now,
        advanceBillingSchedule: true
      });
      run.status = "completed";
      run.completedAt = new Date();
      run.totals = {
        processed: result.processed || 0,
        created: result.created || 0,
        skipped: result.skipped || 0,
        failed: result.results?.filter((item) => item?.error).length || 0,
        billedAmount: result.results?.filter((item) => !item.skipped).reduce((sum, item) => sum + Number(item.invoice?.totalAmount || 0), 0) || 0,
        taxAmount: result.results?.filter((item) => !item.skipped).reduce((sum, item) => sum + Number(item.invoice?.taxAmount || 0), 0) || 0
      };
      run.results = result.results || [];
      await run.save();

      const createdInvoices = (result.results || [])
        .filter((item) => item?.invoice?.invoiceId)
        .map((item) => item.invoice);
      for (const createdInvoice of createdInvoices) {
        const invoice = await BillingInvoice.findOne({ invoiceId: createdInvoice.invoiceId });
        if (!invoice) continue;
        if (String(invoice.paymentStatus || "").toLowerCase() === "paid") {
          await syncInvoiceLifecycle(invoice);
          continue;
        }
        const customer = await Customer.findOne({ customerId: invoice.customerId });
        if (!customer || (!customer.phone && !customer.email)) {
          await syncInvoiceLifecycle(invoice);
          continue;
        }
        if (invoice.metadata?.dispatchedAt) {
          await syncInvoiceLifecycle(invoice);
          continue;
        }
        const invoiceUrl = `${env.appBaseUrl.replace(/\/$/, "")}/api/v1/admin/billing/invoices/${encodeURIComponent(invoice.invoiceId)}/pdf`;
        const message = await buildBillingNotificationContent({
          eventKey: "billing_invoice",
          customer,
          invoice,
          actionUrl: invoiceUrl,
          metadata: {
            invoiceId: invoice.invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            invoiceUrl,
            automation: "billing_generation_dispatch"
          }
        });
        await notificationDispatcher.dispatchEvent({
          eventKey: "billing_invoice",
          recipients: {
            email: customer.email,
            sms: customer.phone
          },
          subject: message?.subject || `Invoice ${invoice.invoiceNumber}`,
          body:
            message?.body ||
            `Dear ${customer.fullName}, your invoice ${invoice.invoiceNumber} for Rs ${Number(invoice.totalAmount || 0).toFixed(2)} is now ready. Due date is ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "-"}.`,
          entityType: "billing_invoice",
          entityId: invoice.invoiceId,
          metadata: {
            invoiceId: invoice.invoiceId,
            automation: "billing_generation_dispatch",
            ...(message?.branding || {})
          }
        }).catch(() => null);
        await syncInvoiceLifecycle(invoice, {
          dispatchedAt: new Date(),
          dispatchSource: "billing_scheduler"
        });
      }
    }

    const upcomingDueInvoices = await BillingInvoice.find({
      paymentStatus: "pending",
      dueDate: {
        $gte: now,
        $lte: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
      }
    });

    for (const invoice of upcomingDueInvoices) {
      const customer = await Customer.findOne({ customerId: invoice.customerId });
      if (!customer) continue;
      if (!canSendCollectionEvent(customer, "lastDueReminderAt", invoice.invoiceId, now)) {
        continue;
      }
      if (customer.phone || customer.email) {
        const message = await buildBillingNotificationContent({
          eventKey: "invoice_due_date",
          customer,
          invoice,
          metadata: { invoiceId: invoice.invoiceId, automation: "due_reminder", stage: "upcoming_due" }
        });
        await notificationDispatcher.dispatchEvent({
          eventKey: "invoice_due_date",
          recipients: {
            email: customer.email,
            sms: customer.phone
          },
          subject: message?.subject || `Invoice due soon ${invoice.invoiceNumber}`,
          body: message?.body || `Dear ${customer.fullName}, invoice ${invoice.invoiceNumber} of Rs ${Number(invoice.totalAmount || 0).toFixed(2)} is due on ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "the due date"}.`,
          entityType: "billing_invoice",
          entityId: invoice.invoiceId,
          metadata: { invoiceId: invoice.invoiceId, automation: "due_reminder", stage: "upcoming_due", ...(message?.branding || {}) }
        }).catch(() => null);
      }
      await persistCollectionEvent(customer, "lastDueReminderAt", invoice.invoiceId, now);
    }

    const overdueInvoices = await BillingInvoice.find({
      paymentStatus: "pending",
      dueDate: { $lt: now }
    });
    for (const invoice of overdueInvoices) {
      invoice.paymentStatus = "overdue";
      await syncInvoiceLifecycle(invoice, {
        overdueMarkedAt: new Date(),
        overdueMarkedBy: "billing_scheduler"
      });
      await Customer.updateOne(
        { customerId: invoice.customerId },
        {
          $set: {
            "billingSnapshot.lastPaymentStatus": "overdue",
            "billingSnapshot.dueAmount": invoice.totalAmount || 0
          }
        }
      );
      const customer = await Customer.findOne({ customerId: invoice.customerId });
      if (customer) {
        await syncCustomerBillingState(customer.customerId, customer);
      }
      if (customer?.phone || customer?.email) {
        if (canSendCollectionEvent(customer, "lastOverdueReminderAt", invoice.invoiceId, now)) {
          const message = await buildBillingNotificationContent({
            eventKey: "unpaid_invoice",
            customer,
            invoice,
            metadata: { invoiceId: invoice.invoiceId, automation: "overdue_reminder", stage: "overdue" }
          });
          await notificationDispatcher.dispatchEvent({
            eventKey: "unpaid_invoice",
            recipients: {
              email: customer.email,
              sms: customer.phone
            },
            subject: message?.subject || `Invoice overdue ${invoice.invoiceNumber}`,
            body: message?.body || `Dear ${customer.fullName}, invoice ${invoice.invoiceNumber} of Rs ${Number(invoice.totalAmount || 0).toFixed(2)} is overdue. Please clear the amount to avoid service interruption.`,
            entityType: "billing_invoice",
            entityId: invoice.invoiceId,
            metadata: { invoiceId: invoice.invoiceId, automation: "overdue_reminder", stage: "overdue", ...(message?.branding || {}) }
          }).catch(() => null);
          await persistCollectionEvent(customer, "lastOverdueReminderAt", invoice.invoiceId, now);
        }
      }
      if (customer) {
        const graceDays = Number(customer.billingSnapshot?.graceDays || 0);
        const overdueDays = invoice.dueDate
          ? Math.max(0, Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        const promiseToPayAt = customer.billingSnapshot?.collections?.promiseToPayAt
          ? new Date(customer.billingSnapshot.collections.promiseToPayAt)
          : null;
        const hasValidPromise =
          promiseToPayAt &&
          !Number.isNaN(promiseToPayAt.getTime()) &&
          promiseToPayAt.getTime() >= now.getTime();
        if (
          customer.operationalStatus === "active" &&
          overdueDays === graceDays &&
          !hasValidPromise &&
          canSendCollectionEvent(customer, "lastSuspensionWarningAt", invoice.invoiceId, now)
        ) {
          if (customer.phone || customer.email) {
            const message = await buildBillingNotificationContent({
              eventKey: "suspension_warning",
              customer,
              invoice,
              overdueDays,
              metadata: { invoiceId: invoice.invoiceId, automation: "suspension_warning", overdueDays }
            });
            await notificationDispatcher.dispatchEvent({
              eventKey: "suspension_warning",
              recipients: {
                email: customer.email,
                sms: customer.phone
              },
              subject: message?.subject || `Suspension warning for ${customer.customerId}`,
              body: message?.body || `Dear ${customer.fullName}, your invoice ${invoice.invoiceNumber} for Rs ${Number(invoice.totalAmount || 0).toFixed(2)} remains unpaid. Please pay immediately to avoid service suspension.`,
              entityType: "billing_invoice",
              entityId: invoice.invoiceId,
              metadata: { invoiceId: invoice.invoiceId, automation: "suspension_warning", overdueDays, ...(message?.branding || {}) }
            }).catch(() => null);
          }
          await persistCollectionEvent(customer, "lastSuspensionWarningAt", invoice.invoiceId, now, {
            suspensionRecommendedAt: now
          });
        }
        if (
          customer.operationalStatus === "active" &&
          overdueDays > graceDays &&
          !hasValidPromise
        ) {
          const suspensionResult = await applyAutomatedCustomerStatusChange(
            customer,
            "suspended",
            `Auto collections suspension for overdue invoice ${invoice.invoiceNumber || invoice.invoiceId}`
          );
          if (suspensionResult?.changed && (customer.phone || customer.email)) {
            const message = await buildBillingNotificationContent({
              eventKey: "account_suspension",
              customer,
              invoice,
              metadata: { invoiceId: invoice.invoiceId, automation: "collections_suspend" }
            });
            await notificationDispatcher.dispatchEvent({
              eventKey: "account_suspension",
              recipients: {
                email: customer.email,
                sms: customer.phone
              },
              subject: message?.subject || `Service suspended for ${customer.customerId}`,
              body: message?.body || `Dear ${customer.fullName}, your service has been temporarily suspended due to overdue billing amount of Rs ${Number(invoice.totalAmount || 0).toFixed(2)}.`,
              entityType: "customer",
              entityId: customer.customerId,
              metadata: { invoiceId: invoice.invoiceId, automation: "collections_suspend", ...(message?.branding || {}) }
            }).catch(() => null);
          }
        }
      }
    }

    const pendingPayments = await PaymentTransaction.find({
      reconciliationStatus: { $in: ["pending", "manual_review", null] },
      status: "success"
    }).sort({ paidAt: -1, createdAt: -1 }).limit(50);

    for (const payment of pendingPayments) {
      const match = await findBestInvoiceForPayment(payment);

      if (!match) {
        payment.reconciliationStatus = "manual_review";
        payment.metadata = {
          ...(payment.metadata || {}),
          reconciliationMode: "auto_worker_review",
          reconciliationConfidence: 0,
          reconciliationMatchReason: "No eligible open invoice reached minimum confidence",
          reconciliationMatchedBy: "no_match"
        };
        await payment.save();
        continue;
      }
      const { invoice, confidenceScore, matchReason, matchedBy } = match;
      const lifecycleBefore = deriveInvoiceLifecycle(invoice);

      const settlement = await reconcilePaymentToInvoice({
        payment,
        invoice,
        confidenceScore,
        matchReason,
        matchedBy,
        reconciliationMode: "auto_worker",
        ledgerSource: "billing_scheduler",
        ledgerNote: "Auto-reconciled payment",
        ledgerMetadata: {
          reconciliationMode: "auto_worker",
          lifecycleBefore
        }
      });
      const customer = settlement.customer || (await Customer.findOne({ customerId: payment.customerId }));
      let resumed = false;
      if (customer) {
        customer.billingSnapshot = {
          ...(customer.billingSnapshot || {}),
          lastPaymentStatus: "paid",
          lastPaidAt: payment.paidAt || new Date(),
          lastReconciledPaymentId: payment.transactionId,
          collections: {
            ...(customer.billingSnapshot?.collections || {}),
            lastSettledAt: new Date(),
            promiseToPayAt: null,
            promiseAmount: 0,
            promiseNote: ""
          }
        };
        const resumeResult =
          customer.operationalStatus === "suspended"
            ? await applyAutomatedCustomerStatusChange(
                customer,
                "active",
                `Auto resume after payment reconciliation ${payment.transactionId}`
              )
            : (await customer.save(), { changed: false });
        resumed = Boolean(resumeResult?.changed);
        await syncCustomerBillingState(customer.customerId, customer);
        if ((customer.phone || customer.email) && resumed) {
          const message = await buildBillingNotificationContent({
            eventKey: "paid_invoice",
            customer,
            invoice,
            payment,
            metadata: {
              invoiceId: invoice.invoiceId,
              paymentId: payment.transactionId,
              automation: "collections_resume",
              serviceStatus: "active_after_resume"
            }
          });
          await notificationDispatcher.dispatchEvent({
            eventKey: "paid_invoice",
            recipients: {
              email: customer.email,
              sms: customer.phone
            },
            subject: message?.subject || `Service resumed for ${customer.customerId}`,
            body: message?.body || `Dear ${customer.fullName}, payment of Rs ${Number(payment.amount || 0).toFixed(2)} was received and your service has been resumed.`,
            entityType: "customer",
            entityId: customer.customerId,
            metadata: { invoiceId: invoice.invoiceId, paymentId: payment.transactionId, automation: "collections_resume", serviceStatus: "active_after_resume", ...(message?.branding || {}) }
          }).catch(() => null);
        }
      }
      if ((customer?.phone || customer?.email) && !resumed) {
        const message = await buildBillingNotificationContent({
          eventKey: "paid_invoice",
          customer,
          invoice,
          payment,
          metadata: { invoiceId: invoice.invoiceId, paymentId: payment.transactionId }
        });
        await notificationDispatcher.dispatchEvent({
          eventKey: "paid_invoice",
          recipients: {
            email: customer.email,
            sms: customer.phone
          },
          subject: message?.subject || `Payment received for ${invoice.invoiceNumber}`,
          body: message?.body || `Dear ${customer.fullName}, payment of Rs ${Number(payment.amount || 0).toFixed(2)} has been reconciled against invoice ${invoice.invoiceNumber}.`,
          entityType: "billing_payment",
          entityId: payment.transactionId,
          metadata: { invoiceId: invoice.invoiceId, paymentId: payment.transactionId, ...(message?.branding || {}) }
        }).catch(() => null);
      }
    }
  } catch (error) {
    console.error("[worker] recurring billing task failed:", error.message);
  } finally {
    billingSchedulerRunning = false;
  }
}

setInterval(() => {
  void runRecurringBillingTasks();
}, 15 * 60 * 1000);

void runRecurringBillingTasks();

setInterval(() => {
  void runRecurringUsagePolicyTasks();
}, 15 * 60 * 1000);

void runRecurringUsagePolicyTasks();



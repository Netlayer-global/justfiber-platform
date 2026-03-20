import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { Customer } from "../../models/Customer.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { AdminActionRequest } from "../../models/AdminActionRequest.js";
import { adminActionsQueue } from "../../queues/adminActionsQueue.js";
import { statusActionSchema, retryProvisioningSchema, updateCustomerSchema } from "./schemas.js";
import { ApiError } from "../../common/ApiError.js";
import { auditFromRequest } from "../../common/audit.js";
import { allowedPresets } from "../../integrations/genieacsClient.js";
import { buildPagination } from "../../common/pagination.js";
import { BillingInvoice } from "../../models/BillingInvoice.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";

export const customersRouter = Router();

customersRouter.use(requireAuth);

customersRouter.get(
  "/",
  requirePermission(permissions.customerRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { customerId: req.query.search },
        { accountNumber: req.query.search },
        { phone: req.query.search },
        { fullName: { $regex: req.query.search, $options: "i" } }
      ];
    }
    if (req.query.status) {
      filter.operationalStatus = req.query.status;
    }
    if (req.query.planCode) {
      filter.planCode = req.query.planCode;
    }
    if (req.query.city) {
      filter["address.city"] = req.query.city;
    }
    const [items, total] = await Promise.all([
      Customer.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

customersRouter.get(
  "/:customerId",
  requirePermission(permissions.customerRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const [devices, tickets, invoices, payments, actions] = await Promise.all([
      DeviceOperationalCache.find({ customerId: customer.customerId }).lean(),
      SupportTicket.find({ customerId: customer.customerId }).sort({ createdAt: -1 }).limit(20).lean()
      ,
      BillingInvoice.find({ customerId: customer.customerId }).sort({ generatedAt: -1 }).limit(12).lean(),
      PaymentTransaction.find({ customerId: customer.customerId }).sort({ paidAt: -1, createdAt: -1 }).limit(12).lean(),
      AdminActionRequest.find({ targetType: "customer", targetId: customer.customerId }).sort({ createdAt: -1 }).limit(20).lean()
    ]);
    return ok(res, { ...customer, devices, tickets, invoices, payments, actions });
  })
);

customersRouter.patch(
  "/:customerId",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = updateCustomerSchema.parse(req.body || {});
    const customer = await Customer.findOneAndUpdate(
      { customerId: req.params.customerId },
      { $set: payload },
      { new: true }
    ).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    await auditFromRequest(req, {
      action: "customer.updated",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: Object.keys(payload)
    });
    return ok(res, customer);
  })
);

async function createActionRequest(req, res, actionType) {
  const payload = statusActionSchema.parse(req.body);
  const customer = await Customer.findOne({ customerId: req.params.customerId });
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  const existing = await AdminActionRequest.findOne({
    actionType,
    targetType: "customer",
    targetId: customer.customerId,
    status: { $in: ["pending", "approved"] }
  });
  if (existing) {
    throw new ApiError(409, "Similar action already in progress");
  }

  const request = await AdminActionRequest.create({
    actionType,
    targetType: "customer",
    targetId: customer.customerId,
    payload,
    requestedBy: req.admin._id,
    status: "approved"
  });

  const job = await adminActionsQueue.add(
    "customer-status-change",
    {
      actionRequestId: request._id.toString(),
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      actionType
    },
    {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000
      },
      jobId: `action:${request._id.toString()}`
    }
  );

  request.executionJobId = job.id;
  await request.save();

  await auditFromRequest(req, {
    action: `customer.${actionType}.requested`,
    entityType: "customer",
    entityId: customer.customerId,
    metadata: payload
  });

  return ok(res, {
    actionRequestId: request._id,
    status: request.status
  });
}

customersRouter.post(
  "/:customerId/suspend",
  requirePermission(permissions.customerSuspend),
  asyncHandler(async (req, res) => createActionRequest(req, res, "suspend"))
);

customersRouter.post(
  "/:customerId/resume",
  requirePermission(permissions.customerResume),
  asyncHandler(async (req, res) => createActionRequest(req, res, "resume"))
);

customersRouter.post(
  "/:customerId/retry-provisioning",
  requirePermission(permissions.customerRetryProvisioning),
  asyncHandler(async (req, res) => {
    const payload = retryProvisioningSchema.parse(req.body);
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    if (!allowedPresets.has(payload.presetName)) {
      throw new ApiError(400, "Preset not allowed");
    }
    const request = await AdminActionRequest.create({
      actionType: "retry_provisioning",
      targetType: "customer",
      targetId: customer.customerId,
      payload,
      requestedBy: req.admin._id,
      status: "approved"
    });
    await adminActionsQueue.add(
      "retry-provisioning",
      {
        actionRequestId: request._id.toString(),
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        presetName: payload.presetName
      },
      {
        attempts: 4,
        backoff: {
          type: "exponential",
          delay: 2000
        },
        jobId: `action:${request._id.toString()}`
      }
    );
    await auditFromRequest(req, {
      action: "customer.retry_provisioning.requested",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: payload
    });
    return ok(res, { actionRequestId: request._id, status: request.status });
  })
);

import { prisma } from "./prisma.js";

export async function logAudit(params: {
  tenantId: string;
  userId?: string;
  objectType: string;
  recordId: string;
  action: string;
  oldValues?: unknown;
  newValues?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      objectType: params.objectType,
      recordId: params.recordId,
      action: params.action,
      oldValues: params.oldValues as any,
      newValues: params.newValues as any,
    },
  });
}

export async function createAssociation(params: {
  tenantId: string;
  fromObjectType: string;
  fromRecordId: string;
  toObjectType: string;
  toRecordId: string;
  label?: string;
}) {
  await prisma.association.create({
    data: {
      tenantId: params.tenantId,
      fromObjectType: params.fromObjectType,
      fromRecordId: params.fromRecordId,
      toObjectType: params.toObjectType,
      toRecordId: params.toRecordId,
      associationLabel: params.label,
    },
  });
}

export async function notify(params: {
  tenantId: string;
  userId: string;
  message: string;
  link?: string;
}) {
  await prisma.notification.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      message: params.message,
      link: params.link,
    },
  });
}

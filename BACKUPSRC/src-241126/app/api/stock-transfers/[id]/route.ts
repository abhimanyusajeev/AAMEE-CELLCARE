import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  ForbiddenError,
  requireAuth,
  requireBranchAccess,
} from "@/lib/auth/session";

const nextActions = new Set([
  "APPROVE",
  "DISPATCH",
  "RECEIVE",
  "CANCEL",
]);

type TransferAction =
  | "APPROVE"
  | "DISPATCH"
  | "RECEIVE"
  | "CANCEL";

const MAX_TRANSACTION_RETRIES = 3;

function isRetryableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const action = body?.action as TransferAction | undefined;

  if (!action || !nextActions.has(action)) {
    return NextResponse.json(
      { message: "Invalid transfer action." },
      { status: 400 }
    );
  }

  /*
   * We only use the initial read for authorization information.
   * The actual transfer state is ALWAYS re-read inside the transaction.
   */
  const transferForAccess = await prisma.stockTransfer.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      requestedById: true,
      fromBranchId: true,
      toBranchId: true,
    },
  });

  if (!transferForAccess) {
    return NextResponse.json(
      { message: "Transfer not found." },
      { status: 404 }
    );
  }

  try {
    /*
     * Authorization
     */
    if (action === "APPROVE") {
      if (user.role !== "OWNER") {
        return NextResponse.json(
          { message: "Only an owner can approve stock transfers." },
          { status: 403 }
        );
      }
    }

    if (action === "DISPATCH") {
      await requireBranchAccess(
        user.id,
        user.role,
        transferForAccess.fromBranchId
      );
    }

    if (action === "RECEIVE") {
      await requireBranchAccess(
        user.id,
        user.role,
        transferForAccess.toBranchId
      );
    }

    if (action === "CANCEL") {
      if (
        user.role !== "OWNER" &&
        transferForAccess.requestedById !== user.id
      ) {
        return NextResponse.json(
          {
            message:
              "Only the requester or owner can cancel this transfer.",
          },
          { status: 403 }
        );
      }
    }

    /*
     * Serializable transaction + retry.
     *
     * This prevents two simultaneous APPROVE/DISPATCH/RECEIVE
     * requests from both acting on the same old status.
     */
    for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            /*
             * IMPORTANT:
             * Re-read the transfer INSIDE the transaction.
             */
            const transfer = await tx.stockTransfer.findUnique({
              where: { id },
              include: {
                items: {
                  include: {
                    productVariant: {
                      select: {
                        id: true,
                        reorderLevel: true,
                      },
                    },
                    serialDevice: {
                      select: {
                        id: true,
                        branchId: true,
                        status: true,
                      },
                    },
                  },
                },
                fromBranch: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                toBranch: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            });

            if (!transfer) {
              throw new Error("TRANSFER_NOT_FOUND");
            }

            /*
             * APPROVE
             */
            if (action === "APPROVE") {
              if (transfer.status !== "REQUESTED") {
                throw new Error("INVALID_STATUS");
              }

              const updated = await tx.stockTransfer.update({
                where: {
                  id: transfer.id,
                },
                data: {
                  status: "APPROVED",
                  approvedById: user.id,
                  approvedAt: new Date(),
                },
              });

              /*
               * Audit is INSIDE the same transaction.
               * Therefore a successful state change gets exactly
               * one corresponding audit record.
               */
              await tx.auditLog.create({
                data: {
                  branchId: transfer.fromBranchId,
                  actorId: user.id,
                  action: "STOCK_TRANSFER_APPROVE",
                  entityType: "StockTransfer",
                  entityId: transfer.id,
                  metadata: {
                    fromBranchId: transfer.fromBranchId,
                    toBranchId: transfer.toBranchId,
                  },
                },
              });

              return updated;
            }

            /*
             * CANCEL
             */
            if (action === "CANCEL") {
              if (
                !["REQUESTED", "APPROVED"].includes(
                  transfer.status
                )
              ) {
                throw new Error("INVALID_STATUS");
              }

              const updated = await tx.stockTransfer.update({
                where: {
                  id: transfer.id,
                },
                data: {
                  status: "CANCELLED",
                },
              });

              await tx.auditLog.create({
                data: {
                  branchId: transfer.fromBranchId,
                  actorId: user.id,
                  action: "STOCK_TRANSFER_CANCEL",
                  entityType: "StockTransfer",
                  entityId: transfer.id,
                  metadata: {
                    fromBranchId: transfer.fromBranchId,
                    toBranchId: transfer.toBranchId,
                  },
                },
              });

              return updated;
            }

            /*
             * DISPATCH
             */
            if (action === "DISPATCH") {
              if (transfer.status !== "APPROVED") {
                throw new Error("INVALID_STATUS");
              }

              for (const item of transfer.items) {
                const inventory =
                  await tx.inventoryItem.findUnique({
                    where: {
                      productVariantId_branchId: {
                        productVariantId:
                          item.productVariantId,
                        branchId: transfer.fromBranchId,
                      },
                    },
                  });

                if (!inventory) {
                  throw new Error("SOURCE_INVENTORY_NOT_FOUND");
                }

                if (inventory.quantity < item.quantity) {
                  throw new Error("INSUFFICIENT_STOCK");
                }

                await tx.inventoryItem.update({
                  where: {
                    id: inventory.id,
                  },
                  data: {
                    quantity: {
                      decrement: item.quantity,
                    },
                  },
                });

                await tx.stockMovement.create({
                  data: {
                    branchId: transfer.fromBranchId,
                    productVariantId:
                      item.productVariantId,
                    quantity: -item.quantity,
                    type: "BRANCH_TRANSFER",
                    referenceType: "StockTransfer",
                    referenceId: transfer.id,
                    note: `Dispatched to ${transfer.toBranch.name}`,
                    createdById: user.id,
                  },
                });

                /*
                 * A serial device becomes RESERVED while
                 * physically in transit.
                 */
                if (item.serialDeviceId) {
                  const serialDevice =
                    await tx.serialDevice.findUnique({
                      where: {
                        id: item.serialDeviceId,
                      },
                      select: {
                        id: true,
                        branchId: true,
                      },
                    });

                  if (!serialDevice) {
                    throw new Error("SERIAL_DEVICE_NOT_FOUND");
                  }

                  if (
                    serialDevice.branchId !==
                    transfer.fromBranchId
                  ) {
                    throw new Error(
                      "SERIAL_DEVICE_WRONG_BRANCH"
                    );
                  }

                  await tx.serialDevice.update({
                    where: {
                      id: serialDevice.id,
                    },
                    data: {
                      status: "RESERVED",
                    },
                  });
                }
              }

              const updated = await tx.stockTransfer.update({
                where: {
                  id: transfer.id,
                },
                data: {
                  status: "DISPATCHED",
                  dispatchedAt: new Date(),
                },
              });

              await tx.auditLog.create({
                data: {
                  branchId: transfer.fromBranchId,
                  actorId: user.id,
                  action: "STOCK_TRANSFER_DISPATCH",
                  entityType: "StockTransfer",
                  entityId: transfer.id,
                  metadata: {
                    fromBranchId: transfer.fromBranchId,
                    toBranchId: transfer.toBranchId,
                  },
                },
              });

              return updated;
            }

            /*
             * RECEIVE
             */
            if (action === "RECEIVE") {
              if (transfer.status !== "DISPATCHED") {
                throw new Error("INVALID_STATUS");
              }

              for (const item of transfer.items) {
                await tx.inventoryItem.upsert({
                  where: {
                    productVariantId_branchId: {
                      productVariantId:
                        item.productVariantId,
                      branchId: transfer.toBranchId,
                    },
                  },
                  update: {
                    quantity: {
                      increment: item.quantity,
                    },
                  },
                  create: {
                    branchId: transfer.toBranchId,
                    productVariantId:
                      item.productVariantId,
                    quantity: item.quantity,
                    reorderLevel:
                      item.productVariant.reorderLevel,
                  },
                });

                await tx.stockMovement.create({
                  data: {
                    branchId: transfer.toBranchId,
                    productVariantId:
                      item.productVariantId,
                    quantity: item.quantity,
                    type: "BRANCH_TRANSFER",
                    referenceType: "StockTransfer",
                    referenceId: transfer.id,
                    note: `Received from ${transfer.fromBranch.name}`,
                    createdById: user.id,
                  },
                });

                if (item.serialDeviceId) {
                  const serialDevice =
                    await tx.serialDevice.findUnique({
                      where: {
                        id: item.serialDeviceId,
                      },
                      select: {
                        id: true,
                        branchId: true,
                        status: true,
                      },
                    });

                  if (!serialDevice) {
                    throw new Error(
                      "SERIAL_DEVICE_NOT_FOUND"
                    );
                  }

                  await tx.serialDevice.update({
                    where: {
                      id: serialDevice.id,
                    },
                    data: {
                      branchId: transfer.toBranchId,
                      status: "AVAILABLE",
                    },
                  });
                }
              }

              const updated = await tx.stockTransfer.update({
                where: {
                  id: transfer.id,
                },
                data: {
                  status: "RECEIVED",
                  receivedById: user.id,
                  receivedAt: new Date(),
                },
              });

              await tx.auditLog.create({
                data: {
                  branchId: transfer.fromBranchId,
                  actorId: user.id,
                  action: "STOCK_TRANSFER_RECEIVE",
                  entityType: "StockTransfer",
                  entityId: transfer.id,
                  metadata: {
                    fromBranchId: transfer.fromBranchId,
                    toBranchId: transfer.toBranchId,
                  },
                },
              });

              return updated;
            }

            throw new Error("INVALID_ACTION");
          },
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 10000,
            timeout: 15000,
          }
        );

        return NextResponse.json({
          transfer: result,
        });
      } catch (error) {
        /*
         * Concurrent transactions can cause Prisma P2034.
         * Retry a small number of times.
         */
        if (
          isRetryableTransactionError(error) &&
          attempt < MAX_TRANSACTION_RETRIES
        ) {
          continue;
        }

        throw error;
      }
    }

    return NextResponse.json(
      {
        message:
          "Unable to complete the transfer action.",
      },
      { status: 500 }
    );
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { message: "Forbidden" },
        { status: 403 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "TRANSFER_NOT_FOUND"
    ) {
      return NextResponse.json(
        { message: "Transfer not found." },
        { status: 404 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "INVALID_STATUS"
    ) {
      return NextResponse.json(
        {
          message:
            "This transfer cannot be changed in its current status.",
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_STOCK"
    ) {
      return NextResponse.json(
        {
          message: "Insufficient source stock.",
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "SOURCE_INVENTORY_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          message:
            "Source inventory record was not found.",
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "SERIAL_DEVICE_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          message:
            "The serial device could not be found.",
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "SERIAL_DEVICE_WRONG_BRANCH"
    ) {
      return NextResponse.json(
        {
          message:
            "The serial device is no longer assigned to the source branch.",
        },
        { status: 409 }
      );
    }

    console.error("Stock transfer update failed:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to update transfer.",
      },
      { status: 500 }
    );
  }
}
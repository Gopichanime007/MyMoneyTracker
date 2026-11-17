/*
 * Android native backup compatibility adapter.
 *
 * This module is intentionally read-only with respect to the source payload.
 * It creates a legacy-shaped copy and retains the complete original backup
 * for recovery/audit. It never writes to localStorage.
 */
(function (globalScope) {
    "use strict";

    const REQUIRED = [
        "categories", "persons", "budgetPeriods", "budgetWallets",
        "budgetTransactions", "savingsTransactions", "unassignedTopups",
        "quotations", "orders", "documentRelations", "attachments",
        "transactionAttachments", "quotationEvents", "orderEvents",
        "noSeriesConfigs"
    ];

    function fail(message) {
        throw new Error("Android backup validation failed: " + message);
    }

    function isObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function idKey(value) {
        return value === null || value === undefined || value === "" ? "" : String(value);
    }

    function requireId(row, path) {
        const id = idKey(row && row.id);
        if (!id) fail(path + ".id is missing");
        return id;
    }

    function uniqueIndex(rows, label) {
        const index = new Map();
        rows.forEach((row, i) => {
            if (!isObject(row)) fail(label + "[" + i + "] must be an object");
            const id = requireId(row, label + "[" + i + "]");
            if (index.has(id)) fail(label + " contains duplicate ID " + id);
            index.set(id, row);
        });
        return index;
    }

    function amountFromMinor(value, path, allowNegative) {
        const n = Number(value);
        if (!Number.isFinite(n)) fail(path + " must be a finite paisa amount");
        if (!allowNegative && n < 0) fail(path + " cannot be negative");
        const rupees = n / 100;
        return Number(rupees.toFixed(2));
    }

    function dateFromEpoch(value, path, allowNull) {
        if ((value === null || value === undefined) && allowNull) return null;
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) fail(path + " must be a valid epoch-millisecond timestamp");
        const date = new Date(n);
        if (Number.isNaN(date.getTime())) fail(path + " is outside the supported date range");
        return date.toISOString();
    }

    function localDateFromEpoch(value, path, allowNull) {
        if ((value === null || value === undefined) && allowNull) return null;
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) fail(path + " must be a valid epoch-millisecond timestamp");
        const date = new Date(n);
        if (Number.isNaN(date.getTime())) fail(path + " is outside the supported date range");
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return yyyy + "-" + mm + "-" + dd;
    }

    function optionalTimestamp(value, path) {
        if (value === null || value === undefined || value === "") return null;
        if (typeof value === "number" || /^\d+$/.test(String(value))) {
            if (Number(value) === 0) return null;
            return dateFromEpoch(value, path, true);
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) fail(path + " is not a valid date");
        return parsed.toISOString();
    }

    function validateNativeBackup(root) {
        if (!isObject(root)) fail("root must be a JSON object");
        if (!isObject(root.meta) || root.meta.format !== "MyMoneyTracker" || Number(root.meta.schemaVersion) !== 1) {
            fail("unsupported format or schemaVersion (expected MyMoneyTracker schema 1)");
        }

        REQUIRED.forEach((key) => {
            if (!Array.isArray(root[key])) fail("required collection '" + key + "' must be an array");
            root[key].forEach((row, i) => {
                if (!isObject(row)) fail(key + "[" + i + "] must be an object");
            });
        });

        ["quotations", "orders"].forEach((collection) => {
            root[collection].forEach((row, i) => {
                ["items", "charges"].forEach((child) => {
                    if (!Array.isArray(row[child])) fail(collection + "[" + i + "]." + child + " must be an array");
                    row[child].forEach((entry, j) => {
                        if (!isObject(entry)) fail(collection + "[" + i + "]." + child + "[" + j + "] must be an object");
                    });
                });
            });
        });

        const categories = uniqueIndex(root.categories, "categories");
        const persons = uniqueIndex(root.persons, "persons");
        root.categories.forEach((row, i) => { if (typeof row.name !== "string" || !row.name.trim()) fail("categories[" + i + "].name is required"); });
        root.persons.forEach((row, i) => { if (typeof row.name !== "string" || !row.name.trim()) fail("persons[" + i + "].name is required"); });
        const periods = uniqueIndex(root.budgetPeriods, "budgetPeriods");
        const wallets = uniqueIndex(root.budgetWallets, "budgetWallets");
        const budgetTx = uniqueIndex(root.budgetTransactions, "budgetTransactions");
        const savingsTx = uniqueIndex(root.savingsTransactions, "savingsTransactions");
        const quotations = uniqueIndex(root.quotations, "quotations");
        const orders = uniqueIndex(root.orders, "orders");
        const attachments = uniqueIndex(root.attachments, "attachments");
        uniqueIndex(root.unassignedTopups, "unassignedTopups");
        uniqueIndex(root.documentRelations, "documentRelations");
        uniqueIndex(root.transactionAttachments, "transactionAttachments");
        uniqueIndex(root.quotationEvents, "quotationEvents");
        uniqueIndex(root.orderEvents, "orderEvents");

        const walletTypes = new Set(["CASH", "BANK", "UPI", "CARD", "OTHER"]);
        const periodStatuses = new Set(["ACTIVE", "CLOSED"]);
        const txnTypes = new Set(["EXPENSE", "INCOME", "TRANSFER", "TRANSFER_BACK", "REFUND", "ADJUSTMENT"]);
        const directions = new Set(["IN", "OUT"]);

        root.budgetPeriods.forEach((p, i) => {
            localDateFromEpoch(p.startDate, "budgetPeriods[" + i + "].startDate", false);
            localDateFromEpoch(p.endDate, "budgetPeriods[" + i + "].endDate", true);
            if (p.status != null && !periodStatuses.has(String(p.status).toUpperCase())) fail("budgetPeriods[" + i + "].status is invalid");
        });

        root.budgetWallets.forEach((w, i) => {
            if (!periods.has(idKey(w.budgetPeriodId))) fail("budgetWallets[" + i + "] references a missing budget period");
            if (w.walletType != null && !walletTypes.has(String(w.walletType).toUpperCase())) fail("budgetWallets[" + i + "].walletType is invalid");
            amountFromMinor(w.totalAllocated, "budgetWallets[" + i + "].totalAllocated", false);
        });

        root.budgetTransactions.forEach((tx, i) => {
            const path = "budgetTransactions[" + i + "]";
            if (!wallets.has(idKey(tx.budgetWalletId))) fail(path + " references a missing budget wallet");
            const type = String(tx.type || "").toUpperCase();
            const direction = String(tx.direction || "").toUpperCase();
            if (!txnTypes.has(type)) fail(path + ".type is invalid");
            if (!directions.has(direction)) fail(path + ".direction is invalid");
            if ((type === "EXPENSE" || type === "TRANSFER" || type === "TRANSFER_BACK") && direction !== "OUT") fail(path + " must use OUT direction for " + type);
            if ((type === "INCOME" || type === "REFUND") && direction !== "IN") fail(path + " must use IN direction for " + type);
            amountFromMinor(tx.amount, path + ".amount", false);
            dateFromEpoch(tx.date, path + ".date", false);
            if (tx.categoryId != null && !categories.has(idKey(tx.categoryId))) fail(path + " references a missing category");
            if (tx.personId != null && !persons.has(idKey(tx.personId))) fail(path + " references a missing person");
            if (type === "TRANSFER" && tx.personId == null) fail(path + " requires personId for TRANSFER");
            if (type === "REFUND") {
                if (tx.direction !== "IN") fail(path + " REFUND direction must be IN");
                if (tx.linkedTransactionId == null || !budgetTx.has(idKey(tx.linkedTransactionId))) fail(path + " REFUND must link to an existing budget transaction");
                if (!tx.refundType || !tx.resolutionType) fail(path + " REFUND requires refundType and resolutionType");
                if (!new Set(["FULL", "PARTIAL", "LOSS"]).has(String(tx.resolutionType).toUpperCase())) fail(path + " REFUND has an invalid resolutionType");
                if (String(tx.refundType).toUpperCase() === "CASHBACK") fail(path + " CASHBACK must be represented as a separate income transaction");
                const original = budgetTx.get(idKey(tx.linkedTransactionId));
                if (original && (idKey(original.budgetWalletId) !== idKey(tx.budgetWalletId) || !["EXPENSE", "TRANSFER"].includes(String(original.type || "").toUpperCase()))) {
                    fail(path + " REFUND must link to an EXPENSE or TRANSFER in the same wallet");
                }
            }
        });

        root.savingsTransactions.forEach((tx, i) => {
            const path = "savingsTransactions[" + i + "]";
            amountFromMinor(tx.amount, path + ".amount", true);
            dateFromEpoch(tx.date, path + ".date", false);
            if (tx.targetBudgetId != null && !wallets.has(idKey(tx.targetBudgetId))) fail(path + " references a missing target budget wallet");
            if (tx.budgetWalletId != null && !wallets.has(idKey(tx.budgetWalletId))) fail(path + " references a missing budget wallet");
            if (tx.sourceId != null && !savingsTx.has(idKey(tx.sourceId))) fail(path + " references a missing savings source");
        });

        root.unassignedTopups.forEach((row, i) => {
            const path = "unassignedTopups[" + i + "]";
            if (!wallets.has(idKey(row.budgetWalletId))) fail(path + " references a missing budget wallet");
            amountFromMinor(row.amount, path + ".amount", false);
            dateFromEpoch(row.date, path + ".date", false);
        });

        root.budgetTransactions.forEach((tx, i) => {
            if (tx.linkedTransactionId != null &&
                !budgetTx.has(idKey(tx.linkedTransactionId)) &&
                !savingsTx.has(idKey(tx.linkedTransactionId))) {
                fail("budgetTransactions[" + i + "] references a missing linked transaction");
            }
            if (tx.linkedSavingsTransactionId != null && !savingsTx.has(idKey(tx.linkedSavingsTransactionId))) {
                fail("budgetTransactions[" + i + "] references a missing linked savings transaction");
            }
        });

        root.quotations.forEach((q, i) => {
            q.items.forEach((item, j) => {
                if (idKey(item.quotationId) !== idKey(q.id)) fail("quotations[" + i + "].items[" + j + "] has a mismatched quotationId");
            });
            q.charges.forEach((charge, j) => {
                if (idKey(charge.quotationId) !== idKey(q.id)) fail("quotations[" + i + "].charges[" + j + "] has a mismatched quotationId");
            });
        });
        root.quotations.forEach((q, i) => {
            ["subtotal", "discountTotal", "taxableAmount", "taxTotal", "additionalChargeTotal", "grandTotal", "total"].forEach((field) => {
                amountFromMinor(q[field], "quotations[" + i + "]." + field, false);
            });
            q.items.forEach((item, j) => {
                if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) fail("quotations[" + i + "].items[" + j + "].quantity must be positive");
                amountFromMinor(item.unitPrice, "quotations[" + i + "].items[" + j + "].unitPrice", false);
                amountFromMinor(item.totalPrice, "quotations[" + i + "].items[" + j + "].totalPrice", false);
            });
            q.charges.forEach((charge, j) => {
                amountFromMinor(charge.amount, "quotations[" + i + "].charges[" + j + "].amount", false);
                if (!Number.isFinite(Number(charge.value || 0)) || Number(charge.value || 0) < 0) fail("quotations[" + i + "].charges[" + j + "].value is invalid");
                if (String(charge.applyTo || "ALL_ITEMS").toUpperCase() === "SPECIFIC_ITEM" && !q.items.some((item) => idKey(item.id) === idKey(charge.targetItemId))) fail("quotations[" + i + "].charges[" + j + "] references a missing target item");
            });
        });
        root.orders.forEach((o, i) => {
            if (o.quotationId != null && !quotations.has(idKey(o.quotationId))) fail("orders[" + i + "] references a missing quotation");
            ["subtotal", "gst", "total", "plannedAmount"].forEach((field) => {
                amountFromMinor(o[field], "orders[" + i + "]." + field, false);
            });
            o.items.forEach((item, j) => {
                if (idKey(item.orderId) !== idKey(o.id)) fail("orders[" + i + "].items[" + j + "] has a mismatched orderId");
                if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) fail("orders[" + i + "].items[" + j + "].quantity must be positive");
                amountFromMinor(item.unitPrice, "orders[" + i + "].items[" + j + "].unitPrice", false);
                amountFromMinor(item.totalPrice, "orders[" + i + "].items[" + j + "].totalPrice", false);
            });
            o.charges.forEach((charge, j) => {
                if (idKey(charge.orderId) !== idKey(o.id)) fail("orders[" + i + "].charges[" + j + "] has a mismatched orderId");
                amountFromMinor(charge.amount, "orders[" + i + "].charges[" + j + "].amount", false);
                if (!Number.isFinite(Number(charge.value || 0)) || Number(charge.value || 0) < 0) fail("orders[" + i + "].charges[" + j + "].value is invalid");
                if (String(charge.applyTo || "ALL_ITEMS").toUpperCase() === "SPECIFIC_ITEM" && !o.items.some((item) => idKey(item.id) === idKey(charge.targetItemId))) fail("orders[" + i + "].charges[" + j + "] references a missing target item");
            });
        });
        root.documentRelations.forEach((row, i) => {
            if (!quotations.has(idKey(row.quotationId))) fail("documentRelations[" + i + "] references a missing quotation");
            if (row.orderId != null && !orders.has(idKey(row.orderId))) fail("documentRelations[" + i + "] references a missing order");
        });
        root.quotationEvents.forEach((row, i) => {
            if (!quotations.has(idKey(row.quotationId))) fail("quotationEvents[" + i + "] references a missing quotation");
        });
        root.orderEvents.forEach((row, i) => {
            if (!orders.has(idKey(row.orderId))) fail("orderEvents[" + i + "] references a missing order");
        });
        root.transactionAttachments.forEach((row, i) => {
            if (!attachments.has(idKey(row.attachmentId))) fail("transactionAttachments[" + i + "] references a missing attachment");
            if (!budgetTx.has(idKey(row.transactionId)) && !savingsTx.has(idKey(row.transactionId))) fail("transactionAttachments[" + i + "] references a missing transaction");
        });

        return { categories, persons, periods, wallets, quotations, orders };
    }

    function periodKeyFor(period) {
        const start = localDateFromEpoch(period.startDate, "budget period startDate", false);
        let end = localDateFromEpoch(period.endDate, "budget period endDate", true);
        if (!end) {
            const effectiveEnd = new Date();
            effectiveEnd.setHours(0, 0, 0, 0);
            effectiveEnd.setDate(effectiveEnd.getDate() + Math.max(0, Math.floor(Number(period.extraDays || 0))));
            end = effectiveEnd.getFullYear() + "-" + String(effectiveEnd.getMonth() + 1).padStart(2, "0") + "-" + String(effectiveEnd.getDate()).padStart(2, "0");
        }
        return start + "_to_" + end;
    }

    function legacyTxnType(type) {
        const map = {
            EXPENSE: "expense",
            INCOME: "income",
            TRANSFER: "transfer",
            TRANSFER_BACK: "transfer_back",
            REFUND: "refund",
            ADJUSTMENT: "adjustment"
        };
        return map[String(type || "").toUpperCase()] || null;
    }

    function signedBudgetDelta(tx, path) {
        const type = String(tx.type || "").toUpperCase();
        const direction = String(tx.direction || "").toUpperCase();
        const amount = amountFromMinor(tx.amount, path + ".amount", false);

        if (type === "EXPENSE" || type === "TRANSFER" || type === "TRANSFER_BACK") {
            if (direction !== "OUT") fail(path + " has an invalid direction for " + type);
            return -amount;
        }
        if (type === "INCOME" || type === "REFUND") {
            if (direction !== "IN") fail(path + " has an invalid direction for " + type);
            return amount;
        }
        return direction === "IN" ? amount : -amount;
    }

    function adapt(root) {
        const indexes = validateNativeBackup(root);
        const periodKeyById = new Map();
        const periodById = indexes.periods;

        root.budgetPeriods.forEach((period) => {
            periodKeyById.set(idKey(period.id), periodKeyFor(period));
        });

        const categoryNameById = new Map(root.categories.map((row) => [idKey(row.id), String(row.name || "").trim()]));
        const personNameById = new Map(root.persons.map((row) => [idKey(row.id), String(row.name || "").trim()]));

        const budgetPeriods = root.budgetPeriods.map((period, i) => {
            const start = localDateFromEpoch(period.startDate, "budgetPeriods[" + i + "].startDate", false);
            const end = localDateFromEpoch(period.endDate, "budgetPeriods[" + i + "].endDate", true);
            const key = periodKeyById.get(idKey(period.id));
            return {
                id: period.id,
                start,
                ...(end ? { end } : {}),
                periodKey: key,
                status: String(period.status || "ACTIVE").toLowerCase(),
                extraDays: Number(period.extraDays || 0),
                documentNumber: period.documentNumber || null,
                createdAt: optionalTimestamp(period.createdAt, "budgetPeriods[" + i + "].createdAt"),
                updatedAt: optionalTimestamp(period.updatedAt, "budgetPeriods[" + i + "].updatedAt")
            };
        });

        const budgets = root.budgetWallets.map((wallet, i) => {
            const period = periodById.get(idKey(wallet.budgetPeriodId));
            const key = periodKeyById.get(idKey(wallet.budgetPeriodId));
            return {
                id: wallet.id,
                type: "budget",
                budgetId: wallet.id,
                legacyId: wallet.id,
                nativeWalletId: wallet.id,
                sourceId: wallet.budgetPeriodId,
                totalAllocated: amountFromMinor(wallet.totalAllocated, "budgetWallets[" + i + "].totalAllocated", false),
                entity: "Budget Wallet",
                note: wallet.documentNumber || ("Android " + String(wallet.walletType || "CASH") + " Wallet"),
                periodKey: key,
                monthKey: null,
                isBudgetWallet: true,
                walletType: String(wallet.walletType || "CASH").toLowerCase(),
                createdAt: optionalTimestamp(wallet.createdAt, "budgetWallets[" + i + "].createdAt"),
                updatedAt: optionalTimestamp(wallet.updatedAt, "budgetWallets[" + i + "].updatedAt")
            };
        });

        const attachmentIdsByTransaction = new Map();
        root.transactionAttachments.forEach((link) => {
            const key = idKey(link.transactionId);
            if (!attachmentIdsByTransaction.has(key)) attachmentIdsByTransaction.set(key, []);
            attachmentIdsByTransaction.get(key).push(link.attachmentId);
        });

        const expenses = root.budgetTransactions.map((tx, i) => {
            const path = "budgetTransactions[" + i + "]";
            const wallet = indexes.wallets.get(idKey(tx.budgetWalletId));
            const linkedAttachmentIds = attachmentIdsByTransaction.get(idKey(tx.id)) || [];
            const periodKey = periodKeyById.get(idKey(wallet.budgetPeriodId));
            const date = dateFromEpoch(tx.date, path + ".date", false);
            const category = tx.categoryId == null ? null : categoryNameById.get(idKey(tx.categoryId));
            const person = tx.personId == null ? null : personNameById.get(idKey(tx.personId));
            const type = legacyTxnType(tx.type);
            if (!type) fail(path + ".type cannot be mapped");
            const amount = signedBudgetDelta(tx, path);

            return {
                id: tx.id,
                type,
                amount,
                category: category || (type === "adjustment" ? "Adjustment" : "Others"),
                purpose: tx.purpose || tx.note || "",
                note: tx.note || "",
                budgetId: tx.budgetWalletId,
                budgetWalletId: tx.budgetWalletId,
                nativeWalletId: tx.budgetWalletId,
                paymentType: tx.paymentMethod || null,
                entity: String(wallet.walletType || "CASH").toLowerCase(),
                person: person || null,
                date,
                monthKey: date.slice(0, 7),
                periodKey,
                createdAt: optionalTimestamp(tx.createdAt, path + ".createdAt"),
                updatedAt: optionalTimestamp(tx.updatedAt, path + ".updatedAt"),
                linkedTransactionId: tx.linkedTransactionId || null,
                linkedSavingsTransactionId: tx.linkedSavingsTransactionId || null,
                refundType: tx.refundType || null,
                resolutionType: tx.resolutionType || null,
                resolvedAmount: tx.resolvedAmount == null ? 0 : amountFromMinor(tx.resolvedAmount, path + ".resolvedAmount", false),
                lossAmount: tx.lossAmount == null ? 0 : amountFromMinor(tx.lossAmount, path + ".lossAmount", false),
                attachmentId: linkedAttachmentIds[0] || null,
                attachmentIds: linkedAttachmentIds,
                attachmentStatus: linkedAttachmentIds.length ? "missing" : "none",
                attachmentError: linkedAttachmentIds.length ? "Attachment binary is not included in the Android JSON backup." : null,
                documentNumber: tx.documentNumber || null,
                nativeCategoryId: tx.categoryId || null,
                nativePersonId: tx.personId || null,
                nativeType: tx.type,
                nativeDirection: tx.direction
            };
        });

        const savings = root.savingsTransactions.map((tx, i) => {
            const path = "savingsTransactions[" + i + "]";
            const date = dateFromEpoch(tx.date, path + ".date", false);
            return {
                id: tx.id,
                type: String(tx.type || "").toLowerCase(),
                amount: amountFromMinor(tx.amount, path + ".amount", true),
                sourceId: tx.sourceId == null ? null : tx.sourceId,
                entity: tx.entity || null,
                paymentType: tx.paymentType || null,
                person: tx.person || null,
                note: tx.note || "",
                purpose: tx.note || "",
                date,
                monthKey: tx.monthKey || date.slice(0, 7),
                periodKey: tx.periodKey || null,
                createdAt: optionalTimestamp(tx.createdAt, path + ".createdAt"),
                updatedAt: optionalTimestamp(tx.updatedAt, path + ".updatedAt"),
                attachmentId: tx.attachmentId || null,
                attachmentStatus: tx.attachmentId ? "missing" : "none",
                attachmentError: tx.attachmentId ? "Attachment binary is not included in the Android JSON backup." : null,
                linkedTransactionId: tx.linkedTransactionId || null,
                linkedTopupId: tx.linkedTopupId || null,
                refundType: tx.refundType || null,
                resolutionType: tx.resolutionType || null,
                resolvedAmount: tx.resolvedAmount == null ? 0 : amountFromMinor(tx.resolvedAmount, path + ".resolvedAmount", false),
                lossAmount: tx.lossAmount == null ? 0 : amountFromMinor(tx.lossAmount, path + ".lossAmount", false),
                targetBudgetId: tx.targetBudgetId || null,
                budgetWalletId: tx.budgetWalletId || null,
                destinationType: tx.destinationType || null,
                destination: tx.destination || null,
                documentNumber: tx.documentNumber || null,
                status: tx.status || null,
                archiveReason: tx.archiveReason || null,
                archivedAt: optionalTimestamp(tx.archivedAt, path + ".archivedAt"),
                archivedBy: tx.archivedBy || null
            };
        });

        const unassignedTopups = root.unassignedTopups.map((row, i) => {
            const topupAmount = amountFromMinor(row.amount, "unassignedTopups[" + i + "].amount", false);
            const assignments = root.savingsTransactions
                .filter((tx) => String(tx.type || "").toLowerCase() === "unassigned_topup_resolution" && idKey(tx.linkedTopupId) === idKey(row.id))
                .map((tx, j) => ({
                    sourceId: tx.sourceId || null,
                    amount: Math.abs(amountFromMinor(tx.amount, "unassignedTopups[" + i + "].resolution[" + j + "].amount", true)),
                    date: dateFromEpoch(tx.date, "unassignedTopups[" + i + "].resolution[" + j + "].date", false),
                    method: String(tx.note || "").toLowerCase().includes("auto-assigned") ? "auto" : "manual",
                    savingsEntryId: tx.id
                }));
            const assignedAmount = Number(assignments.reduce((sum, assignment) => sum + assignment.amount, 0).toFixed(2));
            if (assignedAmount - topupAmount > 0.01) fail("unassignedTopups[" + i + "] has linked resolutions greater than its original amount");
            const status = assignedAmount >= topupAmount && topupAmount > 0
                ? "assigned" : (assignedAmount > 0 ? "partially_assigned" : (row.parked ? "parked" : "unassigned"));
            return {
                id: row.id,
                budgetWalletId: row.budgetWalletId,
                amount: topupAmount,
                date: dateFromEpoch(row.date, "unassignedTopups[" + i + "].date", false),
                parked: !!row.parked,
                status,
                assignedAmount,
                assignments,
                note: row.note || "",
                createdAt: optionalTimestamp(row.createdAt, "unassignedTopups[" + i + "].createdAt"),
                updatedAt: optionalTimestamp(row.updatedAt, "unassignedTopups[" + i + "].updatedAt")
            };
        });

        const categories = root.categories.map((row) => String(row.name || "").trim()).filter(Boolean);
        const persons = root.persons.map((row) => String(row.name || "").trim()).filter(Boolean);

        const quotationEventsById = new Map();
        root.quotationEvents.forEach((event, i) => {
            const key = idKey(event.quotationId);
            if (!quotationEventsById.has(key)) quotationEventsById.set(key, []);
            quotationEventsById.get(key).push({
                at: optionalTimestamp(event.timestamp, "quotationEvents[" + i + "].timestamp"),
                action: String(event.eventType || "updated").toLowerCase(),
                status: String(event.resultingStatus || "draft").toLowerCase(),
                note: event.details || ""
            });
        });

        function mapDocumentCharge(charge, path) {
            const chargeName = String(charge.name || "Charge");
            const normalizedName = chargeName.toLowerCase();
            const legacyType = normalizedName.includes("gst") ? "gst"
                : normalizedName.includes("discount") ? "discount"
                : normalizedName.includes("delivery") ? "delivery" : "custom";
            const nativeMode = String(charge.type || "").toUpperCase();
            const mode = nativeMode === "PERCENTAGE" ? "percent" : "fixed";
            const value = mode === "percent"
                ? Number(charge.value || 0)
                : amountFromMinor(charge.amount, path + ".amount", false);
            const applyTo = String(charge.applyTo || "ALL_ITEMS").toUpperCase();
            if (applyTo === "SPECIFIC_ITEM" && !charge.targetItemId) fail(path + " is missing targetItemId");
            return {
                id: charge.id,
                quotationId: charge.quotationId || null,
                orderId: charge.orderId || null,
                label: chargeName,
                name: chargeName,
                type: legacyType,
                mode,
                value,
                amount: amountFromMinor(charge.amount, path + ".amount", false),
                adjustmentType: String(charge.adjustment || "ADD").toUpperCase() === "DEDUCT" ? "deduct" : "add",
                appliesTo: applyTo === "SPECIFIC_ITEM" ? String(charge.targetItemId) : "all",
                targetItemId: charge.targetItemId || null,
                createdAt: optionalTimestamp(charge.createdAt, path + ".createdAt"),
                updatedAt: optionalTimestamp(charge.updatedAt, path + ".updatedAt")
            };
        }

        const quotationItems = [];
        const quotationCharges = [];
        const quotationRegistry = root.quotations.map((q, i) => {
            const items = q.items.map((item, j) => {
                const mapped = {
                    id: item.id,
                    quotationId: q.id,
                    description: item.description || "",
                    qty: Number(item.quantity || 0),
                    price: amountFromMinor(item.unitPrice, "quotations[" + i + "].items[" + j + "].unitPrice", false),
                    total: amountFromMinor(item.totalPrice, "quotations[" + i + "].items[" + j + "].totalPrice", false),
                    unit: item.unit || null,
                    source: item.source || null,
                    productLink: item.productLink || null
                };
                quotationItems.push(mapped);
                return mapped;
            });
            const charges = q.charges.map((charge, j) => {
                const mapped = mapDocumentCharge(charge, "quotations[" + i + "].charges[" + j + "]");
                quotationCharges.push(mapped);
                return mapped;
            });
            return {
                id: q.id,
                quotationNo: q.quotationNo,
                purpose: q.purpose || "",
                status: String(q.status || "DRAFT").toLowerCase(),
                createdAt: optionalTimestamp(q.createdAt, "quotations[" + i + "].createdAt"),
                updatedAt: optionalTimestamp(q.updatedAt, "quotations[" + i + "].updatedAt"),
                validUntil: optionalTimestamp(q.validUntil, "quotations[" + i + "].validUntil"),
                fundingSourceType: q.fundingSourceType || null,
                fundingSourceId: q.fundingSourceId || null,
                fundingSourceName: q.fundingSourceName || null,
                subtotal: amountFromMinor(q.subtotal, "quotations[" + i + "].subtotal", false),
                discountTotal: amountFromMinor(q.discountTotal, "quotations[" + i + "].discountTotal", false),
                taxableAmount: amountFromMinor(q.taxableAmount, "quotations[" + i + "].taxableAmount", false),
                taxTotal: amountFromMinor(q.taxTotal, "quotations[" + i + "].taxTotal", false),
                additionalChargeTotal: amountFromMinor(q.additionalChargeTotal, "quotations[" + i + "].additionalChargeTotal", false),
                grandTotal: amountFromMinor(q.grandTotal, "quotations[" + i + "].grandTotal", false),
                total: amountFromMinor(q.total, "quotations[" + i + "].total", false),
                itemCount: items.length,
                items,
                charges,
                history: quotationEventsById.get(idKey(q.id)) || []
            };
        });

        const orderEventsById = new Map();
        root.orderEvents.forEach((event, i) => {
            const key = idKey(event.orderId);
            if (!orderEventsById.has(key)) orderEventsById.set(key, []);
            orderEventsById.get(key).push({
                at: optionalTimestamp(event.timestamp, "orderEvents[" + i + "].timestamp"),
                from: null,
                to: String(event.resultingStatus || "").toLowerCase(),
                note: event.details || event.eventType || ""
            });
        });

        const orders = root.orders.map((order, i) => {
            const items = order.items.map((item, j) => ({
                id: item.id,
                orderId: order.id,
                description: item.description || "",
                qty: Number(item.quantity || 0),
                price: amountFromMinor(item.unitPrice, "orders[" + i + "].items[" + j + "].unitPrice", false),
                total: amountFromMinor(item.totalPrice, "orders[" + i + "].items[" + j + "].totalPrice", false),
                unit: item.unit || null,
                source: item.source || null,
                productLink: item.productLink || null
            }));
            const charges = order.charges.map((charge, j) => mapDocumentCharge(charge, "orders[" + i + "].charges[" + j + "]"));
            return {
                id: order.id,
                orderNo: order.orderNo,
                quotationId: order.quotationId || null,
                quotationNo: order.quotationNo || null,
                status: String(order.status || "DRAFT").toLowerCase(),
                subtotal: amountFromMinor(order.subtotal, "orders[" + i + "].subtotal", false),
                gst: amountFromMinor(order.gst, "orders[" + i + "].gst", false),
                total: amountFromMinor(order.total, "orders[" + i + "].total", false),
                plannedAmount: amountFromMinor(order.plannedAmount, "orders[" + i + "].plannedAmount", false),
                sourceId: order.sourceId || null,
                sourceName: order.sourceName || null,
                sourceType: order.sourceType ? String(order.sourceType).toLowerCase() : null,
                purpose: order.purpose || "",
                paymentType: order.paymentType || null,
                financialPosted: !!order.financialPosted,
                financialEntryId: order.financialEntryId || null,
                cancellationReason: order.cancellationReason || null,
                cancelledAt: optionalTimestamp(order.cancelledAt, "orders[" + i + "].cancelledAt"),
                createdAt: optionalTimestamp(order.createdAt, "orders[" + i + "].createdAt"),
                updatedAt: optionalTimestamp(order.updatedAt, "orders[" + i + "].updatedAt"),
                statusHistory: orderEventsById.get(idKey(order.id)) || [],
                items,
                charges
            };
        });

        const documentRelations = root.documentRelations.map((relation, i) => ({
            quotationId: relation.quotationId,
            orderId: relation.orderId || null,
            relationshipStatus: String(relation.relationshipStatus || "unlinked").toLowerCase(),
            updatedAt: optionalTimestamp(relation.createdAt, "documentRelations[" + i + "].createdAt")
        }));

        const noSeriesConfig = {};
        root.noSeriesConfigs.forEach((row) => {
            const kind = String(row.documentType || "").toLowerCase();
            const target = kind.includes("quotation") || kind.includes("quote") ? "quotation"
                : kind.includes("order") ? "order" : null;
            if (!target) return;
            noSeriesConfig[target] = {
                prefix: String(row.prefix || (target === "quotation" ? "QT" : "ORD")),
                startNumber: Number(row.startNumber || 0),
                lastNumber: Number(row.lastNumber || 0)
            };
        });

        const quotations = {
            quotationData: null,
            quotationItems,
            quotationCharges,
            quotationRegistry,
            quotationMeta: null,
            activeQuotationId: null,
            documentRelations,
            noSeriesConfig: Object.keys(noSeriesConfig).length ? noSeriesConfig : null
        };

        const nativeArchive = JSON.parse(JSON.stringify(root));
        const nativeSummary = {
            schemaVersion: Number(root.meta.schemaVersion),
            exportedAt: root.meta.exportedAt || null,
            counts: REQUIRED.reduce((out, key) => {
                out[key] = root[key].length;
                return out;
            }, {})
        };

        return {
            payload: {
                expenses,
                budgets,
                savings,
                budgetPeriods,
                categories,
                persons,
                unassignedTopups,
                orders,
                quotations,
                settings: {},
                meta: {
                    exportedAt: root.meta.exportedAt || new Date().toISOString(),
                    version: "2.0.0"
                },
                __nativeAndroidBackup: true,
                __nativeBackupArchive: nativeArchive,
                __nativeBackupSummary: nativeSummary,
                __preserveSettings: true,
                __preserveDocuments: false
            },
            summary: nativeSummary
        };
    }

    globalScope.MyMoneyAndroidBackupAdapter = {
        isNative: function (root) {
            return isObject(root) && isObject(root.meta) &&
                root.meta.format === "MyMoneyTracker" &&
                Object.prototype.hasOwnProperty.call(root.meta, "schemaVersion");
        },
        adapt,
        validate: validateNativeBackup
    };
})(typeof window !== "undefined" ? window : globalThis);

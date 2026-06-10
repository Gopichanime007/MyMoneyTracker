(function registerDocumentWorkflow(globalScope) {
  const QUOTATION_REGISTRY_KEY = "quotationRegistry";
  const QUOTATION_META_KEY = "quotationMeta";
  const ACTIVE_QUOTATION_KEY = "activeQuotationId";
  const DOCUMENT_RELATIONS_KEY = "documentRelations";
  const NO_SERIES_CONFIG_KEY = "noSeriesConfig";
  const LEGACY_NO_SERIES_KEY = "docNoSeriesConfig";
  const LEGACY_RELATIONS_KEY = "quotationOrderRelations";

  const DEFAULTS = {
    quotation: { prefix: "QT", startNumber: 1000, lastNumber: 10000 },
    order: { prefix: "ORD", startNumber: 1000, lastNumber: 100000 }
  };

  function sanitizePrefix(value, fallback) {
    const cleaned = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    return cleaned || fallback;
  }

  function sanitizeNumber(value, fallback) {
    const next = Number(value);
    if (!Number.isFinite(next)) return fallback;
    return Math.max(0, Math.floor(next));
  }

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed == null ? fallback : parsed;
    } catch (_err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeSeriesConfig(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const normalized = { quotation: {}, order: {} };

    ["quotation", "order"].forEach((kind) => {
      const fallback = DEFAULTS[kind];
      const current = source[kind] && typeof source[kind] === "object" ? source[kind] : {};

      normalized[kind] = {
        prefix: sanitizePrefix(current.prefix, fallback.prefix),
        startNumber: sanitizeNumber(current.startNumber, fallback.startNumber),
        lastNumber: sanitizeNumber(current.lastNumber, fallback.lastNumber)
      };

      if (normalized[kind].lastNumber < normalized[kind].startNumber) {
        normalized[kind].lastNumber = normalized[kind].startNumber;
      }
    });

    return normalized;
  }

  function getNoSeriesConfig() {
    const raw = readJson(NO_SERIES_CONFIG_KEY, readJson(LEGACY_NO_SERIES_KEY, null));
    const normalized = normalizeSeriesConfig(raw);
    if (!raw) writeJson(NO_SERIES_CONFIG_KEY, normalized);
    return normalized;
  }

  function saveNoSeriesConfig(nextConfig) {
    const normalized = normalizeSeriesConfig(nextConfig);
    writeJson(NO_SERIES_CONFIG_KEY, normalized);
    return normalized;
  }

  function updateNoSeriesConfig(mutator) {
    const config = getNoSeriesConfig();
    const draft = JSON.parse(JSON.stringify(config));
    mutator(draft);
    return saveNoSeriesConfig(draft);
  }

  function getSeriesPreview(configInput) {
    const cfg = normalizeSeriesConfig(configInput || getNoSeriesConfig());
    return {
      quotation: `${cfg.quotation.prefix}-${cfg.quotation.lastNumber + 1}`,
      order: `${cfg.order.prefix}-${cfg.order.lastNumber + 1}`
    };
  }

  function getQuotationRegistry() {
    const rows = readJson(QUOTATION_REGISTRY_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function saveQuotationRegistry(rows) {
    writeJson(QUOTATION_REGISTRY_KEY, Array.isArray(rows) ? rows : []);
  }

  function getOrderRows() {
    const rows = readJson("orders", []);
    return Array.isArray(rows) ? rows : [];
  }

  function findOrderForQuotation(quotationId, options = {}) {
    const qId = String(quotationId || "");
    if (!qId) return null;

    const orders = getOrderRows();
    const preferredOrderId = String(options.orderId || "");
    if (preferredOrderId) {
      const byPreferred = orders.find((row) => String(row && row.id || "") === preferredOrderId);
      if (byPreferred) return byPreferred;
    }

    const byQuotationId = orders.find((row) => String(row && row.quotationId || "") === qId);
    if (byQuotationId) return byQuotationId;

    const relation = getRelationByQuotationId(qId);
    const relationOrderId = String(relation && relation.orderId || "");
    if (relationOrderId) {
      const byRelation = orders.find((row) => String(row && row.id || "") === relationOrderId);
      if (byRelation) return byRelation;
    }

    return null;
  }

  function collectUsedNumbers(kind) {
    const set = new Set();
    if (kind === "quotation") {
      getQuotationRegistry().forEach((row) => {
        if (row && row.quotationNo) set.add(String(row.quotationNo));
      });
    } else {
      getOrderRows().forEach((row) => {
        if (row && row.orderNo) set.add(String(row.orderNo));
      });
    }
    return set;
  }

  function generateDocumentNumber(kind) {
    const key = kind === "order" ? "order" : "quotation";
    const used = collectUsedNumbers(key);

    let nextNo = "";
    updateNoSeriesConfig((cfg) => {
      const branch = cfg[key];
      let candidate = sanitizeNumber(branch.lastNumber, DEFAULTS[key].lastNumber);
      let attempts = 0;

      do {
        candidate += 1;
        nextNo = `${branch.prefix}-${candidate}`;
        attempts += 1;
      } while (used.has(nextNo) && attempts < 10000);

      branch.lastNumber = candidate;
    });

    return nextNo;
  }

  function getRelations() {
    const rows = readJson(DOCUMENT_RELATIONS_KEY, readJson(LEGACY_RELATIONS_KEY, []));
    return Array.isArray(rows) ? rows : [];
  }

  function saveRelations(rows) {
    writeJson(DOCUMENT_RELATIONS_KEY, Array.isArray(rows) ? rows : []);
  }

  function upsertRelation(input) {
    const relation = {
      quotationId: input && input.quotationId ? String(input.quotationId) : "",
      orderId: input && input.orderId ? String(input.orderId) : null,
      relationshipStatus: input && input.relationshipStatus ? String(input.relationshipStatus) : "unlinked",
      updatedAt: new Date().toISOString()
    };
    if (!relation.quotationId) return null;

    const rows = getRelations();
    const idx = rows.findIndex((row) => String(row.quotationId) === relation.quotationId);
    if (idx === -1) {
      rows.push(relation);
    } else {
      rows[idx] = Object.assign({}, rows[idx], relation);
    }
    saveRelations(rows);
    return relation;
  }

  function getRelationByQuotationId(quotationId) {
    const qId = String(quotationId || "");
    if (!qId) return null;
    return getRelations().find((row) => String(row.quotationId) === qId) || null;
  }

  function getFundingSourceSummaries(type) {
    const selectedType = String(type || "").toLowerCase();

    if (selectedType === "savings") {
      const rows = readJson("savingsTransactions", []);
      const list = Array.isArray(rows) ? rows : [];
      const roots = list.filter((row) => row && !row.sourceId && Number(row.amount || 0) > 0);
      const unique = [];
      const seen = new Set();

      roots.forEach((row) => {
        const id = String(row.id || "");
        if (!id || seen.has(id)) return;
        seen.add(id);
        unique.push(row);
      });

      return unique.map((root) => {
        const sourceId = String(root.id);
        const linked = list.filter((row) => String(row.id) === sourceId || String(row.sourceId || "") === sourceId);
        const total = linked.filter((row) => Number(row.amount || 0) > 0).reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const used = linked.filter((row) => Number(row.amount || 0) < 0).reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
        const remaining = linked.reduce((sum, row) => sum + Number(row.amount || 0), 0);

        return {
          id: sourceId,
          type: "savings",
          name: root.note || root.entity || "Savings",
          total,
          used,
          remaining,
          label: `${root.note || root.entity || "Savings"}`
        };
      }).filter((row) => Number(row.remaining || 0) > 0);
    }

    if (selectedType === "budget") {
      const budgets = readJson("budgets", []);
      const rows = Array.isArray(budgets) ? budgets : [];
      const grouped = new Map();

      rows.forEach((row) => {
        const id = String((row && (row.budgetId || row.id)) || "");
        if (!id) return;
        if (!grouped.has(id)) {
          grouped.set(id, {
            id,
            type: "budget",
            name: row.name || row.note || row.entity || "Budget",
            totalAllocated: 0
          });
        }
        const current = grouped.get(id);
        current.totalAllocated += Number(row.totalAllocated || row.amount || 0);
      });

      return Array.from(grouped.values()).map((entry) => {
        const spent = typeof globalScope.getNetSpentForBudget === "function"
          ? Math.max(0, Number(globalScope.getNetSpentForBudget(entry.id) || 0))
          : 0;
        const remaining = Number(entry.totalAllocated || 0) - spent;

        return {
          id: entry.id,
          type: "budget",
          name: entry.name,
          total: Number(entry.totalAllocated || 0),
          used: spent,
          remaining,
          label: entry.name
        };
      }).filter((row) => Number(row.remaining || 0) > 0);
    }

    return [];
  }

  function getFundingSourceById(type, id) {
    const list = getFundingSourceSummaries(type);
    return list.find((row) => String(row.id) === String(id || "")) || null;
  }

  function ensureDocumentWorkflowMigration() {
    const registry = getQuotationRegistry();
    const orders = getOrderRows();
    let relationTouched = false;

    registry.forEach((row) => {
      if (!row || !row.id) return;
      const relationStatus = row.orderId ? "linked" : "unlinked";
      const result = upsertRelation({ quotationId: row.id, orderId: row.orderId || null, relationshipStatus: relationStatus });
      if (result) relationTouched = true;
    });

    orders.forEach((row) => {
      if (!row || !row.quotationId) return;
      const result = upsertRelation({ quotationId: row.quotationId, orderId: row.id, relationshipStatus: "linked" });
      if (result) relationTouched = true;
    });

    if (!relationTouched && !readJson(DOCUMENT_RELATIONS_KEY, null)) {
      saveRelations([]);
    }
  }

  const api = {
    keys: {
      quotationRegistry: QUOTATION_REGISTRY_KEY,
      quotationMeta: QUOTATION_META_KEY,
      activeQuotation: ACTIVE_QUOTATION_KEY,
      relations: DOCUMENT_RELATIONS_KEY,
      noSeries: NO_SERIES_CONFIG_KEY
    },
    getNoSeriesConfig,
    saveNoSeriesConfig,
    getSeriesPreview,
    generateDocumentNumber,
    getQuotationRegistry,
    saveQuotationRegistry,
    getOrderRows,
    findOrderForQuotation,
    getRelations,
    saveRelations,
    upsertRelation,
    getRelationByQuotationId,
    getFundingSourceSummaries,
    getFundingSourceById,
    ensureDocumentWorkflowMigration
  };

  globalScope.DocWorkflow = api;
  try {
    ensureDocumentWorkflowMigration();
  } catch (_err) {
  }
})(typeof window !== "undefined" ? window : globalThis);

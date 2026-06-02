export const STORAGE_KEY = "rbAdminCfg";

export function loadConfigFromStorage() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved
      ? JSON.parse(saved)
      : { baseUrl: "", apiKey: "", adminSecret: "" };
  } catch (error) {
    console.warn("Could not read config from storage", error);
    return { baseUrl: "", apiKey: "", adminSecret: "" };
  }
}

export function saveConfigToStorage(cfg) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function getHeaders(cfg, isAdmin = false) {
  const headers = { "Content-Type": "application/json" };
  if (cfg.apiKey) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  }
  if (isAdmin && cfg.adminSecret) {
    headers["x-admin-secret"] = cfg.adminSecret;
  }
  return headers;
}

export function getRecordsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  const keys = [
    "records",
    "data",
    "warranties",
    "results",
    "items",
    "payload",
    "docs",
    "rows",
  ];

  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key];
  }

  const arrays = Object.values(data).filter((value) => Array.isArray(value));
  if (arrays.length === 1) return arrays[0];

  return [];
}

export function normalizeRecord(record) {
  if (!record || typeof record !== "object") return {};
  return {
    id:
      record.id ?? record._id ?? record.serial_number ?? record.serial ?? null,
    serial_number:
      record.serial_number ??
      record.serialNumber ??
      record.serial ??
      record.id ??
      "",
    warranty_status:
      record.warranty_status ??
      record.warrantyStatus ??
      record.status ??
      record.state ??
      "",
    warranty_expiry_date:
      record.warranty_expiry_date ??
      record.warrantyExpiryDate ??
      record.expiry_date ??
      record.expiry ??
      "",
    purchase_date:
      record.purchase_date ?? record.purchaseDate ?? record.purchased_at ?? "",
    service_plan_type:
      record.service_plan_type ??
      record.servicePlanType ??
      record.plan_type ??
      record.plan ??
      "",
    claim_eligible: parseBoolean(
      record.claim_eligible ?? record.claimEligible ?? record.eligible ?? false,
    ),
  };
}

export function parseBoolean(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0" || value === "false")
    return false;
  return Boolean(value);
}

export function validateSerial(serial) {
  return (
    /^SM100[A-Za-z0-9\-]+$/.test(serial) &&
    serial.length >= 8 &&
    serial.length <= 20
  );
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function toInputDate(value) {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

export function statusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("in warranty")) return "badge-green";
  if (normalized.includes("out of warranty")) return "badge-red";
  if (normalized.includes("service plan")) return "badge-blue";
  return "badge-gray";
}

export function statusBadgeLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("in warranty")) return "In Warranty";
  if (normalized.includes("out of warranty")) return "Out of Warranty";
  if (normalized.includes("service plan")) return "Service Plan Active";
  return status || "—";
}

export function normalizeTicket(ticket) {
  if (!ticket || typeof ticket !== "object") return {};
  return {
    id:
      ticket.id ??
      ticket._id ??
      ticket.ticket_id ??
      ticket.ticketNumber ??
      null,
    ticket_number:
      ticket.ticket_number ??
      ticket.ticketNumber ??
      ticket.ticket_id ??
      ticket.id ??
      "",
    warranty_number:
      ticket.warranty_number ?? ticket.warrantyNumber ?? ticket.warranty ?? "",
    serial_number:
      ticket.serial_number ?? ticket.serial ?? ticket.serialNumber ?? "",
    status: ticket.status ?? ticket.ticket_status ?? ticket.state ?? "",
    fault:
      ticket.fault ?? ticket.subject ?? ticket.title ?? ticket.summary ?? "",
    description: ticket.description ?? ticket.body ?? ticket.details ?? "",
    created_at:
      ticket.created_at ?? ticket.createdAt ?? ticket.created_date ?? "",
  };
}

export function ticketBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("closed") || normalized.includes("resolved"))
    return "badge-green";
  if (
    normalized.includes("open") ||
    normalized.includes("in_progress") ||
    normalized.includes("in progress")
  )
    return "badge-blue";
  if (normalized.includes("pending")) return "badge-gray";
  if (normalized.includes("cancel") || normalized.includes("failed"))
    return "badge-red";
  return "badge-gray";
}

export function ticketBadgeLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("in_progress") || normalized.includes("in progress"))
    return "In Progress";
  if (normalized.includes("open")) return "Open";
  if (normalized.includes("resolved")) return "Resolved";
  if (normalized.includes("closed")) return "Closed";
  return status || "—";
}

import { useEffect, useMemo, useState } from "react";
import {
  loadConfigFromStorage,
  saveConfigToStorage,
  getHeaders,
  getRecordsFromResponse,
  normalizeRecord,
  normalizeTicket,
  formatDate,
  toInputDate,
  validateSerial,
  statusBadgeClass,
  statusBadgeLabel,
  ticketBadgeClass,
  ticketBadgeLabel,
} from "./services/api";

const blankForm = {
  serial: "",
  status: "",
  expiry: "",
  purchase: "",
  plan: "",
  eligible: false,
};

const blankTicketForm = {
  warrantyNumber: "",
  serial: "",
  status: "OPEN",
  fault: "",
  description: "",
};

const navItems = [
  { key: "add", label: "Add record", icon: "➕" },
  { key: "list", label: "All records", icon: "📋" },
  { key: "lookup", label: "Look up serial", icon: "🔍" },
  { key: "tickets", label: "Tickets", icon: "🎫" },
  { key: "config", label: "API config", icon: "⚙️" },
];

function App() {
  const [cfg, setCfg] = useState({ baseUrl: "", apiKey: "", adminSecret: "" });
  const [activePage, setActivePage] = useState("config");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [alerts, setAlerts] = useState({});
  const [warrantyOpen, setWarrantyOpen] = useState(false);
  const [addForm, setAddForm] = useState(blankForm);
  const [editForm, setEditForm] = useState(blankForm);
  const [currentEditId, setCurrentEditId] = useState(null);
  const [lookupSerial, setLookupSerial] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [ticketSearchValue, setTicketSearchValue] = useState("");
  const [ticketSearchType, setTicketSearchType] = useState("ticket");
  const [ticketLookupResult, setTicketLookupResult] = useState(null);
  const [ticketForm, setTicketForm] = useState(blankTicketForm);
  const [ticketEditId, setTicketEditId] = useState(null);
  const [ticketEditStatus, setTicketEditStatus] = useState("OPEN");
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketSearchQuery, setTicketSearchQuery] = useState("");

  useEffect(() => {
    setCfg(loadConfigFromStorage());
  }, []);

  useEffect(() => {
    if (activePage === "list") {
      fetchRecords();
    }
    if (activePage === "tickets") {
      fetchTickets();
    }
  }, [activePage]);

  const showAlert = (key, message, type = "info") => {
    setAlerts((prev) => ({ ...prev, [key]: { message, type } }));
    window.setTimeout(() => {
      setAlerts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 5000);
  };

  const requireConfig = (alertKey) => {
    if (!cfg.baseUrl) {
      showAlert(
        alertKey,
        "⚠ Please save your API configuration first",
        "alert-error",
      );
      return false;
    }
    return true;
  };

  const handleSaveConfig = () => {
    const sanitized = {
      baseUrl: cfg.baseUrl.trim().replace(/\/$/, ""),
      apiKey: cfg.apiKey.trim(),
      adminSecret: cfg.adminSecret.trim(),
    };
    setCfg(sanitized);
    saveConfigToStorage(sanitized);
    showAlert("config", "✓ Configuration saved", "alert-success");
  };

  const handleClearConfig = () => {
    if (!window.confirm("Clear all saved configuration?")) return;
    const cleared = { baseUrl: "", apiKey: "", adminSecret: "" };
    setCfg(cleared);
    saveConfigToStorage(cleared);
    showAlert("config", "Configuration cleared", "alert-info");
  };

  const setField = (setter) => (key, value) =>
    setter((prev) => ({ ...prev, [key]: value }));

  const handleAddRecord = async () => {
    if (!requireConfig("add")) return;
    if (!addForm.serial) {
      showAlert("add", "⚠ Serial number is required", "alert-error");
      return;
    }
    if (!validateSerial(addForm.serial)) {
      showAlert(
        "add",
        "⚠ Invalid serial number. Must start with SM100 followed by letters, numbers or hyphens",
        "alert-error",
      );
      return;
    }

    const payload = {
      serial_number: addForm.serial,
      warranty_status: addForm.status || undefined,
      warranty_expiry_date: addForm.expiry || undefined,
      purchase_date: addForm.purchase || undefined,
      service_plan_type: addForm.plan || undefined,
      claim_eligible: addForm.eligible,
    };

    try {
      const res = await fetch(`${cfg.baseUrl}/tools/warranty`, {
        method: "POST",
        headers: getHeaders(cfg, true),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        showAlert(
          "add",
          `✓ Record saved successfully — ${addForm.serial}`,
          "alert-success",
        );
        setAddForm(blankForm);
      } else {
        showAlert(
          "add",
          `✗ ${res.status} ${data?.message || res.statusText || "Failed to save record"}`,
          "alert-error",
        );
      }
    } catch (error) {
      showAlert("add", `✗ Network error: ${error.message}`, "alert-error");
    }
  };

  const fetchRecords = async () => {
    if (!requireConfig("list")) return;
    setLoadingRecords(true);
    try {
      const res = await fetch(`${cfg.baseUrl}/tools/warranty`, {
        headers: getHeaders(cfg, true),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showAlert(
          "list",
          `✗ ${data?.message || "Failed to load records"}`,
          "alert-error",
        );
        setRecords([]);
      } else {
        setRecords(getRecordsFromResponse(data).map(normalizeRecord));
      }
    } catch (error) {
      showAlert(
        "list",
        `✗ Could not reach the API: ${error.message}`,
        "alert-error",
      );
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleLookup = async () => {
    if (!requireConfig("lookup")) return;
    if (!lookupSerial.trim()) {
      showAlert("lookup", "⚠ Enter a serial number to search", "alert-error");
      return;
    }
    setLookupResult(null);

    try {
      const res = await fetch(
        `${cfg.baseUrl}/tools/warranty/check?serial_number=${encodeURIComponent(lookupSerial.trim())}`,
        { headers: getHeaders(cfg, false) },
      );
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setLookupResult(normalizeRecord(data));
      } else {
        showAlert(
          "lookup",
          `✗ ${res.status} ${data?.message || res.statusText || "Record not found"}`,
          "alert-error",
        );
      }
    } catch (error) {
      showAlert("lookup", `✗ Network error: ${error.message}`, "alert-error");
    }
  };

  const openEditForm = (record) => {
    setCurrentEditId(record.id || record.serial_number);
    setEditForm({
      serial: record.serial_number || "",
      status: record.warranty_status || "",
      expiry: toInputDate(record.warranty_expiry_date),
      purchase: toInputDate(record.purchase_date),
      plan: record.service_plan_type || "",
      eligible: !!record.claim_eligible,
    });
    setActivePage("edit");
  };

  const handleUpdateRecord = async () => {
    if (!requireConfig("edit")) return;
    const payload = {
      warranty_status: editForm.status || undefined,
      warranty_expiry_date: editForm.expiry || undefined,
      purchase_date: editForm.purchase || undefined,
      service_plan_type: editForm.plan || undefined,
      claim_eligible: editForm.eligible,
    };

    try {
      const res = await fetch(
        `${cfg.baseUrl}/tools/warranty/${encodeURIComponent(currentEditId)}`,
        {
          method: "PATCH",
          headers: getHeaders(cfg, true),
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => null);
      if (res.ok) {
        showAlert("edit", "✓ Record updated successfully", "alert-success");
      } else {
        showAlert(
          "edit",
          `✗ ${res.status} ${data?.message || res.statusText || "Failed to update record"}`,
          "alert-error",
        );
      }
    } catch (error) {
      showAlert("edit", `✗ Network error: ${error.message}`, "alert-error");
    }
  };

  const handleDeleteRecord = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this warranty record? This cannot be undone.",
      )
    )
      return;
    try {
      const res = await fetch(
        `${cfg.baseUrl}/tools/warranty/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: getHeaders(cfg, true),
        },
      );
      const data = await res.json().catch(() => null);
      if (res.ok) {
        showAlert("list", "✓ Record deleted", "alert-success");
        fetchRecords();
      } else {
        showAlert(
          "list",
          `✗ ${res.status} ${data?.message || res.statusText || "Failed to delete"}`,
          "alert-error",
        );
      }
    } catch (error) {
      showAlert("list", `✗ Network error: ${error.message}`, "alert-error");
    }
  };

  const fetchTickets = async () => {
    if (!requireConfig("tickets")) return;
    setTicketLoading(true);
    try {
      const res = await fetch(`${cfg.baseUrl}/tools/tickets/`, {
        headers: getHeaders(cfg, true),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showAlert(
          "tickets",
          `✗ ${data?.message || "Failed to load tickets"}`,
          "alert-error",
        );
        setTickets([]);
      } else {
        setTickets(getRecordsFromResponse(data).map(normalizeTicket));
      }
    } catch (error) {
      showAlert(
        "tickets",
        `✗ Could not reach the API: ${error.message}`,
        "alert-error",
      );
      setTickets([]);
    } finally {
      setTicketLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!requireConfig("tickets")) return;
    if (!ticketForm.warrantyNumber.trim()) {
      showAlert("tickets", "⚠ Warranty number is required", "alert-error");
      return;
    }
    if (!ticketForm.serial.trim()) {
      showAlert("tickets", "⚠ Serial number is required", "alert-error");
      return;
    }
    if (!ticketForm.fault.trim()) {
      showAlert("tickets", "⚠ Fault description is required", "alert-error");
      return;
    }

    const payload = {
      warranty_number: ticketForm.warrantyNumber.trim() || undefined,
      serial_number: ticketForm.serial.trim(),
      status: ticketForm.status || undefined,
      fault: ticketForm.fault || undefined,
      description: ticketForm.description || undefined,
    };

    try {
      const res = await fetch(`${cfg.baseUrl}/tools/tickets`, {
        method: "POST",
        headers: getHeaders(cfg, true),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        showAlert(
          "tickets",
          `✓ Ticket created successfully — ${ticketForm.serial}`,
          "alert-success",
        );
        setTicketForm(blankTicketForm);
        fetchTickets();
      } else {
        showAlert(
          "tickets",
          `✗ ${res.status} ${data?.message || res.statusText || "Failed to create ticket"}`,
          "alert-error",
        );
      }
    } catch (error) {
      showAlert("tickets", `✗ Network error: ${error.message}`, "alert-error");
    }
  };

  const handleLookupTicket = async () => {
    if (!requireConfig("tickets")) return;
    if (!ticketSearchValue.trim()) {
      showAlert(
        "tickets",
        "⚠ Enter a ticket number or serial number to search",
        "alert-error",
      );
      return;
    }

    setTicketLookupResult(null);
    const endpoint =
      ticketSearchType === "serial"
        ? `${cfg.baseUrl}/tools/tickets/serial/${encodeURIComponent(
            ticketSearchValue.trim(),
          )}`
        : `${cfg.baseUrl}/tools/tickets/${encodeURIComponent(
            ticketSearchValue.trim(),
          )}`;

    try {
      const res = await fetch(endpoint, {
        headers: getHeaders(cfg, false),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setTicketLookupResult(normalizeTicket(data));
      } else {
        showAlert(
          "tickets",
          `✗ ${res.status} ${data?.message || res.statusText || "Ticket not found"}`,
          "alert-error",
        );
      }
    } catch (error) {
      showAlert("tickets", `✗ Network error: ${error.message}`, "alert-error");
    }
  };

  const openTicketEdit = (ticket) => {
    setTicketEditId(ticket.id || ticket.ticket_number);
    setTicketEditStatus(
      String(ticket.status || "OPEN")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase(),
    );
    setTicketLookupResult(ticket);
  };

  const handleUpdateTicket = async () => {
    if (!requireConfig("tickets")) return;
    if (!ticketEditId) {
      showAlert("tickets", "⚠ Select a ticket to update", "alert-error");
      return;
    }

    const payload = { status: ticketEditStatus || undefined };

    try {
      const res = await fetch(
        `${cfg.baseUrl}/tools/tickets/${encodeURIComponent(ticketEditId)}/status`,
        {
          method: "PATCH",
          headers: getHeaders(cfg, true),
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => null);
      if (res.ok) {
        showAlert("tickets", "✓ Ticket status updated", "alert-success");
        fetchTickets();
        setTicketEditId(null);
      } else {
        showAlert(
          "tickets",
          `✗ ${res.status} ${data?.message || res.statusText || "Failed to update ticket"}`,
          "alert-error",
        );
      }
    } catch (error) {
      showAlert("tickets", `✗ Network error: ${error.message}`, "alert-error");
    }
  };

  const handleDeleteTicket = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this ticket? This cannot be undone.",
      )
    )
      return;

    try {
      const res = await fetch(
        `${cfg.baseUrl}/tools/tickets/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: getHeaders(cfg, true),
        },
      );
      const data = await res.json().catch(() => null);
      if (res.ok) {
        showAlert("tickets", "✓ Ticket deleted", "alert-success");
        fetchTickets();
      } else {
        showAlert(
          "tickets",
          `✗ ${res.status} ${data?.message || res.statusText || "Failed to delete ticket"}`,
          "alert-error",
        );
      }
    } catch (error) {
      showAlert("tickets", `✗ Network error: ${error.message}`, "alert-error");
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((record) =>
      record.serial_number.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [records, searchQuery]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) =>
      `${ticket.ticket_number} ${ticket.warranty_number} ${ticket.serial_number}`
        .toLowerCase()
        .includes(ticketSearchQuery.toLowerCase()),
    );
  }, [tickets, ticketSearchQuery]);

  const stats = {
    total: records.length,
    in: records.filter((record) => record.warranty_status === "In Warranty")
      .length,
    out: records.filter(
      (record) => record.warranty_status === "Out of Warranty",
    ).length,
    eligible: records.filter((record) => record.claim_eligible).length,
  };

  const statusConnected = cfg.baseUrl && cfg.apiKey;

  const setPage = (page) => {
    setActivePage(page);
    setMobileNavOpen(false);
  };

  return (
    <div>
      <header className="topbar">
        <div className="topbar-brand">
          <div className="icon">🔧</div>
          RepairBot API
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label="Toggle navigation"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            ☰
          </button>
          <div className="topbar-status">
            <div
              className={
                statusConnected ? "status-dot connected" : "status-dot"
              }
            />
            <span id="statusText">
              {statusConnected ? `Connected — ${cfg.baseUrl}` : "Not connected"}
            </span>
          </div>
        </div>
      </header>
      <div className={mobileNavOpen ? "mobile-nav show" : "mobile-nav"}>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={item.key === activePage ? "nav-item active" : "nav-item"}
            onClick={() => setPage(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">Warranty</div>
            <button
              type="button"
              className={warrantyOpen ? "nav-item active" : "nav-item"}
              onClick={() => setWarrantyOpen((s) => !s)}
            >
              <span className="nav-icon">🧾</span>
              Warranty
            </button>
            {warrantyOpen ? (
              <div className="nav-children">
                {navItems
                  .filter(
                    (item) => item.key !== "config" && item.key !== "tickets",
                  )
                  .map((item) => (
                    <button
                      key={item.key}
                      className={
                        item.key === activePage
                          ? "nav-item nav-child active"
                          : "nav-item nav-child"
                      }
                      type="button"
                      onClick={() => setActivePage(item.key)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">Tickets</div>
            <button
              type="button"
              className={
                activePage === "tickets" ? "nav-item active" : "nav-item"
              }
              onClick={() => setActivePage("tickets")}
            >
              <span className="nav-icon">🎫</span>
              Tickets
            </button>
          </div>
          <div className="sidebar-section" style={{ marginTop: "1rem" }}>
            <div className="sidebar-label">Settings</div>
            <button
              type="button"
              className={
                activePage === "config" ? "nav-item active" : "nav-item"
              }
              onClick={() => setActivePage("config")}
            >
              <span className="nav-icon">⚙️</span>
              API config
            </button>
          </div>
        </aside>

        <main className="main">
          {activePage === "add" && (
            <div className="page active">
              <div className="page-header">
                <h2>Add warranty record</h2>
                <p>Create a new warranty record in the database</p>
              </div>

              <div className="card">
                <div className="card-title">🛡️ Warranty details</div>
                {alerts.add ? (
                  <div className={`alert show ${alerts.add.type}`}>
                    {alerts.add.message}
                  </div>
                ) : null}

                <div
                  className="form-grid form-grid-1"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>
                      Serial number <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      value={addForm.serial}
                      onChange={(event) =>
                        setAddForm((prev) => ({
                          ...prev,
                          serial: event.target.value,
                        }))
                      }
                      placeholder="SM100-ABC-001"
                    />
                    <span className="hint">
                      Must begin with SM100 followed by letters, numbers or
                      hyphens
                    </span>
                  </div>
                </div>

                <div
                  className="form-grid form-grid-3"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>Warranty status</label>
                    <select
                      value={addForm.status}
                      onChange={(event) =>
                        setAddForm((prev) => ({
                          ...prev,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option value="">— select status —</option>
                      <option value="In Warranty">In warranty</option>
                      <option value="Out of Warranty">Out of warranty</option>
                      <option value="Service Plan Active">
                        Service plan active
                      </option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Warranty expiry date</label>
                    <input
                      type="date"
                      value={addForm.expiry}
                      onChange={(event) =>
                        setAddForm((prev) => ({
                          ...prev,
                          expiry: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Purchase date</label>
                    <input
                      type="date"
                      value={addForm.purchase}
                      onChange={(event) =>
                        setAddForm((prev) => ({
                          ...prev,
                          purchase: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div
                  className="form-grid form-grid-2"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>Service plan type</label>
                    <input
                      type="text"
                      value={addForm.plan}
                      onChange={(event) =>
                        setAddForm((prev) => ({
                          ...prev,
                          plan: event.target.value,
                        }))
                      }
                      placeholder="e.g. Standard Cover, Premium Cover"
                    />
                  </div>
                  <div className="field">
                    <label>Claim eligibility</label>
                    <div className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={addForm.eligible}
                        onChange={(event) =>
                          setAddForm((prev) => ({
                            ...prev,
                            eligible: event.target.checked,
                          }))
                        }
                      />
                      <label>Mark as claim eligible</label>
                    </div>
                  </div>
                </div>

                <hr className="divider" />
                <div className="btn-row">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleAddRecord}
                  >
                    Save record
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setAddForm(blankForm)}
                  >
                    Clear form
                  </button>
                </div>
              </div>
            </div>
          )}

          {activePage === "list" && (
            <div className="page active">
              <div className="page-header">
                <h2>All warranty records</h2>
                <p>Browse, filter, edit, and delete warranty items</p>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total records</div>
                  <div className="stat-value">{stats.total}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">In warranty</div>
                  <div className="stat-value">{stats.in}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Out of warranty</div>
                  <div className="stat-value">{stats.out}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Claim eligible</div>
                  <div className="stat-value">{stats.eligible}</div>
                </div>
              </div>

              {alerts.list ? (
                <div className={`alert show ${alerts.list.type}`}>
                  {alerts.list.message}
                </div>
              ) : null}

              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search by serial number"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={fetchRecords}
                >
                  Refresh
                </button>
              </div>

              <div id="tableContainer">
                {loadingRecords ? (
                  <div className="empty-state">
                    <span className="spinner"></span>
                    <p style={{ marginTop: 12 }}>Loading records...</p>
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="empty-state">
                    <div className="icon">📭</div>
                    No records found
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Serial number</th>
                          <th>Status</th>
                          <th>Expiry date</th>
                          <th>Purchase date</th>
                          <th>Service plan</th>
                          <th style={{ textAlign: "center" }}>Eligible</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((record) => (
                          <tr key={`${record.id}-${record.serial_number}`}>
                            <td>
                              <span className="mono">
                                {record.serial_number}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge ${statusBadgeClass(record.warranty_status)}`}
                              >
                                {statusBadgeLabel(record.warranty_status)}
                              </span>
                            </td>
                            <td>{formatDate(record.warranty_expiry_date)}</td>
                            <td>{formatDate(record.purchase_date)}</td>
                            <td>{record.service_plan_type || "—"}</td>
                            <td style={{ textAlign: "center" }}>
                              {record.claim_eligible ? "✅" : "❌"}
                            </td>
                            <td>
                              <button
                                className="action-btn"
                                type="button"
                                title="Edit"
                                onClick={() => openEditForm(record)}
                              >
                                ✏️
                              </button>
                              <button
                                className="action-btn danger"
                                type="button"
                                title="Delete"
                                onClick={() =>
                                  handleDeleteRecord(
                                    record.id || record.serial_number,
                                  )
                                }
                              >
                                🗑
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activePage === "tickets" && (
            <div className="page active">
              <div className="page-header">
                <h2>Tickets</h2>
                <p>Manage support tickets using the RepairBot API endpoints.</p>
              </div>

              {alerts.tickets ? (
                <div className={`alert show ${alerts.tickets.type}`}>
                  {alerts.tickets.message}
                </div>
              ) : null}

              <div className="card">
                <div className="card-title">🎫 Create ticket</div>
                <div
                  className="form-grid form-grid-2"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>Warranty number</label>
                    <input
                      type="text"
                      value={ticketForm.warrantyNumber}
                      onChange={(event) =>
                        setTicketForm((prev) => ({
                          ...prev,
                          warrantyNumber: event.target.value,
                        }))
                      }
                      placeholder="WNT-12345"
                    />
                  </div>
                  <div className="field">
                    <label>Serial number</label>
                    <input
                      type="text"
                      value={ticketForm.serial}
                      onChange={(event) =>
                        setTicketForm((prev) => ({
                          ...prev,
                          serial: event.target.value,
                        }))
                      }
                      placeholder="SM100-ABC-001"
                    />
                  </div>
                </div>

                <div
                  className="form-grid form-grid-2"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>Status</label>
                    <select
                      value={ticketForm.status}
                      onChange={(event) =>
                        setTicketForm((prev) => ({
                          ...prev,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Fault</label>
                    <input
                      type="text"
                      value={ticketForm.fault}
                      onChange={(event) =>
                        setTicketForm((prev) => ({
                          ...prev,
                          fault: event.target.value,
                        }))
                      }
                      placeholder="Describe the fault"
                    />
                  </div>
                </div>

                <div
                  className="form-grid form-grid-1"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>Description</label>
                    <textarea
                      rows={4}
                      value={ticketForm.description}
                      onChange={(event) =>
                        setTicketForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Describe the issue or technician notes"
                    />
                  </div>
                </div>

                <div className="btn-row">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleCreateTicket}
                  >
                    Create ticket
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setTicketForm(blankTicketForm)}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-title">🔎 Ticket lookup</div>
                <div
                  className="form-grid form-grid-2"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>Search type</label>
                    <select
                      value={ticketSearchType}
                      onChange={(event) =>
                        setTicketSearchType(event.target.value)
                      }
                    >
                      <option value="ticket">Ticket number</option>
                      <option value="serial">Serial number</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Search value</label>
                    <input
                      type="text"
                      value={ticketSearchValue}
                      onChange={(event) =>
                        setTicketSearchValue(event.target.value)
                      }
                      placeholder={
                        ticketSearchType === "serial"
                          ? "Enter serial number"
                          : "Enter ticket number"
                      }
                    />
                  </div>
                </div>
                <div className="btn-row">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleLookupTicket}
                  >
                    Lookup ticket
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setTicketSearchValue("");
                      setTicketLookupResult(null);
                    }}
                  >
                    Clear
                  </button>
                </div>

                {ticketLookupResult ? (
                  <div className="lookup-result show">
                    <div className="lookup-grid">
                      <div className="lookup-item">
                        <div className="lk-label">Ticket</div>
                        <div className="lk-value">
                          {ticketLookupResult.ticket_number ||
                            ticketLookupResult.id}
                        </div>
                      </div>
                      <div className="lookup-item">
                        <div className="lk-label">Warranty</div>
                        <div className="lk-value">
                          {ticketLookupResult.warranty_number || "—"}
                        </div>
                      </div>
                      <div className="lookup-item">
                        <div className="lk-label">Serial</div>
                        <div className="lk-value">
                          {ticketLookupResult.serial_number}
                        </div>
                      </div>
                      <div className="lookup-item">
                        <div className="lk-label">Status</div>
                        <div
                          className={`badge ${ticketBadgeClass(ticketLookupResult.status)}`}
                        >
                          {ticketBadgeLabel(ticketLookupResult.status)}
                        </div>
                      </div>
                      <div className="lookup-item">
                        <div className="lk-label">Fault</div>
                        <div className="lk-value">
                          {ticketLookupResult.fault || "—"}
                        </div>
                      </div>
                      <div className="lookup-item">
                        <div className="lk-label">Created</div>
                        <div className="lk-value">
                          {formatDate(ticketLookupResult.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="btn-row" style={{ marginTop: "1rem" }}>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => openTicketEdit(ticketLookupResult)}
                      >
                        Edit ticket
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Filter tickets by number or serial"
                  value={ticketSearchQuery}
                  onChange={(event) => setTicketSearchQuery(event.target.value)}
                />
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={fetchTickets}
                >
                  Refresh
                </button>
              </div>

              <div id="tableContainer">
                {ticketLoading ? (
                  <div className="empty-state">
                    <span className="spinner"></span>
                    <p style={{ marginTop: 12 }}>Loading tickets...</p>
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="empty-state">
                    <div className="icon">📭</div>
                    No tickets found
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Ticket</th>
                          <th>Warranty</th>
                          <th>Serial</th>
                          <th>Fault</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTickets.map((ticket) => (
                          <tr key={`${ticket.id}-${ticket.ticket_number}`}>
                            <td>
                              <span className="mono">
                                {ticket.ticket_number || ticket.id}
                              </span>
                            </td>
                            <td>{ticket.warranty_number || "—"}</td>
                            <td>{ticket.serial_number || "—"}</td>
                            <td>{ticket.fault || "—"}</td>
                            <td>
                              <span
                                className={`badge ${ticketBadgeClass(ticket.status)}`}
                              >
                                {ticketBadgeLabel(ticket.status)}
                              </span>
                            </td>
                            <td>{formatDate(ticket.created_at)}</td>
                            <td>
                              <button
                                className="action-btn"
                                type="button"
                                title="Edit"
                                onClick={() => openTicketEdit(ticket)}
                              >
                                ✏️
                              </button>
                              <button
                                className="action-btn danger"
                                type="button"
                                title="Delete"
                                onClick={() =>
                                  handleDeleteTicket(
                                    ticket.id || ticket.ticket_number,
                                  )
                                }
                              >
                                🗑
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {ticketEditId ? (
                <div className="card">
                  <div className="card-title">✏️ Update ticket status</div>
                  <div
                    className="form-grid form-grid-2"
                    style={{ marginBottom: "1rem" }}
                  >
                    <div className="field">
                      <label>Ticket number</label>
                      <input type="text" value={ticketEditId} disabled />
                    </div>
                    <div className="field">
                      <label>Status</label>
                      <select
                        value={ticketEditStatus}
                        onChange={(event) =>
                          setTicketEditStatus(event.target.value)
                        }
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </div>
                  </div>
                  <div className="btn-row">
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={handleUpdateTicket}
                    >
                      Update status
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => setTicketEditId(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {activePage === "lookup" && (
            <div className="page active">
              <div className="page-header">
                <h2>Look up serial</h2>
                <p>Search a warranty record by serial number</p>
              </div>

              <div className="card">
                <div className="card-title">🔎 Search by serial</div>
                {alerts.lookup ? (
                  <div className={`alert show ${alerts.lookup.type}`}>
                    {alerts.lookup.message}
                  </div>
                ) : null}
                <div
                  className="form-grid form-grid-1"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>Serial number</label>
                    <input
                      type="text"
                      value={lookupSerial}
                      onChange={(event) => setLookupSerial(event.target.value)}
                      placeholder="SM100-ABC-001"
                    />
                  </div>
                </div>
                <div className="btn-row">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleLookup}
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setLookupSerial("");
                      setLookupResult(null);
                    }}
                  >
                    Clear
                  </button>
                </div>

                {lookupResult ? (
                  <div className="lookup-result show">
                    <div className="lookup-grid">
                      <div className="lookup-item">
                        <div className="lk-label">Serial</div>
                        <div className="lk-value">
                          {lookupResult.serial_number}
                        </div>
                      </div>
                      <div className="lookup-item">
                        <div className="lk-label">Status</div>
                        <div
                          className={`badge ${statusBadgeClass(lookupResult.warranty_status)}`}
                        >
                          {statusBadgeLabel(lookupResult.warranty_status)}
                        </div>
                      </div>
                      <div className="lookup-item">
                        <div className="lk-label">Expiry</div>
                        <div className="lk-value">
                          {formatDate(lookupResult.warranty_expiry_date)}
                        </div>
                      </div>
                      <div className="lookup-item">
                        <div className="lk-label">Purchase</div>
                        <div className="lk-value">
                          {formatDate(lookupResult.purchase_date)}
                        </div>
                      </div>
                      <div className="lookup-item">
                        <div className="lk-label">Plan type</div>
                        <div className="lk-value">
                          {lookupResult.service_plan_type || "—"}
                        </div>
                      </div>
                      <div className="lookup-item">
                        <div className="lk-label">Eligible</div>
                        <div className="lk-value">
                          {lookupResult.claim_eligible ? "Yes" : "No"}
                        </div>
                      </div>
                    </div>
                    <div className="btn-row" style={{ marginTop: "1rem" }}>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => openEditForm(lookupResult)}
                      >
                        Edit record
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {activePage === "edit" && (
            <div className="page active">
              <div className="page-header">
                <h2>Edit warranty record</h2>
                <p>Update an existing warranty record</p>
              </div>

              <div className="card">
                <div className="card-title">✏️ Edit details</div>
                {alerts.edit ? (
                  <div className={`alert show ${alerts.edit.type}`}>
                    {alerts.edit.message}
                  </div>
                ) : null}

                <div
                  className="form-grid form-grid-1"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>Serial number</label>
                    <input type="text" value={editForm.serial} disabled />
                  </div>
                </div>

                <div
                  className="form-grid form-grid-3"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>Warranty status</label>
                    <select
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option value="">— select status —</option>
                      <option value="In Warranty">In warranty</option>
                      <option value="Out of Warranty">Out of warranty</option>
                      <option value="Service Plan Active">
                        Service plan active
                      </option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Warranty expiry date</label>
                    <input
                      type="date"
                      value={editForm.expiry}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          expiry: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Purchase date</label>
                    <input
                      type="date"
                      value={editForm.purchase}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          purchase: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div
                  className="form-grid form-grid-2"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>Service plan type</label>
                    <input
                      type="text"
                      value={editForm.plan}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          plan: event.target.value,
                        }))
                      }
                      placeholder="e.g. Standard Cover, Premium Cover"
                    />
                  </div>
                  <div className="field">
                    <label>Claim eligibility</label>
                    <div className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={editForm.eligible}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            eligible: event.target.checked,
                          }))
                        }
                      />
                      <label>Mark as claim eligible</label>
                    </div>
                  </div>
                </div>

                <div className="btn-row">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleUpdateRecord}
                  >
                    Update record
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setActivePage("list")}
                  >
                    Back to list
                  </button>
                </div>
              </div>
            </div>
          )}

          {activePage === "config" && (
            <div className="page active">
              <div className="page-header">
                <h2>API configuration</h2>
                <p>
                  Manage the backend connection and keep your existing API
                  endpoints intact
                </p>
              </div>

              <div className="card">
                <div className="card-title">⚙️ Connection settings</div>
                <div
                  className="form-grid form-grid-3"
                  style={{ marginBottom: "1rem" }}
                >
                  <div className="field">
                    <label>Base URL</label>
                    <input
                      type="text"
                      value={cfg.baseUrl}
                      onChange={(event) =>
                        setCfg((prev) => ({
                          ...prev,
                          baseUrl: event.target.value,
                        }))
                      }
                      placeholder="https://repairbot-api.onrender.com/"
                    />
                  </div>
                  <div className="field">
                    <label>Bearer API key</label>
                    <input
                      type="text"
                      value={cfg.apiKey}
                      onChange={(event) =>
                        setCfg((prev) => ({
                          ...prev,
                          apiKey: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Admin secret</label>
                    <input
                      type="text"
                      value={cfg.adminSecret}
                      onChange={(event) =>
                        setCfg((prev) => ({
                          ...prev,
                          adminSecret: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="btn-row">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleSaveConfig}
                  >
                    Save settings
                  </button>
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={handleClearConfig}
                  >
                    Clear saved config
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

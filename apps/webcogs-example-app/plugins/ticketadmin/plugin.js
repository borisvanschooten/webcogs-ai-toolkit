// TicketListPlugin.js
// A plugin that lists all tickets with username and date, ordered by entry date.

export default class TicketListPlugin {
  constructor(core) {
    this.core = core;
    // Shadow root will be stored here after mounting
    this.root = null;

    // Kick off async initialisation
    this.init();
  }

  async init() {
    // Retrieve tickets joined with users
    const sql = `
      SELECT Ticket.id          AS ticket_id,
             Ticket.text        AS text,
             Ticket.entry_date  AS entry_date,
             User.username      AS username,
             User.id            AS user_id
      FROM Ticket
      JOIN User ON Ticket.user = User.id
      ORDER BY Ticket.entry_date ASC;
    `;

    let tickets = [];
    try {
      tickets = await this.core.db.run(sql);
    } catch (err) {
      console.error('Could not load tickets', err);
      tickets = [];
    }

    // Build HTML
    const htmlParts = [
      '<div class="ticket-list">'
    ];

    if (tickets.length === 0) {
      htmlParts.push('<p class="empty">No tickets found.</p>');
    } else {
      for (const t of tickets) {
        const safeText = this.escapeHTML(t.text);
        const safeUsername = this.escapeHTML(t.username);
        const safeDate = this.escapeHTML(t.entry_date);

        htmlParts.push(`
          <div class="ticket-row" data-ticket-id="${t.ticket_id}">
            <div class="ticket-header">
              <span class="username" data-user-id="${t.user_id}">${safeUsername}</span>
              <span class="date">${safeDate}</span>
            </div>
            <div class="ticket-text">${safeText}</div>
          </div>
        `);
      }
    }

    htmlParts.push('</div>');

    const css = `
      .ticket-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: Arial, sans-serif;
      }
      .ticket-row {
        border: 1px solid #ccc;
        padding: 10px;
        border-radius: 4px;
        cursor: pointer;
        background-color: #fafafa;
        transition: background-color 0.2s;
      }
      .ticket-row:hover {
        background-color: #f0f0f0;
      }
      .ticket-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 14px;
      }
      .username {
        color: #1a73e8;
        text-decoration: underline;
        cursor: pointer;
      }
      .date {
        color: #555;
      }
      .ticket-text {
        font-size: 16px;
        white-space: pre-wrap;
      }
      .empty {
        font-style: italic;
        color: #777;
      }
    `;

    // Mount the widget
    this.root = this.core.mount('main', htmlParts.join(''), css);

    // Attach event listeners
    this.addEventListeners();
  }

  addEventListeners() {
    if (!this.root) return;

    // Delegate clicks to container
    this.root.addEventListener('click', (ev) => {
      const usernameEl = ev.target.closest('.username');
      if (usernameEl) {
        // Stop row click from firing
        ev.stopPropagation();
        const userId = usernameEl.getAttribute('data-user-id');
        if (userId) {
          this.core.route('user_overview', parseInt(userId, 10));
        }
        return;
      }

      const rowEl = ev.target.closest('.ticket-row');
      if (rowEl) {
        const ticketId = rowEl.getAttribute('data-ticket-id');
        if (ticketId) {
          this.core.route('ticket_overview', parseInt(ticketId, 10));
        }
      }
    });
  }

  escapeHTML(str) {
    // Simple HTML escape to prevent injection in UI
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

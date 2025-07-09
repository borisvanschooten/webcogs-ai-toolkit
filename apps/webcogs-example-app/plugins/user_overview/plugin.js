export default class SingleUserPlugin {
  constructor(core, userId) {
    this.core = core;
    this.userId = parseInt(userId, 10);
    // Kick off rendering.  We don't await here because constructors
    // cannot be async, but the async method will execute in the background.
    this._render();
  }

  /**
   * Main rendering flow
   */
  async _render() {
    // Fetch the user
    const userRows = await this.core.db.run(
      `SELECT id, username, email, first_name, surname, birth_date FROM User WHERE id = ${this.userId} LIMIT 1`
    );

    if (!userRows || userRows.length === 0) {
      this.core.mount(
        'main',
        `<p>User with id ${this._escape(this.userId)} not found.</p>`,
        ``
      );
      return;
    }

    const user = userRows[0];

    // Fetch tickets for the user
    const tickets = await this.core.db.run(
      `SELECT id, text, entry_date, response_date FROM Ticket WHERE user = ${this.userId} ORDER BY entry_date DESC`
    );

    // Build HTML for user information table
    const htmlParts = [];

    htmlParts.push(`<table class="user-table">`);
    for (const [key, value] of Object.entries(user)) {
      htmlParts.push(
        `<tr><td class="key">${this._escape(key)}</td><td class="value">${this._escape(value)}</td></tr>`
      );
    }
    htmlParts.push(`</table>`);

    // Tickets section
    htmlParts.push(`<h3>Tickets</h3>`);

    if (!tickets || tickets.length === 0) {
      htmlParts.push(`<p>No tickets submitted.</p>`);
    } else {
      htmlParts.push(`<table class="ticket-table">`);
      htmlParts.push(
        `<tr><th>ID</th><th>Text</th><th>Entry Date</th><th>Response Date</th></tr>`
      );
      for (const t of tickets) {
        htmlParts.push(`<tr>`);
        htmlParts.push(`<td>${this._escape(t.id)}</td>`);
        htmlParts.push(`<td>${this._escape(t.text)}</td>`);
        htmlParts.push(`<td>${this._escape(t.entry_date)}</td>`);
        htmlParts.push(`<td>${this._escape(t.response_date ?? '')}</td>`);
        htmlParts.push(`</tr>`);
      }
      htmlParts.push(`</table>`);
    }

    // CSS styling
    const css = `
      .user-table, .ticket-table {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 16px;
      }
      .user-table td.key {
        font-weight: bold;
        width: 25%;
      }
      .user-table td, .ticket-table td, .ticket-table th {
        border: 1px solid #ccc;
        padding: 4px 8px;
      }
      .ticket-table th {
        background-color: #f0f0f0;
      }
    `;

    // Mount the constructed HTML
    this.core.mount('main', `<div class="single-user">${htmlParts.join('')}</div>`, css);
  }

  /**
   * Basic HTML escaping utility
   */
  _escape(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (ch) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return map[ch];
    });
  }
}
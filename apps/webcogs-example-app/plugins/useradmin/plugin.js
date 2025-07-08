class UserListPlugin {
  constructor(core, ...custom_params) {
    this.core = core;
    // Kick off loading process. No need to await inside constructor.
    this._init();
  }

  async _init() {
    try {
      // Fetch all users from the database
      const users = await this.core.db.run(
        `SELECT id, username, email, first_name, surname, birth_date FROM User ORDER BY id`);

      // Build HTML & CSS
      const html = this._buildHTML(users);
      const css = this._buildCSS();

      // Mount widget in the main area and obtain shadow root
      this.shadowRoot = this.core.mount("main", html, css);

      // Attach click listeners for routing
      this._attachRowEvents();
    } catch (err) {
      // In case of error, show it to the user (basic handling)
      const html = `<div class="error">Failed to load users: ${this._escape(err.message)}</div>`;
      const css = `.error { color: red; padding: 8px; }`;
      this.core.mount("main", html, css);
      console.error(err);
    }
  }

  _buildHTML(users) {
    const rows = users.map(u => `
      <tr class="user-row" data-id="${u.id}">
        <td>${u.id}</td>
        <td>${this._escape(u.username)}</td>
        <td>${this._escape(u.email)}</td>
        <td>${this._escape(u.first_name)}</td>
        <td>${this._escape(u.surname)}</td>
        <td>${u.birth_date}</td>
      </tr>
    `).join("");

    return `
      <div class="user-list">
        <h2>All Users</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>First name</th>
              <th>Surname</th>
              <th>Birth date</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  _buildCSS() {
    return `
      .user-list {
        font-family: Arial, sans-serif;
        padding: 12px;
      }
      .user-list table {
        width: 100%;
        border-collapse: collapse;
      }
      .user-list th, .user-list td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      .user-row {
        cursor: pointer;
      }
      .user-row:hover {
        background-color: #f0f0f0;
      }
      h2 {
        margin-top: 0;
      }
    `;
  }

  _attachRowEvents() {
    if (!this.shadowRoot) return;
    const rows = this.shadowRoot.querySelectorAll('.user-row');
    rows.forEach(row => {
      row.addEventListener('click', () => {
        const userId = parseInt(row.dataset.id, 10);
        this.core.route('user_overview', userId);
      });
    });
  }

  _escape(str) {
    // Basic HTML escaping to avoid breaking layout
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export default UserListPlugin;
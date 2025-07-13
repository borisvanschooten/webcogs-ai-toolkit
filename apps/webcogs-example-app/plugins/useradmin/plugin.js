/*@webcogs_system_prompt
# Docs for writing a plugin

A plugin is a module that can interact with the user via HTML widgets, or process information.  A plugin is always defined as a single export class, and should be written in vanilla Javascript. Do not assume any libraries are available.  For example jquery is not available, so do not call $(...).  The class constructor always has this signature: 
constructor(core, ...custom_params). Parameter "core" is the core object, which contains the core API functions.  The constructor can be any number of additional custom parameters.

The plugin class is constructed when the core app invokes the plugin, and can be destroyed and constructed any number of times during the app's lifecycle.

## Core functions

The following functions are available to all plugins, via the "core" object.

function core.mount(location, html_code, css_code) - Show a widget to the user by mounting the given HTML in a shadow DOM.  Returns the shadow root element, which should be used to query the HTML inside the widget.  It is possible for a plugin to have multiple widgets, or none.
core.mount has the following parameters:
- location - a string, indicating where to place the user interface element.  The complete set of available locations is defined in the section "available core.mount locations".  Use only these.
- html_code - a string with a HTML snippet that contains the user interface for the widget
- css_code - corresponding styling for html_code.  This should be a CSS snippet.  The \<style\> tag should not be included.

function core.route(route, ...custom_params) - Invoke the core router.
core.route has the following parameters:
- route - a string describing the route. The format of the route is defined in the section "core.route routes". Use only these.
- custom_params - there can be any number of custom parameters.

## Core properties

core.db is a SQLite compatible database object. It has the following functions: 
- async function db.run(sql_statement, optional_values) - execute a SQL statement or query. Note this is an async function. If it is a query, returns an array of objects, otherwise returns null. Each object represents a record, with keys representing the column names and values the record values. If optional_values is supplied, it should be an array, with its elements bound to "?" symbols in the sql_statement string. For example: db.run("SELECT * FROM my_table WHERE id=?",[1000]) will be interpolated to "SELECT * FROM my_table where id=1000". 

## available core.mount locations

- modal_dialog - modal dialog that displays as an overlay
- main - main area of screen
- nav_bar - navigation bar for main menu
- side_bar - side bar for submenus

## core.route routes

A route is a string that indicates a widget plugin name.

## Style guide

Widgets should always display a title.

Use the classes, styles, and properties in the supplied CSS definitions as much as possible.


## CSS definitions

:root {
  --text-color: #000;
  --main-bg-color: #fff;
  --nav_bar-bg-color: #eee;
  --top_menu-bg-color: #222;
  --top-menu-text-color: #fff;
  --button-bg-color: #aaf;
  --button-text-color: #006;
}


## SQL table definitions


-- User role is one of: user, developer, admin
CREATE TABLE User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    organization TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL
);

-- Ticket status is same as status of last response
-- Status can be: open, in_progress, fixed, not_fixed
CREATE TABLE Ticket (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user INTEGER NOT NULL,
	text TEXT NOT NULL,
	time DATETIME NOT NULL,
    status TEXT NOT NULL
);

-- A ticket can have any number of responses
-- Each response sets the status or text fields, or both
CREATE TABLE Response (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    time DATETIME NOT NULL,
    status TEXT,
    text TEXT
)

@webcogs_user_prompt
Write a plugin that shows a list of all users in the database, and show all fields for each user. When you click on a user, it should route to "user_overview" with as parameter the user ID.

@webcogs_end_prompt_section*/
// UserListPlugin.js
// A plugin that lists all users and routes to user_overview when a user row is clicked

export class UserListPlugin {
  constructor(core) {
    this.core = core;

    // Mount UI in main area
    this.shadowRoot = core.mount("main", this._html(), this._css());

    // Cache tbody element where rows will be rendered
    this.tbodyEl = this.shadowRoot.getElementById("user-table-body");

    // Attach event listener for row clicks (event delegation)
    this.tbodyEl.addEventListener("click", (evt) => {
      const tr = evt.target.closest("tr");
      if (tr && tr.dataset && tr.dataset.id) {
        const userId = parseInt(tr.dataset.id, 10);
        this.core.route("user_overview", userId);
      }
    });

    // Load data from DB and render table
    this._loadAndRenderUsers();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _html() {
    // HTML skeleton of the widget
    return `
      <div class="user-list-widget">
        <h2>User list</h2>
        <table class="user-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>First Name</th>
              <th>Surname</th>
              <th>Organization</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="user-table-body">
            <!-- rows will be injected here -->
          </tbody>
        </table>
      </div>`;
  }

  _css() {
    // Styling for the widget
    return `
      .user-list-widget {
        color: var(--text-color);
        background: var(--main-bg-color);
        padding: 1rem;
        font-family: sans-serif;
      }

      .user-list-widget h2 {
        margin-top: 0;
      }

      .user-table {
        width: 100%;
        border-collapse: collapse;
      }

      .user-table th,
      .user-table td {
        border: 1px solid #ccc;
        padding: 0.5rem;
        text-align: left;
      }

      .user-table tr:hover {
        background: #f0f8ff;
        cursor: pointer;
      }
    `;
  }

  async _loadAndRenderUsers() {
    try {
      const users = await this.core.db.run("SELECT * FROM User");
      this._renderRows(users);
    } catch (err) {
      console.error("Failed to load users:", err);
      this.tbodyEl.innerHTML = `<tr><td colspan="8">Error loading users.</td></tr>`;
    }
  }

  _renderRows(users) {
    if (!users || users.length === 0) {
      this.tbodyEl.innerHTML = `<tr><td colspan="8">No users found.</td></tr>`;
      return;
    }

    // Build rows HTML
    let rowsHtml = "";
    for (const user of users) {
      rowsHtml += `
        <tr data-id="${user.id}">
          <td>${user.id}</td>
          <td>${this._escape(user.username)}</td>
          <td>${this._escape(user.email)}</td>
          <td>${this._escape(user.first_name)}</td>
          <td>${this._escape(user.surname)}</td>
          <td>${this._escape(user.organization)}</td>
          <td>${this._escape(user.role)}</td>
          <td>${this._escape(user.status)}</td>
        </tr>`;
    }
    this.tbodyEl.innerHTML = rowsHtml;
  }

  _escape(str) {
    // Basic HTML escaping to prevent XSS in case data is not trusted
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
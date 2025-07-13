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
Write a plugin that shows a particular ticket in the database. The ticket ID is passed as a custom parameter to the constructor.  All ticket fields except user ID should be shown in a table.  The user who issued the ticket should be shown be shown in the table as well.  The ticket text should be shown in a large area.  All responses to this ticket should be shown below the ticket.  Show a button "Respond" below the responses which routes to ticket_response. 
@webcogs_end_prompt_section*/
export class TicketViewer {
  constructor(core, ticketId) {
    this.core = core;
    this.ticketId = ticketId;
    this.init();
  }

  async init() {
    // Fetch ticket information with user details
    const ticketRows = await this.core.db.run(
      `SELECT Ticket.id               AS ticket_id,
              Ticket.text             AS ticket_text,
              Ticket.time             AS ticket_time,
              Ticket.status           AS ticket_status,
              User.username           AS username,
              User.email              AS email,
              User.first_name         AS first_name,
              User.surname            AS surname,
              User.organization       AS organization,
              User.role               AS user_role,
              User.status             AS user_status
       FROM   Ticket
       JOIN   User ON Ticket.user = User.id
       WHERE  Ticket.id = ?`,
      [this.ticketId]
    );

    let html = "";

    if (!ticketRows || ticketRows.length === 0) {
      html = `<h2>Ticket #${this.ticketId}</h2><p>Ticket not found.</p>`;
      this.mount(html);
      return;
    }

    const t = ticketRows[0];

    // Fetch responses
    const responses = await this.core.db.run(
      `SELECT id, time, status, text
       FROM   Response
       WHERE  ticket_id = ?
       ORDER  BY time ASC`,
      [this.ticketId]
    );

    html += `
      <h2>Ticket #${t.ticket_id}</h2>
      <table class="ticket-info">
        <tr><th>Ticket ID</th><td>${t.ticket_id}</td></tr>
        <tr><th>Submitted by</th><td>${t.first_name} ${t.surname} (${t.username})</td></tr>
        <tr><th>Time</th><td>${t.ticket_time}</td></tr>
        <tr><th>Status</th><td>${t.ticket_status}</td></tr>
      </table>

      <h3>Description</h3>
      <pre class="ticket-text">${this.escapeHtml(t.ticket_text)}</pre>

      <h3>Responses</h3>
      <div class="responses">
        ${responses && responses.length > 0 ? responses.map(r => `
            <div class="response">
              <div class="response-header">${r.time} – ${r.status || ""}</div>
              <pre class="response-text">${this.escapeHtml(r.text || "")}</pre>
            </div>
        `).join("") : "<p>No responses yet.</p>"}
      </div>

      <button id="respond-button">Respond</button>
    `;

    const css = `
      h2 {
        color: var(--text-color);
      }
      .ticket-info {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1em;
      }
      .ticket-info th {
        text-align: left;
        background: var(--nav_bar-bg-color);
        padding: 4px;
        color: var(--text-color);
      }
      .ticket-info td {
        padding: 4px;
      }
      .ticket-text {
        background: var(--main-bg-color);
        border: 1px solid #ccc;
        padding: 8px;
        min-height: 100px;
        white-space: pre-wrap;
      }
      .responses .response {
        border: 1px solid #ccc;
        margin-bottom: 8px;
      }
      .response-header {
        background: var(--nav_bar-bg-color);
        padding: 4px;
        font-weight: bold;
      }
      .response-text {
        padding: 4px;
        white-space: pre-wrap;
      }
      #respond-button {
        background: var(--button-bg-color);
        color: var(--button-text-color);
        padding: 8px 12px;
        border: none;
        cursor: pointer;
      }
    `;

    const shadowRoot = this.mount(html, css);

    // Attach event listener to the Respond button
    const btn = shadowRoot.getElementById("respond-button");
    if (btn) {
      btn.addEventListener("click", () => {
        this.core.route("ticket_response", this.ticketId);
      });
    }
  }

  // Helper to mount and keep reference to shadow root
  mount(html, css = "") {
    this.shadowRoot = this.core.mount("main", html, css);
    return this.shadowRoot;
  }

  // Basic HTML escaping
  escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
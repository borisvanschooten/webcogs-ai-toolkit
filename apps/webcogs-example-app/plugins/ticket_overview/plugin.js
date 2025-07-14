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

## General guidelines

If showing a user's organization, show the organisation name and not the organizaiton ID.


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


-- Organization role is one of: customer, vendor
CREATE TABLE Organization (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL
);

-- User role is one of: user, developer, admin
CREATE TABLE User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    organization_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL
);

-- Ticket status is same as status of last response
-- Status can be: open, in_progress, fixed, not_fixed
CREATE TABLE Ticket (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	submitted_by INTEGER NOT NULL, -- user ID who submitted the ticket
    assigned_to INTEGER, -- organization ID which the ticket is assigned to
	text TEXT NOT NULL,
	time DATETIME NOT NULL,
    status TEXT NOT NULL
);

-- A ticket can have any number of responses
-- Each response sets at least one of the fields: assigned_to, status, or text.
CREATE TABLE Response (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    time DATETIME NOT NULL,
    assigned_to TEXT,
    status TEXT,
    text TEXT
)

@webcogs_user_prompt
Write a plugin that shows a particular ticket in the database. The ticket ID is passed as a custom parameter to the constructor.  All ticket fields except user ID should be shown in a table.  The user who issued the ticket should be shown in the table as well, along with their organization.  The ticket text should be shown in a large area.  All responses to this ticket should be shown below the ticket.  Show a button "Respond" below the responses which routes to ticket_response. 
@webcogs_end_prompt_section*/
class TicketDetailsPlugin {
  constructor(core, ticketId) {
    this.core = core;
    this.ticketId = ticketId;
    this.init();
  }

  async init() {
    // Fetch ticket
    const ticketArr = await this.core.db.run("SELECT * FROM Ticket WHERE id=?", [this.ticketId]);
    if (!ticketArr || ticketArr.length === 0) {
      this.renderNotFound();
      return;
    }
    const ticket = ticketArr[0];

    // Fetch user + organisation of submitter
    const userArr = await this.core.db.run(
      `SELECT User.*, Organization.name AS org_name
         FROM User JOIN Organization ON User.organization_id = Organization.id
         WHERE User.id=?`,
      [ticket.submitted_by]
    );
    const user = userArr && userArr.length ? userArr[0] : null;

    // Fetch assigned organisation name if any
    let assignedOrgName = "-";
    if (ticket.assigned_to !== null && ticket.assigned_to !== undefined) {
      const orgArr = await this.core.db.run("SELECT name FROM Organization WHERE id=?", [ticket.assigned_to]);
      if (orgArr && orgArr.length) {
        assignedOrgName = orgArr[0].name;
      } else {
        assignedOrgName = String(ticket.assigned_to);
      }
    }

    // Fetch responses
    const responses = await this.core.db.run(
      "SELECT * FROM Response WHERE ticket_id=? ORDER BY time ASC",
      [this.ticketId]
    );

    // Build HTML
    const htmlParts = [];
    htmlParts.push(`<h2>Ticket #${this.ticketId}</h2>`);
    htmlParts.push(`
      <table class="ticket-table">
        <tr><th>ID</th><td>${ticket.id}</td></tr>
        <tr><th>Submitted by</th><td>${user ? `${user.first_name} ${user.surname} (@${user.username})` : ticket.submitted_by}</td></tr>
        <tr><th>User organisation</th><td>${user ? user.org_name : '-'}</td></tr>
        <tr><th>Assigned to</th><td>${assignedOrgName}</td></tr>
        <tr><th>Time</th><td>${ticket.time}</td></tr>
        <tr><th>Status</th><td>${ticket.status}</td></tr>
      </table>
    `);

    // Ticket text
    htmlParts.push(`
      <h3>Description</h3>
      <div class="ticket-text"><pre>${this.escapeHtml(ticket.text)}</pre></div>
    `);

    // Responses
    htmlParts.push(`<h3>Responses (${responses.length})</h3>`);
    if (responses.length === 0) {
      htmlParts.push('<p>No responses yet.</p>');
    } else {
      htmlParts.push('<div class="responses">');
      responses.forEach(r => {
        htmlParts.push(`
          <div class="response">
            <div class="response-meta"><strong>Time:</strong> ${r.time} | <strong>Status:</strong> ${r.status || '-'} | <strong>Assigned to:</strong> ${r.assigned_to || '-'}</div>
            <div class="response-text"><pre>${this.escapeHtml(r.text || '')}</pre></div>
          </div>
        `);
      });
      htmlParts.push('</div>');
    }

    // Respond button
    htmlParts.push(`<div class="respond-btn-container"><button id="respond-btn">Respond</button></div>`);

    const css = `
      .ticket-table th { text-align: left; padding-right: 8px; color: var(--text-color); }
      .ticket-table td { padding: 4px 8px; }
      .ticket-text { background: var(--main-bg-color); border: 1px solid #ccc; padding: 8px; white-space: pre-wrap; }
      .responses { margin-top: 12px; }
      .response { border-top: 1px solid #ccc; padding: 8px 0; }
      .response-meta { font-size: 0.9em; color: #555; margin-bottom: 4px; }
      .response-text { white-space: pre-wrap; }
      #respond-btn { background: var(--button-bg-color); color: var(--button-text-color); padding: 6px 12px; border: none; cursor: pointer; border-radius: 4px; }
      #respond-btn:hover { opacity: 0.9; }
      .respond-btn-container { margin-top: 16px; }
    `;

    // Mount widget
    const fullHtml = `<div class="ticket-details">${htmlParts.join("\n")}</div>`;
    const root = this.core.mount('main', fullHtml, css);

    // Attach click listener for respond button
    const btn = root.getElementById('respond-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.core.route('ticket_response', this.ticketId);
      });
    }
  }

  renderNotFound() {
    const html = `<h2>Ticket not found</h2><p>No ticket with ID ${this.ticketId} exists.</p>`;
    const css = ``;
    this.core.mount('main', html, css);
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

export default TicketDetailsPlugin;
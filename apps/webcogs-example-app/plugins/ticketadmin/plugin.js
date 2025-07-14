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

## Additional core functions

core.getUserId() - get ID of logged in user
core.getUserRole() - get role of logged in user (user, developer, or admin)

## available core.mount locations

- modal_dialog - modal dialog that displays as an overlay
- main - main area of screen
- nav_bar - navigation bar for main menu
- side_bar - side bar for submenus

## core.route routes

A route is a string that indicates a widget plugin name.

## Style guide

Use the classes, styles, and properties in the supplied CSS definitions as much as possible.

## General guidelines

Widgets should always display a title.

If showing an organization, always show the organisation name and not the organization ID.

Users should be shown like this: first_name surname (@username)

Ticket should be shown like this: Ticket #ticket_id


## CSS definitions

:root {
  --text-color: #000;
  --main-bg-color: #fff;
  --nav_bar-bg-color: #eee;
  --top_menu-bg-color: #222;
  --top-menu-text-color: #fff;
  --button-bg-color: #aaf;
  --button-text-color: #006;
  --highlight-ticket-bg-color: #eaa;
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
Write a plugin that shows four lists showing tickets, one for each possible value of ticket status: open, in_progress, fixed, not_fixed.  Lists should be shown one below the other.  Highlight items that are assigned to the logged in user's organization.  Items in the lists should be descendingly ordered by date. The ticket text should be shown in a large area. Each ticket row should also show the username that issued the ticket, the organization name of the user, and the date. When you click on a ticket, it should route to "ticket_overview" with as parameter the ticket ID, except when you click on the user, which should route to "user_overview" with as parameter the user ID. Do not use jquery.

@webcogs_end_prompt_section*/
// TicketStatusLists.js
export default class TicketStatusLists {
  constructor(core) {
    this.core = core;
    this.statuses = [
      { key: "open", label: "Open" },
      { key: "in_progress", label: "In Progress" },
      { key: "fixed", label: "Fixed" },
      { key: "not_fixed", label: "Not Fixed" }
    ];
    // begin initialization (async detached)
    this.init();
  }

  async init() {
    // Identify logged in user's organisation
    const userId = this.core.getUserId();
    const orgRows = await this.core.db.run(
      "SELECT organization_id FROM User WHERE id=?",
      [userId]
    );
    this.loggedOrgId = orgRows.length ? orgRows[0].organization_id : null;

    // fetch tickets grouped by status
    const ticketData = {};
    for (const statusObj of this.statuses) {
      ticketData[statusObj.key] = await this.fetchTicketsByStatus(statusObj.key);
    }

    const { html, css } = this.buildMarkup(ticketData);

    this.shadowRoot = this.core.mount("main", html, css);

    this.attachEventHandlers();
  }

  async fetchTicketsByStatus(status) {
    const rows = await this.core.db.run(
      `SELECT Ticket.id               AS ticket_id,
              Ticket.text             AS ticket_text,
              Ticket.time             AS ticket_time,
              Ticket.assigned_to      AS assigned_to,
              User.id                 AS user_id,
              User.username           AS username,
              User.first_name         AS first_name,
              User.surname            AS surname,
              Organization.name       AS org_name
       FROM Ticket
       JOIN User          ON Ticket.submitted_by = User.id
       JOIN Organization  ON User.organization_id = Organization.id
       WHERE Ticket.status = ?
       ORDER BY Ticket.time DESC`,
      [status]
    );
    return rows;
  }

  escapeHtml(text) {
    if (typeof text !== "string") return text;
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  buildMarkup(ticketData) {
    let html = `
      <div class="ticket-status-lists">
        <h1>Tickets by Status</h1>
        ${this.statuses
          .map((s) => this.buildSectionMarkup(s, ticketData[s.key]))
          .join("")}
      </div>`;

    let css = `
      .ticket-status-lists { color: var(--text-color); background: var(--main-bg-color); padding: 10px; }
      .ticket-section { margin-bottom: 30px; }
      .ticket-section h2 { margin: 0 0 10px 0; }
      .ticket-item { border: 1px solid #ccc; padding: 10px; margin-bottom: 8px; cursor: pointer; background: var(--main-bg-color); transition: background 0.2s ease-in-out; }
      .ticket-item.highlight { background: var(--highlight-ticket-bg-color); }
      .ticket-header { font-size: 0.9em; color: #333; display: flex; flex-wrap: wrap; gap: 8px; }
      .ticket-text { margin-top: 6px; white-space: pre-wrap; font-size: 1.05em; }
      .user-link { color: blue; text-decoration: underline; cursor: pointer; }
      .ticket-date { color: #666; }
    `;
    return { html, css };
  }

  buildSectionMarkup(statusObj, tickets) {
    const itemsHtml = tickets
      .map((t) => {
        const highlightClass =
          this.loggedOrgId !== null && t.assigned_to === this.loggedOrgId
            ? "highlight"
            : "";
        return `<div class="ticket-item ${highlightClass}" data-ticket-id="${t.ticket_id}">
          <div class="ticket-header">
            <span class="user-link" data-user-id="${t.user_id}">${this.escapeHtml(
          `${t.first_name} ${t.surname} (@${t.username})`
        )}</span>
            <span class="ticket-date">${new Date(t.ticket_time).toLocaleString()}</span>
            <span class="ticket-org">${this.escapeHtml(t.org_name)}</span>
          </div>
          <div class="ticket-text">${this.escapeHtml(t.ticket_text)}</div>
        </div>`;
      })
      .join("");

    return `<div class="ticket-section" data-status="${statusObj.key}">
      <h2>${statusObj.label}</h2>
      ${itemsHtml || "<div>No tickets.</div>"}
    </div>`;
  }

  attachEventHandlers() {
    // Ticket clicks
    this.shadowRoot.querySelectorAll('.ticket-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        // If user link clicked, ignore here (handled separately)
        if (e.target.closest('.user-link')) return;
        const ticketId = parseInt(el.getAttribute('data-ticket-id'), 10);
        this.core.route('ticket_overview', ticketId);
      });
    });

    // User link clicks
    this.shadowRoot.querySelectorAll('.user-link').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = parseInt(el.getAttribute('data-user-id'), 10);
        this.core.route('user_overview', userId);
      });
    });
  }
}
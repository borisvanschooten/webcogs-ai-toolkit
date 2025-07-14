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

Use the classes, styles, and properties in the supplied CSS definitions as much as possible.

## General guidelines

Widgets should always display a title.

If showing a user's, ticket's or responses's organization, show the organisation name and not the organization ID.


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
Show the fields of a particular ticket, with a large area for the ticket text. The ticket ID is passed as the second parameter of the constructor. All responses to this ticket should be shown below the ticket. Below that, show a form for creating a new response, with the response text in a textarea, the response status in a multiple choice field, and assigned_to as a multiple choice field with as choices '(unchanged)', and the existing vendor organizations.  Statuses can be: '(unchanged)', open, in_progress, fixed, not_fixed. Add a submit button to submit the response. If a response is submitted, add a response record. Only set text if the text is not empty. Only set status and assigned_to if not unchanged.  Also update the ticket record with status and assigned_to if not unchanged. Then route back to ticket_response.
@webcogs_end_prompt_section*/
export class ticket_response {
  constructor(core, ticket_id) {
    this.core = core;
    this.ticket_id = ticket_id;
    this.init();
  }

  async init() {
    // Load all data we need from DB
    const db = this.core.db;

    // Fetch ticket
    const ticketArr = await db.run("SELECT * FROM Ticket WHERE id=?", [this.ticket_id]);
    if (!ticketArr || ticketArr.length === 0) {
      this.showError(`Ticket #${this.ticket_id} not found.`);
      return;
    }
    const ticket = ticketArr[0];

    // Fetch submitting user and their organisation
    const submitterArr = await db.run("SELECT * FROM User WHERE id=?", [ticket.submitted_by]);
    const submitter = submitterArr && submitterArr.length ? submitterArr[0] : null;
    let submitterOrgName = "";
    if (submitter) {
      const orgArr = await db.run("SELECT name FROM Organization WHERE id=?", [submitter.organization_id]);
      if (orgArr && orgArr.length) submitterOrgName = orgArr[0].name;
    }

    // Fetch assigned organisation for ticket (if any)
    let ticketAssignedOrgName = "";
    if (ticket.assigned_to !== null && ticket.assigned_to !== undefined) {
      const assignedOrgArr = await db.run("SELECT name FROM Organization WHERE id=?", [ticket.assigned_to]);
      if (assignedOrgArr && assignedOrgArr.length) ticketAssignedOrgName = assignedOrgArr[0].name;
    }

    // Fetch responses
    const responses = await db.run("SELECT * FROM Response WHERE ticket_id=? ORDER BY time ASC", [this.ticket_id]);
    // Preload all organisations referenced by responses to avoid many queries
    const orgCache = {};
    const getOrgName = async (orgId) => {
      if (orgId === null || orgId === undefined || orgId === "") return "";
      if (orgCache[orgId]) return orgCache[orgId];
      const orgArr = await db.run("SELECT name FROM Organization WHERE id=?", [orgId]);
      const name = orgArr && orgArr.length ? orgArr[0].name : "";
      orgCache[orgId] = name;
      return name;
    };
    // Map responses to include org names
    for (let resp of responses) {
      resp.assigned_to_name = await getOrgName(resp.assigned_to);
    }

    // Fetch vendor organisations for selector
    const vendorOrgs = await db.run("SELECT id, name FROM Organization WHERE role='vendor' ORDER BY name");

    // Build the HTML interface
    const htmlParts = [];
    htmlParts.push(`<h2>Ticket #${ticket.id}</h2>`);
    htmlParts.push(`<table>
        <tr><th>Submitted by</th><td>${submitter ? submitter.username : ""} (${submitterOrgName})</td></tr>
        <tr><th>Submitted at</th><td>${ticket.time}</td></tr>
        <tr><th>Assigned to</th><td>${ticketAssignedOrgName}</td></tr>
        <tr><th>Status</th><td>${ticket.status}</td></tr>
      </table>`);

    // Ticket text block
    htmlParts.push(`<h3>Description</h3>`);
    htmlParts.push(`<textarea readonly style="width:100%;min-height:120px;">${this.escapeHtml(ticket.text)}</textarea>`);

    // Responses list
    htmlParts.push(`<h3>Responses</h3>`);
    if (responses.length === 0) {
      htmlParts.push(`<p>No responses yet.</p>`);
    } else {
      htmlParts.push(`<div id="resp_list">`);
      for (let resp of responses) {
        htmlParts.push(`<div class="response-block">
            <div class="response-meta">${resp.time} ${resp.status ? "- status: " + resp.status : ""} ${resp.assigned_to_name ? "- assigned to: " + resp.assigned_to_name : ""}</div>
            ${resp.text ? `<pre class="response-text">${this.escapeHtml(resp.text)}</pre>` : ""}
          </div>`);
      }
      htmlParts.push(`</div>`);
    }

    // New response form
    htmlParts.push(`<h3>Add Response</h3>`);
    htmlParts.push(`<div id="new_resp_form">
        <label for="resp_text">Response text</label><br>
        <textarea id="resp_text" style="width:100%;min-height:100px;"></textarea><br><br>

        <label for="resp_status">Status:</label>
        <select id="resp_status">
          <option value="">(unchanged)</option>
          <option value="open">open</option>
          <option value="in_progress">in_progress</option>
          <option value="fixed">fixed</option>
          <option value="not_fixed">not_fixed</option>
        </select>
        <br><br>

        <label for="resp_assigned">Assigned to:</label>
        <select id="resp_assigned">
          <option value="">(unchanged)</option>
          ${vendorOrgs.map(o => `<option value="${o.id}">${this.escapeHtml(o.name)}</option>`).join("\n")}
        </select>
        <br><br>

        <button id="resp_submit" style="background:var(--button-bg-color);color:var(--button-text-color);">Submit response</button>
      </div>`);

    const css = `
      h2,h3 { color: var(--text-color); }
      table { border-collapse: collapse; margin-bottom: 10px; }
      th { text-align: left; padding-right: 6px; }
      textarea[readonly] { background: #f5f5f5; }
      .response-block { border: 1px solid #ccc; padding: 6px; margin-bottom: 8px; background: #fafafa; }
      .response-meta { font-size: 0.9em; color: #555; margin-bottom: 4px; }
      pre.response-text { white-space: pre-wrap; }
    `;

    this.shadowRoot = this.core.mount('main', htmlParts.join('\n'), css);

    // Attach submit handler
    this.shadowRoot.getElementById('resp_submit').addEventListener('click', () => this.submitResponse());
  }

  escapeHtml(text) {
    if (!text && text !== 0) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async submitResponse() {
    const text = this.shadowRoot.getElementById('resp_text').value.trim();
    const status = this.shadowRoot.getElementById('resp_status').value;
    const assigned_to = this.shadowRoot.getElementById('resp_assigned').value;

    if (!text && !status && !assigned_to) {
      alert('Please provide at least one field to submit a response.');
      return;
    }

    const cols = ['ticket_id', 'time'];
    const vals = [this.ticket_id, new Date().toISOString()];

    if (text) {
      cols.push('text');
      vals.push(text);
    }
    if (status) {
      cols.push('status');
      vals.push(status);
    }
    if (assigned_to) {
      cols.push('assigned_to');
      vals.push(assigned_to);
    }

    const placeholders = cols.map(() => '?').join(',');
    const sql = `INSERT INTO Response (${cols.join(',')}) VALUES (${placeholders})`;

    await this.core.db.run(sql, vals);

    // Update ticket if needed
    if (status) {
      await this.core.db.run('UPDATE Ticket SET status=? WHERE id=?', [status, this.ticket_id]);
    }
    if (assigned_to) {
      await this.core.db.run('UPDATE Ticket SET assigned_to=? WHERE id=?', [assigned_to, this.ticket_id]);
    }

    // Go back to ticket_response view (reload)
    this.core.route('ticket_response', this.ticket_id);
  }

  showError(msg) {
    const css = '';
    this.core.mount('main', `<h2>Error</h2><p>${this.escapeHtml(msg)}</p>`, css);
  }
}
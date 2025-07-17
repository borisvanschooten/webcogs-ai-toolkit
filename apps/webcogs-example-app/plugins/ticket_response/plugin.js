/*@webcogs_system_prompt
# Docs for writing a plugin

A plugin is a module that can interact with the user via HTML widgets, or process information.  A plugin is always defined as a single export class, and should be written in vanilla Javascript. Always define the class as an "export class". Do not assume any libraries are available.  For example, do not use jquery.  The class constructor always has this signature: 
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

function core.translate(string) - Translate a string into the user's language.

## Core properties

core.db is a SQLite compatible database object. It has the following functions: 
- async function db.run(sql_statement, optional_values) - execute a SQL statement or query. Note this is an async function. If it is a query, returns an array of objects, otherwise returns null. Each object represents a record, with keys representing the column names and values the record values. If optional_values is supplied, it should be an array, with its elements bound to "?" symbols in the sql_statement string. For example: db.run("SELECT * FROM my_table WHERE id=?",[1000]) will be interpolated to "SELECT * FROM my_table where id=1000". 

## Additional core functions

core.getUserId() - get ID of logged in user
core.getUserRole() - get role of logged in user (user, developer, or admin)
async core.getOrganizations() - get all Organization records

## available core.mount locations

- modal_dialog - modal dialog that displays as an overlay
- main - main area of screen
- nav_bar - navigation bar for main menu
- side_bar - side bar for submenus

## core.route routes

A route is a string that indicates a widget plugin name.

## Style guide

Use the classes, styles, and properties in the supplied CSS definitions as much as possible. Do not override the styles in the CSS classes you use, use them as-is.  You can assume they are available to any widgets you mount.

## General guidelines

Widgets should always display a title.

If showing an organization, always show the organisation name and not the organization ID.

Users should be shown like this: first_name surname (@username)

Ticket should be shown like this: Ticket #ticket_id

This is a multilingual applicatiom. Run all literal strings / texts in the code and HTML through core.translate(). Do not write your own wrapper function, always call core.translate directly.


## CSS definitions

:root {
  --text-color: #000;
  --main-bg-color: #fff;
  --button-bg-color: #bbf;
  --button-text-color: #006;
  --highlight-ticket-bg-color: #fcc;
  --mainmenu-item-selected-bg-color: #66f;
}

\/* Use UL/LI with the following classes for mainmenu *\/
ul.mainmenu {
  list-style: none;
  display: flex;
  gap: 15px;
  background-color: #222;
  margin: 8px;
}
li.mainmenu-item {
  cursor: pointer;
  padding: 10px 5px;
  user-select: none;
  color: #fff;
}

@media (max-width: 700px) {
    ul.mainmenu {
        display: block;
        height: auto;
    }
}

span.logged-in-user {
  font-size: 18px;
  cursor: pointer;
  color: #fff;
}


\/* Use the organization-avatar styles to add an avatar to each organization *\/
div.organization-avatar {
  display: inline-block;
  width: 30px;
  height: 30px;
}
\/* Avatar variant for null organization *\/
div.organization-avatar.id-none {
  background-color: #eee;
}
\/* Avatar variants numbered "id-1" through "id-6" *\/
div.organization-avatar.id-1 {
  background-color: #f84;
}
div.organization-avatar.id-2 {
  background-color: #fe4;
}
div.organization-avatar.id-3 {
  background-color: #0f0;
}
div.organization-avatar.id-4 {
  background-color: #2df;
}
div.organization-avatar.id-5 {
  background-color: #66f;
}
div.organization-avatar.id-6 {
  background-color: #f4f;
}

input[type="text"], input[type="email"] {
  width: 100%;
}
select {
  background-color: var(--button-bg-color);
  font-size: 18px;
}
pre {
  white-space: pre-wrap;
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
    role TEXT NOT NULL
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
export class TicketDetails {
  constructor(core, ticketId) {
    this.core = core;
    this.ticketId = ticketId;
    // mount skeleton immediately
    const html = `<div id="ticket-details"></div>`;
    const css = `
      div#ticket-details { color: var(--text-color); background: var(--main-bg-color); padding: 15px; }
      pre.ticket-text { background: #f9f9f9; padding: 10px; border: 1px solid #ccc; max-height: 300px; overflow: auto; }
      div.response { border-top: 1px solid #ccc; padding: 8px 0; }
      form#response-form textarea { width: 100%; }
      form#response-form select { margin-top: 4px; }
      form#response-form button { margin-top: 8px; background: var(--button-bg-color); color: var(--button-text-color); }
    `;
    this.shadowRoot = this.core.mount('main', html, css);
    this.loadAndRender();
  }

  async loadAndRender() {
    // fetch ticket
    const ticketArr = await this.core.db.run("SELECT * FROM Ticket WHERE id=?", [this.ticketId]);
    if (!ticketArr || ticketArr.length === 0) {
      this.shadowRoot.getElementById('ticket-details').innerHTML = this.core.translate('Ticket not found.');
      return;
    }
    const ticket = ticketArr[0];

    // fetch submitted_by user
    const userArr = await this.core.db.run("SELECT first_name, surname, username FROM User WHERE id=?", [ticket.submitted_by]);
    const userDisp = (userArr && userArr.length)
      ? `${userArr[0].first_name} ${userArr[0].surname} (@${userArr[0].username})`
      : this.core.translate('Unknown');

    // fetch assigned_to org if any
    let assignedDisp = this.core.translate('Unassigned');
    if (ticket.assigned_to !== null && ticket.assigned_to !== undefined) {
      const orgArr = await this.core.db.run("SELECT name FROM Organization WHERE id=?", [ticket.assigned_to]);
      if (orgArr && orgArr.length) {
        assignedDisp = orgArr[0].name;
      }
    }

    // fetch responses
    const responses = await this.core.db.run("SELECT * FROM Response WHERE ticket_id=? ORDER BY time ASC", [this.ticketId]);

    // fetch vendor orgs for select list
    const vendorOrgs = await this.core.db.run("SELECT id, name FROM Organization WHERE role='vendor' ORDER BY name ASC");

    // Build responses HTML
    let respHTML = '';
    if (responses && responses.length) {
      for (const resp of responses) {
        let parts = [];
        parts.push(`<div><strong>${this.core.translate('Time')}: </strong>${resp.time}</div>`);
        if (resp.status) {
          parts.push(`<div><strong>${this.core.translate('Status')}: </strong>${resp.status}</div>`);
        }
        if (resp.assigned_to) {
          // try to resolve organization name
          let orgName = resp.assigned_to;
          const orgRes = await this.core.db.run("SELECT name FROM Organization WHERE id=?", [resp.assigned_to]);
          if (orgRes && orgRes.length) orgName = orgRes[0].name;
          parts.push(`<div><strong>${this.core.translate('Assigned to')}: </strong>${orgName}</div>`);
        }
        if (resp.text) {
          parts.push(`<pre>${resp.text}</pre>`);
        }
        respHTML += `<div class="response">${parts.join('')}</div>`;
      }
    } else {
      respHTML = `<div>${this.core.translate('No responses yet.')}</div>`;
    }

    // build options for status select
    const statusOptions = ['unchanged', 'open', 'in_progress', 'fixed', 'not_fixed'].map(s => {
      const disp = (s === 'unchanged') ? this.core.translate('(unchanged)') : s;
      return `<option value="${s}">${disp}</option>`;
    }).join('');

    // build options for assigned_to select
    let assignOptions = `<option value="unchanged">${this.core.translate('(unchanged)')}</option>`;
    if (vendorOrgs && vendorOrgs.length) {
      for (const org of vendorOrgs) {
        assignOptions += `<option value="${org.id}">${org.name}</option>`;
      }
    }

    // Render all
    const container = this.shadowRoot.getElementById('ticket-details');
    container.innerHTML = `
      <h2>${this.core.translate('Ticket')} #${this.ticketId}</h2>
      <div>
        <p><strong>${this.core.translate('Submitted by')}: </strong>${userDisp}</p>
        <p><strong>${this.core.translate('Assigned to')}: </strong>${assignedDisp}</p>
        <p><strong>${this.core.translate('Status')}: </strong>${ticket.status}</p>
        <p><strong>${this.core.translate('Time')}: </strong>${ticket.time}</p>
      </div>
      <h3>${this.core.translate('Description')}</h3>
      <pre class="ticket-text">${ticket.text}</pre>
      <h3>${this.core.translate('Responses')}</h3>
      <div id="responses-container">${respHTML}</div>
      <h3>${this.core.translate('Add Response')}</h3>
      <form id="response-form">
        <label>${this.core.translate('Text')}</label><br>
        <textarea id="resp-text" rows="5"></textarea><br>
        <label>${this.core.translate('Status')}</label><br>
        <select id="resp-status">${statusOptions}</select><br>
        <label>${this.core.translate('Assigned to')}</label><br>
        <select id="resp-assigned">${assignOptions}</select><br><br>
        <button type="submit">${this.core.translate('Submit')}</button>
      </form>
    `;

    // attach submit handler
    const form = this.shadowRoot.getElementById('response-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  async handleSubmit() {
    const text = this.shadowRoot.getElementById('resp-text').value.trim();
    const statusSel = this.shadowRoot.getElementById('resp-status').value;
    const assignSel = this.shadowRoot.getElementById('resp-assigned').value;

    const now = new Date().toISOString();

    // Prepare dynamic insert for Response
    let cols = ['ticket_id', 'time'];
    let placeholders = ['?', '?'];
    let vals = [this.ticketId, now];

    if (text !== '') {
      cols.push('text');
      placeholders.push('?');
      vals.push(text);
    }
    if (statusSel !== 'unchanged') {
      cols.push('status');
      placeholders.push('?');
      vals.push(statusSel);
    }
    if (assignSel !== 'unchanged') {
      cols.push('assigned_to');
      placeholders.push('?');
      vals.push(assignSel);
    }

    if (cols.length === 2) {
      // Nothing to submit
      return;
    }

    const insertSQL = `INSERT INTO Response (${cols.join(',')}) VALUES (${placeholders.join(',')})`;
    await this.core.db.run(insertSQL, vals);

    // Update ticket if needed
    let updClauses = [];
    let updVals = [];
    if (statusSel !== 'unchanged') {
      updClauses.push('status=?');
      updVals.push(statusSel);
    }
    if (assignSel !== 'unchanged') {
      updClauses.push('assigned_to=?');
      updVals.push(assignSel);
    }
    if (updClauses.length > 0) {
      updVals.push(this.ticketId);
      const updSQL = `UPDATE Ticket SET ${updClauses.join(', ')} WHERE id=?`;
      await this.core.db.run(updSQL, updVals);
    }

    // Route back
    this.core.route('ticket_response', this.ticketId);
  }
}
/*@webcogs_build 0.3.3 openai-gpt-5 2025-09-02T11:21:22.104Z
@webcogs_system_prompt
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

function core.translate(string) - Translate a literal string into the user's language.

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

Form fields, labels, and buttons should be left-aligned.

Email form fields should be implemented using input type="email".

If showing an organization, always show the organisation name and not the organization ID.

Users should be shown like this: first_name surname (@username).

Ticket should be shown like this: Ticket #ticket_id.

This is a multilingual application. Run all literal strings / texts in the code and HTML through core.translate(). Do not write your own wrapper function, always call core.translate directly.


## CSS definitions

:root {
  --text-color: #000;
  --main-bg-color: #fff;
  --button-bg-color: #bbf;
  --button-text-color: #006;
  --highlight-ticket-bg-color: #fcc;
  --mainmenu-item-selected-bg-color: #88f;
}

\/* Use UL/LI with the following classes for mainmenu *\/
ul.mainmenu {
  list-style: none;
  display: flex;
  gap: 15px;
  margin: 8px;
  padding: 0px;
  padding-left: 90px;
  background-image: url('images/logo40-title.png');
  background-repeat: no-repeat;
  background-position: 0% 50%;
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
        background: none;
        padding-left: 0px;
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

input[type="text"], input[type="email"], input[type="password"] {
  width: 100%;
  min-width: 300px;
}

select {
  background-color: var(--button-bg-color);
  font-size: 18px;
  border: 2px solid #88c;
  padding: 4px;
  margin: 4px;
  border-radius: 4px;
}

button {
  background-color: var(--button-bg-color);
  color: var(--button-text-color);
  padding: 4px 12px;
  font-size: 18px;
  cursor: pointer;
  border: 2px solid #88c;
  border-radius: 4px;
  box-shadow: 4px 4px 4px rgba(0,0,0,0.1);
}
button.route-to-signup {
  border: none;
  background-color: transparent;
  font-weight: bold;
  text-decoration: underline;
  box-shadow: none;
}

\/* use pre.ticket-text to show the content of ticket and response text *\/
pre, pre.ticket-text {
  white-space: pre-wrap;
  font-family: Arial, sans-serif;
  background: #eee;
  padding: 10px;
  border: 1px solid #aaa;
}

div.login-screen-title {
  font-size: 22px;
  font-weight: bold;
  background-image: url('images/logo40.png');
  height: 40px;
  line-height: 40px;
  background-repeat: no-repeat;
  background-position: 0% 50%;
  padding-left: 80px;
  margin-bottom: 10px;
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
	submitted_by INTEGER NOT NULL, -- user ID who submitted the ticket
    time DATETIME NOT NULL,
    assigned_to TEXT,
    status TEXT,
    text TEXT
)

@webcogs_user_prompt
Write a plugin that shows a single user in a table with two columns, keys left and values right. The user ID is passed as a custom parameter to the constructor.  Below the user table should be the list of tickets submitted by the user. Each ticket should list the description and submitted date. When you click on a ticket, route to ticket_overview with the ticket ID as custom parameter. Below that is a list of tickets assigned to the user's organization.  Open tickets should be highlighted in both lists.


@webcogs_end_prompt_section*/
export class UserDetailsPlugin {
  constructor(core, userId) {
    this.core = core;
    this.userId = userId;
    this.shadow = this.core.mount(
      'main',
      `
        <div class="user-overview">
          <h2 id="title"></h2>
          <table id="user-table" class="user-table">
            <tbody id="user-tbody"></tbody>
          </table>

          <h3 id="submitted-title"></h3>
          <ul id="submitted-list" class="ticket-list"></ul>

          <h3 id="assigned-title"></h3>
          <ul id="assigned-list" class="ticket-list"></ul>
        </div>
      `,
      `
        .user-overview { color: var(--text-color); background: var(--main-bg-color); }
        .user-overview h2 { margin-top: 0; }
        table.user-table { border-collapse: collapse; margin-top: 8px; }
        table.user-table td { border: 1px solid #ccc; padding: 6px; vertical-align: top; }
        table.user-table td.key { font-weight: bold; width: 220px; }
        ul.ticket-list { list-style: none; padding: 0; margin: 4px 0 16px 0; }
        ul.ticket-list li { border: 1px solid #ccc; padding: 8px; margin: 6px 0; cursor: pointer; border-radius: 4px; }
        ul.ticket-list li:hover { box-shadow: 0 0 4px rgba(0,0,0,0.15); }
        .ticket-title { font-weight: bold; }
        .ticket-date { font-size: 12px; color: #555; }
        .ticket-text { margin-top: 6px; white-space: pre-wrap; }
        .organization-field { display: flex; align-items: center; gap: 8px; }
      `
    );

    this.init();
  }

  async init() {
    const t = (s) => this.core.translate(s);

    // Element references
    this.titleEl = this.shadow.getElementById('title');
    this.userTbody = this.shadow.getElementById('user-tbody');
    this.submittedTitle = this.shadow.getElementById('submitted-title');
    this.submittedList = this.shadow.getElementById('submitted-list');
    this.assignedTitle = this.shadow.getElementById('assigned-title');
    this.assignedList = this.shadow.getElementById('assigned-list');

    // Set initial titles
    this.titleEl.textContent = t('User');
    this.submittedTitle.textContent = t('Tickets submitted by this user');
    this.assignedTitle.textContent = t('Tickets assigned to this user\'s organization');

    if (!this.userId && this.userId !== 0) {
      this.userTbody.innerHTML = '';
      const tr = document.createElement('tr');
      tr.appendChild(this._td(t('Error')));
      tr.appendChild(this._td(t('No user ID provided')));
      this.userTbody.appendChild(tr);
      return;
    }

    // Load user, organization, and tickets
    const user = await this._getUser(this.userId);
    if (!user) {
      this.userTbody.innerHTML = '';
      const tr = document.createElement('tr');
      tr.appendChild(this._td(t('Error')));
      tr.appendChild(this._td(t('User not found')));
      this.userTbody.appendChild(tr);
      return;
    }

    const org = await this._getOrganization(user.organization_id);

    // Render user title and table
    this.titleEl.textContent = `${t('User')}: ${this._formatUser(user)}`;
    this._renderUserTable(user, org);

    // Tickets submitted by user
    const submittedTickets = await this._getTicketsSubmittedByUser(user.id);
    this._renderTicketList(
      this.submittedList,
      submittedTickets,
      (ticket) => this.core.route('ticket_overview', ticket.id)
    );

    // Tickets assigned to user's organization
    if (org) {
      this.assignedTitle.textContent = `${t("Tickets assigned to organization")} ${org.name}`;
      const assignedTickets = await this._getTicketsAssignedToOrg(org.id);
      this._renderTicketList(
        this.assignedList,
        assignedTickets,
        (ticket) => this.core.route('ticket_overview', ticket.id)
      );
    } else {
      this.assignedTitle.textContent = t("Tickets assigned to organization");
      this.assignedList.innerHTML = '';
      const li = document.createElement('li');
      li.textContent = t('No organization found');
      this.assignedList.appendChild(li);
    }
  }

  _td(textOrNode, isKey = false) {
    const td = document.createElement('td');
    if (typeof textOrNode === 'string') {
      td.textContent = textOrNode;
    } else if (textOrNode instanceof Node) {
      td.appendChild(textOrNode);
    }
    if (isKey) td.classList.add('key');
    return td;
  }

  _renderUserTable(user, org) {
    const t = (s) => this.core.translate(s);
    this.userTbody.innerHTML = '';

    const addRow = (key, valueNodeOrStr) => {
      const tr = document.createElement('tr');
      tr.appendChild(this._td(t(key), true));
      tr.appendChild(this._td(valueNodeOrStr));
      this.userTbody.appendChild(tr);
    };

    // ID
    addRow('ID', String(user.id));

    // Username
    addRow('Username', user.username);

    // Full name
    addRow('Full name', `${user.first_name} ${user.surname}`);

    // Email
    addRow('Email', user.email);

    // Organization (name, not ID) with avatar
    const orgContainer = document.createElement('div');
    orgContainer.className = 'organization-field';
    const avatar = document.createElement('div');
    avatar.className = 'organization-avatar ' + (org && org.id ? ('id-' + this._orgAvatarClass(org.id)) : 'id-none');
    const orgName = document.createElement('span');
    orgName.textContent = org ? org.name : t('None');
    orgContainer.appendChild(avatar);
    orgContainer.appendChild(orgName);
    addRow('Organization', orgContainer);

    // Role
    addRow('Role', user.role);
  }

  _formatUser(u) {
    return `${u.first_name} ${u.surname} (@${u.username})`;
  }

  _orgAvatarClass(orgId) {
    // Map any orgId to one of id-1..id-6
    let n = orgId % 6;
    if (n === 0) n = 6;
    return String(n);
  }

  _renderTicketList(containerEl, tickets, onClick) {
    const t = (s) => this.core.translate(s);
    containerEl.innerHTML = '';

    if (!tickets || tickets.length === 0) {
      const li = document.createElement('li');
      li.textContent = t('No tickets found');
      containerEl.appendChild(li);
      return;
    }

    tickets.forEach((ticket) => {
      const li = document.createElement('li');
      if ((ticket.status || '').toLowerCase() === 'open') {
        li.style.backgroundColor = 'var(--highlight-ticket-bg-color)';
      }
      const title = document.createElement('div');
      title.className = 'ticket-title';
      title.textContent = `${t('Ticket')} #${ticket.id}`;

      const date = document.createElement('div');
      date.className = 'ticket-date';
      const dt = new Date(ticket.time);
      date.textContent = `${t('Submitted')}: ${isNaN(dt.getTime()) ? ticket.time : dt.toLocaleString()}`;

      const text = document.createElement('div');
      text.className = 'ticket-text';
      text.textContent = ticket.text || '';

      li.appendChild(title);
      li.appendChild(date);
      li.appendChild(text);

      li.addEventListener('click', () => onClick(ticket));

      containerEl.appendChild(li);
    });
  }

  async _getUser(id) {
    const rows = await this.core.db.run('SELECT * FROM User WHERE id=?', [id]);
    return rows && rows.length ? rows[0] : null;
  }

  async _getOrganization(id) {
    const rows = await this.core.db.run('SELECT * FROM Organization WHERE id=?', [id]);
    return rows && rows.length ? rows[0] : null;
  }

  async _getTicketsSubmittedByUser(userId) {
    const rows = await this.core.db.run(
      'SELECT id, text, time, status FROM Ticket WHERE submitted_by=? ORDER BY time DESC',
      [userId]
    );
    return rows || [];
  }

  async _getTicketsAssignedToOrg(orgId) {
    const rows = await this.core.db.run(
      'SELECT id, text, time, status FROM Ticket WHERE assigned_to=? ORDER BY time DESC',
      [orgId]
    );
    return rows || [];
  }
}

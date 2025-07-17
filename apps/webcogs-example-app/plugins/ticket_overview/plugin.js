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
Write a plugin that shows a particular ticket in the database. The ticket ID is passed as a custom parameter to the constructor.  All ticket fields except user ID should be shown in a table.  The user who issued the ticket should be shown in the table as well, along with their organization.  The ticket text should be shown in a large area.  All responses to this ticket should be shown below the ticket.  Show a button "Respond" below the responses which routes to ticket_response. 
@webcogs_end_prompt_section*/
export class ShowTicket {
    constructor(core, ticketId) {
        this.core = core;
        this.ticketId = ticketId;
        this.shadow = null;
        // Immediately mount a loading message
        const loadingHtml = `
          <div>
            <h2>${core.translate('Loading ticket')} #${ticketId}...</h2>
          </div>`;
        this.shadow = core.mount('main', loadingHtml, ``);
        // Fetch and render the ticket
        this.init();
    }

    async init() {
        try {
            const db = this.core.db;
            // Fetch ticket record
            const tickets = await db.run("SELECT * FROM Ticket WHERE id=?", [this.ticketId]);
            if (tickets.length === 0) {
                this.renderNotFound();
                return;
            }
            const ticket = tickets[0];

            // Fetch submitting user
            const users = await db.run("SELECT * FROM User WHERE id=?", [ticket.submitted_by]);
            const user = users.length ? users[0] : null;

            // Fetch organization of user
            let org = null;
            if (user) {
                const orgs = await db.run("SELECT * FROM Organization WHERE id=?", [user.organization_id]);
                org = orgs.length ? orgs[0] : null;
            }

            // Fetch all responses for ticket, ordered by time ascending
            const responses = await db.run("SELECT * FROM Response WHERE ticket_id=? ORDER BY time ASC", [this.ticketId]);

            // For any response which has assigned_to, fetch organisation names (cache)
            const orgCache = {};
            for (const resp of responses) {
                if (resp.assigned_to && !(resp.assigned_to in orgCache)) {
                    const os = await db.run("SELECT * FROM Organization WHERE id=?", [resp.assigned_to]);
                    orgCache[resp.assigned_to] = os.length ? os[0] : null;
                }
            }

            // Also fetch ticket.assigned_to org if exists
            let assignedOrg = null;
            if (ticket.assigned_to) {
                const aos = await db.run("SELECT * FROM Organization WHERE id=?", [ticket.assigned_to]);
                assignedOrg = aos.length ? aos[0] : null;
            }

            // Render everything
            this.renderTicket(ticket, user, org, assignedOrg, responses, orgCache);
        } catch (e) {
            this.renderError(e);
        }
    }

    renderNotFound() {
        this.shadow.innerHTML = `<h2>${this.core.translate('Ticket not found')}</h2>`;
    }

    renderError(err) {
        this.shadow.innerHTML = `<h2>${this.core.translate('Error loading ticket')}</h2><pre>${err.toString()}</pre>`;
    }

    renderTicket(ticket, user, userOrg, assignedOrg, responses, orgCache) {
        const core = this.core;
        const translate = core.translate;

        const userDisplay = user
            ? `${user.first_name} ${user.surname} (@${user.username})`
            : core.translate('Unknown user');
        const orgDisplay = userOrg ? userOrg.name : core.translate('Unknown organization');

        const assignedDisplay = assignedOrg ? assignedOrg.name : core.translate('None');

        // Build ticket table HTML
        const ticketTableHtml = `
          <table>
            <tr><th>${core.translate('Ticket')}</th><td>#${ticket.id}</td></tr>
            <tr><th>${core.translate('Submitted by')}</th><td>${userDisplay} – ${orgDisplay}</td></tr>
            <tr><th>${core.translate('Assigned to')}</th><td>${assignedDisplay}</td></tr>
            <tr><th>${core.translate('Time')}</th><td>${ticket.time}</td></tr>
            <tr><th>${core.translate('Status')}</th><td>${core.translate(ticket.status)}</td></tr>
          </table>
        `;

        // Ticket text area
        const ticketTextHtml = `
          <h3>${core.translate('Ticket text')}</h3>
          <pre>${ticket.text}</pre>
        `;

        // Responses HTML
        let responsesHtml = `
          <h3>${core.translate('Responses')}</h3>
        `;

        if (responses.length === 0) {
            responsesHtml += `<div>${core.translate('No responses yet')}</div>`;
        } else {
            responsesHtml += `<div>`;
            responses.forEach(resp => {
                const respStatus = resp.status ? core.translate(resp.status) : '';
                const respAssignedOrg = resp.assigned_to ? (orgCache[resp.assigned_to] ? orgCache[resp.assigned_to].name : core.translate('Unknown organization')) : '';
                responsesHtml += `
                  <div style="border:1px solid #ccc; padding:8px; margin-bottom:10px;">
                    <div><strong>${core.translate('Time')}:</strong> ${resp.time}</div>
                    ${respStatus ? `<div><strong>${core.translate('Status')}:</strong> ${respStatus}</div>` : ''}
                    ${respAssignedOrg ? `<div><strong>${core.translate('Assigned to')}:</strong> ${respAssignedOrg}</div>` : ''}
                    ${resp.text ? `<pre>${resp.text}</pre>` : ''}
                  </div>
                `;
            });
            responsesHtml += `</div>`;
        }

        // Respond button
        const respondButtonHtml = `
          <button id="respond-btn" style="background-color: var(--button-bg-color); color: var(--button-text-color); padding: 8px 15px; font-size: 18px; cursor: pointer;">${core.translate('Respond')}</button>
        `;

        const fullHtml = `
          <div>
            <h2>${core.translate('Ticket')} #${ticket.id}</h2>
            ${ticketTableHtml}
            ${ticketTextHtml}
            ${responsesHtml}
            ${respondButtonHtml}
          </div>
        `;

        const css = ``; // No extra CSS needed beyond inline styles

        // Replace shadow content
        this.shadow.innerHTML = fullHtml;

        // Attach button handler
        const btn = this.shadow.getElementById('respond-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                this.core.route('ticket_response', this.ticketId);
            });
        }
    }
}
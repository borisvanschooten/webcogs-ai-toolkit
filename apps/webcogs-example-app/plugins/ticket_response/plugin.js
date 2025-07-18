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

async function core.loadTranslations(language_code) - load translations for a particular language
language_code - an ISO language code, for example "en_us" or "en_gb", or null for the default

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

Form fields, labels, and buttons should be left-aligned.

Email form fields should be implemented using input type="email".

If showing an organization, always show the organisation name and not the organization ID.

Users should be shown like this: first_name surname (@username).

Ticket should be shown like this: Ticket #ticket_id.

This is a multilingual applicatiom. Run all literal strings / texts in the code and HTML through core.translate(). Do not write your own wrapper function, always call core.translate directly.


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
  padding-left: 90px;
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
Show the fields of a particular ticket, with a large area for the ticket text. The ticket ID is passed as the second parameter of the constructor. All responses to this ticket should be shown below the ticket. Below that, show a form for creating a new response, with the response text in a textarea, the response status in a multiple choice field, and assigned_to as a multiple choice field with as choices '(unchanged)', and the existing vendor organizations.  Statuses can be: '(unchanged)', open, in_progress, fixed, not_fixed. Add a submit button to submit the response. If a response is submitted, add a response record with submitted_by set to the logged in user. Only set text if the text is not empty. Only set status and assigned_to if not unchanged.  Also update the ticket record with status and assigned_to if not unchanged. Then route back to ticket_response.
@webcogs_end_prompt_section*/
export class TicketDetails {
    constructor(core, ticketId) {
        this.core = core;
        this.ticketId = ticketId;
        this.shadow = null;
        this.init();
    }

    async init() {
        // Load all data and then render
        await this.loadData();
        this.render();
    }

    async loadData() {
        const db = this.core.db;
        // Ticket
        const tickets = await db.run("SELECT Ticket.*, User.first_name, User.surname, User.username FROM Ticket JOIN User ON Ticket.submitted_by=User.id WHERE Ticket.id=?", [this.ticketId]);
        this.ticket = tickets.length ? tickets[0] : null;
        // Responses
        this.responses = await db.run(`SELECT Response.*, User.first_name, User.surname, User.username 
                                        FROM Response JOIN User ON Response.submitted_by=User.id 
                                        WHERE ticket_id=? ORDER BY time`, [this.ticketId]);
        // Vendor organizations for assignment
        this.vendorOrgs = await this.core.getOrganizations();
        this.vendorOrgs = this.vendorOrgs.filter(o => o.role === 'vendor');
    }

    translateUser(r) {
        return `${r.first_name} ${r.surname} (@${r.username})`;
    }

    render() {
        const htmlParts = [];
        htmlParts.push(`<h2>${this.core.translate('Ticket')} #${this.ticketId}</h2>`);
        htmlParts.push(`<div><strong>${this.core.translate('Submitted by')}:</strong> ${this.translateUser(this.ticket)}</div>`);
        htmlParts.push(`<div><strong>${this.core.translate('Status')}:</strong> ${this.core.translate(this.ticket.status)}</div>`);
        htmlParts.push(`<div><strong>${this.core.translate('Assigned to')}:</strong> ${this.ticket.assigned_to ? this.getOrgName(this.ticket.assigned_to) : this.core.translate('(none)')}</div>`);
        htmlParts.push(`<div style="margin-top:10px;"><strong>${this.core.translate('Ticket text')}:</strong></div>`);
        htmlParts.push(`<pre class="ticket-text">${this.escapeHTML(this.ticket.text)}</pre>`);

        // Responses
        htmlParts.push(`<h3 style="margin-top:20px;">${this.core.translate('Responses')}</h3>`);
        if (this.responses.length === 0) {
            htmlParts.push(`<div>${this.core.translate('No responses yet.')}</div>`);
        } else {
            this.responses.forEach(resp => {
                htmlParts.push(this.renderResponse(resp));
            });
        }

        // New response form
        htmlParts.push(`<h3 style="margin-top:20px;">${this.core.translate('Add response')}</h3>`);
        htmlParts.push(`
            <form id="new-response-form">
                <div style="margin-bottom:8px;">
                    <label>${this.core.translate('Response text')}:</label><br/>
                    <textarea id="response-text" style="width:100%;min-width:300px;height:120px;"></textarea>
                </div>
                <div style="margin-bottom:8px;">
                    <label for="response-status">${this.core.translate('Status')}:</label><br/>
                    <select id="response-status">
                        ${["(unchanged)", "open", "in_progress", "fixed", "not_fixed"].map(st => `<option value="${st}">${this.core.translate(st)}</option>`).join('')}
                    </select>
                </div>
                <div style="margin-bottom:8px;">
                    <label for="response-assigned">${this.core.translate('Assigned to')}:</label><br/>
                    <select id="response-assigned">
                        <option value="unchanged">${this.core.translate('(unchanged)')}</option>
                        ${this.vendorOrgs.map(org => `<option value="${org.id}">${this.escapeHTML(org.name)}</option>`).join('')}
                    </select>
                </div>
                <button type="submit">${this.core.translate('Submit')}</button>
            </form>
        `);

        const html = htmlParts.join('');
        const css = ``; // rely on global styles

        this.shadow = this.core.mount('main', html, css);
        this.addListeners();
    }

    renderResponse(resp) {
        const pieces = [];
        pieces.push(`<div style="border:1px solid #ccc; padding:10px; margin-bottom:10px;">`);
        pieces.push(`<div><strong>${this.translateUser(resp)}</strong> - ${new Date(resp.time).toLocaleString()}</div>`);
        if (resp.status) {
            pieces.push(`<div><strong>${this.core.translate('Status')}:</strong> ${this.core.translate(resp.status)}</div>`);
        }
        if (resp.assigned_to) {
            pieces.push(`<div><strong>${this.core.translate('Assigned to')}:</strong> ${this.getOrgName(resp.assigned_to)}</div>`);
        }
        if (resp.text) {
            pieces.push(`<pre class="ticket-text">${this.escapeHTML(resp.text)}</pre>`);
        }
        pieces.push(`</div>`);
        return pieces.join('');
    }

    addListeners() {
        const form = this.shadow.querySelector('#new-response-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitResponse();
        });
    }

    async submitResponse() {
        const textEl = this.shadow.querySelector('#response-text');
        const statusEl = this.shadow.querySelector('#response-status');
        const assignEl = this.shadow.querySelector('#response-assigned');

        const textVal = textEl.value.trim();
        const statusVal = statusEl.value;
        const assignVal = assignEl.value;

        const fields = { }; // to insert into Response
        if (textVal) fields.text = textVal;
        if (statusVal !== '(unchanged)') fields.status = statusVal;
        if (assignVal !== 'unchanged') fields.assigned_to = assignVal;

        if (Object.keys(fields).length === 0) {
            alert(this.core.translate('Please enter at least one change or some text.'));
            return;
        }

        const db = this.core.db;
        const now = new Date().toISOString();
        const userId = this.core.getUserId();

        // Build dynamic SQL for Response
        const cols = ['ticket_id', 'submitted_by', 'time'];
        const placeholders = ['?', '?', '?'];
        const values = [this.ticketId, userId, now];
        if (fields.text !== undefined) { cols.push('text'); placeholders.push('?'); values.push(fields.text); }
        if (fields.status !== undefined) { cols.push('status'); placeholders.push('?'); values.push(fields.status); }
        if (fields.assigned_to !== undefined) { cols.push('assigned_to'); placeholders.push('?'); values.push(fields.assigned_to); }

        const sql = `INSERT INTO Response (${cols.join(',')}) VALUES (${placeholders.join(',')})`;
        await db.run(sql, values);

        // Update ticket if needed
        const ticketUpdates = [];
        const updateValues = [];
        if (fields.status !== undefined) { ticketUpdates.push('status=?'); updateValues.push(fields.status); }
        if (fields.assigned_to !== undefined) { ticketUpdates.push('assigned_to=?'); updateValues.push(fields.assigned_to); }
        if (ticketUpdates.length) {
            updateValues.push(this.ticketId);
            await db.run(`UPDATE Ticket SET ${ticketUpdates.join(', ')} WHERE id=?`, updateValues);
        }

        // Route back to ticket_response
        this.core.route('ticket_response', this.ticketId);
    }

    getOrgName(orgId) {
        const org = this.vendorOrgs.find(o => o.id == orgId);
        return org ? org.name : '';
    }

    escapeHTML(str) {
        return str.replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
}

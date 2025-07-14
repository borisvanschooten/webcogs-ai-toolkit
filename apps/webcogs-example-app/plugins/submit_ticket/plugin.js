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
Show a form to submit a ticket, with the following fields: text - a textarea; assigned_to - a dropdown with as options None (NULL), and each vendor organization.  Show a submit button that creates a new ticket when clicked.  The new ticket must have status=open and submitted_by equals the currently logged in user. Route to show_popup with as custom parameter 'Ticket submitted.'.
@webcogs_end_prompt_section*/
// SubmitTicketFormPlugin.js
// A plugin that shows a form for submitting a new ticket

export default class SubmitTicketFormPlugin {
    constructor(core) {
        this.core = core;
        this.shadow = null;
        this.init();
    }

    async init() {
        // Fetch vendor organisations for the dropdown
        let vendors = [];
        try {
            vendors = await this.core.db.run("SELECT id, name FROM Organization WHERE role=?", ["vendor"]);
        } catch (e) {
            console.error("DB error while fetching vendors", e);
        }

        // Build the options HTML
        let optionsHtml = '<option value="">None</option>'; // empty value -> NULL
        vendors.forEach(v => {
            // Always show organization name, not ID
            optionsHtml += `<option value="${v.id}">${this.escapeHtml(v.name)}</option>`;
        });

        // HTML for the widget
        const html = `
            <div class="ticket-form">
                <h2>Submit Ticket</h2>
                <label>
                    Text:<br />
                    <textarea id="ticket_text" rows="5" style="width:100%;"></textarea>
                </label>
                <br /><br />
                <label>
                    Assigned to:<br />
                    <select id="assigned_to">${optionsHtml}</select>
                </label>
                <br /><br />
                <button id="submit_btn" class="submit-btn">Submit</button>
            </div>
        `;

        // CSS for the widget
        const css = `
            .ticket-form { color: var(--text-color); background: var(--main-bg-color); padding: 1em; }
            .ticket-form h2 { margin-top: 0; }
            .submit-btn { background: var(--button-bg-color); color: var(--button-text-color); padding: 0.5em 1em; border: none; cursor: pointer; }
            .submit-btn:hover { opacity: 0.9; }
        `;

        // Mount the widget in the main area
        this.shadow = this.core.mount('main', html, css);

        // Attach event listener
        this.shadow.getElementById('submit_btn').addEventListener('click', () => this.submitTicket());
    }

    // Escape HTML utility
    escapeHtml(text) {
        return text.replace(/[&<>"']/g, function (m) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
        });
    }

    async submitTicket() {
        const textArea = this.shadow.getElementById('ticket_text');
        const select = this.shadow.getElementById('assigned_to');

        const text = textArea.value.trim();
        if (!text) {
            // simple validation – do not create empty tickets
            alert('Text cannot be empty.');
            return;
        }

        const assignedToRaw = select.value;
        const assignedTo = assignedToRaw === '' ? null : parseInt(assignedToRaw, 10);
        const now = new Date().toISOString();
        const userId = this.core.getUserId();

        try {
            await this.core.db.run(
                'INSERT INTO Ticket (submitted_by, assigned_to, text, time, status) VALUES (?,?,?,?,?)',
                [userId, assignedTo, text, now, 'open']
            );
        } catch (e) {
            console.error('Failed to create ticket', e);
            alert('Failed to submit ticket. Please try again.');
            return;
        }

        // Route to popup confirmation
        this.core.route('show_popup', 'Ticket submitted.');

        // Optionally clear form
        textArea.value = '';
        select.value = '';
    }
}
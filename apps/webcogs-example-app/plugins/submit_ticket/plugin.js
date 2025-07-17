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
Show a form to submit a ticket, with the following fields: text - a wide textarea; assigned_to - a dropdown with as options None (NULL), and each vendor organization.  Show a submit button that creates a new ticket when clicked.  The new ticket has status=open and submitted_by equals the currently logged in user. Route to show_popup with as custom parameter 'Ticket submitted.'.
@webcogs_end_prompt_section*/
export class SubmitTicketForm {
    constructor(core, ...custom_params) {
        this.core = core;
        this.shadow = null;
        // Immediately-invoked async init
        (async () => {
            await this.init();
        })();
    }

    async init() {
        // Fetch all organizations and keep only vendors
        const allOrgs = await this.core.getOrganizations();
        const vendorOrgs = (allOrgs || []).filter(org => org.role === 'vendor');

        // Build <option> list for the select element
        let optionsHtml = `<option value="">${this.core.translate('None')}</option>`;
        for (const org of vendorOrgs) {
            // Organization option shows organization name, not ID
            optionsHtml += `<option value="${org.id}">${this.core.translate(org.name)}</option>`;
        }

        // Compose the widget HTML
        const html = `
            <h2>${this.core.translate('Submit a Ticket')}</h2>
            <form id="ticket-form">
                <label>
                    ${this.core.translate('Text')}<br/>
                    <textarea id="ticket-text" rows="8" style="width:100%;"></textarea>
                </label>
                <br/>
                <label>
                    ${this.core.translate('Assigned to')}
                    <select id="assigned-to">${optionsHtml}</select>
                </label>
                <br/><br/>
                <button id="submit-btn" type="submit">${this.core.translate('Submit')}</button>
            </form>
        `;

        // Simple CSS for the widget
        const css = `
            h2 {
                color: var(--text-color);
            }
            button {
                background-color: var(--button-bg-color);
                color: var(--button-text-color);
                padding: 8px 16px;
                font-size: 16px;
                cursor: pointer;
            }
        `;

        // Mount the widget in the main area
        this.shadow = this.core.mount('main', html, css);

        // Attach submit handler
        const formEl = this.shadow.getElementById('ticket-form');
        if (formEl) {
            formEl.addEventListener('submit', (event) => this.onSubmit(event));
        }
    }

    async onSubmit(event) {
        event.preventDefault();

        // Get form values
        const textEl = this.shadow.getElementById('ticket-text');
        const selectEl = this.shadow.getElementById('assigned-to');

        const textValue = textEl ? textEl.value.trim() : '';
        const assignedValue = selectEl ? selectEl.value : '';

        // Basic guard: do not allow empty text
        if (!textValue) {
            alert(this.core.translate('Please enter ticket text.'));
            return;
        }

        const submittedBy = this.core.getUserId();
        const assignedTo = assignedValue === '' ? null : parseInt(assignedValue, 10);
        const now = new Date().toISOString();

        // Insert new ticket into the database
        await this.core.db.run(
            'INSERT INTO Ticket (submitted_by, assigned_to, text, time, status) VALUES (?,?,?,?,?)',
            [submittedBy, assignedTo, textValue, now, 'open']
        );

        // Notify user and route to popup
        this.core.route('show_popup', this.core.translate('Ticket submitted.'));
    }
}
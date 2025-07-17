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
Create a widget that has a view mode and an edit mode, set via a constructor custom boolean parameter 'edit_mode'. In view mode, show the currently logged in user record in a table with two columns, keys left and values right, and show an edit button. which routes to user_profile with edit_mode=true.  In edit mode, show a form where you can edit email, first_name, surname, a dropdown showing organization names for selecting the organization_id, and a dropdown for selecting role (user, developer).  A submit button updates the filled-in user fields and routes to user_profile. A cancel button returns to view mode.
@webcogs_end_prompt_section*/
export class UserProfile {
    constructor(core, edit_mode = false) {
        this.core = core;
        this.edit_mode = !!edit_mode;
        // We will hold user and org data
        this.user = null;
        this.organizations = [];
        // Start rendering process
        this.init();
    }

    async init() {
        // Load user and organizations first
        const userId = this.core.getUserId();
        // Fetch user record
        const users = await this.core.db.run("SELECT * FROM User WHERE id=?", [userId]);
        if (users && users.length) {
            this.user = users[0];
        } else {
            // User not found, nothing to show
            this.user = null;
        }
        // Fetch organizations list
        this.organizations = await this.core.getOrganizations();

        // Render view
        if (this.edit_mode) {
            this.renderEditMode();
        } else {
            this.renderViewMode();
        }
    }

    mountWidget(html) {
        // Helper to mount and keep reference to root
        if (this.shadow_root) {
            // if already mounted, replace innerHTML
            this.shadow_root.innerHTML = html;
            return;
        }
        this.shadow_root = this.core.mount('main', html, "");
    }

    renderViewMode() {
        if (!this.user) {
            this.mountWidget(`<div>${this.core.translate('User not found.')}</div>`);
            return;
        }
        const rows = [
            ['ID', this.user.id],
            ['Username', this.user.username],
            ['Email', this.user.email],
            ['First name', this.user.first_name],
            ['Surname', this.user.surname],
            ['Organization', this.getOrganizationName(this.user.organization_id)],
            ['Role', this.user.role]
        ];
        let tableRowsHtml = rows.map(r => `<tr><td><strong>${this.core.translate(r[0])}</strong></td><td>${this.escapeHtml(String(r[1]))}</td></tr>`).join('');

        const html = `
            <div>
                <h2>${this.core.translate('User Profile')}</h2>
                <table>${tableRowsHtml}</table>
                <br />
                <button id="edit-btn">${this.core.translate('Edit')}</button>
            </div>
        `;
        this.mountWidget(html);
        // Attach event listener
        const editBtn = this.shadow_root.querySelector('#edit-btn');
        editBtn.addEventListener('click', () => {
            this.core.route('user_profile', true);
        });
    }

    renderEditMode() {
        if (!this.user) {
            this.mountWidget(`<div>${this.core.translate('User not found.')}</div>`);
            return;
        }
        // Build organization options
        const orgOptions = this.organizations.map(org => {
            const selected = (org.id === this.user.organization_id) ? 'selected' : '';
            return `<option value="${org.id}" ${selected}>${this.escapeHtml(org.name)}</option>`;
        }).join('');
        // Build role dropdown (only user, developer)
        const roles = ['user', 'developer'];
        const roleOptions = roles.map(r => {
            const selected = (r === this.user.role) ? 'selected' : '';
            return `<option value="${r}" ${selected}>${this.core.translate(r.charAt(0).toUpperCase() + r.slice(1))}</option>`;
        }).join('');
        const html = `
            <div>
                <h2>${this.core.translate('Edit User Profile')}</h2>
                <form id="edit-form">
                    <label>${this.core.translate('Email')}<br/>
                        <input type="email" name="email" value="${this.escapeAttribute(this.user.email)}" required />
                    </label><br/><br/>
                    <label>${this.core.translate('First name')}<br/>
                        <input type="text" name="first_name" value="${this.escapeAttribute(this.user.first_name)}" required />
                    </label><br/><br/>
                    <label>${this.core.translate('Surname')}<br/>
                        <input type="text" name="surname" value="${this.escapeAttribute(this.user.surname)}" required />
                    </label><br/><br/>
                    <label>${this.core.translate('Organization')}<br/>
                        <select name="organization_id">${orgOptions}</select>
                    </label><br/><br/>
                    <label>${this.core.translate('Role')}<br/>
                        <select name="role">${roleOptions}</select>
                    </label><br/><br/>
                    <button type="submit">${this.core.translate('Submit')}</button>
                    <button type="button" id="cancel-btn">${this.core.translate('Cancel')}</button>
                </form>
            </div>
        `;
        this.mountWidget(html);
        // Attach event listeners
        const form = this.shadow_root.querySelector('#edit-form');
        const cancelBtn = this.shadow_root.querySelector('#cancel-btn');
        cancelBtn.addEventListener('click', () => {
            this.core.route('user_profile');
        });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const email = formData.get('email').trim();
            const first_name = formData.get('first_name').trim();
            const surname = formData.get('surname').trim();
            const organization_id = parseInt(formData.get('organization_id'));
            const role = formData.get('role');
            // Update DB
            await this.core.db.run(
                "UPDATE User SET email=?, first_name=?, surname=?, organization_id=?, role=? WHERE id=?",
                [email, first_name, surname, organization_id, role, this.user.id]
            );
            // route back to view mode
            this.core.route('user_profile');
        });
    }

    getOrganizationName(orgId) {
        const org = this.organizations.find(o => o.id === orgId);
        return org ? org.name : this.core.translate('Unknown');
    }

    escapeHtml(s) {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
    }

    escapeAttribute(s) {
        return this.escapeHtml(s).replace(/"/g, '&quot;');
    }
}
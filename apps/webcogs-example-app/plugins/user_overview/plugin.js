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
Write a plugin that shows a single user in a table with two columns, keys left and values right. The user ID is passed as a custom parameter to the constructor.  Below the user table should be the list of tickets submitted by the user. When you click on a ticket, route to ticket_overview with the ticket ID as custom parameter. Below that is a list of tickets assigned to the user's organization.  Open tickets should be highlighted in both lists.


@webcogs_end_prompt_section*/
export class UserProfileTicketsPlugin {
    constructor(core, userId) {
        this.core = core;
        this.userId = userId;
        // fire and forget – no need to await here because we cannot make
        // constructor async.  Call an async init method.
        this.init();
    }

    async init() {
        const t = (str) => this.core.translate(str);

        // 1. Fetch user info
        const userRows = await this.core.db.run("SELECT * FROM User WHERE id=?", [this.userId]);
        if (!userRows || !userRows.length) {
            // user not found, mount an error message and bail out
            const errorHtml = `<h2>${t("User not found")}</h2>`;
            this.core.mount("main", errorHtml, "");
            return;
        }
        const user = userRows[0];

        // 2. Fetch organisation
        let orgName = t("Unknown organisation");
        if (user.organization_id !== null) {
            const orgRows = await this.core.db.run("SELECT name FROM Organization WHERE id=?", [user.organization_id]);
            if (orgRows && orgRows.length) {
                orgName = orgRows[0].name;
            }
        }

        // 3. Fetch user submitted tickets
        const submittedTickets = await this.core.db.run(
            "SELECT id, status FROM Ticket WHERE submitted_by=? ORDER BY id DESC",
            [this.userId]
        );

        // 4. Fetch organisation tickets (assigned to org)
        let orgTickets = [];
        if (user.organization_id !== null) {
            orgTickets = await this.core.db.run(
                "SELECT id, status FROM Ticket WHERE assigned_to=? ORDER BY id DESC",
                [user.organization_id]
            );
        }

        // 5. Compose HTML
        const userDisplay = `${user.first_name} ${user.surname} (@${user.username})`;

        const userTableRows = [
            { k: t("User"), v: userDisplay },
            { k: t("Email"), v: user.email },
            { k: t("Organisation"), v: orgName },
            { k: t("Role"), v: user.role }
        ].map(row => `<tr><td><strong>${row.k}</strong></td><td>${row.v}</td></tr>`).join("\n");

        // Helper to render ticket list items
        const renderTicketItem = (ticket) => {
            const openClass = ticket.status === "open" ? "open" : "";
            return `<li class="ticket-list-item ${openClass}" data-id="${ticket.id}">${t("Ticket")} #${ticket.id}</li>`;
        };

        const submittedTicketsHtml = submittedTickets.length
            ? submittedTickets.map(renderTicketItem).join("\n")
            : `<li>${t("No tickets")}</li>`;

        const orgTicketsHtml = orgTickets.length
            ? orgTickets.map(renderTicketItem).join("\n")
            : `<li>${t("No tickets")}</li>`;

        const html = `
            <div class="user-profile-widget">
                <h2>${t("User details")}</h2>

                <table class="user-table">
                    <tbody>
                        ${userTableRows}
                    </tbody>
                </table>

                <h3>${t("Tickets submitted by user")}</h3>
                <ul class="ticket-list submitted-tickets">
                    ${submittedTicketsHtml}
                </ul>

                <h3>${t("Tickets assigned to organisation")}</h3>
                <ul class="ticket-list org-tickets">
                    ${orgTicketsHtml}
                </ul>
            </div>
        `;

        const css = `
            h2, h3 { color: var(--text-color); }
            table.user-table {
                border-collapse: collapse;
                width: 100%;
            }
            table.user-table td {
                padding: 4px 8px;
                border-bottom: 1px solid #ccc;
            }
            ul.ticket-list {
                list-style: none;
                padding-left: 0;
            }
            li.ticket-list-item {
                cursor: pointer;
                padding: 6px 4px;
                border-bottom: 1px solid #ddd;
            }
            li.ticket-list-item.open {
                background-color: var(--highlight-ticket-bg-color);
            }
        `;

        const shadowRoot = this.core.mount("main", html, css);

        // 6. Add event listener for routing on click
        shadowRoot.querySelectorAll('.ticket-list-item').forEach(li => {
            li.addEventListener('click', (ev) => {
                const ticketId = parseInt(ev.currentTarget.getAttribute('data-id'), 10);
                if (!isNaN(ticketId)) {
                    this.core.route('ticket_overview', ticketId);
                }
            });
        });
    }
}

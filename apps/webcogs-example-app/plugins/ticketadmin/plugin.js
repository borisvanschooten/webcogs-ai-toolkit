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
Write a plugin that shows a list showing tickets. It has two additional constructor parameters: status and sort_order.  Status indicates which status to show; default is "open". Sort_order is one of: date, organization; default is "date".  Date sort order should sort the list descendingly.  Organization sort order refers to the organization a ticket is assigned to, with not assigned tickets at the top. If sort order is organization, order by date within each organisation, and show the name of the organization above the first item.

Above the list should be selectors for data and sort order.  If selected, route to ticketadmin with as parameters the selector values.

The ticket text should be shown in a large area. Each ticket row should also show the username that issued the ticket, the organization name of the user, the organization it was assigned to, and the date. Show an organization-avatar for the assigned to organization at the left of each ticket. Use organisation ID to cycle through the id-, id-2 variant classes. When you click on a ticket, it should route to "ticket_overview" with as parameter the ticket ID, except when you click on the user, which should route to "user_overview" with as parameter the user ID.

@webcogs_end_prompt_section*/
export class TicketList {
    constructor(core, status = "open", sort_order = "date") {
        this.core = core;
        this.status = status || "open";
        this.sort_order = sort_order || "date";
        // Begin building UI
        this.init();
    }

    async init() {
        // Mount main widget
        const html = `
            <div class="ticket-list-widget">
                <h2>${this.core.translate("Tickets")}</h2>
                <div class="ticket-filters">
                    <label>
                        ${this.core.translate("Status")}: 
                        <select id="status-select">
                            <option value="open">${this.core.translate("open")}</option>
                            <option value="in_progress">${this.core.translate("in_progress")}</option>
                            <option value="fixed">${this.core.translate("fixed")}</option>
                            <option value="not_fixed">${this.core.translate("not_fixed")}</option>
                        </select>
                    </label>
                    <label>
                        ${this.core.translate("Sort by")}: 
                        <select id="sort-select">
                            <option value="date">${this.core.translate("date")}</option>
                            <option value="organization">${this.core.translate("organization")}</option>
                        </select>
                    </label>
                </div>
                <div id="ticket-container"></div>
            </div>
        `;
        const css = `
            .ticket-filters {
                margin-bottom: 15px;
            }
            .ticket-row {
                border: 1px solid #ccc;
                padding: 10px;
                margin-bottom: 10px;
                display: flex;
                gap: 10px;
                cursor: pointer;
            }
            .ticket-text {
                flex: 1;
                white-space: pre-wrap;
            }
            .ticket-meta {
                color: var(--text-color);
                font-size: 14px;
            }
            .org-header {
                font-weight: bold;
                margin-top: 20px;
            }
            .user-link {
                color: blue;
                text-decoration: underline;
                cursor: pointer;
            }
        `;
        this.shadow = this.core.mount("main", html, css);
        this.statusSelect = this.shadow.getElementById("status-select");
        this.sortSelect = this.shadow.getElementById("sort-select");
        // set initial values
        this.statusSelect.value = this.status;
        this.sortSelect.value = this.sort_order;

        // Event listeners
        this.statusSelect.addEventListener("change", () => {
            this.core.route("ticketadmin", this.statusSelect.value, this.sortSelect.value);
        });
        this.sortSelect.addEventListener("change", () => {
            this.core.route("ticketadmin", this.statusSelect.value, this.sortSelect.value);
        });

        // Load data and render
        await this.loadAndRender();
    }

    async loadAndRender() {
        const tickets = await this.fetchTickets();
        this.renderTickets(tickets);
    }

    async fetchTickets() {
        // Query tickets with joined data
        const sql = `SELECT Ticket.id AS ticket_id, Ticket.text AS ticket_text, Ticket.time AS ticket_time, Ticket.assigned_to AS assigned_org_id, 
                            User.id AS user_id, User.username, User.first_name, User.surname,
                            UOrg.name AS user_org_name,
                            AOrg.name AS assigned_org_name
                     FROM Ticket
                     JOIN User ON User.id = Ticket.submitted_by
                     JOIN Organization UOrg ON UOrg.id = User.organization_id
                     LEFT JOIN Organization AOrg ON AOrg.id = Ticket.assigned_to
                     WHERE Ticket.status = ?`;
        const rows = await this.core.db.run(sql, [this.status]);
        // Sort according to sort_order
        if (this.sort_order === "date") {
            // Descending by time
            rows.sort((a, b) => new Date(b.ticket_time) - new Date(a.ticket_time));
        } else {
            // Group by assigned organization name (null first). Within each group, date desc.
            rows.sort((a, b) => {
                const orgA = a.assigned_org_name || ""; // Empty string sorts before letters
                const orgB = b.assigned_org_name || "";
                if (orgA < orgB) return -1;
                if (orgA > orgB) return 1;
                // same org - date desc
                return new Date(b.ticket_time) - new Date(a.ticket_time);
            });
        }
        return rows;
    }

    renderTickets(rows) {
        const container = this.shadow.getElementById("ticket-container");
        container.innerHTML = "";
        let lastOrgKey = null;
        rows.forEach(row => {
            const orgKey = row.assigned_org_name || "__NONE__";
            if (this.sort_order === "organization" && orgKey !== lastOrgKey) {
                // Insert header
                const header = document.createElement("div");
                header.className = "org-header";
                header.textContent = row.assigned_org_name ? row.assigned_org_name : this.core.translate("Not assigned");
                container.appendChild(header);
                lastOrgKey = orgKey;
            }

            const ticketRow = document.createElement("div");
            ticketRow.className = "ticket-row";
            // avatar box
            const avatarDiv = document.createElement("div");
            const avatarClass = this.getAvatarClass(row.assigned_org_id);
            avatarDiv.className = `organization-avatar ${avatarClass}`;
            ticketRow.appendChild(avatarDiv);

            // info container
            const infoDiv = document.createElement("div");
            infoDiv.style.flex = "1";

            // text
            const textDiv = document.createElement("div");
            textDiv.className = "ticket-text";
            textDiv.textContent = row.ticket_text;
            infoDiv.appendChild(textDiv);

            // meta
            const metaDiv = document.createElement("div");
            metaDiv.className = "ticket-meta";
            // user link
            const userSpan = document.createElement("span");
            userSpan.className = "user-link";
            userSpan.textContent = `${row.first_name} ${row.surname} (@${row.username})`;
            userSpan.addEventListener("click", e => {
                e.stopPropagation();
                this.core.route("user_overview", row.user_id);
            });
            metaDiv.appendChild(userSpan);

            // user org
            const orgSpan = document.createElement("span");
            orgSpan.textContent = ` - ${row.user_org_name}`;
            metaDiv.appendChild(orgSpan);

            // assigned org
            const assignedSpan = document.createElement("span");
            const assignedText = row.assigned_org_name ? row.assigned_org_name : this.core.translate("Not assigned");
            assignedSpan.textContent = ` - ${assignedText}`;
            metaDiv.appendChild(assignedSpan);

            // date
            const dateSpan = document.createElement("span");
            const dateObj = new Date(row.ticket_time);
            dateSpan.textContent = ` - ${dateObj.toLocaleString()}`;
            metaDiv.appendChild(dateSpan);

            infoDiv.appendChild(metaDiv);

            ticketRow.appendChild(infoDiv);

            ticketRow.addEventListener("click", () => {
                this.core.route("ticket_overview", row.ticket_id);
            });

            container.appendChild(ticketRow);
        });
    }

    getAvatarClass(orgId) {
        if (!orgId) return "id-none";
        const idx = (orgId % 6) || 6; // so 6 maps to 6 not 0
        return `id-${idx}`;
    }
}

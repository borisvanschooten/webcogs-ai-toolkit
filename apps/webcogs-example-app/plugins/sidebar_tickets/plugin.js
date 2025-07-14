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

Ticket should be shown like this: Ticket #ticket_id


## CSS definitions

:root {
  --text-color: #000;
  --main-bg-color: #fff;
  --nav_bar-bg-color: #eee;
  --top_menu-bg-color: #222;
  --top-menu-text-color: #fff;
  --button-bg-color: #aaf;
  --button-text-color: #006;
  --highlight-ticket-bg-color: #eaa;
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
Create a widget that shows in the sidebar, showing a vertical list of all tickets assigned to the logged in user's organization and with status=open, descendingly sorted by date. Show ticket number and text, submitted date, the user who submitted the ticket, and the organization it was assigned to, or 'None' if NULL.  If you click on a ticket, route to ticket_overview, with as custom parameter the ticket ID.  
@webcogs_end_prompt_section*/
/*
  Plugin: SidebarTicketList
  Displays, in the sidebar, the list of open tickets that are assigned to
  the logged-in user’s organisation.  Clicking a ticket routes to
  ticket_overview with the ticket id.
*/

export default class SidebarTicketList {
    constructor(core) {
        this.core = core;
        this.shadowRoot = null;
        // Start initialisation
        this.init();
    }

    async init() {
        try {
            // 1) Find the logged-in user and their organisation
            const currentUserId = this.core.getUserId();
            if (!currentUserId) {
                // Not logged in – nothing to show
                return;
            }

            const userRes = await this.core.db.run(
                "SELECT organization_id FROM User WHERE id=?",
                [currentUserId]
            );
            if (!userRes || userRes.length === 0) {
                return;
            }
            const orgId = userRes[0].organization_id;

            // 2) Query all open tickets assigned to this organisation
            const tickets = await this.core.db.run(
                `SELECT Ticket.id            AS ticket_id,
                        Ticket.text          AS ticket_text,
                        Ticket.time          AS submitted_at,
                        Ticket.status        AS ticket_status,
                        Ticket.assigned_to   AS assigned_org_id,
                        Submitter.first_name AS submitter_first_name,
                        Submitter.surname    AS submitter_surname,
                        Submitter.username   AS submitter_username,
                        Org.name             AS assigned_org_name
                 FROM Ticket
                 JOIN User  AS Submitter ON Submitter.id = Ticket.submitted_by
                 LEFT JOIN Organization AS Org       ON Org.id = Ticket.assigned_to
                 WHERE Ticket.status = 'open' AND Ticket.assigned_to = ?
                 ORDER BY Ticket.time DESC`,
                [orgId]
            );

            // 3) Mount the widget HTML/CSS
            this.mountWidget(tickets);
        } catch (err) {
            console.error("SidebarTicketList plugin error", err);
        }
    }

    mountWidget(tickets) {
        const html = `
            <div class="ticket-sidebar-widget">
                <h2 class="title">Open Tickets Assigned To Us</h2>
                <div class="tickets-container">
                    ${tickets && tickets.length ? tickets.map(t => this.renderTicketItem(t)).join("") : "<p class=\"empty\">No open tickets assigned.</p>"}
                </div>
            </div>
        `;

        const css = `
            .ticket-sidebar-widget {
                font-family: Arial, sans-serif;
                color: var(--text-color);
            }
            .title {
                font-size: 1.1rem;
                margin: 0 0 0.5rem 0;
            }
            .tickets-container {
                display: flex;
                flex-direction: column;
                gap: 0.3rem;
            }
            .ticket-item {
                padding: 0.4rem 0.5rem;
                background: var(--highlight-ticket-bg-color);
                border-radius: 4px;
                cursor: pointer;
            }
            .ticket-item:hover {
                opacity: 0.85;
            }
            .ticket-header {
                font-weight: bold;
                margin-bottom: 0.2rem;
            }
            .ticket-meta {
                font-size: 0.8rem;
            }
            .empty {
                font-style: italic;
                font-size: 0.9rem;
            }
        `;

        this.shadowRoot = this.core.mount("side_bar", html, css);
        if (!this.shadowRoot) return;

        // Attach click listeners for each item
        const items = this.shadowRoot.querySelectorAll(".ticket-item");
        items.forEach(item => {
            item.addEventListener("click", e => {
                const ticketId = e.currentTarget.dataset.ticketId;
                if (ticketId) {
                    this.core.route("ticket_overview", parseInt(ticketId, 10));
                }
            });
        });
    }

    renderTicketItem(t) {
        const submittedDate = new Date(t.submitted_at).toLocaleString();
        const submitter = `${t.submitter_first_name} ${t.submitter_surname} (@${t.submitter_username})`;
        const assignedOrg = t.assigned_org_name ? t.assigned_org_name : "None";
        return `
            <div class="ticket-item" data-ticket-id="${t.ticket_id}">
                <div class="ticket-header">Ticket #${t.ticket_id}: ${this.escapeHtml(t.ticket_text)}</div>
                <div class="ticket-meta">Submitted: ${submittedDate}</div>
                <div class="ticket-meta">By: ${this.escapeHtml(submitter)}</div>
                <div class="ticket-meta">Assigned to: ${this.escapeHtml(assignedOrg)}</div>
            </div>
        `;
    }

    // Basic HTML escaping to avoid breaking the widget
    escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // Destructor if core supports plugin destruction in future
    destroy() {
        if (this.shadowRoot && this.shadowRoot.host) {
            this.shadowRoot.host.remove();
        }
    }
}
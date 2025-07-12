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

## available core.mount locations

- modal_dialog - modal dialog that displays as an overlay
- main - main area of screen
- nav_bar - navigation bar for main menu
- side_bar - side bar for submenus

## core.route routes

A route is a string that indicates a widget plugin name.

## Style guide

Widgets should always display a title.

Use the classes, styles, and properties in the supplied CSS definitions as much as possible.


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

CREATE TABLE User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    birth_date DATE NOT NULL
);

CREATE TABLE Ticket (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user INTEGER NOT NULL,
	text TEXT NOT NULL,
	entry_date DATE NOT NULL,
	response_date DEFAULT NULL,
    response_text TEXT DEFAULT NULL
);

@webcogs_user_prompt
Write a plugin that shows two lists: one of all open tickets (response_text=NULL), and one of all responded tickets. Both should be descendingly ordered by date. The ticket text should be shown in a large area. When response_text is not NULL, it should also be shown in a large area. Each ticket row should also show the username that issued the ticket, and the date. When you click on a ticket, it should route to "ticket_overview" with as parameter the ticket ID, except when you click on the user, which should route to "user_overview" with as parameter the user ID. Do not use jquery.

@webcogs_end_prompt_section*/
export class TicketListsPlugin {
    constructor(core) {
        this.core = core;
        this.root = null;
        this.openTickets = [];
        this.respondedTickets = [];
        this.init();
    }

    async init() {
        await this.loadData();
        this.render();
    }

    async loadData() {
        // Fetch open tickets (response_text IS NULL)
        this.openTickets = await this.core.db.run(
            `SELECT Ticket.id            AS ticket_id,
                    Ticket.text          AS ticket_text,
                    Ticket.entry_date    AS entry_date,
                    Ticket.response_date AS response_date,
                    Ticket.response_text AS response_text,
                    User.id              AS user_id,
                    User.username        AS username
             FROM   Ticket
             JOIN   User ON Ticket.user = User.id
             WHERE  Ticket.response_text IS NULL
             ORDER  BY Ticket.entry_date DESC;`
        ) || [];

        // Fetch responded tickets (response_text IS NOT NULL)
        this.respondedTickets = await this.core.db.run(
            `SELECT Ticket.id            AS ticket_id,
                    Ticket.text          AS ticket_text,
                    Ticket.entry_date    AS entry_date,
                    Ticket.response_date AS response_date,
                    Ticket.response_text AS response_text,
                    User.id              AS user_id,
                    User.username        AS username
             FROM   Ticket
             JOIN   User ON Ticket.user = User.id
             WHERE  Ticket.response_text IS NOT NULL
             ORDER  BY Ticket.entry_date DESC;`
        ) || [];
    }

    render() {
        const html = `
            <div class="tickets-widget">
                <h2>Open tickets</h2>
                <div class="ticket-list" id="open-ticket-list">
                    ${this.openTickets.map(t => this.ticketHtml(t, false)).join("")}
                </div>
                <h2>Responded tickets</h2>
                <div class="ticket-list" id="responded-ticket-list">
                    ${this.respondedTickets.map(t => this.ticketHtml(t, true)).join("")}
                </div>
            </div>
        `;

        const css = `
            .tickets-widget {
                color: var(--text-color);
                background: var(--main-bg-color);
                padding: 1rem;
                box-sizing: border-box;
                height: 100%;
                overflow-y: auto;
            }
            .tickets-widget h2 {
                margin-top: 1.5rem;
                margin-bottom: 0.5rem;
            }
            .ticket-list {
                border: 1px solid #ccc;
                border-radius: 4px;
            }
            .ticket-item {
                padding: 0.75rem;
                border-bottom: 1px solid #ddd;
                cursor: pointer;
            }
            .ticket-item:last-child {
                border-bottom: none;
            }
            .ticket-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.5rem;
                font-weight: bold;
            }
            .username {
                color: blue;
                text-decoration: underline;
                cursor: pointer;
            }
            .ticket-text, .response-text {
                background: #f9f9f9;
                padding: 0.5rem;
                white-space: pre-wrap;
                border-radius: 4px;
                margin-bottom: 0.5rem;
            }
            .response-label {
                font-style: italic;
                margin-bottom: 0.25rem;
            }
        `;

        // Mount widget in main area
        this.root = this.core.mount('main', html, css);

        // After mounting, attach event listeners
        this.addEventListeners();
    }

    ticketHtml(ticket, hasResponse) {
        return `
            <div class="ticket-item" data-ticket-id="${ticket.ticket_id}">
                <div class="ticket-info">
                    <span class="username" data-user-id="${ticket.user_id}">${this.escapeHtml(ticket.username)}</span>
                    <span class="date">${this.escapeHtml(ticket.entry_date)}</span>
                </div>
                <pre class="ticket-text">${this.escapeHtml(ticket.ticket_text)}</pre>
                ${hasResponse ? `<div class="response-label">Response:</div><pre class="response-text">${this.escapeHtml(ticket.response_text)}</pre>` : ``}
            </div>
        `;
    }

    addEventListeners() {
        if (!this.root) return;

        // Delegate clicks for ticket items and usernames
        this.root.addEventListener('click', (event) => {
            const userTarget = event.target.closest('.username');
            if (userTarget) {
                event.stopPropagation();
                const userId = parseInt(userTarget.getAttribute('data-user-id'), 10);
                if (!isNaN(userId)) {
                    this.core.route('user_overview', userId);
                }
                return;
            }

            const ticketTarget = event.target.closest('.ticket-item');
            if (ticketTarget) {
                const ticketId = parseInt(ticketTarget.getAttribute('data-ticket-id'), 10);
                if (!isNaN(ticketId)) {
                    this.core.route('ticket_overview', ticketId);
                }
            }
        });
    }

    // Helper to safely escape HTML characters
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

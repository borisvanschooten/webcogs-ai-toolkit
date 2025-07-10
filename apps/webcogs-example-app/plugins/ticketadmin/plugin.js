/*@webcogs_system_prompt
# Docs for writing a plugin

A plugin is a module that can interact with the user via HTML widgets, or process information.  A plugin is always defined as a single export class, and should be written in vanilla Javascript. Do not assume any libraries are available.  For example jquery is not available.  The class constructor always has this signature: 
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
- async function db.run(sql_statement) - execute a SQL statement or query. Note this is an async function. If it is a query, returns an array of objects. Each object represents a record, with keys representing the column names and values the record values.

## available core.mount locations

- main
- nav_bar
- side_bar

## core.route routes

A route is a string that indicates a widget plugin name.


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
Write a plugin that shows a list of all tickets in the database, ordered by date. The ticket text should be shown in a large area.  Each ticket row should also show the username that issued the ticket, and the date. When you click on a ticket, it should route to "ticket_overview" with as parameter the ticket ID, except when you click on the user, which should route to "user_overview" with as parameter the user ID.

@webcogs_end_prompt_section*/
// TicketListPlugin.js
// A plugin that lists all tickets ordered by date.  Clicking on a ticket opens the ticket overview,
// clicking on the username opens the user overview.

export default class TicketListPlugin {
    constructor(core) {
        this.core = core;
        this.shadowRoot = null;
        // Immediately start rendering
        this.init();
    }

    async init() {
        // Load ticket data
        const tickets = await this.fetchTickets();
        // Build HTML
        const html = this.buildHTML(tickets);
        const css = this.buildCSS();
        // Mount widget
        this.shadowRoot = this.core.mount("main", html, css);
        // Attach event listeners
        this.attachListeners();
    }

    async fetchTickets() {
        const sql = `
            SELECT 
                Ticket.id              AS ticket_id,
                Ticket.text            AS ticket_text,
                Ticket.entry_date      AS entry_date,
                User.id                AS user_id,
                User.username          AS username
            FROM Ticket
            JOIN User ON User.id = Ticket.user
            ORDER BY Ticket.entry_date DESC
        `;
        try {
            const rows = await this.core.db.run(sql);
            return rows;
        } catch (e) {
            console.error("Failed to fetch tickets", e);
            return [];
        }
    }

    buildHTML(tickets) {
        let items = "";
        for (const t of tickets) {
            items += `
                <li class="ticket-item" data-ticket-id="${t.ticket_id}">
                    <div class="ticket-text">${this.escapeHTML(t.ticket_text)}</div>
                    <div class="ticket-meta">
                        <span class="ticket-user" data-user-id="${t.user_id}">${this.escapeHTML(t.username)}</span>
                        <span class="ticket-date">${this.formatDate(t.entry_date)}</span>
                    </div>
                </li>
            `;
        }

        return `
            <div class="ticket-list-container">
                <ul class="ticket-list">${items}</ul>
            </div>
        `;
    }

    buildCSS() {
        return `
            .ticket-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .ticket-item {
                border-bottom: 1px solid #ddd;
                padding: 12px;
                cursor: pointer;
            }

            .ticket-item:hover {
                background: #fafafa;
            }

            .ticket-text {
                font-size: 1.1em;
                margin-bottom: 8px;
                white-space: pre-wrap;
            }

            .ticket-meta {
                font-size: 0.9em;
                color: #555;
            }

            .ticket-user {
                color: #007acc;
                cursor: pointer;
                margin-right: 8px;
            }

            .ticket-user:hover {
                text-decoration: underline;
            }
        `;
    }

    attachListeners() {
        if (!this.shadowRoot) return;
        const list = this.shadowRoot.querySelector(".ticket-list");
        if (!list) return;

        list.addEventListener("click", (event) => {
            const target = event.target;
            if (target.closest && target.closest('.ticket-user')) {
                // Username clicked
                const userEl = target.closest('.ticket-user');
                const userId = parseInt(userEl.getAttribute('data-user-id'), 10);
                if (!isNaN(userId)) {
                    this.core.route('user_overview', userId);
                }
                // Prevent click from bubbling to li
                event.stopPropagation();
                return;
            }

            const itemEl = target.closest('.ticket-item');
            if (itemEl) {
                const ticketId = parseInt(itemEl.getAttribute('data-ticket-id'), 10);
                if (!isNaN(ticketId)) {
                    this.core.route('ticket_overview', ticketId);
                }
            }
        });
    }

    escapeHTML(str) {
        return String(str).replace(/[&<>\"']/g, function (s) {
            const entityMap = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return entityMap[s];
        });
    }

    formatDate(dateStr) {
        // Basic ISO date handling; keeps format if parsing fails
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString();
    }
}

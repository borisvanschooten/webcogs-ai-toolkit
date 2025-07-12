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
Write a plugin that shows a particular ticket in the database. All ticket fields except user ID should be shown in a table. The ticket text should be shown in a large area.  The user who issued the ticket should be shown in a table below the ticket. The ticket ID is passed as a custom parameter to the constructor. If the response_text is NULL, show a button "Respond" which routes to ticket_reponse.

@webcogs_end_prompt_section*/
// Ticket viewer plugin
// Shows a single ticket together with the user that created it.
// The constructor receives the ticket id as the 2nd parameter.

export default class TicketViewer {
    constructor(core, ticketId) {
        this.core = core;
        this.ticketId = ticketId;
        this.ticket = null;
        this.user = null;
        this.shadow = null;
        this.init();
    }

    async init() {
        await this.fetchData();
        this.render();
    }

    // Fetch the ticket and its user data from the database
    async fetchData() {
        // Load ticket
        const ticketRows = await this.core.db.run(`SELECT id, text, entry_date, response_date, response_text, user FROM Ticket WHERE id = ${this.ticketId} LIMIT 1;`);
        if (!ticketRows || ticketRows.length === 0) {
            this.ticket = null;
            return;
        }
        this.ticket = ticketRows[0];

        // Load user that created the ticket
        const userRows = await this.core.db.run(`SELECT username, email, first_name, surname, birth_date FROM User WHERE id = ${this.ticket.user} LIMIT 1;`);
        this.user = userRows && userRows.length > 0 ? userRows[0] : null;
    }

    render() {
        // Prepare HTML
        let html = "";
        if (!this.ticket) {
            html = `<div class="error">Ticket with ID ${this.ticketId} not found.</div>`;
        } else {
            // Ticket info table (excluding user id)
            html = `
                <h2>Ticket #${this.ticket.id}</h2>
                <table class="ticket-info">
                    <tr><th>ID</th><td>${this.ticket.id}</td></tr>
                    <tr><th>Entry date</th><td>${this.ticket.entry_date}</td></tr>
                    <tr><th>Response date</th><td>${this.ticket.response_date || "-"}</td></tr>
                    <tr><th>Response text</th><td>${this.ticket.response_text || "-"}</td></tr>
                </table>

                <h3>Description</h3>
                <div class="ticket-text">${this.escapeHTML(this.ticket.text)}</div>
            `;

            // Respond button when no response yet
            if (!this.ticket.response_text) {
                html += `<button id="respond-btn" class="respond-btn">Respond</button>`;
            }

            // User info table
            if (this.user) {
                html += `
                    <h3>User who created the ticket</h3>
                    <table class="user-info">
                        <tr><th>Username</th><td>${this.user.username}</td></tr>
                        <tr><th>First name</th><td>${this.user.first_name}</td></tr>
                        <tr><th>Surname</th><td>${this.user.surname}</td></tr>
                        <tr><th>Email</th><td>${this.user.email}</td></tr>
                        <tr><th>Birth date</th><td>${this.user.birth_date}</td></tr>
                    </table>
                `;
            }
        }

        const css = `
            :host {
                color: var(--text-color);
                background: var(--main-bg-color);
                display: block;
                padding: 1rem;
                font-family: sans-serif;
            }
            h2, h3 { margin: 0.5rem 0; }
            table {
                border-collapse: collapse;
                width: 100%;
                margin-bottom: 1rem;
            }
            th {
                text-align: left;
                padding: 0.5rem;
                background: #ddd;
            }
            td {
                padding: 0.5rem;
                border-bottom: 1px solid #ccc;
            }
            .ticket-text {
                white-space: pre-wrap;
                border: 1px solid #ccc;
                min-height: 120px;
                padding: 0.75rem;
                background: #f9f9f9;
                margin-bottom: 1rem;
            }
            .respond-btn {
                background: var(--button-bg-color);
                color: var(--button-text-color);
                padding: 0.5rem 1rem;
                border: none;
                cursor: pointer;
                font-size: 1rem;
                margin-bottom: 1.5rem;
            }
            .respond-btn:hover {
                opacity: 0.9;
            }
            .error {
                color: red;
                font-weight: bold;
            }
        `;

        // Mount in main area
        this.shadow = this.core.mount('main', html, css);

        // Wire button event
        if (this.shadow) {
            const respondBtn = this.shadow.getElementById('respond-btn');
            if (respondBtn) {
                respondBtn.addEventListener('click', () => {
                    this.core.route('ticket_response', this.ticketId);
                });
            }
        }
    }

    // Simple HTML escaper to prevent HTML injection in ticket text
    escapeHTML(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
}

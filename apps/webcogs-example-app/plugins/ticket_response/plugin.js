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
Show the ticket fields of a particular ticket, with a large area for the ticket text. The ticket ID is passed as the second parameter of the constructor.  If the response text is null, show a textarea in which a response can be entered, with a submit button to submit it.  If the response text is not null, show it in a large area.  If a response is submitted, use SQL UPDATE to set the response text and date, and route to ticket_response.
@webcogs_end_prompt_section*/
export class TicketDetail {
    constructor(core, ticketId) {
        this.core = core;
        this.ticketId = ticketId;
        this.shadow = null; // will hold the shadow root returned by core.mount

        // kick-off async initialisation
        this.init();
    }

    async init() {
        // fetch ticket data
        const rows = await this.core.db.run("SELECT * FROM Ticket WHERE id=?", [this.ticketId]);
        if (!rows || rows.length === 0) {
            // Ticket not found – show simple message
            this.renderNotFound();
            return;
        }
        this.ticket = rows[0];
        this.render();
    }

    renderNotFound() {
        const html = `
            <h2>Ticket not found</h2>
            <p>No ticket exists with ID ${this.ticketId}.</p>
        `;
        const css = `
            h2 { color: var(--text-color); }
            p  { color: var(--text-color); }
        `;
        if (!this.shadow) {
            this.shadow = this.core.mount('main', html, css);
        } else {
            this.shadow.innerHTML = html;
        }
    }

    render() {
        const t = this.ticket;
        const hasResponse = t.response_text !== null && t.response_text !== undefined;

        const html = `
            <div class="ticket-container">
                <h2>Ticket #${t.id}</h2>

                <div class="ticket-field"><label>ID:</label> ${t.id}</div>
                <div class="ticket-field"><label>User:</label> ${t.user}</div>
                <div class="ticket-field"><label>Entry date:</label> ${t.entry_date}</div>
                ${hasResponse ? `<div class="ticket-field"><label>Response date:</label> ${t.response_date}</div>` : ''}

                <div class="ticket-field">
                    <label>Ticket text:</label>
                    <div class="ticket-text">${this.escapeHTML(t.text)}</div>
                </div>

                ${hasResponse ? `
                    <div class="ticket-field">
                        <label>Response text:</label>
                        <div class="response-text">${this.escapeHTML(t.response_text)}</div>
                    </div>
                ` : `
                    <div class="ticket-field">
                        <label>Enter response:</label>
                        <textarea id="responseInput" rows="10" placeholder="Type your response here..."></textarea>
                        <button id="submitResponse">Submit Response</button>
                    </div>
                `}
            </div>
        `;

        const css = `
            .ticket-container {
                padding: 20px;
                color: var(--text-color);
                background: var(--main-bg-color);
                font-family: sans-serif;
            }
            h2 { margin-top: 0; }
            .ticket-field { margin-bottom: 15px; }
            .ticket-field label { font-weight: bold; display:block; margin-bottom: 4px; }
            .ticket-text,
            .response-text,
            textarea {
                width: 100%;
                min-height: 150px;
                padding: 10px;
                box-sizing: border-box;
                border: 1px solid #ccc;
                border-radius: 4px;
                background: #fdfdfd;
                white-space: pre-wrap;
            }
            button {
                background: var(--button-bg-color);
                color: var(--button-text-color);
                border: none;
                padding: 10px 20px;
                cursor: pointer;
                border-radius: 4px;
            }
            button:hover { opacity: 0.9; }
        `;

        if (!this.shadow) {
            this.shadow = this.core.mount('main', html, css);
        } else {
            this.shadow.innerHTML = html;
        }

        // attach event listener if needed
        if (!hasResponse) {
            const btn = this.shadow.getElementById('submitResponse');
            if (btn) {
                btn.addEventListener('click', () => this.submitResponse());
            }
        }
    }

    async submitResponse() {
        const input = this.shadow.getElementById('responseInput');
        if (!input) return;
        const responseText = input.value.trim();
        if (responseText.length === 0) {
            alert('Response cannot be empty.');
            return;
        }
        // Update the ticket in DB
        await this.core.db.run(
            'UPDATE Ticket SET response_text = ?, response_date = date(\'now\') WHERE id = ?',
            [responseText, this.ticketId]
        );

        // Route to "ticket_response" (passing the ticket ID as second parameter)
        this.core.route('ticket_response', this.ticketId);
    }

    // Utility to escape HTML special characters to avoid element injection
    escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
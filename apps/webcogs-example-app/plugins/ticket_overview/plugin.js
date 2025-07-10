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
Write a plugin that shows a particular tickets in the database. All ticket fields except user ID should be shown in a table. he ticket text should be shown in a large area.  The user who issued the ticket should be shown in a table below the ticket. The ticket ID is passed as a custom parameter to the constructor.

@webcogs_end_prompt_section*/
export default class TicketViewer {
    constructor(core, ticketId) {
        this.core = core;
        this.ticketId = parseInt(ticketId, 10);

        const html_code = `
            <div class="ticket-container">
                <table class="ticket-info">
                    <tr><th>ID</th><td id="t_id">Loading…</td></tr>
                    <tr><th>Entry date</th><td id="t_entry">Loading…</td></tr>
                    <tr><th>Response date</th><td id="t_resp_date">Loading…</td></tr>
                    <tr><th>Response text</th><td id="t_resp_text">Loading…</td></tr>
                </table>
                <h3>Ticket Text</h3>
                <div class="ticket-text" id="t_text">Loading…</div>
                <h3>User Info</h3>
                <table class="user-info">
                    <tr><th>ID</th><td id="u_id">Loading…</td></tr>
                    <tr><th>Username</th><td id="u_username">Loading…</td></tr>
                    <tr><th>Email</th><td id="u_email">Loading…</td></tr>
                    <tr><th>First name</th><td id="u_first">Loading…</td></tr>
                    <tr><th>Surname</th><td id="u_surname">Loading…</td></tr>
                    <tr><th>Birth date</th><td id="u_birth">Loading…</td></tr>
                </table>
            </div>
        `;

        const css_code = `
            .ticket-container { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; }
            .ticket-info, .user-info { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            .ticket-info th, .ticket-info td, .user-info th, .user-info td { border: 1px solid #ddd; padding: 8px; }
            .ticket-info th, .user-info th { background-color: #f2f2f2; text-align: left; }
            .ticket-text { padding: 10px; border: 1px solid #ddd; min-height: 150px; white-space: pre-wrap; background-color: #fafafa; }
        `;

        // Mount the UI and keep a reference to the shadow root
        this.shadow = core.mount('main', html_code, css_code);

        // Kick off data loading
        this.loadData();
    }

    // Helper to set text inside the shadow DOM
    setText(id, value) {
        const el = this.shadow.getElementById(id);
        if (el) {
            el.textContent = value ?? '—';
        }
    }

    // Fetch ticket and user data and populate the UI
    async loadData() {
        try {
            const ticketRows = await this.core.db.run(`SELECT * FROM Ticket WHERE id = ${this.ticketId}`);
            if (ticketRows.length === 0) {
                this.shadow.innerHTML = `<p>Ticket with ID ${this.ticketId} not found.</p>`;
                return;
            }
            const ticket = ticketRows[0];

            // Populate ticket fields (excluding user id)
            this.setText('t_id', ticket.id);
            this.setText('t_entry', ticket.entry_date);
            this.setText('t_resp_date', ticket.response_date);
            this.setText('t_resp_text', ticket.response_text);
            this.setText('t_text', ticket.text);

            // Now fetch user information
            const userRows = await this.core.db.run(`SELECT * FROM User WHERE id = ${ticket.user}`);
            if (userRows.length === 0) {
                this.shadow.querySelector('.user-info').innerHTML = '<tr><td colspan="2">User information not available.</td></tr>';
                return;
            }

            const user = userRows[0];
            this.setText('u_id', user.id);
            this.setText('u_username', user.username);
            this.setText('u_email', user.email);
            this.setText('u_first', user.first_name);
            this.setText('u_surname', user.surname);
            this.setText('u_birth', user.birth_date);

        } catch (err) {
            this.shadow.innerHTML = `<p>Error loading data: ${err.message}</p>`;
        }
    }
}
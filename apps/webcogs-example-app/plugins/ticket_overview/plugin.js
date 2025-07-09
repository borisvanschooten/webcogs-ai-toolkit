/*
@webcogs_system_prompt
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
	response_date DEFAULT NULL
);

@webcogs_user_prompt
Write a plugin that shows a particular tickets in the database. All ticket fields except user ID should be shown in a table. he ticket text should be shown in a large area.  The user who issued the ticket should be shown in a table below the ticket. The ticket ID is passed as a custom parameter to the constructor.

@webcogs_end_prompt_section*/
export class ShowTicketPlugin {
    /**
     * Plugin that displays details of a single ticket together with the user that issued it.
     * 
     * @param {Object} core   The core object supplied by the host application.
     * @param {Number} ticketId The id of the ticket that should be displayed.
     */
    constructor(core, ticketId) {
        this.core = core;
        this.ticketId = ticketId;

        // Build the UI immediately. Data will be inserted asynchronously once it is fetched.
        this.shadow = this.core.mount(
            'main',
            `
            <div class="ticket-container">
                <h2>Ticket Details</h2>
                <table id="ticketTable">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Entry Date</th>
                            <th>Response Date</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>

                <h3>Ticket Text</h3>
                <div id="ticketText" class="ticket-text">Loading …</div>

                <h2>User Details</h2>
                <table id="userTable">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>First Name</th>
                            <th>Surname</th>
                            <th>Birth Date</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
            `,
            `
            .ticket-container {
                font-family: Arial, sans-serif;
                padding: 10px;
            }

            table {
                border-collapse: collapse;
                width: 100%;
                margin-bottom: 20px;
            }

            th, td {
                border: 1px solid #ccc;
                padding: 8px;
                text-align: left;
            }

            th {
                background: #f5f5f5;
            }

            .ticket-text {
                border: 1px solid #ccc;
                min-height: 120px;
                padding: 8px;
                white-space: pre-wrap; /* keep line breaks */
                margin-bottom: 20px;
            }
            `
        );

        // Kick off asynchronous loading of the ticket data.
        this.loadData();
    }

    /**
     * Fetch ticket and user data from the database and render them.
     */
    async loadData() {
        try {
            // Retrieve ticket information.
            const ticketRows = await this.core.db.run(
                `SELECT id, user, text, entry_date, response_date FROM Ticket WHERE id = ${this.ticketId}`
            );

            if (!ticketRows || ticketRows.length === 0) {
                this.showError(`Ticket with ID ${this.ticketId} not found.`);
                return;
            }

            const ticket = ticketRows[0];

            // Render ticket fields (excluding user and text) into the table.
            const ticketTbody = this.shadow.querySelector('#ticketTable tbody');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${ticket.id}</td>
                <td>${ticket.entry_date || ''}</td>
                <td>${ticket.response_date || ''}</td>
            `;
            ticketTbody.appendChild(tr);

            // Render ticket text separately in a large area.
            const textDiv = this.shadow.getElementById('ticketText');
            textDiv.textContent = ticket.text || '';

            // Retrieve user information and render below.
            const userRows = await this.core.db.run(
                `SELECT id, username, email, first_name, surname, birth_date FROM User WHERE id = ${ticket.user}`
            );

            if (userRows && userRows.length > 0) {
                const user = userRows[0];
                const userTbody = this.shadow.querySelector('#userTable tbody');
                const userTr = document.createElement('tr');
                userTr.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>${user.first_name}</td>
                    <td>${user.surname}</td>
                    <td>${user.birth_date}</td>
                `;
                userTbody.appendChild(userTr);
            } else {
                this.showError('User who issued this ticket was not found.');
            }
        } catch (err) {
            this.showError('An error occurred while loading ticket information.');
            // In development you might log the error
            console.error(err);
        }
    }

    /**
     * Small helper that prints an error message inside the widget.
     * @param {string} msg
     */
    showError(msg) {
        // Clear the main container and emit the message.
        this.shadow.innerHTML = `<div class="ticket-container"><p style="color:red;">${msg}</p></div>`;
    }
}

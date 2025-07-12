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
Write a plugin that shows a single user in a table with two columns, keys left and values right. The user ID is passed as a custom parameter to the constructor.  Below the user table should be the list of tickets submitted by the user. WHen you click on a ticket, route to ticket_overview with the ticket ID as custom parameter.


@webcogs_end_prompt_section*/
export default class UserDetailsPlugin {
    /**
     * Display the details of one user and their tickets.
     * @param {Object} core - The core API object supplied by the host app.
     * @param {number} userId - The id of the user whose details must be shown.
     */
    constructor(core, userId) {
        this.core = core;
        this.userId = userId;

        // Mount basic skeleton immediately
        this.shadowRoot = this.core.mount(
            'main',
            `
            <div class="user-details-wrapper">
                <h2 id="user-title">User #${userId}</h2>
                <table id="user-table"></table>
                <h3>User Tickets</h3>
                <ul id="ticket-list"></ul>
            </div>
            `,
            `
            .user-details-wrapper {
                color: var(--text-color);
                background: var(--main-bg-color);
                padding: 1rem;
                font-family: sans-serif;
            }

            h2, h3 {
                margin-top: 0;
            }

            #user-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 1.5rem;
            }

            #user-table td {
                padding: 0.5rem;
                border: 1px solid #ccc;
            }

            #user-table td.key {
                font-weight: bold;
                width: 30%;
                background: #f8f8f8;
            }

            #ticket-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            #ticket-list li {
                border: 1px solid #ccc;
                padding: 0.5rem;
                margin-bottom: 0.5rem;
                cursor: pointer;
                background: var(--button-bg-color);
                color: var(--button-text-color);
                transition: opacity 0.2s ease-in-out;
            }

            #ticket-list li:hover {
                opacity: 0.8;
            }
            `
        );

        // Kick off data loading
        this.load();
    }

    async load() {
        try {
            // Fetch user data
            const userRows = await this.core.db.run(
                `SELECT * FROM User WHERE id = ${Number(this.userId)} LIMIT 1;`
            );
            if (!userRows || userRows.length === 0) {
                this.showError('User not found.');
                return;
            }
            const user = userRows[0];
            this.populateUserTable(user);

            // Fetch tickets
            const ticketRows = await this.core.db.run(
                `SELECT * FROM Ticket WHERE user = ${Number(this.userId)} ORDER BY entry_date DESC;`
            );
            this.populateTickets(ticketRows);
        } catch (e) {
            this.showError('Error loading data.');
            /* eslint-disable no-console */
            console.error(e);
        }
    }

    populateUserTable(user) {
        const table = this.shadowRoot.getElementById('user-table');
        table.innerHTML = '';
        const keys = ['id', 'username', 'email', 'first_name', 'surname', 'birth_date'];
        keys.forEach((key) => {
            const tr = document.createElement('tr');
            const tdKey = document.createElement('td');
            tdKey.textContent = this.formatKey(key);
            tdKey.className = 'key';
            const tdVal = document.createElement('td');
            tdVal.textContent = user[key];
            tr.appendChild(tdKey);
            tr.appendChild(tdVal);
            table.appendChild(tr);
        });
    }

    populateTickets(tickets) {
        const list = this.shadowRoot.getElementById('ticket-list');
        list.innerHTML = '';
        if (!tickets || tickets.length === 0) {
            const none = document.createElement('li');
            none.textContent = 'No tickets submitted.';
            none.style.cursor = 'default';
            list.appendChild(none);
            return;
        }
        tickets.forEach((ticket) => {
            const li = document.createElement('li');
            li.textContent = `#${ticket.id} - ${this.truncate(ticket.text, 50)}`;
            li.dataset.ticketId = ticket.id;
            li.addEventListener('click', () => {
                this.core.route('ticket_overview', ticket.id);
            });
            list.appendChild(li);
        });
    }

    formatKey(key) {
        // Convert snake_case to Title Case e.g. first_name -> First Name
        return key
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    truncate(text, len) {
        if (!text) return '';
        if (text.length <= len) return text;
        return text.slice(0, len - 3) + '...';
    }

    showError(msg) {
        const wrapper = this.shadowRoot.querySelector('.user-details-wrapper');
        wrapper.innerHTML = `<p style="color:red;">${msg}</p>`;
    }

    // Optional destroy method if the host app wants to clean up
    destroy() {
        if (this.shadowRoot && this.shadowRoot.host && this.shadowRoot.host.parentNode) {
            this.shadowRoot.host.parentNode.removeChild(this.shadowRoot.host);
        }
    }
}
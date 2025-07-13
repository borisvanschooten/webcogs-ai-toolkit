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


-- User role is one of: user, developer, admin
CREATE TABLE User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    organization TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL
);

-- Ticket status is same as status of last response
-- Status can be: open, in_progress, fixed, not_fixed
CREATE TABLE Ticket (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user INTEGER NOT NULL,
	text TEXT NOT NULL,
	time DATETIME NOT NULL,
    status TEXT NOT NULL
);

-- A ticket can have any number of responses
-- Each response sets the status or text fields, or both
CREATE TABLE Response (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    time DATETIME NOT NULL,
    status TEXT,
    text TEXT
)

@webcogs_user_prompt
Write a plugin that shows a single user in a table with two columns, keys left and values right. The user ID is passed as a custom parameter to the constructor.  Below the user table should be the list of tickets submitted by the user. When you click on a ticket, route to ticket_overview with the ticket ID as custom parameter.


@webcogs_end_prompt_section*/
// UserDetailsPlugin.js
// This plugin displays a single user's information and their submitted tickets.
// Clicking on a ticket routes to the ticket_overview plugin with the ticket id.

export class UserDetailsPlugin {
    constructor(core, userId) {
        this.core = core;
        this.userId = userId;
        // mount the widget in the main area
        this.shadowRoot = this.core.mount('main', this._initialHTML(), this._css());
        // grab container elements
        this.userTableBody = this.shadowRoot.getElementById('user-table-body');
        this.ticketsContainer = this.shadowRoot.getElementById('tickets-container');
        // load data from DB
        this._loadData();
    }

    /* -------------------------------------------------- */
    /*  HTML & CSS                                        */
    /* -------------------------------------------------- */

    _initialHTML() {
        return `
            <div class="user-details-widget">
                <h2>User Details</h2>
                <table class="user-table">
                    <tbody id="user-table-body">
                        <!-- user rows inserted dynamically -->
                    </tbody>
                </table>

                <h3>User Tickets</h3>
                <div id="tickets-container" class="tickets-container">
                    <!-- ticket list inserted dynamically -->
                </div>
            </div>
        `;
    }

    _css() {
        return `
            .user-details-widget {
                color: var(--text-color);
                background: var(--main-bg-color);
                padding: 16px;
                box-sizing: border-box;
            }
            .user-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 24px;
            }
            .user-table td {
                border: 1px solid #ccc;
                padding: 8px;
            }
            .user-table td.key {
                font-weight: bold;
                width: 30%;
                background: #f7f7f7;
            }
            .tickets-container ul {
                list-style: none;
                margin: 0;
                padding: 0;
            }
            .tickets-container li {
                padding: 10px;
                border: 1px solid #ccc;
                margin-bottom: 6px;
                cursor: pointer;
                background: var(--button-bg-color);
                color: var(--button-text-color);
            }
            .tickets-container li:hover {
                background: #88f;
            }
            .no-data {
                font-style: italic;
                color: #666;
            }
        `;
    }

    /* -------------------------------------------------- */
    /*  Data loading                                      */
    /* -------------------------------------------------- */

    async _loadData() {
        await this._loadUser();
        await this._loadTickets();
    }

    // Fetch user record and populate table
    async _loadUser() {
        const rows = await this.core.db.run('SELECT * FROM User WHERE id=?', [this.userId]);
        if (!rows || rows.length === 0) {
            this.userTableBody.innerHTML = `<tr><td class="no-data" colspan="2">User not found</td></tr>`;
            return;
        }
        const user = rows[0];
        // iterate keys and build rows
        const keys = ['id','username','email','first_name','surname','organization','role','status'];
        const htmlRows = keys.map(key => {
            return `<tr>
                        <td class="key">${this._capitalize(key.replace('_',' '))}</td>
                        <td>${user[key]}</td>
                    </tr>`;
        }).join('');
        this.userTableBody.innerHTML = htmlRows;
    }

    // Fetch tickets list and display under user table
    async _loadTickets() {
        const tickets = await this.core.db.run('SELECT * FROM Ticket WHERE user=? ORDER BY time DESC', [this.userId]);
        if (!tickets || tickets.length === 0) {
            this.ticketsContainer.innerHTML = `<p class="no-data">No tickets submitted.</p>`;
            return;
        }
        const listHTML = `<ul>
            ${tickets.map(t => `
                <li data-ticket-id="${t.id}">
                    #${t.id} - ${this._escapeHTML(t.text).slice(0,50)}${t.text.length>50?'...':''} [${t.status}]
                    <br><small>${t.time}</small>
                </li>`).join('')}
        </ul>`;
        this.ticketsContainer.innerHTML = listHTML;
        // attach click handlers
        const listItems = this.ticketsContainer.querySelectorAll('li[data-ticket-id]');
        listItems.forEach(li => {
            li.addEventListener('click', () => {
                const ticketId = parseInt(li.getAttribute('data-ticket-id'), 10);
                this.core.route('ticket_overview', ticketId);
            });
        });
    }

    /* -------------------------------------------------- */
    /*  Helpers                                           */
    /* -------------------------------------------------- */

    _capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Basic HTML escaping
    _escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

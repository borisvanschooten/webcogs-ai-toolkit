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
Create a widget that shows in the sidebar, showing a vertical list of all tickets with status=open, sorted by date.  If you click on a ticket, route to ticket_overview, with as custom parameter the ticket ID.
@webcogs_end_prompt_section*/
export class OpenTicketsSidebar {
    constructor(core) {
        this.core = core;
        // Mount initial widget in the side bar
        this.root = core.mount(
            'side_bar',
            `
            <div class="ticket-widget">
                <h3 class="title">Open Tickets</h3>
                <div class="content"><p>Loading…</p></div>
            </div>
            `,
            `
            .ticket-widget {
                color: var(--text-color);
                background-color: var(--main-bg-color);
                padding: 10px;
                font-family: sans-serif;
            }
            .ticket-widget .title {
                margin: 0 0 8px 0;
                font-size: 16px;
            }
            .ticket-item {
                cursor: pointer;
                padding: 6px 4px;
                border-bottom: 1px solid #ccc;
            }
            .ticket-item:hover {
                background-color: #f0f0f0;
            }
            .empty {
                font-style: italic;
            }
            `
        );

        // Load data
        this.loadTickets();
    }

    async loadTickets() {
        try {
            // Query DB for open tickets, newest first
            const tickets = await this.core.db.run(
                "SELECT id, text, time FROM Ticket WHERE status=? ORDER BY time DESC",
                ["open"]
            );

            const content = this.root.querySelector('.content');
            // Clear current content
            content.innerHTML = '';

            if (!tickets || tickets.length === 0) {
                content.innerHTML = '<p class="empty">No open tickets</p>';
                return;
            }

            // Build list
            const ul = document.createElement('ul');
            ul.style.listStyle = 'none';
            ul.style.padding = '0';
            ul.style.margin = '0';

            tickets.forEach(t => {
                const li = document.createElement('li');
                li.className = 'ticket-item';
                // Show id and a snippet of text (first 30 chars)
                let snippet = t.text;
                if (snippet.length > 30) snippet = snippet.slice(0, 30) + '…';
                li.textContent = `#${t.id} – ${snippet}`;

                // Attach click handler
                li.addEventListener('click', () => {
                    this.core.route('ticket_overview', t.id);
                });

                ul.appendChild(li);
            });

            content.appendChild(ul);
        } catch (err) {
            console.error('Error loading tickets', err);
            const content = this.root.querySelector('.content');
            content.innerHTML = '<p class="empty">Error loading tickets</p>';
        }
    }
}
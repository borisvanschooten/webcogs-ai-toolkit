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
Create a widget that shows in the sidebar, showing a vertical list of all open tickets, sorted by date. Open tickets are tickets for which response = NULL.  If you click on a ticket, route to ticket_overview.
@webcogs_end_prompt_section*/
// Plugin: OpenTicketsSidebar
// Shows a list with all open tickets (response_date IS NULL) in the sidebar.
// Clicking a ticket routes to "ticket_overview" with the ticket id as parameter.

class OpenTicketsSidebar {
    constructor(core) {
        this.core = core;
        // Mount the widget in the sidebar
        this.shadowRoot = core.mount(
            'side_bar',
            `
            <div id="ticket-container">
                <p>Loading tickets...</p>
            </div>
            `,
            `
            #ticket-container {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 8px;
                font-family: sans-serif;
                font-size: 14px;
                color: #333;
            }
            .ticket-item {
                padding: 6px 8px;
                border-radius: 4px;
                border: 1px solid #e0e0e0;
                cursor: pointer;
                background: #fafafa;
                transition: background 0.15s ease-in-out;
            }
            .ticket-item:hover {
                background: #f0f0f0;
            }
            .empty-message {
                color: #777;
                font-style: italic;
            }
            `
        );

        this.containerEl = this.shadowRoot.getElementById('ticket-container');

        // Populate with current open tickets
        this.refresh();
    }

    async refresh() {
        try {
            const openTickets = await this.core.db.run(`
                SELECT id, text, entry_date
                FROM Ticket
                WHERE response_date IS NULL
                ORDER BY entry_date ASC;
            `);
            this.renderList(openTickets);
        } catch (err) {
            console.error('Error fetching tickets:', err);
            this.containerEl.innerHTML = '<p class="empty-message">Error loading tickets.</p>';
        }
    }

    renderList(tickets) {
        // Clear previous content
        this.containerEl.innerHTML = '';

        if (!tickets || tickets.length === 0) {
            this.containerEl.innerHTML = '<p class="empty-message">No open tickets.</p>';
            return;
        }

        tickets.forEach(ticket => {
            const item = document.createElement('div');
            item.className = 'ticket-item';

            // Build a concise label: date + first 50 chars of the ticket text
            const dateStr = new Date(ticket.entry_date).toLocaleDateString();
            const snippet = ticket.text.length > 50 ? `${ticket.text.slice(0, 47)}...` : ticket.text;
            item.textContent = `${dateStr} — ${snippet}`;

            // Register click handler that routes to ticket_overview with ticket id
            item.addEventListener('click', () => {
                this.core.route('ticket_overview', ticket.id);
            });

            this.containerEl.appendChild(item);
        });
    }

    // Optional cleanup method if the core supports destroying plugins
    destroy() {
        if (this.shadowRoot && this.shadowRoot.host && this.shadowRoot.host.remove) {
            this.shadowRoot.host.remove();
        }
    }
}

// Export the plugin class
export { OpenTicketsSidebar };
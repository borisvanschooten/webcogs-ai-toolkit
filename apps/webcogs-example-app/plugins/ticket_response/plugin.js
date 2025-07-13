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
Show the fields of a particular ticket, with a large area for the ticket text. The ticket ID is passed as the second parameter of the constructor. All responses to this ticket should be shown below the ticket. Below that, show a form for creating a new response, with the response text in a textarea, and the response status in a multiple choice field.  Statuses can be: open, in_progress, fixed, not_fixed. Add a submit button to submit the response. If a response is submitted, use SQL UPDATE to set the response text, status, and date, and route to ticket_response.
@webcogs_end_prompt_section*/
class TicketViewer {
    constructor(core, ticketId) {
        this.core = core;
        this.ticketId = ticketId;
        // render UI
        this.init();
    }

    async init() {
        // Load ticket data
        const ticketRows = await this.core.db.run("SELECT Ticket.*, User.username FROM Ticket JOIN User ON Ticket.user = User.id WHERE Ticket.id = ?", [this.ticketId]);
        if (ticketRows.length === 0) {
            this.mountEmpty("Ticket not found");
            return;
        }
        this.ticket = ticketRows[0];
        // Load responses
        this.responses = await this.core.db.run("SELECT * FROM Response WHERE ticket_id = ? ORDER BY time", [this.ticketId]);
        // Now render the widget
        this.mount();
        // Populate dynamic parts
        this.populateStaticFields();
        this.renderResponses();
        this.attachListeners();
    }

    mountEmpty(message) {
        const html = `<div class="ticket-viewer">
            <h2>${message}</h2>
        </div>`;
        this.root = this.core.mount('main', html, ``);
    }

    mount() {
        const html = `
        <div class="ticket-viewer">
            <h2>Ticket #${this.ticketId}</h2>
            <div class="field-row"><span class="field-label">User:</span> <span id="tv-username"></span></div>
            <div class="field-row"><span class="field-label">Current Status:</span> <span id="tv-status"></span></div>
            <div class="field-row field-text-area">
                <label for="tv-text">Ticket Text:</label><br>
                <textarea id="tv-text" readonly></textarea>
            </div>
            <h3>Responses</h3>
            <div id="tv-responses"></div>
            <h3>Add Response</h3>
            <form id="tv-response-form">
                <div class="field-row">
                    <label for="tv-response-text">Response Text:</label><br>
                    <textarea id="tv-response-text" rows="5" style="width:100%"></textarea>
                </div>
                <div class="field-row">
                    <label for="tv-response-status">Response Status:</label>
                    <select id="tv-response-status">
                        <option value="open">open</option>
                        <option value="in_progress">in_progress</option>
                        <option value="fixed">fixed</option>
                        <option value="not_fixed">not_fixed</option>
                    </select>
                </div>
                <button type="submit" id="tv-submit-btn">Submit Response</button>
                <div id="tv-error-msg" class="error-msg"></div>
            </form>
        </div>`;

        const css = `
        .ticket-viewer {
            color: var(--text-color);
            background: var(--main-bg-color);
            padding: 1em;
            box-sizing: border-box;
        }
        .ticket-viewer h2, .ticket-viewer h3 {
            margin-top: 0.5em;
            margin-bottom: 0.5em;
        }
        .field-row {
            margin: 0.5em 0;
        }
        .field-label {
            font-weight: bold;
        }
        #tv-text {
            width: 100%;
            min-height: 120px;
        }
        #tv-response-text {
            min-height: 100px;
        }
        #tv-submit-btn {
            margin-top: 0.5em;
            background: var(--button-bg-color);
            color: var(--button-text-color);
            border: none;
            padding: 0.5em 1em;
            cursor: pointer;
        }
        .response-entry {
            border: 1px solid #ccc;
            padding: 0.5em;
            margin-bottom: 0.5em;
        }
        .response-entry .response-meta {
            font-size: 0.9em;
            color: #555;
            margin-bottom: 0.3em;
        }
        .error-msg {
            color: red;
            margin-top: 0.3em;
        }`;

        this.root = this.core.mount('main', html, css);
    }

    populateStaticFields() {
        if (!this.root) return;
        this.root.getElementById('tv-username').textContent = this.ticket.username;
        this.root.getElementById('tv-status').textContent = this.ticket.status;
        this.root.getElementById('tv-text').value = this.ticket.text;
    }

    renderResponses() {
        const container = this.root.getElementById('tv-responses');
        container.innerHTML = '';
        if (this.responses.length === 0) {
            container.textContent = 'No responses yet.';
            return;
        }
        this.responses.forEach(resp => {
            const div = document.createElement('div');
            div.className = 'response-entry';
            const meta = document.createElement('div');
            meta.className = 'response-meta';
            const dateStr = new Date(resp.time).toLocaleString();
            meta.textContent = `[${dateStr}] Status: ${resp.status || '—'}`;
            const body = document.createElement('div');
            body.textContent = resp.text || '';
            div.appendChild(meta);
            div.appendChild(body);
            container.appendChild(div);
        });
    }

    attachListeners() {
        const form = this.root.getElementById('tv-response-form');
        form.addEventListener('submit', (e) => this.submitResponse(e));
    }

    async submitResponse(event) {
        event.preventDefault();
        const errorDiv = this.root.getElementById('tv-error-msg');
        errorDiv.textContent = '';
        const text = this.root.getElementById('tv-response-text').value.trim();
        const status = this.root.getElementById('tv-response-status').value;
        if (text === '') {
            errorDiv.textContent = 'Response text cannot be empty.';
            return;
        }
        const now = new Date().toISOString();
        try {
            // Insert new response
            await this.core.db.run("INSERT INTO Response (ticket_id, time, status, text) VALUES (?, ?, ?, ?)", [this.ticketId, now, status, text]);
            // Update ticket status
            await this.core.db.run("UPDATE Ticket SET status = ? WHERE id = ?", [status, this.ticketId]);
            // Route to ticket_response
            this.core.route('ticket_response', this.ticketId);
        } catch (err) {
            errorDiv.textContent = 'Error saving response.';
            console.error(err);
        }
    }
}

export default TicketViewer;
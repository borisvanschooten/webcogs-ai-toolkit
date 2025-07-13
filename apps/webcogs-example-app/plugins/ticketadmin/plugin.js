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


-- User role is one of: user, provider, admin
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
CREATE TABLE Response {
	id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    time DATETIME NOT NULL,
    status TEXT,
    text TEXT
}

@webcogs_user_prompt
Write a plugin that shows four lists, one for each possible value of status: open, in_progress, fixed, not_fixed. Lists should be descendingly ordered by date. The ticket text should be shown in a large area. Each ticket row should also show the username that issued the ticket, and the date. When you click on a ticket, it should route to "ticket_overview" with as parameter the ticket ID, except when you click on the user, which should route to "user_overview" with as parameter the user ID. Do not use jquery.

@webcogs_end_prompt_section*/
class TicketBoard {
  constructor(core) {
    this.core = core;
    // Mount the widget in the main area
    this.root = core.mount('main', this._html(), this._css());
    // Cache containers for the four lists
    this.containers = {
      'open': this.root.querySelector('#list-open'),
      'in_progress': this.root.querySelector('#list-in-progress'),
      'fixed': this.root.querySelector('#list-fixed'),
      'not_fixed': this.root.querySelector('#list-not-fixed')
    };

    // Start async initialisation
    this._init();
  }

  async _init() {
    const statuses = ['open', 'in_progress', 'fixed', 'not_fixed'];
    for (const status of statuses) {
      const rows = await this.core.db.run(
        `SELECT Ticket.id   AS ticket_id,
                Ticket.text AS ticket_text,
                Ticket.time AS ticket_time,
                User.id     AS user_id,
                User.username AS username
         FROM Ticket
         JOIN User ON Ticket.user = User.id
         WHERE Ticket.status = ?
         ORDER BY Ticket.time DESC`,
        [status]
      );
      this._renderList(status, rows);
    }
  }

  _renderList(status, rows) {
    const container = this.containers[status];
    container.innerHTML = '';

    // Only attach one listener per container
    if (!container._clickBound) {
      container.addEventListener('click', (e) => {
        // If user name clicked
        const userEl = e.target.closest('.ticket-user');
        if (userEl) {
          const userId = parseInt(userEl.dataset.userId, 10);
          this.core.route('user_overview', userId);
          e.stopPropagation();
          return;
        }
        // Otherwise row click
        const rowEl = e.target.closest('.ticket-row');
        if (rowEl) {
          const ticketId = parseInt(rowEl.dataset.ticketId, 10);
          this.core.route('ticket_overview', ticketId);
        }
      });
      container._clickBound = true;
    }

    for (const row of rows) {
      const item = document.createElement('div');
      item.className = 'ticket-row';
      item.dataset.ticketId = row.ticket_id;

      const header = document.createElement('div');
      header.className = 'ticket-header';

      const userSpan = document.createElement('span');
      userSpan.className = 'ticket-user';
      userSpan.textContent = row.username;
      userSpan.dataset.userId = row.user_id;
      header.appendChild(userSpan);

      const dateSpan = document.createElement('span');
      dateSpan.className = 'ticket-date';
      const dateObj = new Date(row.ticket_time);
      dateSpan.textContent = dateObj.toLocaleString();
      header.appendChild(dateSpan);

      item.appendChild(header);

      const textDiv = document.createElement('div');
      textDiv.className = 'ticket-text';
      textDiv.textContent = row.ticket_text;
      item.appendChild(textDiv);

      container.appendChild(item);
    }
  }

  _html() {
    return `
      <div class="ticket-board">
        <h2>Ticket Board</h2>
        <div class="status-wrapper">
          <div class="status-column" id="col-open">
            <h3>Open</h3>
            <div id="list-open" class="ticket-list"></div>
          </div>

          <div class="status-column" id="col-in-progress">
            <h3>In Progress</h3>
            <div id="list-in-progress" class="ticket-list"></div>
          </div>

          <div class="status-column" id="col-fixed">
            <h3>Fixed</h3>
            <div id="list-fixed" class="ticket-list"></div>
          </div>

          <div class="status-column" id="col-not-fixed">
            <h3>Not Fixed</h3>
            <div id="list-not-fixed" class="ticket-list"></div>
          </div>
        </div>
      </div>
    `;
  }

  _css() {
    return `
      .ticket-board {
        font-family: sans-serif;
        color: var(--text-color);
        background: var(--main-bg-color);
        padding: 10px;
      }

      .ticket-board h2 {
        text-align: center;
        margin: 5px 0 15px 0;
      }

      .status-wrapper {
        display: flex;
        gap: 1%;
      }

      .status-column {
        flex: 1 1 0;
        background: #f9f9f9;
        border: 1px solid #ccc;
        border-radius: 4px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .status-column h3 {
        margin: 0;
        padding: 6px;
        background: var(--nav_bar-bg-color);
        text-align: center;
      }

      .ticket-list {
        overflow-y: auto;
        flex: 1 1 auto;
        max-height: 70vh;
      }

      .ticket-row {
        padding: 6px;
        border-bottom: 1px solid #ddd;
        cursor: pointer;
      }

      .ticket-row:hover {
        background: #eef;
      }

      .ticket-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }

      .ticket-user {
        font-weight: bold;
        color: blue;
        cursor: pointer;
      }

      .ticket-date {
        font-size: 0.8em;
        color: #666;
      }

      .ticket-text {
        white-space: pre-line;
      }
    `;
  }
}

export default TicketBoard;
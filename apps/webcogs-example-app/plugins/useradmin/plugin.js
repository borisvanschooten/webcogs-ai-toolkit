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

## General guidelines

If showing a user's organization, show the organisation name and not the organizaiton ID.


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


-- Organization role is one of: customer, vendor
CREATE TABLE Organization (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL
);

-- User role is one of: user, developer, admin
CREATE TABLE User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    organization_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL
);

-- Ticket status is same as status of last response
-- Status can be: open, in_progress, fixed, not_fixed
CREATE TABLE Ticket (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	submitted_by INTEGER NOT NULL, -- user ID who submitted the ticket
    assigned_to INTEGER, -- organization ID which the ticket is assigned to
	text TEXT NOT NULL,
	time DATETIME NOT NULL,
    status TEXT NOT NULL
);

-- A ticket can have any number of responses
-- Each response sets at least one of the fields: assigned_to, status, or text.
CREATE TABLE Response (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    time DATETIME NOT NULL,
    assigned_to TEXT,
    status TEXT,
    text TEXT
)

@webcogs_user_prompt
Write a plugin that shows a list of all users in the database, and show all fields for each user, including organization name and role. When you click on a user, it should route to "user_overview" with as parameter the user ID.

@webcogs_end_prompt_section*/
export default class UsersList {
  constructor(core) {
    this.core = core;
    // Mount the initial UI
    this.shadow = core.mount("main", this._htmlTemplate(), this._css());

    // Cache tbody for later population
    this.tbody = this.shadow.querySelector("tbody");

    // Load data from DB and render
    this._loadData();
  }

  /* -------------------------------------------------------------------- */
  /*                           UI TEMPLATES                               */
  /* -------------------------------------------------------------------- */

  _htmlTemplate() {
    return `
      <div class="users-list-widget">
        <h2>All Users</h2>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>First name</th>
              <th>Surname</th>
              <th>Email</th>
              <th>Organisation</th>
              <th>Organisation role</th>
              <th>User role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="9" class="loading">Loading …</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  _css() {
    return `
      .users-list-widget {
        color: var(--text-color);
        background-color: var(--main-bg-color);
        padding: 1rem;
      }

      .users-list-widget h2 {
        margin-top: 0;
      }

      .users-list-widget table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }

      .users-list-widget th,
      .users-list-widget td {
        padding: 0.5rem 0.75rem;
        border: 1px solid #ccc;
        text-align: left;
      }

      .users-list-widget tbody tr:hover {
        background-color: #f5f5f5;
        cursor: pointer;
      }

      .users-list-widget td.loading {
        text-align: center;
        font-style: italic;
      }

      .users-list-widget td.error {
        color: red;
        text-align: center;
      }
    `;
  }

  /* -------------------------------------------------------------------- */
  /*                             DATA LAYER                               */
  /* -------------------------------------------------------------------- */

  async _loadData() {
    const sql = `
      SELECT
        User.id                AS id,
        User.username          AS username,
        User.email             AS email,
        User.first_name        AS first_name,
        User.surname           AS surname,
        User.role              AS user_role,
        User.status            AS status,
        Organization.name      AS organisation_name,
        Organization.role      AS organisation_role
      FROM User
      JOIN Organization ON User.organization_id = Organization.id
      ORDER BY User.id
    `;

    try {
      const rows = await this.core.db.run(sql);
      this._renderRows(rows || []);
    } catch (err) {
      // Display an error message
      this.tbody.innerHTML = `<tr><td colspan="9" class="error">Error loading users</td></tr>`;
      // Optionally, log to console for debugging
      console.error(err);
    }
  }

  /* -------------------------------------------------------------------- */
  /*                           RENDER HELPERS                             */
  /* -------------------------------------------------------------------- */

  _renderRows(rows) {
    // Clear current rows
    this.tbody.innerHTML = "";

    if (rows.length === 0) {
      this.tbody.innerHTML = `<tr><td colspan="9">No users found</td></tr>`;
      return;
    }

    // Populate table
    rows.forEach(user => {
      const tr = document.createElement("tr");
      tr.dataset.userId = user.id;

      tr.innerHTML = `
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${user.first_name}</td>
        <td>${user.surname}</td>
        <td>${user.email}</td>
        <td>${user.organisation_name}</td>
        <td>${user.organisation_role}</td>
        <td>${user.user_role}</td>
        <td>${user.status}</td>
      `;

      // Click handler to route to user overview
      tr.addEventListener("click", () => {
        this.core.route("user_overview", user.id);
      });

      this.tbody.appendChild(tr);
    });
  }

  /* -------------------------------------------------------------------- */
  /*                               CLEANUP                                */
  /* -------------------------------------------------------------------- */

  // Optional destroy handler if the core supports plugin destruction
  destroy() {
    if (this.shadow && this.shadow.host && this.shadow.host.remove) {
      this.shadow.host.remove();
    }
  }
}
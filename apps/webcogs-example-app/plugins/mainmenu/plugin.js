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
Write a plugin that shows the main menu, which is a horizontal area at the top.  The main menu has the following items, which should route to particular routes when clicked:

- Users - route to useradmin
- Tickets - route to ticketadmin
- Stats - route to ticket_stats

The menu item that is selected by the user should be highlighted.

At the right is a logout button that routes to logout.  

@webcogs_end_prompt_section*/
export default class MainMenu {
  constructor(core) {
    this.core = core;

    const html = `
      <div class="top-menu" role="navigation" aria-label="Main menu">
        <div class="menu-item" data-route="useradmin">Users</div>
        <div class="menu-item" data-route="ticketadmin">Tickets</div>
        <div class="menu-item" data-route="ticket_stats">Stats</div>
        <div class="spacer"></div>
        <button class="logout-btn" data-route="logout" title="Logout">Logout</button>
      </div>
    `;

    const css = `
      .top-menu {
        display: flex;
        align-items: center;
        background-color: var(--top_menu-bg-color);
        color: var(--top-menu-text-color);
        padding: 0.5rem 1rem;
        font-family: sans-serif;
        box-sizing: border-box;
        width: 100%;
      }

      .menu-item {
        margin-right: 1rem;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        user-select: none;
        border-radius: 4px;
        transition: background-color 0.2s;
      }

      .menu-item:hover {
        background-color: rgba(255,255,255,0.15);
      }

      .menu-item.selected {
        background-color: var(--button-bg-color);
        color: var(--button-text-color);
      }

      .spacer {
        flex-grow: 1;
      }

      .logout-btn {
        background-color: var(--button-bg-color);
        color: var(--button-text-color);
        border: none;
        padding: 0.4rem 0.8rem;
        cursor: pointer;
        border-radius: 4px;
        font-weight: bold;
      }

      .logout-btn:hover {
        opacity: 0.85;
      }
    `;

    // Mount the widget in the nav_bar area and keep a reference to the shadow root.
    this.root = core.mount("nav_bar", html, css);

    // Save references for later use
    this.menuItems = this.root.querySelectorAll('.menu-item');
    this.logoutBtn = this.root.querySelector('.logout-btn');

    // Attach event listeners to menu items
    this.menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const route = target.getAttribute('data-route');
        this.selectItem(target);
        this.core.route(route);
      });
    });

    // Logout button listener
    this.logoutBtn.addEventListener('click', () => {
      this.clearSelection();
      this.core.route('logout');
    });
  }

  // Mark the given element as selected and clear others
  selectItem(element) {
    this.menuItems.forEach(item => item.classList.remove('selected'));
    if (element) {
      element.classList.add('selected');
    }
  }

  // Clear all selections (used when logging out)
  clearSelection() {
    this.menuItems.forEach(item => item.classList.remove('selected'));
  }
}

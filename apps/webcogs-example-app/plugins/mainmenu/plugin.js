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
Write a plugin that shows the main menu, which is a horizontal area at the top.  The main menu has the following items, which should route to particular routes when clicked:

- Users - route to useradmin
- Tickets - route to ticketadmin

At the right is a logout button that should route to logout.  The menu item that is selected by the user should be highlighted.

@webcogs_end_prompt_section*/
// Main menu plugin.  Shows a horizontal bar with two menu items and a logout button.
// constructor(core, activeRoute)
//    core        - core object provided by host app
//    activeRoute - (optional) initially selected route so correct menu item is highlighted

export class MainMenu {
    constructor(core, activeRoute = "") {
        this.core = core;
        this.activeRoute = activeRoute;
        this._mountMenu();
    }

    _mountMenu() {
        const html = `
            <div class="menu-wrapper">
                <ul class="menu-items">
                    <li class="menu-item" data-route="useradmin">Users</li>
                    <li class="menu-item" data-route="ticketadmin">Tickets</li>
                </ul>
                <button class="logout-btn" data-route="logout">Logout</button>
            </div>
        `;

        const css = `
            .menu-wrapper {
                display: flex;
                align-items: center;
                width: 100%;
                background: #333;
                color: #fff;
                font-family: sans-serif;
                box-sizing: border-box;
            }
            .menu-items {
                list-style: none;
                margin: 0;
                padding: 0;
                display: flex;
            }
            .menu-item {
                padding: 10px 15px;
                cursor: pointer;
                user-select: none;
            }
            .menu-item:hover {
                background: #444;
            }
            .menu-item.active {
                background: #555;
            }
            .logout-btn {
                margin-left: auto;
                padding: 8px 14px;
                cursor: pointer;
                background: #880000;
                color: #fff;
                border: none;
                border-radius: 2px;
                user-select: none;
            }
            .logout-btn:hover {
                background: #aa0000;
            }
        `;

        // Mount into the nav_bar area and keep reference to shadowRoot
        this.shadowRoot = this.core.mount("nav_bar", html, css);

        // Setup listeners for menu items
        const items = Array.from(this.shadowRoot.querySelectorAll(".menu-item"));
        items.forEach(item => {
            item.addEventListener("click", () => {
                const route = item.getAttribute("data-route");
                this._highlight(route);
                this.core.route(route);
            });
        });

        // Logout button
        const logoutBtn = this.shadowRoot.querySelector(".logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                this.core.route("logout");
            });
        }

        // Initial highlight if provided
        if (this.activeRoute) {
            this._highlight(this.activeRoute);
        }
    }

    _highlight(route) {
        // Remove existing highlights
        const items = this.shadowRoot.querySelectorAll(".menu-item");
        items.forEach(el => el.classList.remove("active"));

        // Add to the item that matches the route
        const activeEl = this.shadowRoot.querySelector(`.menu-item[data-route="${route}"]`);
        if (activeEl) {
            activeEl.classList.add("active");
        }
    }
}
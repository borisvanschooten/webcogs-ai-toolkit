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

## Additional core functions

core.getUserId() - get ID of logged in user
core.getUserRole() - get role of logged in user (user, developer, or admin)

## available core.mount locations

- modal_dialog - modal dialog that displays as an overlay
- main - main area of screen
- nav_bar - navigation bar for main menu
- side_bar - side bar for submenus

## core.route routes

A route is a string that indicates a widget plugin name.

## Style guide

Use the classes, styles, and properties in the supplied CSS definitions as much as possible.

## General guidelines

Widgets should always display a title.

If showing an organization, always show the organisation name and not the organization ID.

Users should be shown like this: first_name surname (@username)

Ticket should be shown like this: Ticket #ticket_id


## CSS definitions

:root {
  --text-color: #000;
  --main-bg-color: #fff;
  --nav_bar-bg-color: #eee;
  --top_menu-bg-color: #222;
  --top-menu-text-color: #fff;
  --button-bg-color: #aaf;
  --button-text-color: #006;
  --highlight-ticket-bg-color: #eaa;
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
Write a plugin that shows the main menu, which is a horizontal area at the top.  The main menu has the following items, which should route to particular routes when clicked:

- Submit ticket - route to submit_ticket
- Users - route to useradmin
- Tickets - route to ticketadmin
- Stats - route to ticket_stats

The menu item that is selected by the user should be highlighted.

At the right, show:

- The logged in user.
- a logout button that routes to logout.  

@webcogs_end_prompt_section*/
class MainMenu {
    /**
     * Creates a main menu navigation bar.
     * @param {object} core - core API object provided by the host application
     */
    constructor(core) {
        this.core = core;
        this.menuItems = [
            { label: "Submit ticket", route: "submit_ticket" },
            { label: "Users",          route: "useradmin"      },
            { label: "Tickets",        route: "ticketadmin"    },
            { label: "Stats",          route: "ticket_stats"   }
        ];
        // Keep currently selected route in memory for highlight purposes
        this.selectedRoute = null;
        // Render UI
        this.mountPoint = this.core.mount(
            "nav_bar",
            this._generateHTML(),
            this._generateCSS()
        );
        // Populate user info (async)
        this._populateUserInfo();
        // Set up event listeners for menu clicks and logout
        this._attachEventHandlers();
    }

    /**
     * Builds the HTML markup for the menu widget.
     * @returns {string}
     */
    _generateHTML() {
        // Build list items
        const itemsHTML = this.menuItems.map(item => {
            return `<li class="menu-item" data-route="${item.route}">${item.label}</li>`;
        }).join("");

        return `
            <div class="main-menu-widget" title="Main Menu">
                <ul class="menu-list">${itemsHTML}</ul>
                <div class="right-section">
                    <span class="user-display">&nbsp;</span>
                    <button class="logout-btn">Logout</button>
                </div>
            </div>
        `;
    }

    /**
     * Builds the CSS for the widget.
     * @returns {string}
     */
    _generateCSS() {
        return `
            .main-menu-widget {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background-color: var(--top_menu-bg-color);
                color: var(--top-menu-text-color);
                padding: 0 10px;
                box-sizing: border-box;
                font-family: sans-serif;
            }

            .menu-list {
                list-style: none;
                margin: 0;
                padding: 0;
                display: flex;
                gap: 15px;
            }

            .menu-item {
                cursor: pointer;
                padding: 10px 5px;
                user-select: none;
            }

            .menu-item:hover {
                background-color: rgba(255,255,255,0.1);
            }

            .menu-item.selected {
                background-color: var(--button-bg-color);
                color: var(--button-text-color);
            }

            .right-section {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .logout-btn {
                background-color: var(--button-bg-color);
                color: var(--button-text-color);
                border: none;
                padding: 6px 12px;
                cursor: pointer;
            }

            .logout-btn:hover {
                opacity: 0.8;
            }
        `;
    }

    /**
     * Attach click handlers to menu items and logout button.
     */
    _attachEventHandlers() {
        const shadowRoot = this.mountPoint;
        // Menu item clicks
        const menuItems = shadowRoot.querySelectorAll('.menu-item');
        menuItems.forEach(li => {
            li.addEventListener('click', () => {
                const route = li.getAttribute('data-route');
                if (!route) return;
                this._highlightMenuItem(li);
                this.core.route(route);
            });
        });

        // Logout button
        const logoutBtn = shadowRoot.querySelector('.logout-btn');
        logoutBtn.addEventListener('click', () => {
            this.core.route('logout');
        });
    }

    /**
     * Highlights the selected menu item and clears previous selection.
     * @param {HTMLElement} selectedLi
     */
    _highlightMenuItem(selectedLi) {
        const shadowRoot = this.mountPoint;
        shadowRoot.querySelectorAll('.menu-item').forEach(li => {
            if (li === selectedLi) {
                li.classList.add('selected');
            } else {
                li.classList.remove('selected');
            }
        });
    }

    /**
     * Fetch user details from DB and update UI.
     */
    async _populateUserInfo() {
        try {
            const userId = this.core.getUserId();
            if (!userId) return;
            const rows = await this.core.db.run(
                "SELECT first_name, surname, username FROM User WHERE id = ?",
                [userId]
            );
            if (rows && rows.length > 0) {
                const { first_name, surname, username } = rows[0];
                const displayText = `${first_name} ${surname} (@${username})`;
                const shadowRoot = this.mountPoint;
                const userDisplayEl = shadowRoot.querySelector('.user-display');
                if (userDisplayEl) userDisplayEl.textContent = displayText;
            }
        } catch (e) {
            console.error('MainMenu: failed to load user info', e);
        }
    }
}

export default MainMenu;
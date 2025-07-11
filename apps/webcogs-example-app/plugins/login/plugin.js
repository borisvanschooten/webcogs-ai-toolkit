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
Write a plugin that shows a login screen as a modal dialog. It has two fields: username and password, and a button "login". When login is pressed, route to "logged_in" with username and password as parameters. The constructor takes an extra string parameter "error". If defined, the error should be shown under the login button.
@webcogs_end_prompt_section*/
export default class LoginPlugin {
  constructor(core, error) {
    this.core = core;
    this.error = error;

    // HTML for the modal dialog
    const html = `
      <div class="dialog">
        <form id="login-form">
          <div class="field">
            <label>Username<br>
              <input type="text" id="username" required>
            </label>
          </div>
          <div class="field">
            <label>Password<br>
              <input type="password" id="password" required>
            </label>
          </div>
          <button type="submit" id="login-btn">Login</button>
          <div id="error" class="error" style="display:${error ? 'block' : 'none'}">${error ? error : ''}</div>
        </form>
      </div>
    `;

    // Corresponding CSS styling
    const css = `
      .dialog {
        padding: 20px;
        font-family: Arial, sans-serif;
      }
      .field {
        margin-bottom: 10px;
      }
      input {
        width: 100%;
        padding: 5px;
        box-sizing: border-box;
      }
      button {
        padding: 8px 16px;
        cursor: pointer;
      }
      .error {
        color: red;
        margin-top: 10px;
      }
    `;

    // Mount the dialog in the modal_dialog location and keep the shadowRoot reference
    const root = core.mount("modal_dialog", html, css);

    // Handle the login form submission
    const form = root.getElementById("login-form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = root.getElementById("username").value.trim();
      const password = root.getElementById("password").value;
      // Route to the logged_in route with username and password
      core.route("logged_in", username, password);
    });
  }
}
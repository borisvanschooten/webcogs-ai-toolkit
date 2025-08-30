/*@webcogs_build 0.3.1 openai-o3 2025-07-30T11:14:46.298Z
@webcogs_system_prompt
# Docs for writing a plugin

A plugin is a module that can interact with the user via HTML widgets, or process information.  A plugin is always defined as a single export class, and should be written in vanilla Javascript. Always define the class as an "export class". Do not assume any libraries are available.  For example, do not use jquery.  The class constructor always has this signature: 
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

function core.translate(string) - Translate a literal string into the user's language.

## Core properties

core.db is a SQLite compatible database object. It has the following functions: 
- async function db.run(sql_statement, optional_values) - execute a SQL statement or query. Note this is an async function. If it is a query, returns an array of objects, otherwise returns null. Each object represents a record, with keys representing the column names and values the record values. If optional_values is supplied, it should be an array, with its elements bound to "?" symbols in the sql_statement string. For example: db.run("SELECT * FROM my_table WHERE id=?",[1000]) will be interpolated to "SELECT * FROM my_table where id=1000". 

## Additional core functions

core.getUserId() - get ID of logged in user
core.getUserRole() - get role of logged in user (user, developer, or admin)
async core.getOrganizations() - get all Organization records

## available core.mount locations

- modal_dialog - modal dialog that displays as an overlay
- main - main area of screen
- nav_bar - navigation bar for main menu
- side_bar - side bar for submenus

## core.route routes

A route is a string that indicates a widget plugin name.

## Style guide

Use the classes, styles, and properties in the supplied CSS definitions as much as possible. Do not override the styles in the CSS classes you use, use them as-is.  You can assume they are available to any widgets you mount.

## General guidelines

Widgets should always display a title.

Form fields, labels, and buttons should be left-aligned.

Email form fields should be implemented using input type="email".

If showing an organization, always show the organisation name and not the organization ID.

Users should be shown like this: first_name surname (@username).

Ticket should be shown like this: Ticket #ticket_id.

This is a multilingual application. Run all literal strings / texts in the code and HTML through core.translate(). Do not write your own wrapper function, always call core.translate directly.


## CSS definitions

:root {
  --text-color: #000;
  --main-bg-color: #fff;
  --button-bg-color: #bbf;
  --button-text-color: #006;
  --highlight-ticket-bg-color: #fcc;
  --mainmenu-item-selected-bg-color: #88f;
}

\/* Use UL/LI with the following classes for mainmenu *\/
ul.mainmenu {
  list-style: none;
  display: flex;
  gap: 15px;
  margin: 8px;
  padding: 0px;
  padding-left: 90px;
  background-image: url('images/logo40-title.png');
  background-repeat: no-repeat;
  background-position: 0% 50%;
}
li.mainmenu-item {
  cursor: pointer;
  padding: 10px 5px;
  user-select: none;
  color: #fff;
}

@media (max-width: 700px) {
    ul.mainmenu {
        display: block;
        height: auto;
        background: none;
        padding-left: 0px;
    }
}

span.logged-in-user {
  font-size: 18px;
  cursor: pointer;
  color: #fff;
}


\/* Use the organization-avatar styles to add an avatar to each organization *\/
div.organization-avatar {
  display: inline-block;
  width: 30px;
  height: 30px;
}
\/* Avatar variant for null organization *\/
div.organization-avatar.id-none {
  background-color: #eee;
}
\/* Avatar variants numbered "id-1" through "id-6" *\/
div.organization-avatar.id-1 {
  background-color: #f84;
}
div.organization-avatar.id-2 {
  background-color: #fe4;
}
div.organization-avatar.id-3 {
  background-color: #0f0;
}
div.organization-avatar.id-4 {
  background-color: #2df;
}
div.organization-avatar.id-5 {
  background-color: #66f;
}
div.organization-avatar.id-6 {
  background-color: #f4f;
}

input[type="text"], input[type="email"], input[type="password"] {
  width: 100%;
  min-width: 300px;
}

select {
  background-color: var(--button-bg-color);
  font-size: 18px;
  border: 2px solid #88c;
  padding: 4px;
  margin: 4px;
  border-radius: 4px;
}

button {
  background-color: var(--button-bg-color);
  color: var(--button-text-color);
  padding: 4px 12px;
  font-size: 18px;
  cursor: pointer;
  border: 2px solid #88c;
  border-radius: 4px;
  box-shadow: 4px 4px 4px rgba(0,0,0,0.1);
}
button.route-to-signup {
  border: none;
  background-color: transparent;
  font-weight: bold;
  text-decoration: underline;
  box-shadow: none;
}

\/* use pre.ticket-text to show the content of ticket and response text *\/
pre, pre.ticket-text {
  white-space: pre-wrap;
  font-family: Arial, sans-serif;
  background: #eee;
  padding: 10px;
  border: 1px solid #aaa;
}

div.login-screen-title {
  font-size: 22px;
  font-weight: bold;
  background-image: url('images/logo40.png');
  height: 40px;
  line-height: 40px;
  background-repeat: no-repeat;
  background-position: 0% 50%;
  padding-left: 80px;
  margin-bottom: 10px;
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
    role TEXT NOT NULL
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
	submitted_by INTEGER NOT NULL, -- user ID who submitted the ticket
    time DATETIME NOT NULL,
    assigned_to TEXT,
    status TEXT,
    text TEXT
)

@webcogs_user_prompt
Write a plugin that shows a login screen as a modal dialog. It has two fields: username and password, and a button 'login'. When login is pressed, route to 'logged_in' with username and password as parameters. The constructor takes two parameters: 'error' and 'language'. If error is defined, the error should be shown under the login button. Below the login button is a language selector, where you can select a language: English (en_us), Dutch (nl_nl), and Italian (it_it).  If language parameter is defined, default to that, otherwise to en_us. When a language is selected, route to set_language with as parameter the language code. Below that is a signup button, which routes to signup.
@webcogs_end_prompt_section*/
export class LoginPlugin {
  constructor(core, error, language) {
    this.core = core;
    this.error = error;
    this.language = language || 'en_us';

    this.render();
  }

  render() {
    // Build HTML with translations
    const t = (str) => this.core.translate(str);

    const langOptions = [
      { code: 'en_us', label: t('English (en_us)') },
      { code: 'nl_nl', label: t('Dutch (nl_nl)') },
      { code: 'it_it', label: t('Italian (it_it)') },
    ];

    const optionsHtml = langOptions
      .map((opt) =>
        `<option value="${opt.code}" ${opt.code === this.language ? 'selected' : ''}>${opt.label}</option>`
      )
      .join('');

    const errorHtml = this.error
      ? `<div id="login-error" class="error-message">${t(this.error)}</div>`
      : '';

    const html = `
      <div class="login-container">
        <div class="login-screen-title">${t('Login')}</div>
        <div>
          <label for="username">${t('Username')}</label><br/>
          <input type="text" id="username" /><br/>
        </div>
        <div>
          <label for="password">${t('Password')}</label><br/>
          <input type="password" id="password" /><br/>
        </div>
        <button id="login-button">${t('Login')}</button>
        ${errorHtml}
        <div style="margin-top:10px;">
          <label for="language-select">${t('Select language')}:</label><br/>
          <select id="language-select">${optionsHtml}</select>
        </div>
        <div style="margin-top:10px;">
          <button id="signup-button" class="route-to-signup">${t('Signup')}</button>
        </div>
      </div>
    `;

    const css = `
      .login-container {
        color: var(--text-color);
        background-color: var(--main-bg-color);
        padding: 20px;
        border-radius: 8px;
      }
      .error-message {
        color: red;
        margin-top: 6px;
      }
    `;

    // Mount widget
    this.root = this.core.mount('modal_dialog', html, css);

    // Attach event listeners inside shadow DOM
    const qs = (selector) => this.root.querySelector(selector);

    qs('#login-button').addEventListener('click', () => {
      const username = qs('#username').value.trim();
      const password = qs('#password').value;
      this.core.route('logged_in', username, password);
    });

    qs('#language-select').addEventListener('change', (e) => {
      const newLang = e.target.value;
      this.core.route('set_language', newLang);
    });

    qs('#signup-button').addEventListener('click', () => {
      this.core.route('signup');
    });
  }
}
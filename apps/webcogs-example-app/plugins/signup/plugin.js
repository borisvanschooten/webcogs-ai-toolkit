/*@webcogs_system_prompt
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

async function core.loadTranslations(language_code) - load translations for a particular language
language_code - an ISO language code, for example "en_us" or "en_gb", or null for the default

function core.translate(string) - Translate a string into the user's language.

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

If showing an organization, always show the organisation name and not the organization ID.

Users should be shown like this: first_name surname (@username)

Ticket should be shown like this: Ticket #ticket_id

This is a multilingual applicatiom. Run all literal strings / texts in the code and HTML through core.translate(). Do not write your own wrapper function, always call core.translate directly.

Email form fields should be implemented using input type="email".


## CSS definitions

:root {
  --text-color: #000;
  --main-bg-color: #fff;
  --button-bg-color: #bbf;
  --button-text-color: #006;
  --highlight-ticket-bg-color: #fcc;
  --mainmenu-item-selected-bg-color: #66f;
}

\/* Use UL/LI with the following classes for mainmenu *\/
ul.mainmenu {
  list-style: none;
  display: flex;
  gap: 15px;
  background-color: #222;
  margin: 8px;
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
  padding: 4px;
}
button {
  background-color: var(--button-bg-color);
  color: var(--button-text-color);
  padding: 4px 12px;
  font-size: 18px;
  cursor: pointer;
}
button.go-to-signup-screen {
  border: none;
  background-color: transparent;
  font-weight: bold;
}
pre {
  white-space: pre-wrap;
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
    time DATETIME NOT NULL,
    assigned_to TEXT,
    status TEXT,
    text TEXT
)

@webcogs_user_prompt
Write a plugin that shows a signup form as a modal dialog. The form has the following fields: username, email, first_name, surname, and a dropdown for selecting organization and role (user or developer). A submit button routes to signed_up, with as custom parameter an object with the fields in it.  A cancel button should route back to login.  The constructor takes an extra string parameter 'error'. If defined, the error should be shown under the signup button. You have no access to core.db, so use core.getOrganizations instead.
@webcogs_end_prompt_section*/
export class SignupModal {
  constructor(core, error) {
    this.core = core;
    this.error = error;
    // Build HTML for modal dialog
    const html = `
      <div>
        <h2>${core.translate('Sign up')}</h2>
        <form id="signup-form">
          <label>
            ${core.translate('Username')}<br>
            <input type="text" id="signup-username" required />
          </label><br><br>
          <label>
            ${core.translate('Email')}<br>
            <input type="email" id="signup-email" required />
          </label><br><br>
          <label>
            ${core.translate('First name')}<br>
            <input type="text" id="signup-firstname" required />
          </label><br><br>
          <label>
            ${core.translate('Surname')}<br>
            <input type="text" id="signup-surname" required />
          </label><br><br>
          <label>
            ${core.translate('Organization')}<br>
            <select id="signup-organization" required>
              <option value="" disabled selected>${core.translate('Loading...')}</option>
            </select>
          </label><br><br>
          <label>
            ${core.translate('Role')}<br>
            <select id="signup-role" required>
              <option value="user">${core.translate('User')}</option>
              <option value="developer">${core.translate('Developer')}</option>
            </select>
          </label><br><br>
          <div style="margin-top:10px;">
            <button type="submit" id="signup-submit">${core.translate('Sign up')}</button>
            <button type="button" id="signup-cancel">${core.translate('Cancel')}</button>
          </div>
          <div id="signup-error" style="color:red;margin-top:8px;min-height:20px;"></div>
        </form>
      </div>
    `;

    const css = ``; // No extra styles needed beyond defaults

    this.shadowRoot = core.mount('modal_dialog', html, css);

    this.form = this.shadowRoot.getElementById('signup-form');
    this.usernameInput = this.shadowRoot.getElementById('signup-username');
    this.emailInput = this.shadowRoot.getElementById('signup-email');
    this.firstnameInput = this.shadowRoot.getElementById('signup-firstname');
    this.surnameInput = this.shadowRoot.getElementById('signup-surname');
    this.organizationSelect = this.shadowRoot.getElementById('signup-organization');
    this.roleSelect = this.shadowRoot.getElementById('signup-role');
    this.errorDiv = this.shadowRoot.getElementById('signup-error');

    if (this.error) {
      this.errorDiv.textContent = this.error;
    }

    // Bind events
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    const cancelBtn = this.shadowRoot.getElementById('signup-cancel');
    cancelBtn.addEventListener('click', () => {
      core.route('login');
    });

    // Load organizations asynchronously
    this.loadOrganizations();
  }

  async loadOrganizations() {
    try {
      const organizations = await this.core.getOrganizations();
      // Clear existing options
      this.organizationSelect.innerHTML = '';
      // Add a default disabled selected option
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.disabled = true;
      defaultOpt.selected = true;
      defaultOpt.textContent = this.core.translate('Select an organization');
      this.organizationSelect.appendChild(defaultOpt);

      // Populate organizations
      for (const org of organizations) {
        const opt = document.createElement('option');
        opt.value = org.id;
        opt.textContent = org.name; // Show name per guidelines
        this.organizationSelect.appendChild(opt);
      }
    } catch (err) {
      // Could not load orgs
      this.organizationSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = this.core.translate('Unable to load organizations');
      this.organizationSelect.appendChild(opt);
    }
  }

  handleSubmit() {
    const data = {
      username: this.usernameInput.value.trim(),
      email: this.emailInput.value.trim(),
      first_name: this.firstnameInput.value.trim(),
      surname: this.surnameInput.value.trim(),
      organization_id: parseInt(this.organizationSelect.value, 10),
      role: this.roleSelect.value
    };
    // Basic validation: ensure all fields filled
    if (!data.username || !data.email || !data.first_name || !data.surname || isNaN(data.organization_id)) {
      this.errorDiv.textContent = this.core.translate('Please fill in all fields');
      return;
    }

    // Route to signed_up with data
    this.core.route('signed_up', data);
  }
}